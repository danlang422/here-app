# Here App — Database Schema Documentation

**Database**: PostgreSQL (via Supabase)
**Last updated**: July 2026 (docs-freshness pass — see individual file headers for what changed; verified against live DB state, not just migration files)
**Status**: Implemented and deployed.

---

## What Changed from V1

The biggest structural change is the collapse of `sessions` and `student_activities` into a single unified `activities` table. Everything is an activity — regular classes, college courses, external HS courses, online courses, freeform blocks, internships. The `session_type` enum, the separate `activity_types` catalog table, and the `enrollment_overrides` table are all gone.

Other key changes include:
- `activity_instances` table added — represents a specific occurrence of an activity on a specific date
- `attendance_records`, `check_ins`, `presence_waves`, `posts`, and `status_updates` all reference `activity_instance_id` instead of carrying `activity_id + date` themselves
- `checkin_activity_tags` junction table added for freeform block tagging
- `posts`, `post_responses`, and `comments` tables added — replaces the old `interactions` table
- `conflict_priority` integer removed — scheduling conflicts prevented at enrollment time by application-layer validation that checks for actual day/time overlaps before allowing enrollment
- `teacher_id`, `monitor_id`, `instructor_name`, `mentor_name` as separate nullable fields on activities
- `days_of_week` stored as `INTEGER[]` using `EXTRACT(DOW)` values (0=Sun through 6=Sat), not text abbreviations — eliminates locale dependency
- `comments` and `notifications` tables use nullable FK columns instead of polymorphic `parent_type`/`parent_id` — gives us real foreign keys and cascading deletes
- `term_id` on activities links to `academic_terms` for easy term-based queries
- **Dynamic Block Count**: The `block` number constraints were loosened (`>= 0`), and a `block_count` setting was added to `organizations.settings` to make the upper bound organization-defined rather than hardcoded.
- **Removal of Activity Type**: The `activities.type` column, originally a UI hint, was removed entirely. Activities are now defined purely by their scheduling fields and boolean behavior flags.
- **Comprehensive RLS**: All starter RLS policies were replaced with a comprehensive set using `SECURITY DEFINER` functions to prevent recursion and correctly scope data for all user roles.

---

## Design Principles

1. **Everything is an activity**: No separate sessions concept. Teacher-owned classes, monitoring blocks, college courses, internships — all live in one table. Behavioral differences are driven by boolean flags, not type-based branching.
2. **No Type System**: An activity's nature is defined by its data (scheduling fields, location, etc.) and its behavior flags (`requires_attendance`, `is_release`, etc.). The original `type` column was removed.
3. **Scheduling state is derived, not stored**: There is no explicit "scheduled" flag. An activity that has days/times set and neither `is_not_scheduled` nor `is_release` checked is implicitly scheduled. The admin's "needs scheduling" list is built by querying for activities where `is_not_scheduled = false AND is_release = false AND (days_of_week IS NULL OR default_start_time IS NULL)`.
4. **Enrollments for everything**: All student-activity relationships go through the `enrollments` table, including single-student activities like internships. Querying is always consistent.
5. **Lazy instance creation**: `activity_instances` records are created on first interaction (first view, first attendance mark, first post). Nothing needs to be pre-generated.
6. **Soft deletes**: Use `is_active` flags to preserve history.
7. **Audit trails**: Timestamp everything, link related records.

---

## Schema Sections

| # | File | Tables |
|---|------|--------|
| 01 | [Core Tables](01-core-tables.md) | `organizations`, `user_profiles` |
| 02 | [Academic Calendar](02-academic-calendar.md) | `academic_terms`, `schedule_templates`, `school_days` |
| 03 | [Activities](03-activities.md) | `internship_opportunities`, `activities`, `enrollments` |
| 04 | [Activity Instances](04-instances.md) | `activity_instances` |
| 05 | [Attendance & Check-ins](05-attendance.md) | `attendance_records`, `check_ins`, `checkin_activity_tags`, `presence_waves` |
| 06 | [Social Layer](06-social.md) | `posts`, `post_responses`, `comments`, `status_updates` |
| 07 | [Notifications](07-notifications.md) | `notifications` |
| 08 | [Audit Log](08-audit-log.md) | `audit_log` |
| 09 | [Key Queries](09-queries.md) | Reference queries for common operations |
| 10 | [Row Level Security](10-rls-policies.md) | RLS policies |
| 11 | [Performance Indexes](11-indexes.md) | Cross-table performance indexes |
| 12 | [Migration Strategy](12-migration-strategy.md) | Migration phases, seed data, future considerations |
