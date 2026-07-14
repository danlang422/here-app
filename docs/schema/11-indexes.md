# Performance Indexes

Cross-table indexes for common query patterns. Table-specific indexes are defined with their respective table definitions.

```sql
-- Student schedule lookup (scheduled activities for a day)
CREATE INDEX idx_activities_schedule_lookup
  ON activities(organization_id, is_active, block)
  WHERE is_active = true;

-- Not-scheduled activities (for freeform tagging)
CREATE INDEX idx_activities_not_scheduled
  ON activities(organization_id, is_active)
  WHERE is_active = true AND is_not_scheduled = true;

-- Needs-scheduling list
CREATE INDEX idx_activities_needs_scheduling
  ON activities(organization_id, is_active, is_not_scheduled, is_release)
  WHERE is_active = true AND is_not_scheduled = false AND is_release = false;

-- activity_staff lookups (see 03-activities.md for table definition)
CREATE INDEX idx_activity_staff_activity ON activity_staff(activity_id);
CREATE INDEX idx_activity_staff_user ON activity_staff(user_id);
CREATE INDEX idx_activity_staff_user_role ON activity_staff(user_id, role);

-- Teacher roster lookup
CREATE INDEX idx_enrollments_activity_active
  ON enrollments(activity_id, is_active)
  WHERE is_active = true;

-- Daily attendance lookup
-- REMOVED: idx_attendance_instance_lookup — redundant with UNIQUE(activity_instance_id, student_id)
-- constraint on attendance_records, which creates an implicit index.

-- Check-in status
-- REMOVED: idx_checkin_student_instance — redundant with UNIQUE(student_id, activity_instance_id)
-- constraint on check_ins, which creates an implicit index.

-- Feed query (recent posts for enrolled activities)
-- Note: idx_posts_instance_created is defined on the posts table in 06-social.md.
-- No duplicate needed here.

-- Rotation-based activities
CREATE INDEX idx_activities_rotation
  ON activities(organization_id, rotation_day_type)
  WHERE rotation_day_type IS NOT NULL;

-- Calendar-grouped activity lookup (admin calendar view)
CREATE INDEX idx_activities_calendar
  ON activities(calendar_id)
  WHERE calendar_id IS NOT NULL;
```

Verified against the live index set (`pg_indexes`) during the July 2026 docs-freshness pass — the above, plus each table's own primary-key and unique-constraint indexes documented alongside their table definitions, account for every index currently on `activities` and `enrollments`.
