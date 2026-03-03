# Here App — Project Status

**Last updated:** March 3, 2026 (Session 5)

---

## Current State

**Documentation:** Up to date. Schema docs updated to reflect dynamic block count changes (org settings, loosened constraints on activities/enrollments).

**Database:** V2 schema deployed with three additional migrations since phase 4: RLS fix, dynamic block count, and admin RLS policies. City View org has `block_count: 6` in settings. Real data: City View org with admin account (Daniel Lang), staff users, and multiple activity types.

**Application code:** Auth flow working. Activity Management and User Management pages are both functional with full CRUD. Activity form has type-driven field visibility, activity table with filtering. User management uses a modal-based create/edit flow with a Supabase Edge Function for account creation. Staff dropdowns in the activity form are wired up. Enrollment validation utilities are in place (`src/lib/enrollmentValidation.js`) — block-based and time-based conflict detection, enrollment gatekeeper, and scheduling visibility helpers. No enrollment UI yet. Remaining admin pages (Calendar, Reports) are still placeholders.

**Key architectural decisions:** The app is being designed as a schedule-building tool, not just a schedule-entry form. Settings, blocks, terms, etc. are all optional/progressive — admins can enter activities before defining blocks or terms. User management follows the same reusable-component pattern as activities — form works in modal or full page.

---

## What Was Accomplished (March 3, 2026 — Session 5)

### Enrollment Validation Utilities
- **`src/lib/enrollmentValidation.js`**: Pure-function module with no API or UI dependencies. Two modes of conflict detection:
  - **Block-based** (`wouldConflictByBlock`): Enrollment gatekeeper. Checks block + days_of_week + rotation_day_type overlap. Hard gate — if this says conflict, enrollment is rejected.
  - **Time-based** (`wouldConflictByTime`): Scheduling visibility. Checks actual time range overlap on shared days. Returns overlap/gap in minutes. Informational only — never blocks enrollment.
- **`validateEnrollment(newActivity, existingEnrollments)`**: Public function for the enrollment flow. Checks a new activity against all of a student's existing enrollments. Collects all conflicts (doesn't short-circuit) so UI can show full details.
- **`findAvailableBlocks(studentEnrollments, orgSettings)`**: Returns per-block availability for a student — which blocks are open, which have activities.
- **`findTimeConflicts(activity, otherActivities)`**: Returns all time-based overlaps between an activity and a list of others, with overlap minutes.
- Shared helper `couldMeetOnSameDay` encapsulates the four-case day/rotation logic used by both conflict checkers.
- All functions take objects, not IDs — callers load data and pass it in. Keeps the module pure and testable.

### Design Decisions (Session 5 — enrollment and scheduling direction)
- Enrollment is a workflow, not a page. The UI will be composable pieces (StudentSelector, ActivitySelector) that can be initiated from multiple places — activity management now, schedule overview later.
- Two-panel enrollment flow: select students → pick activity target → validate → enroll. Activity target can be pre-filled (from activity table) or open (from schedule view). Shell activities can be created on the fly (progressive setup).
- Block-based and time-based conflict detection are separate because activity times don't always match block boundaries (e.g. Kennedy Band is "Block 0" but runs 8:00–8:45 while Block 0 is 7:30–9:00). Block assignment is organizational (admin judgment), not validated against time boundaries.
- Time-based conflicts return overlap/gap in minutes — the admin needs to know *how much* overlap, not just yes/no.
- Group-level scheduling utilities (findAvailableBlocksForGroup, etc.) deferred until the schedule view needs them. Core comparison logic is identical; only the loop and result shape changes.
- Auto-scheduling explicitly deferred. The tool's job is to make constraints *visible* so the admin can solve the puzzle with context the system doesn't have (room availability, teacher preferences, etc.).
- Incomplete scheduling data (no days_of_week or rotation_day_type on either activity) defaults to "assume conflict" as a conservative safety measure. May revisit if this creates friction with progressive setup workflow.

---

## What Was Accomplished (March 2, 2026 — Session 4)

### User Management
- **UserForm component** (`src/components/users/UserForm.jsx`): Reusable, container-agnostic form (modal-ready, like ActivityForm). Create mode shows email + password fields; edit mode hides them. Role selection via checkboxes (admin, teacher, student — at least one required). Optional preferred name and grade level.
- **UserTable component** (`src/components/users/UserTable.jsx`): Table with name, email, color-coded role badges, grade level, edit buttons. Loading and empty states.
- **UserManagement page** (`src/pages/admin/UserManagement.jsx`): Modal-based create/edit flow, role filter dropdown, error handling. Wired up at `/admin/users`.
- **Supabase Edge Function** (`supabase/functions/create-user/index.ts`): Deno-based function using service role key to create auth accounts. Verifies caller is an authenticated admin in the same org. Passes user data via `user_metadata` so the existing `on_auth_user_created` trigger creates the profile row. Deployed with `--no-verify-jwt` (function handles its own auth verification). CORS handled via shared module.
- **API additions to `src/api/users.js`**: `createUser` (invokes Edge Function with explicit auth header and error extraction from Response context), `updateUser` (direct profile update). Query functions (`getUsers`, `getStaffUsers`, etc.) and `formatUserName` were already in place from Session 3.
- No new migration needed — existing schema and RLS policies already supported user management.

### Edge Function Fixes (Session 4 troubleshooting)
- Gateway was rejecting requests with 401 before function code ran — fixed by deploying with `--no-verify-jwt` (the publishable key auth flow doesn't pass the JWT in a way the gateway's built-in verification expects).
- `auth.admin.createUser()` was failing with "Database error creating new user" because the `on_auth_user_created` trigger requires `organization_id` in `user_metadata` — fixed by passing all profile fields through `user_metadata` and letting the trigger handle profile creation.
- `supabase.functions.invoke()` swallows response bodies on non-2xx status — added error extraction via `error.context.json()` in the client-side `createUser` to surface real error messages.
- Service role key: function now checks both `SERVICE_ROLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase auto-provides the latter as a reserved secret).

### Verified with Real Data
- Created multiple users (staff, students) via the User Management form — confirmed Edge Function, trigger, and profile creation all work end to end.
- Created multiple activities of different types — confirmed type-driven field visibility, save, and table display all work correctly.

---

## What Was Accomplished (March 1, 2026 — Session 3)

### Dynamic Block Count
- Block count is now org-defined (`organization.settings.block_count`), not hardcoded to 0-5
- Loosened `valid_block` DB constraints on `activities` and `enrollments` — removed `<= 5` ceiling, upper bound enforced at app layer
- Replaced hardcoded `BLOCKS`/`BLOCK_LABELS` constants with `getBlocks(blockCount)`, `getBlockLabel(blockNum)`, `getBlockLabels(blockCount)` utilities
- City View seeded with `block_count: 6`
- Migration: `20260301000001_dynamic_block_count.sql`

### Activity Management (Layer 1 — CRUD Basics)
- **ActivityForm component** (`src/components/activities/ActivityForm.jsx`): Reusable, self-contained form designed for future use in modals/slide-overs. Type dropdown drives field visibility in real time. Staff section shows contextually by type with "+ Add staff" for extras. Block dropdown populated from org settings (shows "Blocks not yet defined" if null). Behavior flags in collapsible Advanced section, auto-populated by type defaults. All fields optional except name and type.
- **ActivityTable component** (`src/components/activities/ActivityTable.jsx`): Table with type badges, block labels, day abbreviations, 12-hour time display, edit buttons. Empty and loading states.
- **ActivityManagement page** (`src/pages/admin/ActivityManagement.jsx`): Wires form and table together. Create/edit flow, type filter, error handling.

### API Layer Additions
- `src/api/organizations.js` — `getOrganization`, `updateOrgSettings`, `getOrgSettings`
- `src/api/users.js` — `getUsers` (with role filtering), `getStaffUsers`, `getStudents`, `getUser`, `formatUserName`

### Admin RLS Policies
- Added missing RLS policies for admin page functionality
- `organizations`: SELECT for org members (via JWT), UPDATE for admins
- `academic_terms`, `schedule_templates`, `school_days`: SELECT for org members, ALL for admins
- `enrollments`: ALL for admins (scoped to org activities)
- `user_profiles`: UPDATE for admins in their org
- `internship_opportunities`: SELECT for org members, ALL for admins
- All use JWT-based org_id pattern to avoid self-referential subquery issues
- Migration: `20260301000002_admin_rls_policies.sql`

### Schema Doc Updates
- `docs/schema/01-core-tables.md` — Added `block_count` to settings schema with documentation
- `docs/schema/03-activities.md` — Updated constraint notation for dynamic blocks

---

## Recent Decisions

**Dynamic block count (March 2026):**
Block count is org-defined, not hardcoded. Schedule templates will have rows matching the org's block count. Alternative schedules can mark individual blocks as inactive/skipped rather than having a different block count. This supports orgs that change block count between semesters (City View used 5 last semester, 6 this semester).

**Progressive/optional setup (March 2026):**
The app should never force admins to define X before entering Y. Blocks, terms, schedule templates, and other org settings are all optional. Activities can be created with times but no block assignment. The system gets smarter as more information is filled in. This supports a schedule-building workflow where structure (blocks, templates) emerges from data (activities with real times) rather than being a prerequisite.

**Reusable form components (March 2026):**
Both the activity form and user form are designed to be container-agnostic — they work in full page, modal, or slide-over panel. This supports the vision of an admin schedule overview where you can add/edit items in-place via floating modals.

**Build order revised (March 2026):**
Activity Management before Calendar Management, because admins may want to enter immovable schedule items (college courses, external HS courses) before defining blocks or terms. Calendar/template features build on top of existing activity data.

**Internship requires geofence by default (March 2026):**
Updated `ACTIVITY_TYPE_DEFAULTS` so internships default to `requires_geofence: true`.

**React Query / React Hook Form deferred (March 2026):**
Both libraries are installed but not yet used. Current manual useState patterns work fine. Will do a dedicated refactor session when the pattern repetition across 3-4 pages makes it painful.

---

## Known Issues / Tech Debt

- **Raw fetch in useAuthListener:** `fetchProfile` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 when calling client methods inside `onAuthStateChange`. Revisit on supabase-js upgrade.
- **RLS policies are starter-level:** Policies exist for core admin workflows but will need expansion as features grow (e.g., teacher-scoped writes, student check-in policies). Some existing phase 4 policies (teachers manage attendance) aren't org-scoped yet.
- **React Query / React Hook Form not used:** Installed but manual patterns in use. Refactor when it becomes painful.

---

## Next Steps

1. **Enrollment UI (Layer 1.5)** — Build the composable enrollment workflow:
   - `StudentSelector` component: searchable, filterable (by grade), multi-select student list. Reusable across activity management and future schedule view.
   - `ActivitySelector` component: searchable activity list for picking enrollment target. Can be pre-filled or open.
   - `EnrollmentFlow` orchestrator: two-panel flow (select students → pick target → validate → enroll). Wires validation, API calls, error display.
   - Wire into ActivityManagement: "Enroll Students" action per activity, opens flow with activity pre-filled.

2. **Admin: Agenda/week view (Layer 2)** — Visual timeline showing placed activities by time across a week, with rolled-up cards (e.g. "3 Activities, 15 students"). Schedule-building experience with conflict visibility — selecting an unscheduled activity highlights where its enrolled students have conflicts. Design is TBD/iterative. Will need group-level scheduling utilities (`findAvailableBlocksForGroup`) built on top of existing validation module.

3. **Admin: Conflict detection (Layer 3)** — Deeper conflict analysis integrated into the agenda view. Time-based overlap indicators showing overlap/gap in minutes. Drag-to-enroll from student selector onto activities in the agenda.

4. **Admin: Calendar management** — Term CRUD, school day generation, schedule template editor, "assign blocks" step that maps existing activities to newly-defined block boundaries.

5. **Rotation day display** — Need to figure out how A/B day activities display in the week view alongside fixed-day activities. Current thinking: semi-transparent/striped cards spanning all weekdays, with conflict logic aware of rotation day matching.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns |
| `docs/USER_FLOWS.md` | **Outdated** — needs chunked rewrite |
| `supabase/migrations/` | SQL migration files (four phases + reset + RLS fix + dynamic blocks + admin RLS) |
