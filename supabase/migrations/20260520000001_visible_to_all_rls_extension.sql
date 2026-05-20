-- ============================================================
-- RLS extension for visible_to_all_staff activities
--
-- Widens teacher read access on enrollments, activity_instances,
-- and attendance_records to include activities marked
-- visible_to_all_staff = true in the viewer's org.
--
-- Also widens teacher WRITE access on attendance_records for the
-- same condition (Path A — confirmed by admin intent: if an admin
-- marks an activity visible_to_all_staff, any teacher in the org
-- may take attendance on it).
-- ============================================================

-- ── Helper function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.activity_is_visible_to_all(activity_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM activities
    WHERE id = activity_id_param
      AND visible_to_all_staff = true
      AND organization_id = (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.activity_is_visible_to_all(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activity_is_visible_to_all(uuid) TO authenticated;

-- ── enrollments — teacher read extension ─────────────────────

CREATE POLICY "Teachers read visible-to-all enrollments"
  ON enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_is_visible_to_all(activity_id)
  );

-- ── activity_instances — teacher read extension ───────────────

CREATE POLICY "Teachers read visible-to-all instances"
  ON activity_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_is_visible_to_all(activity_id)
  );

-- ── attendance_records — teacher read extension ───────────────

CREATE POLICY "Teachers read visible-to-all attendance"
  ON attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE activity_is_visible_to_all(activity_id)
    )
  );

-- ── attendance_records — teacher write extension (Path A) ─────

CREATE POLICY "Teachers write visible-to-all attendance"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE activity_is_visible_to_all(activity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE activity_is_visible_to_all(activity_id)
    )
  );
