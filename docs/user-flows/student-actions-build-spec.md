# Student Actions — Build Spec

**Date:** March 14, 2026
**Status:** Ready to build
**Predecessor:** `student-agenda-today-view-build-spec.md` (implemented)
**Related:** `teacher-agenda-build-spec.md` (implemented), business logic docs `02-checkin-rules.md`, `03-attendance-rules.md`, `04-status-and-presence.md`

**Context:** The student `TodayView` is built and working with placeholder action buttons in a `CardActions` strip. The teacher agenda with roster modal and attendance marking is also built. This spec replaces the placeholder buttons with functional interactions and redesigns the card layout to support them. It covers three student actions — presence wave, status update, and check-in/check-out — plus the card layout changes needed to surface them.

**Design principle:** The card is the student's primary interface. Actions should be visible, stateful, and contextual — the student should always be able to see what they can do and what they've already done without tapping into anything.

**Scope boundary:** This spec covers student-facing interactions only. Teacher visibility of waves, check-ins, and status updates (on roster, on cards) is a separate follow-up spec.

---

## Part 1: Card & Grid Redesign

### PX_PER_HOUR Change

`PX_PER_HOUR` in `src/components/agenda/agendaUtils.js` has been updated from `80` to `100`. This gives:

- 45-minute blocks: 75px card height
- 55-minute blocks: 92px
- 60-minute blocks: 100px
- 90-minute blocks: 150px

This change affects all three agenda views (admin, student, teacher). No other constant changes are needed.

### Card Layout Revision

**Remove `CardActions` component.** The action strip panel is replaced by edge-overlapping buttons (see Action Buttons section below). Delete `src/components/agenda/CardActions.jsx`.

**Remove property icons row.** The `requires_geofence` and `allows_freeform` icons are cut — they communicated information available elsewhere and consumed vertical space the card can't spare at 75px. Remove the icon imports (`MdOutlineMyLocation`, `LuListTodo`) and the conditional row from `StudentActivityCard`.

**New content layout — two rows:**

```
┌──────────────────────────────────────────────────────┐
│ Biology                               7:30a – 9a     │  ← row 1: title (left) + time (right)
│ Block 0 · Room 204 · Ms. Rodriguez                   │  ← row 2: block · location · staff
│                                                  ⭐ 5 │  ← streak indicator (bottom-right, conditional)
└──────────────────────────────────────────────────────┘
                                                      ⬡  ← action button(s), edge-overlapping
```

**Row 1:** Activity name (`font-medium`, `truncate`) left-aligned. Time range (`text-sm text-base-content/60`) right-aligned. Uses `flex justify-between items-baseline gap-2`. The content area has `padding-right: 28px` (or `pr-7`) to prevent text from running under the edge-overlapping action button.

**Row 2:** Block label · location · staff display name — `text-sm text-base-content/60`, `truncate`. Segments joined with ` · `, omitting null values. Staff display uses the existing `resolveStaffName` logic (instructor_name > teacher profile > omit).

**Cards remain `h-full`.** Cards span their full time allocation. This is important because activity times don't always align with block boundaries — the card's height is the visual representation of when the activity runs.

### Card Styling

- Card container: `bg-base-100 border border-base-300 rounded-lg shadow-sm overflow-visible h-full relative`
- Content area: `p-3 pr-7 flex flex-col gap-0.5`
- Note: `overflow-visible` (changed from `overflow-hidden`) is required so the edge-overlapping button is not clipped.

### SingleDayAgenda Overflow Fix

The card wrapper divs in `SingleDayAgenda` and/or the outer card column need `overflow: visible` so edge-overlapping buttons are not clipped. The outermost grid container may keep `overflow-hidden` on the left (time axis) side but the card column must allow visible overflow to the right.

---

## Part 2: Action Buttons

### Placement

Action buttons float on the right edge of each card, half-overlapping the card border:

- Positioned with `absolute`, `right: -14px` (half of the ~28px button diameter)
- Vertically centered on the card (`top: 50%`, `transform: translateY(-50%)` if single button; stacked with gap if two)
- Each button is a ~28px diameter circle/hexagon with a white (`bg-base-100`) fill so it's opaque against the block overlay band behind it
- `z-index: 15` (above the card's `z-index: 10`)

### Button Assignment Per Activity

Each card shows up to two action buttons, stacked vertically:

| Position | Condition | Button |
|----------|-----------|--------|
| Top (primary) | `requires_checkin = true` | Check-in / check-out |
| Top (primary) | `allows_presence_wave = true` (and `requires_checkin` is false) | Presence wave |
| Bottom (secondary) | Always (when activity instance exists) | Status update |

If only one button applies (e.g. status update only, or wave only), it centers vertically on the card edge.

`requires_checkin` and `allows_presence_wave` are expected to be mutually exclusive per activity. If both are somehow true, `requires_checkin` takes priority (check-in is the more substantive interaction). A GitHub issue has been filed to consider enforcing this as a schema constraint.

### Button States

Each button manages its own visual state independently:

**Presence wave button:**

| State | Visual | Condition |
|-------|--------|-----------|
| Inactive | Gray stroke, 40% opacity, white fill | Before availability window (> 10 min before start) or viewing a non-today date |
| Available | Blue/info stroke, 85% opacity, white fill | Within window (10 min before start → midnight) and not yet waved |
| Completed | Green/success stroke, 80% opacity, white fill, icon changes to checkmark | Student has waved for this instance |

**Check-in button:**

| State | Visual | Condition |
|-------|--------|-----------|
| Inactive | Gray stroke, 40% opacity, white fill | Before availability window |
| Available | Blue/info stroke, 85% opacity, white fill, checkmark-circle icon | Within check-in window and not yet checked in |
| Checked in | Green/success stroke, filled checkmark icon | Student has checked in |
| Check-out available | Blue/info stroke, icon changes to indicate "exit" or outbound arrow | Activity end time reached and student is checked in but not checked out |
| Checked out | Green/success stroke, completed icon | Student has checked in and checked out |

**Status update button:**

| State | Visual | Condition |
|-------|--------|-----------|
| Inactive | Gray stroke, 40% opacity, white fill | No instance exists or viewing a non-today date |
| Available | Blue/info stroke, 85% opacity, white fill, comment-plus icon | Instance exists, today |
| Has updates | Same as available but with a small dot indicator (e.g. `bg-success` dot at top-right of button) | Student has posted at least one status update for this instance |

The status button never reaches a "completed" state since unlimited updates are allowed. The dot indicator communicates "you've posted something" without implying "done."

### Button Icons

| Button | State | Icon | Source |
|--------|-------|------|--------|
| Presence wave | Available | Waving hand | `PiHandWaving` from `react-icons/pi` |
| Presence wave | Completed | Checkmark in circle | `IoCheckmarkCircle` from `react-icons/io5` |
| Check-in | Available | Checkmark circle outline | `IoCheckmarkCircleOutline` from `react-icons/io5` |
| Check-in | Checked in | Checkmark circle filled | `IoCheckmarkCircle` from `react-icons/io5` |
| Check-out | Available | TBD — outbound/exit icon | Decide during build |
| Check-out | Completed | Checkmark circle filled | `IoCheckmarkCircle` from `react-icons/io5` |
| Status update | All states | Comment with plus | `MdOutlineAddComment` from `react-icons/md` |

All icons render at 20–22px inside the ~28px button area.

### Button Fill

All buttons use `fill: bg-base-100` (white/primary background) on the icon's backing shape. This makes the button opaque against block overlay bands. The stroke color changes by state (gray → blue → green). On completed states, the icon interior may fill with the stroke color for a "filled" appearance.

---

## Part 3: Streak Indicator

### Display Location

Bottom-right of the card content area, positioned so it doesn't overlap the edge button. Sits on the same line as row 2 (or below it if the card is tall enough), right-aligned with `padding-right: 28px` clearance.

### Icon

A falling star or similar celebratory icon — `GiFallingStar` from `react-icons/gi` (or similar; decide during build). Rendered at 14px alongside a streak count number.

### Visual Treatment

- `text-sm text-base-content/50` when the streak is modest (1–4)
- Slightly more prominent (`text-base-content/70`, maybe the icon gets a warm color like amber) at 5+
- The icon + count sit as an inline element: `⭐ 5`

### Display Logic

Following the algorithm in `04-status-and-presence.md`:

- **No streak, not yet waved:** No indicator shown
- **Active streak, not yet waved today:** Show streak count with a prompt feel — the count is visible, encouraging the student to keep it going
- **Waved today:** Show updated streak count in a celebratory style

### Data Requirements

Streak calculation requires fetching the student's wave history for the activity. This is potentially expensive if done per-card on load.

**Optimization:** Fetch all presence waves for the student across their enrolled activities for a date range (e.g. past 60 school days) in a single query, then calculate streaks client-side. This query runs once when the TodayView loads and is cached via TanStack Query.

---

## Part 4: Interaction Flows

### Flow A: Presence Wave

**Trigger:** Student taps the wave button (available state).

**Steps:**
1. Validate availability client-side (time window, not already waved)
2. Create `presence_waves` record via API: `{ student_id, activity_instance_id, waved_at: now() }`
3. Button transitions immediately to completed state (optimistic)
4. Streak count updates on the card
5. No modal, no text input — single tap interaction

**Error handling:** If the API call fails, revert button to available state and show error toast.

**API function:** `createPresenceWave(studentId, instanceId)` in `src/api/agenda.js`

```js
export async function createPresenceWave(studentId, instanceId) {
  const { data, error } = await supabase
    .from('presence_waves')
    .insert({
      student_id: studentId,
      activity_instance_id: instanceId,
      waved_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}
```

### Flow B: Standalone Status Update

**Trigger:** Student taps the status update button (available state).

**Steps:**
1. Open status update modal
2. Modal shows prompt text: **"What're you up to?"**
3. Type selector: plans / progress / reflection (default: `reflection` for standalone)
4. Text input: 1–500 characters, required
5. Student writes and taps Save
6. Create `status_updates` record via API: `{ student_id, activity_instance_id, status_type, content }`
7. Modal closes
8. Status button gains dot indicator if this is the first update

**Cancel:** Close modal, no record created.

**Modal design:** Standard DaisyUI modal. Header shows activity name. Prompt text above the textarea. Type selector as a segmented control or small button group (plans | progress | reflection). Character count indicator near the textarea.

**API function:** `createStatusUpdate(studentId, instanceId, statusType, content, checkinId = null)` in `src/api/agenda.js`

```js
export async function createStatusUpdate(studentId, instanceId, statusType, content, checkinId = null) {
  const { data, error } = await supabase
    .from('status_updates')
    .insert({
      student_id: studentId,
      activity_instance_id: instanceId,
      checkin_id: checkinId,
      status_type: statusType,
      content: content.trim(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}
```

### Flow C: Check-In

**Trigger:** Student taps the check-in button (available state).

**Steps:**

1. **Validate availability** client-side: time window (10 min before start → midnight), enrollment, not already checked in

2. **Geofence check** (if `requires_geofence = true`):
   - Request browser location via `navigator.geolocation.getCurrentPosition()`
   - If permission denied: proceed without location (`geofence_validated = null`, location fields null)
   - If location obtained: validate against activity's `location_lat`/`location_lng`/`geofence_radius` using Haversine
   - If outside radius: show warning "You're outside the expected area" but allow proceeding (`geofence_validated = false`)
   - If inside radius: `geofence_validated = true`

3. **Create check-in record:**
   ```js
   {
     student_id,
     activity_instance_id: instanceId,
     checked_in_at: new Date().toISOString(),
     check_in_location_lat: lat ?? null,
     check_in_location_lng: lng ?? null,
     geofence_validated: geoResult ?? null
   }
   ```

4. **Freeform tagging** (if `allows_freeform = true`):
   - Show tag selection step in modal
   - List student's other enrolled activities that meet today + any `is_not_scheduled` activities
   - Student picks one or more activities they're working on
   - Save tags to `checkin_activity_tags`: one row per selected activity

5. **Status update prompt:**
   - Modal shows prompt: **"What're your plans?"**
   - Type pre-selected to `plans` (not user-changeable in this context)
   - Text input: 1–500 characters, required
   - `checkin_id` set on the status update record to link it to this check-in

6. **Save and complete:**
   - Status update saved with `checkin_id` set
   - Check-in button transitions to "checked in" state
   - Modal closes

**Cancel at step 5 (status prompt):** Roll back the check-in record. Status update is required as part of the check-in flow. Show brief message: "Check-in cancelled — status update required." If freeform tags were saved in step 4, delete them as well (cascade from check-in deletion, or explicit cleanup).

**Cancel at step 4 (freeform tagging):** Same as cancel at step 5 — roll back check-in.

**Geofence warning at step 2:** The warning is informational. The student can dismiss it and proceed. The check-in is allowed regardless of geofence result — the `geofence_validated` field captures the outcome for teacher review.

**API functions:**

```js
// src/api/agenda.js

export async function createCheckIn(studentId, instanceId, locationData = {}) {
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      student_id: studentId,
      activity_instance_id: instanceId,
      checked_in_at: new Date().toISOString(),
      check_in_location_lat: locationData.lat ?? null,
      check_in_location_lng: locationData.lng ?? null,
      geofence_validated: locationData.validated ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteCheckIn(checkinId) {
  const { error } = await supabase
    .from('check_ins')
    .delete()
    .eq('id', checkinId)

  if (error) throw error
}

export async function createCheckinTags(checkinId, activityIds) {
  const rows = activityIds.map(activityId => ({
    checkin_id: checkinId,
    activity_id: activityId,
  }))

  const { data, error } = await supabase
    .from('checkin_activity_tags')
    .insert(rows)
    .select()

  if (error) throw error
  return data
}
```

### Flow D: Check-Out

**Trigger:** Student taps the check-in button in its "check-out available" state (after activity end time, student is checked in but not checked out).

**Steps:**

1. **Status update prompt:**
   - Modal shows prompt: **"What'd you accomplish?"**
   - Type pre-selected to `progress` (not user-changeable)
   - Text input: 1–500 characters, required
   - `checkin_id` set on the status update record

2. **Write check-out timestamp:**
   ```js
   update check_ins set checked_out_at = now() where id = checkinId
   ```

3. **Complete:**
   - Check-in button transitions to "checked out" state
   - Modal closes

**Cancel:** No checkout written. Student can retry later. The check-in record is unaffected — the student stays "checked in" until they complete the check-out flow or midnight passes.

**API function:**

```js
export async function checkOut(checkinId) {
  const { data, error } = await supabase
    .from('check_ins')
    .update({
      checked_out_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkinId)
    .select()
    .single()

  if (error) throw error
  return data
}
```

---

## Part 5: Status Update Modal

Shared modal component used by standalone status updates (Flow B), check-in status prompts (Flow C step 5), and check-out status prompts (Flow D step 1).

### Component: `StatusUpdateModal`

`src/components/student/StatusUpdateModal.jsx`

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | boolean | Modal visibility |
| `onClose` | () => void | Cancel handler |
| `onSave` | (content, statusType) => Promise | Save handler — caller handles API call |
| `activityName` | string | Shown in modal header |
| `promptText` | string | The conversational prompt ("What're you up to?", etc.) |
| `defaultType` | 'plans' \| 'progress' \| 'reflection' | Pre-selected status type |
| `allowTypeChange` | boolean | Whether the type selector is shown (false for check-in/check-out flows) |
| `saving` | boolean | Loading state for the save button |

### Layout

```
┌─────────────────────────────────────────────────┐
│ Biology                                    [✕]  │  ← activity name
├─────────────────────────────────────────────────┤
│                                                 │
│  What're you up to?                             │  ← prompt text
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │                                         │    │  ← textarea
│  │                                         │    │
│  └─────────────────────────────────────────┘    │
│                                     42 / 500    │  ← character count
│                                                 │
│  [plans] [progress] [reflection]                │  ← type selector (conditional)
│                                                 │
│                          [Cancel]  [Save]       │  ← footer
└─────────────────────────────────────────────────┘
```

**Type selector:** Only shown when `allowTypeChange = true` (standalone status updates). During check-in/check-out flows, the type is pre-set and the selector is hidden. Uses a small `btn-group` / `join` with the active type highlighted.

**Character count:** Shows `{current} / 500`, turns `text-error` when approaching or exceeding limit.

**Save button:** Disabled when content is empty or exceeds 500 characters. Shows loading spinner when `saving = true`.

---

## Part 6: Freeform Tag Selector

Used during check-in for activities with `allows_freeform = true`. Appears as a step between check-in record creation and the status prompt.

### Component: `FreeformTagSelector`

`src/components/student/FreeformTagSelector.jsx`

This can be a modal step or integrated into the check-in modal as a multi-step flow. The simplest approach: a separate modal that opens after check-in, closes when tags are selected, then the status modal opens.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | boolean | Visibility |
| `onClose` | () => void | Cancel (triggers check-in rollback in parent) |
| `onConfirm` | (activityIds: string[]) => void | Selected tags |
| `availableActivities` | array | Student's other activities for tagging |
| `activityName` | string | The freeform activity name (for header context) |

### Tag Options

Following the algorithm in `02-checkin-rules.md`:

1. **Today's other scheduled activities:** Student's enrolled activities that meet today, excluding the freeform activity itself
2. **Unscheduled activities:** Student's enrolled activities where `is_not_scheduled = true` (online courses, etc.)

Each option shows the activity name. Checkboxes for multi-select. At least one tag is required.

### Layout

```
┌─────────────────────────────────────────────────┐
│ What are you working on?                   [✕]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ☐ Biology                                      │
│  ☐ Kirkwood Intro to Psychology                 │
│  ☐ Online Algebra (Edgenuity)                   │
│  ☐ Portfolio Project                            │
│                                                 │
│                      [Cancel]  [Continue →]     │
└─────────────────────────────────────────────────┘
```

**Continue button:** Disabled when no tags selected. On confirm, saves tags and transitions to status modal.

---

## Part 7: Geofence Utilities

### Haversine Distance Function

`src/lib/geofenceUtils.js`

```js
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000 // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // distance in meters
}

export function validateGeofence(studentLat, studentLng, activity) {
  const distance = haversineDistance(
    studentLat,
    studentLng,
    activity.location_lat,
    activity.location_lng
  )
  const radius = activity.geofence_radius ?? 100

  return {
    valid: distance <= radius,
    distance: Math.round(distance),
    radius,
  }
}
```

### Browser Location Helper

```js
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}
```

---

## Part 8: Time Window Utilities

### Availability Checks

`src/lib/actionAvailability.js`

Pure functions that determine whether each action is currently available. Used by the card to set button states.

```js
import { timeToMinutes } from '@/components/agenda/agendaUtils'

/**
 * Check if the current time is within the action window for an activity.
 * Actions become available 10 minutes before start and remain until midnight.
 */
export function isWithinActionWindow(activity, now = new Date()) {
  if (!activity.default_start_time) return false

  const startMinutes = timeToMinutes(activity.default_start_time)
  const availableFromMinutes = startMinutes - 10
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return nowMinutes >= availableFromMinutes
  // Available until midnight — no upper bound check needed
  // (viewing past dates is handled separately by isToday checks)
}

/**
 * Check if the activity's end time has passed (for check-out availability).
 */
export function isPastEndTime(activity, now = new Date()) {
  if (!activity.default_end_time) return false

  const endMinutes = timeToMinutes(activity.default_end_time)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return nowMinutes >= endMinutes
}

/**
 * Determine the check-in button state for a given activity.
 */
export function getCheckinButtonState(activity, checkIn, isToday, now = new Date()) {
  if (!isToday) return 'inactive'
  if (!isWithinActionWindow(activity, now)) return 'inactive'

  if (!checkIn) return 'available' // not checked in
  if (checkIn.checked_out_at) return 'checked-out' // fully complete
  if (isPastEndTime(activity, now)) return 'checkout-available'
  return 'checked-in' // checked in, activity still running
}

/**
 * Determine the wave button state for a given activity.
 */
export function getWaveButtonState(activity, existingWave, isToday, now = new Date()) {
  if (!isToday) return 'inactive'
  if (!isWithinActionWindow(activity, now)) return 'inactive'
  if (existingWave) return 'completed'
  return 'available'
}

/**
 * Determine the status update button state for a given activity.
 */
export function getStatusButtonState(hasInstance, hasUpdates, isToday) {
  if (!isToday || !hasInstance) return 'inactive'
  if (hasUpdates) return 'has-updates'
  return 'available'
}
```

**Note on real-time state updates:** Button states depend on the current time relative to activity start/end. For MVP, the states are calculated on component render and when the date changes. A `setInterval` that recalculates states every 60 seconds would ensure buttons transition from inactive → available as the time window opens. This is a nice-to-have — the student can refresh or navigate away and back to get updated states.

---

## Part 9: Data Layer

### New Hook: `useStudentActions(studentId, activities, date, orgId)`

`src/hooks/useStudentActions.js`

Fetches all action-related state for the student's activities on a given date: existing check-ins, presence waves, status update counts, and activity instances.

**Returns:** `{ checkIns, waves, statusCounts, instances, isLoading }`

- `checkIns`: `Map<activityId, checkInRecord>` — existing check-in for each activity on this date
- `waves`: `Map<activityId, waveRecord>` — existing wave for each activity on this date
- `statusCounts`: `Map<activityId, number>` — count of status updates per activity instance
- `instances`: `Map<activityId, instanceId>` — resolved instance IDs

**Query strategy:**

1. Fetch activity instances for the given activities and date (needed for all subsequent queries)
2. Fetch check-ins for the student across those instances
3. Fetch presence waves for the student across those instances
4. Fetch status update counts for the student across those instances

All four can be fetched in parallel after instances are resolved.

**TanStack Query key:** `['student-actions', studentId, dateStr]`

### New Hook: `useStreakData(studentId, activityIds, orgId)`

`src/hooks/useStreakData.js`

Fetches presence wave history for streak calculation. Fetches all waves for the student across their wave-enabled activities for the past 60 school days.

**Returns:** `Map<activityId, number>` — current streak count per activity

**Query strategy:** Single query to `presence_waves` joined with `activity_instances` (for the date) and filtered to the student's wave-enabled activities over a date range. Streak calculation happens client-side following the algorithm in `04-status-and-presence.md`.

**TanStack Query key:** `['streaks', studentId]` — refreshed when a wave is created (invalidation on wave mutation success).

### New API Functions

All in `src/api/agenda.js`:

```js
// Fetch existing check-ins for a student across multiple instances
export async function getStudentCheckIns(studentId, instanceIds) { ... }

// Fetch existing waves for a student across multiple instances
export async function getStudentWaves(studentId, instanceIds) { ... }

// Fetch status update counts per instance for a student
export async function getStudentStatusCounts(studentId, instanceIds) { ... }

// Fetch wave history for streak calculation
export async function getWaveHistory(studentId, activityIds, sinceDate) { ... }

// Create presence wave (see Flow A)
export async function createPresenceWave(studentId, instanceId) { ... }

// Create status update (see Flow B)
export async function createStatusUpdate(...) { ... }

// Create check-in (see Flow C)
export async function createCheckIn(...) { ... }

// Delete check-in — for rollback on cancel (see Flow C)
export async function deleteCheckIn(checkinId) { ... }

// Create freeform tags (see Flow C)
export async function createCheckinTags(checkinId, activityIds) { ... }

// Check out (see Flow D)
export async function checkOut(checkinId) { ... }
```

### TanStack Query Invalidation

| Action | Invalidate |
|--------|-----------|
| Wave created | `['student-actions', ...]`, `['streaks', ...]` |
| Status update created | `['student-actions', ...]` |
| Check-in created | `['student-actions', ...]` |
| Check-in rolled back | `['student-actions', ...]` |
| Check-out completed | `['student-actions', ...]` |

---

## Part 10: Instance Upsert Fix

**Prerequisite task:** Re-add `ensureActivityInstances` to the student `TodayView`. The `useEffect` was lost during the session 13 build. The teacher Dashboard already has this call.

```jsx
// In TodayView, after activities are loaded
useEffect(() => {
  if (activities.length > 0) {
    ensureActivityInstances(
      activities.map(a => a.id),
      orgId,
      formatDateISO(date)
    ).catch(console.error) // fire-and-forget
  }
}, [activities, orgId, date])
```

This must be in place before any action flows work, since all action records reference `activity_instance_id`.

---

## Component Structure

### New Files

| File | Purpose |
|------|---------|
| `src/components/student/StatusUpdateModal.jsx` | Shared status update modal with prompt text, type selector, textarea |
| `src/components/student/FreeformTagSelector.jsx` | Tag selection modal for freeform check-in flow |
| `src/components/student/ActionButton.jsx` | Single edge-overlapping action button with state-driven styling |
| `src/hooks/useStudentActions.js` | Fetches check-ins, waves, status counts for a date |
| `src/hooks/useStreakData.js` | Fetches wave history and calculates streaks |
| `src/lib/actionAvailability.js` | Pure functions for time-window and state checks |
| `src/lib/geofenceUtils.js` | Haversine distance, geofence validation, browser location helper |

### Modified Files

| File | Change |
|------|--------|
| `src/components/agenda/StudentActivityCard.jsx` | New two-row layout, edge-overlapping buttons, streak indicator, remove property icons and CardActions |
| `src/pages/student/TodayView.jsx` | Add `ensureActivityInstances` useEffect, integrate `useStudentActions` and `useStreakData`, pass action state to cards |
| `src/components/agenda/SingleDayAgenda.jsx` | Ensure card column allows `overflow: visible` |
| `src/api/agenda.js` | Add all new API functions |

### Deleted Files

| File | Reason |
|------|--------|
| `src/components/agenda/CardActions.jsx` | Replaced by edge-overlapping `ActionButton` components |

---

## Build Sequence

Build bottom-up, utilities first, then hooks, then components, then wire up.

1. **Utilities:** `src/lib/geofenceUtils.js`, `src/lib/actionAvailability.js` — pure functions, no dependencies. Can be tested independently.

2. **API functions:** Add all new functions to `src/api/agenda.js` — `createPresenceWave`, `createStatusUpdate`, `createCheckIn`, `deleteCheckIn`, `createCheckinTags`, `checkOut`, `getStudentCheckIns`, `getStudentWaves`, `getStudentStatusCounts`, `getWaveHistory`.

3. **Hooks:** `src/hooks/useStudentActions.js`, `src/hooks/useStreakData.js` — fetch action state for the student's activities on a date. Pattern mirrors existing hooks.

4. **Instance upsert fix:** Re-add `ensureActivityInstances` to `TodayView`. Test that instances are created on page load.

5. **Card redesign:** Update `StudentActivityCard` — new two-row layout, remove property icons and CardActions import, add `overflow-visible`. Create `ActionButton` component for edge-overlapping buttons with state-driven styling. Update `SingleDayAgenda` overflow. Wire up button states from `useStudentActions` data + `actionAvailability` functions.

6. **Modals:** `StatusUpdateModal`, `FreeformTagSelector` — standalone modal components, tested independently.

7. **Flow wiring:** Connect button taps to flows:
   - Wave button → `createPresenceWave` → invalidate queries
   - Status button → open `StatusUpdateModal` → `createStatusUpdate` → invalidate
   - Check-in button → geofence check (if needed) → `createCheckIn` → freeform tags (if needed) → `StatusUpdateModal` → save or rollback
   - Check-out button → `StatusUpdateModal` → `checkOut` → invalidate

8. **Streak integration:** Wire `useStreakData` into card, render streak indicator bottom-right.

---

## Out of Scope (deferred)

- Teacher visibility of waves, check-ins, status updates (separate spec)
- Streak milestones / celebrations beyond the simple indicator
- Mobile-optimized layout (overlay action buttons on narrow viewports)
- Real-time button state transitions via `setInterval` (nice-to-have, can add later)
- "You're here" / "You were here" text on cards (v2 — nice emotional touch but adds complexity)
- Bulk actions (mark all waved, etc.)
- Geofence map view for teachers reviewing out-of-bounds check-ins
- Admin-defined agenda view start/end times (GitHub issue filed)
- Mutual exclusivity enforcement for `allows_presence_wave` and `requires_checkin` (GitHub issue filed)
- Check-in reminder notifications for forgotten check-outs
- Supabase Realtime subscriptions for live updates

---

## Resolved Decisions

1. **PX_PER_HOUR = 100.** Committed. Gives 75px for 45-min blocks — enough for two readable text rows plus padding.

2. **Property icons removed.** Not rendering currently and not worth the vertical space. Information is available elsewhere.

3. **Cards remain h-full.** Activity times don't always align with block boundaries — the card must visually represent the full time allocation.

4. **No action strip panel.** Replaced by edge-overlapping individual buttons. Removes 44–56px of horizontal dead space. Each button manages its own state.

5. **Edge-overlapping buttons with white fill.** Half on the card, half off. White fill for opacity against block overlay bands. `padding-right: 28px` on content area prevents text overlap.

6. **No intermediate "action menu" step.** The hexagon concept was explored but replaced by showing the actual action buttons directly. Max two buttons per card, each clearly identifiable.

7. **Status prompts are conversational.** "What're you up to?" (standalone), "What're your plans?" (check-in), "What'd you accomplish?" (check-out). Friendly tone matching the app's vibe.

8. **Status type is pre-set during check-in/check-out flows.** `plans` for check-in, `progress` for check-out. Not user-changeable in those contexts — reduces friction.

9. **Cancel during check-in status step rolls back the check-in.** Status update is required as part of the check-in flow. Cancelling the status prompt means the check-in didn't happen.

10. **Streak indicator lives on the card, not on the action button.** Bottom-right of content area. Always visible (when applicable) regardless of button state.

11. **`overflow: visible` on card containers.** Required for edge-overlapping buttons. Needs to be set on the card itself and on the card wrapper in SingleDayAgenda.
