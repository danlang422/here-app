## Session 2 — February 24, 2026

**Focus:** Major data model restructuring. Collapsed sessions/student_activities into unified activities table. Designed activity instances, posts/comments architecture, and freeform tagging. Walked through initial data entry user flow for college courses.

**Output:** DATABASE_SCHEMA_V2.md (full rewrite — replaces DATABASE_SCHEMA.md once confirmed)

### Core architectural decisions

**Unified activities table**
Eliminated the distinction between `sessions` (teacher-owned containers) and `student_activities` (what students do). Everything is an `activity`. Regular classes, college courses, external HS courses, online courses, freeform blocks, internships, and free release all live in one table. The `type` field is a UI hint for form rendering only — it does not gate behavior. All behavior is driven by boolean flags.

**Boolean flags replace conflict_priority integer**
Removed `conflict_priority INTEGER` in favor of two explicit booleans:
- `off_campus BOOLEAN` — drives student agenda view. If a student has an off-campus activity overlapping an on-campus one, the off-campus activity is shown and the on-campus one is hidden.
- `requires_attendance BOOLEAN` — drives teacher roster view. If true, the student appears on the City View teacher's roster regardless of where they physically are. External HS courses set this to false — the other school handles attendance in the shared SIS; City View just needs to know the student is legitimately absent.

Conflict resolution defaults by type:
| Type | off_campus | requires_attendance |
|------|-----------|--------------------|
| regular_class | false | true |
| college_course | false | true |
| external_hs_course | true | false |
| online_course | false | true |
| freeform | false | false |
| internship | true | true |
| free_release | true | false |

**Personnel fields on activities**
Four separate nullable fields replace the single `teacher_id`:
- `teacher_id` — City View staff who owns the activity and takes attendance
- `monitor_id` — City View staff supervising without ownership (monitoring sessions, freeform blocks)
- `instructor_name` — free text for external instructors (Kirkwood profs, cooperating teachers)
- `mentor_name` — free text for internship mentors

All four are nullable. Activities can be created without a monitor assigned — this is expected during initial schedule entry before assignments are finalized.

**External HS course scheduling rule**
External HS courses use `rotation_day_type` ('A' or 'B') ONLY — `days_of_week` is null. These courses follow the district rotation calendar, not a weekday pattern. The days are determined entirely by which dates are A vs B in the `school_days` table. Setting `days_of_week` for these would be wrong — the course might meet on different weekdays week to week depending on how the rotation falls.

**Enrollments for everything**
All student-activity associations go through the `enrollments` table without exception — including single-student activities like individual internships. Keeps all "who is in what" queries consistent.

**Activity instances (lazy creation)**
New `activity_instances` table represents a specific occurrence of an activity on a specific date. Created lazily on first interaction — when a teacher opens their roster, a student views their schedule, or any record (attendance, post, check-in) references that activity on that date. All downstream records reference `activity_instance_id` instead of carrying `activity_id + date` themselves. This includes: attendance_records, check_ins, presence_waves, posts, status_updates.

**Posts, post responses, and comments**
Replaces the old `interactions` table. Structure:
- `posts` — teacher posts to a specific activity instance. Has an optional `icon` (emoji) and a `requires_response` boolean.
- `post_responses` — one per student per post when `requires_response = true`.
- `comments` — polymorphic via `parent_type + parent_id`. Can attach to posts, post responses, or status updates. Threaded via `thread_parent_id`.

Posts are instance-specific (one activity, one date). No multi-day range or pinning in MVP. The feed surfaces posts chronologically across all of a student's activities.

For monitoring sessions: when a teacher posts to a monitoring session instance, enrolled students see it in the context of their specific activity for that block (internship, online course, freeform, etc.).

**Freeform activity tagging**
New `checkin_activity_tags` junction table. When a student checks into a `freeform` activity, they tag one or more activities they worked on. Tagging options include today's scheduled activity instances plus any unscheduled activities (online courses, independent study — activities with no `days_of_week`). Each tag is a row in `checkin_activity_tags` linking the check-in to an activity.

**activity_types catalog table removed**
Type is now just a text field on activities. No need to maintain a separate catalog if it's not driving behavior.

**enrollment_overrides table removed**
Conflict resolution happens at query time via boolean flags. No stored override records needed.

**interactions table removed**
Replaced by posts/post_responses/comments. The feed is a query/presentation feature — no unified envelope table needed.

### Data entry user flow — initial findings

Walked through the first data entry scenario: entering college course and online course activities before the rest of the schedule is built.

**Entry order rationale:** College courses are entered first because they're the first immovable chunks — they must be worked around when building the rest of the schedule. Online courses are typically entered at the same time since they're low-friction (no schedule, no location).

**Key insight — multi-pass entry:** Admins don't fill out all fields in one pass. They create the activity skeleton (name, type, schedule, enrolled students) and fill in personnel assignments (monitor_id) in a later pass once the full schedule is known. The app must support incomplete records gracefully — no required fields that block save unless truly essential.

**Scale check:** ~35 distinct courses in the CSV including online. Online courses likely fewer unique records than the count suggests (same course, multiple students = one record with multiple enrollments). Scheduled Kirkwood courses probably 20-25 unique activities. Not an overwhelming data entry volume.

**UI patterns discussed for enrollment:**
- Search + grade-level filter in student picker (grade-specific courses make filter especially useful)
- Multi-select students
- Drag-and-drop enrollment — persistent "floating roster" sidebar: select one or more students, drag onto an activity card or click activity to enroll. Inspired by Trello/Notion patterns. Not more complex to build than it sounds.
- Detached enrollment modal that persists while navigating between activity records — avoids losing selection when moving between records
- "Save and Add Another" clears form for next entry without requiring re-open after save
- "Duplicate" feature (separate from Save and Add Another) for cases where multiple similar activities share most fields
- Retained fields on Save and Add Another: decision not to retain fields by default since field overlap between sequential entries is low in practice. Duplicate feature covers the use case where someone wants to copy an existing record.

**Schedule-building features (deferred from MVP):** The longer-term vision is a visual schedule builder — see a student's open blocks and place activities into gaps. Data model supports this without changes; it's a UI-only question. Not in MVP given time constraints but important to keep in mind so the model doesn't accidentally make it hard to build later.

### Removed concepts
- `activity_types` catalog table
- `enrollment_overrides` table
- `interactions` table (universal polymorphic container)
- `conflict_priority` integer

### What's still needed
- Walk through remaining data entry user flows (external HS courses, internships, regular City View classes, freeform blocks)
- Walk through teacher and student daily use flows
- Update BUSINESS_LOGIC.md to reflect new conflict resolution model and activity instances
- Update USER_FLOWS.md for new model
- Consider whether STATUS.md needs updating before implementation begins