-- Migration: Multi-block activities
-- Converts activities.block and enrollments.block from INTEGER to INTEGER[].
-- Existing single-block data is preserved as single-element arrays.
-- The cascade trigger is updated to sync arrays.

-- 1. Drop existing valid_block constraints
ALTER TABLE activities DROP CONSTRAINT IF EXISTS valid_block;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS valid_block;

-- 2. Convert activities.block: INTEGER -> INTEGER[]
ALTER TABLE activities
  ALTER COLUMN block TYPE INTEGER[]
  USING (CASE WHEN block IS NULL THEN NULL ELSE ARRAY[block] END);

-- 3. Convert enrollments.block: INTEGER -> INTEGER[]
ALTER TABLE enrollments
  ALTER COLUMN block TYPE INTEGER[]
  USING (CASE WHEN block IS NULL THEN NULL ELSE ARRAY[block] END);

-- 4. Add new constraints: array must be non-empty if present
--    (element >= 0 is enforced by the application layer)
ALTER TABLE activities
  ADD CONSTRAINT valid_block CHECK (
    block IS NULL OR array_length(block, 1) > 0
  );

ALTER TABLE enrollments
  ADD CONSTRAINT valid_block CHECK (
    block IS NULL OR array_length(block, 1) > 0
  );

-- 5. Update cascade trigger to handle INTEGER[]
CREATE OR REPLACE FUNCTION sync_enrollment_block()
RETURNS TRIGGER AS $$
BEGIN
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
