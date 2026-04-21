# Realtime & Notifications

**Last updated:** April 2026 (session 35)

## Supabase Realtime

Realtime subscriptions are **not yet implemented**. The plan (tracked in [#80](https://github.com/danlang422/here-app/issues/80)) is to use Supabase's `postgres_changes` WebSocket channels to push live updates to teacher roster views. There is no `useRealtimeTable` hook and no realtime channel setup in the current codebase. All data is fetched via TanStack Query with manual refetch or query invalidation on mutations.

## Notification System

A notification system is **not implemented**. There is no `notifications` table in the schema and no in-app notification UI. User feedback is handled via the Help page (`HelpPage.jsx`), which submits reports directly to GitHub Issues through a Supabase Edge Function.

---

## Timezone & Date Handling

### Design Principle

The schema uses two different time column types intentionally:

- **`TIME` (without timezone)** — Block schedule times (`default_start_time`, `default_end_time` on activities), schedule template block definitions. These are wall-clock times that mean "9:05 AM at the school" regardless of the viewer's timezone.
- **`TIMESTAMPTZ` (with timezone)** — Event timestamps: `checked_in_at`, `marked_at`, `waved_at`, `created_at`, `updated_at`. Postgres stores these as UTC and converts on retrieval.

### Organization Timezone

The `organizations.settings.timezone` field (e.g., `"America/Chicago"`) serves one purpose: **determining the current local date**. When the app needs to answer "what school day is it right now?", it converts the current UTC timestamp to the org's timezone to get the local date. This drives which `school_days` record to look up, which rotation day applies, and whether a check-in falls on "today" or "yesterday."

### Frontend Display Rules

All `TIMESTAMPTZ` values are displayed in the **user's browser timezone**, which is the browser's default behavior with `Date` objects. A teacher in Central time sees "Checked in at 9:03 AM" while the same moment displays as "10:03 AM" for someone in Eastern time. Both are correct.

All `TIME` values are displayed as-is with no timezone conversion. "Block 1 starts at 9:05" means 9:05 at the school, always.

### Implementation

Date utilities live in `src/lib/scheduleUtils.js`. The project has no external date library (no `date-fns`, no `date-fns-tz`). Timezone-aware "today" lookup uses the `Intl.DateTimeFormat` API directly.

```js
// Getting "today" in the org's timezone (for school day lookup)
function getSchoolDate(orgTimezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: orgTimezone }).format(new Date())
}

// Displaying a TIMESTAMPTZ — browser handles conversion automatically
function formatEventTime(timestamptz) {
  return new Date(timestamptz).toLocaleTimeString()
}

// Displaying a TIME value — no conversion, parse as local
function formatBlockTime(timeString) {
  const [hours, minutes] = timeString.split(':')
  return new Date(0, 0, 0, hours, minutes).toLocaleTimeString(
    [], { hour: 'numeric', minute: '2-digit' }
  )
}
```
