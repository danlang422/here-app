-- Migration: activity_staff junction table (#70, Phase 2)
-- Replaces activities.teacher_id / monitor_id with a junction table that
-- supports multiple staff per activity with a role distinction.
-- All steps run in one transaction: copy → verify → repoint function → drop columns.

-- ── 1. Create the table ──────────────────────────────────────────────────────

CREATE TABLE activity_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'monitor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_activity_user UNIQUE (activity_id, user_id)
);

CREATE INDEX idx_activity_staff_activity ON activity_staff(activity_id);
CREATE INDEX idx_activity_staff_user ON activity_staff(user_id);
CREATE INDEX idx_activity_staff_user_role ON activity_staff(user_id, role);

-- ── 2. Grants + RLS enable ───────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_staff TO authenticated;
GRANT ALL ON public.activity_staff TO service_role;
ALTER TABLE public.activity_staff ENABLE ROW LEVEL SECURITY;

-- ── 3. Migrate existing data ─────────────────────────────────────────────────

INSERT INTO activity_staff (activity_id, user_id, role)
SELECT id, teacher_id, 'teacher'
FROM activities
WHERE teacher_id IS NOT NULL;

INSERT INTO activity_staff (activity_id, user_id, role)
SELECT id, monitor_id, 'monitor'
FROM activities
WHERE monitor_id IS NOT NULL;

-- ── 4. Verify before dropping (aborts transaction on mismatch) ───────────────

DO $$
DECLARE
  expected INTEGER;
  actual INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM activities WHERE teacher_id IS NOT NULL)
    + (SELECT COUNT(*) FROM activities WHERE monitor_id IS NOT NULL)
  INTO expected;

  SELECT COUNT(*) FROM activity_staff INTO actual;

  IF actual <> expected THEN
    RAISE EXCEPTION 'activity_staff migration mismatch: expected %, got %', expected, actual;
  END IF;
END $$;

-- ── 5. Repoint is_teacher_or_monitor_of to query activity_staff ──────────────
-- NOTE: intentionally NOT renamed to is_staff_of (see #70 build spec).
-- Renaming would require dropping and recreating all ~9 dependent policies,
-- which caused the session-36 recursion bugs. Body repointed; name kept.
-- STABLE is preserved so the planner can cache calls within a single query.

CREATE OR REPLACE FUNCTION public.is_teacher_or_monitor_of(activity_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM activity_staff s
    JOIN user_profiles up ON up.id = auth.uid()
    JOIN activities a ON a.id = s.activity_id
    WHERE s.activity_id = activity_id_param
      AND s.user_id = auth.uid()
      AND a.organization_id = up.organization_id
  );
$$;

-- ── 6. RLS policies on activity_staff ───────────────────────────────────────

-- Students: can read staff rows for activities they are enrolled in
CREATE POLICY "Students read staff of enrolled activities"
  ON activity_staff FOR SELECT
  USING (public.is_enrolled_in(activity_id));

-- Teachers: can read staff rows for activities they are staff on
CREATE POLICY "Teachers read staff of own activities"
  ON activity_staff FOR SELECT
  USING (public.is_teacher_or_monitor_of(activity_id));

-- Teachers: can read staff rows for visible-to-all activities
CREATE POLICY "Teachers read staff of visible-to-all activities"
  ON activity_staff FOR SELECT
  USING (public.activity_is_visible_to_all(activity_id));

-- Admins: full control over staff rows in their org
CREATE POLICY "Admins manage staff in org"
  ON activity_staff FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE a.id = activity_staff.activity_id
        AND a.organization_id = up.organization_id
        AND 'admin' = ANY(up.roles)
    )
  );

-- ── 7. Drop old columns + indexes ────────────────────────────────────────────

DROP INDEX IF EXISTS idx_activities_teacher;
DROP INDEX IF EXISTS idx_activities_monitor;

ALTER TABLE activities DROP COLUMN teacher_id;
ALTER TABLE activities DROP COLUMN monitor_id;
