# Here App — Project Status

**Last updated:** May 14, 2026 (session 39)

---

## Current State

**Database:** V2 schema deployed. Migrations through `20260514000002` — adds `visible_to_all_staff` to activities and `start_time_override`/`end_time_override` to enrollments (both session 39). Real data: City View org with admin account (Daniel Lang), staff users, and activities. Consolidation pass is complete; remaining data work is **time-accuracy** — adjusting individual activity start/end times to match real-world arrival/departure patterns, gathered incrementally from City View staff and students. Not a blocker for #86 work.

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
| Dashboard / agenda | Built; layout rewrite specced | `teacher-agenda-build-spec.md`, `teacher-agenda-design-direction.md`; epic #84, #86 |
| Attendance marking | Built | `teacher-agenda-build-spec.md` |
| Student action visibility | Built | `teacher-roster-student-actions-build-spec.md` |
| Attendance indicator on agenda cards | Built | Session 32, #74 |
| PAET buttons — larger size + "Mark all P" bulk action | Built | Session 32, #75 |
| **Public-facing site** | | |
| Public landing page, trust/privacy page, about page, public layout, auth-aware root routing | Built (feat/public-facing-site) | `public-facing-site-build-spec.md`, Session 33 |
| **Infrastructure** | | |
| Hooks / TanStack Query layer | Built | — |
| Zustand stores (auth, UI, calendar UI) | Built | — |
| Enrollment validation (block-based + time-based, recurrence-aware, enrollment-effective schedules) | Built | #52 resolved; `enrollment-level-scheduling-design-doc.md` |
| RLS policies | Overhauled May 2026 — all `user_metadata` references replaced with `user_profiles` subqueries + SECURITY DEFINER helpers | Session 36; `docs/schema/10-rls-policies.md` |
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

### Platform deferred items

**`feedback-screenshots` public bucket** — Intentionally public so screenshots embed inline in GitHub Issues (no public API exists for uploading GitHub issue images programmatically). Low risk for internal app; paths are UUID-scoped. Revisit if app scales or GitHub adds an image upload API. See session 36 notes for full options analysis.

**Leaked password protection (HaveIBeenPwned check)** — Supabase Auth feature that checks passwords against known breached credential lists. Requires Pro plan. Enable when upgrading from Free tier.

## Next Steps

**Iteration 4 goal: get to real user testing.**

Ordered priority:

1. **#86 — Phase 1 teacher agenda layout rewrite** — all three prep specs are now shipped. Write the build spec against the new design direction doc, then implement. Spec needs to translate layout rules into changes to `Dashboard.jsx`, `SingleDayAgenda`, `agendaUtils.js`, the roster modal, and a new popover component. Resolves the layout side of #88 in the same pass. Includes the sidebar (driven by `visible_to_all_staff`) and its required RLS extension.
2. **#87** — Per-enrollment arrival time override UI side (in-card chip, "Arriving later" roster section). Data layer is shipped (`start_time_override`/`end_time_override` on enrollments, #92); full #87 closes when #86 consumes it.
4. **Time-accuracy data pass** — ongoing fieldwork. Update activity start/end times as Daniel gathers real arrival/departure information from City View. Not gated on or by #86.
5. **#61** — Help & knowledge pages (welcome letter, icon glossary, FAQs)
6. **#62** — Activity entry UX improvements (sticky header, save + add new consideration)
7. **#21** — Customizable agenda start/end times

**Recently completed:**
- Session 39 — Three prep specs built and merged (#90, #91, #92): `getViewerRole` helper (`src/lib/staffRoles.js`), `visible_to_all_staff` flag on activities (migration + `ActivityDetail` behavior flags row), enrollment time overrides (`start_time_override`/`end_time_override` on enrollments, extended `EnrollmentScheduleEditor` and summary, `canEdit` gate relaxed). All dormant until #86 consumes them. Bug caught: `getOrgEnrollments` and `getRosterForActivities` use explicit column lists — new enrollment columns must be added to both.
- Session 38 — Three prep build specs for #86 written: role derivation helper, `visible_to_all_staff` flag, enrollment time overrides. Plus #86 structural decisions settled (sidebar in scope, layout layers split, prep computed, role derived, block-attendance affordance shape, gut existing block-aggregation logic).
- Session 37 — Teacher UI concepting (#85) completed. Design direction doc + v2 demo committed; #85 closed. Concretely landed: time-axis-primary layout with role-ordered row-fill, aggregation by `(start_time, end_time, role)`, popover from cluster cards, no compact/expanded toggle, late-arrivers as in-card chip + roster section.
- Session 36 — Supabase Security Advisor audit. 30 RLS errors resolved (user_metadata → user_profiles); function security hardened; explicit GRANT opt-in applied.

**Data entry:** Consolidation complete. Schedule fully normalized. Enrollment-level scheduling complete (including hard-delete unenrollments and advisory conflict detection). Remaining is time-accuracy — gathered incrementally as available.

**Teacher UI & staff model redesign (epic #84):** Umbrella issue covering the set of changes surfaced in the April 2026 staff conversation. Phases: pre-phase 1 concepting (#85, **complete**), Phase 1 agenda layout rewrite (#86, ready for spec), Phase 2 staff model (#70, #77, #78), Phase 3 teacher visibility UI (#79), downstream (#80, #81). Phase 2 can run parallel to Phase 1. Design direction for Phases 1 and 3 is now captured in `teacher-agenda-design-direction.md`. See session 34 notes for the original decisions and context; session 37 for the design direction output.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `CLAUDE.md` | Project overview, commands, conventions, key architectural decisions — **Claude's entry point** |
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns — audited against codebase April 2026 (session 35) |
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
| `public-facing-site-build-spec.md` | **Implemented** | Public landing page, trust/privacy page, about page, public layout, auth-aware root routing. Built session 33. |
| `teacher-agenda-design-direction.md` | **Current** | Input to #86. Layout rules (time-axis, role-ordered row-fill, aggregation by time+role, cluster popover), late-arrival treatment, sidebar logic, open questions. Reference artifact: `teacher-agenda-demo-v2.html`. Session 37. |
| `role-derivation-helper-build-spec.md` | **Implemented** | `src/lib/staffRoles.js` with `getViewerRole(activity, viewerId)`. Merged as #90, session 39. |
| `visible-to-all-staff-flag-build-spec.md` | **Implemented** | `visible_to_all_staff BOOLEAN` on `activities` + `ActivityDetail` behavior flags row. Flag dormant until #86 consumes it. Merged as #91, session 39. |
| `enrollment-time-overrides-build-spec.md` | **Implemented** | `start_time_override` / `end_time_override` on `enrollments`, extended `EnrollmentScheduleEditor` and summary text, `canEdit` gate relaxed. Data layer for #87. Merged as #92, session 39. |
