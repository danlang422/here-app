# Schedule & Calendar Logic

## Rotation Day Calculation

**Purpose:** Determine the rotation day (e.g., "A" or "B") for a given school date.

City View itself does not use A/B rotation — every school day is the same from their perspective. The rotation calendar exists because external high schools in the district (Kennedy, Washington, Jefferson) follow an A/B schedule. This determines when shared students attend those schools instead of City View.

Rotation day values are stored in `school_days.rotation_day` and validated in the application layer against `organization.settings.rotation_day_names` (defaults to `["A", "B"]`).

**Algorithm:**

```
function calculateRotationDay(date, organization):
  // Orgs that don't use rotation have no rotation days
  if not organization.settings.uses_rotation_schedule:
    return null

  // Check for an explicit override on this date
  schoolDay = getSchoolDay(date, organization.id)
  if schoolDay and schoolDay.rotation_day is not null:
    return schoolDay.rotation_day

  // Calculate from the term start using org settings
  term = getCurrentTerm(organization.id)
  allDays = getSchoolDaysInRange(term.start_date, date, organization.id)

  if organization.settings.rotation_mode == "continue":
    // Skip non-school days — rotation advances only on days school is in session
    countableDays = allDays.filter(d => d.is_school_day)
  else: // "repeat"
    // Cancelled days repeat — the rotation does not advance
    countableDays = allDays

  rotationNames = organization.settings.rotation_day_names  // e.g. ["A", "B"]
  index = countableDays.length % rotationNames.length
  return rotationNames[index]
```

**Example — "continue" mode:**

Organization: `rotation_day_names: ["A", "B"]`, `rotation_mode: "continue"`, term starts Mon Jan 5 (A day)

| Date | School? | Rotation | Why |
|------|---------|----------|-----|
| Mon Jan 5 | Yes | A | Day 0 → index 0 |
| Tue Jan 6 | Yes | B | Day 1 → index 1 |
| Wed Jan 7 | Yes | A | Day 2 → index 0 |
| Thu Jan 8 | Cancelled (weather) | — | Skipped in count |
| Fri Jan 9 | Yes | B | Day 3 → index 1 (continues, doesn't repeat Thu) |

If `rotation_mode` were `"repeat"`: Fri Jan 9 would be A (repeats Thu's cancelled slot).

---

## Block Time Resolution

**Purpose:** Get the actual start and end times for a numbered block (0–5) on a specific date.

Block times come from `schedule_templates.block_definitions` (JSONB). Each school day can use a different template — the default handles regular days, and alternate templates cover 2-hour delays, early dismissals, etc.

**Algorithm:**

```
function getBlockTimes(block, date, organizationId):
  schoolDay = getSchoolDay(date, organizationId)

  if schoolDay and schoolDay.schedule_template_id:
    template = getScheduleTemplate(schoolDay.schedule_template_id)
  else:
    template = getDefaultScheduleTemplate(organizationId)

  blockDef = template.block_definitions.find(b => b.block == block)
  if not blockDef:
    return null  // block not defined in this template (e.g., early dismissal drops Block 5)

  return { start: blockDef.start_time, end: blockDef.end_time }
```

**Template example (regular day):**

```json
[
  {"block": 0, "start_time": "07:30", "end_time": "09:00"},
  {"block": 1, "start_time": "09:05", "end_time": "09:50"},
  {"block": 2, "start_time": "09:55", "end_time": "10:40"},
  {"block": 3, "start_time": "10:45", "end_time": "11:30"},
  {"block": 4, "start_time": "12:15", "end_time": "13:15"},
  {"block": 5, "start_time": "13:20", "end_time": "14:20"}
]
```

Note the gap between Block 3 (ends 11:30) and Block 4 (starts 12:15) — this is lunch. Lunch is modeled as a separate activity with `default_start_time`/`default_end_time` set to 11:30–12:15, no block assignment, and no engagement flags.

---

## Activity Effective Times

**Purpose:** Resolve an activity's actual start and end times for a specific date.

Activities fall into two categories for time resolution:

1. **Block-linked** — Activities with a `block` assignment. Their times shift when a non-default schedule template is in effect (2-hour delay, etc.).
2. **Fixed-time** — Activities with `default_start_time`/`default_end_time` but no block, or external activities whose times don't follow City View's template. These always use their own stored times.

**Algorithm:**

```
function getActivityEffectiveTimes(activity, date, organizationId):
  // Activities with no schedule have no times
  if activity.is_not_scheduled:
    return null

  // Block-linked: resolve from today's schedule template
  if activity.block is not null:
    blockTimes = getBlockTimes(activity.block, date, organizationId)
    if blockTimes:
      return blockTimes
    // Block not in today's template (e.g., early dismissal drops late blocks)
    // Fall through to fixed times if available

  // Fixed-time: use the activity's own times
  if activity.default_start_time and activity.default_end_time:
    return { start: activity.default_start_time, end: activity.default_end_time }

  return null  // unscheduled or incomplete setup
```

**Key distinction:**
- A `regular_class` in Block 2 shifts from 09:55–10:40 to 11:55–12:40 on a 2-hour delay day.
- A `college_course` at Kirkwood with `default_start_time = '09:00'` is always 09:00 regardless of City View's template — it runs on Kirkwood's clock.
- An `external_hs_course` like Kennedy Band at 07:30–09:00 is fixed — Kennedy's schedule is independent.

---

## Activity Meets Today

**Purpose:** The core scheduling predicate — determine whether an activity occurs on a given date.

This is the most-used function in the system. It gates teacher rosters, student schedules, attendance availability, check-in availability, and instance creation.

**Algorithm:**

```
function activityMeetsToday(activity, date, organizationId):
  // Inactive activities never meet
  if not activity.is_active:
    return false

  // Not-scheduled activities (online courses, etc.) are always "available"
  // but they don't appear on the daily schedule — they're surfaced for
  // freeform tagging and status updates only
  if activity.is_not_scheduled:
    return false  // does not "meet" in the schedule sense

  // Check date range (if set)
  if activity.start_date and date < activity.start_date:
    return false
  if activity.end_date and date > activity.end_date:
    return false

  // Must be a school day
  schoolDay = getSchoolDay(date, organizationId)
  if not schoolDay or not schoolDay.is_school_day:
    return false

  // Check rotation day constraint
  // External HS courses use rotation_day_type ONLY (no days_of_week)
  // Other types may also carry rotation_day_type if scheduled opposite an external course
  if activity.rotation_day_type is not null:
    if schoolDay.rotation_day != activity.rotation_day_type:
      return false

  // Check day of week (INTEGER[] using EXTRACT(DOW) values: 0=Sun..6=Sat)
  // External HS courses have days_of_week = NULL — they match on rotation_day_type alone
  if activity.days_of_week is not null:
    dayNumber = extractDOW(date)  // 0=Sun, 1=Mon, ..., 6=Sat
    if dayNumber not in activity.days_of_week:
      return false

  // Release activities have a schedule but don't generate attendance/interaction
  // They still "meet" for visual blocking on the admin schedule
  // (Caller decides how to handle is_release)

  return true
```

**Scheduling rules by activity type:**

| Type | days_of_week | rotation_day_type | What determines "meets today" |
|------|-------------|-------------------|-------------------------------|
| regular_class | Set (or NULL if rotation-only) | NULL (or set if rotation-only) | Day of week or rotation day match |
| college_course | e.g. `[1,3,5]` (MWF) | NULL | Day of week match |
| external_hs_course | NULL | `'A'` or `'B'` | Rotation day match only |
| online_course | NULL | NULL | `is_not_scheduled = true` — never "meets" |
| freeform | `[1,2,3,4,5]` | NULL | Day of week match |
| internship | e.g. `[1,3]` (Mon/Wed) | NULL | Day of week match |

An activity uses **either** `days_of_week` **or** `rotation_day_type`, never both. Activities with `days_of_week` meet on specific weekdays regardless of rotation. Activities with `rotation_day_type` meet on whichever weekday happens to be that rotation day.

**Example — external HS course:**

Allison has Band at Kennedy with `rotation_day_type = 'A'`, `days_of_week = NULL`, `block = 0`.

- Monday, rotation A: Band **meets** (rotation matches, no day-of-week constraint)
- Tuesday, rotation B: Band does **not** meet (rotation mismatch)
- Monday, rotation B: Band does **not** meet

The activity's occurrence is driven entirely by the district rotation calendar, not by which weekday it is.

---

## Activity Instance Creation

**Purpose:** Ensure an `activity_instances` record exists for an activity on a given date.

Instances are created lazily — on the first time anyone interacts with an activity on a date. All downstream records (`attendance_records`, `check_ins`, `presence_waves`, `posts`, `status_updates`) reference the instance, not `activity_id + date`.

**Algorithm:**

```
function getOrCreateInstance(activityId, date, organizationId):
  // Upsert — create if not exists, return existing if it does
  instance = INSERT INTO activity_instances (activity_id, organization_id, date)
    VALUES (activityId, organizationId, date)
    ON CONFLICT (activity_id, date) DO NOTHING
    RETURNING *

  // If DO NOTHING fired, fetch the existing row
  if not instance:
    instance = SELECT * FROM activity_instances
      WHERE activity_id = activityId AND date = date

  return instance
```

**When instances are created:**
- Teacher opens their roster for a block → instances created for all their activities that meet today
- Student views their schedule → instances created for all their activities that meet today
- Attendance is marked, check-in submitted, post created, or presence wave recorded → instance created for that specific activity

**What this means:**
- No pre-generation of a semester's worth of instances
- Instances only exist for dates that were actually accessed
- Reporting queries for "all instances of Bio 101 this term" may have gaps for dates nobody opened the app — acceptable since no meaningful data would exist for those gaps anyway
- Cancelled instances have `cancelled = true` with optional `notes` (e.g., "Fire drill shortened session")
