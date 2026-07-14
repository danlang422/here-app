# Here — Security Decisions

This is the substance behind the "Documentation" requirements in `here-asvs-l1-checklist.md`. Each ASVS documentation requirement asks whether a written policy exists for a given area — this file is where that policy actually lives. The checklist tracks whether a section here is written and whether the code matches it; this file holds the actual decision.

Per ASVS's own framing: these are organizational decisions communicated to (in this case, future) developers, not ad hoc choices made per line of code. Each section should be specific enough that "does the implementation match this?" is a yes/no question, not a judgment call.

Sections below are stubs, filled in as we work each chapter. Each should reference the ASVS requirement ID it satisfies.

---

## Input Validation Policy
*Satisfies: v5.0.0-2.1.1*

*(Not yet written — fill in when we work V2.)*

## Authentication & Anti-Automation Policy
*Satisfies: v5.0.0-6.1.1*

*(Not yet written — fill in when we work V6. Should cover: rate limiting approach, what "credential stuffing" defense looks like given Supabase Auth's built-in behavior, and how account lockout is prevented from becoming a DoS vector against your own users.)*

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
