# Activities

## internship_opportunities

Catalog of available internship placements.

```sql
CREATE TABLE internship_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- "Data Entry Assistant"
  organization_name TEXT NOT NULL, -- "Cedar Rapids City Hall"
  description TEXT,
  location_address TEXT,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  geofence_radius NUMERIC(10, 2) DEFAULT 100.00, -- meters
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  slots_available INTEGER,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_internship_opps_org ON internship_opportunities(organization_id);
CREATE INDEX idx_internship_opps_available ON internship_opportunities(organization_id, is_available)
  WHERE is_available = true;
```

When an activity has `internship_opportunity_id` set, the form auto-populates location, geofence radius, and contact fields from this record. The activity can override any of these fields independently after population.

---

## activities

The central table. Replaces both `sessions` and `student_activities` from V1.

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- Scheduling state flags (mutually exclusive)
  is_not_scheduled BOOLEAN DEFAULT false,
  -- true = activity intentionally has no fixed time/place (e.g. online courses that roll up to
  -- freeform blocks for student tagging). Does NOT appear in the admin's needs-scheduling list.

  is_release BOOLEAN DEFAULT false,
  -- true = student is released; no attendance required, no location expected.
  -- Release activities still have a schedule (block, days, times) so they block the slot visually
  -- on the admin's schedule UI, but generate no attendance records.

  -- "Needs scheduling" query: is_not_scheduled = false AND is_release = false
  --   AND (days_of_week IS NULL OR default_start_time IS NULL)
  -- These activities appear in the admin's floating unscheduled list.

  CONSTRAINT not_scheduled_and_release_mutually_exclusive
    CHECK (NOT (is_not_scheduled = true AND is_release = true)),

  -- Personnel (all nullable — fill in as information becomes available)
  teacher_id UUID REFERENCES user_profiles(id),     -- City View teacher; owns activity, takes attendance
  monitor_id UUID REFERENCES user_profiles(id),     -- City View staff supervising without ownership
  instructor_name TEXT,                             -- External instructor (Kirkwood prof, cooperating teacher)
  mentor_name TEXT,                                 -- Internship mentor (external, not in system)

  -- Scheduling
  block INTEGER,                  -- 0-5; identifies which City View attendance block this activity occupies.
                                  -- Required for any activity that occupies a time slot in the daily schedule,
                                  -- including external activities (external_hs_course, internships, college courses)
                                  -- that overlap with a City View block's time.
                                  -- NULL for unscheduled activities (online_course with is_not_scheduled = true)
                                  -- and not-yet-scheduled activities (block not yet assigned).
                                  -- The block value is denormalized onto enrollments for efficient schedule queries.
  days_of_week INTEGER[],         -- Values per EXTRACT(DOW): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
                                  -- e.g. [1,2,3,4,5] for Mon-Fri
                                  -- NULL for online_course (is_not_scheduled) and external_hs_course
                                  -- (uses rotation_day_type instead — see academic calendar docs)
  rotation_day_type TEXT,          -- Validated in application layer against organization.settings.rotation_day_names
                                  -- Defaults to 'A'/'B' if org hasn't configured custom names.
                                  -- Used when an activity only occurs on one rotation day.
                                  -- Most common for external_hs_course, but any type can use it —
                                  -- e.g. a regular_class that meets opposite an external_hs_course
                                  -- would also carry a rotation_day_type.
  default_start_time TIME,        -- NULL for is_not_scheduled activities
  default_end_time TIME,          -- NULL for is_not_scheduled activities
  start_date DATE,
  end_date DATE,

  -- Location
  location TEXT,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  geofence_radius NUMERIC(10, 2), -- meters; used when requires_geofence = true

  -- Behavior flags (these drive actual application behavior)
  requires_attendance BOOLEAN DEFAULT false,
  -- true = student appears on City View teacher roster; City View reports attendance
  -- External HS course: false (other school handles it) | Everything else that has a teacher/monitor: true

  requires_checkin BOOLEAN DEFAULT false,
  -- true = student must check in/out (internship, online course, freeform)

  allows_presence_wave BOOLEAN DEFAULT false,
  -- true = student can send one "I'm here" wave per day with streak tracking
  -- Typically enabled for regular classes and advisory

  allows_freeform BOOLEAN DEFAULT false,
  -- true = at check-in, student tags which activities they worked on from their full list
  -- Enabled for freeform block type

  requires_geofence BOOLEAN DEFAULT false,
  -- true = validate student location against lat/lng + radius on check-in

  -- Internship opportunity link (optional — auto-populates location/contact fields)
  -- Note: Location/contact fields are COPIED from the opportunity at creation time, not synced.
  -- Updating the internship opportunity record does not propagate to existing activities.
  internship_opportunity_id UUID REFERENCES internship_opportunities(id),

  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),

  -- Calendar assignment (optional grouping for the admin calendar view)
  calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL,
  -- FK to calendars table. NULL = unassigned. Deleting a calendar sets this to NULL.

  -- Recurrence (for every-other-week or less-frequent activities)
  recurrence_interval INTEGER DEFAULT 1 CHECK (recurrence_interval >= 1),
  -- Weeks between occurrences. 1 = every week (default). 2 = every other week, etc.
  recurrence_anchor_date DATE,
  -- A date in an "on" week. Required when recurrence_interval > 1.
  -- The predicate computes whole weeks elapsed since this date and checks divisibility.
  -- Planned duration in minutes. Used for unplaced activities (activities that will be scheduled
  -- but don't have times yet) to size their cards in the future schedule canvas/placement tool.
  -- For activities with default_start_time and default_end_time, the UI computes duration from
  -- the time range directly — this field is not kept in sync with times.

  CONSTRAINT valid_block CHECK (block IS NULL OR block >= 0),
  -- Upper bound enforced at app layer against organization.settings.block_count
  CONSTRAINT valid_days_of_week CHECK (
    days_of_week IS NULL OR (
      array_length(days_of_week, 1) > 0
      AND days_of_week <@ ARRAY[0,1,2,3,4,5,6]
    )
  ),
  CONSTRAINT valid_time_range CHECK (
    (default_start_time IS NULL AND default_end_time IS NULL) OR
    (default_start_time IS NOT NULL AND default_end_time IS NOT NULL
      AND default_end_time > default_start_time)
  )
);

CREATE INDEX idx_activities_org ON activities(organization_id);
CREATE INDEX idx_activities_teacher ON activities(teacher_id);
CREATE INDEX idx_activities_monitor ON activities(monitor_id);
CREATE INDEX idx_activities_active ON activities(organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_activities_days_gin ON activities USING GIN(days_of_week);
```

**Term association:** Activities are associated with terms through the `activity_terms` junction table (see `docs/schema/02-academic-calendar.md`). An activity can belong to multiple terms — for example, a Kirkwood college course tagged with both "Kirkwood S2 #1" and "Semester 2." To query activities for a given term, join through `activity_terms`. The previous `term_id` FK column was removed in migration `20260320000000_terms_many_to_many.sql`.

**Common activity scenarios:**

Activities are configured entirely through their scheduling fields and behavior flags — there is no type system. These scenarios illustrate common configurations:

- **Regular class** — block assigned, `days_of_week` set, `requires_attendance` + `allows_presence_wave`. Teacher assigned via `teacher_id`.
- **College course (e.g. Kirkwood)** — block assigned, `days_of_week` pattern like MWF or TuTh, `requires_attendance`. External professor recorded in `instructor_name`; optionally a City View staff member in `monitor_id`.
- **External HS course (e.g. Kennedy Band)** — block assigned, `rotation_day_type` instead of `days_of_week` (occurrence driven by district A/B rotation calendar), `requires_attendance = false` (other school handles it). External teacher in `instructor_name`.
- **Online course** — `is_not_scheduled = true`, `requires_checkin`, no block/days/times. Supervised via `monitor_id`.
- **Freeform block** — block assigned, `days_of_week` set, `requires_checkin` + `allows_freeform`. Supervised via `monitor_id`.
- **Internship** — block assigned, `days_of_week` set, `requires_checkin` + `requires_geofence`. External mentor in `mentor_name`; supervised via `monitor_id`. Location/geofence fields copied from `internship_opportunities` at creation.
- **Release** — block assigned with a schedule (blocks the slot visually), `is_release = true`, no attendance or check-in. Student is released for the period.

All activities that occupy a time slot in the schedule get a block number, including external activities. The only activities without a block are those with `is_not_scheduled = true` or activities whose block has not yet been assigned.

Any activity can carry `rotation_day_type` if it only occurs on one rotation day. This is most common for external HS courses, but a regular class scheduled opposite an external course would also use it.

See `docs/business-logic/01-schedule-and-calendar.md` for the full `activityMeetsToday` algorithm and scheduling predicate logic.

**Personnel fields explained:**

- `teacher_id`: A City View staff member who owns the activity. They see enrolled students on their roster and are responsible for taking attendance. Typically set for regular classes.
- `monitor_id`: A City View staff member who supervises without ownership. They see enrolled students listed under this block in their view. Typically set for freeform blocks, online courses, internships, and sometimes college courses if a staff member is assigned to supervise.
- `instructor_name`: Free text for external instructors — Kirkwood professors, cooperating teachers at other high schools. Not a user in the system.
- `mentor_name`: Free text for internship mentors. Not a user in the system. Future: could become a separate `mentors` table with contact info.

**Teacher view query logic:**

A teacher's view for a given block shows all activities where `teacher_id = me OR monitor_id = me` AND `block = X` AND the activity is scheduled for today. Students are then listed per activity, with `requires_attendance` determining whether they appear on the attendance roster.

---

## enrollments

Associates students with activities. Used for all activity types without exception.

```sql
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  block INTEGER,
  -- Denormalized from activities.block at enrollment time.
  -- Used for efficient schedule queries ("what does this student have in Block 3?").
  -- NULL when the parent activity has no block (is_not_scheduled activities, etc.).
  -- Kept in sync by the trg_activity_block_cascade trigger on the activities table.
  notes TEXT, -- "Enrolled mid-semester", "Kirkwood campus on Tue/Thu"
  is_active BOOLEAN DEFAULT true,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Enrollment-level scheduling (all nullable — null means "follow the activity")
  -- These fields narrow a student's participation within the activity's schedule.
  -- They must be subsets of / compatible with the parent activity's scheduling fields.
  days_of_week INTEGER[],
  -- Which days of week this student attends. Must be a subset of the activity's days_of_week.
  -- NULL = follow the activity's days_of_week. Same encoding as activities.days_of_week
  -- (EXTRACT(DOW) values: 0=Sun, 1=Mon, ..., 6=Sat).
  rotation_day_type TEXT,
  -- Which rotation day this student attends. Must match one of org's rotation_day_names.
  -- NULL = follow the activity's rotation_day_type.
  recurrence_interval INTEGER CHECK (recurrence_interval IS NULL OR recurrence_interval >= 1),
  -- Weeks between this student's occurrences. Overrides the activity's recurrence_interval.
  -- NULL = follow the activity's recurrence_interval.
  recurrence_anchor_date DATE,
  -- Anchor week for this student's recurrence. Required when enrollment recurrence_interval > 1.
  -- NULL = follow the activity's recurrence_anchor_date.

  CONSTRAINT unique_student_activity UNIQUE (student_id, activity_id),
  CONSTRAINT valid_block CHECK (block IS NULL OR block >= 0),
  -- Upper bound enforced at app layer against organization.settings.block_count
  CONSTRAINT valid_enrollment_days_of_week CHECK (
    days_of_week IS NULL OR (
      array_length(days_of_week, 1) > 0
      AND days_of_week <@ ARRAY[0,1,2,3,4,5,6]
    )
  )
);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_activity ON enrollments(activity_id);
CREATE INDEX idx_enrollments_active ON enrollments(activity_id, is_active) WHERE is_active = true;
CREATE INDEX idx_enrollments_student_block ON enrollments(student_id, block)
  WHERE is_active = true AND block IS NOT NULL;
```

**Scheduling overlap prevention:** A student should not be enrolled in two activities that actually overlap in time. This is enforced at the **application layer** during enrollment, not by a database constraint. The application computes each enrollment's effective schedule via `getEffectiveSchedule(enrollment, activity)` — which uses enrollment-level scheduling fields when set, or falls back to the activity's fields — and checks for overlap between the new enrollment's effective schedule and existing enrollments' effective schedules. See [business-logic/05-conflict-resolution.md](../business-logic/05-conflict-resolution.md) for the full validation algorithm.

This approach allows legitimate scheduling patterns that a simple unique constraint would reject — for example, two activities in the same block on alternating rotation days (Block 0 on A days and Block 0 on B days), or two activities in the same block on non-overlapping weekdays (Block 2 MWF and Block 2 TuTh). Enrollment-level scheduling further allows two students in the same activity to attend on different days without conflicting with each other's other enrollments.

The denormalized `block` on enrollments exists for query convenience, not constraint enforcement. The `idx_enrollments_student_block` index accelerates schedule lookups but is not unique.

Even for single-student activities (internships, individual online courses), enrollment is stored here rather than via a `student_id` field directly on the activity. This keeps all "who is in what" queries consistent — always join through enrollments.
