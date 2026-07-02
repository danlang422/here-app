
-- ============================================================
-- Fix function security issues:
-- 1. Replace user_metadata references with user_profiles lookups
-- 2. Add SET search_path where missing
-- 3. Revoke anon EXECUTE on functions not meant for public use
-- ============================================================

-- ── ensure_activity_instance ─────────────────────────────────
-- Replace user_metadata org check with user_profiles lookup

CREATE OR REPLACE FUNCTION public.ensure_activity_instance(
  p_activity_id uuid,
  p_organization_id uuid,
  p_date date
)
RETURNS SETOF activity_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller belongs to the claimed organization
  IF p_organization_id != (
    SELECT organization_id FROM user_profiles WHERE id = auth.uid()
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

REVOKE EXECUTE ON FUNCTION public.ensure_activity_instance(uuid, uuid, date) FROM anon;

-- ── get_profile_display_info ─────────────────────────────────
-- Replace user_metadata org check with user_profiles lookup

CREATE OR REPLACE FUNCTION public.get_profile_display_info(profile_id uuid)
RETURNS TABLE(id uuid, first_name text, last_name text, preferred_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id, up.first_name, up.last_name, up.preferred_name
  FROM user_profiles up
  WHERE up.id = profile_id
    AND up.organization_id = (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_display_info(uuid) FROM anon;

-- ── handle_new_auth_user ─────────────────────────────────────
-- Add search_path; reading from raw_user_meta_data at creation
-- time is correct and necessary here (no profile exists yet).
-- Revoke direct RPC execution — this is a trigger only.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot create user profile: organization_id missing from user metadata';
  END IF;

  INSERT INTO public.user_profiles (
    id,
    organization_id,
    email,
    first_name,
    last_name,
    preferred_name,
    roles,
    is_active
  )
  VALUES (
    NEW.id,
    org_id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'preferred_name',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')),
      '{}'::TEXT[]
    ),
    true
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;

-- ── is_enrolled_in ───────────────────────────────────────────
-- Already clean internally; just revoke anon.

REVOKE EXECUTE ON FUNCTION public.is_enrolled_in(uuid) FROM anon;

-- ── is_teacher_or_monitor_of ─────────────────────────────────
-- Replace user_metadata org check with user_profiles lookup

CREATE OR REPLACE FUNCTION public.is_teacher_or_monitor_of(activity_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM activities
    WHERE id = activity_id_param
      AND (teacher_id = auth.uid() OR monitor_id = auth.uid())
      AND organization_id = (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_teacher_or_monitor_of(uuid) FROM anon;

-- ── sync_enrollment_block ────────────────────────────────────
-- Not SECURITY DEFINER, just needs search_path fixed.

CREATE OR REPLACE FUNCTION public.sync_enrollment_block()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.block IS DISTINCT FROM OLD.block THEN
    UPDATE enrollments
    SET block = NEW.block,
        updated_at = NOW()
    WHERE activity_id = NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;
;