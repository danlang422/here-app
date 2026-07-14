# Key Queries

*Last updated: July 2026 — reference queries below rewritten to match the current schema (`activity_staff` junction table replaced `activities.teacher_id`/`monitor_id` in `20260526000001`; `block` is `INTEGER[]` as of `20260421000000`). These are illustrative reference queries showing the join shape, not verbatim application code — see `src/api/` for the actual query-building functions.*

## Teacher roster for a block on a given date

```sql
-- Step 1: Get today's context
WITH today AS (
  SELECT
    sd.rotation_day,
    EXTRACT(DOW FROM $date)::integer AS day_number,
    sd.schedule_template_id
  FROM school_days sd
  WHERE sd.organization_id = $org_id AND sd.date = $date
),

-- Step 2: Find all activities this teacher is staffed on (any role) for this block
teacher_activities AS (
  SELECT a.id AS activity_id, a.block, a.requires_attendance, a.name
  FROM activities a
  JOIN activity_staff ast ON ast.activity_id = a.id AND ast.user_id = $teacher_id
  JOIN today t ON (
    (a.days_of_week IS NULL OR t.day_number = ANY(a.days_of_week))
    AND (a.rotation_day_type IS NULL OR a.rotation_day_type = t.rotation_day)
  )
  WHERE a.organization_id = $org_id
    AND $block = ANY(a.block)
    AND a.is_active = true
    AND a.is_release = false
),

-- Step 3: Get enrolled students across those activities
enrolled AS (
  SELECT e.student_id, ta.activity_id, ta.name AS activity_name, ta.requires_attendance
  FROM enrollments e
  JOIN teacher_activities ta ON ta.activity_id = e.activity_id
  WHERE e.is_active = true
)

SELECT
  e.student_id,
  e.activity_name,
  e.requires_attendance
FROM enrolled e
ORDER BY e.student_id;
```

---

## Student schedule for a given date

```sql
WITH today AS (
  SELECT
    sd.rotation_day,
    EXTRACT(DOW FROM $date)::integer AS day_number
  FROM school_days sd
  WHERE sd.organization_id = $org_id AND sd.date = $date
),
scheduled AS (
  -- Activities with a fixed schedule (show on this day)
  SELECT a.*, false AS is_unscheduled
  FROM activities a
  JOIN enrollments e ON e.activity_id = a.id AND e.student_id = $student_id AND e.is_active = true
  JOIN today t ON (
    (a.days_of_week IS NULL OR t.day_number = ANY(a.days_of_week))
    AND (a.rotation_day_type IS NULL OR a.rotation_day_type = t.rotation_day)
  )
  WHERE a.is_active = true
    AND a.is_not_scheduled = false
),
unscheduled AS (
  -- Activities with no fixed schedule (always available for freeform tagging)
  SELECT a.*, true AS is_unscheduled
  FROM activities a
  JOIN enrollments e ON e.activity_id = a.id AND e.student_id = $student_id AND e.is_active = true
  WHERE a.is_active = true
    AND a.is_not_scheduled = true
)
SELECT * FROM scheduled
UNION ALL
SELECT * FROM unscheduled
ORDER BY is_unscheduled ASC, default_start_time ASC NULLS LAST;
```

---

## Admin needs-scheduling list

```sql
-- Activities that have been created but don't yet have a full schedule defined
SELECT a.*
FROM activities a
WHERE a.organization_id = $org_id
  AND a.is_active = true
  AND a.is_not_scheduled = false
  AND a.is_release = false
  AND (a.days_of_week IS NULL OR a.default_start_time IS NULL)
ORDER BY a.created_at ASC;
```
