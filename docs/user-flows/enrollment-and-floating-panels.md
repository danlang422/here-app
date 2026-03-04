# Enrollment UI & Floating Panel System

**Created:** March 4, 2026
**Status:** Planning — capturing design decisions and open questions before implementation

---

## Two Concepts in One Doc

This doc covers two related things that emerged from the same design conversation:

1. **The enrollment workflow** — how admins add students to activities, and when/where validation happens.
2. **The floating panel system** — a general-purpose UI pattern for contextual tools that don't steal focus from the main workspace.

The enrollment UI is the first feature built using floating panels, but the panel system is designed to be reusable for other contextual UIs (activity details, student schedule view, roster management, etc.).

---

## Floating Panel System

### Core Concept

Floating panels are lightweight, non-modal tool windows that appear near the action that triggered them. They provide contextual UI without taking over the screen — the admin keeps full visibility of whatever they were looking at (activity table, dashboard, agenda view) while working in the panel.

This is intentionally different from modals (which steal focus and dim the page) and slide-overs (which push content aside). The mental model is closer to tool palettes in design software — small, focused, repositionable windows that complement the main workspace.

### Panel Shell Behavior

**Appearance:** Panels open near the trigger element (button, row action, etc.) that summoned them. No backdrop dimming — the panel is just another layer on the workspace.

**Draggable:** Panels have a title bar that supports drag-to-reposition. The admin can move panels anywhere on screen to arrange their workspace.

**Multiple panels:** No artificial limit. The admin can open several panels simultaneously and arrange them as needed. Use cases include: enrollment panel open alongside the activity table, a student schedule panel open next to an enrollment panel for cross-referencing, etc.

**Minimize:** In addition to a close button, panels have a minimize button that collapses the panel to a compact bar (title + restore/close controls). Minimized panels remain draggable and can be restored to full size. This lets the admin keep panels accessible without them blocking the workspace.

**Close:** Closing a panel dismisses it entirely. Unsaved state (if any) should prompt before closing.

### Panel Shell Component (`FloatingPanel`)

The shell handles universal panel behavior. Content is passed in as children — the shell doesn't know what's inside it.

**Shell responsibilities:**
- Title bar with panel name
- Drag-to-reposition (title bar is the drag handle)
- Minimize / restore toggle
- Close button
- Reasonable default sizing (content-driven, with min/max constraints)
- Z-index management (clicked panel comes to front)
- Initial positioning near trigger element

**Shell does NOT handle:**
- Content layout or state
- Data fetching
- Validation logic
- Communication between panels

### Visual Treatment

- Elevated with a noticeable shadow (needs to float visually above the page)
- Solid background (not transparent — content needs to be readable over whatever's behind it)
- Compact but not cramped — the panel is a tool, not a full page
- Rounded corners, consistent with DaisyUI card styling
- Title bar visually distinct (slightly different background or weight) to signal "grab here to move"

### Decided — Floating Panels

- **Default sizing:** Fixed width per panel type for now. Find a good size per panel and run with it.
- **Screen edge behavior:** Clamp to viewport bounds — no partial off-screen. We don't want panels getting lost.
- **Minimize bar:** Same fixed width as the panel, title only, minimizes in place (stays where it was).
- **Z-index:** Click-to-front — most recently interacted panel gets highest z-index.
- **Backdrop:** None. No dimming. Panels are workspace tools, not modal interruptions.

### Open Questions — Floating Panels

1. **Mobile/tablet:** Floating panels are a desktop pattern. On smaller screens, these probably need to become full-screen modals or bottom sheets. Not a blocker — admin access is primarily desktop. Revisit when mobile work begins.

2. **Panel-to-panel communication:** For now, panels are independent. Future cases where one panel might react to another (e.g., selecting a student in a roster panel highlights their schedule in a schedule panel) are plausible. Defer but don't design in a way that makes it impossible.

3. **Keyboard accessibility:** Drag-to-reposition is mouse-centric. Panels should be closable/minimizable via keyboard. Focus trapping is NOT desired (unlike modals) since the background should remain interactive. Need to figure out how focus works when multiple panels and the background are all interactive — what "has focus" at any given moment.

4. **Edge snapping / docking:** Not for initial build, but the concept of minimized panels "clicking together" or snapping to screen edges could be interesting later.

---

## Enrollment Workflow

### When Validation Happens

Enrollment validation is context-dependent based on whether the target activity has a schedule:

**Scheduled activity (has block and/or days/times):**
Validation runs during enrollment. The enrollment UI shows per-student conflict indicators as the admin selects students. Conflicts are visible before committing, and the admin can decide whether to proceed (for students without conflicts) or address conflicts first.

**Unplaced activity (no block or schedule):**
No enrollment validation needed. The whole point of bucket-style activities is "I know these students need this, I just don't know where it goes yet." Enrollment is fast and frictionless — just pick students and add them.

**Placing a previously-unplaced activity (adding schedule to activity with enrolled students):**
Validation runs at placement time, not enrollment time. When the admin adds or changes an activity's block/days/times, the system checks all enrolled students for conflicts with the proposed schedule and surfaces the results. This check happens wherever schedule changes happen — the activity form, the future agenda view drag-and-drop, etc.

This means the enrollment UI itself has a clean, bounded job: select students, optionally show conflicts (if the activity is scheduled), and commit. The placement-time validation is a separate concern owned by whatever UI modifies the schedule.

### Enrollment Flow — Launched from Activity Management

The first context for enrollment is the activity table. Each activity row has an action to open the enrollment panel for that activity.

**Entry point:** Action button/link on activity row → opens a floating panel anchored near that row.

**Panel content — Enrollment mode:**

The target activity is already known (the one the admin clicked on). The panel shows:

1. **Header:** Activity name, schedule summary (block, days, times — or "Unplaced" if no schedule), current enrollment count.

2. **Student list:** All students in the organization, with search/filter. Each student row shows:
   - Name
   - Current enrollment status for this activity (already enrolled, not enrolled)
   - If the target activity is scheduled: conflict indicator (open/conflict for the target block on shared days)
   - Checkbox for selection

3. **Action:** "Enroll selected" button. For scheduled activities, this runs `validateEnrollment` for each selected student and either enrolls (if valid) or shows conflict details (if not). For unplaced activities, this enrolls immediately with no validation.

**Batch behavior — two scenarios with different stakes:**

Enrollment conflicts surface in two distinct contexts, and the language, consequences, and available actions are different for each.

**Scenario A: Enrolling students into a scheduled activity.**
The students aren't in this activity yet. Conflicts mean some can't be added.

1. Admin selects students and clicks "Enroll"
2. Pre-summary: "Ready to enroll 8 students. 3 students have conflicts and will be skipped." Conflict details expandable per student.
3. Admin can proceed (enrolls the 8, skips the 3) or go back to adjust selection.
4. After committing: "8 enrolled. 3 skipped." Skipped students remain in the student list, unenrolled, unchanged.

The skipped students stay wherever they were. Nothing is lost in the database — but the admin still wanted these students in this group. The summary offers the same **"Create activity with these students"** action as Scenario B, so the admin can quickly regroup the skipped students into a new bucket if needed.

**Scenario B: Scheduling an activity that already has enrolled students (placing a bucket).**
The students are already in this activity. Conflicts mean some will be *removed* — this is a destructive action.

1. Admin adds or changes block/days/times on the activity.
2. System checks all enrolled students against the proposed schedule.
3. Pre-summary: "14 students have no conflicts. 6 students conflict and will be removed from this activity if you proceed." Conflict details expandable per student.
4. Admin can proceed (keeps 14, removes 6) or cancel the schedule change.
5. After committing: summary shows the 6 removed students, and offers a **"Create activity with these students"** action right there in the summary.

The "create activity" action duplicates the original activity's core fields (name, type, relevant properties), clears the schedule fields, and pre-enrolls the removed students — producing a new bucket ready to be scheduled in a different slot. This is a one-click convenience, not an automatic behavior. If the admin doesn't want to create the bucket (maybe they'll rearrange other things first), they dismiss and move on.

The key principle: the system doesn't track "students who still need Geometry" on the admin's behalf. But it makes acting on that knowledge easy in the moment, reducing the friction from "remember 6 names, create activity, find them, re-add" to one click.

### Pre-Validation (Conflict Indicators in Student List)

For scheduled activities, the student list should show conflict status *before* the admin selects students. This requires loading each student's current enrollments (or at least their block occupancy for the relevant block/days).

**Caching strategy:** Load all active enrollments for the entire org (all students) on first enrollment panel open and cache in React Query. The data shape is a map of `studentId → [enrollments with joined activities]`. Conflict checks then run purely client-side: iterate selected students, compare their cached enrollments against the target activity. New enrollments created by the admin invalidate the cache, so subsequent checks reflect them. At City View's scale (~80 students, a few hundred enrollments), this is trivially small. For larger schools, server-side conflict checking would eventually replace this, but the cache-everything approach buys significant runway.

**Conflict indicator options:**
- Green/open: student has no conflict with this activity's block/day
- Red/conflict: student already has something in this block on overlapping days
- No indicator: activity is unplaced, so no conflict check is possible

### Data Requirements

**New API functions needed:**

- `getStudentEnrollments(studentId)` — returns a student's active enrollments with joined activity data. Needed for per-student validation.
- `getOrgStudents(organizationId)` — returns all students in the org. May already exist or be covered by existing user queries filtered to role='student'.
- `createEnrollment(enrollment)` / `createEnrollments(enrollments)` — create one or more enrollment records. Need to decide on single vs. batch insert.
- `getActivityEnrollments(activityId)` — returns all enrollments for an activity with joined student data. Needed for the header enrollment count and for the "already enrolled" indicator.

**Existing functions that support enrollment:**
- `validateEnrollment(newActivity, existingEnrollments)` — in `enrollmentValidation.js`, ready to use.
- `findAvailableBlocks(studentEnrollments, orgSettings)` — could power the conflict indicators.

### Enrollment Panel vs. Activity Detail Panel

The floating panel opened from an activity row could have multiple modes or tabs:

- **Details:** Read-only summary of the activity (schedule, staff, settings, enrollment count). Quick reference without opening the full edit form.
- **Enroll:** The student picker and enrollment flow described above.
- **Roster:** List of currently enrolled students with actions (remove, view schedule).

For the initial build, **Enroll** is the priority. Details and Roster are natural additions but can come after the enrollment flow is working.

### Decided — Enrollment

- **Batch behavior:** Pre-summary pattern (preview before commit) with scenario-appropriate language. Both scenarios offer one-click "create activity with these students" for conflicted students. Scenario A language: "skipped." Scenario B language: "removed." See details above.
- **Pre-validation caching:** Load all org enrollments into React Query cache, run conflict checks client-side. See caching strategy above.
- **Student list filtering:** Search by name and grade filter for initial build. Block availability indicators shown when target activity is scheduled. Other filters (block availability as a filter, enrolled-in-similar-activities) can expand based on real usage.
- **Enrollment confirmation:** Pre-summary with expandable conflict details, then past-tense confirmation after commit. Inline in the panel, not a toast.

### Open Questions — Enrollment

1. **Removing enrollments:** The enrollment panel student list should show currently-enrolled students (checked/highlighted, likely sorted to top). Unenrolling = unchecking. Needs a confirmation step since unenrollment is a meaningful action ("Remove 2 students from Advisory?"). May also want a minus button or batch "Unenroll" action. Exact UX TBD.

2. **Enrollment from the student direction:** "Pick a student, build their schedule" is a real use case, separate from the activity-centric flow built here. Likely a Student Schedule floating panel or a student profile page with schedule view and enrollment actions. Defer to later — composable design supports it.

3. **Activity duplication / roster copy:** Has a concrete use case now — Scenario B's "create activity with these students" action is essentially a partial duplication (copy core fields, clear schedule, pre-enroll specific students). General-purpose activity duplication (copy title, schedule, properties, optionally roster) is also useful. Both could share underlying logic. Scope and exact field selection TBD.

4. **Pre-validation at scale:** The cache-everything approach works for City View (~80 students). At what student/enrollment count does this need to move to server-side conflict checking? Probably not relevant until multi-school, but worth noting the assumption.

---

## Relationship to Other Docs

- **`admin-dashboard.md`** — describes the dashboard's enrollment patterns (drag-to-enroll, two-panel modal flow). The floating panel system is the implementation vehicle for the two-panel flow, and could also serve drag-to-enroll result display.
- **`CLAUDE.md`** — documents enrollment as a workflow, not a page. The floating panel approach is consistent with this — enrollment is a contextual action, not a destination.
- **`enrollmentValidation.js`** — the pure validation functions that the enrollment UI calls. No changes needed to the validation module for this work.

---

## Build Order

1. **`FloatingPanel` component** — the reusable shell (drag, minimize, close, z-index management, positioning near trigger).
2. **Enrollment API functions** — `getOrgStudents`, `getStudentEnrollments`, `getActivityEnrollments`, `createEnrollments`.
3. **`EnrollmentPanel` content** — student list with search, conflict indicators (for scheduled activities), select and enroll flow, batch result display.
4. **Wire into Activity Management** — add "Enroll" action to activity table rows, launch floating panel.
5. **Iterate** — add Details tab and Roster tab to the activity panel based on real usage.
