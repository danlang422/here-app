# Here App — Project Status

**Last updated:** April 9, 2026 (session 32)

---

## Current State

**Database:** V2 schema deployed. Migrations through `20260406000000_enrollment_level_scheduling` (four nullable scheduling columns on `enrollments`: `days_of_week`, `rotation_day_type`, `recurrence_interval`, `recurrence_anchor_date`). Real data: City View org with admin account (Daniel Lang), staff users, and activities. **Data needs to be cleared and re-entered** using the consolidated model — current activity splits are redundant under enrollment-level scheduling (~460 → ~120–150 activities).

**Application:**

| Area | Status | Reference |
|------|--------|-----------|
| Auth & navigation | Built | — |
| **Admin** | | |
| Activity management (CRUD, detail modal, behavior flags, staff, enrollment roster, bulk edit, bulk calendar assignment) | Built | `activity-detail-and-form-redesign-spec.md`, `activity-management-overhaul-build-spec.md`, #55 |
| Geofence location search (Nominatim autocomplete, lat/lng capture, GPS-fix indicator, radius input) | Built | `geofence-location-search-build-spec.md` |
| Admin calendar — aggregate card student count fix (#63) and card height fix (#65) | Built | Session 28.2 |
| User management (CRUD, bulk paste-from-spreadsheet entry) | Built | — |
| Dashboard & agenda view | Replaced by calendar redesign | — |
| Admin calendar redesign — Layers 0, 1, 2 + filter bar expansion | Built | `layer-0-build-spec.md`, `layer-1-build-spec.md`, `layer-2-build-spec.md`, `filter-bar-expansion-build-spec.md` |
| Enrollment — activity-centric (Entry A) | Built — inline in ActivityDetail with per-enrollment scheduling UI (day pills, rotation, recurrence); unenroll is hard-delete; conflict detection is advisory (enroll all, resolve after) | #51 done; `enrollment-level-scheduling-design-doc.md`, `allow-enrollment-despite-conflicts-build-spec.md` |
| Enrollment — student-centric (Entry B) | Designed, not built | #7 |
| Org settings (block schedule, terms, rotation days) | Built | `org-settings-build-spec.md` |
| Calendar management (school days, exceptions, per-reason rotation) | Built | `calendar-management-build-spec.md`, #12 |
| Student schedule view | Designed, waiting on decisions to finalize | `student-schedule-view-build-spec.md` |
| User feedback & bug reporting (/help page, FeedbackModal, Edge Function → GitHub Issues) | Built | `user-feedback-system-build-spec.md` |
| Password reset + change password | Built | #56 — `/forgot-password`, `/reset-password`, `/account` |
| Visual design system — icons, fonts, animations, component polish | Built | `visual-design-system-design-doc.md`, #60 |
| Visual design post-review polish — wordmark bug, navbar stacking, tab bar, week nav, CalendarView card, filter bar layout | Built | Session 24.2 |
| Admin attendance rollup — date picker, block-grouped view, status coloring, exception/full toggle, conflict detection | Built | `attendance-rollup-design-doc.md`, #66 |
| Reports | Placeholder (attendance rollup wired in) | — |
| **Student** | | |
| Today view / agenda | Built | `student-agenda-today-view-build-spec.md` |
| Check-in flows | Built | `student-actions-build-spec.md` |
| **Teacher** | | |
| Dashboard / agenda | Built | `teacher-agenda-build-spec.md` |
| Attendance marking | Built | `teacher-agenda-build-spec.md` |
| Student action visibility | Built | `teacher-roster-student-actions-build-spec.md` |
| Attendance indicator on agenda cards | Built | Session 32, #74 |
| PAET buttons — larger size + "Mark all P" bulk action | Built | Session 32, #75 |
| **Infrastructure** | | |
| Hooks / TanStack Query layer | Built | — |
| Zustand stores (auth, UI, calendar UI) | Built | — |
| Enrollment validation (block-based + time-based, recurrence-aware, enrollment-effective schedules) | Built | #52 resolved; `enrollment-level-scheduling-design-doc.md` |
| RLS policies | Comprehensive — all tables, all roles | `20260313000000_comprehensive_rls_policies.sql`, `10-rls-policies.md` |
| Edge Functions (`submit-feedback`, `create-user`) | Deployed with `--no-verify-jwt`; config in `supabase/config.toml`. `submit-feedback` posts to GitHub Issues. | Session 16, 19 |
| Bulk password reset (Edge Function, user_metadata flag) | Built | Session 29 |
| Dev date/time override | Built | Session 29, #67 |
| Realtime subscriptions | Not started | — |

## Active Decisions

Decisions that are settled live in CLAUDE.md (if they're lasting architectural principles) or in the relevant spec doc (if they're feature-specific). This section is only for genuinely open questions affecting near-term work.

No open architectural decisions at this time.

## Known Issues / Tech Debt

Tracked in [GitHub Issues](https://github.com/danlang422/here-app/issues) — that's the authoritative list. Session notes contain the narrative on resolved items.

**Notable open architectural item:** `fetchProfile` in `useAuthListener` uses raw `fetch` instead of the Supabase client due to a deadlock in supabase-js v2.95 inside `onAuthStateChange` (#9). Don't change this until supabase-js is upgraded.

## Next Steps

**Iteration 4 goal: get to real user testing.**

Ordered priority:

1. **Data re-entry** — Clear existing activities/enrollments and re-enter using the consolidated model (~120–150 activities instead of ~460). Branch `feat/enrollment-level-scheduling` merged to main (commit `026179d`).
2. **#61** — Help & knowledge pages (welcome letter, icon glossary, FAQs)
3. **#62** — Activity entry UX improvements (sticky header, save + add new consideration)
4. **#21** — Customizable agenda start/end times

**Data entry:** Schedule fully normalized. Enrollment-level scheduling is complete (including hard-delete unenrollments and advisory conflict detection) — a fresh re-entry pass using the consolidated model is the next concrete action item.

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
| `admin-calendar-redesign-design-doc.md` | **Current (partially reversed)** | Full design doc for the calendar redesign feature. The "activity splitting, not enrollment overrides" decision has been reversed by `enrollment-level-scheduling-design-doc.md`. |
| `layer-0-build-spec.md` | **Implemented** | Schema integration, recurrence predicate, calendar CRUD API/hooks, ActivityDetail form fields. Built session 17. |
| `layer-1-build-spec.md` | **Implemented** | Week view, calendar sidebar, event cards, block overlay fix, empty-slot create. Built session 17. |
| `layer-2-build-spec.md` | **Implemented** | Time-slot clustering, inter-group column layout, aggregate card expansion, filter bar, recurrence-aware conflict detection. Built session 18. |
| `filter-bar-expansion-design-doc.md` | **Implemented** | Design doc for filter bar expansion (block, time range, student filters). |
| `filter-bar-expansion-build-spec.md` | **Implemented** | Block, time range, and student filters added to CalendarFilterBar. Student dimming threaded through WeekGrid → DayColumn → EventCard. Built session 20. |
| `visual-design-system-design-doc.md` | **Implemented** | App-wide visual polish: palette, typography, Phosphor icon consolidation, interaction design, component styling, block overlay removal. Design doc session 23; implemented session 24. |
| `enrollment-level-scheduling-design-doc.md` | **Implemented** | Per-student scheduling on enrollments. Schema migration, `enrollmentMeetsToday` predicate, conflict detection refactor, inline enrollment UI. Sessions 25–26. |
| `geofence-location-search-build-spec.md` | **Implemented** | Nominatim geocoding on location field, silent lat/lng capture, GPS-fix indicator, geofence radius input. Built session 28. |
| `dev-override-implementation-guide.md` | **Implemented** | Dev date/time override for demo — `getDevNow()`, `getDevToday()`, constant toggle. Built session 29. |
| `attendance-rollup-design-doc.md` | **Implemented** | Admin attendance rollup view — block groups, status sorting, exception/full toggle, conflict detection. Built session 31. |
