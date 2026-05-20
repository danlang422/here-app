-- ============================================================
-- Allow teachers to read activities marked visible_to_all_staff.
--
-- The 86.5 migration (000001) extended RLS on enrollments,
-- activity_instances, and attendance_records, but the activities
-- table itself still blocked non-assigned teachers from reading
-- those rows. This policy closes that gap so that the sidebar
-- query (getVisibleToAllActivitiesForDate) returns results.
-- ============================================================

CREATE POLICY "Teachers read visible-to-all activities"
  ON activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND visible_to_all_staff = true
    AND organization_id = (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  );
