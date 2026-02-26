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
  term_id UUID REFERENCES academic_terms(id),
  -- Optional but recommended. Links activity to a specific term for easy term-based queries.
  -- Activities without a term_id can still be filtered by date range using start_date/end_date.
  name TEXT NOT NULL,

  -- UI hint only — drives form field visibility during data entry, not behavior
  type TEXT NOT NULL CHECK (type IN (
    'regular_class', 'college_course', 'external_hs_course',
    'online_course', 'freeform', 'internship'
  )),

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
                                  -- Required for City View-scheduled activities (regular_class, freeform, etc.).
                                  -- NULL for external activities (external_hs_course, off-campus college courses)
                                  -- and unscheduled activities (online_course with is_not_scheduled = true).
                                  -- The block value is denormalized onto enrollments to enforce one-per-block.
                                  -- NULL until assigned is also valid for not-yet-scheduled activities.
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

  CONSTRAINT valid_block CHECK (block IS NULL OR (block >= 0 AND block <= 5)),
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
CREATE INDEX idx_activities_type ON activities(organization_id, type);
CREATE INDEX idx_activities_active ON activities(organization_id, is_active) WHERE is_active = true;
CREATE INDEX idx_activities_days_gin ON activities USING GIN(days_of_week);
CREATE INDEX idx_activities_term ON activities(term_id) WHERE term_id IS NOT NULL;
```

**Scheduling rules by type:**

| Type | days_of_week | rotation_day_type | default_start/end_time |
|------|-------------|-------------------|----------------------|
| regular_class | Required | NULL (or 'A'/'B' if opposite an external HS course) | Required |
| college_course | Required (e.g. [1,3,5] or [2,4] pattern) | NULL | Required |
| external_hs_course | NULL | Required ('A' or 'B') | Required |
| online_course | NULL | NULL | NULL — set is_not_scheduled |
| freeform | Required | NULL | Required |
| internship | Required | NULL | Required |

Any activity type can carry `rotation_day_type` if it only occurs on one rotation day. This is most common for `external_hs_course`, but a `regular_class` or any other type that is scheduled opposite an external HS course would also use it.

**Behavior flag defaults by type** (set at creation time, all overridable):

| Type | requires_attendance | requires_checkin | allows_presence_wave | allows_freeform |
|------|--------------------|-----------------|--------------------|----------------|
| regular_class | true | false | true | false |
| college_course | true | false | false | false |
| external_hs_course | false | false | false | false |
| online_course | true | true | false | false |
| freeform | true | true | false | true |
| internship | true | true | false | false |

**Personnel fields explained:**

- `teacher_id`: A City View staff member who owns the activity. They see enrolled students on their roster and are responsible for taking attendance. Set for `regular_class` only.
- `monitor_id`: A City View staff member who supervises without ownership. They see enrolled students listed under this block in their view. Set for `freeform`, `online_course`, `internship`, and sometimes `college_course` if a staff member is assigned to supervise.
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
  -- Enables the one-enrollment-per-block constraint below.
  -- NULL when the parent activity has no block (external_hs_course, online_course, etc.).
  -- Must be updated if the activity's block changes (application responsibility).
  notes TEXT, -- "Enrolled mid-semester", "Kirkwood campus on Tue/Thu"
  is_active BOOLEAN DEFAULT true,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_student_activity UNIQUE (student_id, activity_id),
  CONSTRAINT valid_block CHECK (block IS NULL OR (block >= 0 AND block <= 5))
);

-- A student can have at most one active enrollment per numbered block.
-- Activities without a block (external courses, online courses) are exempt — NULL values
-- are treated as distinct in PostgreSQL unique indexes, so multiple block-NULL enrollments
-- are always allowed.
CREATE UNIQUE INDEX idx_enrollments_one_per_block
  ON enrollments(student_id, block)
  WHERE is_active = true AND block IS NOT NULL;

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_activity ON enrollments(activity_id);
CREATE INDEX idx_enrollments_active ON enrollments(activity_id, is_active) WHERE is_active = true;
```

**One enrollment per block:** A student cannot be actively enrolled in two activities that share the same block number. This is enforced at the database level via `idx_enrollments_one_per_block`. External activities (external HS courses, some college courses at Kirkwood campus) have `block = NULL` and are not subject to this constraint — they don't occupy a City View block slot. The "away" indicator for these students is derived at query time from the external activity's times and rotation day.

Even for single-student activities (internships, individual online courses), enrollment is stored here rather than via a `student_id` field directly on the activity. This keeps all "who is in what" queries consistent — always join through enrollments.
