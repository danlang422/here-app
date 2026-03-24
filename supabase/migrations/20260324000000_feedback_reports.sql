-- Feedback reports table
CREATE TABLE feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('bug', 'schedule_issue', 'feedback')),
  
  -- Common fields
  description TEXT NOT NULL,
  screenshot_url TEXT,
  
  -- Bug-specific
  expected_behavior TEXT,
  
  -- Schedule-issue-specific
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  activity_name_text TEXT,  -- fallback when activity_id is null or freeform entry
  
  -- Auto-captured context
  page_route TEXT,
  user_agent TEXT,
  screen_size TEXT,
  user_role TEXT,
  
  -- External tracking
  linear_issue_id TEXT,
  linear_issue_url TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'resolved', 'closed')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by org and status
CREATE INDEX idx_feedback_reports_org_status 
  ON feedback_reports(organization_id, status);

-- Index for querying by user (future "my reports" view)
CREATE INDEX idx_feedback_reports_user 
  ON feedback_reports(user_id, created_at DESC);

-- RLS policies
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can insert their own reports
CREATE POLICY "Users can create own feedback reports"
  ON feedback_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own reports (for future "my reports" view)
CREATE POLICY "Users can read own feedback reports"
  ON feedback_reports FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all reports in their org
CREATE POLICY "Admins can read org feedback reports"
  ON feedback_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.organization_id = feedback_reports.organization_id
        AND 'admin' = ANY(user_profiles.roles)
    )
  );

-- Admins can update report status
CREATE POLICY "Admins can update org feedback reports"
  ON feedback_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.organization_id = feedback_reports.organization_id
        AND 'admin' = ANY(user_profiles.roles)
    )
  );