# Session 55 — July 14, 2026

## Overview

ASVS V8 (Authorization) L1 security audit, run via the `/asvs-audit` skill in conversation with Daniel. Unblocked by session 54's docs-freshness pass (`docs/schema/10-rls-policies.md` now matches live production state). All four V8 L1 requirements verified and marked `done`. Along the way, found and fixed three real issues in the live database — one of them a genuine privilege-escalation vulnerability, not just a documentation gap.

**Commit this session:** `c2bca6c`

## What was covered

Walked all four V8 L1 requirements with Daniel, using the skill's three-checkpoint pattern (A: Daniel understands the requirement/applicability call; B: agrees with the proposed fix; C: confident the fix is verified) before marking anything `done`:

- `v5.0.0-8.1.1` — authorization documentation
- `v5.0.0-8.2.1` — function-level access restricted to consumers with explicit permissions
- `v5.0.0-8.2.2` — data-specific access restricted to consumers with explicit permissions (IDOR/BOLA)
- `v5.0.0-8.3.1` — authorization enforced at a trusted service layer, not a client-manipulable control

## What was built

**`docs/architecture/here-security-decisions.md` § Authorization Policy** — the first non-stub section in this companion doc. Covers:
- Organizational isolation (every table scoped by `organization_id`, verified through `get_my_organization_id()`)
- The three-role model (student/teacher/admin, users can hold more than one)
- The `visible_to_all_staff` exception (admin-controlled per-activity opt-in override for "whoever's covering today takes attendance")
- The two enforcement layers: RLS (primary) and table grants (secondary, defense-in-depth — `anon` holds zero grants on any table)
- SECURITY DEFINER helper function scoping (bypass RLS deliberately, to avoid self-referential recursion, but each restricted to `authenticated` and internally scoped to the caller's own `auth.uid()`)
- Explicitly out of scope: field-level authorization within an already-authorized row (ASVS 8.2.3, L2) — accepted L1 posture, not an oversight

All four V8 rows in `here-asvs-l1-checklist.md` now carry detailed Evidence — not just a status label, per ASVS's own assessment guidance. `docs/schema/10-rls-policies.md` got incremental updates reflecting the three fixes below (not a rewrite — session 54 already brought it current).

## Three things found and fixed

All three were found by checking live production state directly (via Supabase MCP tools), not by reading migration files or policy text and assuming they matched reality — same methodology as session 54's docs pass and session 52's grant-hygiene work.

### 1. `anon` execute access on two SECURITY DEFINER helpers (minor)

While drafting the Authorization Policy section and checking actual function grants in the live database, found `get_my_organization_id()` and `activity_is_visible_to_all()` were still callable by the `anon` role — the other three SECURITY DEFINER helpers had already been locked down to `authenticated` only (session 36, migration `20260513132144`), but these two had been missed. No actual data exposure: both functions key off `auth.uid()`, which is `NULL` for an unauthenticated caller, so the functions would just return nothing useful to `anon` — but it's a grant-hygiene inconsistency worth closing to match the other three.

Fixed: `supabase/migrations/20260714171604_revoke_anon_execute_org_and_visibility_functions.sql`.

### 2. `user_profiles` privilege-escalation gap (the significant finding)

The own-row UPDATE RLS policy on `user_profiles` (`USING (id = auth.uid())`) had no column-level restriction. Any authenticated user could update their own row's `roles`, `organization_id`, or `is_active` columns via a direct REST/PostgREST call with nothing more than a valid session token — not reachable through the app's own UI (the profile-edit form never sends those fields), but reachable by anyone who knows how to call the Supabase REST API directly. Concretely: a student could have granted themselves `admin`, or moved their own row into a different organization's data.

This is exactly the kind of gap ASVS 8.2.1/8.2.2 is aimed at — a case where only client-side convention, not a backend control, stood between a user and a privilege they shouldn't have.

Fixed with a BEFORE UPDATE trigger, `prevent_privileged_self_edit()`, that blocks changes to `roles`/`organization_id`/`is_active` unless the acting user already holds `'admin'` in their own current roles. Migration: `supabase/migrations/20260714173806_prevent_privileged_self_edit.sql`.

**Verification method:** tested directly against real production rows using SQL transactions that always ended in `ROLLBACK` — no data was permanently changed. Confirmed:
- A non-admin attempting to set their own `roles` to include `admin` is blocked by the trigger.
- An admin editing a *different* user's role still succeeds (the trigger only gates self-edits by non-admins).
- A non-admin editing their own non-privileged fields (e.g. `preferred_name`) still succeeds — the trigger doesn't overreach into blocking legitimate self-service edits.

### 3. `activity_terms_staff_select` role-value typo (dead code, no exposure)

Flagged during session 54's docs pass, fixed here: the RLS policy `activity_terms_staff_select` checked for `'staff' = ANY(user_profiles.roles)`, but `'staff'` has never been an actual value assigned in `user_profiles.roles` (real values: `student`/`teacher`/`admin`) — a leftover typo from the original migration, which almost certainly meant `'teacher'`. This is dead code that fails closed (no teacher could ever read `activity_terms` via this specific policy branch) rather than a leak, so no security exposure — but it's a real functional bug.

Fixed: `supabase/migrations/20260714175823_fix_activity_terms_staff_role_typo.sql`.

## Verification methodology worth calling out

Beyond the three fixes above, `v5.0.0-8.2.2` (IDOR/BOLA) and `v5.0.0-8.3.1` (trusted service layer) were verified with direct live testing rather than by reading policy text and trusting it describes reality:

- **Cross-role/cross-student access:** simulated a real student's JWT claims and attempted to `SELECT` and `UPDATE` a different real student's `enrollments` and `attendance_records` rows — both blocked in both directions. Confirmed the test mechanics were sound with a positive control (the same query, run as the actual row owner, correctly returns/updates the row).
- **Teacher-scoping predicates tested directly, not just end-to-end:** every real teacher account in the live dataset also holds `admin`, which would mask a broken teacher-scoping policy behind the admin `ALL` grant in an end-to-end test. So `is_teacher_or_monitor_of()`, `activity_is_visible_to_all()`, and `is_enrolled_in()` were called directly as a teacher+admin account not staffed on a given activity — all correctly returned `false`.
- **Cross-org boundary, independent of role:** a scratch/throwaway organization row was created, tested against, and cleaned up (transaction rolled back — verified zero trace afterward) to confirm that even a real admin account cannot read or write a different organization's data. This establishes org-membership as an independent gate that role doesn't override.
- **Below the client, not just through it:** every test above was run as raw SQL with simulated JWT claims — equivalent to an attacker hitting PostgREST directly, bypassing the React app entirely. This is the direct evidence for `v5.0.0-8.3.1`: enforcement held in every case despite no client code being involved, which would be impossible if authorization were actually living in client-side JavaScript. The `user_profiles` self-edit gap above is the one real historical counterexample — a case where only client convention (the profile form's own field list) stood in for enforcement — which is exactly why it's now closed with a database trigger instead of relying on the form.

## What's ready for the next session

- V8 (Authorization) and V13 (Configuration) are the only two ASVS chapters marked `done` in `here-asvs-l1-checklist.md` — 5 of 70 L1 requirements verified overall. All other chapters (V1–V7, V9–V12, V14–V15) are still `not started` per the checklist file itself. V5 (File Handling) and V10 (OAuth/OIDC) are flagged in the checklist as likely N/A, not yet confirmed.
- No next chapter has been chosen. The `/asvs-audit` skill workflow (session 53) is unchanged and ready to run against whichever chapter is picked next.
- Otherwise unchanged from session 54: doc-update hook still dry-run only pending re-test of the `doc-updater` grounding fix; time-accuracy data pass; realtime `check_ins`/`presence_waves`; #61, #62, #21.
