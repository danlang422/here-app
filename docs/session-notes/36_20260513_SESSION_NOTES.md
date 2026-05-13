# Session 36 — May 13, 2026

## 36.1 — Supabase Security Advisor audit and remediation

**What happened:** Full pass through the Supabase Security Advisor, which was reporting 30 errors and 14 warnings. All errors and most warnings were resolved via database migrations applied directly through the Supabase MCP. No application code changes.

---

### Starting state

The Advisor reported:

- **30 errors** — all `rls_references_user_metadata`: RLS policies across every table were using `(auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid` to get the caller's org. `user_metadata` is user-editable and must never be used in a security context.
- **14 warnings** — broken into four categories:
  - `function_search_path_mutable` (2): `handle_new_auth_user` and `sync_enrollment_block` had no fixed `search_path`
  - `anon_security_definer_function_executable` (5): several SECURITY DEFINER functions were callable by unauthenticated users
  - `authenticated_security_definer_function_executable` (5): same functions flagged for authenticated access (expected and intentional for most; `handle_new_auth_user` was the real concern)
  - `public_bucket_allows_listing` (1): `feedback-screenshots` bucket had a broad SELECT policy
  - `auth_leaked_password_protection` (1): HaveIBeenPwned check disabled

---

### Migration 1 — `fix_rls_user_metadata`

Replaced all 30 `user_metadata` references across all RLS policies with `user_profiles` subqueries. The canonical replacement pattern:

```sql
-- Before (insecure):
(auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid

-- After (secure):
(SELECT organization_id FROM user_profiles WHERE id = auth.uid())
```

Affected tables: `organizations`, `user_profiles`, `academic_terms`, `schedule_templates`, `school_days`, `internship_opportunities`, `activities`, `enrollments`, `activity_instances`, `attendance_records`, `check_ins`, `checkin_activity_tags`, `presence_waves`, `status_updates`, `posts`, `post_responses`, `comments`, `notifications`, `audit_log`, `calendars`.

---

### Migration 2 — `fix_function_security`

Fixed the five affected functions:

- **`ensure_activity_instance`** — replaced internal `user_metadata` org check with `user_profiles` lookup
- **`get_profile_display_info`** — same
- **`is_teacher_or_monitor_of`** — same
- **`handle_new_auth_user`** — added `SET search_path = public`; reading from `raw_user_meta_data` at trigger time is correct and necessary (no profile exists yet at that point)
- **`sync_enrollment_block`** — added `SET search_path = public` (not SECURITY DEFINER, just needed the path fixed)

---

### Migrations 3 & 4 — `revoke_anon_execute_functions`, `revoke_public_execute_functions`

Initial attempt to revoke anon access via `REVOKE FROM anon` didn't stick — `anon` and `authenticated` inherit from `PUBLIC`, so the grant re-applies after `CREATE OR REPLACE`. Fixed by revoking from `PUBLIC` first, then re-granting to `authenticated` only:

```sql
REVOKE ALL ON FUNCTION public.fn_name(...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_name(...) TO authenticated;
```

Applied to: `ensure_activity_instance`, `get_profile_display_info`, `is_enrolled_in`, `is_teacher_or_monitor_of`. `handle_new_auth_user` revoked from both `PUBLIC` and `authenticated` (trigger only, not an RPC).

---

### Migration 5 — `fix_user_profiles_recursion`

After the `user_metadata` → `user_profiles` migration, the app broke on login with 500 errors. Root cause: the `"Users view org profiles"` policy on `user_profiles` was now self-referential — it queried `user_profiles` to get the caller's org, which triggered the policy again, causing infinite recursion.

**Fix:** introduced a new `get_my_organization_id()` SECURITY DEFINER function that fetches the caller's org outside of RLS context, breaking the cycle. Used in the `user_profiles` policies and available for any future policy that needs the caller's org without risking recursion.

```sql
CREATE OR REPLACE FUNCTION public.get_my_organization_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM user_profiles WHERE id = auth.uid();
$$;
```

This is the same architectural pattern as `is_enrolled_in` and `is_teacher_or_monitor_of` — SECURITY DEFINER functions as the recursion-breaking layer.

**Note:** The original design used `user_metadata` specifically to avoid this recursion. The correct long-term solution (now implemented) is `get_my_organization_id()`. See `docs/schema/10-rls-policies.md` for the full updated design principles.

---

### Migration 6 — `opt_out_default_grants` (manual, SQL editor)

Applied the Supabase breaking change opt-in (discussion #45329). New tables in `public` will no longer be auto-exposed to the Data API. From now on, new tables require explicit `GRANT` statements.

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated, service_role;
```

Existing tables are unaffected. The platform enforces this for all existing projects on October 30, 2026.

---

### Deferred items (documented, not resolved)

**`feedback-screenshots` public bucket** — The `feedback-screenshots` storage bucket is intentionally public. The `submit-feedback` edge function uploads screenshots using the service role, calls `getPublicUrl()`, and embeds the URL in the GitHub issue body so screenshots render inline. Making the bucket private would require a different approach (GitHub has no public API for uploading issue image attachments). Options reviewed:

- Keep public (current) — low practical risk; paths are UUID-scoped, app is internal
- Private bucket + link to admin dashboard instead of GitHub inline image
- Private bucket + base64 embed in GitHub issue body (GitHub may or may not render)
- Private bucket + short-lived signed URLs (expire, images go dead in old issues)

**Decision:** Keep public for now. Risk is low for an internal school app. Revisit if app scales or if GitHub adds an image upload API.

**Leaked password protection (HaveIBeenPwned check)** — This feature requires a Supabase Pro plan. Currently on Free tier. Enable when/if upgrading to Pro.

---

### Supabase breaking change: explicit GRANTs required (May 2026)

Supabase announced ([discussion #45329](https://github.com/orgs/supabase/discussions/45329)) that new tables in `public` will no longer be auto-exposed to the Data API. Timeline:

- **May 30, 2026** — new default for all new projects
- **October 30, 2026** — enforced on all existing projects

We opted in early (migration 6 above). **Any new table added to `public` from this point forward must include explicit GRANT statements** before it will be accessible via supabase-js:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated;
GRANT SELECT ON public.your_table TO anon; -- only if truly public
GRANT ALL ON public.your_table TO service_role;
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;
-- then add your policies
```

---

### Final Advisor state

After all migrations: **0 errors, 6 warnings**. Remaining warnings:

- `ensure_activity_instance`, `get_profile_display_info`, `is_enrolled_in`, `is_teacher_or_monitor_of` — flagged as authenticated-callable SECURITY DEFINER functions. This is expected and intentional; these functions are used in RLS policies and need to be callable by signed-in users.
- `feedback-screenshots` public bucket — deferred (see above)
- Leaked password protection — deferred (Pro plan required)
