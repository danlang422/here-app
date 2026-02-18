-- Here App - Auth User Trigger Migration
-- Created: February 17, 2026
-- Description: Automatically creates a user_profiles stub when a new auth user
--              is created. Reads organization_id from user_metadata so that
--              whichever admin creates the user passes the correct org context.

-- ============================================================================
-- TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Read organization_id from metadata passed at user creation time.
  -- This allows multi-org support: the creating admin passes their org's ID
  -- via user_metadata: { organization_id: '...' }
  org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;

  -- If no org_id was passed in metadata, raise a clear error rather than
  -- silently creating an orphaned profile.
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
    NEW.raw_user_meta_data->>'preferred_name',  -- nullable, fine if absent
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')),
      '{}'::TEXT[]
    ),
    true
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();
