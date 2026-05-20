# Schedule-Building Action Map

**Created:** March 4, 2026
**Status:** Working document — mapping all admin actions that affect student-activity-schedule relationships

---

## Why This Document

The enrollment UI, scheduling UI, dashboard, and activity form all share the same data and conflict logic. Trying to build any one of them without understanding how they all interact leads to assumptions that break later. This document maps the full set of admin actions to find where they intersect, what validation each requires, and what UI context each lives in.

---

## The Core Variables

Every action happens against an activity that's in one of these states:

| State | Has Schedule? | Has Students? | Example |
|-------|--------------|---------------|---------|
| **Empty** | No | No | Just created, nothing set yet |
| **Bucket** | No | Yes | "Geometry" with 20 students, no block/days/times |
| **Scheduled** | Yes | No | "Block 2, MWF, 9:00–9:50" but no students enrolled |
| **Live** | Yes | Yes | Fully scheduled with enrolled students |

An activity moves between these states as the admin works. The transitions are the actions below.

---

## Action Map

### 1. Create Activity

**Trigger:** "New Activity" button (Activity Management page, dashboard quick-create)
**Precondition:** None
**What happens:** Activity is created. Lands in Empty or Scheduled state depending on what the admin fills in.
**Validation:** None (creation is always allowed)
**Consequences:** None — no students are affected yet
**UI context:** Activity form (full page or quick-create collapsed version)

**Notes:** The form supports progressive setup — the admin can fill in as much or as little as they want. A fully filled form produces a Scheduled activity. A name-and-type-only form produces an Empty activity. Both are valid starting points.

---

### 2. Edit Activity Schedule (add or change block/days/times)

**Trigger:** Edit activity form, future agenda drag-and-drop
**What varies by state:**

| Starting state | Transition | Validation needed? | Consequences |
|---------------|------------|-------------------|--------------|
| Empty → Scheduled | Adding schedule to empty activity | No | None — no students to conflict |
| Bucket → Live | Adding schedule to activity with students | **Yes — placement check** | Students with conflicts are removed (Scenario B) |
| Scheduled → Scheduled | Changing schedule on empty-roster activity | No | None — no students to conflict |
| Live → Live | Changing schedule on activity with students | **Yes — placement check** | Students with conflicts are removed (Scenario B) |

**The critical cases are Bucket → Live and Live → Live.** Both require checking all enrolled students against the proposed schedule. Both use the Scenario B flow: pre-summary showing who will be removed, option to proceed or cancel, "create activity with these students" offered for removed students.

**UI context:** Activity form (editing schedule fields), or future agenda view (drag-to-place). The placement check fires wherever schedule changes happen — it's not tied to a specific UI.

---

### 3. Enroll Students in Activity

**Trigger:** "Enroll" action on activity row, future dashboard enrollment panel
**What varies by state:**

| Activity state | Validation needed? | Conflict indicators? |
|---------------|-------------------|---------------------|
| Empty | No | No — nothing to conflict with |
| Bucket | No | No — no schedule to check against |
| Scheduled | **Yes — enrollment check** | Yes — show per-student block conflicts |
| Live | **Yes — enrollment check** | Yes — show per-student block conflicts |

**For Empty/Bucket:** Enrollment is frictionless. Pick students, add them. No validation, no conflict indicators. Fast.

**For Scheduled/Live:** Enrollment uses Scenario A flow. Pre-validation indicators in the student list (green/red per student for the target block). Pre-summary before commit. Skipped students offered "create activity with these students."

**UI context:** Enrollment floating panel, launched from activity table or future dashboard.

---

### 4. Unenroll Students from Activity

**Trigger:** Enrollment panel roster view, future student schedule view
**Precondition:** Students are enrolled in the activity
**What happens:** Selected students are removed from the activity's enrollment
**Validation:** Confirmation required ("Remove 3 students from Advisory?") but no conflict check — removing is always valid
**Consequences:** Students lose their enrollment. If the activity was Live, their schedule now has an opening in that block/day.
**UI context:** Enrollment floating panel (roster mode), or future student schedule panel

**Notes:** Unenrollment might ripple — if a student is removed from a Live activity, their schedule opens up, which might resolve a conflict that was blocking enrollment in another activity. We don't need to surface this proactively, but it's worth knowing it happens.

---

### 5. View / Build a Single Student's Schedule

**Trigger:** Student list action, future student profile page
**Precondition:** Student exists
**What happens:** Display the student's current schedule — all activities they're enrolled in, arranged by block/day/time. Gaps (open blocks) are visible.
**Validation:** N/A (read-only view, until enrollment actions are taken from here)
**UI context:** Student Schedule floating panel, or a dedicated student profile/schedule page

**Enrollment from this view:** The inverse of Action 3. Instead of "pick an activity, add students," it's "pick a student, add activities." The admin sees the student's schedule, sees the gaps, and picks activities to fill them. Conflict validation is the same logic, just triggered from the other direction.

**Notes:** This is the student-centric complement to the activity-centric enrollment panel. Both use the same validation logic and the same underlying enrollment API. The difference is the starting point and what context is visible.

---

### 6. Place an Unplaced Activity (Agenda View)

**Trigger:** Drag from unplaced zone to agenda grid (future dashboard)
**Precondition:** Activity exists in Empty or Bucket state
**What happens:** Activity gets a block/day/time assignment based on where it's dropped

This is really a specific UI for Action 2 (Edit Activity Schedule). The validation and consequences are identical:
- Empty activity being placed → no student check needed
- Bucket activity being placed → placement check against enrolled students (Scenario B)

**UI context:** Dashboard agenda view (drag-and-drop)

**Notes:** The drag interaction is a more visual way to do what the edit form does. The system doesn't care how the schedule fields got set — it just needs to run the placement check if students are enrolled. This means the placement-check logic should be in a shared hook or utility, not embedded in either the form or the drag handler.

---

### 7. Duplicate Activity

**Trigger:** Activity action menu, or "Create activity with these students" after conflict resolution
**Precondition:** Source activity exists
**What happens:** New activity created with fields copied from source. Schedule fields optionally included or cleared. Student roster optionally copied.

**Two flavors:**

| Flavor | Schedule copied? | Roster copied? | Use case |
|--------|-----------------|---------------|----------|
| **Full duplicate** | Yes (or optionally) | Optionally | "I need another section of Geometry at the same time" |
| **Conflict regroup** | No (cleared) | Yes (specific students) | "These 6 students still need Geometry but can't make Block 2" |

The "conflict regroup" flavor is what Scenario A and B offer after conflicts are found. The "full duplicate" is a general utility action.

**UI context:** Activity action menu (activity table), post-conflict summary panel

---

### 8. Swap / Move Students Between Activities

**Trigger:** TBD — possibly drag between activity cards, or multi-select in roster
**Precondition:** Both activities exist, student is enrolled in source
**What happens:** Student is unenrolled from source and enrolled in target. Atomic operation (both happen or neither).
**Validation:** Enrollment check against target activity (same as Action 3 for the target). If target is unplaced, no check. If target is scheduled, validate the student's schedule.
**UI context:** Future — possibly agenda view, possibly roster panel

**Notes:** This is syntactic sugar for unenroll + enroll. The value is making it one action instead of two separate steps. Lower priority — defer until the basic enrollment flow is solid.

---

## Where Actions Intersect

### Shared validation logic

| Validation type | Used by | Function |
|----------------|---------|----------|
| **Enrollment check** (can this student join this scheduled activity?) | Actions 3, 5, 8 | `validateEnrollment()` |
| **Placement check** (if I schedule this activity here, which enrolled students conflict?) | Actions 2, 6 | New — needs to be built. Iterates enrolled students, calls `validateEnrollment` for each against proposed schedule |
| **Time-based conflict visibility** (informational overlap display) | Actions 2, 5, 6 (agenda view context) | `wouldConflictByTime()`, `findTimeConflicts()` |

The placement check (Actions 2, 6) is the inverse of the enrollment check (Actions 3, 5, 8) — same core logic, different loop direction. This should share as much code as possible.

### Shared UI patterns

| UI pattern | Used by |
|-----------|---------|
| **Floating panel shell** | Actions 3, 4, 5, 7 (conflict regroup) |
| **Student list with conflict indicators** | Actions 3, 5 |
| **Pre-summary → confirm → results** | Actions 2 (placement), 3 (enrollment), 6 (drag-place) |
| **"Create activity with these students"** | Actions 2, 3, 6 (post-conflict in all cases) |
| **Activity form** | Actions 1, 2 (editing), 7 (pre-filled duplicate) |

### Shared data requirements

| Data | Used by | Caching strategy |
|------|---------|-----------------|
| All org enrollments (student → activities) | Actions 2, 3, 5, 6, 8 | React Query cache, loaded on first enrollment/scheduling interaction, invalidated on enrollment changes |
| All org students | Actions 3, 5 | React Query cache, standard |
| All org activities | Actions 3, 5, 6, 7, 8 | Already cached via `useActivities` |

---

## Observations

1. **The placement check is the missing piece.** We have `validateEnrollment` (check one student against one activity). We need the inverse: "check all enrolled students against a proposed schedule change." This is a loop over `validateEnrollment` with some wrapper logic for the Scenario B flow. Not complex, but it needs to exist as a named, testable function.

2. **Almost everything converges on the same conflict UI.** Whether the conflict surfaces during enrollment (Scenario A), placement (Scenario B), or student schedule building (Action 5), the display is similar: a list of students with conflict details, a pre-summary, and a "create activity" escape hatch. This argues for a shared `ConflictSummary` component.

3. **The floating panel is the right container for most of these.** Enrollment, roster management, student schedule view, and conflict resolution all benefit from being contextual, non-modal, and coexistent with the main workspace. The panel system earns its keep across multiple actions.

4. **Action 6 (drag-to-place) is just Action 2 with a different input method.** The validation and consequences are identical. This means we can build and test the placement check entirely through the activity form first, then wire it into drag-and-drop later with confidence that the logic is proven.

5. **The build order becomes clearer:**
   - **Phase 1:** FloatingPanel shell + enrollment API + enrollment panel (Actions 3, 4). This is the most self-contained piece and exercises the conflict UI for Scenario A.
   - **Phase 2:** Placement check utility + wire into activity form (Action 2). This adds Scenario B handling and the "create activity with these students" flow.
   - **Phase 3:** Agenda view (Action 6) — builds on everything above. Drag-to-place is Action 2's logic in a visual wrapper.
   - **Phase 4:** Student schedule view (Action 5) — enrollment from the student direction. Reuses existing enrollment logic and floating panels.
   - **Phase 5:** Dashboard composition — brings it all together.

---

## Decided

1. **Placement check blocks the save.** No "save anyway with known conflicts" option for v1. If the admin changes the schedule and students would conflict, they must either proceed (removing those students) or cancel. This may create edge cases with activities whose times differ from their assigned block boundaries, but we'll address those if they occur.

2. **Activity form uses a conditional confirmation step at submit.** No live field-watching or real-time preview. Admin edits schedule fields, hits save. If the activity has enrolled students AND schedule fields changed, a confirmation dialog appears: "4 students will be removed — proceed?" If no enrolled students, save just saves. The enrollment panel handles the other direction (students changing against a known schedule) independently via its own pre-summary pattern. Two separate UI moments, same underlying validation logic.

3. **"Create activity with these students" is a background action.** Button appears in the conflict summary (wherever that summary renders — enrollment panel, activity form confirmation, future agenda view). Clicking it creates the bucket silently and shows a link to the new activity. No navigation, no new panel, no disruption to the admin's current context. Floating-activities-as-records (where individual activity records open in resizable panels) is interesting for later but adds panel complexity (resizing) that isn't warranted yet.

## Open Questions

1. **Archive / deactivate lifecycle.** `is_active = false` works short-term but degrades query performance as enrollment history accumulates across years. The real solution is probably a term-based archival process: snapshot enrollment history, clear the active working set for a new term. Active enrollment queries stay fast, historical data lives somewhere queryable but separate. Needs its own design thinking — not blocking enrollment UI work, but a known future problem that affects data model decisions.

2. **Is there an action we're missing?** Merge activities (combine two rosters)? Transfer a student between schools/orgs? Term rollover (what happens to enrollments when a new term starts)? These are likely edge cases for later, but worth a quick scan.
