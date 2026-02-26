-- Here App - Phase 3: Instances & Attendance
-- Created: February 25, 2026
-- Description: Activity instances, attendance records, check-ins, freeform tags,
--              and presence waves.
--              Run after 20260225000002_phase2_activities.sql.

-- ============================================================================
-- ACTIVITY INSTANCES
-- ============================================================================

CREATE TABLE activity_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Denormalized from activities for RLS performance.
  date DATE NOT NULL,
  cancelled BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_activity_date UNIQUE (activity_id, date)
);

CREATE INDEX idx_activity_instances_activity ON activity_instances(activity_id);
CREATE INDEX idx_activity_instances_date ON activity_instances(activity_id, date);
CREATE INDEX idx_activity_instances_org_date ON activity_instances(organization_id, date);

-- ============================================================================
-- ATTENDANCE RECORDS
-- ============================================================================

CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused', 'tardy');

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status attendance_status NOT NULL,
  marked_by_id UUID NOT NULL REFERENCES user_profiles(id),
  notes TEXT,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- This UNIQUE constraint also serves as the index for (activity_instance_id, student_id) lookups.
  CONSTRAINT unique_attendance UNIQUE (activity_instance_id, student_id)
);

CREATE INDEX idx_attendance_instance ON attendance_records(activity_instance_id);
CREATE INDEX idx_attendance_student ON attendance_records(student_id);

-- ============================================================================
-- CHECK-INS
-- ============================================================================

CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL,
  checked_out_at TIMESTAMPTZ,
  check_in_location_lat NUMERIC(10, 7),
  check_in_location_lng NUMERIC(10, 7),
  geofence_validated BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_checkout CHECK (checked_out_at IS NULL OR checked_out_at > checked_in_at),
  -- This UNIQUE constraint also serves as the index for (student_id, activity_instance_id) lookups.
  CONSTRAINT unique_checkin UNIQUE (student_id, activity_instance_id)
);

CREATE INDEX idx_check_ins_student ON check_ins(student_id);
CREATE INDEX idx_check_ins_instance ON check_ins(activity_instance_id);

-- ============================================================================
-- CHECKIN ACTIVITY TAGS (freeform block tagging)
-- ============================================================================

CREATE TABLE checkin_activity_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES check_ins(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_tag UNIQUE (checkin_id, activity_id)
);

CREATE INDEX idx_checkin_tags_checkin ON checkin_activity_tags(checkin_id);
CREATE INDEX idx_checkin_tags_activity ON checkin_activity_tags(activity_id);

-- ============================================================================
-- PRESENCE WAVES
-- ============================================================================

CREATE TABLE presence_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  waved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_wave UNIQUE (student_id, activity_instance_id)
);

CREATE INDEX idx_presence_waves_student ON presence_waves(student_id);
CREATE INDEX idx_presence_waves_instance ON presence_waves(activity_instance_id);
