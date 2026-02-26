-- Here App - Phase 4: Social Layer, Notifications, Audit, RLS & Indexes
-- Created: February 25, 2026
-- Description: Posts, responses, status updates, comments, notifications,
--              audit log, RLS policies, and cross-table performance indexes.
--              Run after 20260225000003_phase3_attendance.sql.

-- ============================================================================
-- STATUS UPDATES (must be created before comments due to FK reference)
-- ============================================================================

CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  checkin_id UUID REFERENCES check_ins(id),
  -- set when created during check-in/out flow, null otherwise

  status_type TEXT NOT NULL CHECK (status_type IN ('plans', 'progress', 'reflection')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_updates_student ON status_updates(student_id);
CREATE INDEX idx_status_updates_instance ON status_updates(activity_instance_id);
CREATE INDEX idx_status_updates_checkin ON status_updates(checkin_id);
CREATE INDEX idx_status_updates_type ON status_updates(activity_instance_id, status_type);

-- ============================================================================
-- POSTS
-- ============================================================================

CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_instance_id UUID NOT NULL REFERENCES activity_instances(id) ON DELETE CASCADE,
  icon TEXT,      -- emoji chosen by teacher
  content TEXT NOT NULL,
  requires_response BOOLEAN DEFAULT false,
  response_type TEXT CHECK (response_type IN ('text', 'single_select', 'multi_select')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_posts_instance ON posts(activity_instance_id);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_instance_created ON posts(activity_instance_id, created_at DESC);

-- ============================================================================
-- POST RESPONSES
-- ============================================================================

CREATE TABLE post_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_response UNIQUE (post_id, student_id)
);

CREATE INDEX idx_post_responses_post ON post_responses(post_id);
CREATE INDEX idx_post_responses_student ON post_responses(student_id);

-- ============================================================================
-- COMMENTS (references posts, post_responses, and status_updates)
-- ============================================================================

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Exactly one of these must be set
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  post_response_id UUID REFERENCES post_responses(id) ON DELETE CASCADE,
  status_update_id UUID REFERENCES status_updates(id) ON DELETE CASCADE,

  thread_parent_id UUID REFERENCES comments(id),

  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT exactly_one_parent CHECK (
    num_nonnulls(post_id, post_response_id, status_update_id) = 1
  )
);

CREATE INDEX idx_comments_post ON comments(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_comments_post_response ON comments(post_response_id) WHERE post_response_id IS NOT NULL;
CREATE INDEX idx_comments_status_update ON comments(status_update_id) WHERE status_update_id IS NOT NULL;
CREATE INDEX idx_comments_thread ON comments(thread_parent_id);
CREATE INDEX idx_comments_author ON comments(author_id);

-- ============================================================================
-- NOTIFICATIONS (references posts, post_responses, status_updates, check_ins)
-- ============================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'teacher_comment',
    'post_created',
    'response_required',
    'checkin_reminder',
    'schedule_change'
  )),

  -- At most one of these may be set; NULL for all = notification not tied to a specific record
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  post_response_id UUID REFERENCES post_responses(id) ON DELETE CASCADE,
  status_update_id UUID REFERENCES status_updates(id) ON DELETE CASCADE,
  check_in_id UUID REFERENCES check_ins(id) ON DELETE CASCADE,

  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT at_most_one_related CHECK (
    num_nonnulls(post_id, post_response_id, status_update_id, check_in_id) <= 1
  )
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_post ON notifications(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_notifications_post_response ON notifications(post_response_id) WHERE post_response_id IS NOT NULL;
CREATE INDEX idx_notifications_status_update ON notifications(status_update_id) WHERE status_update_id IS NOT NULL;
CREATE INDEX idx_notifications_check_in ON notifications(check_in_id) WHERE check_in_id IS NOT NULL;

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'soft_deleted')),
  changed_by UUID REFERENCES user_profiles(id),
  change_summary TEXT,
  changes JSONB, -- {"old": {...}, "new": {...}}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_by ON audit_log(changed_by);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Starter policies for MVP. See schema docs (10-rls-policies.md) for notes.
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE internship_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_activity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view profiles in their org
CREATE POLICY "Users view org profiles"
  ON user_profiles FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_profiles WHERE id = auth.uid()
  ));

-- Students read own enrollments
CREATE POLICY "Students read own enrollments"
  ON enrollments FOR SELECT
  USING (student_id = auth.uid());

-- Teachers read all activities in org
CREATE POLICY "Teachers read activities"
  ON activities FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_profiles
    WHERE id = auth.uid() AND 'teacher' = ANY(roles)
  ));

-- Teachers manage attendance
CREATE POLICY "Teachers manage attendance"
  ON attendance_records FOR ALL
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND 'teacher' = ANY(roles)
  ));

-- Students create own check-ins
CREATE POLICY "Students create own check-ins"
  ON check_ins FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- Admins full access to org data
CREATE POLICY "Admins full access"
  ON activities FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM user_profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  ));

-- ============================================================================
-- CROSS-TABLE PERFORMANCE INDEXES
-- Table-specific indexes are defined with their respective tables above.
-- ============================================================================

-- Scheduled activities lookup
CREATE INDEX idx_activities_schedule_lookup
  ON activities(organization_id, is_active, block)
  WHERE is_active = true;

-- Not-scheduled activities (for freeform tagging)
CREATE INDEX idx_activities_not_scheduled
  ON activities(organization_id, is_active)
  WHERE is_active = true AND is_not_scheduled = true;

-- Needs-scheduling list
CREATE INDEX idx_activities_needs_scheduling
  ON activities(organization_id, is_active, is_not_scheduled, is_release)
  WHERE is_active = true AND is_not_scheduled = false AND is_release = false;

-- Active enrollments for roster queries
CREATE INDEX idx_enrollments_activity_active
  ON enrollments(activity_id, is_active)
  WHERE is_active = true;

-- Rotation-based activities
CREATE INDEX idx_activities_rotation
  ON activities(organization_id, rotation_day_type)
  WHERE rotation_day_type IS NOT NULL;
