# Teacher Agenda (Dashboard) — Build Spec

**Date:** March 13, 2026
**Status:** Ready to build
**Predecessor:** `student-teacher-agenda-build-spec.md` (teacher portion, now outdated)
**Related:** `student-agenda-today-view-build-spec.md` (student equivalent, implemented)

**Context:** The student `TodayView` is built and working. This spec builds the teacher equivalent — a today-focused view of the teacher's own activities with a roster modal for attendance marking. It reuses `SingleDayAgenda`, `AgendaBlockOverlay`, `agendaUtils`, and `scheduleUtils` directly from the student build. The density/grouping model differs from both the student view (no grouping) and the admin view (three-tier density): the teacher view uses a simplified two-tier model where any block with more than one activity is always aggregated into a single card.

**Design principle:** Build the view first, interactions second. This spec covers the read display, roster modal, and attendance marking. Check-in review, presence wave counts, status updates, and posts are separate features to be layered on afterward.

**Scope boundary:** This spec covers the teacher `Dashboard` only. Student interactions (check-in, presence wave, status updates) are covered in separate specs.

---

## Layout

The teacher agenda uses the same time-based positioning logic as the student agenda via `SingleDayAgenda`:

- Vertical time axis on the left (7 AM – 4 PM default, expanding to fit actual activity times)
- Cards positioned vertically by `default_start_time` / `default_end_time`
- Block overlay bands as visual reference (existing `AgendaBlockOverlay`, known visibility issue #16 — not solved in this spec)
- `agendaUtils` reused for all time-to-pixel math — no forking

The view is **today-first** with `<` `>` date navigation. Date state is local to the page component (`useState`), not Zustand.

**Date header format:** Same as student `TodayView` — arrow buttons flanking the date label. Shows "Today" when viewing the current date; full date otherwise (e.g. "Mon, Mar 11"). "Back to today" shortcut link when navigated away from today.

**Rotation day display (conditional):** Same logic as student `TodayView`. If any of the teacher's activities (across all assigned activities, not just today's filtered set) have a non-null `rotation_day_type`, append the rotation day label to the header: "Today, March 12 — A Day". If none of the teacher's activities use rotation scheduling, the rotation label is omitted.

**Non-school day behavior:** Same as student — allow navigating to any calendar date. On non-school days, show an empty state message (e.g. "No activities scheduled for this date").

---

## Density Model (Simplified Two-Tier)

The teacher density model is simpler than the admin agenda. The teacher's mental model is "I'm managing Block X" — whether that's one class or a group of monitoring sessions. There is no "few" mode with side-by-side cards.

**Rules:**
- **1 activity in a block** → single card (full-width, shows activity details)
- **2+ activities in a block** → aggregate card (single full-width card summarizing the block group)

This differs from the admin agenda which uses three tiers (single / few / aggregate with `DENSITY_FEW_MAX = 3` and `DENSITY_AGG_MIN = 4`). The teacher view always aggregates at 2+.

**Grouping logic:** Reuse `groupActivitiesByBlock` from `agendaUtils.js` to group activities by block. The teacher view then applies its own simpler threshold (aggregate at 2+) rather than the admin's three-tier logic.

Activities with `block = null` (should be rare for a teacher's assigned activities, but possible for not-yet-configured activities) are grouped under a `'null'` key and treated as individual cards.

---

## SingleDayAgenda Integration

The teacher view reuses `SingleDayAgenda` but needs to handle block grouping before passing activities to it. Since `SingleDayAgenda` positions each item in its `activities` array individually, the teacher page component must:

1. Run `groupActivitiesByBlock` on the raw activities list
2. For single-activity blocks: pass the activity through as-is
3. For multi-activity blocks: create a synthetic "aggregate" object with computed fields (`earliestStart`, `latestEnd`, `activityCount`, `totalEnrollment`, `blockLabel`, `activities` array)
4. Pass the resulting mixed list to `SingleDayAgenda`

The `renderCard` prop then checks whether each item is a real activity or a synthetic aggregate and renders the appropriate card component.

**Aggregate object shape:**

```js
{
  id: `agg-${blockKey}`,           // synthetic ID for React key
  isAggregate: true,                // flag for renderCard to branch on
  block: blockKey,                  // the shared block number
  activities: [...],                // array of underlying activities
  activityCount: N,
  totalEnrollment: sum,
  default_start_time: earliestStart, // earliest start across group
  default_end_time: latestEnd,       // latest end across group
}
```

Using `default_start_time` and `default_end_time` on the synthetic object means `SingleDayAgenda`'s existing `activityTop` / `activityHeight` math works without modification — the aggregate card spans from the earliest start to the latest end of its constituent activities.

---

## Teacher Activity Card (Single)

For blocks with exactly one activity. The card is the click target for opening the roster modal.

```
┌─────────────────────────────────────────────────┐
│ Biology                                         │
│ 7:30a – 9:00a · Block 0 · Room 204             │
│ 18 students                                     │
└─────────────────────────────────────────────────┘
```

**Content rows:**
- **Row 1:** Activity name — `font-medium`, truncated with `truncate` if needed
- **Row 2:** Time range · Block label · Location — `text-sm text-base-content/60`. Format: `7:30a – 9:00a · Block 0 · Room 204`. Omit location segment if `location` is null. Omit block segment if `block` is null.
- **Row 3:** Enrollment count — `text-sm text-base-content/50`. Format: `18 students` (pluralized).

**No staff name row** — the teacher is the staff. No action strip — the teacher's interaction is clicking the card to open the roster modal.

**No property icons for v1.** The most relevant flag would be `requires_checkin` (teacher bases attendance on check-in data), but this is deferred until check-in features are built. Icons can be added later without changing card structure.

**Card click:** Opens the roster modal for this single activity. The entire card is the click target (`cursor-pointer`, hover shadow transition).

**Card styling:**
- Card container: `bg-base-100 border border-base-300 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow`
- Content area: `p-3 flex flex-col gap-0.5`

---

## Teacher Activity Card (Aggregate)

For blocks with 2+ activities. Represents the combined block group.

```
┌─────────────────────────────────────────────────┐
│ ⊞ Block 3                                      │
│ 7:30a – 9:00a                                   │
│ 4 activities · 24 students                      │
└─────────────────────────────────────────────────┘
```

**Content rows:**
- **Row 1:** Stack/group icon + Block label — `font-medium`. Icon: `FaLayerGroup` from `react-icons/fa6` (or similar stacked layers icon). Format: `⊞ Block 3`. Uses `getBlockLabel(block, blockLabels)` for custom block names.
- **Row 2:** Time range — `text-sm text-base-content/60`. Shows earliest start – latest end across all activities in the group. Format: `7:30a – 9:00a`.
- **Row 3:** Activity count + enrollment count — `text-sm text-base-content/50`. Format: `4 activities · 24 students`.

**No location** — locations may differ across activities in the group (internships, external courses).

**Card click:** Opens the roster modal for the block group (combined roster across all activities).

**Card styling:**
- Card container: `bg-base-200 border border-base-300 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow` — `bg-base-200` to visually distinguish from single cards.
- Content area: `p-3 flex flex-col gap-0.5`

---

## Roster Modal

A standard DaisyUI modal. Opens on teacher activity card click.

### Modal Header

**For single-activity rosters:**
```
┌─────────────────────────────────────────────────┐
│ Biology                                    [✕]  │
│ 7:30a – 9:00a · Block 0 · Room 204             │
│ 18 students                                     │
├─────────────────────────────────────────────────┤
```
- Title: Activity name
- Subtitle: Time · Block · Location (same format as card, omit segments if null)
- Count: Enrollment count

**For aggregate (block group) rosters:**
```
┌─────────────────────────────────────────────────┐
│ ⊞ Block 3                                 [✕]  │
│ 7:30a – 9:00a · 4 activities                    │
│ 24 students                                     │
├─────────────────────────────────────────────────┤
```
- Title: Stack icon + Block label (same as aggregate card)
- Subtitle: Time range · Activity count
- Count: Total enrollment
- No location (same reasoning as aggregate card)

### Roster Body

Student list with attendance buttons. Sorted by last name.

**For single-activity rosters:**

```
┌────────────────────────────────────────────────────────┐
│ Alex Johnson          [Present][Absent][Excused][Tardy] │
│ Maya Patel            [Present][Absent][Excused][Tardy] │
│ Sam Torres            [Present][Absent][Excused][Tardy] │
└────────────────────────────────────────────────────────┘
```

Each row shows:
- Student name — full name (`first_name last_name`), normal weight
- Attendance button group — four states matching `attendance_status` enum

**For aggregate rosters:**

```
┌────────────────────────────────────────────────────────────────────┐
│ Alex Johnson    Biology (Rm 204)    [Present][Absent][Excused][Tardy] │
│ Maya Patel      Chemistry           [Present][Absent][Excused][Tardy] │
│ Sam Torres      Internship – City Hall  [Present][Absent][Excused][Tardy] │
└────────────────────────────────────────────────────────────────────┘
```

Each row shows:
- Student name — full name, normal weight
- Activity label — `text-sm text-base-content/50`, italicized. Format: `activity name · location` if location is set, else just activity name. This disambiguates which activity each student belongs to.
- Attendance button group

Students are sorted by last name across all activities in the group (not grouped by activity). The activity label column is what distinguishes them.

### Attendance Buttons

Four-state button group per student: **Present**, **Absent**, **Excused**, **Tardy**. Corresponds to the `attendance_status` enum.

**Display:** Small button group using DaisyUI `btn-group` or `join`. Abbreviate labels to **P / A / E / T** (full labels may be tight, especially in aggregate rosters — build with abbreviations and add tooltips with full labels). Active state highlighted with a distinct color per status:
- Present: `btn-success` (green tint)
- Absent: `btn-error` (red tint)
- Excused: `btn-warning` (amber tint)
- Tardy: `btn-info` (blue tint)

Unselected buttons use `btn-ghost`.

**Interaction:** Clicking a button toggles it in local state immediately (responsive UI). No instant save — changes accumulate in local state until the teacher clicks **Save**.

**Initial state:** On modal open, fetch existing `attendance_records` for the relevant activity instance(s) on this date. Pre-populate button states from existing records. Students without a record default to no selection (all buttons in ghost state).

### Attendance Save

**Save button** in the modal footer. Persists all pending attendance changes to the database in a single batch operation.

**Behavior:**
- Save button shows pending change count: "Save (12)" or "Save changes" when changes exist
- Save button is disabled when no changes are pending
- On click: upsert all changed attendance records via `Promise.all` of individual `upsertAttendanceRecord` calls
- On success: close modal, invalidate relevant TanStack Query keys
- On error: show error toast, keep modal open with changes preserved
- Loading state on the save button during the upsert operation

**Local state model:**

```js
// Map of studentId → status (only entries that differ from initial state)
const [pendingChanges, setPendingChanges] = useState(new Map())

// Initial state loaded from DB
const [initialAttendance, setInitialAttendance] = useState(new Map())

// Toggle a student's status
function toggleAttendance(studentId, status) {
  setPendingChanges(prev => {
    const next = new Map(prev)
    const initial = initialAttendance.get(studentId)
    if (status === initial) {
      // Toggling back to initial state — remove from pending
      next.delete(studentId)
    } else {
      next.set(studentId, status)
    }
    return next
  })
}

// Effective state for display (merge initial + pending)
function getStudentStatus(studentId) {
  return pendingChanges.get(studentId) ?? initialAttendance.get(studentId) ?? null
}
```

This model tracks only actual changes, so the save button count is accurate and a toggle-back-to-original removes the pending change.

### Modal Footer

```
┌─────────────────────────────────────────────────┐
│                          [Cancel]  [Save (12)]  │
└─────────────────────────────────────────────────┘
```

- **Cancel:** Closes modal, discards pending changes. If changes exist, no confirmation dialog for MVP — just close.
- **Save:** Disabled when no changes. Shows count of pending changes. Upserts and closes on success.

### Filtering Non-Attendance Activities

Not all activities in a teacher's agenda require attendance marking. The roster modal should only show students from activities where `requires_attendance = true`. If a teacher clicks a single card for an activity with `requires_attendance = false` (e.g. a release period), the modal can either:

- (a) Show a simple informational view — activity name, time, enrolled students, but no attendance buttons. "Attendance not required for this activity."
- (b) Not open at all — the card is non-clickable.

**Decision: Option (a).** The teacher may still want to see who's enrolled. Show the roster in read-only mode with no attendance buttons and a note that attendance is not required. The card is still clickable.

For aggregate cards where some activities require attendance and some don't: show all students from all activities, but only show attendance buttons for students in attendance-required activities. Students in non-attendance activities appear in the roster (so the teacher sees the full block) but their row shows "No attendance" in muted text instead of buttons.

---

## Instance Upsert

The teacher view triggers lazy instance creation on render. When the view loads activities for a given date, it upserts `activity_instances` rows for any activity scheduled on that date.

```jsx
// In Dashboard component
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

This calls the existing `ensureActivityInstances` from `src/api/agenda.js`, which uses `upsertActivityInstance` with `INSERT ... ON CONFLICT DO NOTHING`. Safe for concurrent calls from multiple users.

The teacher INSERT policy on `activity_instances` already exists in the comprehensive RLS migration: `"Teachers create own activity instances" ON activity_instances FOR INSERT WITH CHECK (is_teacher_or_monitor_of(activity_id))`.

**Note:** The student `TodayView` currently does not call `ensureActivityInstances` — the `useEffect` was lost during the session 13 build. This should be re-added as a follow-up task (separate from this spec) so both roles can trigger instance creation. The `ON CONFLICT DO NOTHING` makes concurrent creation from both roles safe.

---

## Data Layer

### New Hook: `useTeacherAgenda(teacherId, date, orgId)`

`src/hooks/useTeacherAgenda.js`

Fetches all activities where the teacher is assigned as `teacher_id` or `monitor_id` that meet on the given date.

**Query strategy:** Same pattern as `useStudentAgenda` — fetch all assigned activities without date filtering, then apply `activityMeetsToday` client-side. This is because the date filtering predicate depends on the school day record (rotation day matching), which is fetched separately.

**Returns:** `{ activities, allActivities, enrollmentCounts, schoolDay, isLoading, error }`

- `activities`: Array of activity objects filtered to those meeting today, sorted by `default_start_time`
- `allActivities`: Unfiltered set of assigned activities (for rotation day header check)
- `enrollmentCounts`: `Map<activityId, number>` — active enrollment count per activity
- `schoolDay`: The school day record for the given date

**Rotation day header derivation:** Same as student — `allActivities.some(a => a.rotation_day_type != null)` determines whether the rotation label appears.

**TanStack Query key:** `['teacher-agenda', teacherId, dateStr]`

### New API Function: `getTeacherActivitiesForDate(teacherId, orgId)`

`src/api/agenda.js` — added alongside existing `getStudentActivitiesForDate`.

Fetches all activities where `teacher_id = teacherId OR monitor_id = teacherId` and `is_active = true`. Does NOT filter by date — returns all assigned activities with scheduling fields. Date filtering happens client-side via `activityMeetsToday`.

Also fetches active enrollment counts per activity (a count query on `enrollments` grouped by `activity_id`).

```js
export async function getTeacherActivitiesForDate(teacherId, orgId) {
  // Fetch activities where teacher is teacher_id or monitor_id
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('is_active', true)
    .eq('organization_id', orgId)
    .or(`teacher_id.eq.${teacherId},monitor_id.eq.${teacherId}`)

  if (error) throw error

  // Fetch enrollment counts for these activities
  const activityIds = data.map(a => a.id)
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('activity_id')
    .in('activity_id', activityIds)
    .eq('is_active', true)

  if (enrollError) throw enrollError

  const countMap = new Map()
  for (const e of enrollments) {
    countMap.set(e.activity_id, (countMap.get(e.activity_id) ?? 0) + 1)
  }

  return { activities: data, enrollmentCounts: countMap }
}
```

### New API Function: `getRosterForActivities(activityIds)`

`src/api/agenda.js` — fetches enrollment rosters for one or more activities.

```js
export async function getRosterForActivities(activityIds) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*, student:student_id(id, first_name, last_name, preferred_name)')
    .in('activity_id', activityIds)
    .eq('is_active', true)
    .order('student(last_name)', { ascending: true })

  if (error) throw error
  return data
}
```

**Note on RLS:** This query joins `user_profiles` via the `student_id` FK. The comprehensive RLS migration includes `"Teachers read own org profiles"` on `user_profiles`, which should allow this join. If the join triggers recursion (as happened during the student build), fall back to using `get_profile_display_info()` RPC as the student agenda does. Test during build.

### New API Function: `getAttendanceForInstances(instanceIds)`

`src/api/agenda.js` — fetches existing attendance records for given instances.

```js
export async function getAttendanceForInstances(instanceIds) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .in('activity_instance_id', instanceIds)

  if (error) throw error
  return data
}
```

### New API Function: `upsertAttendanceRecord(instanceId, studentId, status, markedById)`

`src/api/agenda.js` — creates or updates a single attendance record.

```js
export async function upsertAttendanceRecord(instanceId, studentId, status, markedById) {
  const { data, error } = await supabase
    .from('attendance_records')
    .upsert(
      {
        activity_instance_id: instanceId,
        student_id: studentId,
        status,
        marked_by_id: markedById,
        marked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'activity_instance_id,student_id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}
```

### New Hook: `useRoster(activityIds, date, orgId)`

`src/hooks/useRoster.js`

Fetches the enrollment roster and existing attendance records for the given activities on the given date. Used by the roster modal.

**Returns:** `{ students, attendanceByStudent, instances, isLoading, error }`

- `students`: Array of `{ studentId, firstName, lastName, preferredName, activityId, activityName, activityLocation, requiresAttendance }` — flattened from enrollments, sorted by last name
- `attendanceByStudent`: `Map<studentId, { status, recordId }>` — existing attendance state from DB
- `instances`: `Map<activityId, instanceId>` — instance IDs needed for upsert (fetch or create via `getInstancesForDate` or the existing upsert)

**Query strategy:**
1. Fetch enrollments with student profiles via `getRosterForActivities(activityIds)`
2. Fetch activity instances for these activities on this date via `getInstancesForDate(orgId, date)` filtered to the relevant activity IDs
3. Fetch existing attendance records for those instances via `getAttendanceForInstances(instanceIds)`
4. Build the `attendanceByStudent` map from the attendance records

**TanStack Query key:** `['roster', activityIds.sort().join(','), dateStr]`

### Existing Hook/API Reuse

- `useSchoolDays(orgId, date, date)` from `src/hooks/useSchoolDays.js` — school day record for rotation matching
- `useOrgSettings(orgId)` from `src/hooks/useOrgSettings.js` — block count, block labels, rotation day names
- `useDefaultScheduleTemplate(orgId)` from `src/hooks/useScheduleTemplate.js` — block time definitions for overlay
- `ensureActivityInstances` from `src/api/agenda.js` — batch instance upsert
- `activityMeetsToday` from `src/lib/scheduleUtils.js` — date filtering predicate
- `groupActivitiesByBlock` from `src/components/agenda/agendaUtils.js` — block grouping
- `getBlockLabel` from `src/lib/constants.js` — block label resolution

---

## Component Structure

### New Files

| File | Purpose |
|------|---------|
| `src/pages/teacher/Dashboard.jsx` | Replace existing placeholder. Page component with date nav, block grouping, and agenda grid. |
| `src/components/agenda/TeacherActivityCard.jsx` | Teacher-specific card component — handles both single and aggregate rendering via props. |
| `src/components/roster/RosterModal.jsx` | Modal with student list, attendance buttons, and save. |
| `src/hooks/useTeacherAgenda.js` | Fetches teacher's assigned activities for a date. |
| `src/hooks/useRoster.js` | Fetches enrollment roster and attendance for roster modal. |

### Existing Files Modified

| File | Change |
|------|--------|
| `src/api/agenda.js` | Add `getTeacherActivitiesForDate`, `getRosterForActivities`, `getAttendanceForInstances`, `upsertAttendanceRecord` |

### Component Hierarchy

```
Dashboard
├── DateNavHeader (inline — prev/next buttons + date label + conditional rotation day)
├── SingleDayAgenda (existing shared wrapper)
│   ├── Time axis (left)
│   ├── AgendaBlockOverlay (existing — renders block bands)
│   ├── Hour grid lines
│   └── Positioned cards (via renderCard prop)
│       └── TeacherActivityCard (one per activity or block group)
│           ├── Single mode: name, time/block/location, enrollment count
│           └── Aggregate mode: block label + icon, time range, activity count + enrollment count
├── RosterModal (opens on card click)
│   ├── Modal header (activity name or block label + icon)
│   ├── Roster body (student rows with attendance buttons)
│   └── Modal footer (Cancel + Save)
└── Empty state (shown on non-school days or when no activities)
```

---

## Dashboard Page Component

`src/pages/teacher/Dashboard.jsx`

```
function Dashboard() {
  const [date, setDate] = useState(new Date())
  const [rosterTarget, setRosterTarget] = useState(null) // { activities, isAggregate }
  const profile = useAuthStore(s => s.profile)
  const orgId = profile?.organization_id
  const teacherId = profile?.id

  // Data hooks
  const { activities, allActivities, enrollmentCounts, schoolDay, isLoading, error } =
    useTeacherAgenda(teacherId, date, orgId)
  const { data: orgSettings } = useOrgSettings(orgId)
  const { data: template } = useDefaultScheduleTemplate(orgId)

  // Instance upsert (fire-and-forget)
  useEffect(() => {
    if (activities.length > 0) {
      ensureActivityInstances(
        activities.map(a => a.id), orgId, formatDateISO(date)
      ).catch(console.error)
    }
  }, [activities, orgId, date])

  // Date navigation (same as TodayView)
  const goToPrev = () => setDate(d => subDays(d, 1))
  const goToNext = () => setDate(d => addDays(d, 1))
  const isToday = isSameDay(date, new Date())

  // Rotation day display (same logic as TodayView)
  const usesRotation = allActivities?.some(a => a.rotation_day_type != null) ?? false
  const rotationLabel = usesRotation && schoolDay?.rotation_day
    ? schoolDay.rotation_day + ' Day' : null

  // Block overlay data
  const blockDefinitions = (template?.block_definitions ?? [])
    .filter(d => d.start_time && d.end_time)
  const blockLabels = orgSettings?.block_labels ?? []

  // --- Block grouping and aggregate synthesis ---
  const displayItems = useMemo(() => {
    const blockGroups = groupActivitiesByBlock(activities, extractDOW(date))
    const items = []

    for (const [blockKey, groupActivities] of blockGroups) {
      if (groupActivities.length === 1) {
        // Single activity — pass through with enrollment count attached
        const activity = groupActivities[0]
        items.push({
          ...activity,
          isAggregate: false,
          enrollmentCount: enrollmentCounts.get(activity.id) ?? 0,
        })
      } else {
        // Aggregate — synthesize a combined item
        const starts = groupActivities
          .map(a => a.default_start_time).filter(Boolean)
        const ends = groupActivities
          .map(a => a.default_end_time).filter(Boolean)
        const earliestStart = starts.reduce((a, b) => a < b ? a : b)
        const latestEnd = ends.reduce((a, b) => a > b ? a : b)
        const totalEnrollment = groupActivities.reduce(
          (sum, a) => sum + (enrollmentCounts.get(a.id) ?? 0), 0
        )

        items.push({
          id: `agg-${blockKey}`,
          isAggregate: true,
          block: blockKey === 'null' ? null : Number(blockKey),
          activities: groupActivities,
          activityCount: groupActivities.length,
          totalEnrollment,
          default_start_time: earliestStart,
          default_end_time: latestEnd,
        })
      }
    }

    return items.sort((a, b) => {
      if (!a.default_start_time || !b.default_start_time) return 0
      return a.default_start_time.localeCompare(b.default_start_time)
    })
  }, [activities, enrollmentCounts, date])

  // Grid bounds (same pattern as TodayView)
  // ...

  // Render card function
  const renderCard = (item) => (
    <TeacherActivityCard
      item={item}
      blockLabels={blockLabels}
      onClick={() => handleCardClick(item)}
    />
  )

  // Card click → open roster modal
  function handleCardClick(item) {
    if (item.isAggregate) {
      setRosterTarget({ activities: item.activities, isAggregate: true })
    } else {
      setRosterTarget({ activities: [item], isAggregate: false })
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Date nav header (same structure as TodayView) */}
      {/* SingleDayAgenda with displayItems */}
      {/* Empty state */}
      {/* Roster modal */}
      {rosterTarget && (
        <RosterModal
          activities={rosterTarget.activities}
          isAggregate={rosterTarget.isAggregate}
          date={date}
          orgId={orgId}
          teacherId={teacherId}
          blockLabels={blockLabels}
          onClose={() => setRosterTarget(null)}
        />
      )}
    </div>
  )
}
```

**Note on `groupActivitiesByBlock` and teacher view:** The existing `groupActivitiesByBlock` in `agendaUtils.js` calls `activityMeetsDay(activity, dayValue)` internally, which checks `days_of_week`. However, the teacher hook already filters activities through `activityMeetsToday` (which is a superset check including rotation day, date range, school day status, etc.). So by the time activities reach the grouping function, they've already been filtered. The `activityMeetsDay` check inside `groupActivitiesByBlock` is redundant but harmless — it checks `days_of_week` inclusion which will be true for any activity that passed `activityMeetsToday`. If this causes issues (e.g. activities that use `rotation_day_type` instead of `days_of_week` being filtered out by the `activityMeetsDay` check), the teacher page can use a simpler grouping that just groups by block without re-checking day-of-week:

```js
function groupByBlock(activities) {
  const map = new Map()
  for (const a of activities) {
    const key = a.block ?? 'null'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  return map
}
```

This may be safer. Decision: use the simpler `groupByBlock` in the teacher page component, since `activityMeetsToday` has already done all the filtering.

---

## Build Sequence

Build bottom-up so each piece can be tested independently.

1. **`src/api/agenda.js` additions** — add `getTeacherActivitiesForDate`, `getRosterForActivities`, `getAttendanceForInstances`, `upsertAttendanceRecord`. These are straightforward Supabase queries. Test against the existing database with a teacher account.

2. **`src/hooks/useTeacherAgenda.js`** — wraps the API call with TanStack Query, fetches the school day record, applies `activityMeetsToday` filtering, sorts by `default_start_time`. Returns activities, allActivities, enrollmentCounts, schoolDay. Pattern mirrors `useStudentAgenda.js`.

3. **`src/hooks/useRoster.js`** — fetches enrollments + student profiles + instances + attendance records for given activity IDs and date. Returns flattened student list with attendance state. This hook is used by `RosterModal` on open.

4. **`src/components/agenda/TeacherActivityCard.jsx`** — single component that handles both single and aggregate rendering based on `item.isAggregate`. Accepts `onClick` prop for roster modal trigger.

5. **`src/components/roster/RosterModal.jsx`** — DaisyUI modal with dynamic header (single vs aggregate), student roster with P/A/E/T buttons, local state for pending changes, save button with batch upsert. This is the most complex new component.

6. **`src/pages/teacher/Dashboard.jsx`** — assemble the page: date nav header (same pattern as TodayView), block grouping logic, `SingleDayAgenda` with `renderCard`, roster modal state, instance upsert effect, empty state.

---

## Out of Scope (deferred to later specs)

- Check-in data display in roster (showing which students have checked in, geofence validation status)
- Presence wave counts and indicators on cards or in roster
- Status updates panel
- Posts and post responses
- Real-time attendance updates (Supabase Realtime)
- Teacher-initiated status prompts
- Mobile-optimized layout
- Block overlay visibility fix (#16 — separate issue)
- Block label placement fix (#13 — separate issue)
- Bulk attendance actions (mark all present, etc.)
- Confirmation dialog on cancel with pending changes
- Schedule template–derived times (block times shift on delay days)

---

## Resolved Decisions

Decisions made during spec review, documented here for context.

1. **Simplified two-tier density.** No "few" mode. 1 activity = single card, 2+ = always aggregate. Teacher's mental model is "managing Block X" as a unit.

2. **Aggregate card click → roster modal directly.** No expand-to-individual-cards like the admin view. The teacher wants to see and manage the combined roster, not drill into individual activity cards.

3. **Attendance save via explicit save button.** Not instant/optimistic upsert on each button click. Local state toggles immediately for responsive UI; database upsert happens on save. This is simpler to troubleshoot and more forgiving of misclicks.

4. **No property icons on teacher cards for v1.** The most relevant flag (`requires_checkin`) is deferred until check-in features are built. Icons can be added later without changing card structure.

5. **No monitor vs. teacher role distinction on cards.** A teacher sees all their assigned activities regardless of whether they're `teacher_id` or `monitor_id`. No visual differentiation needed for v1.

6. **Non-attendance activities show read-only roster.** If a teacher clicks a card for an activity without `requires_attendance`, the roster modal opens but shows students in informational mode without attendance buttons.

7. **Simpler groupByBlock for teacher view.** Instead of reusing `groupActivitiesByBlock` from `agendaUtils` (which re-checks `days_of_week`), use a plain group-by-block function since `activityMeetsToday` has already filtered the activities.

8. **Roster modal student sort.** Sort by last name across all activities in the group, not grouped by activity. The activity label column disambiguates which activity each student belongs to.

---

## Follow-Up Tasks (outside this spec)

- **Re-add `ensureActivityInstances` to student `TodayView`.** The `useEffect` was lost during the session 13 build. Add it back with the same fire-and-forget pattern used in this spec's teacher view.
- **Block overlay visibility (#16).** The overlay renders but is invisible behind cards. Needs z-index or visual treatment adjustment. Affects both student and teacher views.
- **Block label placement (#13).** Admin agenda block filter labels are misplaced at the bottom. Consider pill-style labels outside the grid for all views.