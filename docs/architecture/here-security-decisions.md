# Here — Security Decisions

This is the substance behind the "Documentation" requirements in `here-asvs-l1-checklist.md`. Each ASVS documentation requirement asks whether a written policy exists for a given area — this file is where that policy actually lives. The checklist tracks whether a section here is written and whether the code matches it; this file holds the actual decision.

Per ASVS's own framing: these are organizational decisions communicated to (in this case, future) developers, not ad hoc choices made per line of code. Each section should be specific enough that "does the implementation match this?" is a yes/no question, not a judgment call.

Sections below are stubs, filled in as we work each chapter. Each should reference the ASVS requirement ID it satisfies.

---

## Input Validation Policy
*Satisfies: v5.0.0-2.1.1*

For each data item below, "valid" means matching the structure listed, and enforcement is noted as DB (Postgres `CHECK`/`NOT NULL`/column type/FK — a trusted layer no client can bypass) or form-level (React Hook Form `register()` rules — UX only, not a security control; see `v5.0.0-2.2.2` below).

**DB-enforced (trusted layer):**
- `academic_terms`: `end_date > start_date`
- `school_days.override_reason`: allow-list (`weather`/`planned_holiday`/`emergency`)
- `activities`: `days_of_week` ⊆ `{0..6}`, non-empty; `default_end_time > default_start_time` (or both null); `block` non-empty integer array; `duration_minutes > 0`; `recurrence_interval >= 1`; `is_not_scheduled`/`is_release` mutually exclusive; `allows_presence_wave`/`requires_checkin` mutually exclusive
- `enrollments`: same `days_of_week`/`block` shape checks as `activities`; `recurrence_interval >= 1`
- `check_ins`: `checked_out_at > checked_in_at`
- `attendance_records.status`: Postgres ENUM (`present`/`absent`/`excused`/`tardy`)
- `comments`/`notifications`: "exactly one parent" / "at most one related" `num_nonnulls` checks
- `feedback_reports.report_type`/`status`: allow-list
- `user_profiles.roles`: subset of `{student, teacher, admin}` — added this session (`20260716120000_user_profiles_roles_check.sql`); previously had no DB constraint at all, see `v5.0.0-2.2.2` evidence below

**Form-level only (UX, not a security boundary):**
- `geofence_radius`, `duration_minutes` (when start/end times aren't set yet): `min: 1`
- Email format: native `type="email"`, no explicit pattern (password-adjacent fields already covered under V6)

**UI-construction-constrained, not DB-validated (accepted, low severity — not a business/security decision per 2.2.1's L1 scope):**
- `rotation_day_type` (`TEXT`, no `CHECK`): the UI only offers valid values (buttons generated from `org.settings.rotation_day_names`), so a direct API write could set an arbitrary string, but it's a label used for filtering/display, not an authorization or business-logic input.
- `block` upper bound: dynamic per-org (`block_count`); the DB only requires a non-empty array of non-negative integers, the `<select>` UI constrains to the org's actual range. Deliberately loosened when block count became org-configurable (`20260301000001`) — an intentional design choice, not an oversight.

**Client-computed, intentionally trusted — not a gap.** `geofence_validated` (check-in pass/fail) is computed client-side from the device's GPS reading and stored as-is; nothing recomputes it server-side. Confirmed with Daniel (session 58): this is deliberate, not a missed server-side check. A failed geofence check still lets the student check in — the check-in timestamp matters more than location precision for internship monitoring — and a "not validated" badge is shown to staff afterward for follow-up. Since it's not gating a business or security decision, it's out of scope for `v5.0.0-2.2.1`/`2.2.2`.

## Authentication & Anti-Automation Policy
*Satisfies: v5.0.0-6.1.1, 6.2.1, 6.2.5, 6.4.1*

**Rate limiting / anti-automation (6.1.1).** Enforced entirely by Supabase Auth's built-in limits, not application code — confirmed live against the project's Auth → Rate Limits settings:

| Limit | Value | Scope |
|---|---|---|
| Sign-ups and sign-ins | 30 / 5 min (360/hr) | per IP |
| Token verification (OTP, magic link) | 30 / 5 min (360/hr) | per IP |
| Token refresh | 150 / 5 min (1800/hr) | per IP |
| Anonymous sign-ins | 30/hr | per IP |
| Email sending | 30/hr | per project |
| SMS sending | 30/hr | per project |

These are **per-IP sliding windows, not per-account lockouts.** That's the answer to the "does lockout become a DoS vector against your own users" question the stub above used to ask: it can't, because throttling keys off the caller's IP, not the target account — an attacker hammering one student's login can't lock that student out, they just get throttled themselves. Accepted as sufficient for L1; no additional application-level rate limiting is implemented on top of this.

**Password policy (6.2.1, 6.2.5).** Set in the Supabase Auth dashboard (Authentication → Providers → Email): minimum length 15 characters (the ASVS-recommended figure, not just the 8-character floor), no character-class complexity requirement (no forced mix of upper/lower/digit/symbol — confirmed the relevant dashboard toggles are off). This is a deliberate choice, not an oversight — ASVS 6.2.5 explicitly prohibits mandating character-class rules, and 6.2.1 favors a longer minimum over composition rules as the more effective control. Client-side validation in `ResetPassword.jsx` and `Account.jsx` mirrors this minimum so users get the same feedback before submitting.

**Password change requires the current password (6.2.3).** Supabase's "Require current password when changing password" setting is enabled, and `Account.jsx`'s change-password form collects and sends `current_password` alongside the new password via `updateUser()`. This applies only to the in-app change-password flow for an already-authenticated user — the post-invite/reset flow (`ResetPassword.jsx`) runs on a recovery session and correctly does not send or require a current password, since the entire point of that flow is recovering access without one.

**Leaked-password protection (6.2.4) is accepted as an open gap, not silently missed.** Supabase's HaveIBeenPwned integration is gated to the Pro plan and above; upgrading isn't realistic for a solo, pre-district-approval, unfunded project right now. A zero-cost DIY alternative exists (HIBP's public k-anonymity range API, or a bundled static top-N common-password list) and would satisfy 6.2.4 without a paid plan — not built yet, but a known, low-effort option if this becomes a priority before a Pro upgrade would otherwise happen.

**Initial passwords and resets (6.4.1).** No code path anywhere lets an admin set or know another user's password — this was a real, live gap until this pass (all non-admin accounts previously shared one password from pre-district-approval test onboarding). Both account-creation and password-reset now work exclusively through Supabase-issued, single-use email links:

- `create-user` edge function calls `auth.admin.inviteUserByEmail()` — the invited user sets their own password on first login via `/reset-password`. No `password` field exists anywhere in the create-user request, `UserForm`, or `BulkUserEntry` paste schema.
- `reset-passwords` edge function calls `auth.resetPasswordForEmail()` per targeted user — it sends reset links, it does not set a password value. The `must_change_password` flag this used to set was dead code (never read client-side) and has been removed along with the shared-password mechanism it existed to patch over.
- Custom SMTP (Resend) is configured project-wide, which is what keeps invite/reset email delivery reliable and off Supabase's default low-volume sending path.
- Test/dev accounts (used by the sole developer for testing student/teacher roles) go through this same invite flow — no separate, less-secure creation path exists for them. Gmail's `+` address aliasing (e.g. `you+student1@gmail.com`) gives the developer as many distinct, individually-invitable test addresses as needed, all delivered to one real inbox, without weakening the account-creation code path itself.

**Recovery links landing outside `/reset-password` (found during live testing, session 56).** Both `create-user` and `reset-passwords` explicitly pass `redirectTo` pointing at `/reset-password`, but Supabase's own dashboard "Send Password Recovery" action has no way to set a custom redirect — it falls back to the bare Site URL. Before the fix, that meant `useAuthListener` (`src/hooks/useAuth.js`) treated the resulting session like any other login and `RootRedirect` silently routed the user straight into their dashboard, skipping the password-set step entirely. Fixed by special-casing the `PASSWORD_RECOVERY` auth event in `useAuthListener` to force navigation to `/reset-password` regardless of what route the link actually landed on.

**Recovery/invite step-skipping — the deeper gap behind the fix above, closed under `v5.0.0-2.3.1` (session 58).** The session-56 fix was a one-time redirect tied to the initiating auth event — it didn't stop the user from navigating away from `/reset-password` before submitting a new password and landing fully authenticated in their dashboard anyway, since nothing marked the session as "still owes a password change." Manually reproduced (Daniel, live): deleting `/reset-password` from the URL bar after a recovery-link click landed cleanly in the dashboard. Fixed with a durable, session-derived gate instead of an event-triggered one:

- `src/lib/authUtils.js`'s `needsPasswordSetup()` decodes the session's JWT `amr` (Authentication Methods Reference) claim and checks whether the most recent entry is an OTP-verification-based method. **Live-tested finding:** Supabase's actual GoTrue server stamps both recovery *and* invite links with `amr` method `'otp'` — its `/verify` endpoint is a shared OTP-verification path for signup, recovery, invite, magic-link, and email-change — not the type-specific `'recovery'`/`'invite'` values the public JWT claims docs describe. `'otp'` is the real signal checked; `'recovery'`/`'invite'` are kept as a defensive fallback. Confirmed safe to gate broadly on `'otp'` for this app specifically: Here has no magic-link sign-in, no self-serve signup, and no email-change flow, so recovery/invite links are the only way a session is ever established via OTP verification.
- `authStore.js`'s `setSession()` — the single choke point hit on both page-load `getSession()` and every `onAuthStateChange` event, including token refresh — derives `passwordSetupPending` fresh from the session every time, not from a one-time flag.
- `ProtectedRoute.jsx` forces a redirect to `/reset-password` whenever `passwordSetupPending` is true, ahead of the existing role checks, on every render of every protected route.
- `ResetPassword.jsx` now signs out immediately after a successful password update (previously just navigated to `/login` while leaving the recovery session live) — necessary because changing a password isn't itself a new authentication event, so without ending the session, `amr` would still read `'otp'` afterward and the gate would loop forever. A fresh `signInWithPassword()` establishes a clean session with `amr: ['password']`.

Verified live end-to-end against a real, previously-unused recovery link for a real test account: navigating to bare `/` and directly to a role route (`/student`) both correctly bounced to `/reset-password`; a normal `password`-method session was confirmed *not* falsely gated; completing the password-set flow terminated the session (confirmed via cleared client storage) and required a fresh login, which then landed cleanly with no gating loop.

This closes the residual limitation noted in the session-56 fix above (which only handled the initiating `PASSWORD_RECOVERY` event, not `SIGNED_IN`/invite links or later navigation) — the new gate is derived from the session itself, not from which event fired or where the link first landed. **Known limit, accepted deliberately:** this is a client-side routing gate, not an RLS-level one — it stops the ordinary UI-navigation bypass, but doesn't stop a still-valid recovery-session token from being used directly against the Supabase REST API. Closing that would require the same category of change as `v5.0.0-7.4.2`'s deferred RLS sweep (touching every policy across the schema, since Postgres RLS has no single global-gate primitive) — not proportionate for a solo-maintainer, pre-district-approval app at this scale.

## Session Management Policy
*Satisfies: v5.0.0-7.2.1, 7.2.2, 7.2.3, 7.2.4, 7.4.1, 7.4.2*

**Token generation and verification (7.2.1–7.2.4)** are delegated entirely to Supabase Auth — Here's own code never generates, parses, or verifies a session token. Access tokens are self-contained JWTs, verified server-side by PostgREST/GoTrue on every request (never trusted from the client); refresh tokens are opaque, server-stored reference tokens, rotated by Supabase on use. A fresh token pair is minted at every real authentication event — normal `signInWithPassword()`, and also a recovery/invite link click, which is the actual re-authentication moment for those flows (the subsequent password-set step reuses that already-fresh session rather than needing its own new token).

**Logout (7.4.1).** `signOut()` (`src/api/auth.js`) is called with no `scope` argument, which defaults to Supabase's `'global'` scope — this immediately revokes the refresh token for *all* of that user's active sessions (every tab/device), not just the current one. The one self-contained JWT already issued isn't retroactively invalidated (it's stateless by design), but it's short-lived — see the expiry value below — bounding the "already logged out but token technically still valid" window.

**Disabling a user account (7.4.2).** The mechanism is Supabase Auth's native ban feature (`auth.users.banned_until`, set via the Supabase dashboard's **Authentication → Users → Ban user** action), paired with an explicit global refresh-token revocation. Together these block all future sign-in attempts and all future token-refresh attempts immediately — verified live (session 2026-07-15): a banned test account was rejected with "User is banned" on a fresh login attempt in a separate browser context, confirmed instantly.

**`user_profiles.is_active` is not a security control.** It's a display/roster filter only (used to exclude inactive students/staff from lists) — no RLS policy or authentication check anywhere references it. Setting it to `false` has zero effect on a user's ability to log in or access data. There is currently no in-app "deactivate user" feature; until one is built (wired to the ban mechanism above, not to `is_active`), admins disabling a real account must use the Supabase dashboard's Ban action directly.

**Known residual limitation, accepted deliberately (not an oversight):** an already-open session — one with a still-valid, unexpired access token at the moment of ban — continues to work normally until that token's natural expiry, since neither RLS nor client-side routing re-checks ban status on every request. Verified live in the same test: the banned account's already-open tab kept functioning (navigation, refresh) after the ban was applied. This mirrors the exact same bounded tail accepted for 7.4.1's logout case. As of this session, the project's access token expiry (Project Settings → JWT Keys → Legacy JWT Secret → "Access token expiry time") was lowered from 3600s to **300s (5 minutes)** specifically to shrink this window — a zero-code, dashboard-only change that bounds the worst case for *both* 7.4.1 and 7.4.2 to ≤5 minutes rather than ≤1 hour. Full real-time termination (e.g., a push-based forced sign-out, or an RLS-level check against live ban/active status on every request) was considered and explicitly deferred — the remaining ≤5-minute exposure was judged proportionate for a solo, pre-district-approval project, not worth the added complexity and RLS-policy surface area (a fix here alone would have required touching ~20+ individual RLS policies across the schema — see `10-rls-policies.md` — since most policies check row ownership directly rather than through a small number of shared helper functions). Revisit if/when session hijacking or insider-threat risk profile changes.

## Authorization Policy
*Satisfies: v5.0.0-8.1.1*

Here enforces authorization primarily through PostgreSQL Row Level Security (RLS) — not application code — so permission checks apply regardless of what client or path (app UI, direct REST call, future integrations) touches the database. The rules below are the intended policy; `docs/schema/10-rls-policies.md` is the implementation reference documenting the actual SQL enforcing them, kept in sync with this policy.

**Organizational isolation.** No consumer may ever see or modify a row belonging to a different organization, regardless of role. Every table is scoped by `organization_id` (directly or via a join to a table that has it), verified through `get_my_organization_id()`.

**Roles.** Three roles exist: student, teacher, admin. Users can hold more than one.

- **Student** — sees and acts on their own data only: their own enrollments, their own attendance/check-in records, and activities they're actively enrolled in. No path to another student's records, and no path to teacher- or admin-only functions (activity creation/editing, marking attendance for others, roster management).
- **Teacher** — sees and acts on data for activities they're explicitly staffed on, via the `activity_staff` junction table (as `teacher` or `monitor`). Default rule: a teacher's authority is scoped to their assigned activities, not the whole org.
  - **Exception — visible-to-all staff.** An admin can flag an individual activity `visible_to_all_staff = true`. When set, every teacher in the org gains read access to that activity's enrollments and instances, and read *and write* access to its attendance records — even without an explicit staff assignment. This is a deliberate, admin-controlled, per-activity opt-in override for City View's "whoever's covering today takes attendance" reality — not a broad default and not a bug.
- **Admin** — full read/write across all resources within their own organization. No cross-org reach.

**Enforcement layer.** All of the above is enforced at the database (RLS), not client-side JavaScript — there is no privileged client path around these rules. A secondary, independent layer of Postgres table grants backs this up: `anon` (unauthenticated) holds zero grants on any table, so an unauthenticated caller can't reach a table before RLS is even evaluated. `authenticated` holds full CRUD grants, with RLS then filtering to what policies allow.

A small number of `SECURITY DEFINER` helper functions (`get_my_organization_id()`, `is_enrolled_in()`, `is_teacher_or_monitor_of()`, `get_profile_display_info()`, `activity_is_visible_to_all()`) intentionally bypass RLS to avoid self-referential recursion in policy evaluation. Each is restricted to `authenticated` callers only (verified live, not just via migration file — see `10-rls-policies.md`) and internally scoped to the caller's own `auth.uid()`, so bypassing RLS doesn't widen what any consumer can actually retrieve.

**Out of scope for now.** Field-level authorization (restricting individual columns within an already-authorized row — ASVS 8.2.3, L2) isn't implemented; access control operates at the row level only. Accepted L1 posture, not an oversight — a teacher who can see a student's attendance record can see all of it; there's no currently-sensitive sub-field within an authorized row that would warrant column-level gating.

## Third-Party Component Update Policy
*Satisfies: v5.0.0-15.1.1*

*(Not yet written — fill in when we work V15. Should define a remediation time frame for dependencies with known vulnerabilities — e.g. "critical CVEs patched within N days" — realistic for a solo maintainer, not aspirational.)*
