-- Migration: Add instructor fields to sections for college classes and external instruction
-- This supports scenarios where the City View teacher takes attendance but is not the instructor
-- Example: College classes with professors, or monitored independent study

-- Add instructor_name field for external instructors (college professors, etc.)
ALTER TABLE sections
ADD COLUMN instructor_name text;

-- Add show_assigned_teacher flag to control student UI display
-- Default TRUE maintains current behavior (show assigned teacher)
-- Set FALSE for college classes or other sections where students shouldn't see City View teacher
ALTER TABLE sections
ADD COLUMN show_assigned_teacher boolean NOT NULL DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN sections.instructor_name IS 'Name of external instructor (e.g., college professor). Shows on student UI when show_assigned_teacher is false.';
COMMENT ON COLUMN sections.show_assigned_teacher IS 'Controls whether assigned City View teacher displays on student UI. Set false for college classes or external instruction.';
