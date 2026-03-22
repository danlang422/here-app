# Session 15 — March 20, 2026

## Focus

Schedule-building workflow analysis and Student Schedule View spec.

## Context

Daniel has been entering real schedule data (college courses, external HS courses) into the Here app and encountered several workflow gaps. This session was a wide-ranging design conversation about what tools and views admins need when building a schedule, culminating in a build spec for the Student Schedule View.

## What Happened

### Schedule-building workflow discussion

Daniel described his process of entering schedule data outside-in — starting with immovable constraints (Kirkwood college courses, external HS courses at Kennedy/Washington/Jefferson) and filling in around them. This surfaced several gaps in the current admin tooling:

- **No student schedule view.** No way to pull up a student and see their full week — what's filled, what's empty, where rotation-day or date-range gaps exist.
- **No awareness of differing date ranges.** Some college courses have start/end dates that differ from the main semester. The schema supports this (`start_date`/`end_date` on activities), but no view surfaces the temporal gaps this creates.
- **Rotation-day gaps invisible.** Students with external HS courses on A-days only have half their schedule filled for that time slot. No way to see that the B-day half is empty without remembering it.
- **Agenda view "blob" problem.** The admin dashboard agenda groups activities by block. College courses without blocks assigned all fall into a `null` block group, hitting the aggregate threshold (4+) and rendering as one giant card spanning the entire day. Confirmed by reading `AgendaDayColumn.jsx` — the `groupActivitiesByBlock` function groups all block-less activities together.
- **Block assignment as a deferred batch task.** Daniel has been entering activities with times but no blocks. Eventually needs a way to bulk-assign blocks, likely with auto-suggestion based on time overlap.

### Broader schedule-building vision

Daniel articulated a vision for a "schedule canvas" — a visual workspace where you build up from nothing by layering student schedules, seeing gaps emerge, and tentatively placing unplaced activities to test fit. Key concepts:

- **Bottom-up composition vs. top-down filtering.** The current agenda starts with everything and tries to filter down. The canvas would start with what you care about and build context up.
- **Gap detection over placeholder creation.** Rather than auto-creating placeholder activities for empty rotation-day slots, the view itself should make absence visible.
- **Tentative composition.** When placing activities, admins need to try a piece in a spot, check ripple effects on other unplaced groups, and commit or back out.
- **Unplaced activity cards sized by `duration_minutes`.** The existing duration column was designed to support this — floating cards representing how much time an activity needs to be slotted.

We agreed to build toward this vision incrementally, with each step independently useful.

### Student Schedule View spec

The primary deliverable. After discussing whether the student schedule view should be date-specific (showing an actual week with rotation days resolved) vs. generic (abstract Mon–Fri with A/B split cards), we landed on a **tiered approach:**

- **Tier 1 (date-specific):** When `school_days` rotation data is available, show an actual week. Activities resolve to concrete days via `activityMeetsToday()`. Week navigation with arrows and today shortcut. Day headers show "Mon 3/16 (A)".
- **Tier 2 (generic + blocks):** When rotation calendar isn't set up but blocks are defined. Generic Mon–Fri with rotation activities shown as split cards (A top / B bottom). Block overlay renders. Nudge banner suggests setting up rotation calendar.
- **Tier 3 (minimal):** No blocks, no rotation calendar. Activities positioned by time only. Nudge banner suggests completing org setup.

This reflects a broader decision: **some features work best when org-level setup is complete, and that's okay.** Rather than gating features behind requirements, the view progressively enhances and nudges the admin toward completing setup.

### Spec details

- **Component family:** `src/components/schedule/` — separate from `src/components/agenda/` but sharing agenda utilities.
- **New hook:** `useStudentEnrollments(studentId)` wrapping existing `getStudentEnrollments` API function.
- **API modification:** `getStudentEnrollments` updated to join teacher/monitor profiles (matching `useActivities` pattern).
- **Core derivation (Tier 1):** `activitiesForDate()` — filters through `activityMeetsToday()` predicate for each day in the displayed week. Uses `useSchoolDays()` for rotation data.
- **Core derivation (Tier 2/3):** `activitiesForGenericDay()` — splits activities into regular/rotationA/rotationB categories.
- **Split card rendering (Tier 2/3 only):** Pairing logic matches A/B activities by time overlap. Handles matched pairs, mismatched times (highlighted), and half-filled cards (gap indicator with empty half).
- **Date range labels** on cards with `start_date`/`end_date`. Date range collection computed for future navigator.
- **Unscheduled activities list** below the grid for online courses and not-yet-scheduled activities.
- **Container-agnostic design:** Component accepts `studentId` and is self-contained. Recommended integration as slide-over panel, but final placement TBD pending activity page improvements and search functionality discussions.

### Integration placement (open question)

Discussed where this view should live. Users page is not ideal (Daniel rarely visits it after initial user creation). Activities page is a candidate but also needs an overhaul. A user search feature would be a natural entry point. Decision deferred — the component is container-agnostic, so placement can be finalized after adjacent features are specced.

## Decisions Made

1. **Student schedule view is a standalone component, not a filtered agenda view.** Different question, different UI, shared utilities.
2. **Date-specific week is the primary mode** with generic-week as fallback. Split cards are fallback-only.
3. **Progressive enhancement with nudges** rather than gating features behind org setup requirements.
4. **Build toward the schedule canvas incrementally:** student schedule view → multi-student layering → placement assistant → reimagined agenda.
5. **Spec is "near-final draft"** — component structure and data logic are solid; integration placement to be finalized after discussing adjacent features.

## Artifacts

- `docs/user-flows/student-schedule-view-build-spec.md` — Build spec (status: near-final draft, pending integration placement decision)

## Next Steps (from 3/20)

- Discuss and spec adjacent features that affect integration placement: activity page improvements, admin search, agenda view fixes
- Finalize Student Schedule View integration point and container
- Build Student Schedule View (hand off to Claude Code)
- Address agenda view blob problem (block-less activity grouping)
- Consider block auto-assignment batch tool

---

# Session 15 (continued) — March 22, 2026

## Focus

Activity management infrastructure: terms many-to-many migration, activity page overhaul spec.

## Context

After a brief break (including a Notion/Tana cleanup and subscription cancellation), Daniel returned to address the adjacent features identified at the end of the 3/20 discussion. The Student Schedule View spec is near-final but blocked on integration placement decisions, which depend on making the activity page a real working surface.

## What Happened

### Activity data hygiene discussion

Daniel described the state of his activity data after weeks of schedule entry: many activities missing blocks (entered times but not blocks), missing terms (created before terms were defined), and questions about how `duration_minutes` should relate to `start_time`/`end_time`. This surfaced three layers of work:

1. **Data hygiene / bulk tidy-up** — activities with incomplete data that needs to be filled before filtering is useful
2. **Activity page as a working surface** — search, filters, sort to actually navigate and triage 54+ activities
3. **Features that build on a better activity page** — student schedule view, block auto-assignment, unplaced activity panel

### Duration field semantics decided

Agreed that `duration_minutes` is a planning-only field for unplaced activities (those that will be scheduled but don't have times yet). When an activity has `default_start_time` and `default_end_time`, the UI computes duration from the time range and the field is hidden/read-only. No schema change — just form behavior and a label change to "Planned Duration."

### Terms many-to-many migration

The key schema change in this session. Daniel identified that activities need multiple term associations — e.g., a Kirkwood college course should be tagged with both "Kirkwood S2 #1" (college's own dates) and "Semester 2" (City View's semester for filtering). The existing `term_id` FK on activities only allowed one.

**Migration (`20260320000000_terms_many_to_many.sql`):**
- Created `activity_terms` junction table with `is_primary` flag
- Migrated all 44 existing `term_id` associations as `is_primary = true`
- Dropped `term_id` column from activities
- Added RLS policies (admin full access, staff read, student read via enrollment)
- Hit a bug during migration: RLS policies used `up.role = 'admin'` instead of `'admin' = ANY(up.roles)` — the `roles` column is an array. Fixed and re-ran successfully.

**Primary term semantics:** The first term added to an activity is marked `is_primary = true` and auto-fills the activity's `start_date`/`end_date` (if blank). Additional terms are filtering/organizational tags only.

### Schema docs updated

- `docs/schema/02-academic-calendar.md` — Added `activity_terms` section with full documentation of the junction table, `is_primary` behavior, and migration note
- `docs/schema/03-activities.md` — Removed `term_id` from `CREATE TABLE` and index list, added "Term association" paragraph pointing to junction table, updated `duration_minutes` comment to reflect planned-duration semantics

### Activity Management Page Overhaul spec

The main deliverable. Covers four parts:

1. **API and hook changes** — New `activityTerms.js` API and `useActivityTerms.js` hook for CRUD on term associations. Modified `getActivities()` to join through `activity_terms` and bring term data with each activity.

2. **Activity page search, filters, and sort** — New `ActivityToolbar` component with text search (name, instructor, location, staff), filter dropdowns (block, term, schedule status, staff — each with "No X" option for data completeness discovery), and sort (name, block, time, enrolled). All client-side via `useMemo`.

3. **Term tag picker** — Replaces the single `<select>` for `term_id` in `ActivityDetail` with a multi-select tag picker. Terms are added/removed via immediate mutations (not batched with form save). Known v1 inconsistency: term changes persist even if you cancel other form edits. Tracked for future improvement.

4. **Duration field behavior** — Hide/disable `duration_minutes` input when times are present, show computed duration instead. Only persist the field for unplaced activities.

### Implementation approach for term picker

Discussed two options for how term add/remove should interact with the form's save/cancel flow:
- **Option A (chosen):** Immediate mutations — simpler to build, term changes save on click independent of form save button
- **Option B (deferred):** Batch with form save — more consistent UX, but more complexity. Tracked as future improvement.

Chose Option A given the time pressure (aiming for school demo on Monday 3/23).

## Decisions Made

1. **Terms are many-to-many** via `activity_terms` junction table. First term is "primary" and auto-fills dates.
2. **`duration_minutes` is a planning hint** for unplaced activities only. Computed from times when times exist.
3. **Term picker uses immediate mutations** (Option A). Consistency with form save/cancel deferred to future issue.
4. **Location column removed** from activity table — rarely populated, still in detail modal.
5. **All filtering is client-side** — dataset is small enough (< 100 activities) that this is simpler than server-side.
6. **Student Schedule View integration deferred** — will revisit after activity page overhaul is built.

## Artifacts

- `supabase/migrations/20260320000000_terms_many_to_many.sql` — Migration file
- `docs/user-flows/activity-management-overhaul-build-spec.md` — Build spec (status: Ready to Build)
- `docs/schema/02-academic-calendar.md` — Updated with `activity_terms` section
- `docs/schema/03-activities.md` — Updated: `term_id` removed, term association docs, duration semantics

## Next Steps

- Hand off activity management overhaul spec to Claude Code (steps 1–2 are blockers to make app functional again after migration)
- Create GitHub issue for batching term changes with form save/cancel
- Enter remaining schedule data using improved activity page
- Consider bug reporting feature before school demo
- Circle back to Student Schedule View spec — finalize integration placement
