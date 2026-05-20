# Teacher Roster & Cards — Student Action Visibility Build Spec

**Date:** March 14, 2026
**Status:** Ready to build
**Predecessor:** `teacher-agenda-build-spec.md` (implemented), `student-actions-build-spec.md` (implemented)
**Related:** `04-status-and-presence.md`, `02-checkin-rules.md`, schema `05-attendance.md`, `06-social.md`

**Context:** The student TodayView is built with functional action buttons — presence waves, status updates, check-in/check-out. The teacher Dashboard is built with a roster modal for attendance marking. This spec adds teacher-side visibility of student actions: wave indicators, check-in/out status, geofence validation, and status update counts on the roster, plus a student detail overlay for reading status update content and reviewing timestamps. It also includes teacher activity card changes (condensed layout, wave counts) and roster styling improvements.

**Design principle:** The roster is the teacher's primary workspace for a block. Student action data should be visible at a glance without opening anything — icons in the roster row tell the story. Clicking a student row opens a detail overlay for reading status updates and reviewing timestamps. The roster remains fast and scannable; the detail overlay is where depth lives.

**Scope boundary:** This spec covers teacher visibility of student actions in the roster modal and on teacher activity cards. It does NOT cover a standalone "feed" page (separate future spec), teacher-initiated posts, student-side interaction history, or real-time subscriptions.

---

## Part 1: Teacher Activity Card — Condensed Layout

### Current State

Teacher activity cards have three rows of text:

```
Row 1: Activity name
Row 2: Time · Block · Location
Row 3: Enrollment count
```

At `PX_PER_HOUR = 100`, a 45-minute block produces a 75px card, which is cramped with three rows plus padding.

### New Layout — Two Rows

Merge enrollment count (and wave count) into row 2:

**Single card:**
```
┌──────────────────────────────────────────────────┐
│ Advisory                                         │
│ 7:30a – 9a · Block 0 · Trevor's Hub · 7 👋 4    │
└──────────────────────────────────────────────────┘
```

**Row 1:** Activity name — `font-medium truncate`

**Row 2:** Meta segments joined with ` · `, `text-sm text-base-content/60 truncate`. Segments in order:
1. Time range (always present)
2. Block label (if `block` is not null)
3. Location (if not null)
4. Enrollment count: `{N}` (plain number, no "students" label — saves space)
5. Wave count: `👋 {N}` (hand wave icon + count, only shown when wave count > 0)

The enrollment count and wave count are not joined with ` · ` to each other — they're separated by a space. The wave indicator uses `PiHandWaving` from `react-icons/pi` at 14px inline with the count number. This keeps the important-info-first ordering: time and block are leftmost, counts are rightmost and get clipped first on narrow cards.

**Aggregate card:**
```
┌──────────────────────────────────────────────────┐
│ ⊞ Block 3                                       │
│ 7:30a – 9a · 4 activities · 24 👋 18            │
└──────────────────────────────────────────────────┘
```

Same two-row structure. Row 2 segments:
1. Time range
2. Activity count: `{N} activities`
3. Total enrollment count (plain number)
4. Wave count (summed across all activities in the group, only shown when > 0)

### Wave Count Data

Wave count per activity requires fetching presence waves for the activity's instance on the current date. This is a new data requirement for the teacher Dashboard — see Part 7 for the data layer changes.

When the viewed date is not today, wave counts still display (waves from that date). When no waves exist (or activity doesn't use `allows_presence_wave`), the wave indicator is omitted entirely — no `👋 0`.

### Card Styling

No changes to card container classes. Only the content layout changes from three rows to two.

---

## Part 2: Roster Modal — Row Layout Redesign

### Current Row Layout

```
Name                                          P  A  E  T
Activity · Location (aggregate only)
```

Student name on top, activity label below (aggregate rosters only), PAET buttons right-aligned. Large empty gap in the middle.

### New Row Layout — Single-Activity Roster

```
│  Alex Johnson       👋 ✓    (2)       P  A  E  T  │
│  Maya Patel         👋                 P  A  E  T  │
│  Sam Torres              ✓⚠  (1)      P  A  E  T  │
│  Dexter Gassman                        P  A  E  T  │
```

**Structure:** `Name | Icon Zone | PAET Buttons`

The icon zone sits in the middle gap between name and buttons. It contains conditional indicators (left to right):
- Wave icon (when student has waved)
- Check-in/out icon (when student has checked in or out)
- Geofence failure icon (only when `geofence_validated = false`)
- Status update count badge `(N)` (when student has ≥1 status update)

### New Row Layout — Aggregate Roster

```
│  Alex Johnson       Advisory      👋 ✓    (2)   P  A  E  T  │
│  Maya Patel         Advisory      👋              P  A  E  T  │
│  Sam Torres         Internship         ✓⚠  (1)  P  A  E  T  │
│  Allison K.         Advisory (B)                  P  A  E  T  │
```

**Structure:** `Name | Activity Label | Icon Zone | PAET Buttons`

Activity label is `text-sm text-base-content/50 italic truncate`. Location is removed from the activity label (available in the student detail overlay if needed). This keeps the single-row layout viable.

### Row Implementation — Flexbox Layout

Each row is a single flex container:

```jsx
<div className="flex items-center gap-2 py-2.5 px-2 rounded-lg cursor-pointer hover:bg-base-200/50 transition-colors">
  {/* Name — fixed min-width, truncate */}
  <div className="min-w-30 max-w-45 truncate font-medium">
    {displayName}
  </div>

  {/* Activity label — aggregate only, truncate */}
  {isAggregate && (
    <div className="min-w-20 max-w-35 text-sm text-base-content/50 italic truncate">
      {activityName}
    </div>
  )}

  {/* Icon zone — flex-1 to fill the gap */}
  <div className="flex-1 flex items-center gap-1.5 justify-end">
    {/* Conditional icons render here */}
  </div>

  {/* PAET buttons — shrink-0, prevent row click */}
  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
    {/* Attendance buttons */}
  </div>
</div>
```

### Row Click Target

The **entire row** is clickable to open the student detail overlay, **except** the PAET button zone. The PAET buttons use `e.stopPropagation()` to prevent the row click handler from firing. This means clicking anywhere in the name, activity label, icon zone, or empty space opens the detail overlay. The `cursor-pointer` and `hover:bg-base-200/50` visual feedback reinforces this.

### Zebra Striping

Alternating row backgrounds for scanability: `even:bg-base-200/30`. Applied to the row container.

### Attendance Button Styling Fix

Current buttons use DaisyUI `join` which only rounds the outer edges of the first/last button, leaving inner buttons with sharp corners. Change to individually rounded buttons with a small gap:

```jsx
<div className="flex items-center gap-1">
  {STATUS_OPTIONS.map(({ key, label, fullLabel, btnClass }) => (
    <button
      key={key}
      className={`btn btn-xs rounded ${
        currentStatus === key ? btnClass : 'btn-ghost'
      }`}
      title={fullLabel}
      onClick={() => onToggle(student.studentId, key)}
    >
      {label}
    </button>
  ))}
</div>
```

Each button gets full `rounded` corners. Replaces the `join` / `join-item` pattern.

---

## Part 3: Roster Row Icons

### Wave Icon

- **Shown when:** Student has waved for this activity instance
- **Not shown when:** Student has not waved (no placeholder, no empty state)
- **Icon:** `PiHandWaving` from `react-icons/pi` at 16px
- **Color:** `text-success` (green) — matches the completed state on the student side
- **Tooltip:** `Waved at {time}` (formatted wave timestamp)

### Check-In/Out Icon

- **Checked in (not yet checked out):** `IoCheckmarkCircle` from `react-icons/io5` at 16px, `text-success` (green, filled)
- **Checked out:** `IoExitOutline` from `react-icons/io5` at 16px, `text-success` (green) — indicates completed flow
- **Not checked in:** No icon shown
- **Tooltip:** `Checked in at {time}` or `Checked in {time}, out {time}`

### Geofence Failure Icon

- **Shown when:** `geofence_validated = false` on the check-in record
- **Not shown when:** `geofence_validated` is `true` or `null` (null means location wasn't obtained — not a failure, just missing data)
- **Icon:** `MdLocationDisabled` from `react-icons/md` at 16px
- **Color:** `text-error` (red)
- **Tooltip:** `Location check failed — {distance}m from expected area` (if distance data is available; otherwise just `Location check failed`)

### Status Update Count Badge

- **Shown when:** Student has ≥1 status update for this activity instance
- **Not shown when:** No status updates
- **Display:** `({N})` — parenthesized count in `text-sm text-base-content/50`
- **Icon prefix:** `MdOutlineAddComment` from `react-icons/md` at 14px before the count, `text-base-content/50`
- **Tooltip:** `{N} status update(s)`

### Icon Zone Rendering

Icons are rendered conditionally in a flex row with `gap-1.5`. Only icons with data appear — there are no placeholders or empty-state icons. The zone is `flex-1 justify-end` so icons cluster toward the right, near the PAET buttons, leaving the gap between the name and icons as empty space.

Maximum icons in one row: 4 (wave + check-in + geofence fail + status count). In practice, check-in and wave are mutually exclusive per activity (a `requires_checkin` activity typically doesn't also have `allows_presence_wave`), so the realistic max is 3.

---

## Part 4: Student Detail Overlay

A separate modal that layers on top of the roster modal. Opens when a roster row is clicked (anywhere except the PAET buttons).

### Component: `StudentDetailOverlay`

`src/components/roster/StudentDetailOverlay.jsx`

### Props

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | boolean | Visibility |
| `onClose` | () => void | Close handler |
| `student` | object | Student info (name, id, activityId, activityName) |
| `instanceId` | string | Activity instance ID for this student's activity on this date |
| `date` | Date | The viewed date |

### Data Fetching

The overlay fetches its own data on open via a new hook `useStudentInstanceDetail`. This keeps the roster modal lightweight — it doesn't need to pre-fetch full status update content for every student.

**Fetches:**
1. Check-in record (if any) — full record with timestamps, geofence fields
2. Presence wave record (if any) — waved_at timestamp
3. Status updates — full content, type, timestamps, ordered by `created_at ASC`
4. Freeform tags (if check-in exists and activity `allows_freeform`) — tagged activity names

### Layout

```
┌─────────────────────────────────────────────────┐
│ Alex Johnson                              [✕]   │
│ Advisory · Block 0                               │
├─────────────────────────────────────────────────┤
│                                                  │
│  CHECK-IN                                        │
│  ✓ Checked in at 7:32 AM                        │
│  ✓ Checked out at 8:58 AM                       │
│  ⚠ Location check failed                        │
│  Working on: Biology, Portfolio Project           │
│                                                  │
│  WAVE                                            │
│  👋 Waved at 7:28 AM                            │
│  🔥 5 day streak                                │
│                                                  │
│  STATUS UPDATES                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ plans · 7:33 AM                          │   │
│  │ Working on my lab report for bio and     │   │
│  │ starting the portfolio reflection.       │   │
│  ├──────────────────────────────────────────┤   │
│  │ progress · 8:55 AM                       │   │
│  │ Finished the lab report, got halfway     │   │
│  │ through the reflection. Need to finish   │   │
│  │ tomorrow.                                │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│                                     [Close]      │
└─────────────────────────────────────────────────┘
```

### Sections

Each section is conditional — only shown when data exists. If a student has no interactions at all, show a centered empty state: "No activity recorded for this date."

**Check-In Section:**
- Header: `CHECK-IN` in `text-xs font-semibold tracking-wide text-base-content/40 uppercase`
- Check-in timestamp: `✓ Checked in at {time}` with `IoCheckmarkCircle` icon
- Check-out timestamp (if checked out): `✓ Checked out at {time}` with `IoExitOutline` icon
- Geofence failure (if `geofence_validated = false`): `⚠ Location check failed` with `MdLocationDisabled` in `text-error`
- Freeform tags (if any): `Working on: {activity1}, {activity2}` — comma-joined activity names from `checkin_activity_tags`

**Wave Section:**
- Header: `WAVE`
- Wave timestamp: `👋 Waved at {time}` with `PiHandWaving` icon
- Streak count (if available): `🔥 {N} day streak` with `GiFlame` icon (same as student card)

**Status Updates Section:**
- Header: `STATUS UPDATES`
- Each update rendered as a card/block:
  - Type badge + timestamp: `plans · 7:33 AM` — type in `text-xs font-medium` with color coding (plans = info, progress = success, reflection = neutral), timestamp in `text-xs text-base-content/40`
  - Content: the full status update text, `text-sm`, regular weight
- Updates listed chronologically (oldest first) — reads like a timeline of the student's activity
- If a status update has a `checkin_id`, it could show a subtle indicator linking it to the check-in flow, but this is optional — the timestamp proximity and type (plans = check-in, progress = check-out) already imply the connection

### Modal Styling

- `max-w-md` — narrower than the roster modal, feels like a focused detail view
- Standard DaisyUI modal with backdrop
- Renders on top of the roster modal (higher z-index). The roster modal remains visible but dimmed behind it.
- Close button in header + "Close" button in footer

### Empty States

- **No interactions at all:** "No activity recorded for this date." centered, `text-base-content/50`
- **Section-level:** Sections simply don't render if no data exists. No "No check-in" or "No wave" messages — absence is the message.

---

## Part 5: Streak Visibility in Detail Overlay

The student detail overlay shows the student's wave streak for the activity. This requires the same streak calculation used by the student TodayView.

**Option A:** Fetch streak data per-student on overlay open (simple, but adds a query).
**Option B:** Pre-fetch streak data for all students in the roster and pass it through (efficient for repeated overlay opens, but more data loaded upfront).

**Decision: Option A.** The overlay is opened one student at a time. Fetching streak data on open keeps the roster query lightweight. The query is fast (single student's wave history for one activity).

The `useStudentInstanceDetail` hook includes streak calculation. It fetches the student's wave history for this activity over the past 60 school days and calculates the streak client-side using the algorithm from `04-status-and-presence.md`.

---

## Part 6: Wave Counts for Teacher Cards

The teacher Dashboard needs wave counts per activity to display on the cards. This is new data not currently fetched by `useTeacherAgenda`.

### Approach

Add wave count fetching to the teacher Dashboard. After activities are loaded and instances are ensured, fetch wave counts for the current date's instances.

**New hook:** `useTeacherActionSummary(activityIds, date, orgId)`

Returns: `{ waveCounts: Map<activityId, number>, isLoading }`

This hook:
1. Fetches instance IDs for the activities on the date (reuses `getInstancesForActivities`)
2. Fetches all presence waves for those instances (new API function — see Part 7)
3. Groups and counts waves by activity

The Dashboard passes `waveCounts` into `TeacherActivityCard` via a new `waveCount` prop (single cards) or computes the sum for aggregate cards.

---

## Part 7: Data Layer Changes

### New API Functions

All in `src/api/agenda.js`:

```js
// Fetch all presence waves for a set of activity instances (teacher view).
// Returns all waves across all students for the given instances.
export async function getWavesForInstances(instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('presence_waves')
    .select('*')
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Fetch all check-ins for a set of activity instances (teacher view).
// Returns all check-ins across all students for the given instances.
export async function getCheckInsForInstances(instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Fetch all status updates for a set of activity instances (teacher view).
// Returns all status updates across all students for the given instances.
export async function getStatusUpdatesForInstances(instanceIds) {
  if (instanceIds.length === 0) return []

  const { data, error } = await supabase
    .from('status_updates')
    .select('*')
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}

// Fetch full detail for a single student on a single activity instance.
// Used by the student detail overlay.
export async function getStudentInstanceDetail(studentId, instanceId) {
  const [checkIns, waves, statusUpdates] = await Promise.all([
    supabase
      .from('check_ins')
      .select('*')
      .eq('student_id', studentId)
      .eq('activity_instance_id', instanceId)
      .maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data }),
    supabase
      .from('presence_waves')
      .select('*')
      .eq('student_id', studentId)
      .eq('activity_instance_id', instanceId)
      .maybeSingle()
      .then(({ data, error }) => { if (error) throw error; return data }),
    supabase
      .from('status_updates')
      .select('*')
      .eq('student_id', studentId)
      .eq('activity_instance_id', instanceId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => { if (error) throw error; return data ?? [] }),
  ])

  // If check-in exists, fetch freeform tags
  let freeformTags = []
  if (checkIns?.id) {
    const { data: tags, error: tagError } = await supabase
      .from('checkin_activity_tags')
      .select('*, activity:activity_id(name)')
      .eq('checkin_id', checkIns.id)

    if (!tagError && tags) {
      freeformTags = tags.map(t => t.activity?.name).filter(Boolean)
    }
  }

  return {
    checkIn: checkIns,
    wave: waves,
    statusUpdates,
    freeformTags,
  }
}
```

### New Hook: `useTeacherActionSummary(activityIds, date, orgId)`

`src/hooks/useTeacherActionSummary.js`

Fetches summary action data for all students across the teacher's activities on a date. Used by the roster modal for row icons AND by the Dashboard for card wave counts.

```js
import { useQuery } from '@tanstack/react-query'
import { formatDateISO } from '@/lib/scheduleUtils'
import {
  getInstancesForActivities,
  getWavesForInstances,
  getCheckInsForInstances,
  getStatusUpdatesForInstances,
} from '@/api/agenda'

export function useTeacherActionSummary(activityIds, date, orgId) {
  const dateStr = formatDateISO(date)
  const sortedKey = [...activityIds].sort().join(',')

  return useQuery({
    queryKey: ['teacher-action-summary', sortedKey, dateStr],
    queryFn: async () => {
      // 1. Get instance IDs
      const instanceMap = await getInstancesForActivities(orgId, dateStr, activityIds)
      const instanceIds = [...instanceMap.values()]

      if (instanceIds.length === 0) {
        return {
          waveCounts: new Map(),
          waves: new Map(),
          checkIns: new Map(),
          statusCounts: new Map(),
          instances: instanceMap,
        }
      }

      // 2. Fetch all action data in parallel
      const [wavesData, checkInsData, statusData] = await Promise.all([
        getWavesForInstances(instanceIds),
        getCheckInsForInstances(instanceIds),
        getStatusUpdatesForInstances(instanceIds),
      ])

      // Build reverse map: instanceId → activityId
      const instanceToActivity = new Map()
      for (const [activityId, instanceId] of instanceMap) {
        instanceToActivity.set(instanceId, activityId)
      }

      // Wave counts per activity (for cards)
      const waveCounts = new Map()
      // Waves per student+activity (for roster icons)
      // Key: `${studentId}-${activityId}`
      const waves = new Map()
      for (const w of wavesData) {
        const actId = instanceToActivity.get(w.activity_instance_id)
        if (actId) {
          waveCounts.set(actId, (waveCounts.get(actId) ?? 0) + 1)
          waves.set(`${w.student_id}-${actId}`, w)
        }
      }

      // Check-ins per student+activity (for roster icons)
      const checkIns = new Map()
      for (const ci of checkInsData) {
        const actId = instanceToActivity.get(ci.activity_instance_id)
        if (actId) {
          checkIns.set(`${ci.student_id}-${actId}`, ci)
        }
      }

      // Status update counts per student+activity (for roster icons)
      const statusCounts = new Map()
      for (const s of statusData) {
        const actId = instanceToActivity.get(s.activity_instance_id)
        if (actId) {
          const key = `${s.student_id}-${actId}`
          statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1)
        }
      }

      return { waveCounts, waves, checkIns, statusCounts, instances: instanceMap }
    },
    enabled: activityIds.length > 0 && !!orgId,
  })
}
```

### New Hook: `useStudentInstanceDetail(studentId, instanceId, activityId)`

`src/hooks/useStudentInstanceDetail.js`

Fetches full detail for one student on one instance. Used by the student detail overlay.

```js
import { useQuery } from '@tanstack/react-query'
import { getStudentInstanceDetail, getWaveHistory } from '@/api/agenda'

export function useStudentInstanceDetail(studentId, instanceId, activityId) {
  return useQuery({
    queryKey: ['student-instance-detail', studentId, instanceId],
    queryFn: async () => {
      const detail = await getStudentInstanceDetail(studentId, instanceId)

      // Calculate streak if wave exists
      let streak = 0
      if (detail.wave) {
        const sixtyDaysAgo = new Date()
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 90) // Fetch extra to account for non-school days
        const waveHistory = await getWaveHistory(studentId, [activityId], sixtyDaysAgo.toISOString())
        // Streak calculation would use the same logic as useStreakData
        // For now, return wave history length as a simple count
        // TODO: Integrate proper streak calculation from useStreakData
        streak = waveHistory.length
      }

      return { ...detail, streak }
    },
    enabled: !!studentId && !!instanceId,
  })
}
```

**Note:** Streak calculation in this hook should reuse the streak logic from `useStreakData.js` (the student hook). The simplest approach is to extract the streak calculation into a shared utility function in `src/lib/streakUtils.js` that both hooks can import. This is a refactor opportunity during build — extract the algorithm, don't duplicate it.

### TanStack Query Invalidation

| Action | Invalidate |
|--------|-----------|
| Attendance save in roster | `['roster', ...]` (existing), `['teacher-agenda', ...]` (existing) |
| Student waves (from student side) | `['teacher-action-summary', ...]` (via query key match on date) |
| Student check-in/out | `['teacher-action-summary', ...]` |
| Student status update | `['teacher-action-summary', ...]` |

**Note:** Until Supabase Realtime is implemented, teacher-side data won't live-update when students perform actions. The teacher can refresh the page or reopen the roster to see updated data. This is acceptable for MVP — Realtime is a planned future addition.

---

## Part 8: Roster Modal — Integration Changes

### RosterModal Modifications

The `RosterModal` component needs to:

1. **Accept action summary data** via props (passed from Dashboard, which owns `useTeacherActionSummary`)
2. **Render icons in each student row** based on the action summary maps
3. **Track which student is selected for detail overlay** via local state
4. **Render `StudentDetailOverlay`** when a student is selected

### Updated Props

Add to existing `RosterModal` props:

| Prop | Type | Description |
|------|------|-------------|
| `actionSummary` | object | `{ waves, checkIns, statusCounts, instances }` from `useTeacherActionSummary` |

### Updated StudentRow

The `StudentRow` component gains icon rendering and a click handler:

```jsx
function StudentRow({
  student,
  isAggregate,
  currentStatus,
  onToggle,
  actionData,     // { wave, checkIn, statusCount }
  onClick,        // row click → open detail overlay
}) {
  const displayName = student.preferredName
    ? `${student.preferredName} ${student.lastName}`
    : `${student.firstName} ${student.lastName}`

  return (
    <div
      className={`flex items-center gap-2 py-2.5 px-2 rounded-lg cursor-pointer hover:bg-base-200/50 transition-colors`}
      onClick={onClick}
    >
      {/* Name */}
      <div className="min-w-30 max-w-45 truncate font-medium">
        {displayName}
      </div>

      {/* Activity label — aggregate only */}
      {isAggregate && (
        <div className="min-w-20 max-w-35 text-sm text-base-content/50 italic truncate">
          {student.activityName}
        </div>
      )}

      {/* Icon zone */}
      <div className="flex-1 flex items-center gap-1.5 justify-end">
        {actionData.wave && (
          <span className="text-success" title={`Waved at ${formatTimestamp(actionData.wave.waved_at)}`}>
            <PiHandWaving size={16} />
          </span>
        )}
        {actionData.checkIn && (
          <CheckInIcon checkIn={actionData.checkIn} />
        )}
        {actionData.checkIn?.geofence_validated === false && (
          <span className="text-error" title="Location check failed">
            <MdLocationDisabled size={16} />
          </span>
        )}
        {actionData.statusCount > 0 && (
          <span className="flex items-center gap-0.5 text-base-content/50" title={`${actionData.statusCount} status update(s)`}>
            <MdOutlineAddComment size={14} />
            <span className="text-xs">({actionData.statusCount})</span>
          </span>
        )}
      </div>

      {/* PAET buttons — stop propagation */}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        {student.requiresAttendance ? (
          <div className="flex items-center gap-1">
            {STATUS_OPTIONS.map(({ key, label, fullLabel, btnClass }) => (
              <button
                key={key}
                className={`btn btn-xs rounded ${
                  currentStatus === key ? btnClass : 'btn-ghost'
                }`}
                title={fullLabel}
                onClick={() => onToggle(student.studentId, key)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-base-content/40 shrink-0">
            No attendance
          </span>
        )}
      </div>
    </div>
  )
}
```

### CheckInIcon Helper Component

```jsx
function CheckInIcon({ checkIn }) {
  if (checkIn.checked_out_at) {
    return (
      <span
        className="text-success"
        title={`Checked in ${formatTimestamp(checkIn.checked_in_at)}, out ${formatTimestamp(checkIn.checked_out_at)}`}
      >
        <IoExitOutline size={16} />
      </span>
    )
  }
  return (
    <span
      className="text-success"
      title={`Checked in at ${formatTimestamp(checkIn.checked_in_at)}`}
    >
      <IoCheckmarkCircle size={16} />
    </span>
  )
}
```

---

## Part 9: Dashboard Integration

### Dashboard Changes

The Dashboard component adds `useTeacherActionSummary` alongside its existing hooks:

```jsx
// In Dashboard, after activities are loaded
const allActivityIds = activities.map(a => a.id)
const { data: actionSummary } = useTeacherActionSummary(allActivityIds, date, orgId)
```

**Card wave counts:** Passed to `TeacherActivityCard` via a new `waveCount` prop:

```jsx
const renderCard = (item) => {
  const waveCount = item.isAggregate
    ? item.activities.reduce((sum, a) => sum + (actionSummary?.waveCounts.get(a.id) ?? 0), 0)
    : (actionSummary?.waveCounts.get(item.id) ?? 0)

  return (
    <TeacherActivityCard
      item={item}
      blockLabels={blockLabels}
      waveCount={waveCount}
      onClick={() => handleCardClick(item)}
    />
  )
}
```

**Roster modal:** Passes `actionSummary` to `RosterModal`:

```jsx
{rosterTarget && (
  <RosterModal
    activities={rosterTarget.activities}
    isAggregate={rosterTarget.isAggregate}
    date={date}
    orgId={orgId}
    teacherId={teacherId}
    blockLabels={blockLabels}
    actionSummary={actionSummary}
    onClose={() => setRosterTarget(null)}
  />
)}
```

---

## Component Structure

### New Files

| File | Purpose |
|------|---------|
| `src/components/roster/StudentDetailOverlay.jsx` | Student detail modal with CI/CO, wave, streak, and status update display |
| `src/hooks/useTeacherActionSummary.js` | Fetches waves, check-ins, status counts for all students across teacher's activities on a date |
| `src/hooks/useStudentInstanceDetail.js` | Fetches full detail for one student on one instance (used by detail overlay) |

### Modified Files

| File | Change |
|------|--------|
| `src/components/agenda/TeacherActivityCard.jsx` | Condensed two-row layout, wave count display, new `waveCount` prop |
| `src/components/roster/RosterModal.jsx` | New row layout with icon zone, row click handler, zebra striping, attendance button rounding fix, student detail overlay state, accepts `actionSummary` prop |
| `src/pages/teacher/Dashboard.jsx` | Integrates `useTeacherActionSummary`, passes wave counts to cards and action summary to roster modal |
| `src/api/agenda.js` | Add `getWavesForInstances`, `getCheckInsForInstances`, `getStatusUpdatesForInstances`, `getStudentInstanceDetail` |

### No Deleted Files

---

## Build Sequence

1. **API functions:** Add `getWavesForInstances`, `getCheckInsForInstances`, `getStatusUpdatesForInstances`, `getStudentInstanceDetail` to `src/api/agenda.js`. Straightforward Supabase queries — test against DB with teacher account.

2. **`useTeacherActionSummary` hook:** Fetches and maps all student action data for a date. Returns `waveCounts`, `waves`, `checkIns`, `statusCounts`, `instances`. Test that the maps populate correctly.

3. **`useStudentInstanceDetail` hook:** Fetches full detail for one student+instance. Includes streak calculation (extract shared utility from `useStreakData` if possible). Test with a student who has waves, check-ins, and status updates.

4. **`TeacherActivityCard` condensed layout:** Two-row layout with wave count. Update both `SingleCard` and `AggregateCard` rendering. Accept `waveCount` prop. Test that cards display correctly at various block durations (45min, 55min, 90min).

5. **`RosterModal` row redesign:** New flexbox row layout, icon zone, zebra striping, rounded attendance buttons, row click handler with `stopPropagation` on PAET zone. Accept `actionSummary` prop and wire icons to the data. Test with aggregate and single-activity rosters.

6. **`StudentDetailOverlay`:** Build the detail modal component. Conditional sections for check-in, wave, and status updates. Empty state. Styled timestamp formatting. Test by clicking student rows in the roster.

7. **Dashboard integration:** Add `useTeacherActionSummary` to Dashboard. Pass `waveCounts` to `renderCard`, pass full `actionSummary` to `RosterModal`. Test end-to-end: card shows wave counts, roster shows icons, clicking a row opens detail overlay with full data.

---

## Out of Scope (deferred)

- **Feed page** — A standalone page showing a filterable feed of status updates, check-ins, and waves across activities/dates. Separate spec.
- **Student interaction history** — A student-facing view of their own past actions. Separate spec.
- **Realtime updates** — Teacher roster doesn't live-update when students act. Requires Supabase Realtime (planned).
- **Linking from detail overlay to feed** — Detail overlay items could eventually link to the feed page. Deferred until feed exists.
- **Teacher-initiated status prompts** — Teachers sending prompts to students via posts. Separate feature.
- **Bulk attendance actions** — "Mark all present" button. Deferred.
- **Confirmation on roster cancel with pending changes** — Deferred to avoid scope creep.
- **Mobile-optimized roster layout** — The single-row layout may need responsive breakpoints on narrow screens. Deferred.
- **Wave count on aggregate cards when some activities don't use waves** — Currently shows the sum regardless. Could show `👋 4/18` (4 of 18 eligible) but adds complexity. Deferred.
- **Status update ordering in feed (instance date vs creation date)** — Noted as an open question for the feed spec.

---

## Resolved Decisions

1. **Two-row card layout.** Merge enrollment count and wave count into the meta line. Solves the height cramp for short blocks at `PX_PER_HOUR = 100`.

2. **Wave count only on cards.** Check-in and status counts live in the roster. Cards stay clean and scannable.

3. **Single-row roster layout for aggregates.** `Name | Activity | Icons | PAET` on one line. Activity label is truncated. Works at City View's scale (short activity names, small rosters). Location removed from activity label — available in detail overlay.

4. **Whole row is clickable** (except PAET buttons). `stopPropagation` on the button zone. Consistent interaction model — always opens detail overlay, shows "No activity recorded" empty state if no data.

5. **Separate modal overlay for student detail.** Layers on top of the roster. Roster stays visible but dimmed. Detail overlay fetches its own data on open (lightweight roster, deep detail on demand).

6. **Icons only when data exists.** No placeholders, no "not yet" indicators. Absence = no icon. Keeps the roster visually clean for students who haven't interacted yet.

7. **Geofence failure only.** Only flag `geofence_validated = false`. Null (no location data) is not flagged — it's missing data, not a failure.

8. **Per-student-per-activity indicators in aggregate rosters.** Each enrollment row gets its own icons. A student in two activities in the same block could have different states for each.

9. **Individually rounded attendance buttons.** Replace `join`/`join-item` with separate `btn btn-xs rounded` buttons with `gap-1`. Each button has full border radius.

10. **Zebra striping on roster rows.** `even:bg-base-200/30` for alternating row backgrounds.

11. **Action summary hook owned by Dashboard, passed to roster.** Dashboard fetches once, passes to roster modal. Avoids duplicate fetching if roster is opened/closed multiple times.

12. **Streak data fetched on overlay open (Option A).** Per-student fetch keeps roster query lightweight. Streak calculation should be extracted into a shared utility to avoid duplicating the algorithm from `useStreakData`.
