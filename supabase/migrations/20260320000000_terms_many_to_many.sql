-- Migration: Convert activities.term_id (single FK) to activity_terms junction table (many-to-many)
--
-- Why: Activities can belong to multiple terms (e.g. a Kirkwood college course is both
-- "Kirkwood S2 #1" and "Semester 2" from City View's perspective). Terms are used for
-- filtering and organization, not for driving behavior.
--
-- What changes:
--   1. New activity_terms junction table
--   2. Existing term_id data migrated into it (as is_primary = true)
--   3. term_id column dropped from activities
--   4. RLS policies added for activity_terms
--   5. Index on activities FK dropped (was idx_activities_term)

-- ─── 1. Create junction table ────────────────────────────────────────────────

CREATE TABLE activity_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  -- The first term applied to an activity is marked is_primary = true.
  -- The primary term's dates are used to auto-fill start_date/end_date on the activity
  -- (if those fields are blank at the time of association). Additional terms are just
  -- filtering/organizational tags and do not affect dates.
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_activity_term UNIQUE (activity_id, term_id)
);

CREATE INDEX idx_activity_terms_activity ON activity_terms(activity_id);
CREATE INDEX idx_activity_terms_term ON activity_terms(term_id);

-- ─── 2. Migrate existing data ───────────────────────────────────────────────

INSERT INTO activity_terms (activity_id, term_id, is_primary)
SELECT id, term_id, true
FROM activities
WHERE term_id IS NOT NULL;

-- ─── 3. Drop the old column ─────────────────────────────────────────────────

-- Drop the index first (references term_id)
DROP INDEX IF EXISTS idx_activities_term;

-- Drop the FK constraint, then the column
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_term_id_fkey;
ALTER TABLE activities DROP COLUMN term_id;

-- ─── 4. RLS policies for activity_terms ──────────────────────────────────────

ALTER TABLE activity_terms ENABLE ROW LEVEL SECURITY;

-- Admin: full access to activity_terms within their org
-- (join through activities to check org membership, roles is an array so use ANY())
CREATE POLICY activity_terms_admin_all ON activity_terms
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN user_profiles up ON up.organization_id = a.organization_id
      WHERE a.id = activity_terms.activity_id
        AND up.id = auth.uid()
        AND 'admin' = ANY(up.roles)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN user_profiles up ON up.organization_id = a.organization_id
      WHERE a.id = activity_terms.activity_id
        AND up.id = auth.uid()
        AND 'admin' = ANY(up.roles)
    )
  );

-- Staff (teachers): read access to activity_terms within their org
CREATE POLICY activity_terms_staff_select ON activity_terms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN user_profiles up ON up.organization_id = a.organization_id
      WHERE a.id = activity_terms.activity_id
        AND up.id = auth.uid()
        AND 'staff' = ANY(up.roles)
    )
  );

-- Students: read access to activity_terms for activities they're enrolled in
CREATE POLICY activity_terms_student_select ON activity_terms
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.activity_id = activity_terms.activity_id
        AND e.student_id = auth.uid()
        AND e.is_active = true
    )
  );
