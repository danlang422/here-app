# Session 54 — July 14, 2026

## Overview

Docs-freshness pass, no build spec, no app-facing feature work — prep so that the paused ASVS V8 (Authorization) audit can resume against schema/architecture docs that actually match current system state. Triggered by discovering, while starting V8, that `docs/schema/10-rls-policies.md` was materially wrong about the `visible_to_all_staff` RLS extension — the trigger for treating this as its own session rather than folding it into the audit.

**Commit this session:** `07028c8` — docs: fix schema/architecture drift ahead of ASVS V8 resumption

## Method

Ground truth was pulled live rather than re-reading migration files and assuming they applied cleanly — deliberate, given session 52's finding that local migration filenames don't always match what's actually applied in production (the ledger-reconciliation commit `8fd7942`). Used the Supabase MCP tools against the live `here-app` project (`hrvscogebrngpcyfhlzo`):

- `pg_policies` for the actual RLS policy set on every `public` table
- `information_schema.role_table_grants` for the actual `anon`/`authenticated`/`service_role` grant state
- `list_migrations` (Supabase's own applied-migration ledger) cross-checked against `supabase/migrations/` — confirmed clean, no drift between local files and the ledger
- `get_advisors` (security) as an extra cross-check
- `list_tables` (verbose) for actual column sets, types, and constraints on every table

Then read all 12 `docs/schema/*.md` files + README, all of `docs/architecture/*.md` except `here-asvs-l1-checklist.md` (owned by the audit skill) and the unwritten stub sections of `here-security-decisions.md` (owned by the audit itself), comparing prose against the live state and the actual `src/` code where the docs made claims about hooks/API functions/components. `docs/design-and-specs/*` and `docs/session-notes/*` were left untouched — point-in-time build records, not living state docs.

## What was found and fixed

**`docs/schema/10-rls-policies.md`** (the file that triggered this pass) — the actual gap Daniel flagged:
- Missing the `visible_to_all_staff` RLS extension (`20260520000001`) entirely for `enrollments`, `activity_instances`, and `attendance_records` — the doc only reflected it for `activities` and `activity_staff`. Added the missing rows, including the `attendance_records` write-access row (Path A — a teacher can mark attendance on a visible-to-all activity they aren't staffed on).
- Missing the six-table INSERT org-scoping fix (`20260702000002`) — `check_ins`, `presence_waves`, `status_updates`, `post_responses`, `comments`, `notifications` all still showed only ownership checks (`student_id`/`author_id = auth.uid()`), not the parent-org check that closed a real cross-org write gap.
- No mention anywhere of the `anon` table-grant revocation (`20260702000003`) — added a new "Table Grants" section explaining this is a defense-in-depth layer independent of RLS.
- Migration reference section cited pre-ledger-reconciliation filenames (`20260513000001` through `...000005`) that don't exist — the real files are `20260513132022` through `20260513141200`. Re-verified against `list_migrations` and added a caution note about why local filenames aren't always trustworthy as timestamps.
- `activity_terms` and `feedback_reports` tables had RLS policies live but no entry in the doc at all — added both.
- `activity_is_visible_to_all()` helper function existed and was used throughout the doc's policy conditions but was never added to the "Helper Functions Reference" section — fixed.

**Other real (non-RLS-doc) drift found along the way:**

- `docs/schema/03-activities.md` — `activities.block` and `enrollments.block` were still documented as scalar `INTEGER`; both were converted to `INTEGER[]` in `20260421000000_multi_block_activities.sql`. Also missing from the CREATE TABLE blocks entirely: `visible_to_all_staff`, `start_time_override`, `end_time_override` (all added by later migrations), and the `presence_wave_and_checkin_mutually_exclusive` CHECK constraint (`20260331000001`).
- `docs/schema/08-audit-log.md` — implied the table was actively tracking `enrollments`/`activities`/`school_days`/`attendance_records` changes. Verified live: 0 rows, no database triggers write to it anywhere in the schema, and no application code references it at all. Reworded to make clear this is a designed-but-unbuilt table, same situation as `notifications` turned out to be (see below).
- `docs/schema/09-queries.md` — the "Teacher roster" reference query still used `activities.teacher_id`/`monitor_id`, removed when #70 (`activity_staff` junction table) shipped in `20260526000001`, and used scalar `block = $block` instead of array membership. Rewrote against the current schema.
- `docs/architecture/03-auth-and-security.md` — referenced a function `is_staff_of()` that was explicitly never adopted (the RLS doc itself notes `is_teacher_or_monitor_of()` was deliberately kept under its original name specifically to avoid a rename); and still described the pre-#70 `teacher_id`/`monitor_id` model as current. Rewrote the RLS summary section.
- `docs/architecture/04-realtime-and-notifications.md` — the most stale file found. Claimed realtime subscriptions were "not yet implemented" (they shipped session 42 — `useAttendanceSubscription`) and that there was no `notifications` table in the schema at all (it's existed since the original comprehensive-RLS migration, with full RLS and grants — just never wired up at the application layer, same as `audit_log`). Rewrote both sections to describe actual current state.
- `docs/architecture/01-tech-stack-and-structure.md`, `02-data-flow-and-state.md` — project-structure listings missing files added since their last touch (`history.js`, `profiles.js`, `useAttendanceSubscription`, `useHistory`, `useSidebarActivities`, the `history/` component dir, `HistoryView` pages); `useTeacherAgenda`'s description still described the two-column staffing model instead of the `activity_staff` junction.
- `docs/schema/12-migration-strategy.md` — the example new-table grant snippet included a commented-out optional `GRANT SELECT ... TO anon` line, which now contradicts the explicit zero-anon-access policy established by `20260702000003`. Removed the example, added an explicit "don't grant anon" note with the reasoning.
- `docs/schema/11-indexes.md` — `idx_activities_calendar` exists live (on `calendar_id`) but wasn't documented anywhere. Added.
- `docs/architecture/05-ui-and-styling.md` — minor: an example DaisyUI badge snippet showed a `regular_class` type badge, but `activities.type` was removed entirely in `20260309000000`. Fixed the example.

Files read and found **already accurate** (no changes): `01-core-tables.md`, `02-academic-calendar.md`, `04-instances.md`, `05-attendance.md`, `06-social.md`, `07-calendars.md`, `07-notifications.md`, `here-security-decisions.md` (left as stubs, per scope).

## Flagged, not fixed — for the V8 audit or Daniel directly

**`activity_terms`'s staff-read RLS policy checks a role value that's never actually assigned.** The policy `activity_terms_staff_select` gates on `'staff' = ANY(user_profiles.roles)`, but querying live `user_profiles.roles` values in production returns only `teacher`, `student`, `admin` — `'staff'` is used elsewhere in the codebase only as a UI filter label (`ActivityToolbar.jsx`'s "Staff: All" dropdown, unrelated to the `roles` column), never assigned to an actual user. This means that policy branch can never match a real user — a teacher relying on it to read `activity_terms` directly would get nothing back from it (though the app may never hit this path directly, if it always reads term associations through joined `activities` queries instead). Not a security *gap* (it's overly restrictive, not overly permissive) but a real functional bug, and worth a specific look when V8 gets to `activity_terms`. Documented as an inline note in `docs/schema/10-rls-policies.md`; the live policy itself was **not** touched, per the ask to flag rather than silently fix.

## What's ready for the next session

- **ASVS V8 Authorization** can now resume against accurate docs — `docs/schema/10-rls-policies.md` reflects the live policy set exactly, cross-checked against `pg_policies` directly rather than migration files.
- The `activity_terms` staff-role bug above is worth a specific look during V8's pass over that table.
- Otherwise unchanged from session 53: doc-update hook still dry-run only pending re-test of the `doc-updater` grounding fix; time-accuracy data pass; realtime `check_ins`/`presence_waves`; #61, #62, #21.
