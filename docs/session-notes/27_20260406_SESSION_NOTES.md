# Session 27 — April 6, 2026

## Enrollment Bug Fixes and UX Refinements

**Commits:** `73a5fc3` (fix enrollment scheduling), following `9c2a5f0` (enrollment-level scheduling merge)

---

### 27.1 Hard-delete unenrollments (`src/api/enrollments.js`)

#### What was built

Changed all unenroll operations from soft-delete (`is_active = false`) to hard-delete (`.delete()`):

- `unenrollStudent` — was `.update({ is_active: false })`, now `.delete().eq('id', enrollmentId).select().single()`
- `bulkUnenrollStudents` — same pattern using `.in('id', enrollmentIds)`
- `cleanOrphanedEnrollmentDays` zero-days branch — now deletes the row instead of deactivating it

#### Why

The `enrollments` table has a UNIQUE constraint on `(student_id, activity_id)`. Soft-deleted rows (`is_active = false`) left ghost rows in the table. Re-enrolling a student who had previously been unenrolled triggered a duplicate key violation because the ghost row still occupied the unique slot.

The `is_active` column remains in the schema — no migration needed, and existing `is_active = false` ghost rows are filtered out by all active-enrollment queries and are harmless. The column may still serve a purpose in future audit logging or soft-delete restoration flows if ever needed.

#### Key decision

Hard delete is the correct semantic here: an unenrollment is the removal of a relationship, not a state change on an existing record. The UNIQUE constraint enforces this at the database level.

---

### 27.2 Advisory conflict detection (`src/components/activities/ActivityDetail.jsx`)

#### What was built

Changed enrollment conflict detection from a hard gate to an advisory system in the `handleConfirm` enrollment flow:

- `handleConfirm` now enrolls **all** staged students — both clean and conflicted — instead of silently skipping conflicted ones
- Confirm phase warning changed from "X will be skipped" to "X with scheduling conflicts — adjust days after enrolling"
- Done phase changed from "X skipped (conflicts)" to "X enrolled with conflicts — adjust their days below"
- Available zone warning dot `title` attribute updated to reflect the advisory framing
- Existing enrolled-zone conflict indicators ("Conflicts with X — Block Y") remain the primary feedback loop for resolving conflicts post-enrollment via the enrollment-level scheduling editor

The build spec for this change is at `docs/user-flows/allow-enrollment-despite-conflicts-build-spec.md`.

#### Why

With enrollment-level scheduling in place, a "conflict" is no longer terminal — the student can be enrolled and then have their days narrowed to eliminate the overlap. The previous hard gate created an ordering dependency: you had to resolve conflicts before enrolling, but you could only configure enrollment-level days after enrolling. This made bulk data entry error-prone and forced manual workarounds.

The advisory model reflects the actual workflow: enroll first, tune scheduling second. The conflict indicators in the enrolled zone serve as the actionable prompt to do the tuning.

#### Key decision

Spec called for converting the gate to advisory. Implemented as specified — no deviations. The enrolled-zone conflict indicators were already in place from session 26 and serve as the resolution prompt without additional work.

---

### What's next

- **Data re-entry** — Clear existing activities/enrollments and re-enter using the consolidated model (~120–150 activities). Schema is stable; both unenroll and re-enroll paths are now reliable.
- **#61** — Help & knowledge pages
- **#62** — Activity entry UX improvements
- **#21** — Customizable agenda start/end times
