-- Migration: Comprehensive RLS policies
-- Created: March 13, 2026
-- Description: Replaces all existing starter/patched RLS policies with a
--              complete, tested set covering admin, teacher, and student roles
--              across all tables. Creates SECURITY DEFINER helper functions
--              for cross-role lookups that would otherwise cause recursion.
--
-- This migration drops all existing policies first, then creates the full set.
-- Tables that already have RLS enabled (all of them, from phase 4) are not re-altered.
--
-- Design principles:
--   1. JWT-based org scoping everywhere (no self-referential user_profiles subqueries for org)
--   2. SECURITY DEFINER functions for cross-role lookups (profile names, enrollment checks,
--      teacher/monitor checks) to avoid infinite recursion
--   3. Every policy is safe to evaluate for any authenticated user
--   4. Org-scoped everything — no cross-org data leakage
--
-- Key recursion insight: Postgres evaluates ALL policies on a table for a given
-- operation and OR's them together, regardless of the current user's role. A student
-- policy that queries enrollments and a teacher enrollment policy that queries activities
-- will create a cycle even when an admin is the one running the query. SECURITY DEFINER
-- functions break these cycles by bypassing RLS evaluation inside the function.

-- ============================================================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================================================

-- organizations
DROP POLICY IF EXISTS "Users read own organization" ON organizations;
DROP POLICY IF EXISTS "Admins update own organization" ON organizations;

-- user_profiles
DROP POLICY IF EXISTS "Users read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users view org profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins update org profiles" ON user_profiles;

-- academic_terms
DROP POLICY IF EXISTS "Users read org terms" ON academic_terms;
DROP POLICY IF EXISTS "Admins manage org terms" ON academic_terms;

-- schedule_templates
DROP POLICY IF EXISTS "Users read org schedule templates" ON schedule_templates;
DROP POLICY IF EXISTS "Admins manage org schedule templates" ON schedule_templates;

-- school_days
DROP POLICY IF EXISTS "Users read org school days" ON school_days;
DROP POLICY IF EXISTS "Admins manage org school days" ON school_days;

-- internship_opportunities
DROP POLICY IF EXISTS "Users read org internship opportunities" ON internship_opportunities;
DROP POLICY IF EXISTS "Admins manage org internship opportunities" ON internship_opportunities;

-- activities
DROP POLICY IF EXISTS "Teachers read activities" ON activities;
DROP POLICY IF EXISTS "Admins full access" ON activities;
DROP POLICY IF EXISTS "Students read enrolled activities" ON activities;
DROP POLICY IF EXISTS "Teachers read org activities" ON activities;
DROP POLICY IF EXISTS "Admins manage org activities" ON activities;

-- enrollments
DROP POLICY IF EXISTS "Students read own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Admins manage org enrollments" ON enrollments;
DROP POLICY IF EXISTS "Teachers read activity enrollments" ON enrollments;

-- activity_instances
DROP POLICY IF EXISTS "Students read enrolled activity instances" ON activity_instances;
DROP POLICY IF EXISTS "Students create enrolled activity instances" ON activity_instances;
DROP POLICY IF EXISTS "Teachers read own activity instances" ON activity_instances;
DROP POLICY IF EXISTS "Teachers create own activity instances" ON activity_instances;
DROP POLICY IF EXISTS "Teachers update own activity instances" ON activity_instances;
DROP POLICY IF EXISTS "Admins manage org activity instances" ON activity_instances;

-- attendance_records
DROP POLICY IF EXISTS "Teachers manage attendance" ON attendance_records;
DROP POLICY IF EXISTS "Students read own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Teachers manage own activity attendance" ON attendance_records;
DROP POLICY IF EXISTS "Admins manage org attendance" ON attendance_records;

-- check_ins
DROP POLICY IF EXISTS "Students create own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Students manage own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Students update own check-ins" ON check_ins;
DROP POLICY IF EXISTS "Teachers read own activity check-ins" ON check_ins;
DROP POLICY IF EXISTS "Admins read org check-ins" ON check_ins;

-- checkin_activity_tags
DROP POLICY IF EXISTS "Students read own checkin tags" ON checkin_activity_tags;
DROP POLICY IF EXISTS "Students create own checkin tags" ON checkin_activity_tags;
DROP POLICY IF EXISTS "Teachers read own activity checkin tags" ON checkin_activity_tags;
DROP POLICY IF EXISTS "Admins read org checkin tags" ON checkin_activity_tags;

-- presence_waves
DROP POLICY IF EXISTS "Students read own waves" ON presence_waves;
DROP POLICY IF EXISTS "Students create own waves" ON presence_waves;
DROP POLICY IF EXISTS "Teachers read own activity waves" ON presence_waves;
DROP POLICY IF EXISTS "Admins read org waves" ON presence_waves;

-- status_updates
DROP POLICY IF EXISTS "Students read own status updates" ON status_updates;
DROP POLICY IF EXISTS "Students create own status updates" ON status_updates;
DROP POLICY IF EXISTS "Students update own status updates" ON status_updates;
DROP POLICY IF EXISTS "Teachers read own activity status updates" ON status_updates;
DROP POLICY IF EXISTS "Admins read org status updates" ON status_updates;

-- posts
DROP POLICY IF EXISTS "Students read enrolled activity posts" ON posts;
DROP POLICY IF EXISTS "Teachers manage own activity posts" ON posts;
DROP POLICY IF EXISTS "Authors update own posts" ON posts;
DROP POLICY IF EXISTS "Admins manage org posts" ON posts;

-- post_responses
DROP POLICY IF EXISTS "Students manage own post responses" ON post_responses;
DROP POLICY IF EXISTS "Students create own post responses" ON post_responses;
DROP POLICY IF EXISTS "Students update own post responses" ON post_responses;
DROP POLICY IF EXISTS "Teachers read own activity post responses" ON post_responses;
DROP POLICY IF EXISTS "Admins read org post responses" ON post_responses;

-- comments
DROP POLICY IF EXISTS "Org members read comments" ON comments;
DROP POLICY IF EXISTS "Org members create comments" ON comments;
DROP POLICY IF EXISTS "Authors update own comments" ON comments;
DROP POLICY IF EXISTS "Admins delete org comments" ON comments;

-- notifications
DROP POLICY IF EXISTS "Users read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users create notifications" ON notifications;

-- audit_log
DROP POLICY IF EXISTS "Admins read audit log" ON audit_log;


-- ============================================================================
-- STEP 2: SECURITY DEFINER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_profile_display_info(profile_id UUID)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  preferred_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT up.id, up.first_name, up.last_name, up.preferred_name
  FROM user_profiles up
  WHERE up.id = profile_id
  AND up.organization_id = (
    (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'organization_id')::uuid
  );
$$;

GRANT EXECUTE ON FUNCTION get_profile_display_info(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION is_enrolled_in(activity_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrollments
    WHERE activity_id = activity_id_param
    AND student_id = auth.uid()
    AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION is_enrolled_in(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION is_teacher_or_monitor_of(activity_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM activities
    WHERE id = activity_id_param
    AND (teacher_id = auth.uid() OR monitor_id = auth.uid())
    AND organization_id = (
      (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'organization_id')::uuid
    )
  );
$$;

GRANT EXECUTE ON FUNCTION is_teacher_or_monitor_of(UUID) TO authenticated;


-- ============================================================================
-- STEP 3: CREATE ALL POLICIES
-- ============================================================================

-- organizations
CREATE POLICY "Users read own organization"
  ON organizations FOR SELECT
  USING (id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

CREATE POLICY "Admins update own organization"
  ON organizations FOR UPDATE
  USING (id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- user_profiles
CREATE POLICY "Users read own profile"
  ON user_profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users view org profiles"
  ON user_profiles FOR SELECT
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

CREATE POLICY "Users update own profile"
  ON user_profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Admins update org profiles"
  ON user_profiles FOR UPDATE
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- academic_terms
CREATE POLICY "Users read org terms"
  ON academic_terms FOR SELECT
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

CREATE POLICY "Admins manage org terms"
  ON academic_terms FOR ALL
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- schedule_templates
CREATE POLICY "Users read org schedule templates"
  ON schedule_templates FOR SELECT
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

CREATE POLICY "Admins manage org schedule templates"
  ON schedule_templates FOR ALL
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- school_days
CREATE POLICY "Users read org school days"
  ON school_days FOR SELECT
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

CREATE POLICY "Admins manage org school days"
  ON school_days FOR ALL
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- internship_opportunities
CREATE POLICY "Users read org internship opportunities"
  ON internship_opportunities FOR SELECT
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

CREATE POLICY "Admins manage org internship opportunities"
  ON internship_opportunities FOR ALL
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- activities (uses DEFINER functions)
CREATE POLICY "Students read enrolled activities"
  ON activities FOR SELECT USING (is_enrolled_in(id));

CREATE POLICY "Teachers read org activities"
  ON activities FOR SELECT
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'teacher' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

CREATE POLICY "Admins manage org activities"
  ON activities FOR ALL
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- enrollments (uses DEFINER functions)
CREATE POLICY "Students read own enrollments"
  ON enrollments FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers read activity enrollments"
  ON enrollments FOR SELECT USING (is_teacher_or_monitor_of(activity_id));

CREATE POLICY "Admins manage org enrollments"
  ON enrollments FOR ALL
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- activity_instances (uses DEFINER functions)
CREATE POLICY "Students read enrolled activity instances"
  ON activity_instances FOR SELECT USING (is_enrolled_in(activity_id));

CREATE POLICY "Students create enrolled activity instances"
  ON activity_instances FOR INSERT WITH CHECK (is_enrolled_in(activity_id));

CREATE POLICY "Teachers read own activity instances"
  ON activity_instances FOR SELECT USING (is_teacher_or_monitor_of(activity_id));

CREATE POLICY "Teachers create own activity instances"
  ON activity_instances FOR INSERT WITH CHECK (is_teacher_or_monitor_of(activity_id));

CREATE POLICY "Teachers update own activity instances"
  ON activity_instances FOR UPDATE USING (is_teacher_or_monitor_of(activity_id));

CREATE POLICY "Admins manage org activity instances"
  ON activity_instances FOR ALL
  USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- attendance_records
CREATE POLICY "Students read own attendance"
  ON attendance_records FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Teachers manage own activity attendance"
  ON attendance_records FOR ALL
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances WHERE is_teacher_or_monitor_of(activity_id)));

CREATE POLICY "Admins manage org attendance"
  ON attendance_records FOR ALL
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances
    WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- check_ins
CREATE POLICY "Students manage own check-ins"
  ON check_ins FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students create own check-ins"
  ON check_ins FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own check-ins"
  ON check_ins FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Teachers read own activity check-ins"
  ON check_ins FOR ALL
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances WHERE is_teacher_or_monitor_of(activity_id)));

CREATE POLICY "Admins read org check-ins"
  ON check_ins FOR ALL
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances
    WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- checkin_activity_tags
CREATE POLICY "Students read own checkin tags"
  ON checkin_activity_tags FOR SELECT
  USING (checkin_id IN (SELECT id FROM check_ins WHERE student_id = auth.uid()));

CREATE POLICY "Students create own checkin tags"
  ON checkin_activity_tags FOR INSERT
  WITH CHECK (checkin_id IN (SELECT id FROM check_ins WHERE student_id = auth.uid()));

CREATE POLICY "Teachers read own activity checkin tags"
  ON checkin_activity_tags FOR SELECT
  USING (checkin_id IN (
    SELECT ci.id FROM check_ins ci
    JOIN activity_instances ai ON ai.id = ci.activity_instance_id
    WHERE is_teacher_or_monitor_of(ai.activity_id)));

CREATE POLICY "Admins read org checkin tags"
  ON checkin_activity_tags FOR SELECT
  USING (checkin_id IN (
    SELECT ci.id FROM check_ins ci
    JOIN activity_instances ai ON ai.id = ci.activity_instance_id
    WHERE ai.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- presence_waves
CREATE POLICY "Students read own waves"
  ON presence_waves FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students create own waves"
  ON presence_waves FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers read own activity waves"
  ON presence_waves FOR SELECT
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances WHERE is_teacher_or_monitor_of(activity_id)));

CREATE POLICY "Admins read org waves"
  ON presence_waves FOR SELECT
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances
    WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- status_updates
CREATE POLICY "Students read own status updates"
  ON status_updates FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students create own status updates"
  ON status_updates FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own status updates"
  ON status_updates FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Teachers read own activity status updates"
  ON status_updates FOR SELECT
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances WHERE is_teacher_or_monitor_of(activity_id)));

CREATE POLICY "Admins read org status updates"
  ON status_updates FOR SELECT
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances
    WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- posts
CREATE POLICY "Students read enrolled activity posts"
  ON posts FOR SELECT
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances WHERE is_enrolled_in(activity_id)));

CREATE POLICY "Teachers manage own activity posts"
  ON posts FOR ALL
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances WHERE is_teacher_or_monitor_of(activity_id)));

CREATE POLICY "Authors update own posts"
  ON posts FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Admins manage org posts"
  ON posts FOR ALL
  USING (activity_instance_id IN (
    SELECT id FROM activity_instances
    WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- post_responses
CREATE POLICY "Students manage own post responses"
  ON post_responses FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students create own post responses"
  ON post_responses FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own post responses"
  ON post_responses FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Teachers read own activity post responses"
  ON post_responses FOR SELECT
  USING (post_id IN (
    SELECT p.id FROM posts p
    JOIN activity_instances ai ON ai.id = p.activity_instance_id
    WHERE is_teacher_or_monitor_of(ai.activity_id)));

CREATE POLICY "Admins read org post responses"
  ON post_responses FOR SELECT
  USING (post_id IN (
    SELECT p.id FROM posts p
    JOIN activity_instances ai ON ai.id = p.activity_instance_id
    WHERE ai.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- comments (MVP: org-scoped read)
CREATE POLICY "Org members read comments"
  ON comments FOR SELECT
  USING (
    (post_id IS NOT NULL AND post_id IN (
      SELECT p.id FROM posts p JOIN activity_instances ai ON ai.id = p.activity_instance_id
      WHERE ai.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)))
    OR (post_response_id IS NOT NULL AND post_response_id IN (
      SELECT pr.id FROM post_responses pr JOIN posts p ON p.id = pr.post_id
      JOIN activity_instances ai ON ai.id = p.activity_instance_id
      WHERE ai.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)))
    OR (status_update_id IS NOT NULL AND status_update_id IN (
      SELECT su.id FROM status_updates su JOIN activity_instances ai ON ai.id = su.activity_instance_id
      WHERE ai.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)))
  );

CREATE POLICY "Org members create comments"
  ON comments FOR INSERT
  WITH CHECK (author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()
      AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

CREATE POLICY "Authors update own comments"
  ON comments FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Admins delete org comments"
  ON comments FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- notifications
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Authenticated users create notifications"
  ON notifications FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- audit_log
CREATE POLICY "Admins read audit log"
  ON audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND 'admin' = ANY(roles)
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));