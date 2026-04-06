# Enrollment-Level Scheduling — Design Document

**Date:** April 5, 2026
**Status:** Design doc — ready for build spec
**Scope:** Data model change adding per-student scheduling constraints (`days_of_week`, `rotation_day_type`, `recurrence_interval`, `recurrence_anchor_date`) to the `enrollments` table. Affects schema, scheduling predicates, enrollment validation, enrollment UI, roster queries, and agenda views.
**Reverses:** The "activity splitting, not enrollment overrides" decision in `admin-calendar-redesign-design-doc.md`. That decision was made before the full schedule was normalized; the real data makes the case for enrollment-level scheduling overwhelming.

---

## The Problem

City View has ~53 students. The fully normalized schedule produces **~460 distinct activities.** That ratio is unsustainable — both for data entry (Daniel is entering these by hand) and for cognitive load (teachers don't think of their classroom as 13 separate activities).

The explosion happens because the current model requires a new activity row for every unique combination of name + location + block + days_of_week + rotation_day_type. When the underlying reality is "8 students sit in Kali's Hub during Block 4 doing independent work, but each kid has a slightly different day pattern," the model creates 13 activities instead of 1.

### Where the 460 comes from

| Category | Count | What's driving the split |
|----------|-------|--------------------------|
| Independent Work Time | 100 | Per-student day variation across hubs and blocks |
| Edgenuity / Khan Academy courses | 120 | Same course, different hub + block + days per student |
| Worktime on [Subject] | 40 | Same as IWT — day variation |
| Internships | 46 | Same site, different day patterns per student |
| Advisory | 14 | Hub-based splits + day variation |
| Kirkwood courses | 56 | Hub/campus splits + day variation |
| Everything else | ~84 | Teacher-led classes, Iowa BIG, external HS courses, etc. |

The vast majority of these splits are caused by **per-student day-of-week variation within the same activity container.** The teacher, the room, the block, and the purpose are all identical — only which days each student attends differs.

---

## The Insight

**Scheduling variation between students belongs on the enrollment, not the activity.**

An activity defines a *container* — a staffed room at a known time on known days. An enrollment defines *a student's participation* within that container, which may be a subset of the container's full schedule.

This is how the staff already thinks about it. When Kali looks at Block 4, she thinks "I have Independent Work Time and a bunch of kids are here on various days." She doesn't think "I have 13 different activities." The model should match her mental model.

### What moves to enrollment (as optional narrowing constraints)

| Field | On activity (existing) | On enrollment (new) | Semantics |
|-------|----------------------|--------------------|-|
| `days_of_week` | When the container runs | When this student attends | Enrollment must be a subset of activity |
| `rotation_day_type` | Which rotation day the container runs on | Which rotation day this student attends | Enrollment must match or narrow |
| `recurrence_interval` | How often the container repeats (weekly, biweekly) | How often this student attends | Enrollment interval ≥ activity interval |
| `recurrence_anchor_date` | Anchor week for the container's recurrence | Anchor week for this student's recurrence | Independent anchor within same cadence |

**All four fields are nullable on enrollment.** Null means "follow the activity's schedule." This is the default for most enrollments and is fully backward compatible — every existing enrollment continues to work unchanged with null values.

**Enrollment scheduling only narrows, never expands.** A student cannot be enrolled on a day the activity doesn't run. The UI enforces this by only showing the activity's days as toggle-able options.

---

## Schema Change

```sql
ALTER TABLE enrollments
  ADD COLUMN days_of_week INTEGER[],
  ADD COLUMN rotation_day_type TEXT,
  ADD COLUMN recurrence_interval INTEGER,
  ADD COLUMN recurrence_anchor_date DATE;

-- Same validation constraints as activities:
ALTER TABLE enrollments ADD CONSTRAINT valid_enrollment_days CHECK (
  days_of_week IS NULL OR (
    array_length(days_of_week, 1) > 0
    AND days_of_week <@ ARRAY[0,1,2,3,4,5,6]
  )
);

ALTER TABLE enrollments ADD CONSTRAINT valid_enrollment_recurrence CHECK (
  recurrence_interval IS NULL OR recurrence_interval >= 1
);
```

No changes to the `activities` table. All existing activity-level scheduling fields remain and continue to define the container's schedule.

---

## Predicate Changes

### New: `enrollmentMeetsToday`

This is the per-student scheduling predicate. It checks whether a specific student's enrollment is active for a given date. It runs *after* `activityMeetsToday` — if the activity itself doesn't meet today, no enrollment in it can meet either.

```
function enrollmentMeetsToday(enrollment, activity, date, schoolDay):
  // Gate: does the activity itself meet today?
  if not activityMeetsToday(activity, date, orgId):
    return false

  // Enrollment-level rotation narrowing
  if enrollment.rotation_day_type is not null:
    if schoolDay.rotation_day != enrollment.rotation_day_type:
      return false

  // Enrollment-level day-of-week narrowing
  if enrollment.days_of_week is not null:
    dayNumber = extractDOW(date)
    if dayNumber not in enrollment.days_of_week:
      return false

  // Enrollment-level recurrence narrowing
  if enrollment.recurrence_interval is not null
     and enrollment.recurrence_interval > 1
     and enrollment.recurrence_anchor_date is not null:
    daysDiff = (date - enrollment.recurrence_anchor_date).days
    weeksSince = floor(daysDiff / 7)
    if weeksSince < 0:
      return false
    if weeksSince % enrollment.recurrence_interval != 0:
      return false

  // All checks passed — student is expected at this activity today
  return true
```

### Unchanged: `activityMeetsToday`

No changes. This predicate answers "is this activity running today?" from the **teacher/container perspective.** It continues to use the activity's own scheduling fields. The teacher's agenda card for "IWT — Kali's Hub, Block 4" shows up on every day the activity runs, regardless of which specific students are there today.

### Modified: Conflict detection (`wouldConflict`)

Currently compares two activities' scheduling fields. Must now compare the **effective schedule for each enrollment** — the intersection of the activity's schedule and the enrollment's constraints.

```
function getEffectiveSchedule(enrollment, activity):
  return {
    days_of_week: enrollment.days_of_week ?? activity.days_of_week,
    rotation_day_type: enrollment.rotation_day_type ?? activity.rotation_day_type,
    recurrence_interval: enrollment.recurrence_interval ?? activity.recurrence_interval ?? 1,
    recurrence_anchor_date: enrollment.recurrence_anchor_date ?? activity.recurrence_anchor_date,
    block: activity.block,
  }

function wouldConflictEnrollmentAware(newActivity, newEnrollmentSchedule, existingEnrollments):
  // newEnrollmentSchedule contains the proposed days/rotation/recurrence for the new enrollment
  // (may be null fields, meaning "follow the activity")
  newEffective = {
    days_of_week: newEnrollmentSchedule.days_of_week ?? newActivity.days_of_week,
    rotation_day_type: newEnrollmentSchedule.rotation_day_type ?? newActivity.rotation_day_type,
    block: newActivity.block,
    ...recurrence fields...
  }

  for each existing in existingEnrollments:
    existingEffective = getEffectiveSchedule(existing.enrollment, existing.activity)

    // Same block check
    if newEffective.block != existingEffective.block:
      continue
    if newEffective.block is null or existingEffective.block is null:
      continue

    // Day/rotation overlap check (same four-case matrix as before,
    // but operating on effective schedules instead of raw activity fields)
    if couldMeetOnSameDay(newEffective, existingEffective):
      return { conflicts: true, with: existing }

  return { conflicts: false }
```

The four-case day/rotation overlap matrix (both use days, both use rotation, mixed, neither) is unchanged in logic — it just operates on enrollment-effective values instead of activity-level values. This means two students *in the same activity* at the same block can have non-conflicting enrollments in other activities, because their effective days don't overlap. Today that requires activity splitting; after this change it doesn't.

### Modified: Student schedule queries

```
function getStudentScheduleForDate(studentId, date, organizationId):
  schoolDay = getSchoolDay(date, organizationId)
  if not schoolDay or not schoolDay.is_school_day:
    return { scheduled: [], unscheduled: [] }

  // Load enrollments with their parent activities
  enrolledActivities = getActiveEnrollments(studentId)
    .map(e => { enrollment: e, activity: getActivity(e.activity_id) })
    .filter(ea => ea.activity.is_active)

  scheduled = []
  unscheduled = []

  for ea in enrolledActivities:
    if ea.activity.is_not_scheduled:
      unscheduled.push(ea.activity)
      continue

    // Use enrollment-aware predicate instead of activity-only predicate
    if not enrollmentMeetsToday(ea.enrollment, ea.activity, date, schoolDay):
      continue

    times = getActivityEffectiveTimes(ea.activity, date, organizationId)
    scheduled.push({ activity: ea.activity, enrollment: ea.enrollment, times })

  return {
    scheduled: scheduled.sort(byBlockThenStartTime),
    unscheduled: unscheduled
  }
```

### Modified: Teacher roster queries

The teacher's roster for an activity on a given date filters by enrollment-level scheduling:

```
function getTeacherRosterForDate(activity, date, organizationId):
  if not activityMeetsToday(activity, date, organizationId):
    return []

  schoolDay = getSchoolDay(date, organizationId)
  enrollments = getActiveEnrollments(activityId: activity.id)

  // Filter to students whose enrollment matches today
  todayEnrollments = enrollments.filter(e =>
    enrollmentMeetsToday(e, activity, date, schoolDay)
  )

  return todayEnrollments.map(e => getStudent(e.student_id))
```

The teacher sees only students expected today. The activity card still shows up (via `activityMeetsToday`), but the student count and roster reflect enrollment-level filtering.

---

## Decisions (Settled)

### Enrollment days must be a subset of activity days

An enrollment cannot reference a day the activity doesn't run on. If the activity has `days_of_week = [1,3,5]` (MWF), enrollment day options are limited to M, W, and F. The UI enforces this by only rendering the activity's days as toggle-able pills.

Same principle for rotation: if the activity has `rotation_day_type = 'A'`, the enrollment can't override to 'B'. (If the activity has no rotation constraint, the enrollment can add one.)

### When activity days change, warn about orphaned enrollment days

If an admin removes Thursday from an activity's schedule and 3 students have enrollments that include Thursday, the app warns: "3 enrollments reference days you're removing. These students will be updated to remove Thursday from their enrollment schedule." The change is allowed (don't block the admin), but the affected enrollments are adjusted — any day in `enrollment.days_of_week` that is no longer in `activity.days_of_week` is removed. If this leaves an enrollment with an empty `days_of_week`, that enrollment should be flagged for admin review (effectively unenrolled, since they attend zero days).

### Teacher roster defaults to "today's students"

The roster modal shows students whose enrollment matches today. This is the default and matches the existing behavior (teachers see who's in their class *today*). The roster may include a "full roster" view toggle to show all enrolled students with their day indicators, but attendance marking is only available for students whose enrollment matches today — other students don't generate attendance records for days they're not scheduled.

### This extends #51 (inline enrollment), doesn't replace it

Issue #51 moved enrollment inline into ActivityDetail. That work is done. This design doc adds per-enrollment scheduling fields *within* that inline enrollment UI. The inline enrollment section in ActivityDetail gains day/rotation/recurrence controls per student row.

### Focus/assignment concept is out of scope

The idea of assigning a "focus activity" to a student within a freeform block (e.g., "during IWT, you should work on CR Geometry") is a separate feature. This doc covers scheduling constraints only.

---

## UI Changes

### Enrollment rows: inline day editor

Each enrolled student row in the inline enrollment section of ActivityDetail gains a compact scheduling editor. The default state is collapsed — the row shows the student name and a summary like "M–F" or "M W F" or "A days" or "Every 2 wks."

**Day pills:** Small toggleable day indicators showing the activity's days. Active days (highlighted) represent the student's enrollment days. Toggling a pill updates the enrollment's `days_of_week`. When all of the activity's days are active, the enrollment's `days_of_week` is null (follows activity).

**Rotation toggle:** Shown only when the organization uses rotation scheduling AND the activity doesn't already have a `rotation_day_type` set (if the activity is already constrained to A days, there's nothing to narrow). Compact control: "A / B / Both" or similar. When "Both," the enrollment's `rotation_day_type` is null.

**Recurrence controls:** Shown only when relevant (the activity or enrollment uses recurrence_interval > 1). A compact "Every X weeks, starting week Y" control. When the enrollment matches the activity's recurrence (or the activity has no recurrence), the enrollment fields are null.

**Collapsed summary:** When not editing, the row shows a compact text summary of the student's schedule within this activity. Examples:
- "M–F" (all days, no special constraints)
- "M W F" (specific days)
- "B days · T Th" (rotation + day constraint)
- "Every 2 wks · M W F" (recurrence + days)
- No summary shown when enrollment follows activity defaults entirely (null fields — most enrollments)

**Expansion:** Tapping/clicking the summary or an edit icon on the row expands inline day/rotation/recurrence controls. This keeps the default enrollment flow fast (just click to add students) while making per-student scheduling accessible when needed.

### Enrollment flow: enroll first, refine second

The core enrollment interaction is unchanged: click a student to add them to the enrolled list, click to remove. New enrollments default to null scheduling fields (follow the activity). The admin then optionally expands individual rows to set per-student days.

Bulk day assignment (select multiple students → set days for all) is a future optimization, not part of the initial implementation.

### Roster modal: today-filtered with optional full view

The roster modal (`RosterModal.jsx`) filters students by `enrollmentMeetsToday`. The header should indicate the filtering: "5 of 8 students today" or similar. A toggle (small link or icon) allows viewing all enrolled students with their day indicators. Attendance marking buttons are shown only for students whose enrollment matches today.

### Teacher agenda cards: today-accurate counts

The student count shown on each activity card in the teacher's agenda view should reflect enrollment-level day filtering — "4 students" means 4 students whose enrollment includes today, not 8 total enrolled.

### Student TodayView: no visible change

The student sees their schedule for today. Activities only appear if `enrollmentMeetsToday` is true. The predicate is more precise now, but the UI is identical.

### Admin calendar / week view: activity-level (no change)

The admin calendar shows activities based on `activityMeetsToday` — the activity-level predicate. This is correct: the admin is looking at the schedule structure (which containers exist when), not individual student schedules. Enrollment counts on calendar event cards could optionally reflect today's enrollment-filtered count, but this is a nice-to-have.

---

## Migration Path

### Schema migration

Add four nullable columns to `enrollments`. No data migration needed — all existing enrollments keep null values and behave exactly as before (follow the activity schedule).

### Application code migration

1. **Add `enrollmentMeetsToday` predicate** — new function in scheduling logic.
2. **Update student schedule queries** — use `enrollmentMeetsToday` instead of `activityMeetsToday` for per-student filtering. (Both hooks and API functions.)
3. **Update teacher roster queries** — filter by `enrollmentMeetsToday`.
4. **Update conflict detection** — compare enrollment-effective schedules instead of raw activity schedules.
5. **Update enrollment UI** — add inline day/rotation/recurrence editors to enrolled student rows in ActivityDetail.
6. **Update teacher agenda counts** — student counts on activity cards reflect today-filtered enrollment.

### Data re-entry

Daniel will re-enter the schedule using the new model. Activities that were previously split by student day variation will be consolidated into single activities with per-student enrollment scheduling. Existing activity and enrollment data will be cleared and re-entered from scratch.

---

## Impact Estimate

With enrollment-level scheduling, the expected activity count drops from ~460 to roughly **120–150** for the same schedule:

- Independent Work Time: 100 → ~26 (one per hub+block)
- Edgenuity/Khan: 120 → ~31 (one per distinct course, marked `is_not_scheduled`)
- Worktime on [Subject]: 40 → folded into IWT freeform blocks
- Internships: 46 → ~18–36 (one per site, or one per site+block)
- Advisory: 14 → ~5 (one per hub)
- Kirkwood: 56 → ~30 (one per course+location)
- Other: ~84 → ~60 (some consolidation from day-variation collapse)

This also enables the freeform consolidation strategy: IWT and "Worktime on X" become freeform blocks where students check in and tag their specific coursework. Edgenuity/Khan courses become unscheduled activities available for freeform tagging. Combined with enrollment-level scheduling, total activity count could approach **100–120** for 53 students — a much more manageable ratio.

---

## Invariants

These properties must hold after the change:

1. **An enrollment's days are always a subset of the activity's days.** The UI enforces this; the application validates it.
2. **Null enrollment scheduling fields mean "follow the activity."** This is the default for all new enrollments and all existing enrollments post-migration.
3. **`activityMeetsToday` is unchanged.** It answers "does this container run today?" using activity-level fields only.
4. **`enrollmentMeetsToday` only narrows.** It can never make a student appear on a day the activity doesn't run.
5. **Conflict detection uses enrollment-effective schedules.** Two enrollments in the same block don't conflict if their effective days don't overlap, even if the underlying activities' days do overlap.
6. **Teacher attendance is only recorded for students whose enrollment matches today.** Students enrolled but not scheduled today are visible in the full roster view but cannot have attendance marked.

---

## Future Considerations (Not In Scope)

- **Focus/assignment per enrollment:** A `focus_activity_id` or `focus_note` on enrollment to indicate what a student should work on during a freeform block. Separate design conversation.
- **Bulk day assignment:** Select multiple enrolled students and set days for the batch. Optimization for the initial "enroll first, refine second" workflow.
- **CSV import with enrollment-level scheduling:** Import format where each row maps to an enrollment (student + activity + days) with automatic activity deduplication.
- **Student-centric enrollment (Entry B, #7):** The enrollment panel's second entry point. Enrollment-level scheduling applies here too — when enrolling from the student's perspective, the admin sets the student's days for each activity.
