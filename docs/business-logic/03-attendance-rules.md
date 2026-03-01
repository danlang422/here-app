# Attendance Rules

## Overview

Attendance is teacher-marked and applies to activities where `requires_attendance = true` on the `activities` table. This covers regular classes, college courses (when a City View teacher is monitoring), freeform blocks, online courses, and internships. External HS courses have `requires_attendance = false` — the other school handles their own attendance in the shared SIS.

Each attendance record references an `activity_instance_id` (the lazy-created instance for an activity on a specific date). One record per student per instance, enforced by `UNIQUE(activity_instance_id, student_id)`.

---

## Attendance Statuses

```sql
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused', 'tardy');
```

**Status definitions:**
- **present** — Student is or was at the activity
- **absent** — Student did not attend (unexcused)
- **excused** — Student absent with valid excuse
- **tardy** — Student arrived late

---

## Status Transitions

Teachers can change attendance status at any time — all transitions are valid. There is no restricted transition matrix. A correction from `absent` to `present` is just as valid as an initial marking.

```
null → present | absent | excused | tardy   (initial marking)
present → absent | excused | tardy           (correction)
absent → present | excused | tardy           (correction / excuse received)
excused → present | absent | tardy           (correction)
tardy → present | absent | excused           (correction)
```

Every status change is recorded in the `audit_log` table with the old value, new value, and who made the change. Students see only the current status — the change history is visible to admins via the audit log.

---

## Who Can Mark Attendance

**Algorithm:**

```
function canMarkAttendance(teacher, activity, student, date, organizationId):
  // Teacher must own or monitor the activity
  if activity.teacher_id != teacher.id and activity.monitor_id != teacher.id:
    return { allowed: false, reason: "Not your activity" }

  // Activity must require attendance
  if not activity.requires_attendance:
    return { allowed: false, reason: "Attendance not required for this activity" }

  // Activity must meet today
  if not activityMeetsToday(activity, date, organizationId):
    return { allowed: false, reason: "Activity doesn't meet today" }

  // Student must be enrolled
  enrollment = getActiveEnrollment(student.id, activity.id)
  if not enrollment:
    return { allowed: false, reason: "Student not enrolled" }

  // Get or create instance
  instance = getOrCreateInstance(activity.id, date, organizationId)

  // Check if already marked (update is allowed)
  existing = getAttendanceRecord(student.id, instance.id)
  if existing:
    return { allowed: true, isUpdate: true, currentStatus: existing.status, instanceId: instance.id }

  return { allowed: true, isUpdate: false, instanceId: instance.id }
```

**Key points:**
- Both `teacher_id` and `monitor_id` can mark attendance — monitors are City View staff supervising without ownership
- Admins can mark attendance on any activity in their organization (enforced by RLS, not this function)
- Attendance can be marked at any time during or after the activity — there is no cutoff
- Late marking is flagged with a timestamp comparison but never blocked

---

## Bulk Attendance: Mark All Present

**Purpose:** Let a teacher mark all visible students as "present" with one action.

**Rules:**
1. Only applies to enrolled students whose enrollment is active
2. Skips students already marked present (does not overwrite other statuses)
4. Creates individual `attendance_records` for each student

**Algorithm:**

```
function markAllPresent(activity, date, teacher, organizationId):
  instance = getOrCreateInstance(activity.id, date, organizationId)

  // Get all enrolled students for this activity
  enrollments = getActiveEnrollments(activityId: activity.id)

  results = { marked: [], skipped: [], errors: [] }

  for enrollment in enrollments:
    student = getStudent(enrollment.student_id)
    existing = getAttendanceRecord(student.id, instance.id)

    if existing and existing.status == 'present':
      results.skipped.push({ studentId: student.id, reason: "Already marked present" })
      continue

    if existing:
      // Has a different status — don't overwrite (teacher should manually change)
      results.skipped.push({ studentId: student.id, reason: "Already marked: " + existing.status })
      continue

    try:
      createAttendanceRecord({
        activity_instance_id: instance.id,
        student_id: student.id,
        status: 'present',
        marked_by_id: teacher.id
      })
      results.marked.push(student.id)
    catch error:
      results.errors.push({ studentId: student.id, error: error.message })

  return results
```

**UX note:** After "Mark All Present," the teacher can individually adjust any student (mark someone tardy, absent, etc.). The bulk action is a starting point, not final.

---

## Teacher Roster and Attendance View

The teacher's attendance view for a block on a given date shows all enrolled students for activities they own or monitor that meet today. Each row shows the student name, their activity (relevant when the teacher owns/monitors multiple activities in the same block), and attendance status.

Because scheduling overlaps are prevented at enrollment time, every student on the roster belongs there — there is no "away" filtering or priority-based hiding. A teacher who monitors multiple activities in the same block (e.g., different students doing internships, online courses, or Kirkwood classes) sees all students grouped by activity.

The roster query is documented in `schema/09-queries.md`.

---

## Late Marking

There is no hard deadline for marking attendance. However, the UI indicates when attendance is being marked late:

```
function getAttendanceTimingIndicator(activity, date, organizationId):
  times = getActivityEffectiveTimes(activity, date, organizationId)
  now = getCurrentTime()

  if now < times.start:
    return "early"      // Before activity starts
  if now <= times.end:
    return "on-time"    // During activity
  if sameDay(now, date):
    return "after-hours" // Same day, after activity ended
  else:
    return "late"        // Different day entirely — show warning indicator
```

Late-marked attendance still counts and is recorded normally. The `marked_at` timestamp on the `attendance_records` table captures exactly when the marking happened, which can be reviewed in reports.

---

## Edge Cases

**Late-semester enrollment:**
A student added mid-semester only appears on rosters from their `enrollment.enrolled_at` date forward. Attendance records are only valid from that date — the system does not backfill attendance for dates before enrollment.

**Activity cancelled mid-day:**
If an admin marks an `activity_instance` as `cancelled = true` (e.g., fire drill, field trip), attendance for that instance becomes optional. Existing records remain valid. The teacher can still mark attendance at their discretion.

**Student shows up unexpectedly:**
If a student who should be at an external school shows up at City View (e.g., the external class was cancelled), they won't appear on any City View teacher's roster for that block since they're not enrolled in a City View activity for that time. The teacher can manually create an attendance record if desired. This is a rare situation best handled with teacher judgment rather than automated logic.
