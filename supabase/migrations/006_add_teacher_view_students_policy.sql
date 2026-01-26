-- Migration: Add Teachers Can View Student Profiles Policy
-- Date: 2026-01-26
-- Description: Allow teachers to view user profiles for students enrolled in their sections

-- Add RLS policy for teachers to view student profiles
CREATE POLICY "Teachers can view students in their sections"
  ON public.users FOR SELECT
  USING (
    public.user_has_role('teacher') AND
    EXISTS (
      SELECT 1 
      FROM public.section_students ss
      JOIN public.section_teachers st ON ss.section_id = st.section_id
      WHERE ss.student_id = users.id
      AND st.teacher_id = auth.uid()
      AND ss.active = true
    )
  );
