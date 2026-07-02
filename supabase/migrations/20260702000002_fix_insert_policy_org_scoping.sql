-- Migration: Fix INSERT policy org-scoping gaps
-- Description: Six INSERT policies checked row ownership (student_id/author_id
-- = auth.uid()) but never verified the parent record they attach to belongs to
-- the caller's own organization. This is not reachable through the app's own
-- UI, but any authenticated user could exploit it via a direct Supabase REST
-- call -- writing check-ins, status updates, comments, or notifications
-- against another org's activities/posts/users given a guessed or obtained
-- UUID. Fixed using the same get_my_organization_id() pattern already used
-- throughout the RLS policy set (see docs/schema/10-rls-policies.md).

-- ── check_ins ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Students create own check-ins" ON public.check_ins;
CREATE POLICY "Students create own check-ins" ON public.check_ins
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE organization_id = public.get_my_organization_id()
    )
  );

-- ── presence_waves ───────────────────────────────────────────

DROP POLICY IF EXISTS "Students create own waves" ON public.presence_waves;
CREATE POLICY "Students create own waves" ON public.presence_waves
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE organization_id = public.get_my_organization_id()
    )
  );

-- ── status_updates ───────────────────────────────────────────

DROP POLICY IF EXISTS "Students create own status updates" ON public.status_updates;
CREATE POLICY "Students create own status updates" ON public.status_updates
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE organization_id = public.get_my_organization_id()
    )
  );

-- ── post_responses ───────────────────────────────────────────

DROP POLICY IF EXISTS "Students create own post responses" ON public.post_responses;
CREATE POLICY "Students create own post responses" ON public.post_responses
  FOR INSERT WITH CHECK (
    student_id = auth.uid()
    AND post_id IN (
      SELECT p.id FROM posts p
      JOIN activity_instances ai ON ai.id = p.activity_instance_id
      WHERE ai.organization_id = public.get_my_organization_id()
    )
  );

-- ── comments ─────────────────────────────────────────────────
-- Mirrors the org-scoping already used in "Org members read comments".

DROP POLICY IF EXISTS "Org members create comments" ON public.comments;
CREATE POLICY "Org members create comments" ON public.comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND (
      (post_id IS NOT NULL AND post_id IN (
        SELECT p.id FROM posts p
        JOIN activity_instances ai ON ai.id = p.activity_instance_id
        WHERE ai.organization_id = public.get_my_organization_id()
      ))
      OR (post_response_id IS NOT NULL AND post_response_id IN (
        SELECT pr.id FROM post_responses pr
        JOIN posts p ON p.id = pr.post_id
        JOIN activity_instances ai ON ai.id = p.activity_instance_id
        WHERE ai.organization_id = public.get_my_organization_id()
      ))
      OR (status_update_id IS NOT NULL AND status_update_id IN (
        SELECT su.id FROM status_updates su
        JOIN activity_instances ai ON ai.id = su.activity_instance_id
        WHERE ai.organization_id = public.get_my_organization_id()
      ))
    )
  );

-- ── notifications ────────────────────────────────────────────
-- No organization_id column on this table -- verify the recipient (user_id)
-- belongs to the same org as the inserting user via user_profiles instead.

DROP POLICY IF EXISTS "Authenticated users create notifications" ON public.notifications;
CREATE POLICY "Authenticated users create notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles recipient
      WHERE recipient.id = notifications.user_id
        AND recipient.organization_id = public.get_my_organization_id()
    )
  );
