
-- REVOKE must come AFTER CREATE OR REPLACE, not before.
-- These functions are only meant for authenticated users.

REVOKE EXECUTE ON FUNCTION public.ensure_activity_instance(uuid, uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_profile_display_info(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_enrolled_in(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher_or_monitor_of(uuid) FROM anon;
;