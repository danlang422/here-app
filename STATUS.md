# Here App — Project Status

**Last updated:** March 9, 2026 (session 10.5)

---

## Current State

**Documentation:** Up to date. Schema docs and business logic docs are current. Architecture docs have status notes flagging where planned patterns differ from current implementation. Session notes through 10.5. User flow docs listed at bottom of this file.

**Database:** V2 schema deployed with migrations through term FK cascade (`20260310000000`). City View org has `block_count: 6` in settings. Real data: City View org with admin account (Daniel Lang), staff users, and multiple activities.

**Application:**

- **Auth** — Working. Login, role selection, auth listener with raw-fetch workaround (see Known Issues).
- **Activity Management** — Full CRUD. Clickable rows open an activity detail modal with view/edit toggle, behavior flag icon tray, flexible staff rows, enrollment roster. Type selector removed; type silently set to `'regular_class'` on save. Enrollment counts displayed in table. React Query + React Hook Form.
- **User Management** — Full CRUD via modal-based create/edit flow (Supabase Edge Function for account creation). Bulk user entry: paste-from-spreadsheet with preview, inline editing, per-row validation, sequential creation with progress tracking.
- **Enrollment Panel (Entry A)** — Activity-centric. FloatingPanel shell (draggable/minimizable), activity dropdown, two-zone student list, progressive conflict indicators, three-phase submit flow, post-conflict "create activity" action. Launched from activity row "Enroll" button. Spec: `enrollment-panel-build-spec.md`.
- **Admin Dashboard** — Schedule-building workspace. Agenda view as centerpiece with toolbar stub. Time-based week grid with adaptive card density (single/few/aggregate), block grouping, day column headers, block label filters, click-to-zoom. Grid spans 7 AM–4 PM by default with vertical scroll. Aggregate card tooltips render multiline on hover. Spec: `agenda-view-build-spec.md`, design: `admin-dashboard.md`.
- **Org Settings** — Admin page at `/admin/settings`. Three independently-saveable sections: Block Schedule (count, labels, times → default template), Academic Terms (CRUD, current term indicator, set-as-current), Rotation Days (toggle, day names, continue/repeat mode). Custom block labels flow to activity table, agenda grid, and activity detail. Spec: `org-settings-build-spec.md`.
- **Calendar Management** — Spec written (`calendar-management-build-spec.md`), not yet built. School day generation from terms, monthly calendar grid, exception management (single-day and date-range), rotation algorithm update (per-reason advancement replacing global toggle).
- **Remaining admin pages** (Calendar, Reports) are placeholders.

**Hooks/state layer:** Custom hooks in `src/hooks/` (useActivities, useUsers, useStudents, useStaffUsers, useOrgSettings, useEnrollments, useDefaultScheduleTemplate, useTerms) wrap API functions with TanStack Query. Zustand stores for auth and UI state (including agenda focus state). Enrollment validation utilities in `src/lib/enrollmentValidation.js` — block-based and time-based conflict detection.

## Active Decisions

Decisions that are settled and documented in CLAUDE.md or `docs/` are not repeated here. This section is for decisions that are still evolving or that affect near-term work.

**Dashboard architecture:** Agenda view as centerpiece. Toolbar above with filters, property toggle icons, and panel-summoning buttons. Floating panels for Activities, Enrollment, and Settings/Calendar (future). Activity/User Management remain as dedicated pages — not embedded in the dashboard. Details in `admin-dashboard.md`.

**Build order:** Agenda view, toolbar stub, dashboard rebuild, bulk user entry, activity detail modal + form redesign, block cascade, activity type removal, and org settings UI are done. Next: calendar management → Activity Panel → dashboard composition.

**Rotation algorithm redesign (decided, not built).** The global `rotation_mode` setting (continue/repeat) is being replaced by per-reason advancement logic: planned holidays don't advance the rotation, while unscheduled cancellations (weather/emergency) do. This is determined by `override_reason` on `school_days` rows, not a global toggle. The "On cancellation" radio buttons in Rotation Days settings will be removed. See `calendar-management-build-spec.md`.

**Activity type removal (done).** The `type` column has been removed from both the UI and the database (migration `20260309000000`). Activities are configured entirely through scheduling fields and behavior flags. Schema docs updated to use "common scenarios" framing instead of type-based tables.

**Activity detail — view-first unified layout (built).** `ActivityDetail` component serves as both read-only view and edit form. Same layout in both modes. Properties tray (tightened `w-fit`) with 7 behavior flag icon toggles, location full-width above staff, term selector in dates row with auto-fill, block→time auto-fill from default template. Flexible staff rows, enrollment roster. Lives in `ActivityDetailModal` on Activity Management. Designed container-agnostic for future FloatingPanel use. Spec: `activity-detail-and-form-redesign-spec.md`.

**Enrollment Panel — Entry B (designed, not built):** Student-centric entry point. Open from toolbar with no activity context, browse/filter students first, then pick activity target. Same component, different initial state (`initialActivityId` null). Activity selector layout within the student-first flow is an open question.

## Known Issues / Tech Debt

- **~~Block cascade missing on activity edit.~~** Fixed via `trg_activity_block_cascade` trigger (migration `20260309000001`).
- **Agenda view filter/zoom oddity.** Block label filter and click-to-zoom behavior reported as working oddly — needs investigation.
- **Raw fetch in useAuthListener:** `fetchProfile` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 inside `onAuthStateChange`. Revisit on supabase-js upgrade.
- **RLS policies are starter-level:** Policies exist for core admin workflows but will need expansion (teacher-scoped writes, student check-in policies). Some phase 4 policies aren't org-scoped yet.
- **Architecture docs mostly current:** React Query/RHF patterns are now implemented for existing pages. Example hooks for future features (useCheckIn, useMarkAttendance) are still aspirational.
- **`docs/USER_FLOWS.md` is outdated:** References V1 concepts. Being replaced by per-feature docs in `docs/user-flows/`.
- **~~Activity `type` column is legacy.~~** Removed (migration `20260309000000`).
- **~~`ActivityForm.jsx` is dead code.~~** Deleted.

## Next Steps

1. ~~**Block cascade on activity edit.**~~ Done (migration `20260309000001`).
2. ~~**Org settings UI.**~~ Done (session 10.4). Block schedule, academic terms, rotation days.
3. **Agenda view filter/zoom fix.** Investigate and fix the odd behavior in block label filtering and click-to-zoom.
4. **Agenda view polish (remaining).** Card color treatment, density/spacing tuning with more activity data, responsive behavior.
5. **Bulk/quick activity entry.** Bulk paste-from-spreadsheet (similar to bulk user entry) and/or quick-create for rapid schedule building.
6. **Activity Panel spec and build.** Floating panel for browsing/searching activities on the dashboard. The `ActivityDetail` component is designed to be droppable into a FloatingPanel.
7. **Dashboard composition.** Wire agenda view, activity panel, enrollment panel, and toolbar together.
8. **Enrollment Panel Entry B.** Student-centric entry point. Can be spec'd and built independently.
9. **Calendar management (spec written).** School day auto-generation from terms, calendar month grid UI, exception management (single-day + date-range), per-reason rotation algorithm. Term CRUD already built in Org Settings. Spec: `calendar-management-build-spec.md`. Review spec before implementation.
10. **Multiple schedule templates (deferred).** Early dismissal, late start, etc. — deferred until calendar management is built and stable.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `CLAUDE.md` | Project overview, commands, conventions, key architectural decisions — **Claude's entry point** |
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns (some patterns aspirational — see status notes) |
| `docs/session-notes/` | Per-session development logs |
| `docs/user-flows/` | Per-feature UX narratives and build specs (see below) |
| `supabase/migrations/` | SQL migration files |

### User Flow Docs

| File | Status | Notes |
|------|--------|-------|
| `admin-dashboard.md` | **Current** | Consolidated dashboard design. Updated March 7. |
| `agenda-view-build-spec.md` | **Implemented** | Built in session 8.2. |
| `enrollment-panel-build-spec.md` | **Implemented** | Built in session 6.4. |
| `schedule-action-map.md` | **Current** | Activity states, action validation, build phasing. |
| `enrollment-and-floating-panels.md` | **Historical** | Original design exploration, not a build reference. |
| `activity-detail-and-form-redesign-spec.md` | **Current** | Unified view/edit detail modal, form redesign, table changes. March 8, revised March 9. |
| `org-settings-build-spec.md` | **Implemented** | Block schedule, academic terms, rotation days, activity form enhancements. Built in session 10.4. |
| `calendar-management-build-spec.md` | **Current** | School day generation, calendar grid, exception management, per-reason rotation algorithm. Designed session 10.5, pending review. |
