
-- "Users view org profiles" was causing infinite recursion:
-- to evaluate the policy, Postgres queries user_profiles to get org_id,
-- which re-evaluates the policy, which queries user_profiles again, etc.
--
-- Fix: use a SECURITY DEFINER function to get the caller's org_id
-- outside of RLS context, breaking the recursion.

CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM user_profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_organization_id() TO authenticated;

-- Rewrite the recursive policies to use the helper function instead

DROP POLICY IF EXISTS "Users view org profiles" ON public.user_profiles;
CREATE POLICY "Users view org profiles" ON public.user_profiles
  FOR SELECT USING (
    organization_id = public.get_my_organization_id()
  );

DROP POLICY IF EXISTS "Admins update org profiles" ON public.user_profiles;
CREATE POLICY "Admins update org profiles" ON public.user_profiles
  FOR UPDATE USING (
    organization_id = public.get_my_organization_id()
    AND EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND 'admin' = ANY(up.roles)
        AND up.organization_id = user_profiles.organization_id
    )
  );
;