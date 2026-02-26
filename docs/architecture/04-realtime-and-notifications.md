# Realtime & Notifications

## Supabase Realtime

Supabase Realtime uses WebSocket channels to push database changes to subscribed clients. The app subscribes to `postgres_changes` events filtered by table, event type, and row-level filters.

### Use Cases

**Enable real-time for:**
- Teacher roster views — see check-ins and attendance updates as they happen
- Student notification feed — instant delivery of teacher comments and post alerts
- Admin dashboard stats — live counts during school hours

**Don't use real-time for:**
- Historical data (attendance reports, past dates)
- Calendar views (changes are infrequent, manual refresh is fine)
- User profile data

### Subscription Pattern

All real-time subscriptions go through a `useRealtime` hook that manages channel lifecycle (subscribe on mount, unsubscribe on unmount) and invalidates React Query caches when changes arrive.

```jsx
// src/hooks/useRealtime.js
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../api/supabase'

export function useRealtimeTable(table, filter, queryKeysToInvalidate) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        () => {
          queryKeysToInvalidate.forEach(key => {
            queryClient.invalidateQueries({ queryKey: key })
          })
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [table, filter, queryClient])
}
```

### Example: Teacher Monitoring Check-Ins

```jsx
function BlockRoster({ teacherId, block, date }) {
  const { data: roster } = useTeacherRoster(teacherId, block, date)

  // Subscribe to check-in changes for today
  useRealtimeTable(
    'check_ins',
    `activity_instance_id=in.(${instanceIds.join(',')})`,
    [['teacher-roster', teacherId, block, date], ['check-ins', date]]
  )

  return (
    <div>
      {roster?.map(student => (
        <StudentRow key={student.id} student={student} />
      ))}
    </div>
  )
}
```

### Performance Guidelines

- Limit subscriptions to active views only — unsubscribe when the component unmounts
- Use channel multiplexing when multiple components watch the same table
- Throttle rapid updates by debouncing query invalidation (e.g., during bulk attendance marking)
- Filter subscriptions as narrowly as possible to reduce noise

---

## Notification System

### Architecture

Notifications are **in-app only** for MVP. No email, push, or SMS (email is used only for Supabase Auth flows like password reset). Notifications are stored in the `notifications` table and delivered to clients via Supabase Realtime subscriptions.

### Notification Types

| Type | Trigger | Recipient |
|------|---------|-----------|
| `teacher_comment` | Teacher comments on a student's status update or post response | Student |
| `post_created` | Teacher creates a post on an activity instance | All enrolled students |
| `response_required` | Teacher creates a post with `requires_response = true` | All enrolled students |
| `checkin_reminder` | Student has an open check-in (no check-out) at midnight | Student |
| `schedule_change` | Admin modifies the school day calendar | Affected users (deferred) |

### Trigger Implementation

Notifications are created in **application logic** (JavaScript), not database triggers. This keeps all business logic in one language, makes conditional rules easy to add, and is simpler to debug.

```jsx
// Example: Creating a notification when a teacher comments on a status update
async function createCommentWithNotification(commentData) {
  // 1. Create the comment
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      author_id: commentData.authorId,
      status_update_id: commentData.statusUpdateId,
      content: commentData.content
    })
    .select()
    .single()

  if (error) throw error

  // 2. Look up the student who wrote the status update
  const { data: statusUpdate } = await supabase
    .from('status_updates')
    .select('student_id')
    .eq('id', commentData.statusUpdateId)
    .single()

  // 3. Create notification for the student
  await supabase
    .from('notifications')
    .insert({
      user_id: statusUpdate.student_id,
      type: 'teacher_comment',
      status_update_id: commentData.statusUpdateId,
      message: `${teacherName} commented on your update`
    })

  return comment
}
```

The `notifications` table uses nullable FK columns (`post_id`, `post_response_id`, `status_update_id`, `check_in_id`) with an `at_most_one_related` constraint — at most one can be set per notification. This gives real foreign keys with cascading deletes while avoiding the polymorphic `related_type`/`related_id` pattern.

### Realtime Delivery

Students subscribe to the `notifications` table filtered by their user ID. New notifications appear instantly without polling:

```jsx
function NotificationCenter({ userId }) {
  const { data: notifications } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getUnreadNotifications(userId),
  })

  // Real-time: new notifications appear instantly
  useRealtimeTable(
    'notifications',
    `user_id=eq.${userId}`,
    [['notifications', userId]]
  )

  return (
    <div>
      {notifications?.map(n => (
        <NotificationItem key={n.id} notification={n} />
      ))}
    </div>
  )
}
```

### Deferred Notification Features

These are not in MVP scope but the schema supports them without changes:
- Schedule change notifications (admin modifies calendar → affected users notified)
- Streak milestone celebrations (presence wave streaks hitting thresholds)
- Attendance marked notifications (student notified when attendance is recorded)
- Missed check-out reminders (requires a scheduled job or Supabase cron)

---

## Timezone & Date Handling

### Design Principle

The schema uses two different time column types intentionally:

- **`TIME` (without timezone)** — Block schedule times (`default_start_time`, `default_end_time` on activities), schedule template block definitions. These are wall-clock times that mean "9:05 AM at the school" regardless of the viewer's timezone.
- **`TIMESTAMPTZ` (with timezone)** — Event timestamps: `checked_in_at`, `marked_at`, `waved_at`, `created_at`, `updated_at`. Postgres stores these as UTC and converts on retrieval.

### Organization Timezone

The `organizations.settings.timezone` field (e.g., `"America/Chicago"`) serves one purpose: **determining the current local date**. When the app needs to answer "what school day is it right now?", it converts the current UTC timestamp to the org's timezone to get the local date. This drives which `school_days` record to look up, which rotation day applies, and whether a check-in falls on "today" or "yesterday."

### Frontend Display Rules

All `TIMESTAMPTZ` values are displayed in the **user's browser timezone**, which is the browser's default behavior with `Date` objects. A teacher in Central time sees "Checked in at 9:03 AM" while the same moment displays as "10:03 AM" for someone in Eastern time. Both are correct.

All `TIME` values are displayed as-is with no timezone conversion. "Block 1 starts at 9:05" means 9:05 at the school, always.

### Implementation

```jsx
import { formatInTimeZone } from 'date-fns-tz'

// Getting "today" in the org's timezone (for school day lookup)
function getSchoolDate(orgTimezone) {
  return formatInTimeZone(new Date(), orgTimezone, 'yyyy-MM-dd')
}

// Displaying a TIMESTAMPTZ — browser handles conversion automatically
function formatEventTime(timestamptz) {
  return new Date(timestamptz).toLocaleTimeString()
}

// Displaying a TIME value — no conversion, parse as local
function formatBlockTime(timeString) {
  const [hours, minutes] = timeString.split(':')
  return new Date(0, 0, 0, hours, minutes).toLocaleTimeString(
    [], { hour: 'numeric', minute: '2-digit' }
  )
}
```
