ALTER TABLE feedback_reports
  RENAME COLUMN linear_issue_id TO github_issue_number;

ALTER TABLE feedback_reports
  RENAME COLUMN linear_issue_url TO github_issue_url;

ALTER TABLE feedback_reports
  ALTER COLUMN github_issue_number TYPE INTEGER USING NULL;
