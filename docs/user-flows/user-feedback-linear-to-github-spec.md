## Spec: Replace Linear with GitHub Issues in submit-feedback
### Context
The `submit-feedback` Edge Function currently saves feedback to a local `feedback_reports` table, then creates a Linear issue as a side effect. We're removing Linear entirely and replacing it with direct GitHub issue creation. The function structure stays the same — only Step 3 changes.
Labels to create in GitHub first (do this before running Claude Code)
You need to create these three labels in the here-app repo before the function can apply them:

`type: bug` — done
`type: feedback` - done
`type: schedule-issue` - done
`status: user-submitted` - done

### Changes required
1. **Edge Function** — supabase/functions/submit-feedback/index.ts
Replace Step 3 entirely. The new logic:

Read a new env var `GITHUB_PAT` (fine-grained token with issues:write on here-app)
Read `GITHUB_REPO` = `"danlang422/here-app"` (can be hardcoded or env var)
Build the issue title using the same existing logic (keep the `[Bug]`, `[Schedule]`, `[Feedback]` prefixes)
Build the same markdown body as before — the screenshot handling is already solved since `screenshotUrl` is a public Supabase Storage URL that GitHub can render inline with `![screenshot](url)` — no changes needed there
Apply labels: always include `"status: user-submitted"` plus one of `"type: bug"`, `"type: feedback"`, or `"type: schedule-issue"` based on `report_type`
POST to `https://api.github.com/repos/danlang422/here-app/issues` with:

  ```
  Authorization: Bearer <GITHUB_PAT>
  Accept: application/vnd.github+json
  X-GitHub-Api-Version: 2022-11-28
  ```
Body: `{ title, body, labels: [...] }`

On success, store the returned `html_url` and `number` in the DB (see migration below)
On failure, log a warning but don't fail the overall request (same pattern as current Linear error handling)
Return `github_synced: true/false` instead of `linear_synced: true/false`

2. Migration — rename Linear columns
Create a new migration `20260331000000_feedback_github_tracking.sql`:
```sql
ALTER TABLE feedback_reports
  RENAME COLUMN linear_issue_id TO github_issue_number;

ALTER TABLE feedback_reports
  RENAME COLUMN linear_issue_url TO github_issue_url;

ALTER TABLE feedback_reports
  ALTER COLUMN github_issue_number TYPE INTEGER USING NULL;
  ```
The column rename keeps the existing data intact (all currently null anyway) and changes the type from `TEXT` to `INTEGER` to match GitHub's issue number format.
3. Env vars — Supabase secrets
Add via `supabase secrets set`:

`GITHUB_PAT` — the fine-grained PAT (issues:write on here-app)

Remove (can be done after confirming everything works):

- `LINEAR_API_KEY`
- `LINEAR_TEAM_ID`
- `LINEAR_LABEL_BUG`
- `LINEAR_LABEL_SCHEDULE`
- `LINEAR_LABEL_FEEDBACK`

4. No frontend changes needed — the function's request/response interface is unchanged. The frontend sends the same payload and gets back `{ success, report_id }`. The linear_synced field in the response becomes `github_synced` but the frontend doesn't currently use that field.