# Session 57 — July 15, 2026

## Overview

ASVS V7 (Session Management) L1 security audit, run via the `/asvs-audit` skill — third chapter worked (after V13 and V8, and following V6 earlier the same day). All 6 L1 rows are now recorded in `docs/architecture/here-asvs-l1-checklist.md`; a new **Session Management Policy** section was added to `docs/architecture/here-security-decisions.md`.

**Commit this session:** `f1e70d5` (all 6 V7 rows, checklist + policy doc). On `main`, not yet pushed to origin.

## What the audit found

Four of the six rows (`7.2.1`–`7.2.4`, token verification/generation/entropy/re-authentication) came back straightforwardly `done` — they're entirely delegated to Supabase Auth's JWT/refresh-token machinery, verified by reading `src/api/auth.js`, `src/hooks/useAuth.js`, and `src/pages/auth/ResetPassword.jsx`. The one notable point worth recording: for password-recovery/invite flows, the *link click* — not the subsequent password submission — is the actual re-authentication event that mints a fresh session; the password-set step just reuses that already-fresh session.

`7.4.1` (session termination on logout) was also `done`: `signOut()` defaults to Supabase's `'global'` scope, which revokes refresh tokens for all of a user's sessions immediately on logout.

`7.4.2` (session termination on account disable/delete) is where the real work of the session happened.

## The gap: no working "disable a user" mechanism at all

Looking for how Here disables an account surfaced that `user_profiles.is_active` — the only "disable a user" concept anywhere in the codebase — is referenced by **zero** RLS policies or auth checks. It's a display/roster filter only (used to exclude inactive people from lists), not an authorization gate. There is also no in-app "deactivate user" feature at all. Setting `is_active = false` on a row has no effect whatsoever on that user's ability to log in or access data.

## The fix, and why it's not an RLS fix

The chosen mechanism is Supabase Auth's *native* ban feature — `auth.users.banned_until`, set via the dashboard's Authentication → Users → Ban action — paired with an explicit global refresh-token revocation. Together these block all future sign-in and token-refresh attempts immediately.

Deliberately **not** built as a custom `is_active`-driven RLS check. Tracing `docs/schema/10-rls-policies.md` showed most policies check row ownership directly (e.g. `student_id = auth.uid()`) rather than routing through the small set of shared SECURITY DEFINER helper functions — so a correct RLS-based version of this fix would mean touching on the order of 20+ individual policies across the schema. Judged disproportionate for a solo, pre-district-approval project right now. This is recorded as a deliberate trade-off in the policy doc, not a shortcut taken without noticing the cost.

Also lowered the project's Supabase access-token (JWT) expiry from 3600s to 300s (5 minutes), via Project Settings → JWT Keys → Legacy JWT Secret tab (worth noting: that's where this setting lives despite the "Legacy" label — it's a project-wide GoTrue setting, unrelated to which signing key is actually active). This bounds the residual "already-open session survives the ban" window — the one case the native ban mechanism can't close instantly, since neither RLS nor client routing re-checks ban status mid-session — from up to an hour down to 5 minutes.

## Verification

All of this was tested live using Supabase MCP SQL access against a real test account (`danslang+stu1@gmail.com`):
- Banned the account and revoked its refresh tokens directly via SQL (`auth.users.banned_until`, `auth.refresh_tokens.revoked`).
- Confirmed a fresh login attempt in a separate browser context was rejected immediately ("User is banned").
- Confirmed the already-open, pre-ban session kept working — as expected, matching the accepted residual-window design — until the test concluded.
- Restored the test account (`banned_until` cleared) afterward.

## Where the writeup lives

`docs/architecture/here-security-decisions.md` § **Session Management Policy** (new section, satisfies `v5.0.0-7.2.1`–`7.2.4`, `7.4.1`, `7.4.2`) is the authoritative record — including the explicit, deliberate acceptance of the ≤5-minute residual window and the reasoning for not doing the larger RLS refactor. `docs/architecture/here-asvs-l1-checklist.md`'s V7 section carries per-row status and evidence; neither is duplicated here in full.

## A real, more significant gap found in passing — not yet fixed

While explaining `7.2.4` (new session token on re-authentication), Daniel independently noticed — and we confirmed together — a separate, more serious gap in the password-recovery flow. It's a different failure mode than the one fixed in session 56.

Clicking a password-recovery or invite email link correctly grants a full, normal authenticated Supabase session (that part is fine and expected — see the `7.2.4` note above). But if the user — or anyone who obtained the email link — navigates away from `/reset-password` before ever submitting a new password (for example, manually deleting `/reset-password` from the URL and reloading), they land fully logged into their normal dashboard with full account access, having never changed the password at all.

Root cause: `src/hooks/useAuth.js`'s `PASSWORD_RECOVERY` event handling (added in session 56's fix for `v5.0.0-6.4.1`) only performs a one-time imperative `navigate('/reset-password')` when the event fires — it doesn't persist any "this session hasn't completed its required step yet" flag anywhere that later navigation could check. `src/components/layout/ProtectedRoute.jsx` has no concept of this at all; it only checks whether a user exists. Since Supabase's refresh token keeps the session alive indefinitely (auto-refreshed in the background, persisted to `localStorage`), this means possession of a single recovery/invite email is functionally equivalent to **permanent, standing login** as that account — including full admin access, if the targeted account happens to be an admin.

This was scoped, with Daniel's explicit agreement, to be fixed as part of the **next chapter, V2 — Validation and Business Logic**, specifically under `v5.0.0-2.3.1` ("application will only process business logic flows for the same user in the expected sequential step order and without skipping steps"). The intended flow is recovery-link-click → password-set → normal access, and skipping the password-set step is exactly what 2.3.1 is about. **No code fix has been written yet.** A likely-correct approach (not yet designed in detail, and not yet agreed with Daniel — will need its own Checkpoint B) would involve detecting that a session originated from a not-yet-confirmed recovery/invite flow (e.g., via the JWT's `amr` claim or similar) and gating on that at the routing layer for every navigation, not just the initial event.

Daniel also asked to circle back once the 2.3.1 fix lands and add a caveat to `v5.0.0-6.4.1`'s evidence in the checklist (currently `done`), clarifying that the session-56 fix only closed the "recovery link silently lands on `/` and logs the user in without redirecting to `/reset-password`" case — not this deeper session-persistence bypass. That caveat should reference wherever the 2.3.1 fix ends up landing.

## Process note

Daniel asked whether relying on context compaction was reliable enough to resume this thread tomorrow, versus writing it down properly. Recommendation (agreed): the project's existing STATUS.md/session-notes handoff workflow is more reliable than compaction for exactly this kind of cross-session carryover — this is the scenario that workflow exists for.

## What's ready for the next session

- Run `/asvs-audit V2` (Validation and Business Logic — 4 L1 rows: `2.1.1` Documentation, `2.2.1`, `2.2.2`, `2.3.1` Implementation).
- Prioritize `v5.0.0-2.3.1` specifically: design and implement a fix for the password-recovery/invite session bypass described above, following the audit skill's normal Checkpoint B (propose fix, get Daniel's agreement) → implement → Checkpoint C (verify live, Daniel states back understanding) flow.
- After V2 is recorded, circle back and update `v5.0.0-6.4.1`'s evidence in `here-asvs-l1-checklist.md` with the caveat described above.
- ASVS L1 chapters now fully done: V6 (Authentication), V7 (Session Management), V8 (Authorization), V13 (Configuration, 1 row). V2, V1, V3, V4, V5, V9, V10, V11, V12, V14, V15 remain not started.
- Otherwise unchanged: doc-update hook still dry-run only pending re-test of the `doc-updater` grounding fix; time-accuracy data pass; realtime `check_ins`/`presence_waves`; #61, #62, #21.
