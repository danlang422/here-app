# Session 52 — July 2, 2026

## Overview

Two threads this session: (1) small housekeeping at the start of the day, and (2) a security audit and remediation pass covering the storage layer, RLS policies, and the migration ledger itself. The second thread was the bulk of the session — Daniel asked for an audit of demo-environment isolation options (separate Supabase project vs. a second org in the existing one), which surfaced two real, unrelated security gaps; those were fixed first, independent of the demo-environment decision (deferred as follow-up work).

## Commits this session

- `bae2d9e` — Re-add seed script (env-based credentials)
- `150f000` — npm audit fix update package-lock.json
- `0d35210` — fix public screenshot bucket and INSERT policies
- `8fd7942` — Reconcile migration ledger and close anon table-grant gap

---

## Morning housekeeping

### Seed script re-added

`scripts/seed.js` (216 lines) was re-added, provisioning the City View org and an initial admin user from `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` in `.env.local` (never committed). Safe to re-run — checks for existing records before inserting. The commit message says "re-add," implying it existed and was removed at some earlier point, but no prior deletion of this path is recoverable from git history — noted plainly rather than guessed at.

### `npm audit fix`

`package-lock.json` regenerated (428 insertions, 493 deletions) with no changes to `package.json` — transitive dependency bumps only, no direct dependency version changes.

---

## Security audit: demo-environment isolation options

Daniel asked for an investigation into two ways to let people demo Here without touching real City View data:

- **Option A** — a second `organization` row in the existing production Supabase project, relying on existing RLS for isolation.
- **Option B** — a fully separate, throwaway Supabase project.

The ask was explicitly audit-only up front — no implementation — covering RLS completeness (read every table's live policy, not just docs), application-layer fetch-all/hardcoded-org patterns, Edge Function and service-role scoping, and Supabase Storage bucket exposure (particularly `feedback-screenshots`).

**Findings, in summary** (full detail lives in project memory, not restated here since it predates today's fixes and would now read as stale): reads, Edge Functions, and app-layer org context were all soundly scoped. Two real gaps were found, both unrelated to the demo decision and both fixed later in this session (see below):

1. Six INSERT RLS policies checked row ownership (`student_id`/`author_id = auth.uid()`) but never verified the parent record belonged to the caller's own org — reachable via direct Supabase REST calls with any valid JWT, not through the app's own UI.
2. The `feedback-screenshots` storage bucket's SELECT policy had no auth check at all — any unauthenticated request could list and read every org's screenshots.

Also found: `src/lib/devOverrides.js` (the dev date/time override) is a compile-time global constant, not org-scoped — meaning both Option A and B would need their own frontend deployment, which erased Option A's main "simpler" argument.

**Recommendation:** Option B (separate demo project). **Decision:** confirmed by Daniel; building it out is explicitly deferred as separate follow-up work, not part of this session.

---

## Fix 1 — `feedback-screenshots` bucket made private

**Commit `0d35210`.**

The bucket was made public in an earlier session so `submit-feedback`'s screenshots could embed inline in GitHub Issues via `getPublicUrl()`. With the repo now public, the bucket's unauthenticated SELECT policy meant the storage *list* endpoint was also unauthenticated — anyone could enumerate and read every screenshot across every org.

- `supabase/migrations/20260702000001_feedback_screenshots_private_bucket.sql` — `UPDATE storage.buckets SET public = false`, drops both existing `storage.objects` policies (`Authenticated users can upload feedback screenshots`, `Public read for feedback screenshots`). No replacement policy needed: all bucket access now flows exclusively through `submit-feedback`'s service-role client, which bypasses RLS by design.
- `supabase/functions/submit-feedback/index.ts` — swapped `getPublicUrl()` for `createSignedUrl(storagePath, 315360000)` (10-year expiry; confirmed no plan-tier restriction on signed URL expiry). Deployed as edge function version 12 (version 11 had an accidental line-rewrite introduced while retyping content for the deploy call — functionally identical but an unrequested deviation, caught before it shipped and corrected).
- Verified no other code path consumed the bucket or `getPublicUrl()` before changing anything (`src/components/feedback/ScreenshotPicker.jsx` only does a local `URL.createObjectURL` preview; never touches Supabase Storage directly).

## Fix 2 — six INSERT policy org-scoping gaps

**Commit `0d35210`**, `supabase/migrations/20260702000002_fix_insert_policy_org_scoping.sql`.

`check_ins`, `presence_waves`, `status_updates`, `post_responses`, `comments`, `notifications` — each fixed to also verify the parent record's org matches the caller's, using the existing `get_my_organization_id()` helper. `comments` and `notifications` have no `organization_id` column, so each needed its own join path:

- `check_ins` / `presence_waves` / `status_updates` — join to `activity_instances.organization_id`
- `post_responses` — join through `posts` → `activity_instances`
- `comments` — mirrors the existing SELECT policy's three-way OR branch (`post_id` / `post_response_id` / `status_update_id`, each joined back to `activity_instances`)
- `notifications` — no parent activity at all; checks the recipient (`notifications.user_id`) belongs to the same org as the caller via a `user_profiles`-to-`user_profiles` join, per explicit instruction not to add a redundant `organization_id` column

Verified live via `pg_policy`/`pg_get_expr()` queries against production after deploy — all six `WITH CHECK` expressions matched the migration exactly.

---

## Migration ledger reconciliation + anon table-grant revoke

**Commit `8fd7942`.** Separate task, prompted by `supabase db diff --linked` failing outright while prepping for the (deferred) demo-project work.

### The ledger problem

Six May 13 migration files shared an identical placeholder filename timestamp (`20260513000000_*`), which `supabase db diff --linked` chokes on as a duplicate key. Renamed via `git mv` to their actual applied-in-production timestamps (confirmed against `supabase migrations list`):

| Old | New |
|---|---|
| `20260513000000_fix_rls_user_metadata.sql` | `20260513132022_fix_rls_user_metadata.sql` |
| `20260513000000_fix_function_security.sql` | `20260513132044_fix_function_security.sql` |
| `20260513000000_revoke_anon_execute_functions.sql` | `20260513132120_revoke_anon_execute_functions.sql` |
| `20260513000000_revoke_public_execute_functions.sql` | `20260513132144_revoke_public_execute_functions.sql` |
| `20260513000000_fix_user_profiles_recursion.sql` | `20260513141142_fix_user_profiles_recursion.sql` |
| `20260513000000_revoke_default_privilges.sql` | `20260513141200_revoke_default_privilges.sql` (no prior ledger entry existed for this one; timestamp is arbitrary but chronologically plausible) |

Eight additional migrations that had been applied via the Supabase dashboard SQL editor (not the CLI) were recorded in the ledger via `supabase migration repair --status applied`, without re-executing any SQL: `20260513141200`, `20260514000001`, `20260514000002`, `20260520000001`, `20260520000002`, `20260521000001`, `20260526000001`, `20260625000001`.

### New finding during verification: `anon` had full table grants

`db diff --linked` came back non-empty even after the ledger matched — a large block of `GRANT ... TO anon` statements across nearly every `public` table. Direct query against production confirmed: **`anon` held full SELECT/INSERT/UPDATE/DELETE on every table except `activity_staff`** (protected only incidentally, by having been created after the relevant migration ran).

**Root cause:** `20260513141200_revoke_default_privilges.sql` used `ALTER DEFAULT PRIVILEGES`, which only governs objects created *after* it runs — it never touched the grants already sitting on every pre-existing table. RLS was providing real protection throughout (every policy keys off `auth.uid()`/`get_my_organization_id()`, both `NULL` for `anon`, and `NULL` comparisons fail closed) — but the grant layer, meant as an independent second line of defense, was effectively absent for `anon` on nearly the whole schema.

Before touching anything: searched the codebase for any pre-login `.from(...)` table query. None found — every table query fires only after an authenticated session exists (`fetchProfile` in `useAuthListener`, gated on `session?.user`; everything else behind `ProtectedRoute`). Public/auth-flow pages (`/`, `/trust`, `/about`, `/login`, `/forgot-password`, `/reset-password`) contain zero table queries — only `supabase.auth.*` calls against the `auth` schema, unaffected by a `public`-schema revoke.

Fixed with `supabase/migrations/20260702000003_revoke_anon_inherited_table_grants.sql`:

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
```

Applied via `supabase db push` (not the MCP `apply_migration` tool — see below).

### Verification detour: two Supabase MCP quirks surfaced

1. **`apply_migration` (MCP) records its own version, not the file's.** The two migrations from Fix 1/2 (`20260702000001`, `20260702000002`) were originally applied via the Supabase MCP tool rather than the CLI. The MCP tool recorded the migration under a timestamp-of-application (`20260702145307`, `20260702145344`) instead of the filename's version. `migration list --linked` showed this as two unmatched pairs until repaired: `migration repair --status reverted` on the MCP-generated versions, `--status applied` on the real filenames — confirmed by direct content comparison against production first (byte-identical policies/bucket state under both version numbers).
2. **`migra`'s ACL diffing re-emits full grants on any privilege change.** After the `anon` revoke, `db diff --linked` still showed ~120 `GRANT ... TO authenticated/service_role` statements — not a real gap. Postgres stores each relation's ACL as one array attribute (`pg_class.relacl`); diffing tools that detect *any* ACL change on a relation commonly re-emit the relation's full target ACL rather than a per-role delta. Confirmed directly against production: `authenticated`/`service_role` grants were byte-for-byte unchanged before and after. No action needed.

Both `db push` and `db diff --linked` also hit intermittent Cloudflare 504 gateway timeouts against `api.supabase.com` during this session — transient infra flakiness, resolved by retrying (succeeded on retry every time, no root-cause action taken).

### Final verification

- `migration list --linked`: 38/38 entries matched, local and remote identical.
- `db diff --linked`: clean except the two pre-confirmed-harmless items (`pg_net` extension drop — local-shadow-only artifact, not present on production; `is_teacher_or_monitor_of()` recreation — function body verified byte-identical against `20260526000001_activity_staff_junction.sql`, difference was CRLF-vs-LF line endings only).
- Supabase Security Advisor: `public_bucket_allows_listing` warning cleared; no new warnings introduced.
- Manual login sanity test: Daniel confirmed both student and teacher roles log in and function normally against the local dev server (pointed at production). Deeper feature-by-feature testing would have required exercising the dev date/time override — judged unnecessary for this change's blast radius (grant/policy layer only, no schema or app-code changes).

### CLAUDE.md changelog

Updated to reflect the six renamed filenames and to add entries for `20260625000001` (keep-alive `ping()` function), `20260702000001`, `20260702000002`, and `20260702000003` — see `CLAUDE.md`'s Database section for the current list.

---

## Documentation catch-up (this note)

Sessions 48–52 (this file) were written retroactively in a single documentation catch-up pass, prompted by Daniel noticing `STATUS.md` and session notes had fallen behind. Boundary was the most recent existing session note (47, dated 2026-06-01) forward through today's commits. `STATUS.md` and `CLAUDE.md` updated accordingly — see `CLAUDE.md` for the removed `docs/learning/` references (stale since session 51's deletion, never cleaned up until now).

## What's ready for the next session

- Migration ledger is clean; `anon` has zero table access; `db diff --linked` reads clean modulo the two confirmed-harmless artifacts.
- Demo-environment build-out (Option B: separate Supabase project) is the next piece of that thread — not started, no decisions made beyond "which option."
- Next priorities otherwise unchanged from session 47: time-accuracy data pass, realtime `check_ins`/`presence_waves` (#80 follow-on), #61, #62, #21.
