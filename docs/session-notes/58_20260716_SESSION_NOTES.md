# Session 58 — July 16, 2026

## Overview

ASVS V2 (Validation and Business Logic) L1 security audit, run via the `/asvs-audit` skill — the chapter STATUS.md's Next Steps section had already scoped as next, specifically to close the recovery-link session gap found in passing during session 57's V7 audit. All 4 L1 rows are now recorded `done`/`fixed` in `docs/architecture/here-asvs-l1-checklist.md`; `docs/architecture/here-security-decisions.md`'s **Input Validation Policy** section (previously a stub) is now written, plus an addendum to the **Session Management Policy** — actually the **Authentication & Anti-Automation Policy** section, since the fix touches recovery/invite flows — documenting the new fix.

**Commits this session, in order:**
1. `42e0e59` — "docs: asvs-audit skill checks STATUS.md before asking which chapter" (mid-session, requested by Daniel)
2. `10fbb2f` — "security: ASVS V2 (Validation and Business Logic) — all 4 L1 rows complete"

## Skill update (commit `42e0e59`)

Mid-session, Daniel asked for the `/asvs-audit` skill itself to be updated: it was asking which chapter to work on next, when the answer is often already written into STATUS.md's Next Steps section by the end of the prior chapter's session (exactly the case here — session 57 ended by scoping V2/`2.3.1` explicitly). Updated `.claude/skills/asvs-audit/SKILL.md`'s "The loop, per chapter" section so step 1 now says to check STATUS.md's Next Steps first, and only fall back to scanning the checklist and asking Daniel if STATUS.md doesn't already answer it.

## What the audit found

### v5.0.0-2.1.1 (Documentation) — done

A full codebase survey compiled the Input Validation Policy: every DB `CHECK` constraint across all migrations, plus every React Hook Form validation rule across all forms, organized by data item and tagged with which layer actually enforces it (DB — trusted, can't be bypassed by a client — vs. form-level-only — UX, not a security control). This survey is also what surfaced the real gap fixed under 2.2.1/2.2.2 below.

### v5.0.0-2.2.1 / v5.0.0-2.2.2 (Implementation) — fixed

The survey found `user_profiles.roles` had no DB-level constraint restricting values to `student`/`teacher`/`admin` — only client-side allow-list validation in `BulkUserEntry.jsx` and `UserForm.jsx`. Since `roles` is read directly by RLS policies and the app's own role-gated routing, a direct authenticated REST call to PostgREST (bypassing the app's UI entirely) could have written an arbitrary string into it.

Fixed with a new migration, `supabase/migrations/20260716120000_user_profiles_roles_check.sql`:

```sql
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_roles_valid CHECK (
    roles <@ ARRAY['student', 'teacher', 'admin']::text[]
  );
```

Verified live against the production Supabase project (project ref `hrvscogebrngpcyfhlzo`) via the Supabase MCP tools: a negative test (INSERT with an invalid role) was rejected, citing the constraint by name; the `ALTER TABLE ADD CONSTRAINT` itself validated all existing production rows cleanly as a positive control (no bad data existed in production to begin with).

Also discussed and confirmed with Daniel, in conversation, that check-in geofence validation (`geofence_validated`, computed client-side from device GPS, never recomputed server-side) is *not* a gap under 2.2.2 — it's a deliberate design choice, not a missed server-side check. A failed geofence check still allows check-in (the attendance timestamp matters more than location precision for internship monitoring), and a "not validated" badge is shown to staff afterward for follow-up. Recorded as such in the policy doc rather than left as an unexplained absence.

### v5.0.0-2.3.1 (Implementation) — fixed, the main event

This closes the gap explicitly scoped from session 57. A recovery/invite-link session let a user skip the required password-set step and land fully authenticated in their dashboard, simply by navigating away from `/reset-password` before submitting a new password. Daniel manually reproduced this before any fix was written: clicking a real recovery link, then deleting `/reset-password` from the URL bar, landed cleanly in the dashboard with no password ever set.

Session 56's fix only did a one-time redirect on the `PASSWORD_RECOVERY` auth event — it had no persisted "this session still owes a password change" state, so navigating away defeated it entirely.

**The fix** is a durable, session-derived gate instead of an event-triggered one, spanning three files:

- `src/lib/authUtils.js` (new file) — `needsPasswordSetup(session)` decodes the session's JWT `amr` (Authentication Methods Reference) claim and checks whether the session's most recent auth method indicates an incomplete recovery/invite flow.
- `src/store/authStore.js` — `setSession()` (the single choke point hit on both page-load `getSession()` and every `onAuthStateChange` event, including token refresh) now derives a `passwordSetupPending` flag fresh every time, not from a one-time event flag.
- `src/components/layout/ProtectedRoute.jsx` — forces a redirect to `/reset-password` whenever `passwordSetupPending` is true, checked on every render of every protected route, ahead of the existing role checks.
- `src/pages/auth/ResetPassword.jsx` — now calls `signOut()` immediately after a successful password update (previously just navigated to `/login` while leaving the recovery session live). Necessary because changing a password isn't itself a new authentication event, so without ending the session the gate would loop forever.

## Two real bugs caught by live testing, before the fix shipped

Worth recording as examples of why this audit tests live rather than trusting code review alone:

1. **JWT decode bug.** The first version of `needsPasswordSetup`'s JWT decoder used browser `atob()` directly on the unpadded base64url token, which throws on non-multiple-of-4-length input. The throw was silently caught by a `try/catch`, making the gate permanently a no-op regardless of session state — it would have shipped completely inert. Daniel's manual re-test (clicking a real link, deleting `/reset-password` from the URL, landing in the dashboard) caught this immediately. Fixed by padding the base64url string before decoding.

2. **Wrong `amr` values.** The fix's initial design gated on `amr` method values `'recovery'`/`'invite'`, based on Supabase's public JWT claims documentation. But decoding a real session's JWT — from a link Daniel provided directly — showed Supabase's actual GoTrue server stamps both recovery *and* invite links with method `'otp'` instead, since its `/verify` endpoint is a shared OTP-verification path for signup/recovery/invite/magic-link/email-change. The check was corrected to gate on `'otp'` (keeping `'recovery'`/`'invite'` as a defensive fallback), confirmed safe for this app specifically since Here has no magic-link sign-in, self-serve signup, or email-change flow — recovery/invite links are the only way a session is ever established via OTP verification here.

## Verification

In order:

**(a) Synthetic JWTs, four deterministic scenarios.** Unsigned JWTs (faithful test of the actual code path, since our client-side routing logic never checks the signature — only the server does) were injected directly into browser localStorage via Playwright:
- A `recovery`-method session navigating to bare `/` was correctly bounced to `/reset-password`.
- The same session navigating directly to `/student` was correctly bounced.
- A normal `password`-method session was correctly *not* bounced (false-positive check).
- An `invite`-method session navigating to `/teacher` was correctly bounced.

**(b) Real end-to-end flow.** After Daniel supplied a real, previously-unused recovery link for a real test account (`danslang+stu2@gmail.com`):
- The real session was confirmed via live JWT decoding to have `amr` method `'otp'` — this is what caught bug #2 above.
- Navigating to bare `/` with this real session correctly bounced to `/reset-password`.
- Completing the password-update form correctly terminated the session (confirmed via cleared localStorage) and redirected to `/login`.
- A fresh login with the new password landed cleanly on `/student` with no gating loop.

## Accepted limitation

Documented in `here-security-decisions.md`: this is a client-side routing gate, not an RLS-level one. It stops the ordinary UI-navigation bypass but doesn't stop a still-valid recovery-session token from being used directly against the Supabase REST API. Closing that fully would require the same category of change discussed (but deferred) for `v5.0.0-7.4.2` last session — adding a check to every RLS policy across the schema, since Postgres RLS has no single global-gate primitive that could apply the check in one place. Judged disproportionate for a solo-maintainer, pre-district-approval app at this scale. Daniel asked about and got a full walkthrough of what the DB-level version would actually require (a new SECURITY DEFINER helper reading `auth.jwt()`'s `amr` claim, but still requiring the check to be wired into ~20+ individual policies) before agreeing the client-side gate is sufficient for now.

## Checkpoints

All four V2 checklist rows and all three checkpoints (A/B/C per row, per the skill's workflow) were confirmed by Daniel in conversation before being marked `done`/`fixed` in `here-asvs-l1-checklist.md`.

## Where the writeup lives

`docs/architecture/here-security-decisions.md` § **Input Validation Policy** (new section, satisfies `v5.0.0-2.1.1`, `2.2.1`, `2.2.2`) is the authoritative record of the data-item survey. The `2.3.1` fix is written up as an addendum under § **Authentication & Anti-Automation Policy** (since it's a recovery/invite-flow fix, alongside the session-56 material it extends), not under Session Management — worth noting for anyone looking for it later. `docs/architecture/here-asvs-l1-checklist.md`'s V2 section carries per-row status and evidence; neither is duplicated here in full.

## Outstanding from session 57, not done this session

Session 57's notes asked to circle back and add a caveat to `v5.0.0-6.4.1`'s evidence in the checklist (currently `done`), clarifying that the session-56 fix only closed the "recovery link silently lands on `/` and logs the user in without redirecting to `/reset-password`" case — not the deeper session-persistence bypass fixed this session. That caveat was **not** added to the `6.4.1` checklist row this session — only the two commits described above were made. (`here-security-decisions.md`'s Authentication & Anti-Automation Policy section does now reference the 2.3.1 fix in its own new addendum, but the `6.4.1` row's evidence text in the checklist itself is unchanged.)

## What's ready for the next session

- Circle back and add the `6.4.1` evidence caveat described above (carried over from session 57, still not done).
- ASVS L1 chapters now fully done: V2 (Validation and Business Logic), V6 (Authentication), V7 (Session Management), V8 (Authorization), V13 (Configuration, 1 row). V1, V3, V4, V5, V9–V12, V14–V15 remain not started. No next chapter chosen yet — `/asvs-audit` will now check STATUS.md's Next Steps first per this session's skill update, but nothing has been scoped there yet.
- Otherwise unchanged: doc-update hook still dry-run only pending re-test of the `doc-updater` grounding fix; time-accuracy data pass; realtime `check_ins`/`presence_waves`; #61, #62, #21.
