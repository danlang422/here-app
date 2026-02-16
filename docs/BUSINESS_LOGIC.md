# Here App - Business Logic Documentation
**Date**: February 2026  
**Status**: Design complete, ready for implementation

## Overview

This document defines the business rules, algorithms, and validation logic for the Here attendance tracking application. It bridges the gap between the database schema and user flows, explaining *how* the system makes decisions and enforces constraints.

---

## Table of Contents

1. [Schedule & Calendar Logic](#schedule--calendar-logic)
2. [Check-In Rules & Validation](#check-in-rules--validation)
3. [Status Update Rules](#status-update-rules)
4. [Presence Wave & Streak Calculation](#presence-wave--streak-calculation)
5. [Schedule Conflict Resolution](#schedule-conflict-resolution)
6. [Attendance Rules](#attendance-rules)
7. [Notification Triggers](#notification-triggers)
8. [Geofence Validation](#geofence-validation)
9. [Data Validation Rules](#data-validation-rules)
10. [Access Control Logic](#access-control-logic)

---

## Schedule & Calendar Logic

### Rotation Day Calculation

**Purpose:** Determine whether a given school day is an A day or B day based on organization settings.

**Algorithm:**

```
function calculateRotationDay(date, organization):
  if not organization.uses_rotation_schedule:
    return null
  
  // Check for explicit override in school_days table
  override = getSchoolDay(date, organization.id)
  if override and override.rotation_day:
    return override.rotation_day
  
  // Calculate based on pattern
  term = getCurrentTerm(organization.id)
  schoolDays = getSchoolDaysSince(term.start_date, date)
  
  if organization.rotation_mode == "continue":
    // Skip non-school days in count
    actualSchoolDays = schoolDays.filter(day => day.is_school_day)
  else: // "repeat"
    // Include cancelled days (they "repeat")
    actualSchoolDays = schoolDays
  
  rotationIndex = actualSchoolDays.length % organization.rotation_day_names.length
  return organization.rotation_day_names[rotationIndex]
```

**Example:**

Organization settings:
- `rotation_day_names`: ["A", "B"]
- `rotation_mode`: "continue"
- Term starts Monday, Jan 6 (A day)

Calendar:
- Mon Jan 6: A (day 0, index 0)
- Tue Jan 7: B (day 1, index 1)
- Wed Jan 8: A (day 2, index 0)
- Thu Jan 9: CANCELLED (weather)
- Fri Jan 10: B (day 3, index 1) ← continues rotation, skips cancelled day

If `rotation_mode` were "repeat":
- Fri Jan 10 would be A (repeats Thu's cancelled day)

### Block Schedule Resolution

**Purpose:** Get the actual start/end times for a block on a specific date.

**Algorithm:**

```
function getBlockTimes(block, date, organization):
  // Get schedule template for this date
  schoolDay = getSchoolDay(date, organization.id)
  
  if schoolDay and schoolDay.schedule_template_id:
    template = getScheduleTemplate(schoolDay.schedule_template_id)
  else:
    template = getDefaultScheduleTemplate(organization.id)
  
  // Find block definition
  blockDef = template.block_definitions.find(b => b.block == block)
  
  return {
    start: blockDef.start_time,
    end: blockDef.end_time
  }
```

**Use Cases:**
- Display schedule to students
- Determine when check-in becomes available
- Calculate session duration for reports

### Session Meets Today Logic

**Purpose:** Determine if a session occurs on a given date.

**Algorithm:**

```
function sessionMeetsToday(session, date):
  // Check date range
  if session.start_date and date < session.start_date:
    return false
  if session.end_date and date > session.end_date:
    return false
  
  // Check day of week
  dayName = getDayName(date) // "Mon", "Tue", etc.
  if dayName not in session.days_of_week:
    return false
  
  // Check if school day
  schoolDay = getSchoolDay(date, session.organization_id)
  if not schoolDay.is_school_day:
    return false
  
  // Check rotation
  if session.honors_rotation:
    rotationDay = calculateRotationDay(date, session.organization_id)
    if rotationDay != session.rotation_day_type:
      return false
  
  return true
```

**Examples:**
- Biology (M/W/F, A days only) on Monday A day: TRUE
- Biology on Monday B day: FALSE
- Biology on Tuesday A day: FALSE (not in days_of_week)

---

## Check-In Rules & Validation

### Check-In Availability Window

**Purpose:** Determine when students can check in to an activity.

**Rules:**
1. Check-in becomes available **10 minutes before** session start time
2. Check-in remains available **until midnight** of the session day
3. Only one check-in allowed per activity per day

**Algorithm:**

```
function canCheckIn(studentActivity, date):
  // Already checked in?
  existingCheckIn = getCheckIn(studentActivity.student_id, studentActivity.id, date)
  if existingCheckIn:
    return {allowed: false, reason: "Already checked in"}
  
  // Get session times
  blockTimes = getBlockTimes(studentActivity.block, date, studentActivity.organization_id)
  
  // Calculate availability window
  now = getCurrentTime()
  availableFrom = blockTimes.start - 10 minutes
  availableUntil = endOfDay(date) // midnight
  
  if now < availableFrom:
    return {allowed: false, reason: "Too early", availableAt: availableFrom}
  
  if now > availableUntil:
    return {allowed: false, reason: "Too late"}
  
  return {allowed: true, isLate: now > blockTimes.end}
```

**Late Check-In:**
- If student checks in after session end time, flag as `isLate`
- Display warning: "Late Check-In"
- Teacher sees orange indicator

### Check-Out Availability Window

**Purpose:** Determine when students can check out.

**Rules:**
1. Check-out becomes available at **session end time**
2. Check-out remains available **until midnight**
3. Can only check out if already checked in
4. Check-out is required for activities with `requires_checkin = true`

**Algorithm:**

```
function canCheckOut(studentActivity, date):
  // Must be checked in first
  checkIn = getCheckIn(studentActivity.student_id, studentActivity.id, date)
  if not checkIn:
    return {allowed: false, reason: "Not checked in"}
  
  // Already checked out?
  if checkIn.checked_out_at:
    return {allowed: false, reason: "Already checked out"}
  
  // Get session times
  blockTimes = getBlockTimes(studentActivity.block, date, studentActivity.organization_id)
  
  now = getCurrentTime()
  availableFrom = blockTimes.end
  availableUntil = endOfDay(date)
  
  if now < availableFrom:
    return {allowed: false, reason: "Session not over", availableAt: availableFrom}
  
  if now > availableUntil:
    return {allowed: false, reason: "Too late"}
  
  return {allowed: true, isLate: now > (blockTimes.end + 30 minutes)}
```

**Forgotten Check-Out:**
- If student doesn't check out by midnight, record remains incomplete
- Next day, teacher sees warning
- Student can still check out late (until midnight next day)
- Marked with "Late Check-Out" indicator

### Check-In Validation

**Rules enforced on check-in submission:**

```
function validateCheckIn(checkInData):
  errors = []
  
  // Required fields
  if not checkInData.checked_in_at:
    errors.push("Check-in timestamp required")
  
  // Geofence validation (if required)
  if studentActivity.requires_geofence:
    if not checkInData.check_in_location_lat or not checkInData.check_in_location_lng:
      errors.push("Location required for geofenced activity")
    else:
      isValid = validateGeofence(
        checkInData.check_in_location_lat,
        checkInData.check_in_location_lng,
        studentActivity
      )
      checkInData.geofence_validated = isValid
      
      if not isValid:
        // Allow check-in but flag it
        warnings.push("You're outside the expected area")
  
  // Status update (prompted during check-in flow)
  // Validation happens in status_updates (see below)
  
  if errors.length > 0:
    return {valid: false, errors: errors}
  
  return {valid: true, warnings: warnings}
```

---

## Status Update Rules

### Status Update Validation

**Purpose:** Ensure status updates meet requirements.

**Rules:**
1. Content must be 1-500 characters
2. Type must be one of: 'plans', 'progress', 'reflection'
3. Student can have multiple status updates per day per activity
4. During check-in: Plans type is pre-selected (but can be changed)
5. During check-out: Progress type is pre-selected (but can be changed)

**Algorithm:**

```
function validateStatusUpdate(statusData):
  errors = []
  
  // Required fields
  if not statusData.status_type:
    errors.push("Status type required")
  
  if statusData.status_type not in ['plans', 'progress', 'reflection']:
    errors.push("Invalid status type")
  
  if not statusData.content or statusData.content.trim().length == 0:
    errors.push("Status content required")
  
  if statusData.content.length > 500:
    errors.push("Status content too long (max 500 characters)")
  
  if statusData.content.length < 1:
    errors.push("Status content too short (min 1 character)")
  
  return {valid: errors.length == 0, errors: errors}
```

### Required Status During Check-In/Out

**Purpose:** Enforce status update during check-in/out flow.

**Implementation:**
- Check-in button click → creates check_in record → opens status modal
- Status modal cannot be cancelled during check-in/out flow
- Type is pre-selected but can be changed
- After status submitted: Modal closes, check-in complete

**Edge Case - Student Closes Modal:**
```
if checkInFlow and statusModal.cancelled:
  // Rollback check-in
  deleteCheckIn(checkInId)
  showError("Check-in cancelled - status update required")
```

### Status Update Timing

**When can students add status updates?**

```
function canAddStatus(studentActivity, date):
  // For activities with allows_status_updates = true
  if not studentActivity.allows_status_updates:
    return {allowed: false, reason: "Status updates not enabled"}
  
  // Get session times
  blockTimes = getBlockTimes(studentActivity.block, date)
  
  now = getCurrentTime()
  
  // Available from 10 min before session until end of day
  availableFrom = blockTimes.start - 10 minutes
  availableUntil = endOfDay(date)
  
  if now < availableFrom:
    return {allowed: false, reason: "Too early", availableAt: availableFrom}
  
  if now > availableUntil:
    return {allowed: false, reason: "Day has ended"}
  
  return {allowed: true}
```

**Multiple Updates:**
- No limit on number of status updates per day
- Each update creates new record with timestamp
- Display as timeline (chronological)

---

## Presence Wave & Streak Calculation

### Presence Wave Availability

**Purpose:** Determine when students can wave presence.

**Rules:**
1. Wave becomes available **10 minutes before** session start
2. Wave remains available **all day** (until midnight)
3. Only **one wave** per activity per day
4. Wave is optional (not required)

**Algorithm:**

```
function canWavePresence(studentActivity, date):
  // Already waved today?
  existingWave = getPresenceWave(studentActivity.student_id, studentActivity.id, date)
  if existingWave:
    return {allowed: false, reason: "Already waved today", wavedAt: existingWave.waved_at}
  
  // Check if activity allows presence waves
  if not studentActivity.allows_presence_wave:
    return {allowed: false, reason: "Presence waves not enabled"}
  
  // Get session times
  blockTimes = getBlockTimes(studentActivity.block, date)
  
  now = getCurrentTime()
  availableFrom = blockTimes.start - 10 minutes
  availableUntil = endOfDay(date)
  
  if now < availableFrom:
    return {allowed: false, reason: "Too early", availableAt: availableFrom}
  
  if now > availableUntil:
    return {allowed: false, reason: "Day has ended"}
  
  return {allowed: true}
```

### Streak Calculation

**Purpose:** Calculate consecutive school days with presence waves.

**Algorithm:**

```
function calculateStreak(studentId, activityId, asOfDate):
  streak = 0
  checkDate = asOfDate
  
  while true:
    // Is this a school day?
    schoolDay = getSchoolDay(checkDate, organizationId)
    if not schoolDay or not schoolDay.is_school_day:
      // Skip non-school days (don't break streak)
      checkDate = checkDate - 1 day
      continue
    
    // Did student wave on this school day?
    wave = getPresenceWave(studentId, activityId, checkDate)
    if not wave:
      // Streak broken
      break
    
    // Increment streak
    streak += 1
    checkDate = checkDate - 1 day
    
    // Safety limit (prevent infinite loop)
    if streak > 365:
      break
  
  return streak
```

**Important Notes:**
- Only school days count toward streak
- Weekends don't break streak
- Holidays don't break streak
- Missing a school day breaks streak
- Streak resets to 0 when broken
- New streak starts at 1 on next wave

**Example:**

```
Week 1:
Mon (school): Waved ✓ → streak = 1
Tue (school): Waved ✓ → streak = 2
Wed (school): Waved ✓ → streak = 3
Thu (school): No wave ✗ → streak = 0
Fri (school): Waved ✓ → streak = 1

Weekend (not school): Doesn't affect streak

Week 2:
Mon (school): Waved ✓ → streak = 2
Tue (school): Waved ✓ → streak = 3
```

### Streak Display Logic

**When to show streak:**

```
function getStreakDisplay(studentId, activityId, date):
  currentStreak = calculateStreak(studentId, activityId, date)
  wavedToday = hasWavedToday(studentId, activityId, date)
  
  if currentStreak == 0 and not wavedToday:
    return null // Don't show anything
  
  if currentStreak > 0 and not wavedToday:
    return {
      icon: "🔥",
      text: `${currentStreak} day streak - wave today to keep it!`,
      type: "prompt"
    }
  
  if wavedToday:
    newStreak = currentStreak + 1
    return {
      icon: "🔥",
      text: `${newStreak} day streak!`,
      type: "celebration"
    }
```

---

## Schedule Conflict Resolution

### How Conflicts Arise

Conflicts occur when a student has multiple activities assigned to the same block on the same day. The most common scenario at City View is shared students who attend classes at their home high school (Kennedy, Washington, Jefferson) on certain rotation days while being enrolled in a City View session (usually Advisory) for the same block every day.

**Key insight:** City View itself does NOT use A/B rotation. The district calendar's A/B rotation only matters because external schools follow it, which determines when shared students are pulled away.

### The Priority Model

Conflicts are resolved at **query time** using the `conflict_priority` field on `student_activities`. There is no separate overrides table. The student remains enrolled in all their sessions, and the system simply determines which activity "wins" on any given day.

**Priority scale (suggested defaults):**
- External school class (Kennedy Band, etc.): **10**
- Kirkwood community college course: **10**
- City View core class: **5**
- Monitoring / independent work: **0**

Higher number wins. When two activities share the same block on the same day, the one with the higher `conflict_priority` takes precedence.

### Activity Applicability Check

**Purpose:** Determine if a student_activity is active on a given date.

**Algorithm:**

```
function isActivityActiveOnDate(activity, date, rotationDay):
  // Check date range
  if activity.start_date and date < activity.start_date:
    return false
  if activity.end_date and date > activity.end_date:
    return false
  
  // Check day of week
  dayName = getDayName(date) // "Mon", "Tue", etc.
  if dayName not in activity.days_of_week:
    return false
  
  // Check rotation constraint
  if activity.rotation_day_type is not null:
    if rotationDay != activity.rotation_day_type:
      return false
  
  // Check active flag
  if not activity.is_active:
    return false
  
  return true
```

### Getting Effective Times

**Purpose:** Resolve an activity's actual start/end time for a given date.

**Algorithm:**

```
function getEffectiveTimes(activity, date, organization):
  if activity.session_id is not null:
    // Session-linked: get times from today's schedule template
    session = getSession(activity.session_id)
    template = getScheduleTemplateForDate(date, organization)
    blockDef = template.block_definitions.find(b => b.block == session.block)
    return { start: blockDef.start_time, end: blockDef.end_time }
  else:
    // Non-session: use the activity's own fixed times
    return { start: activity.default_start_time, end: activity.default_end_time }
```

**Key distinction:**
- Session-linked activity times shift with schedule changes (2-hour delay, early dismissal)
- Non-session activity times (external classes, internships) are fixed — Kennedy Band is 7:30-9:00 regardless of City View's schedule

### Time Overlap Check

**Purpose:** Determine if two time ranges overlap.

```
function timesOverlap(startA, endA, startB, endB):
  return startA < endB AND startB < endA
```

### Conflict Resolution

**Purpose:** For a given student and date, determine which activities to show at each time slot.

Conflicts are detected by **time overlap**, not by block number. This correctly handles activities that span multiple blocks, activities with no block assignment (like lunch), and schedule template changes that shift block times.

**Algorithm:**

```
function resolveStudentSchedule(studentId, date):
  rotationDay = calculateRotationDay(date, organization)
  
  // Get all active items for today
  // 1. Session enrollments (get times from schedule template)
  // 2. Student activities (session-linked get template times, others use own times)
  allItems = getAllScheduleItemsForDate(studentId, date, rotationDay)
  
  // For each item, resolve effective times
  for item in allItems:
    times = getEffectiveTimes(item, date, organization)
    item.effective_start = times.start
    item.effective_end = times.end
  
  // Find all overlapping pairs
  conflicts = []
  for i in range(allItems.length):
    for j in range(i+1, allItems.length):
      if timesOverlap(allItems[i].effective_start, allItems[i].effective_end,
                       allItems[j].effective_start, allItems[j].effective_end):
        conflicts.push([allItems[i], allItems[j]])
  
  // Resolve each conflict by priority
  hiddenItems = new Set()
  unresolvedConflicts = []
  
  for [itemA, itemB] in conflicts:
    if itemA.conflict_priority == itemB.conflict_priority:
      unresolvedConflicts.push([itemA, itemB])
    else if itemA.conflict_priority > itemB.conflict_priority:
      hiddenItems.add(itemB)
    else:
      hiddenItems.add(itemA)
  
  return {
    visible: allItems.filter(i => !hiddenItems.has(i)),
    hidden: Array.from(hiddenItems),
    unresolved: unresolvedConflicts
  }
```

### Teacher Roster Filtering

**Purpose:** Build a session's roster for a given day, hiding students who are pulled away by higher-priority activities.

**Algorithm:**

```
function getSessionRosterForDate(sessionId, date):
  session = getSession(sessionId)
  rotationDay = calculateRotationDay(date, session.organization_id)
  dayName = getDayName(date)
  
  // Get the session's actual times from today's schedule template
  sessionTimes = getEffectiveTimes({ session_id: sessionId }, date, organization)
  
  // Get all active enrollments
  enrollments = getActiveEnrollments(sessionId)
  
  roster = []
  awayStudents = []
  
  for enrollment in enrollments:
    studentId = enrollment.student_id
    
    // Find non-session activities that overlap this session's time and have higher priority
    conflictingActivities = getStudentActivities(studentId)
      .filter(a => a.session_id is null)  // only non-session activities conflict
      .filter(a => isActivityActiveOnDate(a, date, rotationDay))
      .filter(a => timesOverlap(
        a.default_start_time, a.default_end_time,
        sessionTimes.start, sessionTimes.end
      ))
      .filter(a => a.conflict_priority > session.conflict_priority)
      .sort((a, b) => b.conflict_priority - a.conflict_priority)
    
    if conflictingActivities.length > 0:
      winner = conflictingActivities[0]
      awayStudents.push({
        student: enrollment.student,
        reason: winner.custom_name or winner.activity_type.name,
        activity: winner
      })
    else:
      roster.push(enrollment.student)
  
  return { present: roster, away: awayStudents }
```

### Examples

**Example 1: Allison has Advisory (M-F) and Kennedy Band (A days)**

- Advisory enrollment exists (Block 0, M-F, priority effectively 0-5)
- Kennedy Band student_activity exists (Block 0, M-F, `rotation_day_type = 'A'`, `conflict_priority = 10`)

On an **A day Monday:**
- Advisory: active (M-F, no rotation constraint)
- Kennedy Band: active (Mon in days_of_week, rotation_day = 'A' matches)
- Band priority (10) > Advisory priority (0-5) → Band wins
- Allison hidden from Advisory roster, teacher sees "At Kennedy Band"

On a **B day Tuesday:**
- Advisory: active
- Kennedy Band: NOT active (rotation_day_type = 'A', but today is B) → filtered out
- Only Advisory remains → Allison shows on roster normally

**Example 2: Carlos has Advisory (M-F) and Kirkwood English (Tue/Thu)**

- Advisory enrollment exists (Block 3, M-F)
- Kirkwood English student_activity exists (Block 3, `days_of_week = ['Tue', 'Thu']`, `rotation_day_type = null`, `conflict_priority = 10`)

On **Monday:** Only Advisory active → Carlos on roster
On **Tuesday:** Both active, Kirkwood (10) > Advisory → Carlos hidden, "At Kirkwood English"
On **Wednesday:** Only Advisory active → Carlos on roster
On **Thursday:** Both active, Kirkwood wins → Carlos hidden
On **Friday:** Only Advisory active → Carlos on roster

**Example 3: Equal priority (admin needs to fix)**

- Student has two City View activities in Block 2, both priority 5
- System flags as unresolved conflict
- Admin dashboard shows warning
- Both activities appear on student's schedule with conflict indicator until resolved

---

## Attendance Rules

### Attendance Status Transitions

**Valid state transitions:**

```
null → present
null → absent
null → excused
null → tardy

present → absent (student left early)
present → tardy (correction)
absent → present (correction)
absent → excused (got excuse note)
tardy → present (not actually late)
excused → present (no longer excused)

Any status → Any other status (teacher can always correct)
```

**Business Rules:**
- Teacher can change attendance after marking
- Updates create audit_log entry
- Student sees current status only (not history of changes)
- Admin can see full history via audit_log

### Attendance Marking Requirements

**Purpose:** Define when attendance can/must be marked.

**Rules:**
1. One attendance record per student per session per day
2. Teacher can only mark attendance for their own sessions
3. Attendance can be marked anytime during or after session
4. Late attendance marking is allowed (with indicator)

**Algorithm:**

```
function canMarkAttendance(teacherId, sessionId, studentId, date):
  // Check teacher owns session
  session = getSession(sessionId)
  if session.teacher_id != teacherId:
    return {allowed: false, reason: "Not your session"}
  
  // Check student is enrolled
  enrollment = getEnrollment(studentId, sessionId)
  if not enrollment or not enrollment.is_active:
    return {allowed: false, reason: "Student not enrolled"}
  
  // Check session meets today
  if not sessionMeetsToday(session, date):
    return {allowed: false, reason: "Session doesn't meet today"}
  
  // Check if student is pulled away by a higher-priority activity
  sessionTimes = getEffectiveTimes({ session_id: sessionId }, date, organization)
  conflicting = getStudentActivities(studentId)
    .filter(a => a.session_id is null and isActivityActiveOnDate(a, date, rotationDay))
    .filter(a => timesOverlap(a.default_start_time, a.default_end_time,
                               sessionTimes.start, sessionTimes.end))
    .filter(a => a.conflict_priority > session.conflict_priority)
    .sort((a, b) => b.conflict_priority - a.conflict_priority)
    [0] // highest priority conflicting activity, or undefined
  
  if conflicting:
    return {
      allowed: false,
      reason: "Student off-campus today",
      details: conflicting.custom_name or conflicting.activity_type.name
    }
  
  // Already marked?
  existing = getAttendanceRecord(studentId, sessionId, date)
  if existing:
    return {
      allowed: true,
      isUpdate: true,
      currentStatus: existing.status
    }
  
  return {allowed: true, isUpdate: false}
```

### Bulk Attendance Rules

**Purpose:** Define how "Mark All Present" works.

**Rules:**
1. Only applies to currently visible students (present roster, not away students)
2. Skips students pulled away by higher-priority activities (off-campus)
3. Skips students already marked
4. Creates individual attendance_record for each student

**Algorithm:**

```
function markAllPresent(sessionId, date, teacherId):
  students = getSessionRoster(sessionId, date)
  results = {marked: [], skipped: [], errors: []}
  
  for student in students:
    // Check if can mark
    canMark = canMarkAttendance(teacherId, sessionId, student.id, date)
    
    if not canMark.allowed:
      results.skipped.push({
        studentId: student.id,
        reason: canMark.reason
      })
      continue
    
    // Check if already marked
    if canMark.isUpdate and canMark.currentStatus == "present":
      results.skipped.push({
        studentId: student.id,
        reason: "Already marked present"
      })
      continue
    
    // Mark present
    try:
      createOrUpdateAttendance(studentId, sessionId, date, "present", teacherId)
      results.marked.push(student.id)
    catch error:
      results.errors.push({
        studentId: student.id,
        error: error.message
      })
  
  return results
```

---

## Notification Triggers

### Notification Creation Rules

**Purpose:** Define when notifications are created.

**Triggers:**

#### 1. Teacher Comments on Status Update
```
on createInteraction where related_status_update_id is not null:
  statusUpdate = getStatusUpdate(related_status_update_id)
  createNotification({
    user_id: statusUpdate.student_id,
    type: 'teacher_comment',
    related_interaction_id: interaction.id,
    message: `${teacher.name} commented on your ${statusUpdate.status_type}`
  })
```

#### 2. Student Checks In Late
```
on createCheckIn where isLate = true:
  session = getSession(studentActivity.session_id)
  createNotification({
    user_id: session.teacher_id,
    type: 'checkin_reminder',
    related_checkin_id: checkIn.id,
    message: `${student.name} checked in late to ${activity.name}`
  })
```

#### 3. Student Forgets to Check Out
```
scheduled job at midnight:
  incompleteCheckIns = getCheckInsWithoutCheckOut(today)
  
  for checkIn in incompleteCheckIns:
    // Notify student
    createNotification({
      user_id: checkIn.student_id,
      type: 'checkin_reminder',
      related_checkin_id: checkIn.id,
      message: `You forgot to check out of ${activity.name}`
    })
```

#### 4. Schedule Change
```
on updateSchoolDay where schedule_template_id changed:
  affectedSessions = getSessionsOnDate(schoolDay.date)
  affectedStudents = getStudentsInSessions(affectedSessions)
  
  for student in affectedStudents:
    createNotification({
      user_id: student.id,
      type: 'schedule_change',
      message: `Schedule changed to ${template.name} for ${date}`
    })
```

#### 5. Attendance Marked
```
on createAttendanceRecord:
  createNotification({
    user_id: attendanceRecord.student_id,
    type: 'attendance_marked',
    related_attendance_id: attendanceRecord.id,
    message: `${teacher.name} marked you ${status} in ${session.name}`
  })
```

#### 6. Student Posts Status Update
```
on createStatusUpdate:
  studentActivity = getStudentActivity(statusUpdate.student_activity_id)
  if studentActivity.session_id:
    session = getSession(studentActivity.session_id)
    createNotification({
      user_id: session.teacher_id,
      type: 'teacher_comment', // reusing type
      related_status_update_id: statusUpdate.id,
      message: `${student.name} posted a ${statusUpdate.status_type} update`
    })
```

### Notification Deduplication

**Purpose:** Prevent notification spam.

**Rules:**
1. Don't notify for rapid updates (< 5 min apart) from same student
2. Batch multiple status updates into single notification
3. User can configure notification preferences

**Algorithm:**

```
function shouldCreateNotification(notificationData):
  // Check recent notifications
  recentNotifications = getNotifications({
    user_id: notificationData.user_id,
    type: notificationData.type,
    created_at: > (now - 5 minutes)
  })
  
  if recentNotifications.length > 0:
    // Similar notification recently sent
    if notificationData.type == 'teacher_comment':
      // Batch these - don't send another
      return false
  
  // Check user preferences
  userPrefs = getUserNotificationPreferences(notificationData.user_id)
  if not userPrefs.enabled_types.includes(notificationData.type):
    return false
  
  return true
```

---

## Geofence Validation

### Distance Calculation

**Purpose:** Determine if student is within geofence radius.

**Algorithm (Haversine Formula):**

```
function validateGeofence(studentLat, studentLng, studentActivity):
  // Get expected location
  if studentActivity.internship_opportunity_id:
    opportunity = getInternshipOpportunity(studentActivity.internship_opportunity_id)
    expectedLat = opportunity.location_lat
    expectedLng = opportunity.location_lng
    radius = opportunity.geofence_radius
  else:
    expectedLat = studentActivity.custom_location_lat
    expectedLng = studentActivity.custom_location_lng
    radius = studentActivity.custom_geofence_radius
  
  // Calculate distance using Haversine formula
  distance = haversineDistance(studentLat, studentLng, expectedLat, expectedLng)
  
  isValid = distance <= radius
  
  return {
    valid: isValid,
    distance: distance,
    radius: radius,
    expectedLocation: {lat: expectedLat, lng: expectedLng},
    studentLocation: {lat: studentLat, lng: studentLng}
  }

function haversineDistance(lat1, lon1, lat2, lon2):
  R = 6371000  // Earth radius in meters
  
  φ1 = lat1 * π/180
  φ2 = lat2 * π/180
  Δφ = (lat2 - lat1) * π/180
  Δλ = (lon2 - lon1) * π/180
  
  a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
  c = 2 * atan2(√a, √(1−a))
  
  distance = R * c
  return distance  // in meters
```

### Geofence Validation Rules

**When to validate:**
- Only when `requires_geofence = true`
- Only during check-in (not check-out)
- Only if location permission granted

**Handling failures:**
```
if geofenceValidation.valid == false:
  // Allow check-in anyway
  checkIn.geofence_validated = false
  
  // Warn student
  showWarning("You're outside the expected area. Check in anyway?")
  
  // Flag for teacher
  flagForTeacherReview(checkIn.id)
  
  // Log distance for review
  logGeofenceFailure({
    checkInId: checkIn.id,
    distance: geofenceValidation.distance,
    expectedRadius: geofenceValidation.radius
  })
```

**Teacher Review:**
- Teacher sees map with expected location (blue circle) and student location (red pin)
- Can dismiss warning (one-time)
- Can update expected location (if student is at correct alternate location)
- Can message student to ask for clarification

---

## Data Validation Rules

### Character Limits

| Field | Min | Max | Notes |
|-------|-----|-----|-------|
| status_update.content | 1 | 500 | Required during check-in/out |
| interaction.content_text | 1 | 1000 | Teacher comments |
| attendance_record.notes | 0 | 500 | Optional |
| student_activities.custom_name | 0 | 200 | Optional |
| presence_waves | N/A | N/A | No text content |

### Email Validation

```
function validateEmail(email):
  pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return pattern.test(email)
```

### Date Range Validation

```
function validateDateRange(startDate, endDate):
  if endDate <= startDate:
    return {valid: false, error: "End date must be after start date"}
  
  // Check maximum range (e.g., 1 year for sessions)
  daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24)
  if daysDiff > 365:
    return {valid: false, error: "Date range cannot exceed 1 year"}
  
  return {valid: true}
```

### Block Validation

```
function validateBlock(block):
  if block is null:
    return {valid: true} // block is optional on student_activities
  if block < 0 or block > 5:
    return {valid: false, error: "Block must be 0-5"}
  return {valid: true}
```

---

## Access Control Logic

### Role-Based Permissions

**Student Permissions:**
```
Students can:
- Read: Own enrollments, activities, check-ins, status updates, attendance records
- Create: Own check-ins, status updates, presence waves
- Update: Own check-ins (check-out only)
- Delete: None (soft deletes only via admin)

Students cannot:
- View other students' data
- Mark attendance
- Create/edit sessions
- Modify enrollments
```

**Teacher Permissions:**
```
Teachers can:
- Read: All sessions, enrollments, activities, check-ins, attendance (in their org)
- Create: Attendance records, interactions (comments/reactions)
- Update: Attendance records (own sessions only), interactions (own only)
- Delete: None (soft deletes only via admin)

Teachers cannot:
- Edit student check-ins or status updates
- Create/edit sessions (unless also admin)
- Modify enrollments (unless also admin)
```

**Admin Permissions:**
```
Admins can:
- Full CRUD on: sessions, enrollments, student_activities, users
- Read: All data in organization
- Create: organization data (terms, templates, school days)
- Update: All organization settings
- Delete: Soft delete any record (hard delete requires DB access)

Admins cannot:
- Access data from other organizations
- Modify student check-ins or status updates
- Delete attendance history (audit requirement)
```

### Multi-Role Users

**Logic for users with multiple roles:**

```
function getEffectivePermissions(userId):
  user = getUser(userId)
  permissions = new Set()
  
  for role in user.roles:
    permissions.add(getRolePermissions(role))
  
  // Union of all role permissions
  return permissions

function canPerformAction(userId, action, resource):
  permissions = getEffectivePermissions(userId)
  
  required = getRequiredPermission(action, resource)
  
  return permissions.includes(required)
```

**Example:**
- User has roles: ['teacher', 'admin']
- Permissions: teacher permissions ∪ admin permissions
- Can do anything a teacher can do AND anything an admin can do
- UI shows role switcher if multi-role

### Data Isolation by Organization

**All queries filtered by organization:**

```
function getDataForUser(userId, dataType):
  user = getUser(userId)
  orgId = user.organization_id
  
  // All queries include organization filter
  data = query(dataType).where({organization_id: orgId})
  
  return data
```

**Row Level Security enforces this at database level.**

---

## Edge Cases & Special Scenarios

### Student Switches Activities Mid-Session

**Scenario:** Student starts in Independent Study, switches to Project Work halfway through.

**Handling:**
1. Original check-in remains valid
2. Status updates can reference either activity
3. Teacher sees student in both rosters (with note about switch)
4. Attendance marked for primary activity (where most time spent)

### Multiple Sessions Same Block

**Scenario:** Student enrolled in both Biology and Chemistry at Block 2 (shouldn't happen, but possible).

**Handling:**
1. Conflict detection flags this (equal priority = unresolved)
2. Admin sets `conflict_priority` on activities to differentiate
3. Until resolved, both show with conflict indicator
4. Teacher of lower-priority session sees grayed-out student with reason

### Late Semester Enrollment

**Scenario:** Student added to session on March 1, but session started January 15.

**Handling:**
1. Enrollment has `enrolled_at` timestamp
2. Queries filter: `session.start_date <= date AND enrollment.enrolled_at <= date`
3. Student doesn't appear on roster before enrollment date
4. Attendance records only valid from enrollment date forward

### Session Cancelled Mid-Day

**Scenario:** Fire drill causes early dismissal, session cancelled.

**Handling:**
1. Admin updates `school_day` record with override_reason
2. Notifications sent to affected students/teachers
3. Check-ins already submitted remain valid
4. Check-out becomes optional (not required)
5. Attendance can still be marked (teacher discretion)

---

## Performance Considerations

### Query Optimization

**Expensive queries to optimize:**

1. **Student schedule for day:**
```
// Bad: Multiple queries
for each block 0-5:
  getEnrollments(studentId, block)
  getActivities(studentId, block)

// Good: Single query with joins
getFullSchedule(studentId, date)
  JOIN enrollments
  JOIN student_activities
  WHERE date matches and block matches
```

2. **Teacher roster with check-ins:**
```
// Bad: N+1 query problem
students = getSessionRoster(sessionId)
for each student:
  checkIn = getCheckIn(student.id, date)

// Good: Single query with LEFT JOIN
getSessionRosterWithCheckIns(sessionId, date)
  LEFT JOIN check_ins
```

3. **Streak calculation:**
```
// Bad: Query per day going backwards
checkDate = today
while true:
  wave = getPresenceWave(studentId, activityId, checkDate)
  ...

// Good: Single query with date range
waves = getPresenceWaves(studentId, activityId, dateRange)
// Calculate in application
```

### Caching Strategy

**What to cache:**
- Schedule templates (rarely change)
- School days calendar (pre-compute for term)
- Rotation day calculations (memoize for date)
- User roles (cache until user update)

**What NOT to cache:**
- Check-in status (real-time)
- Attendance records (need immediate consistency)
- Status updates (real-time)
- Notifications (real-time)

---

## Testing Scenarios

### Critical Paths to Test

1. **Full check-in flow:**
   - Student checks in → location validated → status update required → check out → status update required

2. **Presence wave with streak:**
   - Wave on consecutive days → verify streak increments
   - Miss a day → verify streak resets
   - Wave on weekend → verify rejected

3. **Schedule conflict:**
   - Two activities same block → conflict detected
   - Set priority → higher priority shown
   - Override for specific day → override applies

4. **Geofence validation:**
   - Inside radius → validated
   - Outside radius → flag but allow
   - No location permission → skip validation

5. **Attendance marking:**
   - Mark all present → skips off-campus students
   - Change status → audit log created
   - Late marking → flagged appropriately

---

**End of Business Logic Documentation**

*This document should be updated as new rules are implemented or edge cases discovered.*
