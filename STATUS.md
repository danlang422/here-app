# Here App — Project Status

**Last updated:** March 23, 2026

---

## Current State

**Database:** V2 schema deployed with migrations through comprehensive RLS policies (`20260313000000`). Additional migrations in `supabase/migrations/` Real data: City View org with admin account (Daniel Lang), staff users, and multiple activities.

**Application:**

| Area | Status | Reference |
|------|--------|-----------|
| Auth & navigation | Built | — |
| **Admin** | | |
| Activity management (CRUD, detail modal, behavior flags, staff, enrollment roster) | Built | `activity-detail-and-form-redesign-spec.md`, `activity-management-overhaul-build-spec.md` |
| User management (CRUD, bulk paste-from-spreadsheet entry) | Built | — |
| Dashboard & agenda view (week grid, block grouping, adaptive cards, tooltips) | Built, polish deferred | `agenda-view-build-spec.md`, `admin-dashboard.md`, #3, #6 |
| Enrollment — activity-centric (Entry A) | Built | `enrollment-panel-build-spec.md` |
| Enrollment — student-centric (Entry B) | Designed, not built | #7 |
| Org settings (block schedule, terms, rotation days) | Built | `org-settings-build-spec.md` |
| Calendar management (school days, exceptions, per-reason rotation) | Built | `calendar-management-build-spec.md`, #12 |
| Student schedule view | Designed, waiting on decisions to finalize | `student-schedule-view-build-spec.md` |
| Reports | Placeholder | — |
| **Student** | | |
| Today view / agenda | Built | `student-agenda-today-view-build-spec.md` |
| Check-in flows | Built | `student-actions-build-spec.md` |
| **Teacher** | | |
| Dashboard / agenda | Built | `teacher-agenda-build-spec.md` |
| Attendance marking | Built | `teacher-agenda-build-spec.md` |
| Student action visibility | Built | `teacher-roster-student-actions-build-spec.md` |
| **Infrastructure** | | |
| Hooks / TanStack Query layer | Built | — |
| Zustand stores (auth, UI/agenda focus) | Built | — |
| Enrollment validation (block-based + time-based) | Built | `src/lib/enrollmentValidation.js` |
| RLS policies | Comprehensive--all tables, all roles | `2026031300000_comprehensive_rls_policies.sql`, `10-rls-policies.md` |
| Realtime subscriptions | Not started | — |

## Active Decisions

Decisions that are settled live in CLAUDE.md (if they're lasting architectural principles) or in the relevant spec doc (if they're feature-specific). This section is only for genuinely open questions affecting near-term work.

*None currently.* Check GitHub Issues for planned work.

## Known Issues / Tech Debt

Tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues) and synced with Linear. Claude (chat interface via Desktop app) can access issues through the Linear MCP integration. Claude Code access is detailed in `CLAUDE.md`.

## Next Steps

Tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues).

**Current priority:** User feedback system (ready to build). Daniel is also working on getting all schedule data added to the app. 

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
| `admin-dashboard.md` | **Current** | Consolidated dashboard design. |
| `agenda-view-build-spec.md` | **Implemented** | Built in session 8.2. |
| `enrollment-panel-build-spec.md` | **Implemented** | Built in session 6.4. |
| `schedule-action-map.md` | **Current** | Activity states, action validation, build phasing. |
| `enrollment-and-floating-panels.md` | **Historical** | Original design exploration, not a build reference. |
| `activity-detail-and-form-redesign-spec.md` | **Implemented** | Unified view/edit detail modal, form redesign, table changes. |
| `org-settings-build-spec.md` | **Implemented** | Block schedule, academic terms, rotation days. |
| `calendar-management-build-spec.md` | **Implemented** | School days, exceptions, per-reason rotation. |
| `student-agenda-today-view-build-spec.md` | **Implemented** | Student TodayView agenda built - buttons and functions need spec. |
| `teacher-agenda-build-spec.md` | **Implemented** | Teacher Dashboard, roster modal, attendance marking. |
| `student-actions-build-spec.md` | **Implemented** | Student action buttons and check-in flow |
| `teacher-roster-student-actions-build-spec.md` | **Implemented** | Teacher visibility of student actions | 
| `student-schedule-view-build-spec.md` | **Pending Decisions** | Admin view of individual student schedule |
| `activity-management-overhaul-build-spec.md` | **Built** | Admin activity page revamp + activity_term changes |
| `user-feedback-system-build-spec.md` | **Ready to Build** | New /Help page; bug reporting, schedule issue reporting, and feedback system |