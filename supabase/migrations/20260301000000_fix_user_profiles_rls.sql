-- Fix infinite recursion in user_profiles RLS policies.
--
-- The original "Users view org profiles" policy used a subquery against
-- user_profiles itself to check the caller's organization_id, which caused
-- PostgreSQL to detect infinite recursion and return a 500 error.
--
-- Fix: split into two policies:
-- 1. Users can always read their own row (no subquery needed)
-- 2. Users can read other profiles in their org using auth.jwt() metadata
--    instead of a self-referential subquery

-- Drop the original recursive policy
DROP POLICY IF EXISTS "Users view org profiles" ON user_profiles;

-- Users can always read their own profile
CREATE POLICY "Users read own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

-- Users can view other profiles in their org (reads org_id from JWT, not from the table)
CREATE POLICY "Users view org profiles"
  ON user_profiles FOR SELECT
  USING (
    organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );
