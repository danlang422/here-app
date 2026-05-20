# Activity Management Page Overhaul — Build Spec

**Created:** March 22, 2026  
**Status:** Implemented
**Context:** The activity page is currently a flat alphabetical list with no sorting, filtering, or search. As the activity count has grown (54 and counting), the admin needs tools to navigate, triage, and act on activities efficiently. This spec also includes the app-layer changes required by the `activity_terms` many-to-many migration (`20260320000000_terms_many_to_many.sql`), which removed `term_id` from activities and replaced it with a junction table.

---

## Scope

This spec covers:

1. **Activity page search, filtering, and sorting** — making the page a working surface for schedule-building
2. **API and hook updates for `activity_terms`** — replacing `term_id` references with junction table queries
3. **Term picker UI** — converting the single-select term dropdown in `ActivityDetail` to a multi-select tag picker
4. **Duration field semantics** — treating `duration_minutes` as a planning-only field for unplaced activities

This spec does NOT cover (designed for, built later):

- Batch block suggestion/assignment tool
- Bulk term application tool
- Student schedule view integration (separate spec exists)
- Activity page card/grid layout alternative to the table

---

## Part 1: API and Hook Changes (activity_terms migration)

The `term_id` column no longer exists on activities. All term associations now live in `activity_terms`. The following changes bring the app layer in sync with the new schema.

### Modified: `src/api/activities.js`

**`getActivities()`** — Update the select to join through `activity_terms` and pull term data alongside each activity:

```js
export async function getActivities(organizationId, { termId, isActive = true } = {}) {
  let query = supabase
    .from('activities')
    .select(`
      *,
      teacher:user_profiles!teacher_id(first_name, last_name),
      monitor:user_profiles!monitor_id(first_name, last_name),
      activity_terms(id, term_id, is_primary, term:academic_terms(id, name, start_date, end_date))
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', isActive)
    .order('block', { ascending: true, nullsFirst: false })
    .order('name')

  if (termId) {
    // Filter to activities that have this term associated
    query = query.eq('activity_terms.term_id', termId)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}
```

Each activity in the response will have an `activity_terms` array like:

```json
[
  {
    "id": "...",
    "term_id": "...",
    "is_primary": true,
    "term": { "id": "...", "name": "Semester 2", "start_date": "2026-01-20", "end_date": "2026-06-03" }
  }
]
```

Activities with no terms will have `activity_terms: []`.

**Important:** When filtering by `termId`, PostgREST's behavior with nested filters on `activity_terms.term_id` will filter the *nested array* to only matching rows, but will still return all activities (with empty `activity_terms` arrays for non-matches). The app layer needs to post-filter: if `termId` is specified, exclude activities where `activity_terms` is empty after the filter. Alternatively, use an RPC or a different query pattern. The simplest approach for v1 is client-side filtering after fetch, since the dataset is small (< 100 activities).

### New: `src/api/activityTerms.js`

```js
import { supabase } from './supabase'

/**
 * Get all term associations for an activity.
 */
export async function getActivityTerms(activityId) {
  const { data, error } = await supabase
    .from('activity_terms')
    .select('*, term:academic_terms(id, name, start_date, end_date)')
    .eq('activity_id', activityId)
    .order('is_primary', { ascending: false }) // primary first
    .order('created_at')

  if (error) throw error
  return data
}

/**
 * Add a term to an activity.
 * If the activity has no existing term associations, marks this one as primary.
 */
export async function addActivityTerm(activityId, termId, { isPrimary = false } = {}) {
  const { data, error } = await supabase
    .from('activity_terms')
    .insert({ activity_id: activityId, term_id: termId, is_primary: isPrimary })
    .select('*, term:academic_terms(id, name, start_date, end_date)')
    .single()

  if (error) throw error
  return data
}

/**
 * Remove a term association from an activity.
 */
export async function removeActivityTerm(activityTermId) {
  const { error } = await supabase
    .from('activity_terms')
    .delete()
    .eq('id', activityTermId)

  if (error) throw error
}
```

### New: `src/hooks/useActivityTerms.js`

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getActivityTerms, addActivityTerm, removeActivityTerm } from '@/api/activityTerms'

export function useActivityTerms(activityId) {
  return useQuery({
    queryKey: ['activity-terms', activityId],
    queryFn: () => getActivityTerms(activityId),
    enabled: !!activityId,
  })
}

export function useAddActivityTerm(activityId, orgId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ termId, isPrimary }) => addActivityTerm(activityId, termId, { isPrimary }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-terms', activityId] })
      queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
    },
  })
}

export function useRemoveActivityTerm(activityId, orgId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (activityTermId) => removeActivityTerm(activityTermId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-terms', activityId] })
      queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
    },
  })
}
```

### Modified: `src/components/activities/ActivityDetail.jsx`

The form's `onFormSubmit` currently sends `term_id` as part of the activity update. **Remove `term_id` from the submit payload entirely.** Term associations are now managed separately through the tag picker (see Part 3 below), not through the activity's own update mutation.

Changes in `onFormSubmit`:
```js
// REMOVE this line:
// term_id: formValues.term_id || null,
```

Remove `term_id` from `DEFAULT_VALUES` and `buildInitialValues`.

Remove the `watchedTermId` useEffect that auto-fills dates — this logic moves into the term tag picker's add handler (see Part 3).

---

## Part 2: Activity Page — Search, Filters, and Sort

### Component Structure

```
src/pages/admin/ActivityManagement.jsx    — page component (existing, modified)
src/components/activities/ActivityToolbar.jsx — NEW: search + filter bar + sort controls
src/components/activities/ActivityTable.jsx   — existing, modified for sort + term display
```

The toolbar sits between the page header and the table. All filter/sort state lives in `ActivityManagement.jsx` as local state (no URL params or persistence needed for v1).

### ActivityToolbar

A horizontal bar containing:

1. **Search input** — text search across activity name, instructor_name, location, and mentor_name
2. **Filter controls** — dropdowns/selects for each filterable dimension
3. **Sort control** — dropdown to select sort field + direction

#### Search

```jsx
<input
  type="text"
  placeholder="Search activities..."
  className="input input-bordered input-sm w-64"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

Client-side filtering. Matches against: `name`, `instructor_name`, `location`, `mentor_name`, and joined `teacher.last_name` / `monitor.last_name`. Case-insensitive substring match. Debounce not needed at current data size.

#### Filters

Each filter is a `<select>` with an "All" default. Multiple filters combine with AND logic (all must match).

| Filter | Options | Matching Logic |
|--------|---------|----------------|
| **Block** | All, Block 0–5 (using block labels), No block | `activity.block === value` or `activity.block == null` for "No block" |
| **Term** | All, each term by name, No term | Check `activity.activity_terms` array for matching `term_id`, or empty array for "No term" |
| **Schedule status** | All, Scheduled, Needs scheduling, Not scheduled, Release | See derivation below |
| **Staff** | All, each staff member by name, No staff | Match against `teacher_id`, `monitor_id`, or presence of `instructor_name`/`mentor_name` |

**Schedule status derivation:**

```js
function getScheduleStatus(activity) {
  if (activity.is_not_scheduled) return 'not_scheduled'
  if (activity.is_release) return 'release'
  if (!activity.days_of_week && !activity.rotation_day_type) return 'needs_scheduling'
  if (!activity.default_start_time) return 'needs_scheduling'
  return 'scheduled'
}
```

This reuses the same logic from `getNeedsScheduling` in the API but applied client-side for the filter.

**Days/Rotation filter (optional, include if straightforward):**

| Filter | Options | Matching Logic |
|--------|---------|----------------|
| **Days** | All, M, Tu, W, Th, F, A Day, B Day | `days_of_week` includes selected day, or `rotation_day_type` matches |

If this adds too much clutter to the toolbar, defer it. The schedule status filter covers the most important use case (finding activities that need attention).

#### Sort

A single `<select>` controlling sort field. Direction toggles on re-select (or a separate asc/desc toggle).

| Sort option | Field(s) | Default direction |
|-------------|----------|-------------------|
| Name | `name` | A→Z |
| Block | `block` (nulls last), then `name` | 0→5 |
| Time | `default_start_time` (nulls last), then `name` | Early→Late |
| Enrolled | enrollment count | High→Low |

Default sort: **Block** (matching current `getActivities` order).

### Filter + Sort Implementation

All filtering and sorting happens client-side in `ActivityManagement.jsx` using `useMemo`:

```js
const [searchQuery, setSearchQuery] = useState('')
const [filters, setFilters] = useState({
  block: 'all',       // 'all' | number | 'none'
  term: 'all',        // 'all' | term_id | 'none'
  status: 'all',      // 'all' | 'scheduled' | 'needs_scheduling' | 'not_scheduled' | 'release'
  staff: 'all',       // 'all' | user_id | 'none'
})
const [sortField, setSortField] = useState('block')
const [sortDir, setSortDir] = useState('asc')

const filteredActivities = useMemo(() => {
  let result = activities

  // Text search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    result = result.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.instructor_name?.toLowerCase().includes(q) ||
      a.mentor_name?.toLowerCase().includes(q) ||
      a.location?.toLowerCase().includes(q) ||
      a.teacher?.last_name?.toLowerCase().includes(q) ||
      a.monitor?.last_name?.toLowerCase().includes(q)
    )
  }

  // Block filter
  if (filters.block !== 'all') {
    if (filters.block === 'none') {
      result = result.filter(a => a.block == null)
    } else {
      result = result.filter(a => a.block === filters.block)
    }
  }

  // Term filter
  if (filters.term !== 'all') {
    if (filters.term === 'none') {
      result = result.filter(a => !a.activity_terms?.length)
    } else {
      result = result.filter(a =>
        a.activity_terms?.some(at => at.term_id === filters.term)
      )
    }
  }

  // Schedule status filter
  if (filters.status !== 'all') {
    result = result.filter(a => getScheduleStatus(a) === filters.status)
  }

  // Staff filter
  if (filters.staff !== 'all') {
    if (filters.staff === 'none') {
      result = result.filter(a =>
        !a.teacher_id && !a.monitor_id && !a.instructor_name && !a.mentor_name
      )
    } else {
      result = result.filter(a =>
        a.teacher_id === filters.staff || a.monitor_id === filters.staff
      )
    }
  }

  // Sort
  result = [...result].sort((a, b) => {
    // ... sort comparator based on sortField/sortDir
    // nulls-last for block and time sorts
  })

  return result
}, [activities, searchQuery, filters, sortField, sortDir])
```

### ActivityTable Changes

**Add term column** to the table, replacing the implicit single-term assumption:

| Column | Content |
|--------|---------|
| Name | (existing) |
| Staff | (existing) |
| Block | (existing) |
| Terms | Compact term badge(s) — show primary term name, +N for additional. Dash if no terms. |
| Days / Rotation | (existing) |
| Time | (existing) |
| Enrolled | (existing, moved to near-end) |

The "Location" column is removed from the default table view — it's rarely populated and takes up space. Location is still visible in the detail modal.

**Term display in table row:**

```jsx
function TermsDisplay({ activityTerms = [] }) {
  if (activityTerms.length === 0) {
    return <span className="text-base-content/40">—</span>
  }

  const primary = activityTerms.find(at => at.is_primary)
  const displayName = primary?.term?.name || activityTerms[0]?.term?.name
  const extra = activityTerms.length - 1

  return (
    <span className="text-sm">
      {displayName}
      {extra > 0 && (
        <span className="text-base-content/50 ml-1">+{extra}</span>
      )}
    </span>
  )
}
```

**Result count** in the page header updates to show filtered count vs. total:

```jsx
<p className="text-base-content/60 text-sm mt-1">
  {filteredActivities.length === activities.length
    ? `${activities.length} activities`
    : `${filteredActivities.length} of ${activities.length} activities`
  }
</p>
```

**Active filter indicators:** When any filter is active (not "all"), show a small "Clear filters" link/button near the result count so the admin can quickly reset.

### Toolbar Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [🔍 Search activities...    ]   Block [▼]  Term [▼]  Status [▼]       │
│                                  Staff [▼]  Sort: Block ↑              │
└──────────────────────────────────────────────────────────────────────────┘
```

On narrow viewports, the filters wrap to a second row. Search input takes priority width.

Styling: `flex flex-wrap gap-2 items-center mb-4`. Each filter select: `select select-bordered select-sm`. Keep it compact — the toolbar shouldn't compete with the table for attention.

---

## Part 3: Term Tag Picker in ActivityDetail

Replace the single `<select>` for `term_id` in the `DatesEdit` sub-component with a multi-select tag picker.

### View Mode (`DatesView`)

Currently shows one term name. Change to show all associated terms as small badges:

```jsx
function DatesView({ activity, terms }) {
  const activityTerms = activity?.activity_terms || []
  const parts = []

  if (activityTerms.length > 0) {
    const termNames = activityTerms
      .map(at => at.term?.name)
      .filter(Boolean)
      .join(', ')
    parts.push(termNames)
  }

  const dateParts = []
  if (activity?.start_date) dateParts.push(formatDate(activity.start_date))
  if (activity?.end_date) dateParts.push(formatDate(activity.end_date))
  if (dateParts.length) parts.push(dateParts.join(' – '))

  if (!parts.length) return null
  return <span className="text-sm text-base-content/70">{parts.join(' · ')}</span>
}
```

### Edit Mode (`DatesEdit`)

Replace the term `<select>` with a tag picker that shows current terms as removable badges and a dropdown to add more:

```jsx
function DatesEdit({ activity, terms, orgId }) {
  const activityTerms = activity?.activity_terms || []
  const addMutation = useAddActivityTerm(activity?.id, orgId)
  const removeMutation = useRemoveActivityTerm(activity?.id, orgId)

  // Terms not yet associated with this activity
  const availableTerms = terms.filter(t =>
    !activityTerms.some(at => at.term_id === t.id)
  )

  function handleAddTerm(termId) {
    const isFirst = activityTerms.length === 0
    addMutation.mutate({ termId, isPrimary: isFirst })
    // If this is the first term and the activity has no dates,
    // auto-fill dates from this term (handled via onSuccess callback
    // that checks and updates the activity's start_date/end_date)
  }

  function handleRemoveTerm(activityTermId) {
    removeMutation.mutate(activityTermId)
  }

  return (
    <div className="space-y-3">
      {/* Term tags */}
      <div>
        <label className="label-text text-xs text-base-content/50 mb-1 block">Terms</label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {activityTerms.map(at => (
            <span key={at.id} className="badge badge-sm gap-1">
              {at.term?.name}
              {at.is_primary && <span className="text-[9px] opacity-50">(primary)</span>}
              <button
                type="button"
                className="text-base-content/40 hover:text-error"
                onClick={() => handleRemoveTerm(at.id)}
              >
                ✕
              </button>
            </span>
          ))}

          {availableTerms.length > 0 && (
            <select
              className="select select-bordered select-xs"
              value=""
              onChange={(e) => {
                if (e.target.value) handleAddTerm(e.target.value)
              }}
            >
              <option value="">+ Add term</option>
              {availableTerms.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_current ? ' (current)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Dates — unchanged */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">Start Date</label>
          <input type="date" className="input input-bordered input-sm w-full" {...register('start_date')} />
        </div>
        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">End Date</label>
          <input type="date" className="input input-bordered input-sm w-full" {...register('end_date')} />
        </div>
      </div>
    </div>
  )
}
```

**Date auto-fill on first term:** When `handleAddTerm` is called and `activityTerms.length === 0` (this is the first term being added), the `onSuccess` callback should:

1. Look up the term's `start_date` and `end_date`
2. Check if the activity's current `start_date` and `end_date` are both blank
3. If so, fire an activity update mutation to fill them in
4. Show a brief toast or inline note: "Dates filled from [term name]"

This replaces the old `useEffect` on `watchedTermId`.

**Note on edit mode flow:** The term picker operates via its own mutations (add/remove term associations), independent of the main activity form's save button. This means term changes are saved immediately on click, while other form fields require the save button. This is a known inconsistency — if the admin adds a term and then cancels editing, the term association persists while other field changes revert. Acceptable for v1 (solo admin, small scale). A future improvement (tracked in GitHub Issues) would batch term changes as local state and commit them alongside the form save, so Cancel truly cancels everything. For now, the term picker only appears in edit mode to keep the surface area contained.

### Prop Threading

`DatesEdit` needs access to `activity` (for current terms), `terms` (for the picker), and `orgId` (for mutation invalidation). The `activity` object must include the `activity_terms` join data from `getActivities`. The `register` function from React Hook Form is still needed for the date inputs.

`ActivityDetail` already receives `activity` and `terms` as props. Add `orgId` as a prop (it's available in `ActivityManagement` where `ActivityDetail` is rendered via the modal).

---

## Part 4: Duration Field Semantics

No schema change needed. This is a display/form behavior change only.

### In `ActivityDetail` (edit mode, `SchedulingEdit`)

When the activity has both `default_start_time` and `default_end_time`, the duration field behavior changes:

- **Label:** "Planned Duration (min)" → changes to "Duration" and shows the computed value as read-only text (not an input)
- **Computed display:** `((endHour * 60 + endMin) - (startHour * 60 + startMin))` + " min"
- **The `duration_minutes` input is hidden** when times are present

When the activity does NOT have start/end times (unplaced activity):

- **Label:** "Planned Duration (min)"
- **Input:** editable number input (current behavior)
- **Purpose note:** small muted text below: "How long this activity needs when scheduled"

### In `ActivityDetail` (view mode, `SchedulingView`)

When times are present, duration display is derived from times (already implicit in current code — the view shows the time range). No change needed.

When times are NOT present but `duration_minutes` is set, show it: e.g., "90 min (planned)".

### In `onFormSubmit`

Only include `duration_minutes` in the submit payload if the activity does NOT have start/end times. If times are present, send `duration_minutes: null` to clear any stale value:

```js
// Duration: only persist for unplaced activities
duration_minutes: (formValues.default_start_time && formValues.default_end_time)
  ? null
  : (formValues.duration_minutes !== '' ? parseInt(formValues.duration_minutes, 10) : null),
```

---

## Implementation Order

1. **API + hooks** (`activityTerms.js`, `useActivityTerms.js`, modified `getActivities`) — unblocks everything else
2. **ActivityDetail term picker** — replaces broken `term_id` form field, makes the app functional again
3. **ActivityToolbar + filter/sort logic** — the main feature of this spec
4. **ActivityTable updates** — term column, remove location column, result count
5. **Duration field semantics** — small form behavior change, can be done alongside or after

Steps 1–2 are required to make the app work again after the migration. Steps 3–5 are the page overhaul features.

---

## Files Changed

| File | Change |
|------|--------|
| `src/api/activities.js` | Update `getActivities` select to join `activity_terms`, remove `termId` filter from query (move to client-side) |
| `src/api/activityTerms.js` | **NEW** — CRUD for term associations |
| `src/hooks/useActivityTerms.js` | **NEW** — React Query hooks for term associations |
| `src/components/activities/ActivityDetail.jsx` | Replace term `<select>` with tag picker, remove `term_id` from form values/submit, update duration field behavior, add `orgId` prop |
| `src/components/activities/ActivityToolbar.jsx` | **NEW** — search, filters, sort controls |
| `src/components/activities/ActivityTable.jsx` | Add `TermsDisplay` column, remove Location column, accept sort props |
| `src/pages/admin/ActivityManagement.jsx` | Add filter/sort state, `filteredActivities` memo, wire toolbar, pass `orgId` to detail modal |