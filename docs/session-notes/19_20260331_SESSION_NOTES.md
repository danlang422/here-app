# Session 19 — March 31, 2026

## 19.1 — Replace Linear with GitHub Issues in submit-feedback Edge Function

**What happened:** The `submit-feedback` Edge Function was switched from posting to Linear's GraphQL API to posting directly to the GitHub REST API. The `feedback_reports` table was migrated to track GitHub issue numbers/URLs instead of Linear IDs. All Linear secrets were removed from Supabase.

**Branch:** `feat/feedback-github-integration`

---

### What was built

#### 1. Edge Function rewrite (`supabase/functions/submit-feedback/index.ts`)

Step 3 of the function was rewritten. Previously it called Linear's GraphQL API to create an issue. Now it POSTs to the GitHub REST API (`POST /repos/{owner}/{repo}/issues`). Behavior:

- Reads `GITHUB_PAT` and `GITHUB_REPO` env vars from Supabase secrets.
- Builds the same title/body structure as before.
- Applies two labels per issue: `status: user-submitted` plus one of `type: bug`, `type: feedback`, or `type: schedule-issue` depending on the feedback type submitted.
- On success, stores `github_issue_number` (integer) and `github_issue_url` (text) in the `feedback_reports` row.
- Returns `github_synced: true` in the response (replaces the former `linear_synced` field).

#### 2. Database migration (`supabase/migrations/20260331000000_feedback_github_tracking.sql`)

Renames columns on `feedback_reports`:
- `linear_issue_id` (TEXT) → `github_issue_number` (INTEGER)
- `linear_issue_url` (TEXT) → `github_issue_url` (TEXT)

Migration was applied to remote.

#### 3. Secret rotation

Removed from Supabase: `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, `LINEAR_LABEL_BUG`, `LINEAR_LABEL_SCHEDULE`, `LINEAR_LABEL_FEEDBACK`.

Added to Supabase: `GITHUB_PAT`, `GITHUB_REPO`.

---

### Key decisions

| Decision | Rationale |
|----------|-----------|
| Switch to GitHub Issues, not Linear | Issue tracking is already in GitHub. The Linear sync was an extra integration layer with no additional value. Removing it reduces operational complexity (fewer secrets, no dependency on a third-party service). |
| Column type change: `linear_issue_id` TEXT → `github_issue_number` INTEGER | GitHub issue numbers are always integers. Storing them typed correctly makes queries and comparisons cleaner. |
| Labels applied at issue creation | Preserves the original design intent of categorizing submissions by type so issues are triageable without opening each one. |

---

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/submit-feedback/index.ts` | Step 3 rewritten: Linear GraphQL → GitHub REST API |
| `supabase/migrations/20260331000000_feedback_github_tracking.sql` | Rename `linear_issue_id`/`linear_issue_url` → `github_issue_number`/`github_issue_url`; type change on issue number column |

---

### What's ready for the next session

- Feedback submission is fully functional end-to-end with GitHub Issues. All user types tested and working.
- No frontend changes were needed — the response shape change (`github_synced` vs `linear_synced`) is not consumed by any UI component.
- Next candidates remain unchanged from session 18: Layer 3 calendar (if scoped), student-centric enrollment (Entry B, Issue #7), or student schedule view (pending decisions).
