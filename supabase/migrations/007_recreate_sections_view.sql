-- Migration: Recreate sections_with_enrollment_counts view to pick up new columns
-- This ensures the view includes attendance_enabled, presence_enabled, and presence_mood_enabled

-- Drop and recreate the view to ensure it includes all current columns from sections table
DROP VIEW IF EXISTS sections_with_enrollment_counts CASCADE;

CREATE VIEW sections_with_enrollment_counts AS
SELECT
  s.*,
  COALESCE(student_counts.active_student_count, 0) as active_student_count
FROM sections s
LEFT JOIN (
  SELECT
    section_id,
    COUNT(*) as active_student_count
  FROM section_students
  WHERE active = true
  GROUP BY section_id
) student_counts ON s.id = student_counts.section_id;

-- Grant access to authenticated users
GRANT SELECT ON sections_with_enrollment_counts TO authenticated;
GRANT SELECT ON sections_with_enrollment_counts TO service_role;

-- Add comment for documentation
COMMENT ON VIEW sections_with_enrollment_counts IS
'View that provides sections with pre-computed active student enrollment counts.
This eliminates N+1 query problems when fetching multiple sections.
Updated to include attendance and presence feature toggle columns.';
