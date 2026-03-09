-- Migration: Cascade activity block changes to enrollments
-- The `block` field on enrollments is denormalized from activities.block at enrollment time.
-- This trigger keeps it in sync when an admin changes an activity's block assignment.

CREATE OR REPLACE FUNCTION sync_enrollment_block()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when block actually changes
  IF NEW.block IS DISTINCT FROM OLD.block THEN
    UPDATE enrollments
    SET block = NEW.block,
        updated_at = NOW()
    WHERE activity_id = NEW.id
      AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_block_cascade
  AFTER UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION sync_enrollment_block();
