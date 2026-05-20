# Allow Enrollment Despite Conflicts — Build Spec

**Date:** April 6, 2026
**Scope:** Change the enrollment flow so that conflicting enrollments are allowed after an explicit warning, rather than silently skipped. Conflicts are surfaced post-enrollment via the existing inline conflict indicators, giving the admin time to adjust enrollment-level scheduling to resolve them.
**Files affected:** `src/components/activities/ActivityDetail.jsx` (InlineEnrollmentSection and InlineEnrollmentFooter)

---

## Problem

The current enrollment flow partitions staged students into `clean` and `conflicted` buckets. On confirm, only `clean` students are enrolled; `conflicted` students are silently skipped and reported in the done summary as "X skipped (conflicts)."

With enrollment-level scheduling, this creates an ordering dependency: to enroll a student in two same-block activities with complementary day patterns (e.g., Advisory M–F narrowed to Tu/Th/Fr, plus Internship M/W), the admin must enroll in the "broader" activity first, narrow the enrollment days, and *then* enroll in the narrower one. If done in the wrong order, the second enrollment is blocked because the system sees a conflict against the full activity schedule — even though the admin's intent is to immediately narrow it.

This ordering constraint is unintuitive and error-prone, especially during bulk data entry.

## Solution

Allow all enrollments to proceed, including conflicted ones, after an explicit warning. The conflict warnings already exist in the enrolled student list (yellow text showing "Conflicts with X — Block Y") and will persist until the admin adjusts enrollment-level scheduling to eliminate the overlap. This converts conflict detection from a hard gate to an advisory system.

---

## Changes

### 1. `handleConfirm` — enroll all staged students, not just clean ones

**Current behavior:** Only `clean` students are included in the enrollment mutation. `conflicted` students are counted as "skipped."

**New behavior:** All staged students (clean + conflicted) are enrolled. The `submitResult` no longer has a `skipped` count.

**Current code (lines ~1075–1103):**
```js
async function handleConfirm() {
  const { clean, conflicted, unenrollIds } = submitSummary
  try {
    const promises = []
    if (clean.length > 0) {
      promises.push(enrollMutation.mutateAsync(
        clean.map((studentId) => ({
          student_id: studentId,
          activity_id: activityId,
          block: activity?.block ?? null,
        }))
      ))
    }
    if (unenrollIds.length > 0) {
      promises.push(unenrollMutation.mutateAsync(unenrollIds))
    }
    await Promise.all(promises)
    setSubmitResult({
      enrolled: clean.length,
      skipped: conflicted.length,
      unenrolled: unenrollIds.length,
      skippedStudents: conflicted,
    })
    // ...
  }
}
```

**New code:**
```js
async function handleConfirm() {
  const { clean, conflicted, unenrollIds } = submitSummary
  const allToEnroll = [...clean, ...conflicted.map((c) => c.studentId)]
  try {
    const promises = []
    if (allToEnroll.length > 0) {
      promises.push(enrollMutation.mutateAsync(
        allToEnroll.map((studentId) => ({
          student_id: studentId,
          activity_id: activityId,
          block: activity?.block ?? null,
        }))
      ))
    }
    if (unenrollIds.length > 0) {
      promises.push(unenrollMutation.mutateAsync(unenrollIds))
    }
    await Promise.all(promises)
    setSubmitResult({
      enrolled: allToEnroll.length,
      enrolledWithConflicts: conflicted.length,
      unenrolled: unenrollIds.length,
    })
    setStagedStudentIds(new Set())
    setUnstagedEnrollmentIds(new Set())
    setSubmitPhase('done')
  } catch {
    // Error surfaced via mutation.error
  }
}
```

### 2. `InlineEnrollmentFooter` — update confirm and done phases

The confirm phase currently says "X students will be skipped (conflicts)." It should instead warn that conflicts exist and will need to be resolved after enrollment.

The done phase currently reports "X skipped (conflicts)." It should report "X enrolled with conflicts" and prompt the admin to adjust their schedules.

#### Confirm phase changes

Replace the conflicted message:

**Current:**
```jsx
{submitSummary.conflicted.length > 0 && (
  <div className="text-warning">
    {submitSummary.conflicted.length} student{submitSummary.conflicted.length !== 1 ? 's' : ''} will be skipped (conflicts)
  </div>
)}
```

**New:**
```jsx
{submitSummary.conflicted.length > 0 && (
  <div className="text-warning">
    {submitSummary.conflicted.length} student{submitSummary.conflicted.length !== 1 ? 's' : ''} with scheduling conflicts — adjust days after enrolling
  </div>
)}
```

#### Done phase changes

Replace the skipped line:

**Current:**
```jsx
{submitResult.skipped > 0 && (
  <div className="text-warning">{submitResult.skipped} skipped (conflicts)</div>
)}
```

**New:**
```jsx
{submitResult.enrolledWithConflicts > 0 && (
  <div className="text-warning">
    {submitResult.enrolledWithConflicts} enrolled with conflicts — adjust their days below
  </div>
)}
```

### 3. Available zone — remove the conflict-as-deterrent pattern

Currently, the available zone shows a small warning dot next to students with conflicts. This still makes sense as an informational indicator, so **keep the dot**. But the dot previously implied "this student can't be enrolled" — now it means "this student has a same-block enrollment that may need day adjustment." The dot's `title` attribute should be updated:

**Current (line ~1295):**
```jsx
<span className="w-2 h-2 rounded-full bg-warning shrink-0" title="Has scheduling conflict" />
```

**New:**
```jsx
<span className="w-2 h-2 rounded-full bg-warning shrink-0" title="Has same-block enrollment — may need day adjustment" />
```

### 4. No changes to `submitSummary` or `conflictMap`

The `submitSummary` still partitions into `clean` and `conflicted` — this distinction is used for messaging in the confirm phase. The `conflictMap` continues to detect conflicts accurately using enrollment-effective schedules (as fixed in the prior spec). Neither computation changes.

---

## What doesn't change

- **`validateEnrollment` and `enrollmentValidation.js`** — untouched. Conflict detection logic remains correct and is still used for the conflict indicators.
- **`conflictMap` computation** — still runs, still shows warnings on enrolled students. This is the primary mechanism for surfacing conflicts that need resolution.
- **Enrolled zone conflict display** — the yellow "Conflicts with X" text under enrolled student names stays exactly as-is. This is now the primary feedback loop: enroll the student, see the conflict, expand the schedule editor, adjust days, conflict disappears.
- **EnrollmentScheduleEditor** — no changes. The admin uses the existing day/rotation/recurrence controls to resolve conflicts after enrollment.
- **Block-based and time-based conflict detection** — both unchanged.

---

## UX Flow After This Change

1. Admin clicks a student in the available list to stage them.
2. The student appears in the enrolled list (staged). If they have a same-block enrollment, a warning dot appears in the available zone and conflict text appears in the enrolled zone.
3. Admin clicks "Enroll" → confirm phase shows "1 student to enroll" and "1 student with scheduling conflicts — adjust days after enrolling."
4. Admin clicks "Confirm" → student is enrolled. Done summary shows "1 enrolled with conflicts — adjust their days below."
5. Admin clicks "Make more changes" → the enrolled list shows the student with the yellow conflict text: "Conflicts with Internship — Block 0."
6. Admin clicks the pencil icon on the student's row, adjusts days to Tu/Th/Fr, saves.
7. Conflict text disappears (the `conflictMap` recomputes and the enrollment-effective schedules no longer overlap).

---

## Testing Notes

- **Happy path:** Stage a student with no conflicts → enroll → confirm shows no warning → done shows "X enrolled" with no conflict line.
- **Conflict path:** Stage a student who has a same-block enrollment → confirm shows the warning → confirm → student is enrolled → done shows conflict count → "Make more changes" → conflict visible on student row → adjust days → conflict clears.
- **Mixed batch:** Stage 3 clean + 2 conflicted students → confirm shows "5 students to enroll, 2 with scheduling conflicts" → all 5 enrolled → done summary reflects both counts.
- **Verify no regression:** The enrolled zone still shows conflict warnings for students whose effective schedules overlap. Adjusting days via the schedule editor still clears conflicts in real time (on save, `conflictMap` recomputes).
