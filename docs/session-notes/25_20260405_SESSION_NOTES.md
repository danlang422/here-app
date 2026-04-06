# Session 25 — April 5, 2026

## Enrollment-Level Scheduling — Design Session

**What happened:** Analyzed the normalized City View schedule data and discovered the root cause of the activity count explosion (460 activities for 53 students). Designed a data model change that resolves the problem without breaking existing architecture.

### The problem

The normalized schedule CSV revealed that the current model requires a new activity row for every unique combination of name + location + block + days_of_week + rotation_day_type. Per-student day-of-week variation within the same classroom container was driving massive duplication: "Independent Work Time" alone produced 100 activity rows because each student has a slightly different day pattern.

Breakdown of the 460:
- Independent Work Time: 100 (per-student day variation across hubs/blocks)
- Edgenuity / Khan Academy: 120 (same course, different hub + block + days per student)
- Worktime on [Subject]: 40 (same as IWT)
- Internships: 46 (same site, different day patterns)
- Advisory: 14 (hub splits + day variation)
- Kirkwood: 56 (hub/campus splits + day variation)
- Other: ~84

57% of all activities (260/460) are work-time or online-course activities. 43% are structured.

### The insight

Scheduling variation between students belongs on the enrollment, not the activity. An activity defines a container (staffed room, known time, known days). An enrollment defines a student's participation within that container, which may be a subset of the container's schedule.

This matches how teachers think about it: Kali doesn't think she has 13 different activities in Block 4. She has Independent Work Time and a bunch of kids on various days.

### The design

Four nullable columns added to `enrollments`:
- `days_of_week INTEGER[]` — which days this student attends (subset of activity's days)
- `rotation_day_type TEXT` — which rotation day this student attends
- `recurrence_interval INTEGER` — how often this student attends
- `recurrence_anchor_date DATE` — anchor week for this student's recurrence

All null by default = "follow the activity's schedule." Fully backward compatible.

New predicate `enrollmentMeetsToday` runs after `activityMeetsToday` and applies enrollment-level narrowing. Conflict detection refactored to compare enrollment-effective schedules instead of raw activity fields.

### Key decisions made

1. **Enrollment days must be a subset of activity days** — can't enroll on a day the activity doesn't run. UI enforces this.
2. **When activity days change, warn about orphaned enrollment days** — allow the change but auto-adjust affected enrollments, flag any that end up with empty days.
3. **Roster defaults to "today's students"** — filtered by `enrollmentMeetsToday`. Full roster toggle available but attendance only markable for today's students.
4. **Extends #51 (inline enrollment), doesn't replace it** — adds per-enrollment scheduling controls within the existing inline enrollment UI.
5. **Focus/assignment concept is separate** — out of scope for this change.
6. **Reverses the "activity splitting, not enrollment overrides" decision** from `admin-calendar-redesign-design-doc.md`. That decision was made before the full schedule was normalized; the real data makes the case overwhelming.

### Impact estimate

Activity count drops from ~460 to ~120–150 for the same schedule. Combined with freeform consolidation (IWT/Worktime → freeform blocks, Edgenuity/Khan → unscheduled), could approach 100–120.

### Deliverable

Design doc written: `docs/user-flows/enrollment-level-scheduling-design-doc.md`. Covers the problem, schema change, predicate changes (with pseudocode), conflict detection refactor, UI changes (inline day/rotation/recurrence editors on enrollment rows), migration path, invariants, and future considerations.

STATUS.md updated with new priorities — enrollment-level scheduling is now the top priority, ahead of #61 and #62. Data entry paused until the schema change lands.

### What's ready for next session

- Claude Code reads the design doc and writes a build spec
- Schema migration is minimal (4 nullable columns, 2 check constraints)
- Trickiest implementation work: conflict detection refactor in `enrollmentValidation.js` and the compact inline enrollment scheduling UI in ActivityDetail
- After implementation: clear existing activity/enrollment data and re-enter from scratch using the consolidated model
