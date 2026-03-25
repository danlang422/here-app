# Session 16 — March 24, 2026

## 16.1 — Feedback System Design & Linear Access

**What happened:** Design session. Discussed the need for in-app bug reporting ahead of user testing, settled key decisions, and produced `user-feedback-system-build-spec.md`. Also resolved Claude's issue access strategy.

### Decisions

| Decision | Rationale |
|----------|-----------|
| Help page (`/help`) as the home for feedback, not a nav button | The page will eventually hold tutorials, FAQs, etc. — not just a button. Gives the feature a natural home and keeps the nav clean. |
| Three report types: bug, schedule issue, feedback | Covers the realistic range for a school app. Schedule issues are uniquely valuable here — students can flag bad data directly. |
| File picker for screenshots, not auto-capture | Auto-capture was considered but adds complexity. City View students are proficient at taking and sharing screenshots. Can always add later. |
| Linear API for issue creation, not GitHub directly | Linear handles inline image attachments more gracefully. Issues sync to GitHub automatically anyway. |
| Local `feedback_reports` table in Supabase | Safety net if Linear API fails; foundation for future "my reports" view and admin triage. Low incremental complexity. |
| Edge Function handles everything | Client sends raw payload; function handles DB insert, screenshot upload, and Linear call. Keeps the Linear API key off the client. |

### Claude issue access: Linear MCP

GitHub issue fetching from Claude.ai (established in session 11) was unreliable beyond page 1. Resolved by syncing GitHub Issues 2-way with Linear and enabling the Linear MCP integration in Claude Desktop. Claude.ai now has reliable issue access via MCP. Claude Code retains GitHub access via GitHub Actions.

### Artifacts

- `docs/user-flows/user-feedback-system-build-spec.md` — Build spec (status: ready to build)
- `supabase/migrations/20260324000000_feedback_reports.sql` — Table, indexes, RLS policies, storage bucket

### Pre-build setup (completed by Daniel)

- `user-bug`, `schedule-issue`, `user-feedback` labels created in Linear
- `feedback_reports` migration run
- Linear personal API key created
- Supabase secrets set: `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, `LINEAR_LABEL_BUG`, `LINEAR_LABEL_SCHEDULE`, `LINEAR_LABEL_FEEDBACK`

---

## 16.2 — Feedback System Build & Debugging

**What happened:** Claude Code implemented the full feature from the spec. Testing revealed a persistent 401 error on the Edge Function that required a debugging session to resolve. The root cause was a Supabase infrastructure change, not a code bug.

### What was built (Claude Code)

**New files:**
- `src/pages/HelpPage.jsx` — Help Center shell with feedback CTA and placeholder FAQ section
- `src/components/feedback/FeedbackModal.jsx` — Two-step modal: type selection → type-specific form; manages its own step/form/submission state
- `src/components/feedback/BugReportForm.jsx` — Description + expected behavior fields + screenshot picker
- `src/components/feedback/ScheduleIssueForm.jsx` — Activity selector (role-aware: dropdown for students/teachers, freeform for admins) + description + screenshot picker
- `src/components/feedback/FeedbackForm.jsx` — Single description textarea
- `src/components/feedback/ScreenshotPicker.jsx` — File input with type/size validation and thumbnail preview
- `src/api/feedback.js` — `submitFeedback()` and `fileToBase64()` client functions
- `supabase/functions/submit-feedback/index.ts` — Edge Function: auth verification, DB insert, screenshot upload, Linear issue creation

**Modified files:**
- `src/App.jsx` — `/help` route added
- `src/components/layout/AppLayout.jsx` — Help icon added to navbar (all roles)

### Debugging: Edge Function 401

All submissions returned 401 with `execution_id: null` in the Supabase function logs — meaning the edge runtime rejected requests before the function code ran at all. Went through several theories (stale session token, missing apikey header, wrong invoke method) before identifying the real cause.

**Root cause:** Supabase migrated to a new API key format (`sb_publishable_...`) that is not a JWT. The edge runtime's built-in JWT verification layer cannot validate this format — it expects a JWT but receives the publishable key as an opaque identifier. The runtime rejects the combination at the platform level before the function wakes up.

This affects all Edge Functions on new Supabase projects. `create-user` had been working because it was deployed before the key format migration; redeploying it confirmed it broke under the same conditions.

**The fix:** Deploy Edge Functions with `--no-verify-jwt` to bypass the platform-level check, and handle auth manually inside the function — which `submit-feedback` already did correctly throughout. This is documented Supabase behavior for projects on the new API key system, not a workaround.

**`supabase/config.toml` created** to persist the setting in version control:
```toml
[functions.submit-feedback]
verify_jwt = false

[functions.create-user]
verify_jwt = false
```

Any new Edge Function serving authenticated users needs a matching entry here.

### Decisions

| Decision | Rationale |
|----------|-----------|
| `--no-verify-jwt` + manual auth in function | New publishable keys (`sb_publishable_...`) aren't JWTs; platform JWT check can't validate them. Function already verifies the caller's JWT manually — equivalent security. |
| `config.toml` for function settings | Persists deploy config in version control. Prevents silent resets when Claude Code redeploys without the flag. |
| `supabase.functions.invoke()` over raw `fetch()` in client | Automatically attaches both `apikey` and `Authorization` headers. Raw `fetch()` requires manual `apikey` header, which is easy to miss and was part of the debugging confusion. |

### Artifacts

- `supabase/config.toml` — Function configuration (new file; should be committed)
- `supabase/functions/submit-feedback/index.ts` — Edge Function
- `src/api/feedback.js` — Updated to use `supabase.functions.invoke()`