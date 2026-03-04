# Enrollment Panel — Build Spec

**Created:** March 4, 2026
**Status:** Ready for implementation
**Context:** Consolidates decisions from `enrollment-and-floating-panels.md`, `schedule-action-map.md`, and the March 4 design conversation. This is the implementation handoff doc.

---

## What We're Building

A floating panel that handles enrolling students into activities and unenrolling them. One panel, one component, two entry points. The panel is the first feature using the FloatingPanel shell, which is a reusable container for future contextual tools.

---

## FloatingPanel Shell

A reusable, content-agnostic container for contextual tool windows.

### Behavior

- **Opens center-screen.** No trigger-relative positioning for now — pages are still evolving and we don't know what "near the trigger" should look like yet.
- **Draggable** via title bar (title bar is the drag handle).
- **Minimize** collapses to a compact bar (title + restore/close). Minimized panel stays where it was, remains draggable. Same fixed width as the expanded panel.
- **Close** dismisses entirely.
- **Viewport clamping** — panel cannot be dragged partially off-screen.
- **Z-index** — click-to-front. Most recently interacted panel gets highest z-index.
- **No backdrop.** No dimming. The panel is a workspace tool, not a modal. Background remains fully interactive.
- **Multiple panels** can be open simultaneously.

### Shell Component Props

```
<FloatingPanel
  title="Enrollment"        // shown in title bar
  defaultWidth={420}         // reasonable default for enrollment content
  onClose={() => {}}         // close handler
>
  {children}                 // panel content — shell doesn't know what's inside
</FloatingPanel>
```

Shell handles: title bar rendering, drag, minimize/restore, close, z-index, viewport clamping, default sizing.
Shell does NOT handle: content layout, data fetching, validation, scroll behavior of content.

### Visual Treatment

- Elevated with a noticeable shadow (must float visually above the page)
- Solid background, not transparent
- Rounded corners, consistent with DaisyUI card styling
- Title bar visually distinct (slightly different background or weight) to signal drag handle
- Compact but not cramped

### Not Building Yet

- Trigger-relative positioning (revisit when page layouts stabilize)
- Panel-to-panel communication
- Mobile/tablet adaptation (admin use is primarily desktop)
- Edge snapping / docking
- Keyboard-driven repositioning (panels should be closable/minimizable via keyboard, but drag is mouse-only for now)

---

## Enrollment Panel

### Two Entry Points, One Component

**Entry A — From an activity row:**
Admin clicks "Enroll" on an activity row in Activity Management. Panel opens with that activity pre-selected in the dropdown. Already-enrolled students appear in the staged zone.

**Entry B — Without activity context (future):**
Panel opens with no activity selected. Full student list, empty staged zone. Admin stages students first, then selects an activity from the dropdown. (The trigger for this entry point doesn't exist yet — Activity Management "Enroll" action is the only trigger for the initial build.)

Both entries use the same `EnrollmentPanel` component. The only difference is whether `initialActivityId` is provided.

### Panel Layout (top to bottom)

1. **Activity dropdown** — select from all org activities. Pre-populated if opened from an activity row. Changing the selection resets staged students (with confirmation if any are staged) and refreshes conflict indicators.

2. **Search/filter bar** — text search by student name. Grade filter. Compact, single row.

3. **Scrollable student list** — this is the main interaction surface. Fixed height with scroll. Two zones separated by a visual divider:
   - **Staged zone (above divider):** Students who will be enrolled on submit. Includes students already enrolled in the DB (if activity was pre-selected) plus any the admin has clicked up from below.
   - **Available zone (below divider):** All other org students. Click to stage.

4. **Action footer (below the scrollable list, always visible):** Enroll/confirm button and confirmation summary text. This area is pinned — it doesn't scroll with the list.

### Student List Interaction

**The list is the UI.** No checkboxes. Click a student to move them between zones.

- **Click a student below the divider** → they move above the divider (staged for enrollment).
- **Click a student above the divider** → they move below the divider (un-staged). If they were already enrolled in the DB, this stages them for unenrollment.

**Visual states for students:**

| State | Location | Visual treatment |
|-------|----------|-----------------|
| Available, no conflict | Below divider | Normal text, no indicator |
| Available, has conflict | Below divider | Subtle indicator (small dot/icon). No text detail — just a signal |
| Staged, no conflict | Above divider | Normal staged appearance |
| Staged, has conflict | Above divider | Conflict detail line: "Conflicts with [Activity Name] — Block 3, MWF" |
| Already enrolled (from DB) | Above divider | No special indicator — they're just in the staged zone where they belong |
| Pending unenroll (was enrolled, moved below) | Below divider | ⛔ or red highlight + "will be unenrolled" label. Visually distinct from never-enrolled students |

**Conflict indicator logic:**
- Indicators only appear when the selected activity has a schedule (block and/or days/times).
- If the activity is unplaced (no schedule), no conflict checking — enrollment is frictionless.
- Conflict data comes from the cached org enrollments (see Data section below). All checking is client-side.

**Note on conflict display rationale:** In a list of 80 students, many might conflict for a given block — a wall of red indicators would be noise, not signal. The subtle dot below the divider says "heads up" without overwhelming. Full conflict detail appears above the divider where it's actionable — you've committed to looking at this student by staging them.

### Submit Flow

The action footer has two states:

**Ready state:**
- Shows a count: "X students to enroll" (and "Y to unenroll" if applicable)
- "Enroll" button (or "Save Changes" if it's a mix of enrollments and unenrollments)

**Confirmation state (after clicking the button):**
- Panel footer expands slightly to show a summary:
  - Students to be enrolled (count), broken into no-conflict and conflict groups
  - Students to be unenrolled (count), if any
  - For conflicted students: "N students have conflicts and will be skipped." Expandable detail per student showing what the conflict is.
- Button text changes to "Confirm"
- A "Back" or "Cancel" option to return to the ready state

**After confirm:**
- Mutations fire (enroll the clean ones, skip conflicted, unenroll the pending-unenrolls)
- Summary updates to past tense: "5 enrolled. 2 skipped (conflicts). 1 unenrolled."
- If any students were skipped due to conflicts, a "Create activity with these students" link appears (see below)
- Panel stays open — admin can continue working or close it

### "Create Activity with These Students"

Appears in the post-commit summary when students were skipped due to conflicts.

**What it does:**
- Creates a new activity with title "[Original Activity Title] - Enrollment Conflict"
- Type copies from original activity
- No schedule (created as an unplaced bucket)
- Pre-enrolls the skipped students
- All happens in the background (no navigation, no new panel)

**After clicking:**
- Link text changes to "[New Activity Title] created. Click here to view." with a link to the activity (navigates to Activity Management or opens the activity, TBD)
- React Query cache for activities and enrollments is invalidated

This is a convenience action — it keeps the admin from losing track of students who still need placement. It's not automatic; the admin has to click it.

---

## Data Layer

### New API Functions (`src/api/`)

**`getOrgStudents(organizationId)`**
Returns all students in the org. May be a filtered version of an existing user query (role = 'student'). Returns: array of `{ id, first_name, last_name, grade_level, ... }`.

**`getOrgEnrollments(organizationId)`**
Returns ALL active enrollments for the org, with joined activity data. This is the cache-everything approach — one query loads all enrollment data needed for client-side conflict checking. Returns: array of `{ id, student_id, activity_id, activity: { name, block, days_of_week, rotation_day_type, start_time, end_time, ... } }`. Cached in React Query, invalidated on enrollment changes.

**`getActivityEnrollments(activityId)`**
Returns enrollments for a specific activity with joined student data. Used to populate the staged zone when the panel opens from an activity row. Returns: array of `{ id, student_id, student: { first_name, last_name, grade_level }, ... }`.

**`createEnrollments(enrollments)`**
Batch insert. Accepts array of `{ student_id, activity_id }`. Returns created records.

**`deleteEnrollments(enrollmentIds)`**
Batch delete for unenrollment. Accepts array of enrollment IDs.

### New Hooks (`src/hooks/`)

Follow existing patterns (TanStack Query wrappers):

- `useOrgStudents(organizationId)` — wraps `getOrgStudents`
- `useOrgEnrollments(organizationId)` — wraps `getOrgEnrollments`
- `useActivityEnrollments(activityId)` — wraps `getActivityEnrollments`
- `useCreateEnrollments()` — mutation, invalidates enrollment queries on success
- `useDeleteEnrollments()` — mutation, invalidates enrollment queries on success

### Conflict Checking (client-side)

Uses existing `validateEnrollment()` from `src/lib/enrollmentValidation.js`. The enrollment panel:

1. Loads all org enrollments via `useOrgEnrollments` (cached after first load)
2. When a student is evaluated for conflict: filters cached enrollments to that student's records, passes them + the target activity to `validateEnrollment()`
3. Result determines the conflict indicator and detail text

No new validation logic needed — just wiring existing functions to the cached data.

---

## Integration with Activity Management

**Activity table:** Add an "Enroll" action to each activity row (alongside existing edit/delete actions). Clicking opens a FloatingPanel with an EnrollmentPanel inside, passing the activity ID.

**Activity form (Scenario B — deferred):** When editing an activity's schedule fields, if the activity has enrolled students, a placement check should run on submit. This is NOT part of this build — it's documented in `enrollment-and-floating-panels.md` and `schedule-action-map.md` as a separate phase.

---

## What's Deferred

- **Scenario B (placement check on schedule edit):** Adding/changing an activity's schedule when students are enrolled. Separate build phase.
- **Roster tab / Details tab:** The panel could grow tabs for roster management and activity details. Later.
- **Activity creation from dropdown:** "+ New Activity" option in the panel's activity dropdown. Later.
- **Student-centric enrollment (Entry B trigger):** The panel supports no-activity-selected mode, but no UI trigger exists for it yet. Will come with student schedule view or dashboard.
- **Hover details on conflict indicators:** Skipped — click-to-stage already reveals the detail. Hover adds complexity without new information.
- **Mobile/tablet adaptation:** Admin use is desktop-primary. Revisit later.

---

## Build Order

1. **FloatingPanel shell component** — drag, minimize, close, z-index, center-open, viewport clamping. Test with placeholder content.
2. **Enrollment API functions + hooks** — `getOrgStudents`, `getOrgEnrollments`, `getActivityEnrollments`, `createEnrollments`, `deleteEnrollments`. Follow existing patterns in `src/api/` and `src/hooks/`.
3. **EnrollmentPanel component** — activity dropdown, search/filter, two-zone student list, conflict indicators, submit flow with confirmation.
4. **Wire into Activity Management** — "Enroll" action on activity rows, launches FloatingPanel with EnrollmentPanel.
5. **"Create activity with these students"** — post-conflict convenience action in the summary.

---

## Relationship to Other Docs

- **`enrollment-and-floating-panels.md`** — the original design exploration. This build spec supersedes it for implementation details but that doc retains useful context on the design reasoning, especially around Scenario B and future panel uses.
- **`schedule-action-map.md`** — maps all admin actions affecting schedules. Enrollment (Action 3) and unenrollment (Action 4) are covered here. Placement checks (Action 2) are deferred.
- **`CLAUDE.md`** — documents the "enrollment is a workflow, not a page" principle. This panel approach is consistent.
