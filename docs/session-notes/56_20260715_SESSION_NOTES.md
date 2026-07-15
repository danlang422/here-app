# Session 56 — July 15, 2026

## Overview

ASVS V6 (Authentication) L1 security audit, run via the `/asvs-audit` skill. Unlike V13 and V8, this one didn't start as a documentation review — it started with a real, live vulnerability: every non-admin account at City View shared one password, set during pre-district-approval test onboarding (a password that had, at one point, literally been written on a whiteboard). That single fact mapped directly onto `v5.0.0-6.4.1` (system-generated initial passwords must not be allowed to become the long-term password) and drove most of the session.

**Commits this session:** `87cd3616` (initial/reset password elimination), `29e187c7` (15-char minimum, current-password requirement), `ec2a0e2c` (force password-set page on recovery links). All on `main`.

## The vulnerability and its root cause

Two Edge Functions both had the same underlying problem — an admin (or admin-facing code) chose a password value and handed it to Supabase Auth directly:

- **`reset-passwords`** took a single `password` string from the request body and applied it to every targeted user in the org via `auth.admin.updateUserById()`. This is how the shared password got perpetuated rather than fixed — a "reset" only ever replaced one shared password with another shared password.
- **`create-user`** took an admin-supplied `password` and passed it straight into `auth.admin.createUser()` — same problem at account-creation time. This one wasn't part of the original report; it turned up independently while looking at `reset-passwords`, since both functions live in the same file structure and share the same pattern.
- A `must_change_password` flag in `user_metadata` existed as a partial mitigation, but was dead code — set server-side by `reset-passwords`, never read or enforced anywhere client-side. Removed rather than wired up, since the redesign below makes it unnecessary.

## The fix

Both functions were rewritten so that no admin-supplied password value exists anywhere in the code path:

- **`create-user`** now calls `auth.admin.inviteUserByEmail()`. The invited user sets their own password on first login; the function never sees or chooses one.
- **`reset-passwords`** now loops `auth.admin.resetPasswordForEmail()` per targeted user — it sends reset links, it doesn't set values. The dead `must_change_password` flag was deleted along with the mechanism it used to patch over.
- Both functions needed a new `SITE_URL` secret (Edge Functions → Secrets) so `redirectTo` (`${SITE_URL}/reset-password`) can be built server-side — Deno has no `window.location` to derive it from at runtime.
- Deployed via the Supabase MCP `deploy_edge_function` tool. That tool doesn't resolve the relative `../_shared/cors.ts` import the way the Supabase CLI does, so both functions had their CORS headers inlined directly as a one-off workaround — only these two files. `npx supabase` was confirmed to work as an alternative deploy path afterward and is worth trying first next time, since it wouldn't need that workaround.
- Frontend: the password field was removed entirely from `UserForm.jsx` (admin create-user form) and `BulkUserEntry.jsx` (spreadsheet-paste bulk creation). There is no code path left anywhere that lets an admin set or know another user's password.
- `ResetPassword.jsx` was made to handle either a `PASSWORD_RECOVERY` or a `SIGNED_IN` auth event, since it wasn't certain up front which one Supabase actually fires for an invite link versus a recovery link — both are now handled the same way.

## Test/dev account workflow decision

Removing admin-settable passwords also removes the developer's previous shortcut for creating test student/teacher accounts. The decision: use Gmail `+`-address aliasing (`realaddress+student1@gmail.com`, etc.). These are distinct addresses as far as Supabase Auth is concerned — each gets its own real invite flow, no special-casing needed — but all deliver to one inbox the developer already controls. The upshot is that test accounts now go through the exact same invite code path as real accounts; no separate, weaker test-only creation path exists or was built.

## Password policy changes (6.2.1, 6.2.3, 6.2.5)

- Supabase Auth's minimum password length raised from the default floor to **15 characters** — the ASVS-recommended figure, not just the 8-character minimum. Confirmed live that no character-class complexity rule is enabled (satisfies 6.2.5, which prohibits mandating composition rules). Client-side `minLength` in `ResetPassword.jsx` and `Account.jsx` updated to match.
- Enabled Supabase's **"Require current password when changing password"** setting, and updated `Account.jsx` + `updatePassword()` in `src/api/auth.js` to collect and send `current_password`. Verified live: submitting the wrong current password is rejected, the correct one succeeds. Also confirmed the post-invite/reset flow (`ResetPassword.jsx`, which runs on a recovery session with no prior password to check) is unaffected by this setting — it doesn't collect or send a current password, by design.

## Accepted gap: leaked-password protection (6.2.4)

HaveIBeenPwned integration remains off. Confirmed via live Supabase advisor check and a docs search that it's gated to the Pro plan. Upgrading isn't realistic right now for a solo, unfunded, pre-district-approval project — this is recorded as a deliberate, cost-driven deferral, not an oversight. A zero-cost DIY alternative was identified for later if this becomes a priority sooner (HIBP's k-anonymity range API, or a bundled static top-N common-password list) but wasn't built this session.

## Second real gap, found only by testing the fix live

After deploying the rewritten functions, a second issue turned up that no amount of code review alone would have caught: Supabase's own dashboard has a "Send Password Recovery" admin action with no field to specify a custom redirect URL. It falls back to the project's bare Site URL (`https://sayhere.xyz`) instead of `/reset-password`.

Before a fix, `useAuthListener` (`src/hooks/useAuth.js`) treated the resulting session exactly like a normal login, and `RootRedirect` silently routed the user straight into their dashboard — completely skipping the password-set step, which defeats the entire point of "reset." Fixed by special-casing the `PASSWORD_RECOVERY` auth event inside `useAuthListener` to force navigation to `/reset-password` regardless of what route the link actually landed on. The same fix can't be applied to the generic `SIGNED_IN` event (which invite links may also fire), since that would hijack ordinary logins too — so the residual mitigation is procedural: always create/reset accounts through `create-user`/`reset-passwords` (which set the correct redirect and are unaffected by this gap either way), and avoid using the dashboard's own "invite user"/"send recovery" actions directly. Low-priority in practice since only the sole admin has dashboard access. Verified live end-to-end after deploy: re-ran the same dashboard recovery action and confirmed it now correctly lands on the password-set form.

## Where the full writeup lives

`docs/architecture/here-security-decisions.md` § **Authentication & Anti-Automation Policy** is the authoritative source for everything above — rate-limit table, password-policy reasoning, the initial-password/reset rewrite, and the recovery-link-routing gap and fix. `docs/architecture/here-asvs-l1-checklist.md`'s V6 section carries per-row status and evidence. Neither is duplicated here in full — this note is the narrative, those are the record.

## A discrepancy worth flagging, not fixed in this pass

Cross-checking the checklist against `here-security-decisions.md` while writing these notes surfaced an inconsistency: `here-asvs-l1-checklist.md` currently lists `v5.0.0-6.2.3` (current-password requirement) with status **`pending deploy/toggle`**, and its evidence column still says the post-invite/reset-flow interaction "not yet empirically confirmed" — but `here-security-decisions.md`'s Authentication & Anti-Automation Policy section (written this session) describes that exact check as done and confirmed. The two docs disagree with each other on this one row. Per this session's instructions, the checklist and security-decisions doc were left untouched (they're the source of truth and out of scope for a docs-only update pass) — but the checklist's 6.2.3 row should be reconciled to `done` next time it's opened, assuming the verification described in `here-security-decisions.md` is accurate. Everything else in the V6 section (11 of 13 rows `done`, `v5.0.0-6.2.4` marked `accepted gap (cost)`) is internally consistent between the two docs.

## What's ready for the next session

- V6 (Authentication) is functionally complete per the work done this session, pending only the 6.2.3 status-label reconciliation noted above. V8 (Authorization, session 55) and V13 (Configuration, session 53) remain the two chapters previously marked fully `done`.
- No next ASVS chapter has been chosen. The `/asvs-audit` skill workflow is unchanged and ready to run against whichever chapter is picked next.
- Otherwise unchanged from session 55: doc-update hook still dry-run only pending re-test of the `doc-updater` grounding fix; time-accuracy data pass; realtime `check_ins`/`presence_waves`; #61, #62, #21.
