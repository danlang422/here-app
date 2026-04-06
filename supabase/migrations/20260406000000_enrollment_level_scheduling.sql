-- Enrollment-level scheduling fields
-- Adds nullable per-student scheduling constraints to enrollments.
-- Null values mean "follow the activity's schedule" (backward compatible).
-- All four fields mirror the corresponding fields on the activities table.
--
-- Enrollment scheduling only narrows, never expands:
-- enrollment.days_of_week must be a subset of activity.days_of_week
-- enrollment.rotation_day_type must match or be null (if activity has one)
-- enrollment.recurrence_interval >= activity.recurrence_interval

ALTER TABLE enrollments
  ADD COLUMN days_of_week          INTEGER[],
  ADD COLUMN rotation_day_type     TEXT,
  ADD COLUMN recurrence_interval   INTEGER,
  ADD COLUMN recurrence_anchor_date DATE;

ALTER TABLE enrollments ADD CONSTRAINT valid_enrollment_days CHECK (
  days_of_week IS NULL OR (
    array_length(days_of_week, 1) > 0
    AND days_of_week <@ ARRAY[0,1,2,3,4,5,6]
  )
);

ALTER TABLE enrollments ADD CONSTRAINT valid_enrollment_recurrence CHECK (
  recurrence_interval IS NULL OR recurrence_interval >= 1
);
