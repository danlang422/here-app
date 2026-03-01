# Enrollment Validation & Scheduling Overlap Prevention

## Design Philosophy

Here prevents scheduling conflicts at **enrollment time** rather than resolving them at runtime. When an admin enrolls a student in an activity, the application validates that the new activity does not overlap with any of the student's existing activities. If there is a genuine overlap, the enrollment is rejected with a clear error. If there is no overlap, the enrollment proceeds.

This means there is no priority system, no runtime conflict resolution, no "away" detection, and no hidden/shown logic. A student's schedule is exactly what it appears to be — every activity in their schedule is real, non-overlapping, and reflects where the student actually is on any given day.

This approach works because activities are entered to reflect what students actually do. A student who attends Advisory on B days only is enrolled in a B-day Advisory activity — not a daily Advisory with a separate conflicting external activity that requires priority-based resolution.

---

## What Makes Two Activities Overlap

Two activities conflict when they occupy the same block on any day where both would meet. The application checks three dimensions:

1. **Block** — must be the same block number for there to be any potential conflict
2. **Day of week** — do both activities meet on any shared weekday?
3. **Rotation day** — do both activities meet on the same rotation day?

An activity uses **either** `days_of_week` (specific weekdays like MWF or TuTh) **or** `rotation_day_type` (a rotation day like 'A' or 'B'), never both. This simplifies the overlap check to a small number of clear cases.

---

## Overlap Detection Algorithm

```
function wouldConflict(activityA, activityB):
  // Must be the same block to even consider a conflict
  if activityA.block != activityB.block:
    return false
  if activityA.block is null or activityB.block is null:
    return false

  aHasDays = activityA.days_of_week is not null
  bHasDays = activityB.days_of_week is not null
  aHasRotation = activityA.rotation_day_type is not null
  bHasRotation = activityB.rotation_day_type is not null

  // Case 1: Both use days_of_week — conflict if any shared day
  if aHasDays and bHasDays:
    return hasIntersection(activityA.days_of_week, activityB.days_of_week)

  // Case 2: Both use rotation_day_type — conflict if same rotation day
  if aHasRotation and bHasRotation:
    return activityA.rotation_day_type == activityB.rotation_day_type

  // Case 3: One uses days_of_week, the other uses rotation_day_type
  // A days-of-week activity meets on both rotation days, so it will always
  // collide with a rotation-day activity on that rotation day's occurrences.
  if (aHasDays and bHasRotation) or (aHasRotation and bHasDays):
    return true

  // Case 4: Neither has scheduling info — treat as conflict (data entry error)
  return true
```

### Why Case 3 is always a conflict

An activity with `days_of_week = [1,2,3,4,5]` (Mon–Fri) meets every school day — which includes both A days and B days. So if another activity in the same block has `rotation_day_type = 'A'`, the days-of-week activity is also meeting on A days, creating an overlap.

More generally, any `days_of_week` activity meets on a mix of A and B days throughout the term, so there's no way to guarantee it won't collide with a rotation-day activity. The admin should convert one of the activities to match the other's scheduling mode — either both use days of week or both use rotation days.

### Why Case 2 with different rotation days is safe

Two activities with `rotation_day_type = 'A'` and `rotation_day_type = 'B'` respectively will never meet on the same date. Every school day is either A or B (never both), so alternating-day activities at the same block are guaranteed non-overlapping.

---

## Enrollment Validation Flow

When an admin enrolls a student in an activity:

```
function validateEnrollment(studentId, newActivity):
  // Unscheduled activities (online courses) have no block — no conflict possible
  if newActivity.block is null:
    return { valid: true }

  // Get all of this student's active enrollments, joined to their activities
  existingEnrollments = getActiveEnrollments(studentId)
    .map(e => { enrollment: e, activity: getActivity(e.activity_id) })
    .filter(ea => ea.activity.block == newActivity.block)  // same block only

  for ea in existingEnrollments:
    if wouldConflict(newActivity, ea.activity):
      return {
        valid: false,
        reason: "This student already has " + ea.activity.name +
                " in Block " + ea.activity.block +
                " on overlapping days. Unenroll them first, or adjust " +
                "the scheduling so the activities don't overlap."
      }

  return { valid: true }
```

The same validation runs when an activity's block, days_of_week, or rotation_day_type is changed — the application checks all existing enrollments for that activity to ensure no student would end up with a conflict.

---

## Student Schedule for a Date

With conflicts prevented at enrollment time, building a student's daily schedule is straightforward — no filtering, no priority resolution:

```
function getStudentScheduleForDate(studentId, date, organizationId):
  schoolDay = getSchoolDay(date, organizationId)
  if not schoolDay or not schoolDay.is_school_day:
    return { scheduled: [], unscheduled: [] }

  enrolledActivities = getActiveEnrollments(studentId)
    .map(e => getActivity(e.activity_id))
    .filter(a => a.is_active)

  scheduled = []
  unscheduled = []

  for activity in enrolledActivities:
    if activity.is_not_scheduled:
      unscheduled.push(activity)
      continue

    if not activityMeetsToday(activity, date, organizationId):
      continue

    times = getActivityEffectiveTimes(activity, date, organizationId)
    scheduled.push({ activity, times })

  return {
    scheduled: scheduled.sort(byBlockThenStartTime),
    unscheduled: unscheduled
  }
```

Every activity in the `scheduled` list is real and non-overlapping. The student sees their actual schedule with no conflicts, no grayed-out items, no priority indicators.

---

## Teacher Roster for a Date

Similarly, the teacher roster is a direct query with no "away" filtering:

```
function getTeacherRosterForDate(activity, date, organizationId):
  // Does this activity meet today?
  if not activityMeetsToday(activity, date, organizationId):
    return []

  // Get all actively enrolled students
  enrollments = getActiveEnrollments(activityId: activity.id)

  return enrollments.map(e => getStudent(e.student_id))
```

Every student on the roster is enrolled in this specific activity on this specific day. A teacher who monitors multiple activities in the same block (e.g., different students doing internships, online courses, or Kirkwood classes) sees all of them — grouped by activity in the UI, but all on their roster for attendance purposes.

---

## Examples

### Example 1: Allison — Advisory (B days) + Kennedy Band (A days)

**Setup:**
- Advisory: `regular_class`, **Block 0**, `rotation_day_type = 'B'`, `requires_attendance = true`
- Kennedy Band: `external_hs_course`, **Block 0**, `rotation_day_type = 'A'`, `requires_attendance = false`

Allison is enrolled in both. Both have Block 0. Overlap check: both use `rotation_day_type`, values are different ('A' vs 'B') → **no conflict**.

**Monday, rotation A:**
- Advisory does not meet (rotation B only)
- Kennedy Band meets → Allison's schedule shows Band at Block 0

**Tuesday, rotation B:**
- Advisory meets → Allison's schedule shows Advisory at Block 0
- Kennedy Band does not meet (rotation A only)

Advisory teacher's roster on B days includes Allison. On A days, the Advisory activity doesn't meet, so there's no roster to show.

### Example 2: Carlos — Advisory (every day) + Kirkwood English (Tue/Thu)

**Setup:**
- Advisory: `regular_class`, **Block 3**, `days_of_week = [1,2,3,4,5]`, `requires_attendance = true`
- Kirkwood English: `college_course`, **Block 3**, `days_of_week = [2,4]` (Tue/Thu), `requires_attendance = true`, `monitor_id = Trevor`

Can Carlos be enrolled in both? Overlap check: both use `days_of_week`, intersection of `[1,2,3,4,5]` and `[2,4]` = `[2,4]` → **conflict**. The enrollment is rejected.

**Resolution:** The admin creates a separate Advisory activity for students like Carlos: Advisory (MWF), `days_of_week = [1,3,5]`, Block 3. Now Carlos enrolls in MWF Advisory and Tue/Thu Kirkwood English. Overlap check: intersection of `[1,3,5]` and `[2,4]` = empty → **no conflict**.

Carlos's schedule: Block 3 shows Advisory on Mon/Wed/Fri and Kirkwood English on Tue/Thu. Trevor monitors Carlos on Tue/Thu and marks attendance for the Kirkwood activity.

### Example 3: Dana — Kirkwood Business (monitored at City View, MWF)

**Setup:**
- Kirkwood Business: `college_course`, **Block 2**, `days_of_week = [1,3,5]` (MWF), `requires_attendance = true`, `monitor_id = Trevor`

Dana takes a Kirkwood course but stays at City View (online or proctored). The activity has Block 2 because it occupies that time slot. Trevor sees Dana on his Block 2 roster on MWF and marks attendance.

If Dana also has a different Block 2 activity on Tue/Thu (say, Independent Study with `days_of_week = [2,4]`), the overlap check passes — no shared days.

### Example 4: Prevented conflict — same block, same days

An admin tries to enroll a student in Chemistry (Block 2, `days_of_week = [1,2,3,4,5]`) when the student is already enrolled in Biology (Block 2, `days_of_week = [1,2,3,4,5]`).

Overlap check: both use `days_of_week`, intersection = `[1,2,3,4,5]` → **conflict**.

Application shows error: "This student already has Biology in Block 2 on overlapping days. Unenroll them first, or adjust the scheduling so the activities don't overlap."

### Example 5: Prevented conflict — mixed scheduling modes

An admin tries to enroll a student in a rotation-day activity (Block 1, `rotation_day_type = 'A'`) when the student already has a days-of-week activity in Block 1 (`days_of_week = [1,2,3,4,5]`).

Overlap check: one uses `days_of_week`, the other uses `rotation_day_type` → **always conflicts** (the every-day activity meets on A days too).

Application shows error explaining the overlap and suggesting the admin convert the every-day activity to match the scheduling mode.

---

## Edge Cases

**Release activities:**
An activity with `is_release = true` still has a block number (it blocks the slot visually). The overlap validation applies normally — a student enrolled in a release activity cannot also be enrolled in an overlapping activity at the same block. To assign the student something else during that block, unenroll them from the release first.

**Activity block changes after enrollment:**
If an admin changes an activity's block number, `days_of_week`, or `rotation_day_type`, the application must re-validate all active enrollments for that activity. If any student would now have an overlap, the change should fail with a clear error identifying the conflicting student(s) and their conflicting activities.

**Internship spanning multiple blocks:**
An internship during Blocks 4 and 5 (1:00 PM – 3:00 PM) is modeled as either one activity assigned to the earlier block with a time range covering both, or two separate internship activities (one per block). The overlap check applies per block, so two separate activities at Blocks 4 and 5 for the same student is fine — each block has exactly one enrollment.

**Student unexpectedly at City View (external class cancelled):**
If Kennedy's Band class is cancelled and Allison shows up at City View, she's not on any City View teacher's roster for that block (since her Block 0 is Band on A days). The teacher can manually create an attendance record for her if desired — this is a rare, manual situation best handled with teacher judgment rather than automated logic.
