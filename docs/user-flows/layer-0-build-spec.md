# Layer 0 Build Spec — Schema Integration & Predicate/Form/API Updates

**Design doc:** `docs/user-flows/admin-calendar-redesign-design-doc.md`
**Status:** Ready to build
**Depends on:** Nothing (this is the foundation layer)
**Unlocks:** Layer 1 (calendar view UI)

---

## What This Layer Delivers

- Migrations applied: `calendars` table live, `calendar_id` / `recurrence_interval` / `recurrence_anchor_date` on activities
- `activityMeetsToday` handles every-other-week schedules
- `getActivities` returns calendar color/name data for event cards
- Full CRUD API + TanStack Query hooks for calendars
- `ActivityDetail` form exposes all three new fields
- Schema docs updated

---

## 1. Apply Migrations

Apply in order — second migration depends on first being applied.

**Step 1:** `supabase/migrations/20260328000000_calendars.sql`
- Creates `calendars` table (`id`, `organization_id`, `name`, `color` default `#6366f1`, `owner_id` nullable FK to `user_profiles`, `description`, `is_active`, timestamps)
- Adds `calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL` to `activities`
- RLS: all org users can SELECT; admins can INSERT/UPDATE/DELETE

**Step 2:** `supabase/migrations/20260328000001_activity_recurrence_interval.sql`
- Adds `recurrence_interval INTEGER DEFAULT 1 CHECK (recurrence_interval >= 1)` to `activities`
- Adds `recurrence_anchor_date DATE` (nullable) to `activities`

Both columns are backward compatible — existing rows get `calendar_id = NULL`, `recurrence_interval = 1`.

---

## 2. Update `activityMeetsToday` — Recurrence Branch

**File:** `src/lib/scheduleUtils.js`
**Function:** `activityMeetsToday(activity, date, schoolDay)`

**Where to insert:** After the `days_of_week` check (currently the last check before `return true`). New code goes between the `days_of_week` block and the final `return true`.

**Logic:**

```javascript
// Recurrence interval (every-other-week, every-third-week, etc.)
if (activity.recurrence_interval > 1 && activity.recurrence_anchor_date) {
  // Compute how many whole weeks have passed since the anchor date
  const anchor = new Date(activity.recurrence_anchor_date + 'T00:00:00')
  const target = new Date(formatDateISO(date) + 'T00:00:00')
  const msPerDay = 24 * 60 * 60 * 1000
  const daysDiff = Math.round((target - anchor) / msPerDay)
  const weeksSinceAnchor = Math.floor(daysDiff / 7)

  // Dates before the anchor are always off-weeks
  if (weeksSinceAnchor < 0) return false

  // Only return true for weeks that are multiples of the interval
  if (weeksSinceAnchor % activity.recurrence_interval !== 0) return false
}
```

**Notes:**
- The file already has `formatDateISO` — use it to get consistent ISO strings. Don't import date-fns.
- The `new Date(str + 'T00:00:00')` pattern avoids UTC-offset issues when comparing calendar dates.
- A `recurrence_anchor_date` set to any date in an "on" week works — the week boundary logic is based on whole-week counts from the anchor, not the specific weekday.

**Also update:** `docs/business-logic/01-schedule-and-calendar.md` — add this as step 7 in the `activityMeetsToday` algorithm description (after the days_of_week check).

---

## 3. `couldMeetOnSameDay` — Known Limitation, No Code Change

**File:** `src/lib/enrollmentValidation.js`

No code change required for Layer 0. The existing function produces false positives (treats every-other-week activities as conflicting every week), which is the safe direction — it may over-block enrollments in edge cases but won't allow real conflicts through.

**Document in code:** Add a comment above `couldMeetOnSameDay`:

```javascript
// NOTE: Does not account for recurrence_interval — two activities with different anchor
// weeks will still be flagged as conflicting if they share a block and day-of-week.
// This is intentionally conservative (false positives are safe). Layer 2 will refine this.
```

---

## 4. New `src/api/calendars.js`

New file. Follow the exact pattern of `src/api/activities.js` — use the shared Supabase client, throw on error, return data.

```javascript
import { supabase } from '@/api/supabase'

export async function getCalendars(organizationId) {
  const { data, error } = await supabase
    .from('calendars')
    .select(`
      *,
      owner:user_profiles!owner_id(id, first_name, last_name)
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data
}

export async function createCalendar(calendar) {
  const { data, error } = await supabase
    .from('calendars')
    .insert(calendar)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCalendar(id, updates) {
  const { data, error } = await supabase
    .from('calendars')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCalendar(id) {
  // Hard delete — cascade sets activities.calendar_id = NULL (per migration ON DELETE SET NULL)
  const { error } = await supabase
    .from('calendars')
    .delete()
    .eq('id', id)
  if (error) throw error
}
```

---

## 5. New `src/hooks/useCalendars.js`

New file. Follow the pattern of `src/hooks/useActivities.js` exactly — TanStack Query v5 with `useQuery` and `useMutation`.

```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCalendars, createCalendar, updateCalendar, deleteCalendar } from '@/api/calendars'

export function useCalendars(orgId) {
  return useQuery({
    queryKey: ['calendars', orgId],
    queryFn: () => getCalendars(orgId),
    enabled: !!orgId,
  })
}

export function useCreateCalendar(orgId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (calendar) => createCalendar({ ...calendar, organization_id: orgId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendars', orgId] }),
  })
}

export function useUpdateCalendar(orgId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }) => updateCalendar(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendars', orgId] }),
  })
}

export function useDeleteCalendar(orgId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteCalendar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars', orgId] })
      // Activities that referenced this calendar now have calendar_id = NULL.
      // Invalidate activities so the UI reflects the unassigned state.
      queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
    },
  })
}
```

---

## 6. Update `getActivities` — Add Calendar Join

**File:** `src/api/activities.js`
**Function:** `getActivities`

**Current `.select()` string:**
```javascript
`*,
  teacher:user_profiles!teacher_id(first_name, last_name),
  monitor:user_profiles!monitor_id(first_name, last_name),
  activity_terms(id, term_id, is_primary, term:academic_terms(id, name, start_date, end_date))`
```

**Updated `.select()` string** — add calendar join:
```javascript
`*,
  teacher:user_profiles!teacher_id(first_name, last_name),
  monitor:user_profiles!monitor_id(first_name, last_name),
  activity_terms(id, term_id, is_primary, term:academic_terms(id, name, start_date, end_date)),
  calendar:calendars(id, name, color)`
```

This is a to-one join (nullable FK) — activities with `calendar_id = NULL` will have `calendar: null`. The existing client-side `termId` filter operates on `activity_terms` array and is unaffected.

---

## 7. `ActivityDetail.jsx` — Three New Form Fields

**File:** `src/components/activities/ActivityDetail.jsx`

### 7a. Add to `DEFAULT_VALUES`

```javascript
calendar_id: null,
recurrence_interval: 1,
recurrence_anchor_date: '',
```

### 7b. Add `calendars` prop

The component currently receives `terms` as a prop. Add `calendars` following the same pattern:

- Add `calendars = []` to the props destructuring
- Callers (ActivityDetailModal, Dashboard, wherever ActivityDetail is rendered) should pass `calendars` from `useCalendars(orgId)`

### 7c. Add `calendar_id` field — above the `SchedulingEdit` block

In the view/edit rendering for the scheduling section (around line 375), add a calendar row before the `SchedulingEdit` component:

**View mode:**
```jsx
{activity?.calendar && (
  <div className="flex items-center gap-2 text-sm">
    <span
      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
      style={{ backgroundColor: activity.calendar.color }}
    />
    <span className="text-base-content/70">{activity.calendar.name}</span>
  </div>
)}
```

**Edit mode** (add to the form section before SchedulingEdit):
```jsx
<div>
  <label className="label-text text-xs text-base-content/50 mb-1 block">Calendar</label>
  <select className="select select-bordered select-sm w-full" {...register('calendar_id')}>
    <option value="">Unassigned</option>
    {calendars.map((cal) => (
      <option key={cal.id} value={cal.id}>{cal.name}</option>
    ))}
  </select>
</div>
```

### 7d. Add recurrence fields — inside `SchedulingEdit`

Add after the closing `</div>` of the "Days / Rotation" flex row (after line 591 in current file). These fields are only relevant when days_of_week or rotation is set, so wrap with a conditional on `daysSelected || rotationSelected`:

**New props to add to `SchedulingEdit`:** `watchedRecurrenceInterval`, `register` already has it.

```jsx
{/* Recurrence interval — only shown when days or rotation is set */}
{(daysSelected || rotationSelected) && (
  <div className="flex items-center gap-3 flex-wrap">
    <div className="flex items-center gap-2">
      <label className="label-text text-xs text-base-content/50 whitespace-nowrap">
        Repeats every
      </label>
      <select
        className="select select-bordered select-sm w-20"
        {...register('recurrence_interval', { valueAsNumber: true })}
        disabled={disabled}
      >
        {[1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <span className="label-text text-xs text-base-content/50">week(s)</span>
    </div>

    {/* Anchor date — only shown when interval > 1 */}
    {watchedRecurrenceInterval > 1 && (
      <div className="flex items-center gap-2">
        <label className="label-text text-xs text-base-content/50 whitespace-nowrap">
          Starting week of
        </label>
        <input
          type="date"
          className="input input-bordered input-sm"
          {...register('recurrence_anchor_date', {
            required: watchedRecurrenceInterval > 1,
          })}
          disabled={disabled}
        />
      </div>
    )}
  </div>
)}
```

Pass `watchedRecurrenceInterval={watch('recurrence_interval')}` from the parent to `SchedulingEdit`.

### 7e. Form submission processing

In `onFormSubmit`, `recurrence_interval` is already registered with `valueAsNumber: true` so it arrives as a number. `recurrence_anchor_date` arrives as a string (ISO date) or empty string — convert empty string to `null`:

```javascript
recurrence_anchor_date: data.recurrence_anchor_date || null,
```

---

## 8. Schema Doc Updates

### Update `docs/schema/03-activities.md`

Add three rows to the columns table:

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `calendar_id` | UUID | YES | NULL | FK `calendars.id` ON DELETE SET NULL |
| `recurrence_interval` | INTEGER | NO | 1 | Weeks between occurrences; ≥ 1 |
| `recurrence_anchor_date` | DATE | YES | NULL | A date in an "on" week; required when interval > 1 |

### Create `docs/schema/07-calendars.md`

Document the `calendars` table structure:

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | UUID | NO | gen_random_uuid() | PK |
| `organization_id` | UUID | NO | — | FK `organizations.id` ON DELETE CASCADE |
| `name` | TEXT | NO | — | Unique per org |
| `color` | TEXT | NO | `#6366f1` | Hex color for UI |
| `owner_id` | UUID | YES | NULL | FK `user_profiles.id` ON DELETE SET NULL; null = org-level calendar |
| `description` | TEXT | YES | NULL | — |
| `is_active` | BOOLEAN | NO | true | Soft delete via is_active = false |
| `created_at` | TIMESTAMPTZ | NO | NOW() | — |
| `updated_at` | TIMESTAMPTZ | NO | NOW() | — |

**RLS:** All authenticated org users SELECT; admins INSERT/UPDATE/DELETE.

### Update `docs/business-logic/01-schedule-and-calendar.md`

In the `activityMeetsToday` algorithm section, add step 7 after "6. Check day of week":

> **7. Check recurrence interval (if interval > 1 and anchor date is set)**
> Compute whole weeks elapsed since `recurrence_anchor_date`. If elapsed weeks is negative (date before anchor) or not evenly divisible by `recurrence_interval`, return false.

---

## Verification

1. **Migrations:** Apply locally via `supabase db push` or Supabase dashboard. Confirm `\d calendars` shows all columns. Confirm `\d activities` shows `calendar_id`, `recurrence_interval`, `recurrence_anchor_date`.

2. **Recurrence logic:** In browser console on the dev server, import and test `activityMeetsToday` with a mock activity: `recurrence_interval: 2`, `recurrence_anchor_date: '2026-03-30'` (a Monday in an "on" week). Verify returns `true` for `2026-03-30` (week 0), `false` for `2026-04-06` (week 1), `true` for `2026-04-13` (week 2).

3. **`getActivities` join:** Open the admin dashboard in dev. In the network tab, the Supabase activities query should include `calendar` in the response shape. Log `activities[0].calendar` — should be `null` or `{ id, name, color }`.

4. **Calendar API:** Create a calendar via the Supabase dashboard (insert a row directly). Then verify `getCalendars(orgId)` returns it in the browser console.

5. **ActivityDetail form:** Open an activity in edit mode. Confirm Calendar dropdown appears, Repeats Every shows when days are selected, and Starting Week Of appears when interval > 1. Save and verify new values persist.
