# Attendance & Check-ins

## attendance_records

Teacher-marked attendance. One record per student per activity instance.

```sql
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused', 'tardy');

CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status attendance_status NOT NULL,
  marked_by_id UUID NOT NULL REFERENCES user_profiles(id),
  notes TEXT,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_attendance UNIQUE (activity_instance_id, student_id)
);

CREATE INDEX idx_attendance_instance ON attendance_records(activity_instance_id);
CREATE INDEX idx_attendance_student ON attendance_records(student_id);
```

Only created for activities where `requires_attendance = true`. Teachers can update status after marking — all changes are visible in audit_log.

---

## check_ins

Student check-in/out for activities where `requires_checkin = true`.

```sql
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL,
  checked_out_at TIMESTAMPTZ,
  check_in_location_lat NUMERIC(10, 7),
  check_in_location_lng NUMERIC(10, 7),
  geofence_validated BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_checkout CHECK (checked_out_at IS NULL OR checked_out_at > checked_in_at),
  CONSTRAINT unique_checkin UNIQUE (student_id, activity_instance_id)
);

CREATE INDEX idx_check_ins_student ON check_ins(student_id);
CREATE INDEX idx_check_ins_instance ON check_ins(activity_instance_id);
```

Check-in becomes available 10 minutes before the activity's start time. Check-out becomes available at the activity's end time. Both remain available until midnight. For geofenced activities, location is validated on check-in — if outside the radius, check-in is allowed but `geofence_validated = false` and the teacher sees an indicator.

---

## checkin_activity_tags

Freeform tagging junction table. Used when `allows_freeform = true`.

```sql
CREATE TABLE checkin_activity_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES check_ins(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_tag UNIQUE (checkin_id, activity_id)
);

CREATE INDEX idx_checkin_tags_checkin ON checkin_activity_tags(checkin_id);
CREATE INDEX idx_checkin_tags_activity ON checkin_activity_tags(activity_id);
```

When a student checks into a freeform block, they tag one or more activities from their full activity list (both scheduled and unscheduled). Each tag is a row here. The student sees today's activity instances plus any `is_not_scheduled` activities (online courses, etc.) as tagging options. Status updates written during this check-in flow describe what they did across the tagged activities.

---

## presence_waves

Optional daily "I'm here" signal with streak tracking.

```sql
CREATE TABLE presence_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  waved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_wave UNIQUE (student_id, activity_instance_id)
);

CREATE INDEX idx_presence_waves_student ON presence_waves(student_id);
CREATE INDEX idx_presence_waves_instance ON presence_waves(activity_instance_id);
```

One wave per student per instance. Available from 10 minutes before activity start until midnight. After waving, button is disabled showing timestamp. Consecutive school-day waves build a streak — weekends and holidays don't break it, missing a school day does.
