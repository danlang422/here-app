# Org Settings UI — Build Spec

**Date:** March 9, 2026
**Context:** Admin interface for defining organization-level configuration: block schedule, academic terms, and rotation days. These settings drive schedule-building behavior across the app — block labels in dropdowns, time auto-fill on the activity form, term-based date auto-fill, and rotation day options. Currently, block count and rotation day names are stored in `organization.settings` but have no admin UI. Block time definitions and academic terms have schema support (`schedule_templates`, `academic_terms` tables) but are unpopulated.

**Scope:** Build Tier 1 (block schedule) and Tier 2 (academic terms) with corresponding activity form enhancements. Defer Tier 3 (multiple schedule templates) until calendar management work begins.

**Design principle:** Progressive setup. Nothing gates on anything else. An admin can define blocks without times, terms without blocks, or nothing at all — the app works with whatever's been configured and gets smarter as more is filled in.

---

## What Gets Built

### 1. Org Settings Page

New admin page at `/admin/settings` with a gear icon in the admin nav. Three sections: Block Schedule, Academic Terms, Rotation Days.

### 2. Constants / Label System Update

`getBlockLabel()` updated to support custom labels from org settings.

### 3. Default Schedule Template

Creation and update of the default `schedule_templates` row when block times are defined. The "template" abstraction is invisible to the admin — they're just defining "the schedule."

### 4. Activity Form Enhancements

Block → time auto-fill, term selector → date auto-fill, and a minor layout adjustment.

---

## 1. Org Settings Page

### Route and Navigation

- Route: `/admin/settings`
- Add to `adminNav` in `AdminLayout.jsx`: `{ to: '/admin/settings', icon: FaCog, label: 'Settings' }`
- Create `src/pages/admin/OrgSettings.jsx`
- Add route to `App.jsx`: `<Route path="settings" element={<OrgSettings />} />`

### Page Structure

Three card sections stacked vertically. Each section is independently saveable — no single "save all" button. This matches the progressive setup principle: an admin might configure blocks today and terms next week.

```
┌─────────────────────────────────────────────────────┐
│  Block Schedule                          [Save]     │
│                                                     │
│  Number of blocks: [6]  ▾                           │
│                                                     │
│  ┌───────────┬────────────┬────────────┐            │
│  │ Block     │ Start      │ End        │            │
│  ├───────────┼────────────┼────────────┤            │
│  │ Block 0   │ 07:30      │ 09:00      │            │
│  │ Block 1   │ 09:05      │ 09:50      │            │
│  │ Block 2   │ 09:55      │ 10:40      │            │
│  │ Block 3   │ 10:45      │ 11:30      │            │
│  │ Block 4   │ 12:15      │ 13:15      │            │
│  │ Block 5   │ 13:20      │ 14:20      │            │
│  └───────────┴────────────┴────────────┘            │
│  Block labels are editable inline                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Academic Terms                          [+ Add]    │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ ● Fall 2025     Aug 25, 2025 – Dec 19, 2025    ││
│  │   Spring 2026   Jan 12, 2026 – May 29, 2026    ││
│  └─────────────────────────────────────────────────┘│
│  ● = current term                                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Rotation Days                           [Save]     │
│                                                     │
│  ☑ Uses rotation schedule                           │
│                                                     │
│  Day names:  [A Day]  [B Day]  [+ Add]              │
│                                                     │
│  On cancellation:  ○ Continue  ○ Repeat             │
└─────────────────────────────────────────────────────┘
```

### Section 1: Block Schedule

**Block count selector.** Dropdown with values 1–10 (reasonable range). Changing the count adjusts the rows in the table below — adding new rows at the bottom or prompting confirmation before removing rows from the bottom.

**Block table.** One row per block. Three columns:
- **Label** — editable text input, defaults to `"Block N"`. Stored in `organization.settings.block_labels` as an array where index = block number. If the admin leaves a label blank or unchanged, the fallback `"Block N"` is used at display time.
- **Start** — time input (`HH:MM`). Stored in the default schedule template's `block_definitions` JSONB.
- **End** — time input (`HH:MM`). Stored in the same `block_definitions` JSONB.

Times are optional. An admin can set block count and labels without defining times yet. This supports the progressive setup principle — block count alone is enough for the block dropdown in the activity form.

**Validation:**
- Block count must be ≥ 1
- If times are provided for a block, both start and end are required (no half-filled rows)
- End must be after start within each block
- No overlapping time ranges between blocks (warning, not hard block — edge cases like passing periods may create intentional overlaps)
- Blocks should be in chronological order (informational sort hint, not enforced)

**Save behavior:**
- Updates `organization.settings.block_count` and `organization.settings.block_labels` via `updateOrgSettings()`
- Creates or updates the default `schedule_templates` row (`is_default = true`) with the `block_definitions` JSONB
- Invalidates `['org-settings', orgId]` and a new `['schedule-template-default', orgId]` query
- Toast confirmation on success

**Reducing block count:** If the admin reduces the count, show a confirmation: "Reducing from 6 to 4 blocks will remove Block 4 and Block 5. Activities assigned to those blocks will not be reassigned. Continue?" This is a soft warning — the operation proceeds if confirmed, and affected activities simply have a block number that no longer maps to a defined block (they'll appear as orphaned in the UI, which is useful feedback).

### Section 2: Academic Terms

**Term list.** Shows all terms for the org, ordered by `start_date`. Each row displays: name, date range (formatted), and a current-term indicator (filled dot or badge).

**Add term.** A `[+ Add]` button in the section header opens an inline form (or a small modal) with:
- **Name** — text input, e.g. "Fall 2025", "Spring 2026", "Q1 2025-26". No constraints on naming convention.
- **Start date** — date picker
- **End date** — date picker
- **Set as current** — checkbox, defaults to false

**Edit term.** Click a term row to expand it into edit mode (inline, same fields). Save/cancel buttons.

**Delete term.** Available from the edit state. Confirmation required. If the term has activities linked via `term_id`, warn: "N activities reference this term. They will keep their start/end dates but lose their term association." Requires a migration to alter the FK to `ON DELETE SET NULL` (see Migration section).

**Mark as current.** Clicking "set as current" on a term should unset the previously current term (within a transaction). The unique partial index `idx_academic_terms_one_current` enforces at-most-one, so the mutation needs to: `UPDATE SET is_current = false WHERE is_current = true AND organization_id = X`, then `UPDATE SET is_current = true WHERE id = Y`.

**Validation:**
- Name required
- End date must be after start date (matches existing CHECK constraint)
- Warn (not block) if date ranges overlap with existing terms

### Section 3: Rotation Days

**Toggle.** Checkbox for `uses_rotation_schedule`. When off, the day name inputs and mode selector are hidden/disabled.

**Day names.** One text input per rotation day name. Default placeholder text: `"A Day"`, `"B Day"`. Stored in `organization.settings.rotation_day_names` (already exists as an array). An `[+ Add]` button allows adding more names for orgs with more than two rotation days (e.g., A/B/C). A remove button (X) on each name beyond the minimum of 2.

**Helper text** below the day name inputs: "Rotation day names identify alternating schedule days. Common examples: A Day / B Day, Gold / Maroon."

**Cancellation mode.** Radio buttons for `rotation_mode`:
- **Continue** — "Skip cancelled days in the rotation (Snow day on A → next day is B)"
- **Repeat** — "Repeat cancelled days (Snow day on A → next day is also A)"

Inline description text below each radio option makes the behavior clear without separate help docs.

**Save behavior:** Updates `organization.settings` with `uses_rotation_schedule`, `rotation_day_names`, and `rotation_mode` via `updateOrgSettings()`.

---

## 2. Constants / Label System Update

### `src/lib/constants.js`

Update `getBlockLabel()` to accept an optional labels array:

```js
// Before:
export function getBlockLabel(blockNum) {
  return `Block ${blockNum}`
}

// After:
export function getBlockLabel(blockNum, blockLabels) {
  if (blockLabels && blockLabels[blockNum]) {
    return blockLabels[blockNum]
  }
  return `Block ${blockNum}`
}

export function getBlockLabels(blockCount, blockLabels) {
  const blocks = getBlocks(blockCount)
  return Object.fromEntries(blocks.map(b => [b, getBlockLabel(b, blockLabels)]))
}
```

### Consuming custom labels

Every place that calls `getBlockLabel()` or `getBlockLabels()` currently passes only `blockNum` or `blockCount`. After this change, they also pass `orgSettings.block_labels`. The call sites are:
- `ActivityDetail.jsx` — already has `orgSettings` as a prop
- `AgendaGrid.jsx` — receives `blockCount` as a prop; will also need `blockLabels`
- `EnrollmentPanel.jsx` — uses `useOrgSettings`; already has access
- Any other component rendering block labels

The migration is safe: `blockLabels` is optional, and the fallback is the existing `"Block N"` format.

---

## 3. Default Schedule Template

### New API functions: `src/api/scheduleTemplates.js`

```js
import { supabase } from './supabase'

export async function getDefaultTemplate(orgId) {
  const { data, error } = await supabase
    .from('schedule_templates')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_default', true)
    .maybeSingle()
  if (error) throw error
  return data // null if no default template exists yet
}

export async function upsertDefaultTemplate(orgId, blockDefinitions) {
  // Check for existing default
  const existing = await getDefaultTemplate(orgId)
  
  if (existing) {
    const { data, error } = await supabase
      .from('schedule_templates')
      .update({
        block_definitions: blockDefinitions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('schedule_templates')
      .insert({
        organization_id: orgId,
        name: 'Regular',
        is_default: true,
        block_definitions: blockDefinitions,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }
}
```

### New hook: `src/hooks/useScheduleTemplate.js`

```js
import { useQuery } from '@tanstack/react-query'
import { getDefaultTemplate } from '@/api/scheduleTemplates'

export function useDefaultScheduleTemplate(orgId) {
  return useQuery({
    queryKey: ['schedule-template-default', orgId],
    queryFn: () => getDefaultTemplate(orgId),
    enabled: !!orgId,
  })
}
```

### New hook: `src/hooks/useTerms.js`

```js
import { useQuery } from '@tanstack/react-query'
import { getTerms } from '@/api/terms'

export function useTerms(orgId) {
  return useQuery({
    queryKey: ['terms', orgId],
    queryFn: () => getTerms(orgId),
    enabled: !!orgId,
  })
}
```

### New API: `src/api/terms.js`

CRUD functions for `academic_terms`: `getTerms(orgId)`, `createTerm(orgId, data)`, `updateTerm(termId, data)`, `deleteTerm(termId)`, `setCurrentTerm(orgId, termId)`. The `setCurrentTerm` function handles the two-step update (unset old, set new) in sequence.

---

## 4. Activity Form Enhancements

### Layout Adjustment

Three changes to `ActivityDetail.jsx` in edit mode:

**a) Tighten the properties tray.** The behavior flag icon row currently stretches wider than necessary. Constrain with `w-fit` or similar — the tray should hug its content rather than filling the card width. This frees horizontal space in the layout.

**b) Move Location up.** Currently location is in the dates row (3-column grid: Start Date | End Date | Location). Move it up to sit below the properties tray, before the staff rows. This gives it a full-width text input and opens space in the dates row for the term selector.

New visual order in edit mode:
1. Activity name + action icons
2. Properties tray (behavior flags) — tightened
3. Location — full width input
4. Staff rows (Teacher, + Staff)
5. Block / Start / End / Duration row
6. Days / Rotation row
7. **Term** / Start Date / End Date row (new layout — see below)
8. + Description

**c) Add term selector to dates row.** The dates section becomes a 3-column row: Term | Start Date | End Date. The term selector is first because selecting it auto-fills the dates to the right.

```
  Term               Start Date          End Date
  [Fall 2025    ▾]   [08/25/2025]        [12/19/2025]
```

### Block → Time Auto-Fill

When the admin selects a block from the block dropdown and the default schedule template has time definitions for that block:
- If `default_start_time` and `default_end_time` are both currently empty, auto-fill them from the template's `block_definitions`.
- If either time field already has a value, do NOT overwrite — the admin may have intentionally set custom times (e.g., an external course that doesn't match block boundaries).
- Also auto-fill `duration_minutes` if it's empty — calculated from the template times.

This requires `ActivityDetail` to have access to the default template's `block_definitions`. Pass as a prop from the parent (`ActivityDetailModal` or future `FloatingPanel`), sourced from `useDefaultScheduleTemplate`.

Implementation: Add a `useEffect` or watcher on the block field. When block value changes and template data is available, check if time fields are empty and fill if so.

### Term → Date Auto-Fill

When the admin selects a term from the term dropdown:
- If `start_date` and `end_date` are both currently empty, auto-fill from the selected term's dates.
- If either date already has a value, do NOT overwrite.

The term dropdown shows all terms for the org (from `useTerms`), with the current term visually indicated. Selecting a term sets a `term_id` value on the form. On save, `term_id` is included in the submitted data.

If the admin clears the term selector, `term_id` is set to null but dates are left as-is (don't clear them — the admin may want the dates without the term association).

---

## Data Flow Summary

### Organization Settings (`organization.settings` JSONB)

```json
{
  "timezone": "America/Chicago",
  "block_count": 6,
  "block_labels": ["Block 0", "Block 1", "Block 2", "Block 3", "Block 4", "Block 5"],
  "uses_rotation_schedule": true,
  "rotation_day_names": ["A", "B"],
  "rotation_mode": "continue"
}
```

`block_labels` is the new addition. If null/missing, all consumers fall back to `"Block N"`. The array is indexed by block number: `block_labels[0]` = label for Block 0.

### Default Schedule Template (`schedule_templates` row)

```json
{
  "name": "Regular",
  "is_default": true,
  "block_definitions": [
    { "block": 0, "start_time": "07:30", "end_time": "09:00" },
    { "block": 1, "start_time": "09:05", "end_time": "09:50" },
    { "block": 2, "start_time": "09:55", "end_time": "10:40" },
    { "block": 3, "start_time": "10:45", "end_time": "11:30" },
    { "block": 4, "start_time": "12:15", "end_time": "13:15" },
    { "block": 5, "start_time": "13:20", "end_time": "14:20" }
  ]
}
```

### Academic Terms (`academic_terms` rows)

Existing table, no schema changes needed (except the FK cascade migration).

---

## Migration

### `20260310000000` — Term FK cascade

```sql
ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS activities_term_id_fkey,
  ADD CONSTRAINT activities_term_id_fkey
    FOREIGN KEY (term_id) REFERENCES academic_terms(id)
    ON DELETE SET NULL;
```

This is the only migration needed. `block_labels` lives in the existing JSONB settings column, and `schedule_templates` / `academic_terms` tables already exist.

---

## New Files

| File | Purpose |
|------|--------|
| `src/pages/admin/OrgSettings.jsx` | Settings page with three sections |
| `src/api/scheduleTemplates.js` | Default template CRUD |
| `src/api/terms.js` | Academic terms CRUD |
| `src/hooks/useScheduleTemplate.js` | TanStack Query hook for default template |
| `src/hooks/useTerms.js` | TanStack Query hook for terms |
| `supabase/migrations/20260310000000_term_fk_cascade.sql` | FK alteration |

## Modified Files

| File | Changes |
|------|--------|
| `src/lib/constants.js` | `getBlockLabel()` and `getBlockLabels()` accept optional `blockLabels` array |
| `src/components/layout/AdminLayout.jsx` | Add Settings nav item |
| `src/App.jsx` | Add `/admin/settings` route |
| `src/components/activities/ActivityDetail.jsx` | Layout adjustment (tighten properties tray, move location up, add term selector to dates row), block→time auto-fill, term→date auto-fill |
| `src/components/activities/ActivityDetailModal.jsx` | Pass `defaultTemplate` and `terms` data to `ActivityDetail` |
| `src/components/agenda/AgendaGrid.jsx` | Accept and use `blockLabels` prop |
| Any other component using `getBlockLabel()` | Pass `blockLabels` from org settings |

---

## Build Order

1. **Migration** — Term FK cascade. Quick, unblocks term deletion.
2. **API + hooks** — `scheduleTemplates.js`, `terms.js`, `useScheduleTemplate.js`, `useTerms.js`. Foundation for everything else.
3. **Constants update** — `getBlockLabel()` signature change + update all call sites. Low risk, high reach.
4. **Org Settings page — Block Schedule section.** The most complex section. Block count, labels, times, save to settings + default template.
5. **Org Settings page — Academic Terms section.** Term CRUD, current term toggle.
6. **Org Settings page — Rotation Days section.** Simplest section — mostly wiring existing settings values to form controls.
7. **Route + nav wiring.** Add the page to the admin nav and router.
8. **Activity form enhancements.** Layout adjustment, block→time auto-fill, term selector + date auto-fill. This is last because it depends on the settings data existing.

Steps 1–3 can be done in a single session. Steps 4–6 are the bulk of the work. Steps 7–8 tie it together.

---

## What's Deferred

- **Multiple schedule templates** (early dismissal, late start, etc.) — deferred until calendar management. The default template infrastructure built here will support it when the time comes.
- **Schedule template as floating panel on dashboard** — may revisit when dashboard composition work begins.
- **school_days generation** — depends on terms + templates + calendar management. Not part of this build.
- **Block overlay on agenda view** — the agenda currently positions cards by activity times, not block boundaries. Block time data from the default template could power a block overlay in the future, but that's a separate enhancement.
- **Validation of existing activities against changed settings** — if an admin changes block count from 6 to 4, activities assigned to blocks 4–5 are orphaned but not modified. A future "audit" or "orphaned activities" view could surface these.
