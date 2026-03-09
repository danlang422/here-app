-- Migration: Remove activity type column
-- The `type` field was originally a UI hint for form field visibility during data entry.
-- Activities are now configured entirely through scheduling fields and behavior flags.
-- The column has been unused in the UI since session 10 (March 2026); a default value
-- of 'regular_class' was being passed silently to satisfy the NOT NULL + CHECK constraint.

-- 1. Drop the type-based index
DROP INDEX IF EXISTS idx_activities_type;

-- 2. Drop the column (CASCADE drops the CHECK constraint automatically)
ALTER TABLE activities DROP COLUMN type;
