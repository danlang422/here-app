-- get_my_organization_id() and activity_is_visible_to_all() were each created
-- with `REVOKE ALL ... FROM PUBLIC` + `GRANT ... TO authenticated`, but never
-- got the explicit `REVOKE EXECUTE ... FROM anon` that is_enrolled_in(),
-- is_teacher_or_monitor_of(), and get_profile_display_info() received in
-- 20260513132120. Supabase's platform default grants EXECUTE to anon directly
-- at function-creation time; revoking from PUBLIC alone doesn't touch that.
--
-- Found during the ASVS V8 audit while verifying live grants against
-- docs/schema/10-rls-policies.md. No functional impact either way -- both
-- functions filter on auth.uid(), which is NULL for anon, so they always
-- returned NULL/false to unauthenticated callers. This closes the grant
-- layer gap for consistency with the other three SECURITY DEFINER helpers.

REVOKE EXECUTE ON FUNCTION public.get_my_organization_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.activity_is_visible_to_all(uuid) FROM anon;
