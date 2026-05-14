ALTER TABLE activities
  ADD COLUMN visible_to_all_staff BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN activities.visible_to_all_staff IS
  'When true, this activity surfaces in every teacher''s agenda sidebar for situational awareness, regardless of staff assignment. Used for open/independent study blocks where students are dispersed across the building.';
