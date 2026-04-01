# Here App — Project Status

**Last updated:** April 1, 2026 (session 21.1)

---

## Current State

**Database:** V2 schema deployed. Migrations through `20260331000001_presence_wave_checkin_constraint` (mutual exclusivity constraint on `allows_presence_wave` / `requires_checkin`). Real data: City View org with admin account (Daniel Lang), staff users, and activities in progress (data entry ongoing).

**Application:**

| Area | Status | Reference |
|------|--------|-----------|
| Auth & navigation | Built | — |
| **Admin** | | |
| Activity management (CRUD, detail modal, behavior flags, staff, enrollment roster, bulk edit) | Built | `activity-detail-and-form-redesign-spec.md`, `activity-management-overhaul-build-spec.md` |
| User management (CRUD, bulk paste-from-spreadsheet entry) | Built | — |
| Dashboard & agenda view | Replaced by calendar redesign | — |
| Admin calendar redesign — Layers 0, 1, 2 + filter bar expansion | Built | `layer-0-build-spec.md`, `layer-1-build-spec.md`, `layer-2-build-spec.md`, `filter-bar-expansion-build-spec.md` |
| Enrollment — activity-centric (Entry A) | Built (floating panel); **pending redesign** | #51 — moving inline into ActivityDetail |
| Enrollment — student-centric (Entry B) | Designed, not built | #7 |
| Org settings (block schedule, terms, rotation days) | Built | `org-settings-build-spec.md` |
| Calendar management (school days, exceptions, per-reason rotation) | Built | `calendar-management-build-spec.md`, #12 |
| Student schedule view | Designed, waiting on decisions to finalize | `student-schedule-view-build-spec.md` |
| User feedback & bug reporting (/help page, FeedbackModal, Edge Function → GitHub Issues) | Built | `user-feedback-system-build-spec.md` |
| Password reset + change password | **Not built** | #56 — blocker for real user handoff |
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
| Enrollment validation (block-based + time-based, recurrence-aware) | Built — **bug in data layer** | #52 — recurrence fields missing from getOrgEnrollments select |
| RLS policies | Comprehensive — all tables, all roles | `20260313000000_comprehensive_rls_policies.sql`, `10-rls-policies.md` |
| Edge Functions (`submit-feedback`, `create-user`) | Deployed with `--no-verify-jwt`; config in `supabase/config.toml`. `submit-feedback` posts to GitHub Issues. | Session 16, 19 |
| Realtime subscriptions | Not started | — |

## Active Decisions

Decisions that are settled live in CLAUDE.md (if they're lasting architectural principles) or in the relevant spec doc (if they're feature-specific). This section is only for genuinely open questions affecting near-term work.

**Enrollment panel redesign (#51):** Floating panel enrollment is being retired. The `EnrollmentPanel` is moving inline into `ActivityDetail` as a permanently-resident bottom section with a two-column (enrolled / available) layout. `EnrollmentPanel.jsx` stays dormant for Entry B (#7). See #51 for full spec.

## Known Issues / Tech Debt

Tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues).

**Resolved in session 20.2 (2026-03-31):** #19 (cannot deselect attendance indicator), #23 (check-out button timing), #20 (allows_presence_wave / requires_checkin must be mutually exclusive).

**Resolved in session 21.1 (2026-04-01):** #25 (enroll button cancels activity creation) — resolved as side effect of #51 redesign.

**Priority bugs (iteration 4):**
- #52 — `getOrgEnrollments` missing `recurrence_interval` / `recurrence_anchor_date` → blocks valid alternating-week enrollments (one-line fix)
- #53 — Calendar sidebar toggles require page refresh (reactivity bug — subscribe to `calendarVisibility` map directly)
- #35 — Teacher activities not populating in feedback modal (400 error on `instructor_id` filter)
- #37 — Aggregate card list extends outside viewport / not scrollable

## Next Steps

**Iteration 4 goal: get to real user testing.**

Ordered priority:

1. **#52** — Fix `getOrgEnrollments` missing recurrence fields (unblocks a specific student's enrollment)
2. **#53** — Fix calendar sidebar toggle reactivity
3. **#35** — Fix teacher activities in feedback modal
4. **#54** — Recurrence UI: replace anchor date picker with "starting week" selector
5. **#55** — Bulk calendar assignment for activities
6. **#56** — Password reset + change password (hard blocker for user handoff)
7. **#51** — Inline enrollment redesign in ActivityDetail
8. **#37** — Aggregate card overflow fix
9. **#21** — Customizable agenda start/end times
10. **Visual polish pass** — needs its own issue; app is functional but lacks personality

**Data entry:** Activities still being entered manually. Kirkwood / alternating-week schedule patterns are the trickiest part; #52 and #54 directly support this.

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
| `enrollment-panel-build-spec.md` | **Implemented / Pending redesign** | Original floating panel spec — implemented, but being replaced by inline enrollment (#51). |
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
| `filter-bar-expansion-design-doc.md` | **Implemented** | Design doc for filter bar expansion (block, time range, student filters). |
| `filter-bar-expansion-build-spec.md` | **Implemented** | Block, time range, and student filters added to CalendarFilterBar. Student dimming threaded through WeekGrid → DayColumn → EventCard. Built session 20. |
