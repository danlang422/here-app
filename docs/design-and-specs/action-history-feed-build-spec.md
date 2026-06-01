# Action History Feed — Build Spec

**Status:** Implemented
**GitHub issue:** #71
**Session:** 47

---

## Overview

A history/feed view of student actions (check-ins, waves, status updates), surfaced in three places:

1. **`/history` page — student role** — full reverse-chronological feed of the student's own actions, with filters
2. **`/teacher/history` page — teacher role** — same feed concept, but scoped to the teacher's students/activities, with additional student filter
3. **TodayView widget — both roles** — compact "recent activity" summary on the existing Today page, linking to the full history page

All three are built around a shared `StudentActionFeed` component that accepts a `studentId` prop (single student) or `teacherId` prop (all students across teacher's activities). The pages mount this component with different default scopes and filter configurations.

---

## Data Model

History entries are assembled from three tables, joined through `activity_instances`:

```
activity_instances
  → activities (name, block, location, calendar → color)
  → check_ins (checked_in_at, checked_out_at, student_id)
  → presence_waves (waved_at, student_id)
  → status_updates (status_type, content, created_at, student_id)
```

The natural grouping unit is the **instance**: one activity on one calendar date. A student may have multiple actions within a single instance (waved + checked in + submitted a reflection). The feed groups these together into one entry rather than showing three separate items.

### Feed entry shape (assembled client-side after fetch)

```js
{
  instanceId: string,
  date: string,            // 'YYYY-MM-DD'
  activityId: string,
  activityName: string,
  calendarColor: string | null,
  block: number[],
  location: string | null,
  staffDisplayName: string | null,  // teacher name(s), resolved via existing RPC
  wave: { waved_at: string } | null,
  checkIn: { checked_in_at: string, checked_out_at: string | null } | null,
  statusUpdates: { status_type: string, content: string, created_at: string }[],
  studentId: string,       // always present; used by teacher feed to show student name
  studentName: string | null,  // null in student-scoped view (redundant)
}
```

---

## API Layer — `src/api/history.js` (new file)

### `getStudentActionHistory(studentId, { startDate, endDate })`

Fetches all instances where the student took at least one action within the date range. Returns data to assemble feed entries.

```js
// Fetch check_ins, presence_waves, status_updates for the student
// joined through activity_instances to get date + activity info
// Date range: default to current term start → today
```

Implementation: three parallel queries (check_ins, presence_waves, status_updates), each joining `activity_instance_id → activity_instances(date, activity_id → activities(*,  calendar:calendar_id(color)))`. Merge client-side by instance_id. Only include instances where at least one action exists.

Supabase query shape for check_ins:
```js
supabase
  .from('check_ins')
  .select(`
    *,
    activity_instance:activity_instance_id(
      id, date,
      activity:activity_id(
        id, name, block, location,
        calendar:calendar_id(color),
        activity_staff(user_id, role)
      )
    )
  `)
  .eq('student_id', studentId)
  .gte('activity_instance.date', startDate)
  .lte('activity_instance.date', endDate)
  .order('activity_instance.date', { ascending: false })
```

Same shape for presence_waves and status_updates. Merge by `activity_instance_id` client-side.

Staff names: reuse existing `batchGetProfileDisplayInfo` RPC from `agenda.js` (extract to shared utility if not already).

### `getTeacherStudentActionHistory(teacherId, { startDate, endDate, studentId? })`

Same shape as above but scoped to activities where `teacherId` is in `activity_staff`. Returns entries across all students, each entry includes `studentId` and `studentName`.

Fetch strategy: get activity IDs for teacher (same as `getTeacherActivitiesForDate`), then query the three action tables filtered to those activity IDs + optionally a specific `student_id`. Join through instances to get dates.

---

## `StudentActionFeed` Component — `src/components/history/StudentActionFeed.jsx`

Shared rendering component. Props:

```js
{
  entries: FeedEntry[],          // assembled, sorted, filtered by parent
  isLoading: boolean,
  isTeacherView: boolean,        // shows student name on each entry if true
  emptyMessage: string,          // customizable empty state text
}
```

### Feed entry card

Each entry is a card showing one instance's worth of actions:

```
[calendar color left border, matching agenda cards]

[Activity name]                          [Date — "Mon, May 19"]
[Block icon(s)]  [Location or staff]

[Action summary row]
  Wave icon + time    |   Check-in icon + time (–checkout time)   |   Note icon + count
  [if teacher view]:  [Student name badge]

[Status update(s) — expanded inline if 1; collapsible if 2+]
  type label · timestamp
  content text
```

**Action summary row:** Icons only with timestamps beneath — same icon language as the card buttons (`HandWaving`, `CheckCircle`/`SignOut`, `NotePencil`). Muted when the action didn't occur (don't show at all if null — only show actions that happened).

**Status updates:** If the entry has exactly one status update, show it inline (type + content). If two or more, show the first and a "show X more" toggle. This keeps the feed scannable.

**Date header:** Group entries by date with a sticky date divider (e.g. "Tuesday, May 27") when rendering the full feed. The divider is just a subtle label row, not a section card.

**Teacher view additions:** Student name shown as a small badge or subtitle below the activity name. Clicking a student name could eventually link to that student's individual history — park for now.

---

## Student History Page — `src/pages/student/HistoryView.jsx`

Route: `/history`

### Layout

```
[← Back]  Activity History

[Filter bar]
  Date range: [This Term ▾]   Activity: [All ▾]   Type: [All actions ▾]

[StudentActionFeed]
```

Simple full-width layout, `max-w-2xl` centered (matching TodayView width). No sidebar.

### Filters

**Date range:** Select with options:
- This term (default) — uses org's current term start from `org_settings`
- Last 7 days
- Last 30 days
- All time

**Activity:** Dropdown populated from the student's enrolled activities. "All" by default.

**Type:** Multi-select or segmented control:
- All actions (default)
- Check-ins only
- Waves only
- Status updates only

Filters are applied client-side against the full fetched dataset (for "this term" scope, the dataset is manageable). If "all time" is selected, refetch with no date bound.

### Empty state

"No activity recorded yet for this period." — with a small illustration or icon (use `ClockCounterClockwise` from Phosphor as the page icon, it reads as "history" without being too literal).

---

## Teacher History Page — `src/pages/teacher/HistoryView.jsx`

Route: `/teacher/history`

### Layout

```
[← Back]  Student Activity History

[Filter bar]
  Date range: [This Term ▾]   Student: [All students ▾]   Activity: [All ▾]   Type: [All actions ▾]

[StudentActionFeed isTeacherView]
```

Same `max-w-3xl` as teacher dashboard (slightly wider to accommodate the student name column).

### Filters

Same as student, plus:

**Student:** Dropdown of all students across the teacher's enrolled activities. Populated from the roster data already in cache. "All students" by default.

When a specific student is selected, the feed narrows to that student — same result as viewing history from the student detail overlay (the overlay just pre-sets this filter and links here).

### From the student detail overlay

The existing `StudentDetailOverlay` (or equivalent component) gets a "View history" link at the bottom of the overlay. It links to `/teacher/history?studentId=[id]` — the page reads `studentId` from query params and pre-filters to that student on load.

---

## TodayView Widget — Both Roles

A compact "Recent Activity" summary panel added to the existing TodayView pages. Not a sidebar — just a section below or alongside the agenda, depending on available space.

### Student widget

Location: Below the time-axis agenda on `/today` (or in a right column on wider screens — defer layout decision to implementation, keeping it below is safe).

Shows the **3 most recent instances** where the student took any action, regardless of date. Each entry is a single compact row:

```
[Calendar color dot]  [Activity name]  [action icons]  [date if not today]
```

Action icons: small `HandWaving`, `CheckCircle`, `NotePencil` — filled/colored if the action occurred, muted/hollow if not. This gives an at-a-glance "did I check in? did I wave? did I write something?" for recent activities.

Clicking any row opens the full `ActivityDetailSheet` for that instance (read-only if the instance is in the past — action buttons are state-gated already so this is automatic).

At the bottom of the widget: `[ClockCounterClockwise icon] View full history →` links to `/history`.

Widget title: "Recent Activity" — subtle, `text-xs uppercase tracking-wide text-base-content/40` like the sidebar section headers.

### Teacher widget

Location: Bottom of the right sidebar, below the "Visible to All" section.

Shows the **5 most recent student actions** across all the teacher's activities, any student, any type. Each row:

```
[Student name]  [activity name]  [action icon]  [time — "7:43 AM" or "Yesterday"]
```

This is a notification-style feed rather than an instance-grouped feed — each action is its own row because teachers want to see *who did what* sequentially, not grouped by class.

At the bottom: `[ClockCounterClockwise icon] View all →` links to `/teacher/history`.

Widget title: "Recent Student Activity"

### Data for widgets

Student widget: query `getStudentActionHistory` with no date filter, limit to 3 most recent instances. This is a small query.

Teacher widget: query `getTeacherStudentActionHistory` with `newer_than: 48 hours`, limit 5 rows. Cached with a short stale time (2 minutes) — this is ambient data, not critical path.

---

## RLS Considerations

Existing RLS policies should cover most of this:

- Students can read their own `check_ins`, `presence_waves`, `status_updates` — confirmed (policies exist from student actions build)
- Teachers can read `check_ins`, `presence_waves`, `status_updates` for their students — confirmed (policies exist from teacher roster actions build)
- `activity_instances` — students can read instances for their enrolled activities; teachers can read instances for their activities. Confirm these policies exist before shipping; the realtime subscription work (#80) required the instances to be in the publication, so policies should be there.
- `calendars` — students need read access to their own activity's calendar for the color join. Verify this — may need a policy addition if students don't currently read calendars.

Run Supabase security advisor after adding new queries.

---

## New Hooks

**`useStudentHistory({ studentId, startDate, endDate, activityId, actionType })`**
- Calls `getStudentActionHistory`
- Assembles and sorts feed entries
- Applies client-side filters (activityId, actionType)
- Returns `{ entries, isLoading, isError }`

**`useTeacherStudentHistory({ teacherId, startDate, endDate, studentId, activityId, actionType })`**
- Calls `getTeacherStudentActionHistory`
- Assembles, sorts, applies filters
- Returns `{ entries, isLoading, isError }`

**`useRecentStudentActivity({ studentId, limit })`**
- Thin wrapper around `useStudentHistory` with no date filter, limited to `limit` most recent instances
- Used by the TodayView widget

**`useRecentTeacherActivity({ teacherId, limit })`**
- Queries last 48 hours across teacher's activities
- Returns flat action rows (not instance-grouped) for the notification-style widget
- Used by the teacher sidebar widget

---

## Files to Create / Modify

| File | Change |
|---|---|
| `src/api/history.js` | New — `getStudentActionHistory`, `getTeacherStudentActionHistory` |
| `src/hooks/useHistory.js` | New — four hooks above |
| `src/components/history/StudentActionFeed.jsx` | New — shared feed component |
| `src/components/history/FeedEntryCard.jsx` | New — individual entry card |
| `src/components/history/RecentActivityWidget.jsx` | New — compact widget (used by both TodayView pages, props control student vs teacher variant) |
| `src/pages/student/HistoryView.jsx` | New — student history page |
| `src/pages/teacher/HistoryView.jsx` | New — teacher history page |
| `src/pages/student/TodayView.jsx` | Add `RecentActivityWidget` below agenda |
| `src/pages/teacher/Dashboard.jsx` | Add `RecentActivityWidget` to bottom of sidebar |
| `src/components/teacher/StudentDetailOverlay.jsx` (or equivalent) | Add "View history" link at bottom |
| `src/App.jsx` (or router file) | Add `/history` and `/teacher/history` routes |

---

## Icon

`ClockCounterClockwise` from Phosphor — used as:
- Page icon in the history page headers
- Widget "View full history" / "View all" link icon
- Eventually: nav entry point icon if/when a toolbar or nav item is added

---

## Implementation Notes (session 47 deviations)

- **Single `/history` route, role-dispatched.** Spec called for `/history` (student) and `/teacher/history` (teacher) as separate routes. Implemented as a single `/history` route — `src/pages/HistoryView.jsx` reads `currentRole` from authStore and renders the appropriate page component. Simpler routing; the `?studentId=` deep-link still works unchanged.
- **Two-step query pattern for teacher history.** Spec's proposed query shape (`.gte('activity_instance.date', x)`) doesn't work in PostgREST — filtering on nested relation columns is not supported. Student history uses direct timestamp columns on the action tables. Teacher history fetches instance IDs for the teacher's activities first, then queries action tables filtered to those IDs.
- **Teacher student filter is client-side only.** `useTeacherStudentHistory` fetches all actions for the teacher's activities; the student dropdown in the teacher history page filters the already-fetched result rather than triggering a new query. Switching students is instant.
- **`batchGetProfileDisplayInfo` extracted to `src/api/profiles.js`.** Was a private helper in `agenda.js`; now a shared export used by both the history API layer and the existing agenda code.
- **`StudentDetailOverlay` is at `src/components/roster/StudentDetailOverlay.jsx`**, not `src/components/teacher/StudentDetailOverlay.jsx` as the spec listed. "View history" link added in the footer.
- **`AgendaSidebar` height cap added.** Visible-to-all sections capped at `max-h-[50vh] overflow-y-auto` so the teacher `RecentActivityWidget` at the bottom remains visible without scrolling past a long visible-to-all list.

---

## Not In Scope

- Pagination (client-side filtering of a term's worth of data is manageable; add if performance is an issue with real data)
- Student-to-student history visibility
- Admin history view (can mount `StudentActionFeed` later with admin scope)
- Posting / teacher announcements (future feature; the history page layout should leave room for a toolbar above the feed)
- Streak display in history entries (streaks are computed per-activity relative to today; historical streak values aren't stored — park for a future enhancement)
