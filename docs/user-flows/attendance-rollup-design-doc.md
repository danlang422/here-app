# Admin Attendance Rollup View — Design Doc

**Issue:** [#66](https://github.com/danlang422/here-app/issues/66)
**Status:** Design spec — ready for Claude Code implementation

---

## Purpose

This is the view that replaces the attendance spreadsheet. The admin uses it to identify which students need their status changed in Infinite Campus — where **students are marked present by default**. That means the admin's real task isn't reviewing every student; it's finding the exceptions: absences, tardies, excused absences, and students whose teachers haven't marked attendance yet (which needs follow-up).

The view is **read-only** — the admin doesn't mark attendance here, they consume what teachers have entered. The primary workflow is: open the rollup, scan the exceptions, then go into Infinite Campus and update the students who aren't present.

---

## Where It Lives

**Route:** `/admin/reports` (the existing placeholder `Reports.jsx` page)

This is the natural home for the rollup. The Reports page is already in the admin nav and currently shows placeholder text. The rollup becomes its first real content. Future reporting features (weekly summaries, missing-data alerts, export logs) will be siblings here — tabs or a sub-nav as the reports area grows.

No new route needed. No new nav entry. Just replace the placeholder content.

---

## Data Flow

### Source of truth

Teachers mark attendance at the **activity level** via the teacher agenda roster. Each marking creates an `attendance_records` row keyed to an `activity_instance_id` + `student_id`. The rollup reads these records and groups them by block for the admin.

### What the rollup query needs to answer

For a given `date` and `organization_id`:

1. What blocks exist today? → From `organization.settings.block_count`
2. Which students are supposed to be in each block? → Enrollments where the enrollment meets today (factoring in enrollment-level scheduling)
3. What activity are they in for that block? → The activity linked by the enrollment
4. Does an attendance record exist for that student in that activity instance? → Join to `attendance_records` via `activity_instances`
5. Does the activity even require attendance? → `activities.requires_attendance`

### The rollup query (client-side approach)

Rather than a single complex SQL query, use the same pattern as the teacher agenda: fetch the data in composable pieces and assemble client-side. This keeps the logic in JavaScript where `enrollmentMeetsToday` already lives and avoids duplicating the scheduling predicate in SQL.

**Fetches (all parallelizable):**

1. **School day record** for the selected date → `getSchoolDay(orgId, date)` (already exists in `useSchoolDays`)
2. **All active enrollments** with their activity data → new API function (see below)
3. **All activity instances** for the date → `getInstancesForDate(orgId, date)` (exists in `instances.js`)
4. **All attendance records** for those instances → `getAttendanceForInstances(instanceIds)` (exists in `agenda.js`)

**Client-side assembly:**

```
for each enrollment:
  activity = enrollment.activity
  if !activityMeetsToday(activity, date, schoolDay): skip
  if !enrollmentMeetsToday(enrollment, activity, date, schoolDay): skip
  
  block = enrollment.block ?? activity.block
  if block is null: skip (unscheduled activities don't appear in block rollup)
  
  instance = instanceMap.get(activity.id)
  attendanceRecord = instance ? attendanceMap.get(instance.id + student.id) : null
  
  bucket into blockGroups[block] → { student, activity, attendanceRecord, requiresAttendance }
```

### Multi-activity-per-block edge case

**Decision: show all, flag for review.**

A student in two activities in the same block on the same day is a valid scheduling pattern (e.g., Block 2 on A-day = Biology, Block 2 on B-day = Chemistry — but with enrollment-level scheduling, both could theoretically resolve to the same day in edge cases). The rollup should:

- Show **each** activity row for that student in the block (not collapse them)
- If statuses differ, mark the student row with a visual flag (⚠️ or similar) so the admin notices
- The admin decides which status to report to Infinite Campus — the app doesn't pick for them

In practice this will be rare at City View, but the UI handles it gracefully.

---

## New API Function

**`src/api/attendance.js`** (new file — attendance-specific queries that aren't agenda-tied)

```js
// Fetch all active enrollments with activity data for a given org.
// Returns enrollment rows with nested activity objects.
// Does NOT filter by date — caller applies enrollmentMeetsToday client-side.
export async function getAllActiveEnrollments(orgId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      student_id,
      activity_id,
      block,
      days_of_week,
      rotation_day_type,
      recurrence_interval,
      recurrence_anchor_date,
      student:student_id(id, first_name, last_name, preferred_name, grade_level),
      activity:activity_id(
        id, name, block, is_active, is_not_scheduled, is_release,
        requires_attendance, days_of_week, rotation_day_type,
        recurrence_interval, recurrence_anchor_date,
        start_date, end_date,
        teacher_id, monitor_id
      )
    `)
    .eq('is_active', true)

  if (error) throw error

  // Filter to enrollments where the activity belongs to this org and is active.
  // (RLS handles org scoping, but defensive filter doesn't hurt.)
  return data.filter(e => e.activity?.is_active)
}
```

This is the only new API function needed. Everything else reuses existing functions.

---

## New Hook

**`src/hooks/useAttendanceRollup.js`**

```js
export function useAttendanceRollup(orgId, date) {
  // Returns: { blockGroups, isLoading, error, stats }
  //
  // blockGroups: Map<blockNumber, StudentRow[]>
  //   StudentRow: { student, activity, attendanceStatus, requiresAttendance, hasConflict }
  //
  // stats: {
  //   totalStudents,        // all students across all blocks (with requires_attendance)
  //   marked,               // students with any attendance record
  //   unmarked,             // students with no record (teacher hasn't marked)
  //   absent,               // count of 'absent' records
  //   tardy,                // count of 'tardy' records
  //   excused,              // count of 'excused' records
  //   present,              // count of 'present' records
  //   totalExceptions,      // absent + tardy + excused + unmarked
  // }
}
```

The hook returns **all** student rows grouped by block. The Exceptions vs. Full Rollup filtering happens at the component level — the hook doesn't need to know which view is active.

**Dependencies:** `useSchoolDays` (for the school day record), `useOrgSettings` (for block_count), plus the three fetch calls described above wrapped in `useQuery`.

**Key detail:** The hook uses `enrollmentMeetsToday` from `scheduleUtils.js` to filter — the same predicate the student and teacher views use. This ensures the rollup shows exactly the students that teachers see on their rosters.

---

## UI Design

### Two views, one toggle

The page has two modes controlled by a toggle at the top:

- **Exceptions** (default) — shows only students who are absent, tardy, excused, or unmarked, grouped by block. This is the primary working view for the Infinite Campus workflow.
- **Full Rollup** — shows every student in every block with their status. Useful for a complete picture or auditing, but not the daily driver.

The toggle is a simple DaisyUI tab bar or segmented control: `[Exceptions] [Full Rollup]`. Both views share the same date picker and the same underlying data — the only difference is filtering.

### Layout — Exceptions view (default)

```
┌─────────────────────────────────────────────────────┐
│  Attendance                           [◀ date ▶]    │
│  [● Exceptions]  [ Full Rollup ]                    │
│                                                     │
│  ┌─── Block 0 ──────────────── 3 exceptions ──────┐ │
│  │ ● Evans, Jordan    Adv. Biology        Absent   │ │
│  │ ● Davis, Alex      Adv. Biology        Tardy    │ │
│  │ ○ Chen, Maya       Kirkwood ENG101     Unmarked │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─── Block 1 ──────────────── 0 exceptions ──────┐ │
│  │ ✓ All students present                          │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─── Block 2 ──────────────── 1 exception ───────┐ │
│  │ ● Martinez, Sofia  Freeform Block      Absent   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  Summary: 4 exceptions across 6 blocks              │
│  2 absent · 1 tardy · 1 unmarked                    │
└─────────────────────────────────────────────────────┘
```

When a block has zero exceptions, it collapses to a single line: "✓ All students present" — the admin can see at a glance that the block is clean and skip it. Blocks with exceptions are expanded by default.

### Layout — Full Rollup view

```
┌─────────────────────────────────────────────────────┐
│  Attendance                           [◀ date ▶]    │
│  [ Exceptions ]  [● Full Rollup]                    │
│                                                     │
│  ┌─── Block 0 ──────────────── 24/26 marked ──────┐ │
│  │ ● Evans, Jordan    Adv. Biology        Absent   │ │
│  │ ● Davis, Alex      Adv. Biology        Tardy    │ │
│  │ ○ Chen, Maya       Kirkwood ENG101     Unmarked │ │
│  │   Adams, Sarah     Adv. Biology        Present  │ │
│  │   Baker, Tom       Adv. Biology        Present  │ │
│  │   ...                                           │ │
│  └─────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─── Block 1 ──────────────── 25/25 marked ──────┐ │
│  │   ...                                           │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

The full rollup keeps the same sort order (exceptions first), so the top of each block still shows the students that need attention. The header badge changes to "X/Y marked" instead of "N exceptions."

### Component breakdown

1. **`AttendanceRollup`** — page-level component (replaces Reports.jsx placeholder content). Owns the date picker state, the view toggle state, and renders the block sections.

2. **`RollupDatePicker`** — date navigation. Left/right arrows to step by day, with a date display in between. Defaults to today (via `getDevToday()` for the dev override). Only navigates to school days would be ideal, but stepping through non-school days showing "No school" is fine for MVP.

3. **`RollupBlockSection`** — one per block. Collapsible. In Exceptions mode: auto-collapsed when no exceptions, auto-expanded when exceptions exist. In Full Rollup mode: all expanded by default. Header shows block label (from `getBlockLabel`), block time range (if schedule template is available), and either "N exceptions" or "X/Y marked" depending on mode.

4. **`RollupStudentRow`** — one row per student-activity pair within a block. Shows student name (last, first — preferred name in parentheses if different), activity name, and attendance status with color-coded indicator.

### Visual treatment

**Status indicators** — using the existing design system palette:

| Status | Display | Color treatment |
|--------|---------|-----------------|
| Present | `● Present` | Success/green, muted — this is the default/good state |
| Absent | `● Absent` | Error/red, bold — needs attention |
| Tardy | `● Tardy` | Warning/amber |
| Excused | `● Excused` | Info/blue |
| No record | `○ Unmarked` | Ghost/dimmed — teacher hasn't marked yet |
| No attendance required | `— N/A` | Dimmed, italic — activity has `requires_attendance = false` |

**What counts as an "exception":** Any student whose status is not `present`. This includes: `absent`, `tardy`, `excused`, and `null` (unmarked). The `excused` status is included because the admin still needs to record it in Infinite Campus even though it's not a discipline issue. Students in activities with `requires_attendance = false` are **not** exceptions — they're excluded from the exceptions view entirely (they have no meaningful status to report).

**Sort order within a block (both views):**
1. Absent (alphabetical by last name)
2. Tardy (alphabetical)
3. No record / unmarked (alphabetical)
4. Excused (alphabetical)
5. Present (alphabetical) — only visible in Full Rollup
6. N/A — attendance not required (alphabetical) — only visible in Full Rollup

**Multi-activity flag:** If a student appears in the same block more than once (different activities), show a ⚠️ icon on each of their rows. The admin sees both rows and both statuses.

**Non-school day:** If the selected date is not a school day, show a clean empty state: "No school on [date]" with the override reason if available.

**No data yet:** If it's a school day but no attendance has been marked for any block, the Exceptions view shows every student as "Unmarked" (since no one has been marked present). The summary reads something like "26 unmarked across 6 blocks."

### Summary bar

A persistent summary at the bottom (or top, under the toggle) showing aggregate counts for the selected date:

- **Exceptions mode:** "4 exceptions across 6 blocks — 2 absent · 1 tardy · 1 unmarked"
- **Full Rollup mode:** "148/152 marked — 2 absent · 1 tardy · 1 excused · 1 unmarked"

This gives the admin an at-a-glance read on whether the day's attendance is complete and how many entries they need to make in Infinite Campus.

---

## File Plan

| File | Action | Purpose |
|------|--------|---------|
| `src/api/attendance.js` | **Create** | `getAllActiveEnrollments(orgId)` |
| `src/hooks/useAttendanceRollup.js` | **Create** | Core data hook — fetches, filters with `enrollmentMeetsToday`, groups by block |
| `src/pages/admin/Reports.jsx` | **Replace** | Import and render `AttendanceRollup` |
| `src/components/attendance-rollup/AttendanceRollup.jsx` | **Create** | Page-level component with date picker and block sections |
| `src/components/attendance-rollup/RollupDatePicker.jsx` | **Create** | Date navigation (arrows + display) |
| `src/components/attendance-rollup/RollupBlockSection.jsx` | **Create** | Collapsible block group with header stats and student table |
| `src/components/attendance-rollup/RollupStudentRow.jsx` | **Create** | Single student row with status indicator |

---

## Dependencies / Reuse

These existing pieces are reused directly — no modifications needed:

- `enrollmentMeetsToday` and `activityMeetsToday` from `src/lib/scheduleUtils.js`
- `getInstancesForDate` from `src/api/instances.js`
- `getAttendanceForInstances` from `src/api/agenda.js`
- `getBlocks`, `getBlockLabel` from `src/lib/constants.js`
- `useSchoolDays` hook (for the school day record on the selected date)
- `useOrgSettings` hook (for `block_count` and `block_labels`)
- `getDevToday()` from dev override system (for default date)
- DaisyUI collapse/accordion for block sections
- Existing color variables from the design system

---

## What This Does NOT Include

- **Editing attendance** — this is read-only. Teachers edit via their own view.
- **Historical trends** — this is a single-day snapshot. Multi-day reports are a future feature.
- **Automatic SIS sync** — no API integration with Infinite Campus. The admin reads exceptions here and enters them manually in IC.
- **Copy/export** — no clipboard or CSV export for MVP. The Infinite Campus interface doesn't have a good bulk paste target anyway. If a copy/export need emerges during user testing, it can be added later as a simple enhancement.
- **Real-time updates** — the rollup uses standard TanStack Query caching. Realtime subscriptions are a future infrastructure item. The admin can refresh the page or the query will background-refetch per standard intervals.
- **Print view** — not needed for MVP.

---

## Open Questions (Resolved)

From the original issue, with decisions:

| Question | Decision |
|----------|----------|
| How to handle multi-activity blocks? | Show all rows, flag with ⚠️. Admin decides. |
| Own page or dashboard tab? | Lives on `/admin/reports` — the existing Reports page. |
| Copy-to-clipboard or CSV export? | Neither for MVP. IC doesn't have a good paste target. The Exceptions view is the workflow — admin reads it and enters exceptions in IC manually. Export can be revisited if user testing reveals a need. |
| Full rollup or targeted view? | Both — Exceptions view (default) shows only non-present students. Full Rollup toggle shows everyone. |

---

## Implementation Notes for Claude Code

- The `getAllActiveEnrollments` query will return all enrollments across the org. For City View's scale (~50-80 students, ~120-150 activities), this is fine as a single fetch. If performance becomes an issue later, the query can be narrowed by block or by activities that meet the target date — but that optimization requires moving scheduling logic to SQL, which isn't worth it for MVP.
- The hook should use `useQuery` with a query key that includes both `orgId` and `date`, so changing the date triggers a fresh fetch of instances and attendance records. The enrollments query can use a longer stale time since enrollment data changes infrequently within a day.
- The view toggle (Exceptions / Full Rollup) is purely client-side filtering — both views use the same hook data. Store the toggle state in a `useState`, not in the URL or Zustand. It doesn't need to persist.
- Block time display in the section headers requires the schedule template for the selected date. Use `useScheduleTemplate` if available — if no template is assigned to the school day, show block label only (no times). This is a nice-to-have detail, not a blocker.
- Use `getDevToday()` for the default date so the dev date override works during testing.
- The Exceptions view's "✓ All students present" collapsed state for clean blocks should use a DaisyUI collapse or just a simple div — don't over-engineer it. The admin just needs to see that the block is clean at a glance.
