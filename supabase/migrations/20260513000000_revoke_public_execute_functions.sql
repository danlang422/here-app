
-- Revoke from PUBLIC first (which is what anon/authenticated inherit from),
-- then grant back only to authenticated where appropriate.

-- ensure_activity_instance: authenticated only (called by teachers/admins in-app)
REVOKE ALL ON FUNCTION public.ensure_activity_instance(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_activity_instance(uuid, uuid, date) TO authenticated;

-- get_profile_display_info: authenticated only
REVOKE ALL ON FUNCTION public.get_profile_display_info(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_display_info(uuid) TO authenticated;

-- handle_new_auth_user: trigger only, no direct RPC calls
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

-- is_enrolled_in: authenticated only (used in RLS for students)
REVOKE ALL ON FUNCTION public.is_enrolled_in(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in(uuid) TO authenticated;

-- is_teacher_or_monitor_of: authenticated only (used in RLS for teachers)
REVOKE ALL ON FUNCTION public.is_teacher_or_monitor_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher_or_monitor_of(uuid) TO authenticated;
;