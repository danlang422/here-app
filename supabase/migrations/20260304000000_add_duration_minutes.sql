-- Add duration_minutes to activities
-- Nullable integer: when set, represents the expected duration of an activity in minutes.
-- Used for proportional card sizing in the agenda view and unplaced activities zone.
-- When null, duration can be inferred from default_start_time/default_end_time if both are set.

ALTER TABLE activities
  ADD COLUMN duration_minutes integer;

-- Optional: add a check constraint to keep values reasonable
ALTER TABLE activities
  ADD CONSTRAINT activities_duration_minutes_positive
  CHECK (duration_minutes IS NULL OR duration_minutes > 0);

COMMENT ON COLUMN activities.duration_minutes IS 'Expected duration in minutes. Nullable — can be inferred from start/end times when not explicitly set.';
