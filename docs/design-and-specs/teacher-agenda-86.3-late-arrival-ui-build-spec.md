# Teacher Agenda 86.3 — Late-Arrival UI (Build Spec)

**Date:** May 20, 2026
**Status:** Implemented
**Issue:** UI side of #87. Sub-area of #86.
**Design doc:** `teacher-agenda-86.3-late-arrival-ui-design.md`
**Depends on:** #86.2 committed.

---

## What this changes

Surfaces `start_time_override`/`end_time_override` (already on `enrollments`, already
fetched by `getRosterForActivities`) in two new places:

1. **Late-arrival chip** on agenda cards and cluster popover member cards.
2. **"Arriving later" section** in the roster modal body.

No schema changes. No new API routes.

---

## Files changed

| File | Change |
|------|--------|
| `src/api/agenda.js` | Add `start_time_override` to `getTeacherActivitiesForDate` enrollment select |
| `src/hooks/useTeacherAgenda.js` | Compute and return `lateArrivals` map |
| `src/components/agenda/agendaUtils.js` | Update `buildTeacherRenderables` to accept and embed late-arrival data |
| `src/pages/teacher/Dashboard.jsx` | Thread `lateArrivals` into `buildTeacherRenderables` and `ClusterPopover` |
| `src/components/agenda/TeacherActivityCard.jsx` | Add `LateArrivalChip`, add chip to `SoloCard` and `ClusterCard` |
| `src/components/agenda/ClusterPopover.jsx` | Pass per-activity late data to `MemberCard`, add chip |
| `src/hooks/useRoster.js` | Pass `startTimeOverride`/`endTimeOverride` through to student objects |
| `src/components/roster/RosterModal.jsx` | Split body into on-time / arriving-later sections |

---

## 1. `src/api/agenda.js` — add `start_time_override` to agenda fetch

`getTeacherActivitiesForDate` fetches enrollments for the chip's count and earliest-time
computation. Add `start_time_override` to that select:

```js
const { data: enrollments, error: enrollError } = await supabase
  .from('enrollments')
  .select('activity_id, days_of_week, rotation_day_type, recurrence_interval, recurrence_anchor_date, start_time_override')
  .in('activity_id', activityIds)
  .eq('is_active', true)
```

No other change to this function. `getRosterForActivities` already selects both
`start_time_override` and `end_time_override` — no change needed there.

---

## 2. `src/hooks/useTeacherAgenda.js` — compute `lateArrivals`

Add a `lateArrivals` useMemo after `enrollmentCounts`. It maps each activity ID to
`{ count, earliestTime }` for enrollments that both meet today and have a non-null
`start_time_override`.

```js
const lateArrivals = useMemo(() => {
  const map = new Map()
  for (const [activityId, activityEnrollments] of rawEnrollmentsByActivity) {
    const activity = allActivities.find((a) => a.id === activityId)
    const todayEnrollments =
      activity && schoolDay
        ? activityEnrollments.filter((e) => enrollmentMeetsToday(e, activity, date, schoolDay))
        : activityEnrollments
    const lateOnes = todayEnrollments.filter((e) => e.start_time_override != null)
    if (lateOnes.length === 0) continue
    const earliest = lateOnes
      .map((e) => e.start_time_override)
      .reduce((a, b) => (a < b ? a : b))
    map.set(activityId, { count: lateOnes.length, earliestTime: earliest })
  }
  return map
}, [rawEnrollmentsByActivity, allActivities, schoolDay, date])
```

Add `lateArrivals` to the hook's return object:

```js
return {
  activities,
  allActivities,
  enrollmentCounts,
  lateArrivals,
  schoolDay,
  isLoading: ...,
  error: ...,
}
```

---

## 3. `src/components/agenda/agendaUtils.js` — update `buildTeacherRenderables`

Add `lateArrivals` as a fourth parameter. Embed `lateCount` and `earliestArrival` on
each renderable unit.

```js
export function buildTeacherRenderables(activities, enrollmentCounts, viewerId, lateArrivals) {
  ...
  // Solo case — inside the if (groupItems.length === 1) branch:
  const late = lateArrivals?.get(activity.id)
  renderables.push({
    id: activity.id,
    default_start_time: activity.default_start_time,
    default_end_time: activity.default_end_time,
    role,
    isCluster: false,
    activity,
    enrollmentCount,
    lateCount: late?.count ?? 0,
    earliestArrival: late?.earliestTime ?? null,
  })

  // Cluster case — inside the else branch, before the renderables.push:
  let totalLate = 0
  let clusterEarliest = null
  for (const { activity: a } of groupItems) {
    const late = lateArrivals?.get(a.id)
    if (late) {
      totalLate += late.count
      if (!clusterEarliest || late.earliestTime < clusterEarliest) {
        clusterEarliest = late.earliestTime
      }
    }
  }

  renderables.push({
    id: `cluster-...`,
    ...
    lateCount: totalLate,
    earliestArrival: clusterEarliest,
  })
}
```

All other fields on each renderable type are unchanged from 86.2.

---

## 4. `src/pages/teacher/Dashboard.jsx` — thread `lateArrivals`

### Destructure `lateArrivals` from the hook

```js
const { activities, allActivities, enrollmentCounts, lateArrivals, schoolDay, isLoading, error } =
  useTeacherAgenda(teacherId, date, orgId)
```

### Pass to `buildTeacherRenderables`

```js
const renderables = useMemo(
  () => buildTeacherRenderables(activities, enrollmentCounts, teacherId, lateArrivals),
  [activities, enrollmentCounts, teacherId, lateArrivals]
)
```

### Pass to `ClusterPopover`

```jsx
{clusterPopover && (
  <ClusterPopover
    renderable={clusterPopover.renderable}
    anchorRect={clusterPopover.anchorRect}
    blockLabels={blockLabels}
    lateArrivals={lateArrivals}
    onMemberClick={(activity) => { ... }}
    onClose={() => setClusterPopover(null)}
  />
)}
```

---

## 5. `src/components/agenda/TeacherActivityCard.jsx` — add `LateArrivalChip`

### Add import

```js
import { ArrowUDownLeft } from '@phosphor-icons/react'
```

### Add `LateArrivalChip` helper

```jsx
function LateArrivalChip({ count, earliestTime }) {
  if (!count) return null
  const time = formatTime(earliestTime)
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/15 text-warning shrink-0">
      <ArrowUDownLeft size={10} />
      <span>{count} arr {time}</span>
    </span>
  )
}
```

`formatTime` is already imported from `'./agendaUtils'`.

### Add chip to `SoloCard` — row 1

Replace the current row-1 div in `SoloCard`:

```jsx
{/* Row 1: role badge + late chip + time */}
<div className="flex items-center justify-between gap-1">
  <div className="flex items-center gap-1 min-w-0">
    <RoleBadge role={role} />
    <LateArrivalChip count={item.lateCount} earliestTime={item.earliestArrival} />
  </div>
  <span className="text-[11px] text-base-content/50 shrink-0 tabular-nums">
    {formatTimeRange(activity.default_start_time, activity.default_end_time)}
  </span>
</div>
```

### Add chip to `ClusterCard` — row 1

Same change: add `<LateArrivalChip count={item.lateCount} earliestTime={item.earliestArrival} />`
inside the left-side flex div (after the Stack icon):

```jsx
<div className="flex items-center gap-1 min-w-0">
  <RoleBadge role={item.role} />
  <Stack size={12} className="text-base-content/40 shrink-0" />
  <LateArrivalChip count={item.lateCount} earliestTime={item.earliestArrival} />
</div>
```

---

## 6. `src/components/agenda/ClusterPopover.jsx` — chip on member cards

### Add prop and import

```js
import { ArrowUDownLeft } from '@phosphor-icons/react'

function ClusterPopover({ renderable, anchorRect, blockLabels, lateArrivals, onMemberClick, onClose }) {
```

### Pass late data to `MemberCard`

```jsx
{renderable.activities.map((activity) => {
  const late = lateArrivals?.get(activity.id)
  return (
    <MemberCard
      key={activity.id}
      activity={activity}
      blockLabels={blockLabels}
      lateCount={late?.count ?? 0}
      earliestArrival={late?.earliestTime ?? null}
      onClick={() => {
        onClose()
        onMemberClick(activity)
      }}
    />
  )
})}
```

### Add chip to `MemberCard`

```jsx
function MemberCard({ activity, blockLabels, lateCount, earliestArrival, onClick }) {
  const timeRange = formatTimeRange(activity.default_start_time, activity.default_end_time)
  const blockLabel = activity.block?.length
    ? activity.block.map((b) => getBlockLabel(b, blockLabels)).join(', ')
    : null

  return (
    <div
      className="min-w-0 overflow-hidden bg-base-200/50 border border-base-300 rounded-xl p-2.5 cursor-pointer hover:bg-base-200 transition-colors"
      onClick={onClick}
    >
      <div className="font-medium text-sm leading-tight truncate">{activity.name}</div>
      <div className="text-xs text-base-content/50 mt-0.5">{timeRange}</div>
      {blockLabel && <div className="text-xs text-base-content/40 mt-0.5">{blockLabel}</div>}
      {lateCount > 0 && (
        <div className="flex items-center gap-0.5 mt-1 text-[10px] font-medium text-warning">
          <ArrowUDownLeft size={10} />
          <span>{lateCount} arr {formatTime(earliestArrival)}</span>
        </div>
      )}
    </div>
  )
}
```

`formatTime` is already imported from `'./agendaUtils'`.

---

## 7. `src/hooks/useRoster.js` — pass overrides through

In the `allStudents` map, add `startTimeOverride` and `endTimeOverride` to each student
object:

```js
const allStudents = rawEnrollments
  .map((e) => {
    ...
    return {
      studentId: e.student.id,
      firstName: e.student.first_name,
      lastName: e.student.last_name,
      preferredName: e.student.preferred_name,
      gradeLevel: e.student.grade_level ?? null,
      activityId: e.activity_id,
      activityName: activity?.name ?? '',
      activityLocation: activity?.location ?? null,
      requiresAttendance: activity?.requires_attendance ?? true,
      scheduledToday,
      startTimeOverride: e.start_time_override ?? null,
      endTimeOverride: e.end_time_override ?? null,
    }
  })
  .sort((a, b) => a.lastName.localeCompare(b.lastName))
```

No other changes to `useRoster`.

---

## 8. `src/components/roster/RosterModal.jsx` — arriving-later section

### Replace the student body rendering

The current `students.map(...)` block in the modal body gets replaced with a two-section
layout. Add the following logic before the return (inside the component, below existing
state/callback declarations):

```js
// Split display list into on-time and arriving-later
const displayStudents = showFullRoster ? allStudents : todayStudents
const onTimeStudents = displayStudents.filter((s) => s.startTimeOverride == null)
const lateStudents = displayStudents
  .filter((s) => s.startTimeOverride != null)
  .sort((a, b) => {
    const timeCmp = a.startTimeOverride.localeCompare(b.startTimeOverride)
    return timeCmp !== 0 ? timeCmp : a.lastName.localeCompare(b.lastName)
  })
```

Replace the `{!isLoading && !error && students.map(...)}` block with:

```jsx
{!isLoading && !error && (
  <>
    {/* On-time roster */}
    {onTimeStudents.map((student, index) => (
      <StudentRow
        key={`${student.studentId}-${student.activityId}`}
        student={student}
        isAggregate={isAggregate}
        currentStatus={getStudentStatus(student.studentId)}
        onToggle={toggleAttendance}
        actionData={getActionData(student)}
        onClick={() => handleRowClick(student)}
        isEven={index % 2 === 1}
        timeAnnotation={
          student.endTimeOverride
            ? `leaves ${formatTime(student.endTimeOverride)}`
            : null
        }
      />
    ))}

    {/* Arriving later section */}
    {lateStudents.length > 0 && (
      <>
        <div className="divider my-1" />
        <div className="flex items-baseline gap-1.5 px-2 py-1">
          <span className="text-sm font-medium text-warning">Arriving later</span>
          <span className="text-xs text-base-content/40">· from off-campus</span>
        </div>
        {lateStudents.map((student, index) => {
          const annotation = student.endTimeOverride
            ? `arrives ${formatTime(student.startTimeOverride)} · leaves ${formatTime(student.endTimeOverride)}`
            : `arrives ${formatTime(student.startTimeOverride)}`
          return (
            <StudentRow
              key={`${student.studentId}-${student.activityId}`}
              student={student}
              isAggregate={isAggregate}
              currentStatus={getStudentStatus(student.studentId)}
              onToggle={toggleAttendance}
              actionData={getActionData(student)}
              onClick={() => handleRowClick(student)}
              isEven={index % 2 === 1}
              timeAnnotation={annotation}
            />
          )
        })}
      </>
    )}
  </>
)}
```

Also update the "No students scheduled today" empty state to use `displayStudents.length === 0`
instead of `students.length === 0` (since the `students` variable is no longer used).

### Update `StudentRow` to show `timeAnnotation`

Add `timeAnnotation = null` to `StudentRow`'s props and render it in the icon zone, in
amber treatment, before the action icons:

```jsx
function StudentRow({
  student,
  isAggregate,
  currentStatus,
  onToggle,
  actionData,
  onClick,
  isEven,
  timeAnnotation = null,
}) {
  ...
  return (
    <div ...>
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

      {/* Time annotation (arrives / leaves) */}
      {timeAnnotation && (
        <span className="text-[11px] text-warning shrink-0">{timeAnnotation}</span>
      )}

      {/* Icon zone */}
      <div className="flex-1 flex items-center gap-1.5 justify-end">
        ...existing icons unchanged...
      </div>

      {/* PAET buttons */}
      ...unchanged...
    </div>
  )
}
```

### Replace `students` variable

Remove the existing `const students = showFullRoster ? allStudents : todayStudents` line.
The `displayStudents` split above replaces it. Update the `hasFilteredStudents` check:

```js
const hasFilteredStudents = todayStudents.length < allStudents.length
// (unchanged — still compares todayStudents to allStudents)
```

The "no students" empty states use `allStudents.length` and `displayStudents.length`:

```jsx
{!isLoading && !error && allStudents.length === 0 && (
  <p ...>No students enrolled.</p>
)}

{!isLoading && !error && allStudents.length > 0 && displayStudents.length === 0 && (
  <p ...>No students scheduled today. ...</p>
)}
```

---

## Edge cases

- **No overrides:** `lateArrivals` map is empty. All chips render nothing. Roster modal shows single section. Identical to current behavior.
- **`end_time_override` only:** Student is in `onTimeStudents` (no `startTimeOverride`). Row shows `leaves H:MM` annotation in amber. No separate section.
- **Both overrides:** Student is in `lateStudents` (has `startTimeOverride`). Row shows `arrives H:MM · leaves H:MM`.
- **All students have overrides:** `onTimeStudents` is empty, `lateStudents` has all. On-time section renders nothing; arriving-later section has full list. No awkward "0 students on time" label — the on-time section simply renders no rows.
- **`lateArrivals` is undefined:** Guarded by `lateArrivals?.get(...)` in all call sites. Renders no chip. Safe for cases where hook returns undefined briefly.

---

## Verification

1. **Chip appears:** On a day where Trevor has an activity with students whose `start_time_override` is set, the agenda card shows the amber chip with count and earliest time.
2. **Chip absent:** Cards for activities with no overrides show no chip.
3. **Cluster chip:** Click the "N Internships" cluster card header — the chip on the cluster card aggregates across all member activities.
4. **Popover member chip:** Open a cluster popover — member cards show their own per-activity chip if applicable.
5. **Roster section:** Open roster for an activity with a late-arriving student — "Arriving later · from off-campus" section appears below the on-time roster, with `arrives H:MM` annotation on the student row.
6. **P/A/E/T works in both sections** — toggle attendance on a late-arriving student, save.
7. **`end_time_override` only:** A student with only `end_time_override` appears in the on-time section with `leaves H:MM` annotation, not in the arriving-later section.
8. **No regression:** Allison's student TodayView unchanged. Trevor's cards with no overrides unchanged.
