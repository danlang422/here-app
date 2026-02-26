# Status Updates & Presence Waves

## Status Updates

### Overview

Status updates are student-authored text entries describing what they're working on, what they accomplished, or reflections. They are stored in the `status_updates` table and always reference an `activity_instance_id`.

Status updates can be created in two contexts:
1. **During check-in/out flow** — prompted automatically for activities with `requires_checkin = true`. The `checkin_id` field links the update to the specific check-in.
2. **Standalone** — student writes one outside the check-in flow (e.g., adding a reflection during class). The `checkin_id` is null.

### Status Types

```sql
status_type TEXT NOT NULL CHECK (status_type IN ('plans', 'progress', 'reflection'))
```

- **plans** — What the student is working on. Pre-selected during check-in.
- **progress** — What the student accomplished. Pre-selected during check-out.
- **reflection** — Thoughts, questions, observations. Available anytime.

### Validation

```
function validateStatusUpdate(data):
  errors = []

  if not data.status_type:
    errors.push("Status type required")

  if data.status_type not in ['plans', 'progress', 'reflection']:
    errors.push("Invalid status type")

  if not data.content or data.content.trim().length == 0:
    errors.push("Content required")

  if data.content.length > 500:
    errors.push("Content too long (max 500 characters)")

  return { valid: errors.length == 0, errors }
```

### Timing Rules

Status updates are available whenever the student has access to the activity instance. There is no strict time window — if the instance exists, the student can write a status update.

**During check-in flow:**
1. Student taps "Check In"
2. Check-in record created
3. Status modal opens with type pre-selected to `plans`
4. Student writes content (1–500 characters)
5. Status update saved with `checkin_id` set
6. Modal closes, check-in complete

**During check-out flow:**
1. Student taps "Check Out"
2. Status modal opens with type pre-selected to `progress`
3. Student writes content
4. Status update saved with `checkin_id` set
5. `checked_out_at` timestamp written to the check-in record
6. Modal closes, check-out complete

**If modal is cancelled during check-in:**
Roll back the check-in record. Status update is required for activities with `requires_checkin = true` — the check-in cannot complete without it.

**If modal is cancelled during check-out:**
Keep the check-in record unchanged (already checked in). Don't write `checked_out_at`. Student can try again later.

### Multiple Updates

Multiple status updates per student per activity instance are allowed. They display as a chronological timeline within the activity. Teachers can comment on individual updates via the `comments` table (see `schema/06-social.md`).

---

## Presence Waves

### Overview

A presence wave is a lightweight daily "I'm here" signal — one tap, no text required. It's enabled per activity via `allows_presence_wave = true` on the `activities` table, typically for regular classes and advisory.

Waves build streaks over consecutive school days, gamifying consistent attendance.

### Availability

**Rules:**
1. Wave becomes available **10 minutes before** the activity's start time
2. Wave remains available **until midnight**
3. **One wave** per student per activity instance (enforced by `UNIQUE(student_id, activity_instance_id)`)
4. Activity must have `allows_presence_wave = true`
5. Student must be enrolled
6. Activity must meet today

**Algorithm:**

```
function canWavePresence(student, activity, date, organizationId):
  if not activity.allows_presence_wave:
    return { allowed: false, reason: "Presence waves not enabled" }

  if not activityMeetsToday(activity, date, organizationId):
    return { allowed: false, reason: "Activity doesn't meet today" }

  enrollment = getActiveEnrollment(student.id, activity.id)
  if not enrollment:
    return { allowed: false, reason: "Not enrolled" }

  instance = getOrCreateInstance(activity.id, date, organizationId)

  existingWave = getPresenceWave(student.id, instance.id)
  if existingWave:
    return { allowed: false, reason: "Already waved today", wavedAt: existingWave.waved_at }

  times = getActivityEffectiveTimes(activity, date, organizationId)
  now = getCurrentTime()
  availableFrom = times.start - 10 minutes
  availableUntil = endOfDay(date)

  if now < availableFrom:
    return { allowed: false, reason: "Too early", availableAt: availableFrom }

  if now > availableUntil:
    return { allowed: false, reason: "Day has ended" }

  return { allowed: true, instanceId: instance.id }
```

After waving, the button is disabled for the rest of the day and shows the wave timestamp.

---

## Streak Calculation

**Purpose:** Calculate consecutive school days on which a student waved presence for a given activity.

**Rules:**
- Only school days count (weekdays where `school_days.is_school_day = true`)
- Weekends do **not** break the streak (they're not school days)
- Holidays do **not** break the streak (marked `is_school_day = false`)
- Missing a wave on a school day **does** break the streak
- Streak resets to 0 when broken; starts at 1 on the next wave

**Algorithm:**

```
function calculateStreak(studentId, activityId, asOfDate, organizationId):
  streak = 0
  checkDate = asOfDate

  while true:
    schoolDay = getSchoolDay(checkDate, organizationId)

    if not schoolDay or not schoolDay.is_school_day:
      // Non-school day — skip without breaking streak
      checkDate = checkDate - 1 day
      continue

    // Did the activity meet on this school day?
    activity = getActivity(activityId)
    if not activityMeetsToday(activity, checkDate, organizationId):
      // Activity didn't meet (e.g., different rotation day) — skip without breaking
      checkDate = checkDate - 1 day
      continue

    // Did the student wave on this day?
    instance = getActivityInstance(activityId, checkDate)
    if not instance:
      break  // No instance = nobody interacted = no wave possible → streak broken

    wave = getPresenceWave(studentId, instance.id)
    if not wave:
      break  // School day, activity met, no wave → streak broken

    streak += 1
    checkDate = checkDate - 1 day

    // Safety limit
    if streak > 365:
      break

  return streak
```

**Optimization note:** In practice, this should be implemented as a single query that fetches the student's waves for the activity over a date range, joined with school_days, and calculates the streak in application code rather than issuing a query per day.

### Example

```
Week 1 (Mon-Fri, all school days, activity meets daily):
  Mon: Waved → streak = 1
  Tue: Waved → streak = 2
  Wed: Waved → streak = 3
  Thu: No wave → streak broken (0)
  Fri: Waved → streak = 1

Weekend: Sat, Sun (not school days — ignored)

Week 2:
  Mon: Waved → streak = 2 (continues from Fri)
  Tue: School cancelled (weather) → ignored
  Wed: Waved → streak = 3
```

### Streak Display

```
function getStreakDisplay(studentId, activityId, date, organizationId):
  currentStreak = calculateStreak(studentId, activityId, date, organizationId)
  wavedToday = hasWavedToday(studentId, activityId, date)

  if currentStreak == 0 and not wavedToday:
    return null  // No streak, no wave — show nothing

  if currentStreak > 0 and not wavedToday:
    return {
      count: currentStreak,
      text: currentStreak + " day streak — wave today to keep it!",
      type: "prompt"
    }

  if wavedToday:
    displayStreak = currentStreak  // calculateStreak already includes today if waved
    return {
      count: displayStreak,
      text: displayStreak + " day streak!",
      type: "celebration"
    }
```

**UI behavior:**
- **No streak, not yet waved:** Plain wave button
- **Active streak, not yet waved:** Wave button with streak count and prompt ("5 day streak — wave to keep it!")
- **Already waved:** Disabled button showing wave time and streak celebration
