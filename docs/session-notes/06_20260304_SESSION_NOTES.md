# Session 6 — March 4, 2026

---

## 6.1 — Duration Field & Activity Table Staff Column (morning)

Small prep work before digging into enrollment UI. Added `duration_minutes` to the schema and activity form, and replaced the Type column in the activity table with a more useful Staff column.

### What Was Built

- **Migration `20260304000000_add_duration_minutes.sql`**: Adds nullable `duration_minutes` integer to activities with a positive-value check constraint. Enables proportional card sizing in the future agenda view. Documented in the dashboard planning session (5.3) as a needed addition.
- **ActivityForm**: Duration field added to the Scheduling section alongside Start Time and End Time. Same string↔integer conversion pattern as `block`. Flows through `buildInitialForm` and `onFormSubmit`.
- **Activity table — Staff column replaces Type column**: The Type column was low-value in the list view since types are really just form helpers for auto-setting properties during creation. Staff is far more useful for distinguishing otherwise-identical activities (e.g. multiple "Advisory" entries that differ only by teacher).
  - `getActivities` query now joins `user_profiles` for both `teacher_id` and `monitor_id` via Supabase foreign key joins.
  - `StaffDisplay` component shows the primary staff member formatted as "Last, F." with a "+N" indicator if additional staff are assigned.
  - Priority order: Teacher > Monitor > Instructor > Mentor.
  - Teacher/monitor names come from joined `user_profiles`; instructor/mentor names are plain text fields on the activity.

### Deferred / Noted for Later
- **Properties/icons column**: Idea discussed for showing toggleable behavior flags (attendance, presence, check-in, freeform, geolocation) as compact icons in the activity table. Tabled for now due to column density concerns.
- **Activity list filtering**: Current type filter is moderately useful but other filters may be more beneficial (staff-based, block-based, enrollment-derived). Not a priority right now — will revisit when the table gets more real data.

### Next Up
- Enrollment UI planning and implementation (Layer 1.5 from STATUS.md).

---

## 6.2 — Enrollment & Schedule-Building Design Session (morning, continued)

Extensive planning session working through the enrollment UI, floating panel system, and the full set of admin actions that affect student-activity-schedule relationships. Three new user flow docs created.

### Key Design Decisions

**Floating panel system:** Non-modal, draggable tool windows that appear near their trigger. No backdrop dimming. Multiple panels allowed simultaneously. Minimize collapses to a title bar in place. Click-to-front z-index management. Fixed width per panel type for now. Clamped to viewport bounds.

**Enrollment validation is context-dependent:**
- Enrolling into a scheduled activity → validate per-student, show conflicts (Scenario A)
- Enrolling into an unplaced activity → no validation, frictionless (the whole point of buckets)
- Scheduling an activity that has enrolled students → placement check, removed students offered "create activity with these students" (Scenario B)

**Pre-summary pattern for all conflict scenarios.** Preview before commit: show what will happen, let the admin proceed or cancel. Scenario A says "skipped," Scenario B says "removed." Both offer one-click "create activity with these students" to regroup conflicted students into a new bucket.

**"Create activity with these students" is a background action.** Button in the conflict summary creates the bucket silently, shows a link. No navigation or disruption.

**Pre-validation uses org-wide enrollment cache.** All active enrollments for the org loaded into React Query on first enrollment panel open. Conflict checks run client-side. Invalidated on enrollment changes. Works at City View scale; server-side checking is the future path for larger schools.

**Activity form uses conditional confirmation at submit.** If schedule fields changed AND activity has enrolled students, confirmation dialog appears before save. No live field-watching. The enrollment panel handles the other direction (students changing against a known schedule) independently.

**Activity state model:** Empty (no schedule, no students) → Bucket (students, no schedule) → Scheduled (schedule, no students) → Live (schedule + students). Actions and validation requirements differ by state.

### Documentation Created
- `docs/user-flows/enrollment-and-floating-panels.md` — floating panel system design + enrollment workflow (both scenarios, batch behavior, caching, data requirements)
- `docs/user-flows/schedule-action-map.md` — comprehensive map of all admin actions affecting student-activity-schedule relationships, with validation requirements, UI contexts, shared patterns, and build order

### Deferred / Noted for Later
- Floating activities-as-records (individual records opening in resizable panels) — interesting but adds panel complexity not warranted yet
- Student-direction enrollment ("pick a student, build their schedule") — separate from activity-centric flow, likely a Student Schedule panel or student profile page
- Archive/deactivate lifecycle — `is_active = false` works short-term but needs term-based archival design for multi-year data
- Keyboard accessibility for floating panels — needs design thinking around focus management without trapping
- Mobile/tablet adaptation of floating panels

---

## 6.3 — Enrollment Panel Build Spec (afternoon)

Follow-up session that refined the enrollment UI design from 6.2 into a concrete, implementation-ready build spec. Several key simplifications and clarifications emerged.

### Key Design Refinements (changes from 6.2)

**Floating panel opens center-screen, not near trigger.** Pages are still evolving — "open near the thing you clicked" is a nice concept but premature when layouts aren't finalized. Center-open is simple and always works.

**Single-panel enrollment model replaces two-panel flow.** The original design envisioned separate student-selection and activity-selection panels. Consolidated into one panel with an activity dropdown at top and a two-zone student list. Simpler, more flexible, and supports two entry points (from activity row with activity pre-selected, or standalone with no activity context) using the same component.

**Two-zone student list interaction.** No checkboxes. Students move between an "available" zone (below divider) and a "staged" zone (above divider) by clicking. Already-enrolled students start in the staged zone. Moving an enrolled student below the divider stages them for unenrollment with a visual marker (⛔ / red highlight). Un-staging a never-enrolled student has no visual residue — they just go back to normal.

**Progressive conflict disclosure.** Conflict indicators appear only when the selected activity has a schedule. Below the divider: subtle dot/icon only (avoids overwhelming the list when many students conflict for a given block). Above the divider (staged): full inline detail — "Conflicts with [Activity Name] — Block 3, MWF." Rationale: the useful moment is when you've committed to looking at a student by staging them, not when you're browsing a long list.

**Hover on conflict indicators skipped.** Click-to-stage already reveals the detail. Hover adds implementation complexity without new information.

**Submit flow stays in-panel.** Footer area (always visible, below scrollable list) shows count → expands to confirmation summary on click → button changes to "Confirm" → commits → shows past-tense results. Panel stays open after commit.

**"Create activity with these students" is in scope.** Appears in post-commit summary when students were skipped due to conflicts. Creates "[Activity Title] - Enrollment Conflict" as an unplaced bucket with those students pre-enrolled. Background action — text changes to "[Title] created. Click here to view all activities." linking to Activity Management page.

**API naming:** `getOrgEnrollments` replaces `getStudentEnrollments` from the original doc. Since the cache loads all org enrollments for client-side conflict checking, the function name should reflect the actual query scope. Per-student filtering happens client-side.

### Documentation Created
- `docs/user-flows/enrollment-panel-build-spec.md` — consolidated implementation spec covering FloatingPanel shell, EnrollmentPanel component, data layer, integration points, and build order. Supersedes the original doc for implementation details.

### Deferred
- Scenario B (placement check when editing activity schedule) — separate build phase
- Roster / Details tabs on the panel
- Activity creation from within the panel dropdown
- Student-centric enrollment trigger (Entry B)
- Mobile/tablet panel adaptation

### Next Up
- Review build spec in a fresh conversation to prep Claude Code prompts for FloatingPanel shell, enrollment API layer, and EnrollmentPanel component.
