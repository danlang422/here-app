# Notifications

## notifications

In-app notifications delivered via Supabase Realtime.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'teacher_comment',    -- teacher commented on student's status update or post response
    'post_created',       -- teacher posted to an activity the student is enrolled in
    'response_required',  -- teacher posted something requiring a response
    'checkin_reminder',   -- student forgot to check out
    'schedule_change'     -- admin changed schedule (deferred)
  )),
  related_type TEXT CHECK (related_type IN ('post', 'post_response', 'status_update', 'check_in')),
  related_id UUID,    -- ID of the related record
  -- No FK constraint — related_type determines which table related_id points to.
  -- Application layer ensures referential integrity.
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);
```

**MVP triggers (implemented in application logic, not database triggers):**
- Teacher comments on a student's status update → notify student
- Teacher creates a post on an activity instance → notify enrolled students
- Teacher creates a `requires_response` post → notify enrolled students
- Student forgets to check out by midnight → notify student (scheduled job)

**Deferred:**
- Schedule change notifications
- Streak milestone notifications
- Attendance marked notifications
