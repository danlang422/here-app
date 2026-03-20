# Student Schedule View — Build Spec

**Created:** March 20, 2026  
**Status:** Almost Ready to Build -- pending additional build specs & final decisions on placement and presentation  
**Context:** Session discussion about schedule-building workflow gaps — admin needs to see individual student schedules to identify what's filled, what's empty, and where rotation-day or date-range gaps exist.

---

## Scope

This spec covers:
- `StudentScheduleView` component: a weekly grid showing one student's enrolled activities
- **Two display modes:** date-specific week (primary) with generic-week fallback
- Week navigation (left/right arrows, today shortcut)
- Rotation-day resolution to concrete days (in date-specific mode)
- Rotation split cards with gap indication (in generic fallback mode)
- Date range labels on time-bounded activities
- Setup-awareness nudges when org-level data is missing
- A new `useStudentEnrollments` hook wrapping the existing `getStudentEnrollments` API function
- Integration point: accessible from User Management (click a student → see their schedule)

This spec does NOT cover (designed for, build later):
- Date range navigator (selectable time windows derived from student's activity date ranges)
- Multi-student layering (overlaying multiple students' schedules for gap/conflict analysis)
- Placement assistant (finding available slots for an activity across enrolled students)
- Gap detection highlighting (programmatic identification and emphasis of empty slots)

---

## Architecture Decisions

**This is a standalone component, not a filtered agenda view.** The admin agenda view is an org-level overview optimized for density and aggregation. The student schedule view is optimized for a different question: "what does this one student's week look like?" They share utilities but have separate component trees.

**Date-specific is the primary mode.** When rotation calendar data is available, the view shows an actual week (e.g., Mar 16–20). Activities resolve to concrete days — an A-day activity appears only on days marked as A-days in `school_days`. This makes gaps real and actionable: an empty slot on Tuesday is a real gap, not an abstract "this might be empty depending on rotation."

**Generic-week is the fallback.** When `school_days` rotation data is not available (calendar not set up yet), the view falls back to a generic Mon–Fri grid. Rotation activities appear on all weekdays as split cards (A top, B bottom). This mode is less precise but still useful for seeing block coverage and identifying missing slots.

**Progressive enhancement with setup nudges.** The view works at three tiers of org setup. It's always available and useful, but gets more powerful as org configuration is completed. Rather than gating features behind setup, it nudges the admin toward completing setup by showing what they'd gain.

**Designed for future composition.** `StudentScheduleView` accepts a `studentId` prop and is self-contained. It can be rendered inside a page, modal, slide-over panel, or eventually composed with other instances for multi-student layering.

---

## Display Mode Tiers

### Tier 1 — Full Experience (rotation calendar + blocks defined)

**Conditions:** `school_days` records exist for the displayed week with `rotation_day` values populated.

**Behavior:**
- Date-specific week view with navigation
- Day headers show weekday + date + rotation day: "Mon 3/16 (A)"
- Rotation activities resolve to concrete days via `activityMeetsToday()`
- Each day shows exactly what happens that day — no split cards needed
- Activities with `rotation_day_type` show a small rotation badge ("A" or "B") on their card so the admin can see *why* this activity is here today
- Block overlay bands render from schedule template data
- Date range filtering is natural — navigate to different weeks to see how the schedule changes when activities start/end

### Tier 2 — Partial Experience (no rotation calendar, blocks defined)

**Conditions:** No `school_days` data for the displayed week (or rotation_day is null on all days), but `block_count` is set and schedule template exists.

**Behavior:**
- Generic week view (Mon–Fri, no specific dates, no week navigation)
- Rotation activities show on all weekdays as split cards (A/B top/bottom — see Card Rendering section)
- Block overlay bands render from schedule template
- Subtle info banner at top: "Set up rotation days in Calendar to see A/B schedules on specific dates."

### Tier 3 — Minimal Experience (no blocks, no rotation calendar)

**Conditions:** Neither rotation calendar nor block definitions are available.

**Behavior:**
- Generic week view
- Activities positioned by time only, no block overlay
- Rotation activities show as split cards
- Info banner: "Define blocks in Settings and rotation days in Calendar for a richer schedule view."

### Mode Detection Logic

```js
// Determine display mode based on available org data
function getDisplayMode(schoolDays, blockCount, scheduleTemplate) {
  const hasRotationData = schoolDays?.some(d => d.rotation_day != null) ?? false
  const hasBlocks = (blockCount ?? 0) > 0
  const hasTemplate = scheduleTemplate?.block_definitions?.length > 0

  if (hasRotationData) return 'date-specific'    // Tier 1
  if (hasBlocks && hasTemplate) return 'generic-with-blocks'  // Tier 2
  return 'generic-minimal'                        // Tier 3
}
```

---

## Existing Infrastructure

### API (one modification needed)

```js
import { getStudentEnrollments } from '@/api/enrollments'
```

**Modify `getStudentEnrollments`** to join teacher/monitor profiles (matches the pattern used by `useActivities`):

```js
export async function getStudentEnrollments(studentId, { isActive = true } = {}) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      *,
      activity:activities(
        *,
        teacher:user_profiles!teacher_id(id, first_name, last_name, preferred_name),
        monitor:user_profiles!monitor_id(id, first_name, last_name, preferred_name)
      )
    `)
    .eq('student_id', studentId)
    .eq('is_active', isActive)

  if (error) throw error
  return data
}
```

### New Hook (add to `src/hooks/useEnrollments.js`)

```js
export function useStudentEnrollments(studentId) {
  return useQuery({
    queryKey: ['enrollments', 'student', studentId],
    queryFn: () => getStudentEnrollments(studentId),
    enabled: !!studentId,
  })
}
```

### Existing Hooks (no changes)

```js
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import { useSchoolDays } from '@/hooks/useSchoolDays'
import useAuthStore from '@/store/authStore'
```

- `useSchoolDays(orgId, startDate, endDate)` — returns school day records for a date range, including `rotation_day` per date. Key data source for date-specific mode.
- `useOrgSettings(orgId)` — returns org settings including `block_count` and `rotation_day_names`.
- `useDefaultScheduleTemplate(orgId)` — returns the default schedule template with `block_definitions`.

### Shared Utilities (reuse from agenda + schedule)

```js
// From agenda utilities
import {
  timeToMinutes, minutesToPx, activityTop, activityHeight,
  floorToHour, ceilToHour,
  PX_PER_HOUR, TIME_COL_WIDTH, GRID_PAD_Y,
  DEFAULT_GRID_START, DEFAULT_GRID_END,
} from '@/components/agenda/agendaUtils'

// From schedule utilities — the core predicate
import {
  activityMeetsToday, formatDateISO, addDays, subDays, isSameDay, extractDOW,
} from '@/lib/scheduleUtils'

// Block overlay (reuse as-is)
import AgendaBlockOverlay from '@/components/agenda/AgendaBlockOverlay'
```

`activityMeetsToday(activity, date, schoolDay)` is the authoritative predicate for whether an activity occurs on a specific date. It handles date ranges, rotation days, days of week, and school day checks. The date-specific mode uses this directly.

---

## Data Derivations

All computed inside `StudentScheduleView` from enrollment, activity, and school day data.

### Scheduled vs. unscheduled activities

```js
const scheduledActivities = useMemo(() =>
  enrollments
    .filter(e => {
      const a = e.activity
      return a.is_active && !a.is_not_scheduled && a.default_start_time && a.default_end_time
    })
    .map(e => e.activity),
  [enrollments]
)

const unscheduledActivities = useMemo(() =>
  enrollments
    .filter(e => {
      const a = e.activity
      return a.is_active && (a.is_not_scheduled || !a.default_start_time)
    })
    .map(e => e.activity),
  [enrollments]
)
```

### Week dates (for date-specific mode)

```js
// Given a reference date, compute the Mon–Fri dates for that week
function getWeekDates(referenceDate) {
  const d = new Date(referenceDate)
  const dow = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const monday = new Date(d)
  monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))

  return Array.from({ length: 5 }, (_, i) => {
    const date = addDays(monday, i)
    return {
      date,
      dateStr: formatDateISO(date),
      dayValue: extractDOW(date), // 1=Mon, 2=Tue, ..., 5=Fri
    }
  })
}
```

### Activities for a specific date (date-specific mode)

```js
// Returns activities that meet on a specific date, using activityMeetsToday()
function activitiesForDate(activities, date, schoolDay) {
  return activities.filter(a => activityMeetsToday(a, date, schoolDay))
}
```

This is the core derivation for Tier 1. For each day in the displayed week, look up the `schoolDay` record, then filter activities through `activityMeetsToday`. The result is exactly the activities that occur on that specific date — rotation days resolved, date ranges respected.

### Activities for a generic day (fallback mode)

```js
// Returns activities that meet on a generic weekday,
// split into { regular, rotationA, rotationB }
function activitiesForGenericDay(activities, dayValue, rotationDayNames) {
  const regular = []
  const rotationA = []
  const rotationB = []
  const [nameA, nameB] = rotationDayNames ?? ['A', 'B']

  for (const a of activities) {
    // Does this activity meet on this weekday?
    if (a.days_of_week != null && !a.days_of_week.includes(dayValue)) continue
    // Activities with neither days_of_week nor rotation_day_type were filtered
    // out as unscheduled. Rotation-only activities (no days_of_week) show every weekday.
    if (a.days_of_week == null && !a.rotation_day_type) continue

    if (a.rotation_day_type) {
      if (a.rotation_day_type === nameA) rotationA.push(a)
      else if (a.rotation_day_type === nameB) rotationB.push(a)
      else regular.push(a)
    } else {
      regular.push(a)
    }
  }

  return { regular, rotationA, rotationB }
}
```

### Grid bounds

Same pattern as existing views:

```js
const gridBounds = useMemo(() => {
  if (scheduledActivities.length === 0) {
    return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
  }
  const starts = scheduledActivities.map(a => a.default_start_time).filter(Boolean)
  const ends = scheduledActivities.map(a => a.default_end_time).filter(Boolean)
  const minStart = starts.reduce((a, b) => a < b ? a : b)
  const maxEnd = ends.reduce((a, b) => a > b ? a : b)
  return {
    start: minStart < DEFAULT_GRID_START ? floorToHour(minStart) : DEFAULT_GRID_START,
    end: maxEnd > DEFAULT_GRID_END ? ceilToHour(maxEnd) : DEFAULT_GRID_END,
  }
}, [scheduledActivities])
```

### Date range collection (computed now, rendered later)

```js
// Collect unique date range boundaries for future navigator
const dateRanges = useMemo(() => {
  const ranges = new Set()
  for (const a of scheduledActivities) {
    if (a.start_date || a.end_date) {
      ranges.add(JSON.stringify({ start: a.start_date, end: a.end_date }))
    }
  }
  return [...ranges].map(r => JSON.parse(r))
}, [scheduledActivities])
```

---

## Component Structure

```
src/components/schedule/
  StudentScheduleView.jsx     — main component; manages mode detection, week state, data fetching
  ScheduleWeekGrid.jsx        — Mon–Fri time grid (used by both modes)
  ScheduleDayColumn.jsx       — single day column with positioned cards
  ScheduleCard.jsx            — activity card (standard, rotation-badge, and rotation-split variants)
  ScheduleUnscheduledList.jsx — compact list of unscheduled activities below the grid
  scheduleUtils.js            — derivation helpers (activitiesForDate, activitiesForGenericDay,
                                 getWeekDates, findRotationPairs)
```

Place in `src/components/schedule/` — distinct from `src/components/agenda/`, though it shares agenda utilities.

---

## Week Navigation (Date-Specific Mode Only)

Header above the grid, following the pattern established by student TodayView:

```
    ‹   Mar 16 – 20, 2026   ›        [Today]
```

- Left/right arrows navigate by week
- "Today" button appears when not viewing the current week
- Uses `useState` for the reference date, `getWeekDates()` to derive Mon–Fri
- `useSchoolDays(orgId, mondayStr, fridayStr)` fetches rotation data for the displayed week

In generic fallback mode, this navigation is hidden and the header simply reads "Weekly Schedule."

---

## Day Column Headers

### Date-specific mode

```
Mon 3/16 (A)    Tue 3/17 (B)    Wed 3/18 (A)    Thu 3/19 (B)    Fri 3/20 (A)
```

- Weekday abbreviation + date
- Rotation day in parentheses, if that day has `rotation_day` set
- If the day is not a school day (`is_school_day = false`), show it muted with a label like "No school" and render the column empty or with a subtle indicator

### Generic fallback mode

```
Mon    Tue    Wed    Thu    Fri
```

- Just weekday names, no dates

---

## Grid Layout

### ScheduleWeekGrid

Same positioning approach as the existing agenda grid:

- Outer container: `flex` row — time axis on left, 5 day columns filling remaining width
- Time axis: fixed `TIME_COL_WIDTH` px wide, hour labels
- Day columns: `flex-1` each
- Total grid height: `minutesToPx(gridEndMinutes - gridStartMinutes) + GRID_PAD_Y * 2`
- Block overlay behind cards (reuses `AgendaBlockOverlay`)

### ScheduleDayColumn

**Date-specific mode:** receives a flat list of activities for that date (already filtered by `activityMeetsToday`). Each activity renders as a standard card. Overlap between activities is handled by side-by-side rendering at 50% width (should be rare for a single student due to enrollment validation).

**Generic fallback mode:** receives `{ regular, rotationA, rotationB }` from `activitiesForGenericDay`. Regular activities render as standard cards. Rotation activities are paired and rendered as split cards (see Card Rendering).

---

## Card Rendering

### Standard Card (ScheduleCard, variant="standard")

For activities in date-specific mode, or non-rotation activities in generic mode. Full-width within the day column.

**Content (top to bottom, truncate as needed):**
- **Activity name** — primary text, semibold, truncated
- **Staff name** — secondary text, muted (`instructor_name` if set, else teacher last name)
- **Time range** — e.g., "7:30–9:00a" — small, muted
- **Block badge** — e.g., "B0" — small pill, only if block assigned
- **Rotation badge** — e.g., "A" — small pill, only in date-specific mode for rotation activities (so admin can see why this activity appears on this day)
- **Date range** — e.g., "Jan 20 – May 15" — small, muted, only if `start_date` or `end_date` is set

Card height determined by `activityHeight()`. For short activities (< 45 min), prioritize name and time; drop other details if space is tight.

**Styling:**
- `bg-base-100 border border-base-300 shadow-sm rounded-lg overflow-hidden`
- Compact padding: `px-2 py-1`

### Rotation Split Card (ScheduleCard, variant="rotation-split")

**Only used in generic fallback mode.** For time slots where at least one activity has `rotation_day_type`.

**Pairing logic:**

```js
function findRotationPairs(rotationA, rotationB) {
  const pairs = []
  const usedB = new Set()

  for (const aAct of rotationA) {
    const match = rotationB.find((bAct, idx) => {
      if (usedB.has(idx)) return false
      return timesOverlap(aAct, bAct)
    })
    if (match) {
      usedB.add(rotationB.indexOf(match))
      pairs.push({ a: aAct, b: match })
    } else {
      pairs.push({ a: aAct, b: null })
    }
  }

  rotationB.forEach((bAct, idx) => {
    if (!usedB.has(idx)) {
      pairs.push({ a: null, b: bAct })
    }
  })

  return pairs
}

function timesOverlap(actA, actB) {
  const aStart = timeToMinutes(actA.default_start_time)
  const aEnd = timeToMinutes(actA.default_end_time)
  const bStart = timeToMinutes(actB.default_start_time)
  const bEnd = timeToMinutes(actB.default_end_time)
  return aStart < bEnd && bStart < aEnd
}
```

**Split card layout (both halves filled, matching times):**

```
┌─────────────────────────┐
│ A ░ Activity Name       │  ← top half
│   ░ Staff · 7:30–9:00a  │
├─────────────────────────┤  ← dashed divider
│ B ░ Activity Name       │  ← bottom half
│   ░ Staff · 7:30–9:00a  │
└─────────────────────────┘
```

**Split card layout (both filled, mismatched times):**

When paired activities overlap but don't share identical times, the card spans the union of both time ranges. Each half shows its own time range, and a subtle visual indicator communicates the mismatch — a small time-offset icon or the times rendered in a slightly emphasized style so the admin notices they differ.

```
┌─────────────────────────┐
│ A ░ Band                │
│   ░ 7:30–9:00a          │
├─────────────────────────┤
│ B ░ Advisory             │
│   ░ 8:00–9:30a  ⚠       │  ← different time highlighted
└─────────────────────────┘
```

The card's top is positioned at the earlier of the two start times; its height spans to the later of the two end times.

**Half-filled split card (gap indicator):**

```
┌─────────────────────────┐
│ A ░ Band (Kennedy)      │  ← filled half
│   ░ 7:30–9:00a          │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│ B ░                     │  ← empty: muted background, dashed border
│   ░  No B-day activity  │
└─────────────────────────┘
```

- Empty half: `bg-base-200/50` with muted text using org's rotation day name
- This is the primary gap indicator for rotation schedules in generic mode

**Positioning:**
- Overall top: earliest start time from the pair (or single activity)
- Overall height: span from earliest start to latest end
- Divider: `border-t border-dashed border-base-300` at the 50% mark
- Each half: `h-1/2` within the card

**Styling:**
- Outer card: `bg-base-100 border border-base-300 shadow-sm rounded-lg overflow-hidden`
- Rotation badge: `text-[10px] font-semibold px-1 rounded bg-base-200`
- Each half has compact padding

---

## Unscheduled Activities List

Below the week grid. Compact list of activities without times.

```
── Unscheduled ──────────────────
  Online Spanish (monitor: Smith)
  Independent Reading (no staff)
```

- Simple list, no time positioning
- Shows activity name + staff if assigned
- `text-sm`, minimal padding
- Only renders if there are unscheduled activities

---

## Setup Nudge Banners

Subtle info banners based on missing org configuration. Informational, not blocking.

**No rotation calendar (Tier 2):**
```
ℹ️ Set up rotation days in Calendar to see A/B schedules resolved to specific dates.
```

**No blocks or template (Tier 3):**
```
ℹ️ Define blocks in Settings and rotation days in Calendar for a richer schedule view.
```

**Styling:** DaisyUI `alert` variant, compact, dismissible (local state — no persistence needed).

---

## Integration: Where the View Lives

### Immediate: User Management page

Add a "View Schedule" action to student rows. Opens `StudentScheduleView` in a **slide-over panel** from the right — keeps the user list visible while showing the schedule alongside it.

The slide-over should be wide enough for the week grid (minimum ~600px, ideally ~50–60% of viewport). On narrow viewports, fall back to a full-screen modal.

### Future integration points (no work now)
- Enrollment panel: show selected student's schedule while choosing activities
- Admin dashboard: student picker → schedule view panel
- Activity detail: click enrolled student → see their schedule

---

## Component Props

### StudentScheduleView

```ts
interface StudentScheduleViewProps {
  studentId: string           // UUID — the student to display
  // Future props for composition:
  // highlightGaps?: boolean
  // dateWindow?: { start: string, end: string }
  // layeredStudentIds?: string[]
}
```

Self-contained — fetches its own data via `useStudentEnrollments`, `useOrgSettings`, `useDefaultScheduleTemplate`, and (in date-specific mode) `useSchoolDays`.

### ScheduleCard

```ts
interface ScheduleCardProps {
  variant: 'standard' | 'rotation-split'
  // For variant="standard":
  activity?: Activity
  showRotationBadge?: boolean  // show A/B badge (date-specific mode)
  // For variant="rotation-split":
  activityA?: Activity | null  // null = gap
  activityB?: Activity | null  // null = gap
  // Common:
  rotationDayNames?: [string, string]  // e.g. ['A', 'B']
}
```

---

## Empty States

**Student has no enrollments:** Centered message: "No activities enrolled."

**Student has enrollments but none with times:** Grid area note: "All activities are unscheduled or pending time assignment." Unscheduled list still renders below.

**A day column has no activities:** Column renders with time axis and grid lines only — visually empty, which is informative.

**Date-specific mode, day is not a school day:** Column shows a muted "No school" label. No activities rendered. If the school day has an `override_reason`, show it (e.g., "No school — Holiday").

---

## Deferred Features — Design Notes

### Date Range Navigator

The `dateRanges` computed value collects distinct date boundaries. A future addition renders these as selectable pills above the grid:

```
[ All ] [ Jan 20 – Mar 14 ] [ Mar 16 – May 15 ]
```

In date-specific mode, selecting a range could jump the week navigator to a representative week within that range. In generic mode, it would filter which activities appear on the grid.

### Multi-Student Layering

`StudentScheduleView` could accept `layeredStudentIds`. Each additional student's activities overlay with distinct visual treatment (border colors, opacity). Shared gaps appear as empty space across all layers.

### Gap Detection

A `highlightGaps` prop could render explicit gap cards: for each block in the schedule template, if no activity covers that time on a given day, show a dashed placeholder with the uncovered time range. Works in both date-specific mode (concrete gaps) and generic mode (potential gaps).