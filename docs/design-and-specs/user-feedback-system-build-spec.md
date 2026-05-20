# User Feedback System — Build Spec

**Date:** March 23, 2026
**Status:** Built - testing
**Related:** `create-user` Edge Function (pattern reference), `AppLayout.jsx` (nav integration)

**Context:** The app is approaching user testing with real students and teachers at City View. Before that starts, we need a way for all users to report bugs, flag schedule inaccuracies, and submit general feedback. Reports are stored locally in Supabase and forwarded to Linear (synced to GitHub) for triage.

**Design principle:** Make it dead simple to report something. The feedback form should be reachable from anywhere in the app in two taps. For schedule issues specifically, leverage what we already know about the user (their identity, role, enrolled activities) to pre-populate context and reduce friction.

**Scope boundary:** This spec covers the feedback submission flow, the Help page shell, the Supabase Edge Function, the `feedback_reports` table, and Linear issue creation. It does not cover building out help/documentation content, a "my past reports" view, or admin-side report management — those are follow-ups.

---

## Part 1: Help Page & Navigation

### Route: `/help`

A new route accessible to all authenticated users (student, teacher, admin). Lives outside the admin layout — it's a top-level route like `/student` or `/teacher`, wrapped in `AppLayout`.

```jsx
// In App.jsx
<Route path="/help" element={
  <ProtectedRoute>
    <AppLayout>
      <HelpPage />
    </AppLayout>
  </ProtectedRoute>
} />
```

No `requiredRole` — any authenticated user can access it.

### Navigation

Add a Help link to the `AppLayout` navbar, visible to all roles. Place it in the navbar before the role switcher / user menu area.

**Option A (icon button):** A `?` circle icon or `MdHelpOutline` from `react-icons/md`, styled as a `btn btn-ghost btn-circle` matching the existing nav button styling. Navigates to `/help` on click.

**Option B (text link):** A simple "Help" text link in the nav bar. Less prominent but clearer.

Recommend Option A for compactness — the navbar is already busy with role switcher + avatar menu.

### Help Page Content

For now, the page is a shell with a clear heading and the feedback submission button. Future iterations will add help articles, FAQ, screenshots, etc.

```
┌─────────────────────────────────────────────────────┐
│  Help Center                                        │
│                                                     │
│  Need help? Found a bug? Have a suggestion?         │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  📝  Submit Feedback                          │  │
│  │  Report a bug, flag a schedule issue,         │  │
│  │  or share a suggestion.                       │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Frequently Asked Questions                         │
│  (Coming soon)                                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

The "Submit Feedback" card/button opens the `FeedbackModal`. Styled as a prominent card or call-to-action — this is the primary content of the page for now.

### File: `src/pages/HelpPage.jsx`

---

## Part 2: Feedback Modal

### Component: `FeedbackModal`

`src/components/feedback/FeedbackModal.jsx`

A DaisyUI modal with a two-step flow: type selection → type-specific form.

### Step 1: Type Selection

```
┌─────────────────────────────────────────────────────┐
│  What would you like to report?                [✕]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  🐛  Bug Report                             │    │
│  │  Something isn't working right              │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  📅  Schedule Issue                         │    │
│  │  My schedule is wrong or missing something  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  💡  Feedback / Suggestion                  │    │
│  │  An idea or something that could be better  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Each option is a clickable card that advances to step 2 with the selected type.

### Step 2A: Bug Report Form

```
┌─────────────────────────────────────────────────────┐
│  ← Bug Report                                  [✕]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  What happened?                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │                                             │    │
│  │  (textarea, 3-4 rows)                       │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  What were you trying to do?                        │
│  ┌─────────────────────────────────────────────┐    │
│  │  (textarea, 2 rows)                         │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Screenshot (optional)                              │
│  [Choose file]  No file chosen                      │
│                                                     │
│                          [Back]  [Submit]            │
└─────────────────────────────────────────────────────┘
```

**Fields:**
- `description` (required): What happened. Textarea, 10–2000 characters.
- `expected_behavior` (optional): What they were trying to do. Textarea, max 1000 characters.
- `screenshot` (optional): File picker accepting image types (png, jpg, jpeg, gif, webp). Max 5MB. Show a thumbnail preview after selection.

**Auto-captured context (not shown to user):**
- `current_route`: `window.location.pathname`
- `user_agent`: `navigator.userAgent`
- `screen_size`: `${window.innerWidth}x${window.innerHeight}`
- `user_role`: current role from auth store

### Step 2B: Schedule Issue Form

```
┌─────────────────────────────────────────────────────┐
│  ← Schedule Issue                              [✕]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Which activity or block is wrong?                  │
│  ┌─────────────────────────────────────────────┐    │
│  │  ▼ Select an activity (or type to describe) │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  What's wrong with it?                              │
│  ┌─────────────────────────────────────────────┐    │
│  │                                             │    │
│  │  (textarea, 3-4 rows)                       │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Screenshot (optional)                              │
│  [Choose file]  No file chosen                      │
│                                                     │
│                          [Back]  [Submit]            │
└─────────────────────────────────────────────────────┘
```

**Fields:**
- `activity_reference` (optional): Dropdown of the user's enrolled activities (for students) or assigned activities (for teachers). Includes a freeform "Other / not listed" option that reveals a text input. For admin users, this is just a text input since they aren't enrolled in activities.
- `description` (required): What's wrong. Textarea, 10–2000 characters.
- `screenshot` (optional): Same as bug report.

**Activity list source:** For students, query enrollments. For teachers, query activities where they are the assigned instructor. For admins, skip the dropdown entirely — just show a text field labeled "Which activity or block?"

### Step 2C: Feedback / Suggestion Form

```
┌─────────────────────────────────────────────────────┐
│  ← Feedback / Suggestion                      [✕]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  What's on your mind?                               │
│  ┌─────────────────────────────────────────────┐    │
│  │                                             │    │
│  │  (textarea, 4-5 rows)                       │    │
│  │                                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│                          [Back]  [Submit]            │
└─────────────────────────────────────────────────────┘
```

**Fields:**
- `description` (required): Textarea, 10–2000 characters. That's it — keep it lightweight.

No screenshot picker for feedback — if someone wants to show something, they can use bug report instead.

### Submission Flow

1. User fills form and taps Submit
2. Submit button shows loading state (`btn loading`)
3. Client sends payload to the `submit-feedback` Edge Function
4. On success: modal shows a brief success state ("Thanks! We got your report.") for ~2 seconds, then closes
5. On error: show error toast, keep modal open so user doesn't lose their input

### Props

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | boolean | Modal visibility |
| `onClose` | () => void | Close handler |

The modal manages its own internal state (current step, form data, submission status). It reads auth context from the store for user identity and role.

---

## Part 3: Database — `feedback_reports` Table

### Migration: `supabase/migrations/20260324000000_feedback_reports.sql`

```sql
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
```

### Design Notes

- `activity_id` is nullable — only populated for schedule issues where the user selects from the dropdown. If they type freeform text or are an admin, `activity_name_text` captures what they typed.
- `linear_issue_id` and `linear_issue_url` are written by the Edge Function after successful Linear API call. If the Linear call fails, these remain null — the report is still saved locally.
- `status` is for future admin triage UI. Not used in the initial build but cheap to include.
- The `user_id` references `auth.users(id)` directly (not `user_profiles`) — consistent with how `check_ins` and `presence_waves` reference users.

---

## Part 4: Screenshot Handling

### Upload Strategy

Screenshots are uploaded to Supabase Storage, then the public URL is included in the Linear issue.

### Storage Bucket

Create a `feedback-screenshots` bucket in Supabase Storage (via dashboard or migration). Public read access so Linear can display the image. Write access restricted to authenticated users.

```sql
-- In the same migration or via dashboard:
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', true);

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload feedback screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'feedback-screenshots'
    AND auth.role() = 'authenticated'
  );

-- Public read
CREATE POLICY "Public read for feedback screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-screenshots');
```

### Upload Flow

The Edge Function handles the upload:

1. Client sends the image as base64 in the request body
2. Edge Function decodes it, uploads to `feedback-screenshots/{report_id}/{filename}`
3. Gets the public URL back from Supabase Storage
4. Stores the URL in `feedback_reports.screenshot_url`
5. Includes the URL as a markdown image in the Linear issue description

### Client-Side Validation

Before sending to the Edge Function:
- File type must be image (png, jpg, jpeg, gif, webp)
- File size must be ≤ 5MB
- Convert to base64 via `FileReader.readAsDataURL()`

---

## Part 5: Supabase Edge Function — `submit-feedback`

### File: `supabase/functions/submit-feedback/index.ts`

Follows the same pattern as `create-user`: CORS handling, auth verification, request parsing, business logic.

### Request Body

```typescript
interface FeedbackRequest {
  report_type: 'bug' | 'schedule_issue' | 'feedback'
  description: string
  expected_behavior?: string        // bug only
  activity_id?: string              // schedule_issue only
  activity_name_text?: string       // schedule_issue only (freeform)
  screenshot_base64?: string        // base64 encoded image
  screenshot_filename?: string      // original filename
  screenshot_content_type?: string  // mime type
  page_route?: string
  user_agent?: string
  screen_size?: string
  user_role?: string
}
```

### Processing Steps

1. **Authenticate caller** — verify JWT from Authorization header. Any authenticated user is allowed (not admin-restricted).

2. **Look up user profile** — get `organization_id`, `first_name`, `last_name`, `roles` from `user_profiles`.

3. **Insert `feedback_reports` row** — save the report locally first, before attempting Linear. This ensures the report is never lost.

4. **Upload screenshot** (if present) — decode base64, upload to `feedback-screenshots/{report_id}/{filename}` via Supabase Storage, get public URL, update the report row with the URL.

5. **Create Linear issue** — call the Linear API to create an issue with:
   - **Title:** Generated from report type + truncated description
     - Bug: `[Bug] {first 60 chars of description}`
     - Schedule: `[Schedule] {user name}: {first 50 chars of description}`
     - Feedback: `[Feedback] {first 60 chars of description}`
   - **Description:** Markdown-formatted body (see template below)
   - **Label:** `user-bug`, `schedule-issue`, or `user-feedback`
   - **Team ID:** The Danlang422 team ID (configured as env var)
   
6. **Update report row** — save `linear_issue_id` and `linear_issue_url` back to the `feedback_reports` row.

7. **Return response** — `{ success: true, report_id }` on success. If the Linear API call fails, still return success (the report is saved locally) but include `linear_synced: false` in the response.

### Linear Issue Description Template

```markdown
**Reporter:** {first_name} {last_name} ({role})
**Type:** {Bug Report | Schedule Issue | Feedback}
**Page:** {page_route}
**Submitted:** {timestamp}

---

### Description
{description}

{if expected_behavior:}
### Expected Behavior
{expected_behavior}
{end if}

{if activity_name:}
### Activity
{activity_name} {if activity_id: (ID: {activity_id})}
{end if}

{if screenshot_url:}
### Screenshot
![screenshot]({screenshot_url})
{end if}

---
*Device: {user_agent}*
*Screen: {screen_size}*
```

### Linear API Call

```typescript
const response = await fetch('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': Deno.env.get('LINEAR_API_KEY'),
  },
  body: JSON.stringify({
    query: `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
          }
        }
      }
    `,
    variables: {
      input: {
        title,
        description: markdownBody,
        teamId: Deno.env.get('LINEAR_TEAM_ID'),
        labelIds: [labelId],
      }
    }
  })
})
```

### Environment Variables (Supabase Secrets)

| Variable | Description |
|----------|-------------|
| `LINEAR_API_KEY` | Linear API key (create from Linear Settings → API → Personal API keys) |
| `LINEAR_TEAM_ID` | The Danlang422 team UUID: `592f63ab-03ef-41c3-906a-9fdc15ad0d43` |
| `LINEAR_LABEL_BUG` | Label ID for `user-bug` (to be created) |
| `LINEAR_LABEL_SCHEDULE` | Label ID for `schedule-issue` (to be created) |
| `LINEAR_LABEL_FEEDBACK` | Label ID for `user-feedback` (to be created) |

### Error Handling

- Auth failure → 401
- Missing required fields → 400 with field-level errors
- Screenshot upload failure → log warning, continue without screenshot (don't fail the whole submission)
- Linear API failure → log error, continue (report is saved locally). Set `linear_synced: false` in response.
- Database insert failure → 500

---

## Part 6: Linear Labels

Create three new labels in Linear for user-submitted reports. These are distinct from existing labels like `Bug` (which is for developer-identified bugs).

| Label | Color | Description |
|-------|-------|-------------|
| `user-bug` | `#E74C3C` (red) | Bug reported by app user |
| `schedule-issue` | `#F39C12` (amber) | Schedule inaccuracy reported by user |
| `user-feedback` | `#3498DB` (blue) | Feature suggestion or general feedback from user |

These labels serve as the primary triage filter. In Linear, you can create a view filtered to these labels to see all user-submitted reports.

---

## Part 7: Client API Layer

### File: `src/api/feedback.js`

```js
import { supabase } from '@/api/supabase'

/**
 * Submit a feedback report via the Edge Function.
 * The Edge Function handles: saving to DB, uploading screenshot, creating Linear issue.
 */
export async function submitFeedback(reportData) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(reportData),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to submit feedback')
  }

  return response.json()
}

/**
 * Convert a File object to base64 string for transmission.
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Strip the data URL prefix (data:image/png;base64,)
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

---

## Part 8: Component Structure

### New Files

| File | Purpose |
|------|---------|
| `src/pages/HelpPage.jsx` | Help Center page shell with feedback button |
| `src/components/feedback/FeedbackModal.jsx` | Two-step modal: type selection → type-specific form |
| `src/components/feedback/BugReportForm.jsx` | Bug report form fields |
| `src/components/feedback/ScheduleIssueForm.jsx` | Schedule issue form with activity selector |
| `src/components/feedback/FeedbackForm.jsx` | Simple feedback/suggestion form |
| `src/components/feedback/ScreenshotPicker.jsx` | File picker with preview and validation |
| `src/api/feedback.js` | Client-side API functions |
| `supabase/functions/submit-feedback/index.ts` | Edge Function for processing submissions |
| `supabase/migrations/YYYYMMDD000000_feedback_reports.sql` | Table, indexes, RLS, storage bucket |

### Modified Files

| File | Change |
|------|--------|
| `src/App.jsx` | Add `/help` route |
| `src/components/layout/AppLayout.jsx` | Add Help icon/link to navbar |

---

## Part 9: Activity List for Schedule Issues

For the schedule issue form's activity dropdown, the data source depends on the user's role.

### Students

Fetch enrolled activities:

```js
const { data } = await supabase
  .from('enrollments')
  .select('activity:activities(id, name, block_number)')
  .eq('student_id', userId)
  .eq('is_active', true)
  .order('block_number', { foreignTable: 'activities' })
```

### Teachers

Fetch activities where they are the instructor:

```js
const { data } = await supabase
  .from('activities')
  .select('id, name, block_number')
  .eq('instructor_id', userId)
  .order('block_number')
```

### Admins

No dropdown — show a freeform text input. Admins know the full landscape and can type whatever they need.

### Dropdown Behavior

- Shows activity name and block label: "Biology (Block 1)"
- Last option: "Other / not listed" — selecting this reveals a text input for freeform entry
- If freeform is used, `activity_id` is null and `activity_name_text` captures the typed value
- If dropdown selection is used, `activity_id` is set and `activity_name_text` is also set to the activity name (as a readable fallback)

---

## Build Sequence

1. **Migration:** Create `feedback_reports` table, indexes, RLS policies, and `feedback-screenshots` storage bucket.

2. **Linear labels:** Create `user-bug`, `schedule-issue`, and `user-feedback` labels in Linear. Record their IDs for Edge Function env vars.

3. **Edge Function:** Build `submit-feedback` following the `create-user` pattern. Set up Supabase secrets for Linear API key, team ID, and label IDs. Test with curl/Postman before wiring up the frontend.

4. **Client API:** `src/api/feedback.js` with `submitFeedback()` and `fileToBase64()`.

5. **Components (bottom-up):**
   - `ScreenshotPicker` — file input, validation, preview
   - `BugReportForm`, `ScheduleIssueForm`, `FeedbackForm` — individual form bodies
   - `FeedbackModal` — orchestrates type selection + form rendering + submission

6. **Help page:** `src/pages/HelpPage.jsx` — shell page with heading, feedback button, and placeholder for future help content.

7. **Route + nav:** Add `/help` route to `App.jsx`. Add Help icon to `AppLayout` navbar.

8. **Integration test:** Submit one of each report type from each role. Verify: local row created, screenshot uploaded, Linear issue created with correct label and formatted description, GitHub sync.

---

## Out of Scope (deferred)

- Help articles / FAQ content on the Help page
- "My submitted reports" view for users
- Admin report triage UI (status updates, responses to reporters)
- Auto-capture screenshots via `html2canvas`
- Email/notification to admin when a report is submitted
- Rate limiting on submissions (not needed at City View scale)
- Report categories/tags beyond the three types
- Attaching multiple screenshots per report
- In-app notification to user when their report status changes

---

## Resolved Decisions

1. **Manual screenshots via file picker.** Auto-capture deferred. Students are comfortable taking and sharing screenshots.

2. **Linear as the issue target** (not GitHub directly). Linear handles inline image attachments more gracefully, and issues sync to GitHub automatically.

3. **Local `feedback_reports` table included.** Low additional complexity and provides: a safety net if Linear API fails, a foundation for future "my reports" view, and a local audit trail.

4. **Help page created now** even though it's mostly a shell. Establishes the route and nav item for future help content, and gives the feedback button a natural home rather than being a floating element.

5. **Three report types: bug, schedule_issue, feedback.** Covers the core needs for user testing. Additional types can be added later.

6. **Edge Function handles everything.** The client sends the raw payload; the Edge Function handles storage upload, DB insert, and Linear API call. Keeps client-side logic simple and avoids exposing the Linear API key to the browser.

7. **Report status field included but unused initially.** `new/acknowledged/resolved/closed` — cheap to add now, useful when admin triage UI is built later.