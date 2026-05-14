ALTER TABLE enrollments
  ADD COLUMN start_time_override TIME,
  ADD COLUMN end_time_override TIME;

COMMENT ON COLUMN enrollments.start_time_override IS
  'Optional per-enrollment override of the activity''s default_start_time. When set, the teacher agenda displays this student as scheduled to arrive at this time. Informational — does not gate attendance.';

COMMENT ON COLUMN enrollments.end_time_override IS
  'Optional per-enrollment override of the activity''s default_end_time. Symmetric counterpart to start_time_override. Used less often but cheap to maintain.';
