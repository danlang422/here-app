-- Found during the ASVS V8 audit while reviewing docs/schema/10-rls-policies.md:
-- activity_terms_staff_select (added in 20260320000000_terms_many_to_many.sql)
-- checked 'staff' = ANY(up.roles), but 'staff' has never been a valid role
-- value (real values: student/teacher/admin; a planned 'substitute' role from
-- issue #77 is still unbuilt). The migration's own comment reads "Staff
-- (teachers): read access..." -- 'staff' was used as an informal English word
-- for "teachers" in the comment, then typo'd into the actual role check.
--
-- This was dead code, not a leak: fail-closed (no teacher could read
-- activity_terms directly via this branch), not fail-open. Corrected to the
-- real role value.

DROP POLICY IF EXISTS activity_terms_staff_select ON activity_terms;
CREATE POLICY activity_terms_staff_select ON activity_terms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN user_profiles up ON up.organization_id = a.organization_id
      WHERE a.id = activity_terms.activity_id
        AND up.id = auth.uid()
        AND 'teacher' = ANY(up.roles)
    )
  );
