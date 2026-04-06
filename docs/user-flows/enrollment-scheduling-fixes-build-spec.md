# Enrollment Scheduling Fixes — Build Spec

**Date:** April 6, 2026
**Scope:** Two targeted fixes to the enrollment-level scheduling implementation: (1) a false-positive conflict display bug in the inline enrollment section, and (2) missing per-enrollment recurrence interval/anchor date controls.
**Files affected:** `src/components/activities/ActivityDetail.jsx` (both fixes), `src/lib/enrollmentValidation.js` (no changes — logic is correct, callers are wrong)

---

## Fix 1: Conflict map uses activity schedule instead of enrollment-effective schedule

### Problem

The `conflictMap` computation in `InlineEnrollmentSection` always passes `null` as the enrollment schedule when calling `validateEnrollment`:

```js
const result = validateEnrollment(activity, null, studentEnrollments)
```

`null` means "follow the activity's full schedule." For students who are already enrolled with per-enrollment day narrowing, this compares the activity's full M–F schedule against other enrollments — ignoring the fact that the student only attends on specific days.

**Concrete scenario:** A student is enrolled in Advisory (M–F, Block 0) with enrollment `days_of_week: [2, 4, 5]` (Tu/Th/Fr), and in Internship (Block 0) with `days_of_week: [1, 3]` (M/W). No actual conflict exists. But because `conflictMap` passes `null`, it compares Advisory's full M–F schedule against Internship's M/W — finds overlap on Monday and Wednesday — and shows a false conflict warning on the Advisory roster.

The asymmetry (Internship doesn't show a conflict with Advisory) occurs because the student's Advisory enrollment carries the narrowing, so when viewed from Internship's side, Advisory's effective schedule is correctly narrowed to Tu/Th/Fr by the enrollment data in `studentEnrollments`.

### Fix

In the `conflictMap` `useMemo` inside `InlineEnrollmentSection`, look up the student's existing enrollment in *this* activity and pass its scheduling fields instead of `null`:

**Current code:**
```js
const conflictMap = useMemo(() => {
  const map = new Map()
  if (!activity) return map
  for (const student of students) {
    const studentEnrollments = orgEnrollments.filter(
      (e) => e.student_id === student.id && e.activity_id !== activityId
    )
    const result = validateEnrollment(activity, null, studentEnrollments)
    if (result.conflicts.length > 0) {
      map.set(student.id, { hasConflict: true, conflicts: result.conflicts })
    }
  }
  return map
}, [activity, activityId, orgEnrollments, students])
```

**Updated code:**
```js
const conflictMap = useMemo(() => {
  const map = new Map()
  if (!activity) return map
  for (const student of students) {
    const studentEnrollments = orgEnrollments.filter(
      (e) => e.student_id === student.id && e.activity_id !== activityId
    )
    // Use this student's actual enrollment schedule for the current activity
    // (if they're already enrolled) so conflict detection sees the narrowed
    // effective schedule, not the activity's full schedule.
    const thisEnrollment = enrollmentByStudentId.get(student.id)
    const enrollmentSchedule = thisEnrollment
      ? {
          days_of_week: thisEnrollment.days_of_week,
          rotation_day_type: thisEnrollment.rotation_day_type,
          recurrence_interval: thisEnrollment.recurrence_interval,
          recurrence_anchor_date: thisEnrollment.recurrence_anchor_date,
        }
      : null
    const result = validateEnrollment(activity, enrollmentSchedule, studentEnrollments)
    if (result.conflicts.length > 0) {
      map.set(student.id, { hasConflict: true, conflicts: result.conflicts })
    }
  }
  return map
}, [activity, activityId, orgEnrollments, students, enrollmentByStudentId])
```

Note the dependency array gains `enrollmentByStudentId`. This map is already computed above in the component and is stable (memoized).

### Verification

After the fix, the Advisory roster should show no conflict for the student whose enrollment is narrowed to Tu/Th/Fr, because the effective schedule `[2, 4, 5]` has zero day overlap with the Internship's `[1, 3]`.

---

## Fix 2: Add per-enrollment recurrence interval and anchor date controls

### Problem

The `EnrollmentScheduleEditor` component currently gates recurrence visibility on `activityRecurrence > 1`:

```js
const showRecurrence = activityRecurrence > 1
```

When shown, it displays only a static text label ("Recurrence follows activity (X-week cycle)") with no editable controls. There is no way to set `recurrence_interval` or `recurrence_anchor_date` on an individual enrollment.

**Concrete scenario:** A student attends Advisory on Fridays only, but on alternating weeks (every other Friday). Advisory itself runs M–F weekly. There's no way to express "this student attends every 2 weeks starting week X" because the recurrence controls don't appear (activity interval is 1) and even if they did, they're not editable.

### Design

Add recurrence controls to `EnrollmentScheduleEditor` that follow the same pattern as the activity form:

1. **"Repeats every" dropdown** — Always visible alongside the day pills and rotation controls. Values: 1, 2, 3, 4 weeks. Default: follows activity (rendered as the activity's interval, or 1 if the activity has none). When the enrollment interval matches the activity's interval (or is null), the enrollment field stays null (follow activity).

2. **"Starting week" dropdown** — Only visible when the enrollment's recurrence interval > 1. Values: 1 through interval. This controls which week in the cycle the student attends.

3. **Layout** — Place the recurrence controls on their own row below the day pills and rotation controls. The "Repeats every [dropdown] week(s)" label and dropdown sit left, and "starting week [dropdown]" appears to the right only when interval > 1. This mirrors the activity form's layout but fits the tighter inline editor space.

4. **Anchor date computation** — Reuse the existing `computeAnchorDate(startDate, startingWeek, interval)` helper (already defined at the top of `ActivityDetail.jsx`). The `startDate` used should be the **activity's** `start_date`, since the enrollment's recurrence phase is relative to the activity's timeline.

5. **Null semantics** — When the enrollment's interval equals the activity's interval (or equals 1 and the activity's interval is also 1 or null), store null on the enrollment (follow activity). Only store a non-null `recurrence_interval` and `recurrence_anchor_date` when the enrollment diverges from the activity.

### Implementation

#### Changes to `EnrollmentScheduleEditor`

Replace the current recurrence section:

```js
{/* Recurrence anchor (only when activity uses recurrence) */}
{showRecurrence && (
  <div className="text-base-content/50 text-xs">
    Recurrence follows activity ({activityRecurrence}-week cycle)
  </div>
)}
```

With:

```jsx
{/* Recurrence controls */}
<div>
  <div className="text-base-content/50 mb-1">Repeats every</div>
  <div className="flex items-center gap-2 flex-wrap">
    <select
      className="select select-bordered select-xs w-16"
      value={effectiveRecurrenceInterval}
      onChange={(e) => {
        const val = parseInt(e.target.value, 10)
        // If matches activity default, store null (follow activity)
        const isDefault = val === activityRecurrence
        onChange('recurrence_interval', isDefault ? null : val)
        // Reset starting week when interval changes
        if (val <= 1 || isDefault) {
          onChange('recurrence_anchor_date', null)
        }
      }}
    >
      {[1, 2, 3, 4].map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
    <span className="text-base-content/50 text-xs">week(s)</span>

    {effectiveRecurrenceInterval > 1 && (
      <>
        <span className="text-base-content/50 text-xs ml-1">starting week</span>
        <select
          className="select select-bordered select-xs w-14"
          value={effectiveStartingWeek}
          onChange={(e) => {
            const week = parseInt(e.target.value, 10)
            const anchor = computeAnchorDate(activityStartDate, week, effectiveRecurrenceInterval)
            onChange('recurrence_anchor_date', anchor)
          }}
        >
          {Array.from({ length: effectiveRecurrenceInterval }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </>
    )}
  </div>
</div>
```

#### Derived values needed in `EnrollmentScheduleEditor`

Add these above the JSX return:

```js
// Effective recurrence for this enrollment
const effectiveRecurrenceInterval = (() => {
  if (localSchedule.recurrence_interval !== undefined) return localSchedule.recurrence_interval ?? activityRecurrence
  return enrollment.recurrence_interval ?? activityRecurrence
})()

// Activity start date (needed for anchor computation)
const activityStartDate = activity?.start_date ?? null

// Derive starting week from current anchor date
const effectiveAnchorDate = localSchedule.recurrence_anchor_date !== undefined
  ? localSchedule.recurrence_anchor_date
  : (enrollment.recurrence_anchor_date ?? null)
const effectiveStartingWeek = deriveStartingWeek(effectiveAnchorDate, activityStartDate)
```

#### Remove the `showRecurrence` gate

Delete this line:
```js
const showRecurrence = activityRecurrence > 1
```

The recurrence controls are now always shown (no gate needed). They render inline with a default of "1 week" (which means weekly / follow activity), and the starting-week dropdown only appears when interval > 1.

#### Import `computeAnchorDate` and `deriveStartingWeek`

These are currently defined as module-level functions in `ActivityDetail.jsx`. They're used by both the activity form and now the enrollment editor. Since `EnrollmentScheduleEditor` is defined in the same file, no import is needed — they're already in scope.

#### Wire `onScheduleSave` to handle recurrence fields

The existing `onScheduleSave` handler in `InlineEnrollmentSection` already spreads the full `localSchedule` draft into the mutation:

```js
const draft = localSchedules.get(enrollment.id) ?? {}
await updateEnrollmentMutation.mutateAsync({ id: enrollment.id, ...draft })
```

This will pick up `recurrence_interval` and `recurrence_anchor_date` from the draft with no additional changes, since the `updateEnrollment` API function passes all fields through to Supabase.

#### Schedule summary update

Update `getEnrollmentScheduleSummary` to display recurrence info with anchor context. The current implementation already handles `recurrence_interval > 1` in the summary — it shows "Every 2 wks" etc. No changes needed unless we want to add the starting week to the summary, which seems unnecessary for the collapsed view.

### Verification

After the fix:
- Open any activity's enrollment section. Each enrolled student's schedule editor should show "Repeats every [1] week(s)" by default.
- Changing to 2 should reveal the starting week dropdown.
- Saving with interval 2, starting week 1 should write `recurrence_interval: 2` and a computed `recurrence_anchor_date` to the enrollment.
- Saving with interval 1 (or matching the activity's interval) should write `null` for both recurrence fields (follow activity).
- The schedule summary on the collapsed row should show "Every 2 wks" when set.

For the every-other-Friday student:
1. Enroll in Advisory (M–F weekly).
2. Expand the student's enrollment, set days to Friday only.
3. Set recurrence to every 2 weeks, starting week 1.
4. Save.
5. Enroll in the MW college course, Tu/Th college course — no conflicts (different days).
6. Enroll in the Friday college course with days: Friday, recurrence: every 2 weeks, starting week 2.
7. No conflict should be detected (same block + same day, but alternating weeks with different phases).

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/activities/ActivityDetail.jsx` | Fix `conflictMap` to use enrollment-effective schedule; add recurrence controls to `EnrollmentScheduleEditor`; remove `showRecurrence` gate |

No schema changes. No new files. No changes to `enrollmentValidation.js` or `scheduleUtils.js` — the validation logic is correct, only the caller was passing the wrong input.

---

## Testing Notes

- **Conflict map fix:** Enroll a student in two same-block activities with complementary enrollment days (e.g., M/W and Tu/Th/Fr). Neither activity's enrollment section should show a conflict for that student. Before the fix, one side shows a false positive.
- **Recurrence controls:** Set up the every-other-Friday scenario described above. Verify that both enrollments save correctly, the schedule summary reflects the recurrence, and conflict detection correctly identifies the alternating-week phase difference as non-conflicting.
- **Null preservation:** Enroll a student without changing any recurrence settings. Verify the enrollment row has `recurrence_interval: null` and `recurrence_anchor_date: null` in the database.
- **Existing enrollments:** Verify that enrollments created before this change (all nulls) continue to display and function correctly — the recurrence dropdown should show "1" and no starting week.
