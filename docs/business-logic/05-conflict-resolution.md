# Scheduling Constraints & Away Detection

## Design Philosophy

City View's V2 model **prevents** scheduling conflicts rather than resolving them. Each student can have at most one activity per numbered block, enforced by a database constraint on the `enrollments` table. There is no priority system, no runtime conflict resolution, and no "unresolved conflict" state for City View activities.

External activities (classes at Kennedy, Washington, Jefferson) don't occupy a City View block — they have no block number. Instead, they produce "away" indicators when their schedule overlaps with a City View block's times on a given day.

---

## One Enrollment Per Block

**The constraint:**

```sql
CREATE UNIQUE INDEX idx_enrollments_one_per_block
  ON enrollments(student_id, block)
  WHERE is_active = true AND block IS NOT NULL;
```

This means:
- A student can have **at most one active enrollment per block number** (0–5)
- The `block` on enrollments is denormalized from `activities.block` at enrollment time
- Activities with `block = NULL` (external HS courses, online courses) are exempt — they don't occupy a City View slot
- Deactivated enrollments (`is_active = false`) don't count toward the constraint

**What the constraint prevents:**
- Two regular classes in the same block for the same student
- A regular class and a freeform block in the same block for the same student
- Any accidental double-booking of City View block time

**When enrollment is attempted and the block is occupied:**
The application should check before inserting and show a clear error: "This student already has [Activity Name] in Block 3. Unenroll them first, or choose a different block."

### Which activities get block numbers?

| Type | Has block? | Why |
|------|-----------|-----|
| `regular_class` | Yes | City View class, occupies a specific block |
| `freeform` | Yes | Supervised work period at City View, occupies a block |
| `college_course` (at City View) | Yes | Monitored at City View during a specific block |
| `internship` (during school hours) | Yes | Student is gone during this block — the internship IS their block activity |
| `external_hs_course` | **No** | Runs on the other school's schedule; doesn't occupy a City View slot |
| `college_course` (at Kirkwood campus) | **No** | Student is off-campus; treated like an external activity |
| `online_course` | **No** | `is_not_scheduled = true` — no fixed time or place |

The key distinction: if a City View teacher or monitor is responsible for the student during that block, the activity gets a block number. If the student is elsewhere and City View just needs to know they're gone, no block number.

---

## External Activities and "Away" Detection

External activities (primarily `external_hs_course`) have no block number but DO have a schedule:
- `rotation_day_type` — which rotation day they meet (e.g., 'A')
- `default_start_time` / `default_end_time` — the time range at the other school
- `requires_attendance = false` — City View doesn't report attendance; the other school handles it

**Purpose of away detection:** When a teacher opens their roster for a block, students who are at an external activity during that block's time are shown in an "Away today" section rather than on the active roster. This is informational — the teacher knows why the student isn't present.

### How it works

```
function getTeacherRosterForDate(activity, date, organizationId):
  if not activityMeetsToday(activity, date, organizationId):
    return { present: [], away: [] }

  // Get this activity's effective times for today
  activityTimes = getActivityEffectiveTimes(activity, date, organizationId)

  // Get all active enrollments for this activity
  enrollments = getActiveEnrollments(activityId: activity.id)

  present = []
  away = []

  for enrollment in enrollments:
    studentId = enrollment.student_id

    // Check if this student has an external activity that meets today
    // and overlaps with this block's times
    externalActivities = getActiveEnrollments(studentId)
      .map(e => getActivity(e.activity_id))
      .filter(a => a.block IS NULL)              // external — no City View block
      .filter(a => a.is_active)
      .filter(a => not a.is_not_scheduled)        // has a real schedule
      .filter(a => not a.requires_attendance)      // City View doesn't handle attendance
      .filter(a => activityMeetsToday(a, date, organizationId))

    awayAt = null
    for ext in externalActivities:
      extTimes = getActivityEffectiveTimes(ext, date, organizationId)
      if extTimes and timesOverlap(activityTimes.start, activityTimes.end,
                                     extTimes.start, extTimes.end):
        awayAt = ext
        break

    if awayAt:
      away.push({
        student: getStudent(studentId),
        reason: awayAt.name,
        activity: awayAt
      })
    else:
      present.push(getStudent(studentId))

  return { present, away }
```

### Time overlap check

```
function timesOverlap(startA, endA, startB, endB):
  return startA < endB and startB < endA
```

Used only for away detection — comparing external activity times against City View block times. Not used for detecting conflicts between City View activities (those are prevented by the one-per-block constraint).

---

## Student Schedule for a Date

A student's daily schedule is straightforward — no conflict resolution needed:

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
  awayIndicators = []

  for activity in enrolledActivities:
    if activity.is_not_scheduled:
      unscheduled.push(activity)
      continue

    if not activityMeetsToday(activity, date, organizationId):
      continue

    times = getActivityEffectiveTimes(activity, date, organizationId)

    if activity.block is not null:
      // City View activity — show on schedule
      scheduled.push({ activity, times })
    else:
      // External activity meeting today — show as "away" note on the overlapping block
      awayIndicators.push({ activity, times })

  return {
    scheduled: scheduled.sort(byBlockThenStartTime),
    unscheduled: unscheduled,
    awayIndicators: awayIndicators
  }
```

**Student agenda display:**
- **Block activities:** Shown with full details — name, time, block, location, action buttons
- **Away indicators:** When an external activity meets today, the student sees a note on the affected block: "At Kennedy — Band" (replacing the normal block activity view for that time range)
- **Unscheduled activities:** Shown in a separate "Available anytime" section for freeform tagging and status updates

---

## Examples

### Example 1: Allison — Advisory + Kennedy Band

**Setup:**
- Advisory: `regular_class`, **Block 0**, `days_of_week = [1,2,3,4,5]`, `requires_attendance = true`
- Kennedy Band: `external_hs_course`, **block = NULL**, `rotation_day_type = 'A'`, `default_start_time = '07:30'`, `default_end_time = '09:00'`, `requires_attendance = false`

Allison is enrolled in both. Advisory occupies Block 0 (enforced by constraint). Kennedy Band has no block — it's external.

**Monday, rotation A:**
- Advisory: meets (Mon in days_of_week)
- Kennedy Band: meets (rotation A matches), times 07:30–09:00 overlap Block 0 (07:30–09:00)
- Allison's agenda: Block 0 shows "At Kennedy — Band" instead of Advisory
- Advisory teacher: Allison appears in "Away today" section with "Kennedy Band"

**Tuesday, rotation B:**
- Advisory: meets
- Kennedy Band: does **not** meet (rotation B != 'A')
- Allison's agenda: Block 0 shows Advisory normally
- Advisory teacher: Allison on the active roster

### Example 2: Carlos — Kirkwood English (at Kirkwood campus)

**Setup:**
- Advisory: `regular_class`, **Block 3**, `days_of_week = [1,2,3,4,5]`, `requires_attendance = true`
- Kirkwood English: `college_course`, **block = NULL**, `days_of_week = [2,4]` (Tue/Thu), `default_start_time = '10:45'`, `default_end_time = '12:15'`, `requires_attendance = false`

Carlos goes to Kirkwood campus on Tue/Thu for English. Kirkwood English has no block — Carlos is off-campus, Kirkwood handles attendance.

**Monday:** Advisory meets, Kirkwood doesn't → Carlos on roster
**Tuesday:** Both meet, Kirkwood times overlap Block 3 → Carlos "away" from Advisory
**Wednesday:** Advisory only → Carlos on roster
**Thursday:** Same as Tuesday → Carlos "away"
**Friday:** Advisory only → Carlos on roster

### Example 3: Dana — Kirkwood Business (monitored at City View)

**Setup:**
- Kirkwood Business: `college_course`, **Block 2**, `days_of_week = [1,3,5]` (MWF), `requires_attendance = true`, `monitor_id = Trevor`

Dana takes a Kirkwood course but stays at City View (online or proctored). The course gets a Block 2 assignment because Trevor monitors Dana during Block 2. The one-per-block constraint ensures Dana can't also be enrolled in another Block 2 activity.

Trevor sees Dana on his Block 2 roster on MWF.

### Example 4: Prevented conflict

An admin tries to enroll a student in Chemistry (Block 2) when the student is already enrolled in Biology (Block 2).

**System behavior:**
- The `INSERT INTO enrollments` would violate `idx_enrollments_one_per_block`
- Application shows error: "This student already has Biology in Block 2. Unenroll them first."
- Admin either unenrolls from Biology or assigns Chemistry to a different block

This is a data entry error caught at entry time — not a runtime conflict to resolve.

---

## Edge Cases

**Release activities:**
An activity with `is_release = true` still has a block number (it blocks the slot). A student enrolled in a release activity cannot be enrolled in another activity at the same block. The release means "student is free during this block" — no attendance, no check-in. If the admin wants the student to do something else during that block instead, they unenroll from the release and enroll in the new activity.

**Student unexpectedly at City View (external class cancelled):**
If Kennedy's Band class is cancelled and Allison shows up at City View, the teacher can manually mark her present on the Advisory roster. Allison still appears in the "Away today" section — the teacher taps through to mark attendance. This is a manual override. See [03-attendance-rules.md](03-attendance-rules.md#edge-cases).

**Activity block changes after enrollment:**
If an admin changes an activity's block number, the application must update the denormalized `block` on all active enrollments for that activity. If any student already has an enrollment at the new block, the update should fail with a clear error identifying the conflicting student(s).

**Internship spanning multiple blocks:**
An internship during Blocks 4 and 5 (1:00 PM – 3:00 PM) currently occupies one block number on the activity. The student is enrolled at that block. If the internship truly spans two blocks, the admin creates two internship activities (one per block) or assigns it to the earlier block and relies on the time range to cover both. The one-per-block constraint applies per block, so two separate activities at Blocks 4 and 5 for the same student is fine — each block has exactly one enrollment.
