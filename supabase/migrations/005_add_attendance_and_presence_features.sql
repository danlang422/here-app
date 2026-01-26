-- Migration: Add Attendance Records and Presence Features
-- Date: 2026-01-25
-- Description: Adds teacher-marked attendance, presence waves, and feature toggles

-- ============================================================================
-- ENUM UPDATES
-- ============================================================================

-- Add 'presence' to interaction_type enum
ALTER TYPE interaction_type ADD VALUE IF NOT EXISTS 'presence';

-- ============================================================================
-- TABLE UPDATES
-- ============================================================================

-- Add feature toggles to sections table
ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS attendance_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS presence_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS presence_mood_enabled BOOLEAN DEFAULT false;

-- Add comments explaining the new fields
COMMENT ON COLUMN public.sections.attendance_enabled IS 'Whether teacher-marked attendance is enabled for this section';
COMMENT ON COLUMN public.sections.presence_enabled IS 'Whether optional presence "waves" (👋 I''m here!) are enabled';
COMMENT ON COLUMN public.sections.presence_mood_enabled IS 'Whether mood emoji picker is shown after presence wave';

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- Attendance records (teacher-marked attendance)
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused', 'tardy')),
  marked_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, section_id, date)
);

-- Add comments
COMMENT ON TABLE public.attendance_records IS 'Teacher-marked attendance records (separate from student-initiated check-ins)';
COMMENT ON COLUMN public.attendance_records.status IS 'Attendance status: present, absent, excused, or tardy';
COMMENT ON COLUMN public.attendance_records.marked_by IS 'Teacher who marked the attendance';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Attendance records indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_student ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_section ON public.attendance_records(section_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON public.attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON public.attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_marked_by ON public.attendance_records(marked_by);
CREATE INDEX IF NOT EXISTS idx_attendance_records_section_date ON public.attendance_records(section_id, date);

-- Sections feature flags indexes (for filtering)
CREATE INDEX IF NOT EXISTS idx_sections_attendance_enabled ON public.sections(attendance_enabled) WHERE attendance_enabled = true;
CREATE INDEX IF NOT EXISTS idx_sections_presence_enabled ON public.sections(presence_enabled) WHERE presence_enabled = true;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on attendance_records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Students can view their own attendance records
CREATE POLICY "Students can view own attendance records"
  ON public.attendance_records FOR SELECT
  USING (student_id = auth.uid());

-- Teachers can view attendance records for students in their sections
CREATE POLICY "Teachers can view student attendance records"
  ON public.attendance_records FOR SELECT
  USING (
    public.user_has_role('teacher') AND
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      JOIN public.section_students ss ON st.section_id = ss.section_id
      WHERE st.section_id = attendance_records.section_id
      AND st.teacher_id = auth.uid()
      AND ss.student_id = attendance_records.student_id
    )
  );

-- Teachers can create attendance records for students in their sections
CREATE POLICY "Teachers can create attendance records"
  ON public.attendance_records FOR INSERT
  WITH CHECK (
    public.user_has_role('teacher') AND
    marked_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.section_teachers st
      JOIN public.section_students ss ON st.section_id = ss.section_id
      WHERE st.section_id = attendance_records.section_id
      AND st.teacher_id = auth.uid()
      AND ss.student_id = attendance_records.student_id
    )
  );

-- Teachers can update attendance records they created
CREATE POLICY "Teachers can update own attendance records"
  ON public.attendance_records FOR UPDATE
  USING (
    public.user_has_role('teacher') AND
    marked_by = auth.uid()
  );

-- Admins can view all attendance records
CREATE POLICY "Admins can view all attendance records"
  ON public.attendance_records FOR SELECT
  USING (public.user_has_role('admin'));

-- Admins can create/update attendance records
CREATE POLICY "Admins can manage attendance records"
  ON public.attendance_records FOR ALL
  USING (public.user_has_role('admin'))
  WITH CHECK (public.user_has_role('admin'));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Add updated_at trigger to attendance_records
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- NOTES
-- ============================================================================

-- Attendance vs Check-In Events:
-- - attendance_events: Student-initiated check-ins/outs with geolocation (for remote/internship)
-- - attendance_records: Teacher-marked attendance (for any section with attendance_enabled = true)
-- - These are complementary - check-in data informs attendance marking but doesn't replace it

-- Presence Interactions:
-- - Stored in interactions table with type = 'presence'
-- - content field holds mood emoji ('😊', '😐', '😓') or just '👋'
-- - No separate table needed - interactions already supports this pattern

-- Parent-Child Section Attendance:
-- - Attendance records stored on child sections (where enrollments exist)
-- - Teacher UI aggregates and displays under parent section
-- - See DECISIONS.md "Parent-Child Section Attendance Pattern" for details
