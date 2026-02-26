-- Here App - Phase 2: Activities & Enrollments
-- Created: February 25, 2026
-- Description: Internship opportunities, unified activities table, and enrollments.
--              Run after 20260225000001_phase1_core.sql.

-- ============================================================================
-- INTERNSHIP OPPORTUNITIES
-- ============================================================================

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

-- ============================================================================
-- ACTIVITIES (unified — replaces V1 sessions + student_activities)
-- ============================================================================

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
  is_release BOOLEAN DEFAULT false,

  CONSTRAINT not_scheduled_and_release_mutually_exclusive
    CHECK (NOT (is_not_scheduled = true AND is_release = true)),

  -- Personnel (all nullable)
  teacher_id UUID REFERENCES user_profiles(id),     -- City View teacher; owns activity, takes attendance
  monitor_id UUID REFERENCES user_profiles(id),     -- City View staff supervising without ownership
  instructor_name TEXT,                             -- External instructor (not a user in the system)
  mentor_name TEXT,                                 -- Internship mentor (not a user in the system)

  -- Scheduling
  block INTEGER,                  -- 0-5; NULL until assigned
  days_of_week INTEGER[],         -- Values per EXTRACT(DOW): 0=Sun through 6=Sat
  rotation_day_type TEXT,          -- Validated in app layer against organization.settings.rotation_day_names
  default_start_time TIME,
  default_end_time TIME,
  start_date DATE,
  end_date DATE,

  -- Location
  location TEXT,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  geofence_radius NUMERIC(10, 2), -- meters

  -- Behavior flags
  requires_attendance BOOLEAN DEFAULT false,
  requires_checkin BOOLEAN DEFAULT false,
  allows_presence_wave BOOLEAN DEFAULT false,
  allows_freeform BOOLEAN DEFAULT false,
  requires_geofence BOOLEAN DEFAULT false,

  -- Internship opportunity link
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

-- ============================================================================
-- ENROLLMENTS
-- ============================================================================

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_student_activity UNIQUE (student_id, activity_id)
);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_activity ON enrollments(activity_id);
CREATE INDEX idx_enrollments_active ON enrollments(activity_id, is_active) WHERE is_active = true;
