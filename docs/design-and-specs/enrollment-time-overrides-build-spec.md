# `start_time_override` / `end_time_override` on Enrollments — Build Spec

**Date:** May 14, 2026
**Status:** Ready to build
**Related:** #87 (parent issue — per-enrollment arrival time override), #86 (teacher agenda — UI consumer for late-arrival display, out of scope here), `enrollment-level-scheduling-design-doc.md` (the existing per-enrollment scheduling pattern this extends)

---

## Purpose

Add nullable per-enrollment time overrides to the `enrollments` table, plus the admin-side UI to set, view, and clear them. This is the **data layer** of #87. The teacher agenda's late-arrival chip and "Arriving later" roster section — the user-facing payoff — are built in #86, which reads these columns.

Shipping the data layer separately lets #86 build against real fields rather than a placeholder, and lets admins start populating override times as that data becomes available from City View staff (the practical gating step called out in #87 and in fieldwork issue #89).

---

## Scope

**In scope:**
- Migration adding `start_time_override TIME` and `end_time_override TIME` to `enrollments`, both nullable
- Schedule editor UI (`EnrollmentScheduleEditor` in `ActivityDetail.jsx`) extended with time-override inputs
- Schedule summary text (`getEnrollmentScheduleSummary` in `ActivityDetail.jsx`) extended to display overrides when set
- Update mutation flow already in place via `useUpdateEnrollment` — confirm it propagates the new fields

**Out of scope:**
- Any teacher-agenda visual treatment of overrides (chip, roster section, sorting). All teacher-agenda work is in #86.
- Any change to `enrollmentMeetsToday` predicate. Per #87's open questions, overrides are about *what time* a student is scheduled, not *whether* they're scheduled. Meeting-today logic stays untouched.
- Any change to conflict detection. Per #87's open questions, overrides are enrollment-level and conflict detection currently operates on activity-level scheduling. Worth keeping a watch on — but no change in scope here.
- Bulk/spreadsheet-style entry of overrides. Single-enrollment editing only.

---

## Database changes

### Migration

```sql
-- File: supabase/migrations/[next-timestamp]_add_enrollment_time_overrides.sql

ALTER TABLE enrollments
  ADD COLUMN start_time_override TIME,
  ADD COLUMN end_time_override TIME;

COMMENT ON COLUMN enrollments.start_time_override IS
  'Optional per-enrollment override of the activity''s default_start_time. When set, the teacher agenda displays this student as scheduled to arrive at this time. Informational — does not gate attendance.';

COMMENT ON COLUMN enrollments.end_time_override IS
  'Optional per-enrollment override of the activity''s default_end_time. Symmetric counterpart to start_time_override. Used less often but cheap to maintain.';
```

No data migration is required — both columns default to `NULL`, which means "follow the activity's default times" (the existing behavior for every current enrollment).

No constraint is needed beyond the `TIME` type itself. We're explicitly not enforcing that `start_time_override` falls within the activity's time range — the value's correctness is the admin's judgment call, not the database's. A student arriving genuinely *before* an activity starts is a valid (if unusual) case the schema shouldn't preclude.

No index is required. Override queries always happen in the context of "give me enrollments for activity X" or "give me enrollments for student Y" — both already covered by existing indexes.

### RLS

No new RLS policy is required. The existing `enrollments` policies cover the new columns:

- Students reading their own enrollment (`student_id = auth.uid()`) — they can see their own overrides.
- Teachers / monitors via `is_teacher_or_monitor_of(activity_id)` — they can see overrides for enrollments in activities they staff.
- Admins via `is_role('admin')` — full access for the enrollment editor.

Same applies to update. The admin enrollment editor mutates via `useUpdateEnrollment`, which goes through the admin path.

---

## UI changes

### `EnrollmentScheduleEditor` (in `ActivityDetail.jsx`)

The existing editor expansion appears beneath each enrolled student row when the admin clicks the pencil icon. It currently exposes: day pills, rotation control, recurrence interval, starting week. Add a new section for time overrides.

**New section: "Arrival / departure overrides"**

Place this section below the recurrence controls, above the Save/Cancel buttons. Use the same compact label-above-controls treatment as the rest of the editor.

```
Arrival / departure overrides
  Arrives:  [time input or empty]  Clear
  Leaves:   [time input or empty]  Clear
```

Behavior:
- Each row is an HTML `<input type="time">` with a small "Clear" button to its right.
- An empty value or a click on "Clear" sets the field back to `null` (follows activity default).
- If the activity has `default_start_time` / `default_end_time` set, show those as placeholder/ghost text in the input (e.g. `"(default: 10:45)"` in a `<span>` next to the input) so admins know what they're overriding.
- If the activity has *no* default times set, hide this section entirely. Overrides only make sense relative to a default.

State integration:
- Both fields participate in the existing `localSchedule` draft Map pattern (`onChange('start_time_override', value)` and `onChange('end_time_override', value)`).
- `onScheduleSave` already passes the whole draft into `useUpdateEnrollment.mutateAsync({ id: enrollment.id, ...draft })`. New fields flow through unchanged.
- The `effectiveEnrollment` merge pattern that drives the collapsed summary already handles `localSchedule` overlay — extends naturally.

Visual:
- Use the amber/warning palette accent to signal "this is informational, not a hard constraint." Could be as light as a colored left border on the section, or amber text on the labels. Treatment is implementer-judgment per the visual design system.

### Schedule summary text (`getEnrollmentScheduleSummary`)

The existing summary builds compact text like `"Every 2 wks · A days · M W F"` from non-null enrollment fields. Extend it to include override times when set.

New parts to append (after existing parts, in this order):
- If `start_time_override` is set: `"arr H:MM" `(e.g. `"arr 11:00 am"`)
- If `end_time_override` is set: `"leaves H:MM"` (e.g. `"leaves 1:30 pm"`)

Use the existing `formatTime` helper for consistency.

Examples:
- Just `start_time_override = "11:00:00"` → `"arr 11:00 am"`
- `days_of_week = [1,3,5]` + `start_time_override = "11:00:00"` → `"M W F · arr 11:00 am"`
- Activity defaults, no overrides → `null` (unchanged from today)

The return-null behavior when *every* override field is null stays the same. The new fields participate in the "is anything actually overridden" check.

### Editor expansion gate

The current expansion logic gates the pencil icon on:

```js
const canEdit = zone === 'enrolled' && !student.isNewlyStaged && !isPendingUnenroll
  && enrollment && activity?.days_of_week?.length > 0
```

**Change:** drop the `activity?.days_of_week?.length > 0` requirement. Time overrides are valid even when the activity doesn't use `days_of_week` scheduling (e.g. activities using rotation, or activities with no day-level scheduling at all). The expansion should be available whenever there's an enrolled student in a saved activity.

The day-pills sub-section already correctly hides when `activityDays.length === 0`. The rotation sub-section already conditionally renders. The recurrence sub-section is always shown. The new override sub-section follows the same conditional pattern (hide when the activity has no default times). So dropping the outer gate doesn't expose an empty editor — the inner conditionals already handle each row's availability.

### `EnrollmentStudentRow`

No change beyond what the summary text and editor expansion already provide. The collapsed row will naturally surface the new summary text via the existing `scheduleSummary` slot.

---

## API changes

Surface area: `useUpdateEnrollment` and the underlying `updateEnrollment` API function.

Verify (likely already true): the update mutation passes through arbitrary fields on the payload. If it does, no change. If it whitelists fields, add `start_time_override` and `end_time_override` to the whitelist.

Same check for any select queries that read enrollments: are they using `select('*')` (column will flow through) or an explicit column list (must be updated)? A grep should answer it quickly. The places to check:

- `src/api/enrollments.js` (all functions)
- `src/api/agenda.js` (`getStudentActivitiesForDate` and `getRosterForActivities` are the likely consumers)
- Any other file in `src/api/` that touches enrollments

If any of those uses an explicit column list, add the two new columns. If they all use `select('*')`, nothing to do.

---

## Acceptance criteria

- [ ] Migration adds `start_time_override TIME` and `end_time_override TIME` to `enrollments`, both nullable, no constraints beyond type
- [ ] Both columns have `COMMENT`s documenting their purpose
- [ ] No RLS changes required (existing policies cover the columns)
- [ ] `EnrollmentScheduleEditor` exposes a new "Arrival / departure overrides" section with time inputs and Clear buttons, conditional on the activity having default times
- [ ] Section is hidden when the activity has no `default_start_time` / `default_end_time`
- [ ] `canEdit` gate no longer requires `days_of_week.length > 0`
- [ ] `getEnrollmentScheduleSummary` includes `"arr H:MM"` and `"leaves H:MM"` parts when corresponding overrides are set
- [ ] `useUpdateEnrollment` payload includes the new fields and persists them correctly
- [ ] Setting an override and clicking Save persists the value; the collapsed row reflects it on next render
- [ ] Clearing an override (via the Clear button) sets the field back to `null`; the collapsed row drops it from the summary
- [ ] All other enrollment editor functionality (days, rotation, recurrence, starting week) continues to work without regression
- [ ] No teacher agenda changes (the new columns are dormant from the teacher's perspective until #86)

---

## Test scenarios for the implementer

1. **Set an override on an enrollment** in an activity with default times. Save. Collapsed row shows `"arr H:MM"` summary. Re-open editor — the input is populated with the saved value.
2. **Clear an override** that was previously set. Save. Collapsed row no longer shows the override in its summary. Re-open editor — input is empty.
3. **Set both start and end overrides.** Summary shows both parts.
4. **Open the editor on an enrollment in an activity that doesn't use `days_of_week`** (e.g. uses rotation). Confirm the editor opens (the dropped gate works), the day pills section is hidden, and the override section is available (assuming the activity has default times).
5. **Open the editor on an enrollment in an activity with no default times set.** The override section is hidden. (The activity probably also has no rotation or days, so the editor may be mostly empty — that's fine.)
6. **Combine an override with a day narrowing** (e.g. M/W/F + arr 11:00). Summary shows both.
7. **Existing enrollments with no overrides** continue to behave identically — no summary noise, no extra UI clutter.

---

## What this is *not*

Two things to keep clear so they don't accidentally creep in:

1. **This does not affect the teacher view.** A teacher loading their agenda after this ships will see no visual difference, even on activities where overrides have been set. The teacher-facing display (#86) is what turns this data into user value.

2. **This does not change attendance logic.** Overrides are scheduling metadata, not attendance gates. A teacher can still mark an override-having student `present`, `absent`, `excused`, or `tardy` at any time, regardless of whether the current clock time is before or after the override. The override's role in attendance is *informational* — it tells the teacher when to expect the student — not regulatory.
