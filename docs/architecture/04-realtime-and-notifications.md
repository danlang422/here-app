# Realtime & Notifications

**Last updated:** July 2026 (docs-freshness pass — both sections below were stale: realtime shipped in session 42 and this file still said "not yet implemented"; the `notifications` table has existed in the schema since the original comprehensive-RLS migration but this file said it didn't exist)

## Supabase Realtime

**Implemented, narrowly scoped** — not a general realtime framework, one targeted subscription. `useAttendanceSubscription(instanceIds, onUpdate)` (`src/hooks/useAttendanceSubscription.js`) opens a Supabase `postgres_changes` channel filtered to `attendance_records` rows for a given set of `activity_instance_id`s, and is wired into `useRoster` so a teacher's roster reflects attendance changes made elsewhere (e.g. another staff member, or the same teacher in another tab) without a manual refetch. Closes [#80](https://github.com/danlang422/here-app/issues/80); built session 42; see `docs/design-and-specs/realtime-attendance-subscription-build-spec.md`.

This required `ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records` (`20260521000001_enable_realtime_attendance.sql`) — a table isn't eligible for `postgres_changes` events until explicitly added to the publication, regardless of subscription code. No other table is in the realtime publication and no other hook subscribes to Postgres changes; all other data is still fetched via TanStack Query with manual refetch or query invalidation on mutations.

## Notification System

**Schema exists; not wired up at the application layer.** The `notifications` table has existed since the original comprehensive-RLS migration (`20260313000000`) — full column set, CHECK-constrained `type` enum, RLS policies (own-row SELECT/UPDATE, org-scoped INSERT), and grants (see `docs/schema/07-notifications.md` and `docs/schema/10-rls-policies.md`). But no application code anywhere in `src/` reads or writes it (verified via grep during the July 2026 docs-freshness pass), and there is no in-app notification UI. Same situation as `audit_log` (`docs/schema/08-audit-log.md`) — the table, RLS, and grants are ready, but nothing produces or consumes rows yet. User feedback is handled via the Help page (`HelpPage.jsx`), which submits reports directly to GitHub Issues through a Supabase Edge Function — unrelated to the `notifications` table.

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
