
-- ============================================================
-- Replace all RLS policies that reference user_metadata
-- with joins against user_profiles (server-controlled source)
-- ============================================================

-- Helper: current user's org_id via user_profiles
-- Usage: (SELECT organization_id FROM user_profiles WHERE id = auth.uid())

-- ── organizations ────────────────────────────────────────────

DROP POLICY IF EXISTS "Users read own organization" ON public.organizations;
CREATE POLICY "Users read own organization" ON public.organizations
  FOR SELECT USING (
    id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins update own organization" ON public.organizations;
CREATE POLICY "Admins update own organization" ON public.organizations
  FOR UPDATE USING (
    id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND organization_id = organizations.id
    )
  );

-- ── user_profiles ────────────────────────────────────────────

DROP POLICY IF EXISTS "Users view org profiles" ON public.user_profiles;
CREATE POLICY "Users view org profiles" ON public.user_profiles
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins update org profiles" ON public.user_profiles;
CREATE POLICY "Admins update org profiles" ON public.user_profiles
  FOR UPDATE USING (
    organization_id = (SELECT organization_id FROM user_profiles up WHERE up.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles up2
      WHERE up2.id = auth.uid()
        AND 'admin' = ANY(up2.roles)
        AND up2.organization_id = user_profiles.organization_id
    )
  );

-- ── academic_terms ───────────────────────────────────────────

DROP POLICY IF EXISTS "Users read org terms" ON public.academic_terms;
CREATE POLICY "Users read org terms" ON public.academic_terms
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage org terms" ON public.academic_terms;
CREATE POLICY "Admins manage org terms" ON public.academic_terms
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND organization_id = academic_terms.organization_id
    )
  );

-- ── schedule_templates ───────────────────────────────────────

DROP POLICY IF EXISTS "Users read org schedule templates" ON public.schedule_templates;
CREATE POLICY "Users read org schedule templates" ON public.schedule_templates
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage org schedule templates" ON public.schedule_templates;
CREATE POLICY "Admins manage org schedule templates" ON public.schedule_templates
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND organization_id = schedule_templates.organization_id
    )
  );

-- ── school_days ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Users read org school days" ON public.school_days;
CREATE POLICY "Users read org school days" ON public.school_days
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage org school days" ON public.school_days;
CREATE POLICY "Admins manage org school days" ON public.school_days
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND organization_id = school_days.organization_id
    )
  );

-- ── internship_opportunities ─────────────────────────────────

DROP POLICY IF EXISTS "Users read org internship opportunities" ON public.internship_opportunities;
CREATE POLICY "Users read org internship opportunities" ON public.internship_opportunities
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage org internship opportunities" ON public.internship_opportunities;
CREATE POLICY "Admins manage org internship opportunities" ON public.internship_opportunities
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND organization_id = internship_opportunities.organization_id
    )
  );

-- ── activities ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Teachers read org activities" ON public.activities;
CREATE POLICY "Teachers read org activities" ON public.activities
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'teacher' = ANY(roles)
        AND organization_id = activities.organization_id
    )
  );

DROP POLICY IF EXISTS "Admins manage org activities" ON public.activities;
CREATE POLICY "Admins manage org activities" ON public.activities
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND organization_id = activities.organization_id
    )
  );

-- ── enrollments ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage org enrollments" ON public.enrollments;
CREATE POLICY "Admins manage org enrollments" ON public.enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND organization_id = (
          SELECT organization_id FROM activities WHERE id = enrollments.activity_id
        )
    )
  );

-- ── activity_instances ───────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage org activity instances" ON public.activity_instances;
CREATE POLICY "Admins manage org activity instances" ON public.activity_instances
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND organization_id = activity_instances.organization_id
    )
  );

-- ── attendance_records ───────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage org attendance" ON public.attendance_records;
CREATE POLICY "Admins manage org attendance" ON public.attendance_records
  FOR ALL USING (
    activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- ── check_ins ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins read org check-ins" ON public.check_ins;
CREATE POLICY "Admins read org check-ins" ON public.check_ins
  FOR ALL USING (
    activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- ── checkin_activity_tags ────────────────────────────────────

DROP POLICY IF EXISTS "Admins read org checkin tags" ON public.checkin_activity_tags;
CREATE POLICY "Admins read org checkin tags" ON public.checkin_activity_tags
  FOR SELECT USING (
    checkin_id IN (
      SELECT ci.id
      FROM check_ins ci
      JOIN activity_instances ai ON ai.id = ci.activity_instance_id
      WHERE ai.organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- ── presence_waves ───────────────────────────────────────────

DROP POLICY IF EXISTS "Admins read org waves" ON public.presence_waves;
CREATE POLICY "Admins read org waves" ON public.presence_waves
  FOR SELECT USING (
    activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- ── status_updates ───────────────────────────────────────────

DROP POLICY IF EXISTS "Admins read org status updates" ON public.status_updates;
CREATE POLICY "Admins read org status updates" ON public.status_updates
  FOR SELECT USING (
    activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- ── posts ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage org posts" ON public.posts;
CREATE POLICY "Admins manage org posts" ON public.posts
  FOR ALL USING (
    activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- ── post_responses ───────────────────────────────────────────

DROP POLICY IF EXISTS "Admins read org post responses" ON public.post_responses;
CREATE POLICY "Admins read org post responses" ON public.post_responses
  FOR SELECT USING (
    post_id IN (
      SELECT p.id
      FROM posts p
      JOIN activity_instances ai ON ai.id = p.activity_instance_id
      WHERE ai.organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- ── comments ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Org members read comments" ON public.comments;
CREATE POLICY "Org members read comments" ON public.comments
  FOR SELECT USING (
    (
      post_id IS NOT NULL AND post_id IN (
        SELECT p.id FROM posts p
        JOIN activity_instances ai ON ai.id = p.activity_instance_id
        WHERE ai.organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
      )
    ) OR (
      post_response_id IS NOT NULL AND post_response_id IN (
        SELECT pr.id FROM post_responses pr
        JOIN posts p ON p.id = pr.post_id
        JOIN activity_instances ai ON ai.id = p.activity_instance_id
        WHERE ai.organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
      )
    ) OR (
      status_update_id IS NOT NULL AND status_update_id IN (
        SELECT su.id FROM status_updates su
        JOIN activity_instances ai ON ai.id = su.activity_instance_id
        WHERE ai.organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Org members create comments" ON public.comments;
CREATE POLICY "Org members create comments" ON public.comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND organization_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Admins delete org comments" ON public.comments;
CREATE POLICY "Admins delete org comments" ON public.comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
    )
  );

-- ── notifications ────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users create notifications" ON public.notifications;
CREATE POLICY "Authenticated users create notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND organization_id IS NOT NULL
    )
  );

-- ── audit_log ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins read audit log" ON public.audit_log;
CREATE POLICY "Admins read audit log" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
    )
  );

-- ── calendars ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users read org calendars" ON public.calendars;
CREATE POLICY "Users read org calendars" ON public.calendars
  FOR SELECT USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage org calendars" ON public.calendars;
CREATE POLICY "Admins manage org calendars" ON public.calendars
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM user_profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND 'admin' = ANY(roles)
        AND organization_id = calendars.organization_id
    )
  );
;