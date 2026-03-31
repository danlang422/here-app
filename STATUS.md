# Here App — Project Status

**Last updated:** March 31, 2026 (session 19.1)

---

## Current State

**Database:** V2 schema deployed. Migrations through `20260324000000_feedback_reports` (feedback/reports table, storage bucket). Real data: City View org with admin account (Daniel Lang), staff users, and multiple activities.

**Application:**

| Area | Status | Reference |
|------|--------|-----------|
| Auth & navigation | Built | — |
| **Admin** | | |
| Activity management (CRUD, detail modal, behavior flags, staff, enrollment roster, bulk edit) | Built | `activity-detail-and-form-redesign-spec.md`, `activity-management-overhaul-build-spec.md` |
| User management (CRUD, bulk paste-from-spreadsheet entry) | Built | — |
| Dashboard & agenda view (week grid, block grouping, adaptive cards, tooltips) | Replaced — see calendar redesign below | `agenda-view-build-spec.md`, `admin-dashboard.md`, #3, #6 |
| Admin calendar redesign — Layer 0 (schema, recurrence, calendar CRUD API/hooks) | Built | `layer-0-build-spec.md` |
| Admin calendar redesign — Layer 1 (week view, sidebar, event cards, block overlay fix) | Built | `layer-1-build-spec.md` |
| Admin calendar redesign — Layer 2 (time-slot clustering, inter-group layout, aggregate expansion, filter bar, recurrence-aware conflict detection) | Built | `layer-2-build-spec.md` |
| Enrollment — activity-centric (Entry A) | Built | `enrollment-panel-build-spec.md` |
| Enrollment — student-centric (Entry B) | Designed, not built | #7 |
| Org settings (block schedule, terms, rotation days) | Built | `org-settings-build-spec.md` |
| Calendar management (school days, exceptions, per-reason rotation) | Built | `calendar-management-build-spec.md`, #12 |
| Student schedule view | Designed, waiting on decisions to finalize | `student-schedule-view-build-spec.md` |
| User feedback & bug reporting (/help page, FeedbackModal, Edge Function → GitHub Issues) | Built | `user-feedback-system-build-spec.md` |
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
| Zustand stores (auth, UI, calendar UI) | Built | — |
| Enrollment validation (block-based + time-based) | Built | `src/lib/enrollmentValidation.js` |
| RLS policies | Comprehensive--all tables, all roles | `2026031300000_comprehensive_rls_policies.sql`, `10-rls-policies.md` |
| Edge Functions (`submit-feedback`, `create-user`) | Deployed with `--no-verify-jwt`; config in `supabase/config.toml`. `submit-feedback` posts to GitHub Issues (not Linear). | Session 16, 19 |
| Realtime subscriptions | Not started | — |

## Active Decisions

Decisions that are settled live in CLAUDE.md (if they're lasting architectural principles) or in the relevant spec doc (if they're feature-specific). This section is only for genuinely open questions affecting near-term work.

*None currently.* Check GitHub Issues for planned work.

## Known Issues / Tech Debt

Tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues). User-submitted feedback is now posted directly to GitHub Issues via the `submit-feedback` Edge Function (Linear integration removed). Claude.ai access to issues available through GitHub MCP on Desktop. Claude Code access to issues is detailed in `CLAUDE.md`.

## Next Steps

Tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues).

**Current priority:** Admin calendar redesign Layers 0, 1, and 2 are complete and merged to main. Layer 3 (if scoped) or student-centric enrollment (Entry B, Issue #7) are the next candidates. The `admin-calendar-redesign-design-doc.md` describes any remaining layer scope.

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
| `user-feedback-system-build-spec.md` | **Implemented** | /Help page, FeedbackModal, submit-feedback Edge Function. Built session 16. GitHub Issues integration added session 19. |
| `admin-calendar-redesign-design-doc.md` | **Current** | Full design doc for the calendar redesign feature. Layer breakdown, data model, UI patterns. |
| `layer-0-build-spec.md` | **Implemented** | Schema integration, recurrence predicate, calendar CRUD API/hooks, ActivityDetail form fields. Built session 17. |
| `layer-1-build-spec.md` | **Implemented** | Week view, calendar sidebar, event cards, block overlay fix, empty-slot create. Built session 17. |
| `layer-2-build-spec.md` | **Implemented** | Time-slot clustering, inter-group column layout, aggregate card expansion, filter bar, recurrence-aware conflict detection. Built session 18. |