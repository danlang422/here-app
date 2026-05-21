# Realtime Attendance Subscription — Build Spec

**Issue:** #80  
**Session:** 42  
**Status:** Ready for implementation

---

## Background

With the visible-to-all sidebar shipping in session 41, multiple staff can now take attendance on the same activity simultaneously. The current data layer (TanStack Query with manual invalidation) only updates a teacher's roster when *they* make a change — a second teacher's attendance marks are invisible until the next background refetch cycle. This spec adds a Supabase Realtime subscription so roster views stay live when any staff member writes attendance.

---

## Scope

This spec covers **`attendance_records` only**. Subscriptions for `check_ins` and `presence_waves` follow the same pattern and will be added in a follow-on spec once this is stable.

---

## What to Build

### 1. `useAttendanceSubscription` hook

**Location:** `src/hooks/useAttendanceSubscription.js` (new file)

A focused, reusable hook that opens a Supabase Realtime `postgres_changes` subscription scoped to a set of activity instance IDs. When any change fires, it calls a provided callback — it does not fetch data itself.

**Signature:**
```js
useAttendanceSubscription(instanceIds, onUpdate)
```

- `instanceIds` — array of instance ID strings (UUIDs). If empty or null, no subscription is opened.
- `onUpdate` — callback function to run when a change is detected. Receives the Supabase `payload` but doesn't need to use it.

**Behavior:**
- Opens a channel on mount (when `instanceIds` is non-empty)
- Subscribes to `INSERT`, `UPDATE`, and `DELETE` on `public.attendance_records`, filtered to `instance_id=in.(id1,id2,...)`
- Calls `onUpdate` on any event
- Cleans up (removes channel) on unmount or when `instanceIds` changes
- Does nothing if `instanceIds` is empty or not yet resolved

**Implementation notes:**
- Use `supabase.channel()` with a stable, unique channel name — e.g. `attendance-${instanceIds.sort().join('-')}` — so React doesn't create duplicate channels on re-renders
- Import the supabase client from `src/api/supabase.js`
- The `in` filter syntax for multiple IDs is: `instance_id=in.(uuid1,uuid2,uuid3)` — verify this against Supabase docs, as the exact filter string format matters

---

### 2. Wire into `useRoster`

**Location:** `src/hooks/useRoster.js` (existing file)

Add `useAttendanceSubscription` to `useRoster`. When the subscription fires, invalidate the two query keys that drive the roster UI:

- `['roster', sortedKey, dateStr]`
- `['teacher-action-summary', sortedKey, dateStr]`

The `sortedKey` and `dateStr` values are already computed inside `useRoster` — use them directly.

The `instanceIds` to pass are the resolved instance IDs from the existing `getInstancesForActivities` call. These are already available in the hook — pass them once they're resolved (i.e. don't pass an empty array before the query completes).

**Do not** change the existing query logic, mutation behavior, or return shape of `useRoster`.

---

## RLS Verification Step (Do This Before Wiring Up)

Supabase Realtime respects RLS, but there's a subtle difference from regular queries: the RLS check for a subscription happens using the user's JWT at subscription time, not per-event. If the `attendance_records` RLS policies rely on `SECURITY DEFINER` helper functions (as overhauled in session 36), these need to be accessible in the Realtime context.

**Before implementing, verify this works:**

1. In the browser, open the Here app and sign in as a teacher account
2. Open the browser dev console (F12)
3. Paste and run the following:

```js
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm')

// Use the same anon key and URL as the app
const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY',
  { global: { headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session.access_token } `} } }
)
```

Actually — a simpler verification approach: add a temporary `console.log` subscription directly inside `useRoster` before extracting the hook, and check that events appear in the console when you write an attendance record from another browser tab/window. If events come through, RLS is working. If the subscription connects but no events arrive, that's the signal to investigate the RLS policies.

**What "connected but no events" looks like vs. "subscription blocked":** Supabase will log subscription status to the console. Look for `SUBSCRIBED` vs. `CHANNEL_ERROR` in the Realtime channel status.

> **Note for Daniel:** The URL and anon key are in your `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. You don't need to manually paste them anywhere — the existing supabase client already has them. The verification is just: does the subscription fire when you write attendance from a second browser window? Claude Code can add a temporary `console.log` inside the callback for this test.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/hooks/useAttendanceSubscription.js` | **Create** |
| `src/hooks/useRoster.js` | **Modify** — add subscription, import new hook |

No schema changes. No new API functions. No UI changes.

---

## Acceptance Criteria

- [ ] Opening a `BlockRosterModal` (or any component using `useRoster`) starts a Realtime subscription for the relevant instance IDs
- [ ] Closing the modal / unmounting the component cleans up the subscription (no lingering channels)
- [ ] When Teacher A marks attendance on Activity X, Teacher B's open roster for Activity X updates within ~2 seconds without any manual action
- [ ] When Teacher A marks attendance on Activity Y (a different activity), Teacher B's open roster for Activity X does **not** trigger a refetch
- [ ] No duplicate channels are created if `useRoster` re-renders with the same instance IDs
- [ ] Existing roster behavior (initial load, mutation-driven invalidation, PAET buttons) is unchanged

---

## Follow-On Work (Not In This Spec)

- `useCheckInSubscription` — same pattern, `check_ins` table, invalidates `['roster', ...]` and `['teacher-action-summary', ...]`
- `useWaveSubscription` — same pattern, `presence_waves` table
- These can likely be consolidated into a single `useRosterSubscription` hook once the pattern is proven, or kept separate for clarity — decide after seeing how the attendance one lands