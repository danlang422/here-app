# Session Notes — February 16, 2026

**Purpose:** Bridge document capturing context, decisions, and open items from the initial documentation review and CSV analysis session. This is intended to bring a new conversation up to speed without access to the original chat history.

**What happened this session:** Reviewed all four planning docs (DATABASE_SCHEMA.md, USER_FLOWS.md, BUSINESS_LOGIC.md, SYSTEM_ARCHITECTURE.md) against the real City View master schedule CSV, identified 22 issues, applied quick fixes, and resolved the most critical schema question (how to handle schedule conflicts for shared students). The remaining issues are documented below for continued work.

---

## Changes Already Committed

**Quick fixes applied to docs:**
- React 19 + Vite 7 (was 18/5), port 5173 (was 3000)
- TanStack Query v5 API conventions (useQuery object syntax, etc.)
- ESLint flat config format for v9+
- Added `edited_at` field documentation for status_updates
- README cleanup (removed placeholder sections)

**Major schema change — conflict resolution model:**
- **Removed** the `enrollment_overrides` table entirely
- **Added** `rotation_day_type TEXT` (nullable, 'A'/'B'/null) to `student_activities`
- **Enhanced** `conflict_priority INTEGER` documentation on `student_activities` with suggested scale (external=10, core class=5, monitoring=0)
- Updated enrollments documentation from "three-layer system" to "two-layer system"
- Added conflict resolution example queries to DATABASE_SCHEMA.md
- Added performance index for conflict lookups

---

## Key Context: How City View's Scheduling Actually Works

This is critical for understanding the data model. The CSV analysis revealed important nuances that differ from what the docs originally assumed.

### City View does NOT use A/B rotation

City View itself treats every school day the same — there's no A day or B day from their perspective. However, the other high schools in the district (Kennedy, Washington, Jefferson) DO use an A/B rotation based on the **district calendar**. This matters because City View shares some students with those schools.

The A/B rotation is NOT "every other weekday." It's **every other scheduled school day** according to the district calendar. If Monday is an A day and Tuesday is cancelled (snow day), then Wednesday becomes the next B day — the rotation advances only on days school is in session. In the previous version of the app, A/B days were manually picked on a calendar. For this version, we plan to calculate them from the school calendar and its exceptions, but manual override should remain possible.

### Why A/B matters for the app

About 10-15 students are enrolled in classes at their home high school (Kennedy, Washington, or Jefferson) on specific rotation days. For example, a student might attend Band at Kennedy on A days and Advisory at City View on B days. From City View's perspective, the only thing they need to know is "is this student here today or at their other school?"

The app handles this through the priority/conflict model: the student is enrolled in Advisory (M-F), AND has a Band student_activity with `rotation_day_type = 'A'` and `conflict_priority = 10`. On A days, Band wins and the student is hidden from the Advisory roster. On B days, Band doesn't apply, so the student appears normally.

### Kirkwood Community College is different from A/B

Some students take courses at Kirkwood Community College. In the CSV, these sometimes appear in the A/B columns, but Kirkwood operates on its own calendar (MWF, TuTh, etc.) — it does NOT follow the district's A/B rotation. These should be modeled using `days_of_week` on the student_activity (e.g., `['Mon', 'Wed', 'Fri']`), NOT `rotation_day_type`. The spreadsheet's data entry may conflate these, but the app should distinguish them.

### The teacher's mental model matters for data entry

Teachers think of it as: "Allison is in my Advisory. She's here every day except when she has Band at Kennedy." They do NOT think of it as two separate schedule entries. The app should support entering it this way — enroll the student in the M-F session, then add the external activity as a separate student_activity with higher priority. The conflict resolution happens at query time, not at data entry time.

---

## Scheduling Patterns Found in the CSV (Summary)

The CSV contains 121 rows (students + 4 teachers) × 179 columns representing a full semester schedule across 6 blocks (0-5), 5 weekdays, and A/B rotation variants.

### Pattern 1: Same activity every day (most common)
Most students in most blocks have the same course/location on both A and B days. Advisory in Block 0 is nearly universal. These need no special handling — a single enrollment or student_activity with `rotation_day_type = null`.

### Pattern 2: Different City View course on A vs B day
Some blocks show different City View courses depending on A/B day (e.g., Biology on A days, Kirkwood Business on B days). **Correction from discussion:** When one of the courses is at Kirkwood, this is likely a weekday-based alternation (MWF/TuTh), not a district A/B rotation. Model with `days_of_week`, not `rotation_day_type`.

### Pattern 3: External school class on specific rotation days
Students attending classes at Kennedy, Washington, or Jefferson on A or B days. This IS tied to the district A/B calendar. Model with `rotation_day_type = 'A'` or `'B'` and high `conflict_priority`. The student remains enrolled in their City View session (Advisory, etc.) and the conflict resolution hides them on the appropriate days.

### Pattern 4: Off-campus programs (Iowa BIG, Kirkwood campus, internships)
- **Iowa BIG:** Students at "Economic Alliance 2nd Floor" for multiple blocks, sometimes all day
- **Kirkwood campus:** Students at KW Main Campus or specific rooms for multi-block spans
- **Internships:** Wide variety of locations (library, elementary school, assisted living, city offices, etc.) with specific day/time patterns like "M-F Afternoons," "B Days Afternoons," "M/W 7:30-10:40"

These are all `session_id = null` student_activities with custom locations.

### Pattern 5: Day-of-week variation within same rotation
Some activities are specific to certain weekdays regardless of A/B rotation (e.g., internship only on M/W, robotics only on M/W). Handled by `days_of_week` array on student_activity.

### Pattern 6: "Other Class Location" flag in CSV
The CSV has a TRUE/FALSE column for each block indicating "this student is at another school's class for this slot." This corresponds to our `conflict_priority` model — TRUE means a higher-priority external activity exists. Not a separate feature to build, just confirmation the priority model is correct.

### Teacher schedules in the CSV
The last 4 rows contain teacher schedules (Kali, Terry, Liz, Trevor) with their classes, hub monitor slots, and prep periods. Useful for seeding session data during implementation.

---

## Remaining Issues to Resolve

### Cluster 2: Interactions & Notifications (Items 5, 7, 18)

**Item 5 — Interaction table polymorphism:**
The `interactions` table currently has 4 nullable FK columns (related_status_update_id, related_checkin_id, related_attendance_id, related_presence_wave_id). This works but is a known code smell. Options: keep as-is for MVP simplicity, or refactor to a polymorphic pattern (e.g., `related_type` + `related_id`). Low urgency — won't block implementation.

**Item 7 — Notification delivery strategy:**
Schema stores notifications with `is_read` flag, but no strategy defined for: real-time push (Supabase realtime subscriptions?), batching/digest, or notification preferences. Need to decide MVP scope — probably just in-app notifications via Supabase realtime, no email/SMS.

**Item 18 — Notification trigger logic:**
When do notifications fire? Database triggers vs application logic? What events are MVP? Suggested MVP triggers: teacher comments on student work, schedule changes affecting student, missed check-out reminders. Deferred: attendance marked notifications, streak milestones.

### Cluster 3: Time/Date/Timezone (Items 13, 17)

**Item 13 — Timezone handling:**
Everything is `TIMESTAMPTZ` in the schema, organization has `timezone: "America/Chicago"` in settings. Need to decide: does the frontend convert all times to local on display? Do we store local times for block schedules (TIME columns) and UTC for event timestamps (TIMESTAMPTZ)? Current schema mixes these — `default_start_time` on sessions is plain TIME, while `checked_in_at` on check_ins is TIMESTAMPTZ. This is probably correct but should be explicitly documented.

**Item 17 — Lunch and non-block time:**
"Open Lunch 11:30-12:15" appears in the CSV between Block 3 and Block 4. It's not a numbered block. Questions: Does the app need to display it? Is it just a gap in the schedule? Can students have activities during lunch? For MVP, probably just show it as a gap in the schedule view.

### Other Open Questions

**Tuesday anomaly in CSV:**
There's a column "Block 0 Tuesday B Day Different then A Day Only" suggesting Tuesday can sometimes differ from the standard A/B pattern. This may just be a data entry artifact or it may indicate that Tuesday has special rotation rules. Needs clarification from City View staff (Daniel can confirm). If it's real, the school_days table already supports per-day rotation overrides.

**Ad-hoc daily overrides (deferred to later version):**
We discussed and agreed to skip building a "student chooses to stay at City View today instead of going to Band" feature for v1. The two scenarios (external class cancelled, student communicates with other school) are rare enough to handle as manual attendance exceptions — teacher just marks the student present if they show up unexpectedly.

**Group-level operations:**
The CSV showed each student's external schedule is unique enough that group overrides wouldn't save much work. However, bulk enrollment operations (add 15 students to Advisory at once) are still valuable for data entry. This is a UI concern, not a schema concern.

---

## Docs That May Need Updates After Remaining Issues

Once the remaining clusters are resolved, these docs may need corresponding updates:

- **BUSINESS_LOGIC.md** — Section 5 (Schedule Conflict Resolution) references the old enrollment_overrides model and needs updating to match the new priority-based approach. Section 7 (Notification Triggers) depends on Cluster 2 decisions.
- **USER_FLOWS.md** — The schedule conflict UI flows reference enrollment_overrides. Admin flow for "managing conflicts" needs revision.
- **SYSTEM_ARCHITECTURE.md** — May need timezone handling strategy documented once Item 13 is resolved.

---

## Session 2 Changes (February 16, 2026 — continued)

### Conflict resolution docs updated
- BUSINESS_LOGIC.md Section 5 rewritten for priority-based model (was done in prior commit)
- BUSINESS_LOGIC.md Section 6 attendance rules updated to use time overlap
- USER_FLOWS.md student and admin conflict flows rewritten
- All `enrollment_overrides` references removed across all docs

### Schema changes — time-based conflict resolution
- **student_activities.block**: Changed from `INTEGER NOT NULL` to `INTEGER` (nullable). Block is now a UI label/convenience only, not used for conflict resolution.
- **student_activities.default_start_time / default_end_time**: New `TIME` columns (nullable). For non-session activities, these are the fixed times. For session-linked activities, these can be null (times come from the session's schedule template for that day).
- **Conflict resolution** now uses time overlap (`startA < endB AND startB < endA`) instead of block matching. This correctly handles multi-block spans, lunch, and schedule template shifts.
- Updated example queries in DATABASE_SCHEMA.md to use time overlap.

### Interactions table — polymorphic refactor
- Replaced 4 nullable FK columns (`related_status_update_id`, `related_checkin_id`, `related_attendance_id`, `related_presence_wave_id`) with `related_type TEXT NOT NULL` + `related_id UUID NOT NULL`.
- CHECK constraint validates `related_type IN ('status_update', 'checkin', 'attendance', 'presence_wave')`.
- Adding new commentable entities (work submissions, direct messages) only requires updating the CHECK constraint.
- Tradeoff: no database-level FK enforcement on `related_id`. Application layer ensures referential integrity.

### Notification strategy decided
- MVP: In-app notifications only via Supabase Realtime. No email/SMS/push. (Email used only for Supabase Auth: password reset, verification.)
- Triggers implemented in application logic (JavaScript), not database triggers.
- MVP trigger: Teacher comments on student work only.
- Deferred: Schedule change notifications, missed check-out reminders, attendance marked, streak milestones.
- Added Notification Strategy section to SYSTEM_ARCHITECTURE.md.

### Timezone strategy documented
- Added Timezone & Date Handling Strategy section to SYSTEM_ARCHITECTURE.md.
- `TIME` columns for wall-clock times (block schedules), `TIMESTAMPTZ` for event timestamps.
- Org timezone used only for determining current local date.
- Frontend displays TIMESTAMPTZ in user's browser timezone (not hardcoded to org timezone).

### Lunch handling decided
- Lunch is a student_activity with `session_id = null`, no engagement flags, no block assignment.
- Uses `default_start_time`/`default_end_time` for its time range (11:30-12:15).
- Shows on student schedule; doesn't appear for teachers (no session).
- No schema changes needed — the nullable block and time fields support this naturally.

### Tuesday anomaly dismissed
- The oddly-labeled Tuesday column in the CSV is a data entry artifact, not a special rotation rule.

---

## Next Steps

1. Create GitHub repo and push current state
2. Create Supabase project
3. Begin implementation
