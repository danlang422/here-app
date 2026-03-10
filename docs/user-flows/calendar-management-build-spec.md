# Calendar Management — Build Spec

**Date:** March 9, 2026
**Context:** Admin interface for managing the school calendar: generating school days from terms, marking exceptions (holidays, cancellations), and calculating rotation days. Builds on the org settings work (block schedule, terms, rotation day names) completed in the previous session. The schema infrastructure (`school_days`, `schedule_templates`, `academic_terms`) and API functions (`calendar.js`) already exist — this spec adds the UI and generation logic.

**Scope:** Calendar month grid UI, school day auto-generation on term save, exception management (single-day and date-range), and an updated rotation algorithm that uses per-reason advancement instead of a global toggle.

**Design principle:** The calendar exists independently of terms. It's always navigable, always shows the current month by default, and becomes populated with school day data as terms are defined. Exceptions can be added even outside of term boundaries (informational annotation). The calendar is a visual tool for understanding the school year at a glance.

---

## What Gets Built

### 1. Calendar Month Grid UI

Compact month grid on the Org Settings page showing school days, rotation labels, and exceptions with color coding.

### 2. School Day Generation

Auto-generate `school_days` rows when a term is created or edited. Weekdays within the term range become school days with calculated rotation labels.

### 3. Exception Management

Single-day click to toggle exceptions, plus a date-range tool for bulk marking (spring break, winter break, etc.). Override reasons (`planned_holiday`, `weather`, `emergency`) with optional notes.

### 4. Rotation Algorithm Update

Replace the global `rotation_mode` toggle with per-reason advancement logic. Planned holidays don't advance the rotation; unscheduled cancellations (weather/emergency) do.

### 5. Settings Page Cleanup

Remove "On cancellation" radio buttons from Rotation Days section. Deprecate `rotation_mode` in org settings.

---

## 1. Calendar Month Grid UI

### Placement

The calendar sits as a new section on the Org Settings page (`/admin/settings`), positioned between Academic Terms and Rotation Days. It spans the same card width as the other sections.

The calendar is always visible and navigable, regardless of whether terms or school days exist. If no terms are defined, it's an empty calendar showing month/day structure only. As terms are created and school days generated, the calendar populates.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  School Calendar            [◀ Mar 2026 ▶]  [Mark Range]   │
│                                                             │
│  Mon    Tue    Wed    Thu    Fri    (Sat/Sun hidden)        │
│  ┌──────┬──────┬──────┬──────┬──────┐                      │
│  │      │      │      │      │      │                      │
│  │  2   │  3   │  4   │  5   │  6   │                      │
│  │  A   │  B   │  A   │  B   │  A   │                      │
│  ├──────┼──────┼──────┼──────┼──────┤                      │
│  │      │      │      │      │      │                      │
│  │  9   │  10  │  11  │  12  │  13  │                      │
│  │  B   │  A   │  B   │  A   │  B   │                      │
│  ├──────┼──────┼──────┼──────┼──────┤                      │
│  │░░░░░░│░░░░░░│░░░░░░│░░░░░░│░░░░░░│                      │
│  │░ 16 ░│░ 17 ░│░ 18 ░│░ 19 ░│░ 20 ░│  ← Spring break    │
│  │░░░░░░│░░░░░░│░░░░░░│░░░░░░│░░░░░░│    (planned_holiday) │
│  ├──────┼──────┼──────┼──────┼──────┤                      │
│  │      │      │      │      │      │                      │
│  │  23  │  24  │  25  │  26  │  27  │                      │
│  │  A   │  B   │  A   │  B   │  A   │  ← rotation resumed │
│  ├──────┼──────┼──────┼──────┼──────┤    (no advancement   │
│  │      │      │      │      │      │     over break)      │
│  │  30  │  31  │      │      │      │                      │
│  │  B   │  A   │      │      │      │                      │
│  └──────┴──────┴──────┴──────┴──────┘                      │
│                                                             │
│  Legend: ■ School day  ░ Planned holiday  ▓ Cancellation    │
└─────────────────────────────────────────────────────────────┘
```

### Grid behavior

- **Weekdays only.** Five columns (Mon–Fri). Weekends are not shown — they're not school days and showing them wastes space.
- **Month navigation.** Left/right arrows to move between months. Header shows "Mar 2026" (or similar). Clicking the month name could jump to the current month (nice-to-have).
- **Day cells show:**
  - Date number
  - Rotation day label (e.g., "A", "B") if the org uses rotation and the day is a school day
  - Background color indicating status (see Color Coding below)
- **Days outside term boundaries** appear but with no school day data — neutral/empty background. The admin can still click them to add informational exceptions (between-term breaks, etc.).
- **Today indicator.** Subtle border or highlight on the current date for orientation.

### Color coding

| Status | Background | Text color |
|--------|-----------|------------|
| Regular school day | White/default | Normal |
| Planned holiday (`planned_holiday`) | Light gray or muted tone | Dimmed |
| Weather cancellation (`weather`) | Light amber/orange | Normal |
| Emergency cancellation (`emergency`) | Light red/pink | Normal |
| Outside term range (no `school_days` row) | No background (blank cell) | Light gray date number |
| Today | Subtle blue border or ring | Normal |

Rotation day labels are colored to match the rotation day name. This is displayed using a small badge or the letter itself in a distinct color. For MVP, use two fixed colors (e.g., blue for the first rotation day name, green for the second). Future enhancement: customizable rotation day colors in org settings.

### Click interaction

**Single click on a school day:** Opens a small popover or inline panel with:
- Date (e.g., "Monday, March 9, 2026")
- Current status (School day / Holiday / Cancelled)
- Toggle: "Mark as day off" (if currently a school day) or "Restore school day" (if currently an exception)
- If marking as day off: reason selector (Planned holiday, Weather, Emergency)
- Optional notes field
- Save / Cancel buttons

**Single click on a non-school day (exception):** Same popover, showing current reason and notes, with option to restore or change the reason.

**Single click on a day outside term range:** Same popover, but shows "Outside term range" status. Allows creating an informational `school_days` row with `is_school_day = false` and a reason/note (e.g., "Winter Break"). This doesn't affect rotation calculations — it's purely for calendar annotation.

### Mark Range tool

A button in the calendar header ("Mark Range" or a date-range icon) that activates a range selection mode:

1. Admin clicks "Mark Range"
2. Admin clicks a start date on the calendar
3. Admin clicks an end date (the range highlights as they hover)
4. A popover appears asking for: reason (Planned holiday / Weather / Emergency) and optional note (e.g., "Spring Break")
5. On confirm, all **weekdays** in the range are marked as `is_school_day = false` with the selected reason and note

Alternative UX (simpler to implement): instead of click-to-select on the grid, the "Mark Range" button opens a small form with start date picker, end date picker, reason, and note. Less visual but avoids complex click-state management. Either approach works — implementer's choice based on complexity tolerance.

For the range tool, if a day in the range already has an override (e.g., it was individually marked as weather cancellation), the bulk operation overwrites it with the new reason. This matches the intent — if you're marking a whole week as spring break, any previous per-day overrides in that week should be replaced.

---

## 2. School Day Generation

### Trigger: Term save

When a term is created or updated via the Academic Terms section on the Org Settings page, school days are auto-generated for the term's date range.

**On term creation:**
1. Generate one `school_days` row per weekday (Mon–Fri) between `start_date` and `end_date` inclusive
2. All rows: `is_school_day = true`, `organization_id` from context, `schedule_template_id = null` (uses default template implicitly)
3. Calculate `rotation_day` for each day using the updated per-reason algorithm (see section 4). Since this is a fresh generation, all days are school days, so the rotation simply alternates from the term start: day 0 = rotation_names[0], day 1 = rotation_names[1], etc.
4. Use `bulkUpsertSchoolDays()` from `calendar.js` (already exists)
5. Invalidate the school days query cache

**On term date edit — end date pushed out:**
- Generate new rows for weekdays in the extended range only
- Existing rows (and their overrides) are untouched
- Rotation for new days continues from where the existing sequence left off (count existing school days + weather/emergency cancellations to determine the rotation index for the first new day)

**On term date edit — end date pulled in:**
- Delete `school_days` rows with dates beyond the new end date
- Existing rows within the new range are untouched
- Confirmation: "Shortening the term will remove school days after [new end date]. Any exceptions marked on those days will be lost. Continue?"

**On term date edit — start date changed:**
- Recalculate rotation days for all days in the term
- Preserve all existing overrides: days marked as `is_school_day = false` keep their status, reason, and notes
- Days with explicit `rotation_day` overrides keep their override (the recalculation only affects days without manual overrides)
- If start date moved earlier: generate new rows for the added days at the beginning
- If start date moved later: delete rows before the new start date (with same confirmation pattern as end date pull-in)

**On term deletion:**
- Remove all `school_days` rows within that term's date range (school_days don't FK to terms, so this is an app-layer cleanup)
- Confirmation: "Deleting this term will also remove all school day data (including marked holidays and cancellations) for [date range]. Continue?"

### Generation function

New utility in `src/lib/business-logic/schoolDayGeneration.js`:

```js
function generateSchoolDays(orgId, startDate, endDate, orgSettings, existingSchoolDays = []) {
  const weekdays = getWeekdaysInRange(startDate, endDate)
  const existingByDate = new Map(existingSchoolDays.map(d => [d.date, d]))
  const rotationNames = orgSettings?.rotation_day_names || ['A', 'B']
  const usesRotation = orgSettings?.uses_rotation_schedule ?? false

  const newDays = []
  let rotationIndex = 0  // Adjusted if existingSchoolDays exist before this range

  for (const date of weekdays) {
    if (existingByDate.has(date)) {
      // Day already exists — count it for rotation but don't overwrite
      const existing = existingByDate.get(date)
      if (existing.is_school_day || isUnscheduledCancellation(existing)) {
        rotationIndex++
      }
      continue
    }

    const rotationDay = usesRotation
      ? rotationNames[rotationIndex % rotationNames.length]
      : null

    newDays.push({
      organization_id: orgId,
      date,
      is_school_day: true,
      rotation_day: rotationDay,
    })

    rotationIndex++
  }

  return newDays
}

function isUnscheduledCancellation(schoolDay) {
  return !schoolDay.is_school_day &&
    (schoolDay.override_reason === 'weather' || schoolDay.override_reason === 'emergency')
}
```

This is illustrative — the exact implementation may vary. The key points are: skip existing days, count correctly for rotation, and only generate missing rows.

---

## 3. Exception Management

### Single-day exceptions

Handled via the click-popover interaction on the calendar grid (described in section 1). On save:

1. Update the `school_days` row via `upsertSchoolDay()` (already exists in `calendar.js`)
2. Set `is_school_day = false`, `override_reason`, and `notes`
3. Recalculate rotation days for all subsequent days in the term (since adding an exception can shift the rotation depending on the reason type)
4. Invalidate school days query cache

### Restoring a school day

Same popover, "Restore school day" action:
1. Set `is_school_day = true`, clear `override_reason` and `notes`
2. Recalculate subsequent rotation days
3. Invalidate cache

### Date-range exceptions

Using the Mark Range tool (described in section 1). On confirm:

1. For each weekday in the range, upsert a `school_days` row with `is_school_day = false`, the selected `override_reason`, and the note
2. Use `bulkUpsertSchoolDays()` for efficiency
3. Recalculate rotation days for all days after the range start
4. Invalidate cache

### Rotation recalculation on exception changes

Whenever an exception is added, removed, or changed, the rotation days for subsequent dates need recalculation. This is because adding a `planned_holiday` doesn't advance the rotation (so everything after shifts back by one), while adding a `weather` cancellation does advance it (no shift).

**Implementation:** After any exception mutation, fetch all `school_days` for the current term, recalculate rotation for each day using the new algorithm, and batch-update only the rows whose `rotation_day` changed. Days with explicit rotation overrides are skipped.

**Performance note:** At City View scale (roughly 180 school days per year), recalculating the full term is negligible. For larger deployments, this could be optimized to only recalculate from the changed date forward, but that's premature optimization for now.

---

## 4. Rotation Algorithm Update

### New algorithm

Replace the global `rotation_mode` check with per-reason logic:

```js
export function calculateRotationDay(orgSettings, schoolDaysInRange, targetSchoolDay) {
  if (!orgSettings?.uses_rotation_schedule) return null

  // Check for an explicit override on the target date
  if (targetSchoolDay?.rotation_day != null) {
    return targetSchoolDay.rotation_day
  }

  const rotationNames = orgSettings.rotation_day_names || ['A', 'B']

  // Count days that advance the rotation:
  // - School days (is_school_day = true) always count
  // - Unscheduled cancellations (weather/emergency) also count (rotation advances)
  // - Planned holidays do NOT count (rotation pauses)
  const countableDays = schoolDaysInRange.filter(d =>
    d.is_school_day ||
    d.override_reason === 'weather' ||
    d.override_reason === 'emergency'
  )

  const index = countableDays.length % rotationNames.length
  return rotationNames[index]
}
```

### What changes from the current code

The current `rotation.js` reads `orgSettings.rotation_mode` and branches on `'continue'` vs `'repeat'`. The new version ignores `rotation_mode` entirely and instead inspects `override_reason` on each non-school day. The function signature stays the same — only the internal logic changes.

### Deprecating `rotation_mode`

- Stop reading `rotation_mode` from org settings in all application code
- Remove the "On cancellation" radio buttons from the Rotation Days section of the Org Settings page
- Leave `rotation_mode` in the JSONB data if it's already there (no migration to remove it) — it's just ignored
- Update `docs/business-logic/01-schedule-and-calendar.md` to reflect the new algorithm
- Update `docs/schema/01-core-tables.md` settings schema to note `rotation_mode` is deprecated

---

## 5. Settings Page Changes

### Academic Terms section — generation integration

After a term is saved (create or update), trigger school day generation:

**Create flow:**
1. Admin fills in term name, start date, end date, sets current if desired
2. Admin clicks Save
3. Term is created via `createTerm()`
4. School days are auto-generated for the term range
5. Toast: "Term created. School days generated for [start] – [end]."
6. Calendar section (if visible) refreshes to show the new school days

**Edit flow (date change):**
1. Admin edits a term's start or end date
2. Admin clicks Save
3. Term is updated via `updateTerm()`
4. Regeneration logic runs (extend/shrink/recalculate as described in section 2)
5. Toast describes what happened: "Term updated. Added school days for [new range]." or "Term updated. Removed school days after [new end date]."

**Delete flow:**
1. Admin clicks Delete on a term
2. Confirmation dialog warns about school day removal
3. On confirm: delete school days in the range, then delete the term
4. Calendar refreshes

### Rotation Days section — simplification

Remove the "On cancellation" subsection (Continue/Repeat radio buttons). The section becomes:

```
┌─────────────────────────────────────────────────────────────┐
│  Rotation Days                                     [Save]   │
│                                                             │
│  ☑ Uses rotation schedule                                   │
│                                                             │
│  Day names                                                  │
│  [A Day]  [B Day]  [+ Add]                                  │
│                                                             │
│  Rotation day names identify alternating schedule days.     │
│  Common examples: A Day / B Day, Gold / Maroon.             │
│                                                             │
│  Planned holidays pause the rotation; unscheduled           │
│  cancellations (weather, emergency) advance it.             │
└─────────────────────────────────────────────────────────────┘
```

The last line of helper text replaces the radio buttons — it explains the behavior without requiring a setting, since it's now automatic.

---

## Data Flow

### School day creation (term save)

```
Admin saves term
  → createTerm() / updateTerm()
  → generateSchoolDays(orgId, start, end, orgSettings, existingDays)
  → bulkUpsertSchoolDays(newDays)
  → invalidate ['school-days', orgId] query
  → calendar UI re-renders
```

### Exception marking (calendar click)

```
Admin clicks day → popover → marks as day off (reason: planned_holiday)
  → upsertSchoolDay({ ...day, is_school_day: false, override_reason: 'planned_holiday', notes: '...' })
  → recalculateRotationDays(orgId, termStartDate, termEndDate, orgSettings)
  → bulkUpsertSchoolDays(updatedDays)  // only days whose rotation changed
  → invalidate ['school-days', orgId] query
  → calendar UI re-renders with updated rotation labels
```

### Rotation recalculation

```
fetchSchoolDays(orgId, termStart, termEnd)
  → for each day in order:
      if day has explicit rotation_day override → skip
      calculate expected rotation_day using new algorithm
      if different from stored rotation_day → add to update batch
  → bulkUpsertSchoolDays(changedDays)
```

---

## New Files

| File | Purpose |
|------|--------|
| `src/components/calendar/CalendarGrid.jsx` | Month grid component with day cells, navigation, color coding |
| `src/components/calendar/DayPopover.jsx` | Click popover for viewing/editing a single day's status |
| `src/components/calendar/MarkRangeForm.jsx` | Date range exception form (inline or modal) |
| `src/hooks/useSchoolDays.js` | TanStack Query hook for fetching school days by date range |
| `src/lib/business-logic/schoolDayGeneration.js` | Generation logic: weekday enumeration, rotation calculation for new days |

## Modified Files

| File | Changes |
|------|--------|
| `src/pages/admin/OrgSettings.jsx` | Add Calendar section, integrate generation into term save, remove rotation_mode radio buttons |
| `src/lib/business-logic/rotation.js` | New per-reason algorithm replacing global rotation_mode |
| `src/api/calendar.js` | Add `deleteSchoolDaysInRange()` for term deletion/shrinking |
| `docs/business-logic/01-schedule-and-calendar.md` | Update rotation algorithm documentation |
| `docs/schema/01-core-tables.md` | Note `rotation_mode` deprecation in settings schema |

## Cleanup note

`src/api/terms.js` and `src/api/calendar.js` both contain term CRUD functions (created at different times). These should be consolidated — recommend keeping term functions in `terms.js` and calendar/school-day functions in `calendar.js`, removing the duplicates from whichever file is less canonical.

---

## New Hook

### `src/hooks/useSchoolDays.js`

```js
import { useQuery } from '@tanstack/react-query'
import { getSchoolDays } from '@/api/calendar'

export function useSchoolDays(orgId, startDate, endDate) {
  return useQuery({
    queryKey: ['school-days', orgId, startDate, endDate],
    queryFn: () => getSchoolDays(orgId, startDate, endDate),
    enabled: !!orgId && !!startDate && !!endDate,
  })
}
```

The calendar component calculates `startDate` and `endDate` from the currently displayed month (first day of month, last day of month) and fetches accordingly. Month navigation triggers new queries (which TanStack Query caches — navigating back to a previously viewed month is instant).

---

## Build Order

1. **Rotation algorithm update** — Update `rotation.js` with per-reason logic. Update docs. Remove radio buttons from OrgSettings Rotation Days section. Low risk, no UI dependency.
2. **School day generation logic** — `schoolDayGeneration.js` with weekday enumeration and rotation calculation. Pure functions, testable independently.
3. **useSchoolDays hook + calendar API additions** — Hook for fetching school days by month. Add `deleteSchoolDaysInRange()` to `calendar.js`.
4. **Term save → generation integration** — Wire generation into the term create/edit/delete flows in `OrgSettings.jsx`. This makes terms functional — saving a term populates the calendar.
5. **CalendarGrid component** — Month grid rendering, day cells with color coding and rotation labels, month navigation.
6. **DayPopover component** — Click interaction for single-day exception management.
7. **MarkRangeForm component** — Bulk date-range exception marking.
8. **Rotation recalculation on exception changes** — After any exception mutation, recalculate and update affected rotation labels.
9. **API cleanup** — Consolidate duplicate term functions between `terms.js` and `calendar.js`.

Steps 1–4 are the functional core (generation works, rotation is correct). Steps 5–7 are the UI. Step 8 ties exception management to rotation correctness. Step 9 is housekeeping.

---

## What's Deferred

- **Customizable rotation day colors** — Currently using fixed colors per rotation day index. Customizable colors could be added to org settings later.
- **Alternative schedule templates on specific days** — `school_days.schedule_template_id` exists for this, but the UI for assigning non-default templates to specific days is not part of this build. Comes with multi-template support.
- **Calendar printing / export** — An admin might want to print the calendar or export it. Not in scope.
- **Student/teacher calendar view** — This build is admin-only. Student and teacher views of the calendar are separate work.
- **Drag interactions on the calendar** — Dragging across days to select a range (instead of the Mark Range form) could be a future UX enhancement.
