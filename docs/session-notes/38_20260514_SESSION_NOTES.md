# Session 38 — May 14, 2026

## Prep specs for #86 — three small standalone build specs

**What happened:** Picked up #86 (Phase 1 teacher agenda layout rewrite) and, before drafting the spec proper, identified three small pieces of preparatory work that should ship independently. Wrote build specs for all three. No application code changed; deliverables are three new docs in `docs/user-flows/`.

This session is the start of the #86 conversation, not its completion. The next session will pick up with #86's spec proper.

---

## Going in

Two anchor documents existed from session 37: `teacher-agenda-design-direction.md` (the design direction) and `terry-thursday-v2.html` (the v2 reference demo). Both were produced largely without reference to the actual codebase, so the working hypothesis going in was: there are bound to be features in the design that have no correlate in the app as it exists today.

That turned out to be correct. While reading the design doc against `Dashboard.jsx`, `SingleDayAgenda.jsx`, `agendaUtils.js`, `ActivityDetail.jsx`, and `10-rls-policies.md`, several gaps surfaced:

- **"Prep" is treated as a role in the design doc.** It isn't a role in the codebase. Prep is just an activity owned by a teacher with no students enrolled.
- **`visible_to_all_staff` doesn't exist.** The design doc commits to a whole sidebar driven by this flag. The flag was originally scoped to #70, never specced, never implemented.
- **`start_time_override` / `end_time_override` don't exist.** The design doc bakes late-arrival treatment into the card and roster (#87's UI side), but the underlying enrollment columns aren't there yet.
- **Role is derived from `teacher_id` / `monitor_id`, not stored.** The design doc's aggregation key — `(start_time, end_time, role)` — needs "role" to be a function over `(activity, viewer)`. That derivation isn't centralized today; consumers do it ad hoc.
- **The current Dashboard groups by block.** The new design replaces block-grouped aggregates with time-only individual activities flowed through role-aware clustering. That's the central rewrite of #86.

Going-in question: which of these are real prerequisites worth shipping standalone before #86, and which fold naturally into #86's spec?

---

## Where we landed

Three pieces of preparatory work warrant standalone specs. They're independent of each other, independent of #86 itself, and small enough that Claude Code can build them in parallel while #86's spec is drafted.

### 1. Role derivation helper (`role-derivation-helper-build-spec.md`)

A new module `src/lib/staffRoles.js` exporting `getViewerRole(activity, viewerId) → 'teacher' | 'monitor' | null`. Today the body reads `activity.teacher_id` and `activity.monitor_id`. Post-#70 the body reads `activity.activity_staff[].role`. The signature and return shape never change.

This is a **seam, not an abstraction.** It exists so the #70 migration becomes a one-file change rather than a sweep across every consumer. The helper deliberately excludes prep detection — prep is a presentation-layer concern computed from enrollment count, not a property of the staff relationship.

### 2. `visible_to_all_staff` flag (`visible-to-all-staff-flag-build-spec.md`)

`ALTER TABLE activities ADD COLUMN visible_to_all_staff BOOLEAN NOT NULL DEFAULT false`. New entry in `ActivityDetail.jsx`'s `BEHAVIOR_FLAGS` array using the `UsersThree` Phosphor icon (rationale: the flag means "this is for all staff," which `UsersThree` expresses directly without leaning on a visibility metaphor that could read the wrong way). The icon follows the existing active/inactive pattern; no mutual exclusion logic, no help text — tooltip is the entire explanation.

**Important RLS realization mid-drafting:** the flag itself needs no RLS change. Teachers can already read all activities in their org. But the sidebar's actual content (the rosters and instances of visible-to-all activities a teacher isn't assigned to) requires widening RLS on `enrollments`, `activity_instances`, `attendance_records`. That widening lives in #86's spec, not here. The flag spec is intentionally inert at the agenda layer.

### 3. Enrollment time overrides (`enrollment-time-overrides-build-spec.md`)

`ALTER TABLE enrollments ADD COLUMN start_time_override TIME, ADD COLUMN end_time_override TIME` (both nullable). New "Arrival / departure overrides" section in `EnrollmentScheduleEditor`. Schedule summary text (`getEnrollmentScheduleSummary`) extended to include `"arr H:MM"` and `"leaves H:MM"` parts. The `canEdit` gate is lifted from requiring `days_of_week.length > 0` because overrides are valid even on activities that use rotation or have no day-level scheduling.

Explicitly out of scope: any teacher-agenda visual treatment, any change to `enrollmentMeetsToday`, any change to conflict detection. This is the data layer of #87; the UI payoff lives in #86.

---

## Settled decisions for #86 itself

In addition to the prep specs, several #86 structural questions got resolved this session so the spec proper can be written cleanly next time:

- **Sidebar is in #86's scope** (not deferred). Driven by the fact that the visible-to-all flag was a staff-requested feature — deferring the sidebar would mean shipping a redesign that visibly omits a thing they asked for.
- **Layout logic splits across two layers.** `SingleDayAgenda` becomes a pure overlap-resolving primitive (fixes #88, helps student view too). Role-aware clustering lives in a new teacher-specific layer above it.
- **Prep detection is computed**, not stored. Teacher-role + zero enrollments = prep treatment.
- **Role is derived per (activity, viewer)**, via the helper above. Spec describes role as a function, not a field.
- **Block-attendance affordance:** one button per block at the top of the agenda, clicking opens a combined roster with per-activity sub-headers (carry-over from v1 demos).
- **`groupActivitiesByBlock` and the existing `displayItems` aggregate logic get gutted.** They enforce the block-centric layout that #86 is replacing.
- **Styling, iconography, and overall look-and-feel** for the new agenda are deferred until after the structural spec is settled. Easier to design icons against a fixed inventory than against a moving target.

---

## What's outstanding

- Three prep specs ready to commit and hand off to Claude Code.
- #86 spec proper not yet written. Next session picks it up.
- **Data re-entry note:** the "~460 → ~120-150" framing in STATUS.md is stale. The consolidation pass is done. What remains is time-accuracy — adjusting individual activity start/end times to match reality, which Daniel will gather from City House staff/students incrementally. It's no longer a blocker for #86 work.

---

## Files added

- `docs/user-flows/role-derivation-helper-build-spec.md`
- `docs/user-flows/visible-to-all-staff-flag-build-spec.md`
- `docs/user-flows/enrollment-time-overrides-build-spec.md`

## Files modified

- `STATUS.md` (data re-entry framing updated; prep specs noted; next-steps reordered)
