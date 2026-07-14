-- Found during the ASVS V8 audit: "Users update own profile" (id = auth.uid())
-- has no column-level restriction, so any authenticated user could self-elevate
-- via a direct PATCH to their own user_profiles row -- e.g. setting
-- roles = ['admin'], or organization_id to a different org's UUID to hop orgs
-- entirely. Not reachable through the app's own UI, but reachable via a direct
-- REST call with a valid session. No trigger or column-level grant existed to
-- compensate (Postgres RLS only restricts which row, not which columns).
--
-- Fix: a BEFORE UPDATE trigger that blocks changes to roles, organization_id,
-- or is_active unless the acting user (auth.uid()) already has 'admin' in
-- their own roles. Applies uniformly regardless of which RLS policy let the
-- UPDATE through (own-profile or admin-on-org), so legitimate admin edits to
-- other users are unaffected -- only self-escalation by a non-admin is blocked.
--
-- Verified live against real rows (each test wrapped in BEGIN/ROLLBACK):
-- non-admin self-elevation blocked, admin editing another user's role still
-- works, non-admin editing their own non-privileged field still works.

CREATE OR REPLACE FUNCTION public.prevent_privileged_self_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.roles IS DISTINCT FROM OLD.roles
      OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND NOT EXISTS (
       SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
     )
  THEN
    RAISE EXCEPTION 'Only admins may change roles, organization_id, or is_active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_privileged_self_edit
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_self_edit();
