# Here — Security Decisions

This is the substance behind the "Documentation" requirements in `here-asvs-l1-checklist.md`. Each ASVS documentation requirement asks whether a written policy exists for a given area — this file is where that policy actually lives. The checklist tracks whether a section here is written and whether the code matches it; this file holds the actual decision.

Per ASVS's own framing: these are organizational decisions communicated to (in this case, future) developers, not ad hoc choices made per line of code. Each section should be specific enough that "does the implementation match this?" is a yes/no question, not a judgment call.

Sections below are stubs, filled in as we work each chapter. Each should reference the ASVS requirement ID it satisfies.

---

## Input Validation Policy
*Satisfies: v5.0.0-2.1.1*

*(Not yet written — fill in when we work V2.)*

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
