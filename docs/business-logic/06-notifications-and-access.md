# Notifications & Access Control

## Notifications

### Overview

In-app notifications delivered via Supabase Realtime. MVP scope is in-app only — no email, SMS, or push notifications. (Email is used only for Supabase Auth: password reset, email verification.)

Notifications are stored in the `notifications` table with nullable FK columns (`post_id`, `post_response_id`, `status_update_id`, `check_in_id`) — not polymorphic `related_type`/`related_id`. At most one FK is set per notification, enforced by a CHECK constraint.

Triggers are implemented in **application logic** (JavaScript), not database triggers. This keeps the trigger logic in one place, makes it testable, and avoids Supabase function deployment complexity.

### Notification Types

```sql
type TEXT NOT NULL CHECK (type IN (
  'teacher_comment',     -- teacher commented on student's status update or post response
  'post_created',        -- teacher posted to an activity the student is enrolled in
  'response_required',   -- teacher posted something requiring a response
  'checkin_reminder',    -- student forgot to check out
  'schedule_change'      -- admin changed schedule (deferred from MVP)
))
```

### MVP Triggers

#### 1. Teacher comments on a student's status update

```
on createComment where status_update_id is not null
  and author is a teacher:

  statusUpdate = getStatusUpdate(comment.status_update_id)

  createNotification({
    user_id: statusUpdate.student_id,
    type: 'teacher_comment',
    status_update_id: statusUpdate.id,
    message: teacher.first_name + " commented on your " + statusUpdate.status_type
  })
```

#### 2. Teacher creates a post on an activity instance

```
on createPost:
  instance = getActivityInstance(post.activity_instance_id)
  activity = getActivity(instance.activity_id)
  enrolledStudents = getActiveEnrollments(activity.id)

  for enrollment in enrolledStudents:
    createNotification({
      user_id: enrollment.student_id,
      type: 'post_created',
      post_id: post.id,
      message: teacher.first_name + " posted in " + activity.name
    })
```

#### 3. Teacher creates a post requiring a response

```
on createPost where requires_response = true:
  instance = getActivityInstance(post.activity_instance_id)
  activity = getActivity(instance.activity_id)
  enrolledStudents = getActiveEnrollments(activity.id)

  for enrollment in enrolledStudents:
    createNotification({
      user_id: enrollment.student_id,
      type: 'response_required',
      post_id: post.id,
      message: teacher.first_name + " asked a question in " + activity.name
    })
```

Note: `response_required` is used instead of `post_created` when `requires_response = true`. Only one notification is sent per post per student — not both types.

#### 4. Student forgets to check out

```
scheduled job at midnight:
  incompleteCheckIns = SELECT ci.* FROM check_ins ci
    JOIN activity_instances ai ON ci.activity_instance_id = ai.id
    WHERE ai.date = today
      AND ci.checked_out_at IS NULL

  for checkIn in incompleteCheckIns:
    activity = getActivityFromInstance(checkIn.activity_instance_id)

    createNotification({
      user_id: checkIn.student_id,
      type: 'checkin_reminder',
      check_in_id: checkIn.id,
      message: "You forgot to check out of " + activity.name
    })
```

### Deferred Triggers

These are not in MVP but the schema supports them:

- **Schedule change notifications** — When an admin updates `school_days.schedule_template_id`, notify affected students. Deferred because schedule changes are rare and the notification wording needs design work.
- **Streak milestone notifications** — When a student hits 10, 25, 50 day streaks. Deferred because streak calculation is already visible in the UI.
- **Attendance marked notifications** — When a teacher marks attendance. Deferred because this would generate high notification volume and students can already see their status in the app.

### Deduplication

**Purpose:** Prevent notification spam when rapid actions occur.

**Rules:**

```
function shouldCreateNotification(data):
  // Check for recent duplicate
  recentDuplicate = SELECT * FROM notifications
    WHERE user_id = data.user_id
      AND type = data.type
      AND created_at > (now() - interval '5 minutes')
      AND (
        (data.post_id IS NOT NULL AND post_id = data.post_id) OR
        (data.status_update_id IS NOT NULL AND status_update_id = data.status_update_id) OR
        (data.check_in_id IS NOT NULL AND check_in_id = data.check_in_id)
      )

  if recentDuplicate:
    return false  // Same record, same type, within 5 minutes — skip

  return true
```

**Batching:** If a teacher creates multiple posts in rapid succession (< 5 min apart) to the same activity, each post still generates its own notification — batching is per-record, not per-activity. The 5-minute window only deduplicates when the same FK reference would be notified about twice.

### Reading Notifications

Notifications have an `is_read` boolean. Marking as read is a simple update:

```sql
UPDATE notifications SET is_read = true WHERE id = $id AND user_id = auth.uid()
```

The unread count badge is:

```sql
SELECT count(*) FROM notifications WHERE user_id = auth.uid() AND is_read = false
```

Supabase Realtime subscription on the `notifications` table (filtered by `user_id = auth.uid()`) delivers new notifications to the client in real time.

---

## Access Control

### Roles

Users have one or more roles stored as `TEXT[]` in `user_profiles.roles`. Possible values: `'student'`, `'teacher'`, `'admin'`.

A user can have multiple roles simultaneously — e.g., `['teacher', 'admin']` for a teacher who also administers the system. Permissions are the **union** of all held roles.

### Role-Based Permissions

**Student:**

| Action | Scope |
|--------|-------|
| Read own enrollments, activities, instances | Own records via enrollment |
| Read own check-ins, status updates, attendance records | Own `student_id` |
| Read posts on enrolled activities | Via enrollment → activity → instance → posts |
| Create check-ins | Own `student_id`, activities with `requires_checkin` |
| Create status updates | Own `student_id`, on accessible instances |
| Create presence waves | Own `student_id`, activities with `allows_presence_wave` |
| Create post responses | Own `student_id`, on posts with `requires_response` |
| Create comments | On posts, post responses, status updates they can see |
| Update own check-ins | Check-out only (`checked_out_at`) |
| Update own post responses | Edit response content |

Students **cannot**: view other students' data, mark attendance, create/edit activities, modify enrollments.

**Teacher:**

| Action | Scope |
|--------|-------|
| Read all activities in org | Organization-wide |
| Read enrollments, check-ins, status updates, attendance | For activities they own/monitor |
| Create attendance records | Activities where `teacher_id = me` or `monitor_id = me` |
| Create posts | On instances of their activities |
| Create comments | On posts, post responses, status updates in their activities |
| Update attendance records | Own activities only |
| Update own posts | Edit content |

Teachers **cannot**: edit student check-ins or status updates, create/edit activities (unless also admin), modify enrollments (unless also admin).

**Admin:**

| Action | Scope |
|--------|-------|
| Full CRUD on activities, enrollments | Organization-wide |
| Full CRUD on academic terms, schedule templates, school days | Organization-wide |
| Read all data in organization | Everything |
| Create/update organization settings | Own org |
| Manage user profiles | Own org |
| Mark attendance on any activity | Organization-wide |

Admins **cannot**: access data from other organizations, hard-delete records (soft delete via `is_active` only; hard delete requires direct database access).

### Multi-Role Logic

Permissions are always the union of all roles a user holds:

```
function getEffectivePermissions(user):
  permissions = new Set()

  for role in user.roles:
    for permission in ROLE_PERMISSIONS[role]:
      permissions.add(permission)

  return permissions

function canPerformAction(user, action, resource):
  permissions = getEffectivePermissions(user)
  required = getRequiredPermission(action, resource)
  return permissions.has(required)
```

**Example:** A user with `roles = ['teacher', 'admin']` can mark attendance on any activity in the org (admin) AND see the teacher-specific roster view (teacher). The UI shows a role switcher when a user has multiple roles, allowing them to see the app from each perspective.

### Organization Data Isolation

All data is scoped to an organization. Every significant table has an `organization_id` column (directly or transitively via parent records).

**Enforcement layers:**

1. **Row Level Security (RLS)** — Database-level enforcement. Every query is automatically filtered to the user's organization. See `schema/10-rls-policies.md`.
2. **Application layer** — API endpoints validate that the requesting user belongs to the same organization as the requested data. Belt-and-suspenders with RLS.
3. **Supabase Auth** — `auth.uid()` in RLS policies ties every database operation to the authenticated user.

```
// Every query implicitly includes:
WHERE organization_id = (
  SELECT organization_id FROM user_profiles WHERE id = auth.uid()
)
```

A user in Organization A can never see, create, update, or delete data belonging to Organization B. This is enforced at the database level regardless of what the application code does.

---

## Data Validation Summary

Application-layer validation rules for key fields:

| Field | Min | Max | Notes |
|-------|-----|-----|-------|
| `status_updates.content` | 1 | 500 | Required during check-in/out flow |
| `posts.content` | 1 | 2000 | Teacher post body |
| `post_responses.content` | 1 | 1000 | Student response to a post |
| `comments.content` | 1 | 1000 | Comment on any parent |
| `attendance_records.notes` | 0 | 500 | Optional teacher note |
| `activity_instances.notes` | 0 | 500 | Optional ("Sub teacher today") |
| `activities.name` | 1 | 200 | Activity name |
| `activities.block` | 0 | 5 | Nullable; enforced by CHECK constraint |
| `activities.days_of_week` | — | — | INTEGER[] with values 0–6; enforced by CHECK constraint |
