-- Migration: Activity recurrence interval
-- Created: March 28, 2026
-- Run: March 29, 2026
-- Description: Adds `recurrence_interval` and `recurrence_anchor_date` to activities
--              to support every-other-week (and similar) scheduling patterns.
--
-- Current state: Activities recur based on `days_of_week` (every week on these days)
-- or `rotation_day_type` (on A or B rotation days). There's no way to express
-- "every other Friday" or "every 2nd week on MWF."
--
-- New fields:
--   recurrence_interval  — how many weeks between occurrences. Default 1 (every week).
--                          Set to 2 for every-other-week. Could support 3, 4, etc.
--   recurrence_anchor_date — a date that falls in an "on" week. Used to determine
--                            whether a given date's week is an "on" week.
--                            Required when recurrence_interval > 1.
--
-- Example: "Kirkwood Comp 1 meets MWF, but Friday is every other Friday"
--   Solution: Two activities (or one activity with days_of_week = [1,3] at interval 1,
--   and a separate activity for Friday at interval 2 with an anchor date).
--   OR: Single activity with days_of_week = [1,3,5], interval 1, and a future
--   per-day-interval feature. For now, the split approach works.
--
-- For the immediate use case (one student's every-other-Friday course), the simplest
-- model is: the activity has days_of_week = [5] (Friday only), recurrence_interval = 2,
-- and recurrence_anchor_date set to a Friday that IS a class day.
--
-- The `activityMeetsToday` predicate will need a new branch:
--   if activity.recurrence_interval > 1:
--     weeksSinceAnchor = floor(daysBetween(anchor, date) / 7)
--     if weeksSinceAnchor % recurrence_interval != 0: return false

-- ============================================================================
-- ADD COLUMNS
-- ============================================================================

ALTER TABLE activities
  ADD COLUMN recurrence_interval INTEGER DEFAULT 1
    CONSTRAINT valid_recurrence_interval CHECK (recurrence_interval >= 1),
  ADD COLUMN recurrence_anchor_date DATE;

-- Anchor date is required when interval > 1, but we enforce this at the app layer
-- rather than with a DB constraint, consistent with how other scheduling validation
-- works (block upper bound, rotation_day_type values, etc.).

COMMENT ON COLUMN activities.recurrence_interval IS
  'Weeks between occurrences. 1 = every week (default), 2 = every other week, etc.';

COMMENT ON COLUMN activities.recurrence_anchor_date IS
  'A date falling in an "on" week. Used to calculate whether a given week is active when recurrence_interval > 1. Should be set to any date that falls in a week the activity meets.';