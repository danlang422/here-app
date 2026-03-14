-- Migration: ensure_activity_instance SECURITY DEFINER function
-- Fixes: Students (and teachers) getting 403 on activity_instances upsert
--
-- Root cause: Supabase's .upsert() translates to INSERT ... ON CONFLICT DO UPDATE,
-- which requires an UPDATE policy. Students only have SELECT + INSERT policies on
-- activity_instances. When the row already exists (created by another user), the
-- ON CONFLICT DO UPDATE path fires and fails RLS.
--
-- Fix: A SECURITY DEFINER function that does INSERT ... ON CONFLICT DO NOTHING,
-- then returns the row. Bypasses RLS entirely (like the existing is_enrolled_in
-- and is_teacher_or_monitor_of functions). Org-scoped via JWT check.
--
-- Both student and teacher views call ensureActivityInstances on page load.
-- This function replaces the direct .upsert() call in src/api/instances.js.

CREATE OR REPLACE FUNCTION ensure_activity_instance(
  p_activity_id UUID,
  p_organization_id UUID,
  p_date DATE
)
RETURNS SETOF activity_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller belongs to the claimed organization
  IF p_organization_id != (
    (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'organization_id')::uuid
  ) THEN
    RAISE EXCEPTION 'Organization mismatch';
  END IF;

  -- Verify the activity belongs to this organization
  IF NOT EXISTS (
    SELECT 1 FROM activities
    WHERE id = p_activity_id
    AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Activity not found in organization';
  END IF;

  -- Insert if not exists
  INSERT INTO activity_instances (activity_id, organization_id, date)
  VALUES (p_activity_id, p_organization_id, p_date)
  ON CONFLICT (activity_id, date) DO NOTHING;

  -- Return the row (whether newly inserted or already existing)
  RETURN QUERY
    SELECT * FROM activity_instances
    WHERE activity_id = p_activity_id AND date = p_date;
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_activity_instance(UUID, UUID, DATE) TO authenticated;
