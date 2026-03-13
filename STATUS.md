# Here App — Project Status

**Last updated:** March 11, 2026

---

## Current State

**Database:** V2 schema deployed with migrations through comprehensive RLS policies (`20260313000000`). City View org has `block_count: 6` in settings. Real data: City View org with admin account (Daniel Lang), staff users, and multiple activities.

**Application:**

| Area | Status | Reference |
|------|--------|-----------|
| Auth & navigation | Built | — |
| **Admin** | | |
| Activity management (CRUD, detail modal, behavior flags, staff, enrollment roster) | Built | `activity-detail-and-form-redesign-spec.md` |
| User management (CRUD, bulk paste-from-spreadsheet entry) | Built | — |
| Dashboard & agenda view (week grid, block grouping, adaptive cards, tooltips) | Built, polish deferred | `agenda-view-build-spec.md`, `admin-dashboard.md`, #3, #6 |
| Enrollment — activity-centric (Entry A) | Built | `enrollment-panel-build-spec.md` |
| Enrollment — student-centric (Entry B) | Designed, not built | #7 |
| Org settings (block schedule, terms, rotation days) | Built | `org-settings-build-spec.md` |
| Calendar management (school days, exceptions, per-reason rotation) | Built | `calendar-management-build-spec.md`, #12 |
| Reports | Placeholder | — |
| **Student** | | |
| Today view / agenda | Built | `student-agenda-today-view-build-spec.md` |
| Check-in flows | Not started | — |
| **Teacher** | | |
| Dashboard / agenda | Not started | `student-teacher-agenda-build-spec.md` |
| Attendance marking | Not started | — |
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

Tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues). Items that affect day-to-day development:

- **Raw fetch in useAuthListener (#9):** Don't refactor this until supabase-js upgrade. See CLAUDE.md.
- **Cross-month date ranges fail in calendar (#12):** Adding exception ranges that span e.g. Dec–Jan doesn't work.
- **Block label filter placement (#13):** Layout issue in agenda view.
- **Auth state not clearing on user switch (#17):** Blank page until refresh
- **Block overlay visibility in student agenda (#16):** Block overlay is not visible behind agenda cards

## Next Steps

Tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues).

**Current priority:** Wire student agenda action buttons (status updates spec, check-in spec) → Teacher agenda spec and build → Check-in flows

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
| `student-teacher-agenda-build-spec.md` | **Outdated** | Student spec split off; and teacher needs rewrite. |
| `student-agenda-today-view-build-spec.md` | **Implemented** | Student TodayView agenda built - buttons and functions need spec. | 
