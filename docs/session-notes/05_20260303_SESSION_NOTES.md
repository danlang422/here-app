# Session 5 - March 3, 2026

### Enrollment Validation Utilities
- **`src/lib/enrollmentValidation.js`**: Pure-function module with no API or UI dependencies. Two modes of conflict detection:
  - **Block-based** (`wouldConflictByBlock`): Enrollment gatekeeper. Checks block + days_of_week + rotation_day_type overlap. Hard gate — if this says conflict, enrollment is rejected.
  - **Time-based** (`wouldConflictByTime`): Scheduling visibility. Checks actual time range overlap on shared days. Returns overlap/gap in minutes. Informational only — never blocks enrollment.
- **`validateEnrollment(newActivity, existingEnrollments)`**: Public function for the enrollment flow. Checks a new activity against all of a student's existing enrollments. Collects all conflicts (doesn't short-circuit) so UI can show full details.
- **`findAvailableBlocks(studentEnrollments, orgSettings)`**: Returns per-block availability for a student — which blocks are open, which have activities.
- **`findTimeConflicts(activity, otherActivities)`**: Returns all time-based overlaps between an activity and a list of others, with overlap minutes.
- Shared helper `couldMeetOnSameDay` encapsulates the four-case day/rotation logic used by both conflict checkers.
- All functions take objects, not IDs — callers load data and pass it in. Keeps the module pure and testable.

### Design Decisions (Session 5 — enrollment and scheduling direction)
- Enrollment is a workflow, not a page. The UI will be composable pieces (StudentSelector, ActivitySelector) that can be initiated from multiple places — activity management now, schedule overview later.
- Two-panel enrollment flow: select students → pick activity target → validate → enroll. Activity target can be pre-filled (from activity table) or open (from schedule view). Shell activities can be created on the fly (progressive setup).
- Block-based and time-based conflict detection are separate because activity times don't always match block boundaries (e.g. Kennedy Band is "Block 0" but runs 8:00–8:45 while Block 0 is 7:30–9:00). Block assignment is organizational (admin judgment), not validated against time boundaries.
- Time-based conflicts return overlap/gap in minutes — the admin needs to know *how much* overlap, not just yes/no.
- Group-level scheduling utilities (findAvailableBlocksForGroup, etc.) deferred until the schedule view needs them. Core comparison logic is identical; only the loop and result shape changes.
- Auto-scheduling explicitly deferred. The tool's job is to make constraints *visible* so the admin can solve the puzzle with context the system doesn't have (room availability, teacher preferences, etc.).
- Incomplete scheduling data (no days_of_week or rotation_day_type on either activity) defaults to "assume conflict" as a conservative safety measure. May revisit if this creates friction with progressive setup workflow.