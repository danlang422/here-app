-- Here App Initial Schema Migration
-- This migration creates all tables, indexes, RLS policies, and seeds initial data

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE role_name AS ENUM ('student', 'teacher', 'admin', 'mentor');
CREATE TYPE section_type AS ENUM ('in_person', 'remote', 'internship');
CREATE TYPE schedule_pattern AS ENUM ('every_day', 'specific_days', 'a_days', 'b_days');
CREATE TYPE ab_designation AS ENUM ('a_day', 'b_day');
CREATE TYPE event_type AS ENUM ('check_in', 'check_out');
CREATE TYPE prompt_trigger AS ENUM ('check_in', 'check_out', 'custom');
CREATE TYPE interaction_type AS ENUM ('prompt_response', 'comment', 'message');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  primary_role role_name NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- Roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name role_name UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles (many-to-many)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Calendar days
CREATE TABLE public.calendar_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE UNIQUE NOT NULL,
  is_school_day BOOLEAN NOT NULL DEFAULT true,
  ab_designation ab_designation,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Internship opportunities
CREATE TABLE public.internship_opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  description TEXT,
  location JSONB, -- {formatted_address, lat, lng, place_id}
  geofence_radius INTEGER DEFAULT 100,
  mentor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  contact_phone TEXT,
  contact_email TEXT,
  available_slots INTEGER,
  is_active BOOLEAN DEFAULT true,
  requirements TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sections (schedule blocks)
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type section_type NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  schedule_pattern schedule_pattern NOT NULL,
  days_of_week JSONB, -- Array of day numbers [1,2,3,4,5] for M-F
  sis_block INTEGER,
  internship_opportunity_id UUID REFERENCES public.internship_opportunities(id) ON DELETE SET NULL,
  expected_location JSONB, -- {formatted_address, lat, lng, place_id}
  geofence_radius INTEGER DEFAULT 100,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Section teachers (many-to-many)
CREATE TABLE public.section_teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section_id, teacher_id)
);

-- Section students (enrollment, many-to-many)
CREATE TABLE public.section_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, section_id)
);

-- Prompts (questions for check-in/out)
CREATE TABLE public.prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  trigger_event prompt_trigger NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance events (check-ins and check-outs)
CREATE TABLE public.attendance_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location JSONB, -- {lat, lng}
  location_verified BOOLEAN DEFAULT true,
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interactions (prompt responses, comments, messages)
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type interaction_type NOT NULL,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_role role_name NOT NULL,
  parent_id UUID REFERENCES public.interactions(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES public.prompts(id) ON DELETE SET NULL,
  attendance_event_id UUID REFERENCES public.attendance_events(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_primary_role ON public.users(primary_role);

-- User Roles
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role_id);

-- Roles
CREATE INDEX idx_roles_name ON public.roles(name);

-- Calendar
CREATE INDEX idx_calendar_date ON public.calendar_days(date);
CREATE INDEX idx_calendar_school_days ON public.calendar_days(is_school_day);
CREATE INDEX idx_calendar_ab ON public.calendar_days(ab_designation);

-- Internship Opportunities
CREATE INDEX idx_opportunities_active ON public.internship_opportunities(is_active);
CREATE INDEX idx_opportunities_mentor ON public.internship_opportunities(mentor_id);

-- Sections
CREATE INDEX idx_sections_type ON public.sections(type);
CREATE INDEX idx_sections_pattern ON public.sections(schedule_pattern);
CREATE INDEX idx_sections_opportunity ON public.sections(internship_opportunity_id);

-- Section Teachers
CREATE INDEX idx_section_teachers_section ON public.section_teachers(section_id);
CREATE INDEX idx_section_teachers_teacher ON public.section_teachers(teacher_id);

-- Section Students
CREATE INDEX idx_section_students_student ON public.section_students(student_id);
CREATE INDEX idx_section_students_section ON public.section_students(section_id);
CREATE INDEX idx_section_students_active ON public.section_students(active);

-- Attendance Events
CREATE INDEX idx_attendance_student ON public.attendance_events(student_id);
CREATE INDEX idx_attendance_section ON public.attendance_events(section_id);
CREATE INDEX idx_attendance_timestamp ON public.attendance_events(timestamp);
CREATE INDEX idx_attendance_type ON public.attendance_events(event_type);
CREATE INDEX idx_attendance_needs_verification ON public.attendance_events(verified_by) 
  WHERE verified_by IS NULL AND location_verified = false;

-- Interactions
CREATE INDEX idx_interactions_author ON public.interactions(author_id);
CREATE INDEX idx_interactions_type ON public.interactions(type);
CREATE INDEX idx_interactions_parent ON public.interactions(parent_id);
CREATE INDEX idx_interactions_attendance ON public.interactions(attendance_event_id);
CREATE INDEX idx_interactions_section ON public.interactions(section_id);
CREATE INDEX idx_interactions_created ON public.interactions(created_at DESC);

-- Prompts
CREATE INDEX idx_prompts_trigger ON public.prompts(trigger_event);
CREATE INDEX idx_prompts_active ON public.prompts(is_active);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internship_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has a role
CREATE OR REPLACE FUNCTION public.user_has_role(check_role role_name)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name = check_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users table policies
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (public.user_has_role('admin'));

CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (public.user_has_role('admin'));

CREATE POLICY "Admins can update all users"
  ON public.users FOR UPDATE
  USING (public.user_has_role('admin'));

-- Roles table policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view roles"
  ON public.roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- User roles policies
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT
  USING (public.user_has_role('admin'));

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- Calendar days policies (read for all authenticated, write for admins)
CREATE POLICY "Authenticated users can view calendar"
  ON public.calendar_days FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage calendar"
  ON public.calendar_days FOR ALL
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- Internship opportunities policies
CREATE POLICY "Authenticated users can view active opportunities"
  ON public.internship_opportunities FOR SELECT
  USING (is_active = true OR public.user_has_role('admin'));

CREATE POLICY "Admins can manage opportunities"
  ON public.internship_opportunities FOR ALL
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- Sections policies
CREATE POLICY "Students can view own sections"
  ON public.sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.section_students ss
      WHERE ss.section_id = sections.id
      AND ss.student_id = auth.uid()
      AND ss.active = true
    )
  );

CREATE POLICY "Teachers can view assigned sections"
  ON public.sections FOR SELECT
  USING (
    public.user_has_role('teacher') AND
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.section_id = sections.id
      AND st.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all sections"
  ON public.sections FOR SELECT
  USING (public.user_has_role('admin'));

CREATE POLICY "Admins can manage sections"
  ON public.sections FOR ALL
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- Section teachers policies
CREATE POLICY "Teachers can view own assignments"
  ON public.section_teachers FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Admins can view all section teachers"
  ON public.section_teachers FOR SELECT
  USING (public.user_has_role('admin'));

CREATE POLICY "Admins can manage section teachers"
  ON public.section_teachers FOR ALL
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- Section students policies
CREATE POLICY "Students can view own enrollments"
  ON public.section_students FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view enrollments in their sections"
  ON public.section_students FOR SELECT
  USING (
    public.user_has_role('teacher') AND
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      WHERE st.section_id = section_students.section_id
      AND st.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all enrollments"
  ON public.section_students FOR SELECT
  USING (public.user_has_role('admin'));

CREATE POLICY "Admins can manage enrollments"
  ON public.section_students FOR ALL
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- Prompts policies
CREATE POLICY "Authenticated users can view active prompts"
  ON public.prompts FOR SELECT
  USING (is_active = true OR public.user_has_role('admin'));

CREATE POLICY "Admins can manage prompts"
  ON public.prompts FOR ALL
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- Attendance events policies
CREATE POLICY "Students can view own attendance"
  ON public.attendance_events FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can create own attendance"
  ON public.attendance_events FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view student attendance in their sections"
  ON public.attendance_events FOR SELECT
  USING (
    public.user_has_role('teacher') AND
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      JOIN public.section_students ss ON st.section_id = ss.section_id
      WHERE st.section_id = attendance_events.section_id
      AND st.teacher_id = auth.uid()
      AND ss.student_id = attendance_events.student_id
    )
  );

CREATE POLICY "Mentors can view mentee attendance"
  ON public.attendance_events FOR SELECT
  USING (
    public.user_has_role('mentor') AND
    EXISTS (
      SELECT 1 FROM public.sections s
      JOIN public.internship_opportunities io ON s.internship_opportunity_id = io.id
      WHERE s.id = attendance_events.section_id
      AND io.mentor_id = auth.uid()
    )
  );

CREATE POLICY "Mentors can verify attendance"
  ON public.attendance_events FOR UPDATE
  USING (
    public.user_has_role('mentor') AND
    EXISTS (
      SELECT 1 FROM public.sections s
      JOIN public.internship_opportunities io ON s.internship_opportunity_id = io.id
      WHERE s.id = attendance_events.section_id
      AND io.mentor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all attendance"
  ON public.attendance_events FOR SELECT
  USING (public.user_has_role('admin'));

-- Interactions policies
CREATE POLICY "Users can view own interactions"
  ON public.interactions FOR SELECT
  USING (author_id = auth.uid());

CREATE POLICY "Students can view interactions on own attendance"
  ON public.interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_events ae
      WHERE ae.id = interactions.attendance_event_id
      AND ae.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view interactions in their sections"
  ON public.interactions FOR SELECT
  USING (
    public.user_has_role('teacher') AND
    (
      EXISTS (
        SELECT 1 FROM public.attendance_events ae
        JOIN public.section_students ss ON ae.student_id = ss.student_id
        JOIN public.section_teachers st ON ss.section_id = st.section_id
        WHERE ae.id = interactions.attendance_event_id
        AND st.teacher_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.section_teachers st
        WHERE st.section_id = interactions.section_id
        AND st.teacher_id = auth.uid()
      )
    )
  );

CREATE POLICY "Mentors can view interactions for mentees"
  ON public.interactions FOR SELECT
  USING (
    public.user_has_role('mentor') AND
    EXISTS (
      SELECT 1 FROM public.attendance_events ae
      JOIN public.sections s ON ae.section_id = s.id
      JOIN public.internship_opportunities io ON s.internship_opportunity_id = io.id
      WHERE ae.id = interactions.attendance_event_id
      AND io.mentor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all interactions"
  ON public.interactions FOR SELECT
  USING (public.user_has_role('admin'));

CREATE POLICY "Users can create interactions"
  ON public.interactions FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can update own interactions"
  ON public.interactions FOR UPDATE
  USING (author_id = auth.uid());

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert roles
INSERT INTO public.roles (name, description) VALUES
  ('student', 'Student user with access to their schedule and check-ins'),
  ('teacher', 'Teacher with access to student data and attendance'),
  ('admin', 'Administrator with full system access'),
  ('mentor', 'Mentor for internship students');

-- Insert default prompts
INSERT INTO public.prompts (content, trigger_event, is_active) VALUES
  ('What are your plans for this session?', 'check_in', true),
  ('What progress did you make?', 'check_out', true);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.internship_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
