-- Here App - Admin RLS Policies
-- Created: March 1, 2026
-- Description: Adds RLS policies needed for admin pages.
--   - organizations: users can read their own org
--   - activities: admins can INSERT/UPDATE (existing policy only covers SELECT via FOR ALL,
--     but we also need explicit teacher read + admin write for clarity)
--   - academic_terms, schedule_templates, school_days: read for org members, write for admins
--   - enrollments: admin read/write for org
--   - user_profiles: admin write for org, users read own profile
--   - internship_opportunities: read for org members, write for admins

-- ============================================================================
-- ORGANIZATIONS — users can read their own org
-- ============================================================================

CREATE POLICY "Users read own organization"
  ON organizations FOR SELECT
  USING (id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ));

-- Admins can update their own org (for settings changes)
CREATE POLICY "Admins update own organization"
  ON organizations FOR UPDATE
  USING (id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ) AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  ));

-- ============================================================================
-- ACADEMIC TERMS — org members read, admins write
-- ============================================================================

CREATE POLICY "Users read org terms"
  ON academic_terms FOR SELECT
  USING (organization_id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ));

CREATE POLICY "Admins manage org terms"
  ON academic_terms FOR ALL
  USING (organization_id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ) AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  ));

-- ============================================================================
-- SCHEDULE TEMPLATES — org members read, admins write
-- ============================================================================

CREATE POLICY "Users read org schedule templates"
  ON schedule_templates FOR SELECT
  USING (organization_id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ));

CREATE POLICY "Admins manage org schedule templates"
  ON schedule_templates FOR ALL
  USING (organization_id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ) AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  ));

-- ============================================================================
-- SCHOOL DAYS — org members read, admins write
-- ============================================================================

CREATE POLICY "Users read org school days"
  ON school_days FOR SELECT
  USING (organization_id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ));

CREATE POLICY "Admins manage org school days"
  ON school_days FOR ALL
  USING (organization_id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ) AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  ));

-- ============================================================================
-- ENROLLMENTS — admins can read/write all org enrollments
-- (student read own policy already exists from phase 4)
-- ============================================================================

CREATE POLICY "Admins manage org enrollments"
  ON enrollments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  ) AND activity_id IN (
    SELECT id FROM activities
    WHERE organization_id = (
      (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
    )
  ));

-- ============================================================================
-- USER PROFILES — admins can update profiles in their org
-- (read policies already exist from phase 4 + RLS fix migration)
-- ============================================================================

CREATE POLICY "Admins update org profiles"
  ON user_profiles FOR UPDATE
  USING (organization_id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ) AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  ));

-- ============================================================================
-- INTERNSHIP OPPORTUNITIES — org members read, admins write
-- ============================================================================

CREATE POLICY "Users read org internship opportunities"
  ON internship_opportunities FOR SELECT
  USING (organization_id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ));

CREATE POLICY "Admins manage org internship opportunities"
  ON internship_opportunities FOR ALL
  USING (organization_id = (
    (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
  ) AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  ));
