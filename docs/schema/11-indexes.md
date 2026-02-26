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
```
