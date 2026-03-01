-- Here App - Dynamic Block Count
-- Created: March 1, 2026
-- Description: Makes block count org-defined rather than hardcoded to 0-5.
--   1. Adds block_count to organization settings JSONB (nullable = not yet decided)
--   2. Loosens valid_block constraints on activities and enrollments to remove <= 5 ceiling
--   3. Updates City View seed data to block_count: 6
--
-- The upper bound on block numbers is now enforced at the application layer
-- against each org's settings.block_count value.

-- ============================================================================
-- 1. Add block_count to City View's org settings
--    (For new orgs, the app will include block_count in the settings JSONB
--     at creation time. For the existing City View org, we patch it here.)
-- ============================================================================

UPDATE organizations
SET settings = settings || '{"block_count": 6}'::jsonb
WHERE slug = 'city-view';

-- ============================================================================
-- 2. Loosen activities.valid_block — remove upper bound
--    Old: block >= 0 AND block <= 5
--    New: block >= 0
-- ============================================================================

ALTER TABLE activities DROP CONSTRAINT valid_block;
ALTER TABLE activities ADD CONSTRAINT valid_block CHECK (block IS NULL OR block >= 0);

-- ============================================================================
-- 3. Loosen enrollments.valid_block — remove upper bound
--    Old: block >= 0 AND block <= 5
--    New: block >= 0
-- ============================================================================

ALTER TABLE enrollments DROP CONSTRAINT valid_block;
ALTER TABLE enrollments ADD CONSTRAINT valid_block CHECK (block IS NULL OR block >= 0);
