-- Migration: Add view and function for sections with enrollment counts
-- This resolves N+1 query issues by computing enrollment counts in a single query

-- ============================================================================
-- CREATE VIEW FOR SECTIONS WITH ENROLLMENT COUNTS
-- ============================================================================

-- Drop view if it exists (for idempotency)
DROP VIEW IF EXISTS sections_with_enrollment_counts CASCADE;

-- Create a view that includes active student enrollment counts
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
This eliminates N+1 query problems when fetching multiple sections.';

-- ============================================================================
-- CREATE FUNCTION TO GET SECTION WITH ENROLLMENT COUNT
-- ============================================================================

-- Drop function if it exists (for idempotency)
DROP FUNCTION IF EXISTS get_section_enrollment_count(UUID);

-- Function to get enrollment count for a single section
CREATE OR REPLACE FUNCTION get_section_enrollment_count(section_id_param UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::INTEGER
  FROM section_students
  WHERE section_id = section_id_param
    AND active = true;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_section_enrollment_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_section_enrollment_count TO service_role;

COMMENT ON FUNCTION get_section_enrollment_count IS
'Returns the count of active students enrolled in a specific section.';
