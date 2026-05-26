# Here App — Project Status

**Last updated:** May 26, 2026 (session 43)

---

## Current State

**Database:** V2 schema deployed. Migrations through `20260526000001` — `activity_staff` junction table replacing `activities.teacher_id`/`monitor_id` (#70 Phase 2). Real data: City View org with admin account (Daniel Lang), staff users, and activities. Consolidation pass is complete; remaining data work is **time-accuracy** — adjusting individual activity start/end times to match real-world arrival/departure patterns, gathered incrementally from City View staff and students.

**Application:**

| Area | Status | Reference |
|------|--------|-----------|
| Auth & navigation | Built | — |
| **Admin** | | |
| Activity management (CRUD, detail modal, behavior flags, staff, enrollment roster, bulk edit, bulk calendar assignment) | Built | `activity-detail-and-form-redesign-spec.md`, `activity-management-overhaul-build-spec.md`, #55 |
| `activity_staff` junction table — replaces `teacher_id`/`monitor_id`, multi-staff data model | Built; #70 Phase 2 complete; unblocks #77, #78, #79 | `activity-staff-junction-table-build-spec.md` |
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
| Dashboard / agenda | Built; all #86 sub-areas implemented (overlap resolution, clustering, late-arrival, block attendance, sidebar) | `teacher-agenda-build-spec.md`, `teacher-agenda-design-direction.md`; epic #84, #86 |
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
| Realtime subscriptions — attendance_records | Built; `useAttendanceSubscription` wired into `useRoster` | `realtime-attendance-subscription-build-spec.md`, #80 |
| Realtime subscriptions — check_ins, presence_waves | Not started | Follow-on to #80 |

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

1. **Time-accuracy data pass** — ongoing fieldwork. Update activity start/end times as Daniel gathers real arrival/departure information from City View.
2. **Realtime subscriptions — check_ins and presence_waves** — same pattern as `useAttendanceSubscription`. May consolidate into a single `useRosterSubscription` hook once the pattern is proven. Follow-on to #80.
3. **#61** — Help & knowledge pages (welcome letter, icon glossary, FAQs)
4. **#62** — Activity entry UX improvements (sticky header, save + add new consideration)
5. **#21** — Customizable agenda start/end times

**Recently completed:**
- Session 43 — #70 fully closed. `activity_staff` junction table + multi-staff edit form. Migration `20260526000001`: creates table, migrates data from `teacher_id`/`monitor_id` with in-transaction verify gate, repoints `is_teacher_or_monitor_of` body (name kept, no dependent policies touched), adds 4 RLS policies, drops old columns. Code: `getViewerRole`/`getActivityStaff` in `staffRoles.js`, `buildStaffRows`/`staffRowsToPayload` in `staffUtils.js`, `setActivityStaff` diff-reconcile API function (fetch current → delete stale → upsert new/changed), updated query layer (`getActivity`, `getActivities`, `getTeacherActivitiesForDate`, `getStudentActivitiesForDate`, `getVisibleToAllActivitiesForDate`), view-mode `StaffViewRows` rewrite, multi-staff `StaffEditRows` (multiple Teacher and Monitor rows; Instructor/Mentor remain single-use). Seven unlisted consumers also fixed: `attendance.js`, `ActivityManagement.jsx` staff filter, `ActivityTable.jsx`, `TodayView.jsx`, `CalendarEventCard.jsx`, `CalendarAggregatePopover.jsx`, `ScheduleIssueForm.jsx`. Two post-ship bug fixes: cache invalidation ordering (second `invalidateQueries` added after `setActivityStaff` in `handleSave`); stale staff in detail view after save (replaced `{ ...prev, ...updated }` merge with a `getActivity` fetch after staff sync). Unblocks #77 (substitute role), #78 (bulk staff assignment), #79 (monitor UI Phase 3).
- Session 42 — #80 Realtime attendance subscription. `useAttendanceSubscription` hook (`postgres_changes` on `attendance_records`, filtered by instance IDs, `useRef` callback pattern). Wired into `useRoster` — invalidates `['roster', ...]` and `['teacher-action-summary', ...]` on any event. Migration `20260521000001` adds `attendance_records` to `supabase_realtime` publication (required; table was missing from publication — events connected but never fired without it). Spec had a typo (`instance_id` → `activity_instance_id`); corrected during implementation. RLS worked without changes.
- Session 41 — #86 Phase 1 teacher agenda rewrite complete. All five sub-areas implemented: 86.1 `SingleDayAgenda` overlap resolution (closes #88), 86.2 role-aware clustering (replaces block aggregation, adds `TeacherActivityCard` with role badges + cluster cards + cluster popover), 86.3 late-arrival amber chip + "Arriving later" roster section (closes UI side of #87), 86.4 block attendance button row + `BlockRosterModal` combined roster, 86.5 visible-to-all sidebar + RLS extension (Path A confirmed). Post-ship bug fixes: `buildOthersRenderables` for sidebar others' section (role-filter bug in `buildTeacherRenderables`); RLS policy on `activities` table for visible-to-all reads (migration 000002).
- Session 40 — Five sub-area design docs for #86 written (86.1 overlap resolution, 86.2 Dashboard rewrite + clustering, 86.3 late-arrival UI, 86.4 block-attendance + combined roster, 86.5 sidebar + RLS extension). Two design-direction open questions resolved (cluster title rule, cluster peek text dropped). Path A on sidebar write access recommended pending build-spec confirmation. "Mark all P" scoped per-section, default-attendance-mode parked as a future feature.
- Session 39 — Three prep specs built and merged (#90, #91, #92): `getViewerRole` helper (`src/lib/staffRoles.js`), `visible_to_all_staff` flag on activities (migration + `ActivityDetail` behavior flags row), enrollment time overrides (`start_time_override`/`end_time_override` on enrollments, extended `EnrollmentScheduleEditor` and summary, `canEdit` gate relaxed). All dormant until #86 consumes them. Bug caught: `getOrgEnrollments` and `getRosterForActivities` use explicit column lists — new enrollment columns must be added to both.
- Session 38 — Three prep build specs for #86 written: role derivation helper, `visible_to_all_staff` flag, enrollment time overrides. Plus #86 structural decisions settled (sidebar in scope, layout layers split, prep computed, role derived, block-attendance affordance shape, gut existing block-aggregation logic).
- Session 37 — Teacher UI concepting (#85) completed. Design direction doc + v2 demo committed; #85 closed. Concretely landed: time-axis-primary layout with role-ordered row-fill, aggregation by `(start_time, end_time, role)`, popover from cluster cards, no compact/expanded toggle, late-arrivers as in-card chip + roster section.
- Session 36 — Supabase Security Advisor audit. 30 RLS errors resolved (user_metadata → user_profiles); function security hardened; explicit GRANT opt-in applied.

**Data entry:** Consolidation complete. Schedule fully normalized. Enrollment-level scheduling complete (including hard-delete unenrollments and advisory conflict detection). Remaining is time-accuracy — gathered incrementally as available.

**Teacher UI & staff model redesign (epic #84):** Umbrella issue covering the set of changes surfaced in the April 2026 staff conversation. Phases: pre-phase 1 concepting (#85, **complete**), Phase 1 agenda layout rewrite (#86, **complete**), Phase 2 staff model (#70 **complete**, #77 and #78 now unblocked), Phase 3 teacher visibility UI (#79, now unblocked), downstream (#80 **complete**, #81). Design direction captured in `teacher-agenda-design-direction.md`. See session 34 notes for original decisions; session 37 for design direction output.

---

## Documentation Map

| Location | Contents |
|----------|----------|
| `CLAUDE.md` | Project overview, commands, conventions, key architectural decisions — **Claude's entry point** |
| `docs/schema/` | Database tables, constraints, indexes, queries, RLS policies, migration strategy |
| `docs/business-logic/` | Schedule logic, check-in rules, attendance rules, enrollment validation, notifications |
| `docs/architecture/` | Tech stack, data flow, auth, realtime, UI patterns — audited against codebase April 2026 (session 35) |
| `docs/session-notes/` | Per-session development logs |
| `docs/design-and-specs/` | Per-feature design docs, build specs, and UX narratives — full list in CLAUDE.md |
| `docs/demos/` | Standalone HTML demo pages used for design review |
| `supabase/migrations/` | SQL migration files |

### Active Design Docs

Active/pending docs only — see CLAUDE.md for the full list.

| File | Status | Notes |
|------|--------|-------|
| `student-schedule-view-build-spec.md` | **Pending Decisions** | Admin view of individual student schedule |
| `teacher-agenda-86.1-overlap-resolution-design.md` | **Implemented** | Sub-area design for #86. `SingleDayAgenda` overlap-resolving primitive via interval-graph greedy coloring. Closes #88. Build spec + implementation session 41. |
| `teacher-agenda-86.2-dashboard-and-clustering-design.md` | **Implemented** | Sub-area design for #86. Role-aware time clustering replaces block-aggregation in `Dashboard.jsx`. Cluster card, cluster popover, transformation pipeline. Build spec + implementation session 41. |
| `teacher-agenda-86.3-late-arrival-ui-design.md` | **Implemented** | Sub-area design for #86. Amber chip on cards/clusters, "Arriving later" roster section. Closes UI side of #87. Build spec + implementation session 41. |
| `teacher-agenda-86.4-block-attendance-and-combined-roster-design.md` | **Implemented** | Sub-area design for #86. Block-attendance button row + combined roster modal. Build spec + implementation session 41. |
| `teacher-agenda-86.5-sidebar-and-rls-extension-design.md` | **Implemented** | Sub-area design for #86. Sidebar for visible-to-all activities. RLS extension on enrollments/instances/attendance. Path A write access confirmed. Build spec + implementation session 41. |
