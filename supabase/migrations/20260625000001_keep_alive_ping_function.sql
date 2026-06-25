-- Creates a lightweight ping function for the GitHub Actions keep-alive workflow.
-- The anon key can call this via /rest/v1/rpc/ping, generating real database
-- activity without needing the service role / secret key.

CREATE OR REPLACE FUNCTION public.ping()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT 'pong'::text $$;

-- Allow the anon role to call it (no RLS needed — it returns no user data)
GRANT EXECUTE ON FUNCTION public.ping() TO anon;
