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

## Next Steps

- Discuss and spec adjacent features that affect integration placement: activity page improvements, admin search, agenda view fixes
- Finalize Student Schedule View integration point and container
- Build Student Schedule View (hand off to Claude Code)
- Address agenda view blob problem (block-less activity grouping)
- Consider block auto-assignment batch tool
