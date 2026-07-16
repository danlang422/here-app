-- ASVS v5.0.0-2.2.2: user_profiles.roles had no DB-level constraint restricting
-- values to the three real roles. Client code (UserForm's checkboxes,
-- BulkUserEntry's allow-list validation) prevented this through the UI, but a
-- direct authenticated REST call to PostgREST could write an arbitrary string
-- into roles, which is read by RLS policies and the app's own role-gated
-- routing. Found during the V2 audit (session 58).
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_roles_valid CHECK (
    roles <@ ARRAY['student', 'teacher', 'admin']::text[]
  );
