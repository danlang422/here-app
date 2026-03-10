# Calendar Management — Build Spec

**Date:** March 9, 2026 (revised March 10, 2026)
**Context:** Admin interface for managing the school calendar: generating school days from terms, marking exceptions (holidays, cancellations), and calculating rotation days. Builds on the org settings work (block schedule, terms, rotation day names) completed in the previous session. The schema infrastructure (`school_days`, `schedule_templates`, `academic_terms`) and API functions (`calendar.js`) already exist — this spec adds the UI and generation logic.

**Scope:** Settings page layout restructure (two-column), calendar month grid UI, school day auto-generation on term save, exception management (single-day and date-range via popover), and an updated rotation algorithm that uses per-reason advancement instead of a global toggle.

**Design principle:** The calendar exists independently of terms. It's always navigable, always shows the current month by default, and becomes populated with school day data as terms are defined. Exceptions can be added even outside of term boundaries (informational annotation). The calendar is a visual tool for understanding the school year at a glance.

---

## What Gets Built

### 1. Settings Page Layout Restructure

Convert the current single-column settings layout to a two-column layout: settings cards stacked on the left, calendar pinned on the right. The calendar is always visible alongside the settings it depends on — term saves, rotation changes, and block edits are immediately reflected in the calendar.

### 2. Calendar Month Grid UI

Compact month grid showing school days, rotation labels, and exceptions with color coding.

### 3. School Day Generation

Auto-generate `school_days` rows when a term is created or edited. Weekdays within the term range become school days with calculated rotation labels.

### 4. Exception Management

Single-day and date-range exception marking, both initiated from a day-click popover. Override reasons (`planned_holiday`, `weather`, `emergency`) with optional notes.

### 5. Rotation Algorithm Update

Replace the global `rotation_mode` toggle with per-reason advancement logic. Planned holidays don't advance the rotation; unscheduled cancellations (weather/emergency) do.

### 6. Settings Page Cleanup

Remove "On cancellation" radio buttons from Rotation Days section. Deprecate `rotation_mode` in org settings.

---

## 1. Settings Page Layout Restructure

### Current state

The OrgSettings page uses `space-y-6 max-w-3xl` — three cards (Block Schedule, Academic Terms, Rotation Days) stacked in a single narrow column. On typical admin screens, this leaves significant unused horizontal space.

### New layout

Two-column responsive grid. Left column: settings cards stacked vertically (Block Schedule, Academic Terms, Rotation Days). Right column: calendar, pinned at the top so it remains visible as the admin scrolls through settings.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Settings                                                            │
│  Organization schedule configuration                                 │
│                                                                      │
│  ┌──────────────────────────┐    ┌────────────────────────────────┐  │
│  │ Block Schedule            │    │ School Calendar   [◀ Mar 2026 ▶] │
│  │ ...                       │    │                                │  │
│  ├──────────────────────────┤    │  Mon  Tue  Wed  Thu  Fri       │  │
│  │ Academic Terms            │    │  ┌────┬────┬────┬────┬────┐   │  │
│  │ ...                       │    │  │ 2  │ 3  │ 4  │ 5  │ 6  │   │  │
│  ├──────────────────────────┤    │  │ A  │ B  │ A  │ B  │ A  │   │  │
│  │ Rotation Days             │    │  ├────┼────┼────┼────┼────┤   │  │
│  │ ...                       │    │  │ 9  │10  │11  │12  │13  │   │  │
│  └──────────────────────────┘    │  │ B  │ A  │ B  │ A  │ B  │   │  │
│                                   │  ├────┼────┼────┼────┼────┤   │  │
│                                   │  │░16 │░17 │░18 │░19 │░20 │   │  │
│                                   │  ├────┼────┼────┼────┼────┤   │  │
│                                   │  │ 23 │ 24 │ 25 │ 26 │ 27 │   │  │
│                                   │  │ A  │ B  │ A  │ B  │ A  │   │  │
│                                   │  └────┴────┴────┴────┴────┘   │  │
│                                   │  Legend: ■ School  ░ Holiday   │  │
│                                   └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Implementation

Replace the current `<div className="space-y-6 max-w-3xl">` wrapper with a responsive two-column grid:

```jsx
<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
  {/* Left column: settings cards */}
  <div className="space-y-6">
    <BlockScheduleSection ... />
    <AcademicTermsSection ... />
    <RotationDaysSection ... />
  </div>

  {/* Right column: calendar */}
  <div className="lg:sticky lg:top-4 lg:self-start">
    <CalendarGrid ... />
  </div>
</div>
```

**Responsive behavior:** On screens below the `lg` breakpoint, the grid collapses to a single column with the calendar appearing below the settings cards. The `sticky` positioning only applies at `lg` and above.

**Column proportions:** The left column (settings) is narrower (`2fr`) since the cards are form-based and don't need much width. The right column (calendar) is wider (`3fr`) to give the month grid comfortable cell sizing. The exact ratio can be tuned during implementation — the calendar needs roughly 400–500px minimum to render 5 day columns comfortably.

### Why this matters

The calendar reacts live to settings changes. When the admin saves a term on the left, school days populate on the calendar on the right immediately (via React Query cache invalidation). When rotation settings change, the calendar re-renders with updated labels. This side-by-side layout makes that feedback loop visible without scrolling.

---

## 2. Calendar Month Grid UI

### Placement

The calendar lives in the right column of the two-column settings layout (see section 1). It's wrapped in its own card with the same styling as the settings cards.

The calendar is always visible and navigable, regardless of whether terms or school days exist. If no terms are defined, it's an empty calendar showing month/day structure only. As terms are created and school days generated, the calendar populates.

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

### Click interaction — Day Popover

Every day cell click opens a popover anchored to the clicked cell. The popover handles both single-day and range-based exception management — there is no separate "Mark Range" button in the calendar header.

**Single click on a school day:** Popover shows:
- Date (e.g., "Monday, March 9, 2026")
- Current status (School day)
- **"Mark as day off"** action:
  - Reason selector (Planned holiday, Weather, Emergency)
  - Optional notes field
  - Save / Cancel buttons
- **"Mark range starting here"** action:
  - End date picker (defaults to same day, admin picks the end of the range)
  - Reason selector (Planned holiday, Weather, Emergency)
  - Optional notes field (e.g., "Spring Break")
  - Save / Cancel buttons
  - On save, all **weekdays** between the clicked day and the selected end date are marked with the chosen reason and note

**Single click on a non-school day (exception):** Popover shows:
- Date and current status (Holiday / Cancelled)
- Current reason and notes (read-only display)
- **"Restore school day"** action
- **"Change reason"** action (switch between planned_holiday / weather / emergency)
- **"Mark range starting here"** — same as above, for extending an existing exception into a range

**Single click on a day outside term range:** Popover shows:
- Date and "Outside term range" status
- **"Add annotation"** action — creates an informational `school_days` row with `is_school_day = false` and a reason/note (e.g., "Winter Break"). This doesn't affect rotation calculations — it's purely for calendar annotation.
- **"Mark range starting here"** — same range tool, for annotating multi-day breaks between terms

### Popover UX notes

The popover should be compact — not a full modal. It anchors to the clicked cell and dismisses on outside click or Cancel. The "mark range" and "mark single day" options can be presented as a simple toggle or tab within the popover (e.g., "This day" | "Date range" tabs), or the range option can be a secondary action below the single-day form. Implementer's choice on the exact layout, but the key requirement is that both actions are accessible from the same popover without a separate calendar-header button.

For range marking, if a day in the range already has an override (e.g., it was individually marked as weather cancellation), the bulk operation overwrites it with the new reason. This matches the intent — if you're marking a whole week as spring break, any previous per-day overrides in that week should be replaced.

---

## 3. School Day Generation

### Trigger: Term save

When a term is created or updated via the Academic Terms section on the Org Settings page, school days are auto-generated for the term's date range.

**On term creation:**
1. Generate one `school_days` row per weekday (Mon–Fri) between `start_date` and `end_date` inclusive
2. All rows: `is_school_day = true`, `organization_id` from context, `schedule_template_id = null` (uses default template implicitly)
3. Calculate `rotation_day` for each day using the updated per-reason algorithm (see section 5). Since this is a fresh generation, all days are school days, so the rotation simply alternates from the term start: day 0 = rotation_names[0], day 1 = rotation_names[1], etc.
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

## 4. Exception Management

### Single-day exceptions

Handled via the day-click popover on the calendar grid (described in section 2). On save:

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

Also initiated from the day-click popover (described in section 2) via the "Mark range starting here" action. On confirm:

1. For each weekday in the range (from the clicked day to the selected end date), upsert a `school_days` row with `is_school_day = false`, the selected `override_reason`, and the note
2. Use `bulkUpsertSchoolDays()` for efficiency
3. Recalculate rotation days for all days after the range start
4. Invalidate cache

### Rotation recalculation on exception changes

Whenever an exception is added, removed, or changed, the rotation days for subsequent dates need recalculation. This is because adding a `planned_holiday` doesn't advance the rotation (so everything after shifts back by one), while adding a `weather` cancellation does advance it (no shift).

**Implementation:** After any exception mutation, fetch all `school_days` for the current term, recalculate rotation for each day using the new algorithm, and batch-update only the rows whose `rotation_day` changed. Days with explicit rotation overrides are skipped.

**Performance note:** At City View scale (roughly 180 school days per year), recalculating the full term is negligible. For larger deployments, this could be optimized to only recalculate from the changed date forward, but that's premature optimization for now.

---

## 5. Rotation Algorithm Update

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

## 6. Settings Page Changes

### Layout restructure

See section 1 for the full two-column layout change. The `OrgSettings` page component needs its wrapper updated and the `CalendarGrid` component added to the right column.

### Academic Terms section — generation integration

After a term is saved (create or update), trigger school day generation:

**Create flow:**
1. Admin fills in term name, start date, end date, sets current if desired
2. Admin clicks Save
3. Term is created via `createTerm()`
4. School days are auto-generated for the term range
5. Toast: "Term created. School days generated for [start] – [end]."
6. Calendar (right column) refreshes to show the new school days

**Edit flow (date change):**
1. Admin edits a term's start or end date
2. Admin clicks Save
3. Term is updated via `updateTerm()`
4. Regeneration logic runs (extend/shrink/recalculate as described in section 3)
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
Admin saves term (left column)
  → createTerm() / updateTerm()
  → generateSchoolDays(orgId, start, end, orgSettings, existingDays)
  → bulkUpsertSchoolDays(newDays)
  → invalidate ['school-days', orgId] query
  → calendar (right column) re-renders with new school days
```

### Exception marking (calendar click)

```
Admin clicks day on calendar → popover → marks as day off (reason: planned_holiday)
  → upsertSchoolDay({ ...day, is_school_day: false, override_reason: 'planned_holiday', notes: '...' })
  → recalculateRotationDays(orgId, termStartDate, termEndDate, orgSettings)
  → bulkUpsertSchoolDays(updatedDays)  // only days whose rotation changed
  → invalidate ['school-days', orgId] query
  → calendar re-renders with updated rotation labels
```

### Range exception marking (calendar click → popover → range)

```
Admin clicks day on calendar → popover → "Mark range starting here"
  → admin picks end date, reason, optional note
  → for each weekday in range: upsert school_days row (is_school_day: false, override_reason, notes)
  → bulkUpsertSchoolDays(rangeUpdates)
  → recalculateRotationDays(orgId, termStartDate, termEndDate, orgSettings)
  → bulkUpsertSchoolDays(rotationUpdates)
  → invalidate ['school-days', orgId] query
  → calendar re-renders
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
| `src/components/calendar/DayPopover.jsx` | Click popover for viewing/editing a single day's status and initiating range marking |
| `src/hooks/useSchoolDays.js` | TanStack Query hook for fetching school days by date range |
| `src/lib/business-logic/schoolDayGeneration.js` | Generation logic: weekday enumeration, rotation calculation for new days |

## Modified Files

| File | Changes |
|------|--------|
| `src/pages/admin/OrgSettings.jsx` | Two-column layout, add CalendarGrid to right column, integrate generation into term save, remove rotation_mode radio buttons |
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

1. **Settings page layout restructure** — Convert OrgSettings from single-column `max-w-3xl` to two-column responsive grid. Right column is an empty card placeholder for the calendar. This is a prerequisite for everything else since it changes the page structure.
2. **Rotation algorithm update** — Update `rotation.js` with per-reason logic. Update docs. Remove radio buttons from OrgSettings Rotation Days section. Low risk, no UI dependency.
3. **School day generation logic** — `schoolDayGeneration.js` with weekday enumeration and rotation calculation. Pure functions, testable independently.
4. **useSchoolDays hook + calendar API additions** — Hook for fetching school days by month. Add `deleteSchoolDaysInRange()` to `calendar.js`.
5. **Term save → generation integration** — Wire generation into the term create/edit/delete flows in `OrgSettings.jsx`. This makes terms functional — saving a term populates the calendar.
6. **CalendarGrid component** — Month grid rendering, day cells with color coding and rotation labels, month navigation. Drops into the right column placeholder from step 1.
7. **DayPopover component** — Click interaction for single-day exception management AND range marking. Both "mark this day" and "mark range starting here" actions live in this popover.
8. **Rotation recalculation on exception changes** — After any exception mutation, recalculate and update affected rotation labels.
9. **API cleanup** — Consolidate duplicate term functions between `terms.js` and `calendar.js`.

Steps 1–2 are structural prep (layout + algorithm). Steps 3–5 are the functional core (generation works, rotation is correct). Steps 6–7 are the UI. Step 8 ties exception management to rotation correctness. Step 9 is housekeeping.

---

## What's Deferred

- **Customizable rotation day colors** — Currently using fixed colors per rotation day index. Customizable colors could be added to org settings later.
- **Alternative schedule templates on specific days** — `school_days.schedule_template_id` exists for this, but the UI for assigning non-default templates to specific days is not part of this build. Comes with multi-template support.
- **Calendar printing / export** — An admin might want to print the calendar or export it. Not in scope.
- **Student/teacher calendar view** — This build is admin-only. Student and teacher views of the calendar are separate work.
- **Drag interactions on the calendar** — Dragging across days to select a range (instead of the popover-based range tool) could be a future UX enhancement.
- **Collapsible settings cards** — The left-column settings cards (particularly Block Schedule) could be made collapsible once set up. Not in scope for this build but worth considering once the layout is in place.
