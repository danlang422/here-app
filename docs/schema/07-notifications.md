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
  -- Exactly one of these may be set (enforced by constraint below)
  -- NULL for all = notification not tied to a specific record (e.g. schedule_change)
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  post_response_id UUID REFERENCES post_responses(id) ON DELETE CASCADE,
  status_update_id UUID REFERENCES status_updates(id) ON DELETE CASCADE,
  check_in_id UUID REFERENCES check_ins(id) ON DELETE CASCADE,

  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT at_most_one_related CHECK (
    num_nonnulls(post_id, post_response_id, status_update_id, check_in_id) <= 1
  )
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_post ON notifications(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_notifications_post_response ON notifications(post_response_id) WHERE post_response_id IS NOT NULL;
CREATE INDEX idx_notifications_status_update ON notifications(status_update_id) WHERE status_update_id IS NOT NULL;
CREATE INDEX idx_notifications_check_in ON notifications(check_in_id) WHERE check_in_id IS NOT NULL;
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
