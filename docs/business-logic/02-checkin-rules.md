# Check-In Rules & Validation

## Overview

Check-in/out applies to activities where `requires_checkin = true` on the `activities` table. This includes internships, online courses (monitored during freeform blocks), and freeform blocks. Regular classes and external HS courses use teacher-marked attendance instead.

All check-in records reference an `activity_instance_id` — never `activity_id + date` directly. The instance is lazily created on first interaction (see [01-schedule-and-calendar.md](01-schedule-and-calendar.md#activity-instance-creation)).

---

## Check-In Availability

**Purpose:** Determine when a student can check in to an activity.

**Rules:**
1. Check-in becomes available **10 minutes before** the activity's start time
2. Check-in remains available **until midnight** of that day
3. Only **one check-in** per student per activity instance (enforced by `UNIQUE(student_id, activity_instance_id)`)
4. Activity must have `requires_checkin = true`
5. Student must be enrolled (active enrollment in `enrollments` table)
6. Activity must meet today (see `activityMeetsToday()`)

**Algorithm:**

```
function canCheckIn(student, activity, date, organizationId):
  // Activity must require check-in
  if not activity.requires_checkin:
    return { allowed: false, reason: "Check-in not required for this activity" }

  // Activity must meet today
  if not activityMeetsToday(activity, date, organizationId):
    return { allowed: false, reason: "Activity doesn't meet today" }

  // Student must be enrolled
  enrollment = getActiveEnrollment(student.id, activity.id)
  if not enrollment:
    return { allowed: false, reason: "Not enrolled" }

  // Get or create instance
  instance = getOrCreateInstance(activity.id, date, organizationId)

  // Already checked in?
  existingCheckIn = getCheckIn(student.id, instance.id)
  if existingCheckIn:
    return { allowed: false, reason: "Already checked in", checkIn: existingCheckIn }

  // Check time window
  times = getActivityEffectiveTimes(activity, date, organizationId)
  now = getCurrentTime()
  availableFrom = times.start - 10 minutes
  availableUntil = endOfDay(date)  // midnight

  if now < availableFrom:
    return { allowed: false, reason: "Too early", availableAt: availableFrom }

  if now > availableUntil:
    return { allowed: false, reason: "Day has ended" }

  return { allowed: true, instanceId: instance.id, isLate: now > times.end }
```

**Late check-in:** If a student checks in after the activity's end time, the check-in is allowed but flagged. The teacher sees an orange "Late" indicator on the student's check-in row.

---

## Check-Out Availability

**Purpose:** Determine when a student can check out.

**Rules:**
1. Check-out becomes available at the **activity's end time**
2. Check-out remains available **until midnight**
3. Student must already be checked in (and not yet checked out)
4. Enforced by `CHECK(checked_out_at IS NULL OR checked_out_at > checked_in_at)` in schema

**Algorithm:**

```
function canCheckOut(student, activity, date, organizationId):
  // Must be checked in first
  instance = getActivityInstance(activity.id, date)
  if not instance:
    return { allowed: false, reason: "No instance exists" }

  checkIn = getCheckIn(student.id, instance.id)
  if not checkIn:
    return { allowed: false, reason: "Not checked in" }

  // Already checked out?
  if checkIn.checked_out_at:
    return { allowed: false, reason: "Already checked out" }

  // Check time window
  times = getActivityEffectiveTimes(activity, date, organizationId)
  now = getCurrentTime()
  availableFrom = times.end
  availableUntil = endOfDay(date)

  if now < availableFrom:
    return { allowed: false, reason: "Activity not over", availableAt: availableFrom }

  if now > availableUntil:
    return { allowed: false, reason: "Day has ended" }

  return { allowed: true, isLate: now > (times.end + 30 minutes) }
```

**Forgotten check-out:**
- If a student doesn't check out by midnight, the `checked_out_at` field remains NULL
- A scheduled job at midnight finds all incomplete check-ins for the day and creates `checkin_reminder` notifications for the affected students
- The teacher sees a "No check-out" indicator on the next day's view
- The student can still check out late (the check-out window extends until midnight of the **check-in day** only — after that, the record stays incomplete)

---

## Check-In Validation

**Purpose:** Validate check-in data on submission.

**Algorithm:**

```
function validateCheckIn(data, activity):
  errors = []
  warnings = []

  // Timestamp is required
  if not data.checked_in_at:
    errors.push("Check-in timestamp required")

  // Geofence validation (only when activity.requires_geofence = true)
  if activity.requires_geofence:
    if not data.check_in_location_lat or not data.check_in_location_lng:
      errors.push("Location required for geofenced activity")
    else:
      geoResult = validateGeofence(
        data.check_in_location_lat,
        data.check_in_location_lng,
        activity
      )
      data.geofence_validated = geoResult.valid

      if not geoResult.valid:
        // Allow check-in but flag it — don't block
        warnings.push("You're outside the expected area")

  if errors.length > 0:
    return { valid: false, errors }

  return { valid: true, warnings }
```

---

## Geofence Validation

**Purpose:** Determine if a student is within the expected radius of an activity's location.

Geofence applies only to activities with `requires_geofence = true`. Location coordinates and radius are stored directly on the `activities` table (`location_lat`, `location_lng`, `geofence_radius`). For internships, these are copied from `internship_opportunities` at activity creation time — they are not synced, so updating the opportunity record does not change existing activities.

**Algorithm (Haversine formula):**

```
function validateGeofence(studentLat, studentLng, activity):
  expectedLat = activity.location_lat
  expectedLng = activity.location_lng
  radius = activity.geofence_radius  // meters, default 100

  distance = haversineDistance(studentLat, studentLng, expectedLat, expectedLng)
  isValid = distance <= radius

  return {
    valid: isValid,
    distance: distance,
    radius: radius,
    expectedLocation: { lat: expectedLat, lng: expectedLng },
    studentLocation: { lat: studentLat, lng: studentLng }
  }

function haversineDistance(lat1, lon1, lat2, lon2):
  R = 6371000  // Earth's radius in meters

  phi1 = lat1 * PI / 180
  phi2 = lat2 * PI / 180
  deltaPhi = (lat2 - lat1) * PI / 180
  deltaLambda = (lon2 - lon1) * PI / 180

  a = sin(deltaPhi/2)^2 + cos(phi1) * cos(phi2) * sin(deltaLambda/2)^2
  c = 2 * atan2(sqrt(a), sqrt(1 - a))

  return R * c  // distance in meters
```

**Geofence failure handling:**
1. Check-in is **allowed** regardless of geofence result — `geofence_validated` is set to `false`
2. Student sees a warning: "You're outside the expected area. Check in anyway?"
3. Teacher sees a map indicator: expected location (blue circle) and student location (red pin)
4. Teacher can dismiss the warning, update the expected location, or follow up with the student

**When geofence is NOT validated:**
- `requires_geofence = false` → skip entirely
- Location permission denied by browser → check-in proceeds, `geofence_validated = null`, location fields remain null

---

## Freeform Tagging Flow

**Purpose:** When a student checks into a `freeform` block (activity with `allows_freeform = true`), they tag which activities they're working on during that time.

Freeform blocks are supervised work periods. Students might be working on homework for a college course, progressing on an online course, or doing an independent project. The tagging step captures what they actually did.

**Tagging options available to the student:**

```
function getFreeformTagOptions(student, date, organizationId):
  // 1. Today's scheduled activity instances (other activities the student has today)
  scheduledActivities = student's enrolled activities
    .filter(a => activityMeetsToday(a, date, organizationId))
    .filter(a => a.id != currentFreeformActivity.id)  // exclude the freeform block itself

  // 2. Unscheduled activities (online courses, etc. — always available for tagging)
  unscheduledActivities = student's enrolled activities
    .filter(a => a.is_not_scheduled == true)

  return scheduledActivities + unscheduledActivities
```

**Tagging storage:**

Each tag is a row in `checkin_activity_tags`:
- `checkin_id` → the check-in record for the freeform block
- `activity_id` → the activity the student worked on

One or more tags are required during the freeform check-in flow. The student can tag multiple activities if they split their time.

**Full freeform check-in flow:**

1. Student taps "Check In" on their freeform block
2. Check-in record created for the freeform activity's instance
3. Tag selection screen appears — student picks one or more activities they're working on
4. Tags saved to `checkin_activity_tags`
5. Status update prompt appears (type pre-selected to `plans`)
6. Status update saved to `status_updates` with `checkin_id` set and `activity_instance_id` pointing to the freeform instance
7. Check-in complete

**At check-out:** The same flow in reverse — status update prompted (type pre-selected to `progress`), tags are not re-prompted (the original tags stand).

---

## Edge Cases

**Student closes status modal during check-in flow:**
The check-in record should be rolled back — status update is required as part of the check-in flow for activities with `requires_checkin = true`. The student sees "Check-in cancelled — status update required."

**Activity time changes after check-in:**
If an admin changes the schedule template mid-day (e.g., early dismissal announced), existing check-ins are not affected. Check-out availability recalculates against the new times.

**Student checks in to wrong activity:**
Check-ins cannot be edited by students. A teacher or admin can delete the check-in record, allowing the student to check in again. This is an admin-level operation, not self-service.
