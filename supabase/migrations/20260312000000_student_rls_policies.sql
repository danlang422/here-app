-- Migration: Student RLS policies
-- Created: March 12, 2026
-- Description: Adds RLS policies for the student role, and fixes a recursive
--              policy on enrollments that caused 500 errors for non-admin users.

-- ============================================================================
-- ACTIVITIES — students can read activities they are enrolled in
-- ============================================================================

CREATE POLICY "Students read enrolled activities"
  ON activities FOR SELECT
  USING (
    id IN (
      SELECT activity_id FROM enrollments
      WHERE student_id = auth.uid()
      AND is_active = true
    )
  );

-- ============================================================================
-- ENROLLMENTS — fix recursive admin policy
--
-- The original "Admins manage org enrollments" policy used an activities
-- subquery in its USING clause. For non-admin users, Postgres still evaluated
-- that subquery, which triggered the activities RLS policy ("Students read
-- enrolled activities"), which queried enrollments again — infinite recursion.
--
-- Fix: scope admins via user_profiles.organization_id instead, avoiding the
-- activities subquery entirely.
-- ============================================================================

DROP POLICY IF EXISTS "Admins manage org enrollments" ON enrollments;

CREATE POLICY "Admins manage org enrollments"
  ON enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND 'admin' = ANY(roles)
      AND organization_id = (
        (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid
      )
    )
  );