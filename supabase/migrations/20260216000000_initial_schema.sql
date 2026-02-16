-- Here App - Initial Schema Migration
-- Created: February 16, 2026
-- Description: Complete database schema for City View attendance tracking system

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Organizations table (multi-tenancy foundation)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{
    "timezone": "America/Chicago",
    "uses_rotation_schedule": false,
    "rotation_day_names": ["A", "B"],
    "rotation_mode": "continue"
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug);

-- User profiles (extends auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  preferred_name TEXT,
  roles TEXT[] NOT NULL DEFAULT '{}', 
  grade_level TEXT,
  advisor_id UUID REFERENCES user_profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_org ON user_profiles(organization_id);
CREATE INDEX idx_user_profiles_roles ON user_profiles USING GIN(roles);
CREATE INDEX idx_user_profiles_advisor ON user_profiles(advisor_id);

-- ============================================================================
-- ACADEMIC CALENDAR SYSTEM
-- ============================================================================

-- Academic terms (semesters)
CREATE TABLE academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

CREATE INDEX idx_academic_terms_org ON academic_terms(organization_id);
CREATE INDEX idx_academic_terms_current ON academic_terms(organization_id, is_current) 
  WHERE is_current = true;

-- Schedule templates (regular, delay, early dismissal, etc.)
CREATE TABLE schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  block_definitions JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedule_templates_org ON schedule_templates(organization_id);
CREATE INDEX idx_schedule_templates_default ON schedule_templates(organization_id, is_default)
  WHERE is_default = true;

-- School days calendar
CREATE TABLE school_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_school_day BOOLEAN DEFAULT true,
  schedule_template_id UUID REFERENCES schedule_templates(id),
  rotation_day TEXT,
  override_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_org_date UNIQUE (organization_id, date)
);

CREATE INDEX idx_school_days_org_date ON school_days(organization_id, date);
CREATE INDEX idx_school_days_is_school_day ON school_days(organization_id, is_school_day);

-- ============================================================================
-- ACTIVITY & SCHEDULE STRUCTURE
-- ============================================================================

-- Activity types catalog
CREATE TABLE activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  default_requires_checkin BOOLEAN DEFAULT false,
  default_allows_remote BOOLEAN DEFAULT false,
  default_requires_geofence BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_types_org ON activity_types(organization_id);
CREATE INDEX idx_activity_types_category ON activity_types(organization_id, category);

-- Internship opportunities catalog
CREATE TABLE internship_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  description TEXT,
  location_address TEXT,
  location_lat NUMERIC(10, 7),
  location_lng NUMERIC(10, 7),
  geofence_radius NUMERIC(10, 2) DEFAULT 100.00,
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

-- Session types enum
CREATE TYPE session_type AS ENUM ('standard_class', 'monitoring');

-- Sessions (teacher supervision blocks)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES user_profiles(id),
  session_type session_type NOT NULL,
  block INTEGER NOT NULL,
  days_of_week TEXT[] NOT NULL,
  default_start_time TIME NOT NULL,
  default_end_time TIME NOT NULL,
  location TEXT,
  academic_term_id UUID REFERENCES academic_terms(id),
  start_date DATE,
  end_date DATE,
  honors_rotation BOOLEAN DEFAULT false,
  rotation_day_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_block CHECK (block >= 0 AND block <= 5),
  CONSTRAINT valid_time_range CHECK (default_end_time > default_start_time)
);

CREATE INDEX idx_sessions_org ON sessions(organization_id);
CREATE INDEX idx_sessions_teacher ON sessions(teacher_id);
CREATE INDEX idx_sessions_term ON sessions(academic_term_id);
CREATE INDEX idx_sessions_block ON sessions(organization_id, block);
CREATE INDEX idx_sessions_days_gin ON sessions USING GIN(days_of_week);

-- Enrollments (student-to-session relationships)
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  days_active TEXT[],
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_student_session UNIQUE (student_id, session_id)
);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_session ON enrollments(session_id);
CREATE INDEX idx_enrollments_active ON enrollments(session_id, is_active) WHERE is_active = true;

-- Student activities (what students actually do)
CREATE TABLE student_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_type_id UUID NOT NULL REFERENCES activity_types(id),
  session_id UUID REFERENCES sessions(id),
  internship_opportunity_id UUID REFERENCES internship_opportunities(id),
  
  custom_name TEXT,
  custom_location TEXT,
  custom_location_lat NUMERIC(10, 7),
  custom_location_lng NUMERIC(10, 7),
  custom_geofence_radius NUMERIC(10, 2),
  
  block INTEGER,
  default_start_time TIME,
  default_end_time TIME,
  days_of_week TEXT[] NOT NULL,
  rotation_day_type TEXT,
  start_date DATE,
  end_date DATE,
  
  requires_checkin BOOLEAN DEFAULT false,
  allows_presence_wave BOOLEAN DEFAULT false,
  allows_status_updates BOOLEAN DEFAULT true,
  requires_geofence BOOLEAN DEFAULT false,
  allows_remote BOOLEAN DEFAULT false,
  conflict_priority INTEGER DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_block CHECK (block IS NULL OR (block >= 0 AND block <= 5)),
  CONSTRAINT valid_time_range CHECK (
    (default_start_time IS NULL AND default_end_time IS NULL) OR
    (default_start_time IS NOT NULL AND default_end_time IS NOT NULL AND default_end_time > default_start_time)
  )
);

CREATE INDEX idx_student_activities_student ON student_activities(student_id);
CREATE INDEX idx_student_activities_session ON student_activities(session_id);
CREATE INDEX idx_student_activities_student_active ON student_activities(student_id, is_active)
  WHERE is_active = true;
CREATE INDEX idx_student_activities_internship ON student_activities(internship_opportunity_id);
CREATE INDEX idx_student_activities_days_gin ON student_activities USING GIN(days_of_week);
CREATE INDEX idx_student_schedule_lookup ON student_activities(student_id, is_active) 
  WHERE is_active = true;
CREATE INDEX idx_student_activity_conflicts ON student_activities(student_id, conflict_priority, rotation_day_type)
  WHERE is_active = true;

-- ============================================================================
-- ATTENDANCE & INTERACTION
-- ============================================================================

-- Check-ins (required check-in/out for remote work)
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_activity_id UUID NOT NULL REFERENCES student_activities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  checked_in_at TIMESTAMPTZ NOT NULL,
  checked_out_at TIMESTAMPTZ,
  
  check_in_location_lat NUMERIC(10, 7),
  check_in_location_lng NUMERIC(10, 7),
  geofence_validated BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_checkout_time CHECK (
    checked_out_at IS NULL OR checked_out_at > checked_in_at
  ),
  CONSTRAINT unique_checkin_per_day UNIQUE (student_id, student_activity_id, date)
);

CREATE INDEX idx_check_ins_student ON check_ins(student_id);
CREATE INDEX idx_check_ins_activity_date ON check_ins(student_activity_id, date);
CREATE INDEX idx_checkin_status_lookup ON check_ins(student_id, date, checked_in_at, checked_out_at);

-- Status updates (plans, progress, reflections)
CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_activity_id UUID NOT NULL REFERENCES student_activities(id),
  date DATE NOT NULL,
  
  status_type TEXT NOT NULL CHECK (status_type IN ('plans', 'progress', 'reflection')),
  content TEXT NOT NULL,
  
  created_during_checkin BOOLEAN DEFAULT false,
  related_checkin_id UUID REFERENCES check_ins(id),
  
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_updates_student ON status_updates(student_id);
CREATE INDEX idx_status_updates_activity_date ON status_updates(student_activity_id, date);
CREATE INDEX idx_status_updates_checkin ON status_updates(related_checkin_id);
CREATE INDEX idx_status_updates_type ON status_updates(student_activity_id, status_type);

-- Presence waves (optional daily engagement)
CREATE TABLE presence_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  student_activity_id UUID NOT NULL REFERENCES student_activities(id),
  date DATE NOT NULL,
  waved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_wave_per_day UNIQUE (student_id, student_activity_id, date)
);

CREATE INDEX idx_presence_waves_student ON presence_waves(student_id);
CREATE INDEX idx_presence_waves_activity_date ON presence_waves(student_activity_id, date);
CREATE INDEX idx_presence_waves_streak ON presence_waves(student_id, student_activity_id, date);

-- Attendance status enum
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused', 'tardy');

-- Attendance records (official teacher-marked)
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL,
  notes TEXT,
  marked_by_teacher_id UUID NOT NULL REFERENCES user_profiles(id),
  related_checkin_id UUID REFERENCES check_ins(id),
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_student_session_date UNIQUE (student_id, session_id, date)
);

CREATE INDEX idx_attendance_student ON attendance_records(student_id);
CREATE INDEX idx_attendance_session ON attendance_records(session_id);
CREATE INDEX idx_attendance_date ON attendance_records(session_id, date);
CREATE INDEX idx_attendance_teacher ON attendance_records(marked_by_teacher_id);
CREATE INDEX idx_daily_attendance_lookup ON attendance_records(session_id, date);

-- Interactions (comments and reactions)
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  related_type TEXT NOT NULL,
  related_id UUID NOT NULL,
  
  parent_interaction_id UUID REFERENCES interactions(id),
  
  content_text TEXT,
  emoji_reaction TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT has_content CHECK (
    content_text IS NOT NULL OR emoji_reaction IS NOT NULL
  ),
  CONSTRAINT valid_related_type CHECK (
    related_type IN ('status_update', 'checkin', 'attendance', 'presence_wave')
  )
);

CREATE INDEX idx_interactions_related ON interactions(related_type, related_id);
CREATE INDEX idx_interactions_author ON interactions(author_id);
CREATE INDEX idx_interactions_parent ON interactions(parent_interaction_id);
CREATE INDEX idx_interactions_created ON interactions(created_at DESC);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'teacher_comment',
    'student_response',
    'checkin_reminder',
    'schedule_change',
    'attendance_marked'
  )),
  
  related_interaction_id UUID REFERENCES interactions(id),
  related_checkin_id UUID REFERENCES check_ins(id),
  related_attendance_id UUID REFERENCES attendance_records(id),
  
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'soft_deleted')),
  changed_by UUID REFERENCES user_profiles(id),
  change_summary TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get schedule template for a given date
CREATE OR REPLACE FUNCTION get_schedule_for_date(
  org_id UUID,
  check_date DATE
) RETURNS UUID AS $$
DECLARE
  template_id UUID;
BEGIN
  SELECT schedule_template_id INTO template_id
  FROM school_days
  WHERE organization_id = org_id 
    AND date = check_date;
  
  IF template_id IS NOT NULL THEN
    RETURN template_id;
  END IF;
  
  SELECT id INTO template_id
  FROM schedule_templates
  WHERE organization_id = org_id
    AND is_default = true
  LIMIT 1;
  
  RETURN template_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- User Profiles - Users can view profiles in their org
CREATE POLICY "Users can view profiles in their org"
  ON user_profiles FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Students: Read own enrollments
CREATE POLICY "Students read own enrollments"
  ON enrollments FOR SELECT
  USING (student_id = auth.uid());

-- Students: Create own check-ins
CREATE POLICY "Students create own check-ins"
  ON check_ins FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Students: Read/update own check-ins
CREATE POLICY "Students manage own check-ins"
  ON check_ins FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students update own check-ins"
  ON check_ins FOR UPDATE
  USING (student_id = auth.uid());

-- Teachers: Read all sessions in their org
CREATE POLICY "Teachers read all sessions"
  ON sessions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
  );

-- Teachers: Manage attendance
CREATE POLICY "Teachers manage attendance"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
  );

-- Admins: Full access to org data
CREATE POLICY "Admins full access to organizations"
  ON organizations FOR ALL
  USING (
    id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
  );

CREATE POLICY "Admins full access to academic_terms"
  ON academic_terms FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
  );

CREATE POLICY "Admins full access to schedule_templates"
  ON schedule_templates FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
  );

CREATE POLICY "Admins full access to school_days"
  ON school_days FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM user_profiles 
      WHERE id = auth.uid() AND 'admin' = ANY(roles)
    )
  );

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- Enrollment audit trigger function
CREATE OR REPLACE FUNCTION audit_enrollment_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, changed_by, change_summary, changes)
    VALUES (
      'enrollments',
      NEW.id,
      'updated',
      current_setting('app.user_id', true)::UUID,
      format('Updated enrollment for student %s', NEW.student_id),
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, changed_by, change_summary, changes)
    VALUES (
      'enrollments',
      NEW.id,
      'created',
      current_setting('app.user_id', true)::UUID,
      format('Created enrollment for student %s', NEW.student_id),
      jsonb_build_object('new', to_jsonb(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_enrollments
  AFTER INSERT OR UPDATE ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION audit_enrollment_changes();

-- Student activities audit trigger function
CREATE OR REPLACE FUNCTION audit_student_activity_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, changed_by, change_summary, changes)
    VALUES (
      'student_activities',
      NEW.id,
      'updated',
      current_setting('app.user_id', true)::UUID,
      format('Updated student activity for student %s', NEW.student_id),
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, changed_by, change_summary, changes)
    VALUES (
      'student_activities',
      NEW.id,
      'created',
      current_setting('app.user_id', true)::UUID,
      format('Created student activity for student %s', NEW.student_id),
      jsonb_build_object('new', to_jsonb(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_student_activities
  AFTER INSERT OR UPDATE ON student_activities
  FOR EACH ROW
  EXECUTE FUNCTION audit_student_activity_changes();
