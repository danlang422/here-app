# Teacher Agenda 86.4 — Block Attendance Affordance + Combined Roster (Build Spec)

**Date:** May 20, 2026
**Status:** Build spec
**Implements:** `teacher-agenda-86.4-block-attendance-and-combined-roster-design.md`
**Depends on:** 86.1 (SingleDayAgenda), 86.2 (Dashboard rewrite), 86.3 (late-arrival roster split)

---

## What this spec covers

1. A row of block buttons in `Dashboard.jsx` above the agenda, one per block where the viewer has activities today
2. A new `BlockRosterModal` component — combined roster modal with one section per activity in the selected block

---

## Architecture decisions

**New component, not RosterModal extension.** `RosterModal` operates with a flat student list and `pendingChanges` keyed by `studentId`. The combined roster needs per-activity sections and `pendingChanges` keyed by `studentId::activityId` (because a student might appear in multiple sections). A new `BlockRosterModal` is cleaner than grafting section-awareness onto `RosterModal`.

**Extract shared sub-components.** `StudentRow`, `CheckInIcon`, `formatTimestamp`, and `STATUS_OPTIONS` move from `RosterModal.jsx` to `src/components/roster/RosterRow.jsx`. Both modals import from there. `RosterModal` imports `formatTime` from `agendaUtils` instead of defining it locally.

**Block time ranges from `useDefaultScheduleTemplate`.** `orgSettings` doesn't store block times — they live in `defaultTemplate.block_definitions` (array of `{ block: number, start_time: string, end_time: string }`). Dashboard adds `useDefaultScheduleTemplate(orgId)`.

**No `showFullRoster` toggle** in `BlockRosterModal`. The combined modal shows today's students (`todayStudents`) per section. Full-roster browsing belongs in the standalone modal.

**Known limitation: `attendanceByStudent` collision.** `useRoster` keys `attendanceByStudent` by `studentId` only. If the same student has attendance records in two activities (rare: same student in two of this teacher's block activities), the map holds only the last record. The pending-changes toggle logic uses this as the "initial state" baseline — it may behave imperfectly in this edge case. Accepted for 86.4; out of scope to fix `useRoster` internals here.

---

## Files changed

| File | Change |
|------|--------|
| `src/components/roster/RosterRow.jsx` | **New** — extract `StudentRow`, `CheckInIcon`, `formatTimestamp`, `STATUS_OPTIONS` from `RosterModal` |
| `src/components/roster/RosterModal.jsx` | Update imports (from `RosterRow.jsx`, `formatTime` from `agendaUtils`); remove local definitions |
| `src/components/roster/BlockRosterModal.jsx` | **New** — combined multi-section roster modal |
| `src/pages/teacher/Dashboard.jsx` | Add `useDefaultScheduleTemplate`, add block button row, mount `BlockRosterModal` |

---

## Step 1 — Extract `RosterRow.jsx`

Create `src/components/roster/RosterRow.jsx` containing:

```jsx
import { HandWaving, CheckCircle, SignOut, Prohibit, NotePencil } from '@phosphor-icons/react'

export const STATUS_OPTIONS = [
  { key: 'present', label: 'P', fullLabel: 'Present', btnClass: 'btn-success' },
  { key: 'absent', label: 'A', fullLabel: 'Absent', btnClass: 'btn-error' },
  { key: 'excused', label: 'E', fullLabel: 'Excused', btnClass: 'btn-warning' },
  { key: 'tardy', label: 'T', fullLabel: 'Tardy', btnClass: 'btn-info' },
]

export function formatTimestamp(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function StudentRow({
  student,
  isAggregate,
  currentStatus,
  onToggle,
  actionData,
  onClick,
  isEven,
  timeAnnotation = null,
}) {
  const displayName = student.preferredName
    ? `${student.preferredName} ${student.lastName}`
    : `${student.firstName} ${student.lastName}`

  return (
    <div
      className={`flex items-center gap-2 py-2.5 px-2 rounded-lg cursor-pointer hover:bg-base-200/50 transition-colors ${
        isEven ? 'bg-base-200/30' : ''
      }`}
      onClick={onClick}
    >
      <div className="min-w-30 max-w-45 truncate font-medium">{displayName}</div>

      {isAggregate && (
        <div className="min-w-20 max-w-35 text-sm text-base-content/50 italic truncate">
          {student.activityName}
        </div>
      )}

      {timeAnnotation && (
        <span className="text-[11px] text-warning shrink-0">{timeAnnotation}</span>
      )}

      <div className="flex-1 flex items-center gap-1.5 justify-end">
        {actionData.wave && (
          <span className="text-success" title={`Waved at ${formatTimestamp(actionData.wave.waved_at)}`}>
            <HandWaving size={16} />
          </span>
        )}
        {actionData.checkIn && <CheckInIcon checkIn={actionData.checkIn} />}
        {actionData.checkIn?.geofence_validated === false && (
          <span className="text-error" title="Location check failed">
            <Prohibit size={16} />
          </span>
        )}
        {actionData.statusCount > 0 && (
          <span className="flex items-center gap-0.5 text-base-content/50" title={`${actionData.statusCount} status update(s)`}>
            <NotePencil size={14} />
            <span className="text-xs">({actionData.statusCount})</span>
          </span>
        )}
      </div>

      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        {!student.scheduledToday ? (
          <span className="text-xs text-base-content/30 shrink-0 italic">Not today</span>
        ) : student.requiresAttendance ? (
          <div className="flex items-center">
            {STATUS_OPTIONS.map(({ key, label, fullLabel, btnClass }) => (
              <button
                key={key}
                className={`btn btn-sm rounded-none first:rounded-l last:rounded-r ${
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
          <span className="text-sm text-base-content/40 shrink-0">No attendance</span>
        )}
      </div>
    </div>
  )
}

function CheckInIcon({ checkIn }) {
  if (checkIn.checked_out_at) {
    return (
      <span
        className="text-success"
        title={`Checked in ${formatTimestamp(checkIn.checked_in_at)}, out ${formatTimestamp(checkIn.checked_out_at)}`}
      >
        <SignOut size={16} />
      </span>
    )
  }
  return (
    <span className="text-success" title={`Checked in at ${formatTimestamp(checkIn.checked_in_at)}`}>
      <CheckCircle weight="fill" size={16} />
    </span>
  )
}
```

---

## Step 2 — Update `RosterModal.jsx`

Replace the local `STATUS_OPTIONS`, `StudentRow`, `CheckInIcon`, and `formatTimestamp` definitions with imports from `./RosterRow`. Replace the local `formatTime` with an import from `@/components/agenda/agendaUtils`.

```js
import { StudentRow, STATUS_OPTIONS } from './RosterRow'
import { formatTime } from '@/components/agenda/agendaUtils'
```

Remove the local `STATUS_OPTIONS` constant, `StudentRow` function, `CheckInIcon` function, `formatTimestamp` function, and `formatTime` function from the file. Everything else in `RosterModal.jsx` stays unchanged.

---

## Step 3 — `BlockRosterModal.jsx`

New file: `src/components/roster/BlockRosterModal.jsx`

### Props

```ts
{
  blockNum: number
  blockLabel: string
  blockTimeRange: string | null    // e.g. "8a – 9a"; null if org hasn't defined block times
  activities: Activity[]           // already filtered to this block, from Dashboard
  date: Date
  orgId: string
  teacherId: string
  blockLabels: any[]
  actionSummary: object | null
  schoolDay: object | null
  enrollmentCounts: Map            // activityId → enrollment count (for prep detection)
  onClose: () => void
}
```

### Imports

```js
import { useState, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRoster } from '@/hooks/useRoster'
import { upsertAttendanceRecord } from '@/api/agenda'
import { getBlockLabel } from '@/lib/constants'
import { getViewerRole } from '@/lib/staffRoles'
import { formatDateISO } from '@/lib/scheduleUtils'
import { formatTimeRange, formatTime } from '@/components/agenda/agendaUtils'
import { StudentRow } from './RosterRow'
```

### Role badge

Define a local `ROLE_BADGE` and `RoleBadge` matching `TeacherActivityCard.jsx`:

```js
const ROLE_BADGE = {
  teacher: { label: 'Teacher', className: 'bg-primary/15 text-primary' },
  monitor: { label: 'Monitor', className: 'bg-secondary/15 text-secondary' },
  prep:    { label: 'Prep',    className: 'bg-base-200 text-base-content/50' },
}

function RoleBadge({ role }) {
  const cfg = ROLE_BADGE[role] ?? ROLE_BADGE.teacher
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0 ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}
```

### Activity ordering

```js
const ROLE_PRIORITY = { teacher: 0, prep: 1, monitor: 2 }

function deriveRole(activity, viewerId, enrollmentCounts) {
  const raw = getViewerRole(activity, viewerId)
  if (raw === 'teacher' && (enrollmentCounts?.get(activity.id) ?? 0) === 0) return 'prep'
  return raw ?? 'teacher'
}
```

Sort activities once (stable) at the start of the component:

```js
const orderedActivities = useMemo(() => {
  return [...activities].sort((a, b) => {
    const priA = ROLE_PRIORITY[deriveRole(a, teacherId, enrollmentCounts)] ?? 3
    const priB = ROLE_PRIORITY[deriveRole(b, teacherId, enrollmentCounts)] ?? 3
    if (priA !== priB) return priA - priB
    const timeCmp = (a.default_start_time ?? '').localeCompare(b.default_start_time ?? '')
    if (timeCmp !== 0) return timeCmp
    return a.id.localeCompare(b.id)
  })
}, [activities, teacherId, enrollmentCounts])
```

### Data fetching

One `useRoster` call for all activities in this block:

```js
const activityIds = activities.map((a) => a.id)
const { todayStudents, allStudents, attendanceByStudent, instances, isLoading, error } =
  useRoster(activityIds, date, orgId, activities, schoolDay)
```

### Pending changes — composite key

```js
const [pendingChanges, setPendingChanges] = useState(new Map()) // key: `${studentId}::${activityId}`
const [saving, setSaving] = useState(false)
const queryClient = useQueryClient()
```

```js
function getStudentStatus(studentId, activityId) {
  return (
    pendingChanges.get(`${studentId}::${activityId}`) ??
    attendanceByStudent.get(studentId)?.status ??
    null
  )
}

function toggleAttendance(studentId, activityId, status) {
  const key = `${studentId}::${activityId}`
  setPendingChanges((prev) => {
    const next = new Map(prev)
    const initial = attendanceByStudent.get(studentId)?.status ?? null
    const currentPending = next.get(key)
    if (currentPending === status || status === initial) {
      next.delete(key)
    } else {
      next.set(key, status)
    }
    return next
  })
}

function markSectionPresent(activityId) {
  const sectionStudents = todayStudents.filter((s) => s.activityId === activityId)
  setPendingChanges((prev) => {
    const next = new Map(prev)
    for (const student of sectionStudents) {
      if (!student.scheduledToday || !student.requiresAttendance) continue
      const key = `${student.studentId}::${activityId}`
      const existing = attendanceByStudent.get(student.studentId)?.status ?? null
      if (!existing && !next.has(key)) {
        next.set(key, 'present')
      }
    }
    return next
  })
}
```

### Save

```js
async function handleSave() {
  setSaving(true)
  try {
    const upserts = []
    for (const [compositeKey, status] of pendingChanges) {
      const separatorIdx = compositeKey.indexOf('::')
      const studentId = compositeKey.slice(0, separatorIdx)
      const activityId = compositeKey.slice(separatorIdx + 2)
      const instanceId = instances.get(activityId)
      if (!instanceId) continue
      upserts.push(upsertAttendanceRecord(instanceId, studentId, status, teacherId))
    }
    await Promise.all(upserts)
    const dateStr = formatDateISO(date)
    queryClient.invalidateQueries({ queryKey: ['roster'] })
    queryClient.invalidateQueries({ queryKey: ['teacher-agenda', teacherId, dateStr] })
    queryClient.invalidateQueries({ queryKey: ['teacher-action-summary'] })
    onClose()
  } catch (err) {
    console.error('Failed to save block attendance:', err)
    setSaving(false)
  }
}
```

### Escape key handler

```js
useEffect(() => {
  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [onClose])
```

### `getActionData` helper

Same shape as `RosterModal.getActionData`:

```js
function getActionData(student) {
  if (!actionSummary) return { wave: null, checkIn: null, statusCount: 0 }
  const key = `${student.studentId}-${student.activityId}`
  return {
    wave: actionSummary.waves?.get(key) ?? null,
    checkIn: actionSummary.checkIns?.get(key) ?? null,
    statusCount: actionSummary.statusCounts?.get(key) ?? 0,
  }
}
```

### `ActivitySectionHeader` sub-component

```jsx
function ActivitySectionHeader({ activity, role, blockLabels, onMarkAllPresent }) {
  const timeRange = formatTimeRange(activity.default_start_time, activity.default_end_time)
  const blockLabel = activity.block?.length
    ? activity.block.map((b) => getBlockLabel(b, blockLabels)).join(', ')
    : null

  return (
    <div className="px-2 pb-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm">{activity.name}</span>
        <RoleBadge role={role} />
        <button
          className="text-xs text-primary underline-offset-2 hover:underline ml-auto"
          onClick={onMarkAllPresent}
        >
          Mark all P
        </button>
      </div>
      {(timeRange || blockLabel) && (
        <div className="flex items-center gap-1.5 text-xs text-base-content/50 mt-0.5">
          {timeRange && <span>{timeRange}</span>}
          {timeRange && blockLabel && <span>·</span>}
          {blockLabel && <span>{blockLabel}</span>}
        </div>
      )}
    </div>
  )
}
```

### JSX structure

```jsx
return (
  <dialog className="modal modal-open">
    <div className="modal-box max-w-2xl">
      {/* Header */}
      <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" onClick={onClose}>
        ✕
      </button>
      <div className="mb-4">
        <h3 className="font-bold text-lg">{blockLabel} attendance</h3>
        <p className="text-sm text-base-content/60">
          {blockTimeRange ?? ''}{blockTimeRange && ` · `}{orderedActivities.length} activit{orderedActivities.length === 1 ? 'y' : 'ies'}
        </p>
      </div>

      <div className="divider my-0" />

      {/* Body */}
      <div className="py-4 max-h-[65vh] overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md" />
          </div>
        )}
        {error && (
          <div className="text-error text-center py-4">Failed to load roster.</div>
        )}
        {!isLoading && !error && orderedActivities.map((activity, actIdx) => {
          const role = deriveRole(activity, teacherId, enrollmentCounts)
          const sectionStudents = todayStudents.filter((s) => s.activityId === activity.id)
          const onTimeSectionStudents = sectionStudents.filter((s) => s.startTimeOverride == null)
          const lateSectionStudents = sectionStudents
            .filter((s) => s.startTimeOverride != null)
            .sort((a, b) => {
              const t = a.startTimeOverride.localeCompare(b.startTimeOverride)
              return t !== 0 ? t : a.lastName.localeCompare(b.lastName)
            })

          return (
            <div key={activity.id}>
              {actIdx > 0 && <div className="divider my-2" />}
              <ActivitySectionHeader
                activity={activity}
                role={role}
                blockLabels={blockLabels}
                onMarkAllPresent={() => markSectionPresent(activity.id)}
              />
              {sectionStudents.length === 0 && (
                <p className="text-base-content/40 text-sm text-center py-4">No students scheduled today.</p>
              )}
              {onTimeSectionStudents.map((student, idx) => (
                <StudentRow
                  key={`${student.studentId}-${student.activityId}`}
                  student={student}
                  isAggregate={false}
                  currentStatus={getStudentStatus(student.studentId, student.activityId)}
                  onToggle={(sId, status) => toggleAttendance(sId, activity.id, status)}
                  actionData={getActionData(student)}
                  onClick={() => {}}
                  isEven={idx % 2 === 1}
                  timeAnnotation={student.endTimeOverride ? `leaves ${formatTime(student.endTimeOverride)}` : null}
                />
              ))}
              {lateSectionStudents.length > 0 && (
                <>
                  <div className="divider my-1" />
                  <div className="px-2 py-1">
                    <span className="text-sm font-medium text-warning">Arriving later</span>
                  </div>
                  {lateSectionStudents.map((student, idx) => {
                    const annotation = student.endTimeOverride
                      ? `arrives ${formatTime(student.startTimeOverride)} · leaves ${formatTime(student.endTimeOverride)}`
                      : `arrives ${formatTime(student.startTimeOverride)}`
                    return (
                      <StudentRow
                        key={`${student.studentId}-${student.activityId}`}
                        student={student}
                        isAggregate={false}
                        currentStatus={getStudentStatus(student.studentId, student.activityId)}
                        onToggle={(sId, status) => toggleAttendance(sId, activity.id, status)}
                        actionData={getActionData(student)}
                        onClick={() => {}}
                        isEven={idx % 2 === 1}
                        timeAnnotation={annotation}
                      />
                    )
                  })}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="modal-action">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary"
          disabled={pendingChanges.size === 0 || saving}
          onClick={handleSave}
        >
          {saving && <span className="loading loading-spinner loading-xs" />}
          {pendingChanges.size > 0 ? `Save (${pendingChanges.size})` : 'Save'}
        </button>
      </div>
    </div>
    <form method="dialog" className="modal-backdrop">
      <button onClick={onClose}>close</button>
    </form>
  </dialog>
)
```

---

## Step 4 — Dashboard changes

### New imports

```js
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import BlockRosterModal from '@/components/roster/BlockRosterModal'
import { getBlockLabel } from '@/lib/constants'
import { formatTimeRange } from '@/components/agenda/agendaUtils'
```

(`getBlockLabel` is already used indirectly via `blockLabels` pass-through — if it wasn't imported, add it. `formatTimeRange` is already imported.)

### New hook call (after `useOrgSettings`)

```js
const { data: defaultTemplate } = useDefaultScheduleTemplate(orgId)
```

### New state

```js
const [blockRosterTarget, setBlockRosterTarget] = useState(null) // blockNum | null
```

### `visibleBlocks` memo

```js
const visibleBlocks = useMemo(() => {
  const blockSet = new Set(activities.flatMap((a) => a.block ?? []))
  return [...blockSet].sort((a, b) => a - b)
}, [activities])
```

### Block button row JSX

Insert between the "Today shortcut" block and the loading spinner, so it shows above the agenda:

```jsx
{/* Block attendance buttons */}
{!isLoading && visibleBlocks.length > 0 && (
  <div className="flex gap-2 flex-wrap mb-4">
    {visibleBlocks.map((blockNum) => {
      const label = getBlockLabel(blockNum, blockLabels)
      const def = defaultTemplate?.block_definitions?.find((d) => d.block === blockNum)
      const timeRange = def?.start_time && def?.end_time
        ? formatTimeRange(def.start_time, def.end_time)
        : null
      return (
        <button
          key={blockNum}
          className="btn btn-outline btn-sm flex flex-col items-start gap-0 h-auto py-1.5 px-3 min-w-[80px]"
          onClick={() => setBlockRosterTarget(blockNum)}
        >
          <span className="font-semibold text-xs leading-tight">{label}</span>
          {timeRange && (
            <span className="text-[10px] text-base-content/50 font-normal leading-tight">{timeRange}</span>
          )}
        </button>
      )
    })}
  </div>
)}
```

### BlockRosterModal mount

After the existing `{rosterTarget && <RosterModal ... />}` block:

```jsx
{blockRosterTarget !== null && (
  <BlockRosterModal
    blockNum={blockRosterTarget}
    blockLabel={getBlockLabel(blockRosterTarget, blockLabels)}
    blockTimeRange={(() => {
      const def = defaultTemplate?.block_definitions?.find((d) => d.block === blockRosterTarget)
      return def?.start_time && def?.end_time ? formatTimeRange(def.start_time, def.end_time) : null
    })()}
    activities={activities.filter((a) => a.block?.includes(blockRosterTarget))}
    date={date}
    orgId={orgId}
    teacherId={teacherId}
    blockLabels={blockLabels}
    actionSummary={actionSummary}
    schoolDay={schoolDay}
    enrollmentCounts={enrollmentCounts}
    onClose={() => setBlockRosterTarget(null)}
  />
)}
```

Note: the `blockTimeRange` IIFE can also be extracted into a helper to keep JSX clean; implementer's call.

---

## Acceptance criteria

- [ ] Block buttons appear above the agenda when viewer has ≥1 activity with a block assignment today
- [ ] One button per block (multi-block activities produce buttons for each of their blocks)
- [ ] Buttons show block label; show block time range when `defaultTemplate.block_definitions` has that block's times
- [ ] No button row on days with no activities, or when all activities have no block assignments
- [ ] Clicking a button opens `BlockRosterModal`
- [ ] Modal header shows block label + time range + activity count
- [ ] One section per activity in the block, ordered teacher → prep → monitor, then start time, then id
- [ ] Each section has: activity name, time range, role badge, "Mark all P" button, block label(s)
- [ ] On-time / arriving-later split per section (composes 86.3 pattern)
- [ ] PAET buttons work per-student per-section; pending changes keyed by `studentId::activityId`
- [ ] "Mark all P" scoped per section (does not cross activity boundaries)
- [ ] Save persists all pending changes, invalidates `roster`, `teacher-agenda`, `teacher-action-summary`
- [ ] Escape and backdrop click close the modal
- [ ] Standalone roster modals (via card clicks) unchanged — no regression

---

## What this spec does not cover

- Sticky sub-headers within the combined roster (out of scope per design doc)
- Student detail overlay in `BlockRosterModal` (added in the future if needed; `onClick={() => {}}` is intentional)
- The sidebar (86.5)
