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
CREATE INDEX idx_attendance_instance_lookup
  ON attendance_records(activity_instance_id, student_id);

-- Check-in status
CREATE INDEX idx_checkin_student_instance
  ON check_ins(student_id, activity_instance_id);

-- Feed query (recent posts for enrolled activities)
-- Note: idx_posts_instance_created is defined on the posts table in 06-social.md.
-- No duplicate needed here.

-- Rotation-based activities
CREATE INDEX idx_activities_rotation
  ON activities(organization_id, rotation_day_type)
  WHERE rotation_day_type IS NOT NULL;
```
