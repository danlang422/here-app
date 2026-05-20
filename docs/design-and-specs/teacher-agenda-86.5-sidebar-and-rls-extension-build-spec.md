# Teacher Agenda 86.5 — Sidebar + RLS Extension (Build Spec)

**Date:** May 20, 2026
**Status:** Build spec — Path A confirmed, ready to implement
**Implements:** `teacher-agenda-86.5-sidebar-and-rls-extension-design.md`
**Depends on:** 86.1–86.4, `visible_to_all_staff` flag (#91), enrollment time overrides (#92)

---

## Path A confirmed

Write-access widening for `attendance_records` (Path A) is confirmed. Reasoning: admin determines which activities are `visible_to_all_staff`; that opt-in is the signal that any teacher in the org may engage with the activity, including marking attendance. The migration includes the write policy unconditionally.

---

## Architecture overview

### What's new

| Deliverable | Description |
|------------|-------------|
| RLS migration | New DEFINER helper + permissive read policies on `enrollments`, `activity_instances`, `attendance_records` for visible-to-all activities. Path A adds write access on `attendance_records`. |
| `getVisibleToAllActivitiesForDate` | New API function in `agenda.js` — fetches all `visible_to_all_staff = true` activities for the org with enrollments |
| `useSidebarActivities` | New hook — computes `yours`/`others` lists and `lateArrivals` from the sidebar query |
| `AgendaSidebar` | New component — two-section sidebar (yours / others') with aggregated items |
| `SidebarPopover` | New component — cluster popover variant with "Take attendance for all" footer |
| Dashboard layout | Two-column wrapper; sidebar mounted alongside the agenda |
| BlockRosterModal prop rename | `blockLabel` → `groupTitle`, `blockTimeRange` → `groupTimeRange` (prep for sidebar reuse) |

### Reuse

- `buildTeacherRenderables` (agendaUtils) — used for both the agenda AND the sidebar's "yours" section (same grouping key: role + start_time + end_time). "Yours" activities can have any role — teacher, monitor, or prep — and `buildTeacherRenderables` handles all of them correctly.
- `buildTeacherRenderables` also used for the sidebar's "others'" section. "Others'" is defined as activities where `getViewerRole === null`, so every item in that list gives `role = null`. Activities at the same `(null, start_time, end_time)` cluster together — e.g. five concurrent Independent Studies across different teachers collapse into one group.
- `BlockRosterModal` — reused for the sidebar's "Take attendance for all" action (two entry points: block buttons and sidebar popovers).

### Role badge fix in `BlockRosterModal`

`deriveRole` in `BlockRosterModal` currently returns `raw ?? 'teacher'` — a fallback that forces a "Teacher" badge when the viewer has no role on an activity. This is wrong for others' activities opened via the sidebar. Two changes:

1. **`deriveRole`**: change `return raw ?? 'teacher'` → `return raw` (let null propagate)
2. **`ActivitySectionHeader`**: render `RoleBadge` conditionally: `{role && <RoleBadge role={role} />}`

With these fixes: sections for activities the viewer is staffed on show the correct badge (Teacher / Monitor / Prep); sections for others' activities show no badge.

### "Take attendance for all" — write access

"Take attendance for all" works for both "yours" and "others'" clusters. "Yours" clusters use the existing teacher RLS; "others'" clusters use the new Path A write policy. Both paths are covered by the migration.

### Audit log note

`attendance_records` is listed as a "tracked table" in the audit log schema doc, but no audit trigger for this table exists in any current migration. The new write path cannot bypass logging that doesn't exist. No action needed for 86.5; adding audit triggers is a separate feature.

---

## Step 0 — Generalize `BlockRosterModal` props + fix role badge

Two changes to `BlockRosterModal.jsx` before building the sidebar:

### 0a. Rename props

- `blockLabel` → `groupTitle` (modal renders `{groupTitle} attendance` as the heading)
- `blockTimeRange` → `groupTimeRange` (subtitle ingredient; can be null)

Update Dashboard.jsx's 86.4 call site accordingly:

```jsx
<BlockRosterModal
  groupTitle={getBlockLabel(blockRosterTarget, blockLabels)}
  groupTimeRange={(() => {
    const def = defaultTemplate?.block_definitions?.find((d) => d.block === blockRosterTarget)
    return def?.start_time && def?.end_time ? formatTimeRange(def.start_time, def.end_time) : null
  })()}
  ...
```

### 0b. Fix `deriveRole` and `ActivitySectionHeader`

```js
// Before:
function deriveRole(activity, viewerId, enrollmentCounts) {
  const raw = getViewerRole(activity, viewerId)
  if (raw === 'teacher' && (enrollmentCounts?.get(activity.id) ?? 0) === 0) return 'prep'
  return raw ?? 'teacher'   // ← wrong: forces 'teacher' badge when viewer has no role
}

// After:
function deriveRole(activity, viewerId, enrollmentCounts) {
  const raw = getViewerRole(activity, viewerId)
  if (raw === 'teacher' && (enrollmentCounts?.get(activity.id) ?? 0) === 0) return 'prep'
  return raw   // null when viewer has no role — let the caller handle it
}
```

In `ActivitySectionHeader`, render `RoleBadge` only when role is non-null:

```jsx
// Before:
<RoleBadge role={role} />

// After:
{role && <RoleBadge role={role} />}
```

---

## Step 1 — RLS migration

**File:** `supabase/migrations/20260520000001_visible_to_all_rls_extension.sql`

### 1a. New DEFINER helper

```sql
-- Returns true if the activity is visible_to_all_staff = true
-- AND belongs to the caller's organization.
CREATE OR REPLACE FUNCTION public.activity_is_visible_to_all(activity_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM activities
    WHERE id = activity_id_param
      AND visible_to_all_staff = true
      AND organization_id = (
        SELECT organization_id FROM user_profiles WHERE id = auth.uid()
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.activity_is_visible_to_all(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activity_is_visible_to_all(uuid) TO authenticated;
```

### 1b. `enrollments` — teacher read extension

```sql
CREATE POLICY "Teachers read visible-to-all enrollments"
  ON enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_is_visible_to_all(activity_id)
  );
```

### 1c. `activity_instances` — teacher read extension

```sql
CREATE POLICY "Teachers read visible-to-all instances"
  ON activity_instances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_is_visible_to_all(activity_id)
  );
```

### 1d. `attendance_records` — teacher read extension

```sql
CREATE POLICY "Teachers read visible-to-all attendance"
  ON attendance_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE activity_is_visible_to_all(activity_id)
    )
  );
```

### 1e. `attendance_records` — teacher WRITE extension (Path A — confirmed)

```sql
CREATE POLICY "Teachers write visible-to-all attendance"
  ON attendance_records FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE activity_is_visible_to_all(activity_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND 'teacher' = ANY(roles)
    )
    AND activity_instance_id IN (
      SELECT id FROM activity_instances
      WHERE activity_is_visible_to_all(activity_id)
    )
  );
```

---

## Step 2 — API function

Add to `src/api/agenda.js`:

```js
// Fetch all visible-to-all-staff activities for the org, with enrollments.
// Does NOT filter by date — date filtering happens client-side via activityMeetsToday.
export async function getVisibleToAllActivitiesForDate(orgId) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('is_active', true)
    .eq('organization_id', orgId)
    .eq('visible_to_all_staff', true)

  if (error) throw error

  const activityIds = data.map((a) => a.id)
  if (activityIds.length === 0) {
    return { activities: data, enrollmentsByActivity: new Map() }
  }

  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('activity_id, days_of_week, rotation_day_type, recurrence_interval, recurrence_anchor_date, start_time_override')
    .in('activity_id', activityIds)
    .eq('is_active', true)

  if (enrollError) throw enrollError

  const enrollmentsByActivity = new Map()
  for (const e of enrollments) {
    if (!enrollmentsByActivity.has(e.activity_id)) enrollmentsByActivity.set(e.activity_id, [])
    enrollmentsByActivity.get(e.activity_id).push(e)
  }

  return { activities: data, enrollmentsByActivity }
}
```

---

## Step 3 — `useSidebarActivities` hook

New file: `src/hooks/useSidebarActivities.js`

```js
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getVisibleToAllActivitiesForDate } from '@/api/agenda'
import { activityMeetsToday, enrollmentMeetsToday, formatDateISO } from '@/lib/scheduleUtils'
import { getViewerRole } from '@/lib/staffRoles'

export function useSidebarActivities(orgId, date, teacherId, schoolDay) {
  const dateStr = formatDateISO(date)

  const query = useQuery({
    queryKey: ['agenda', 'visible-to-all', orgId, dateStr],
    queryFn: () => getVisibleToAllActivitiesForDate(orgId),
    enabled: !!orgId,
  })

  const allActivities = useMemo(() => query.data?.activities ?? [], [query.data])
  const rawEnrollmentsByActivity = useMemo(
    () => query.data?.enrollmentsByActivity ?? new Map(),
    [query.data]
  )

  const todayActivities = useMemo(() => {
    return allActivities
      .filter((a) => activityMeetsToday(a, date, schoolDay))
      .sort((a, b) => (a.default_start_time ?? '').localeCompare(b.default_start_time ?? ''))
  }, [allActivities, date, schoolDay])

  const enrollmentCounts = useMemo(() => {
    const map = new Map()
    for (const [activityId, enrollments] of rawEnrollmentsByActivity) {
      const activity = allActivities.find((a) => a.id === activityId)
      if (!activity || !schoolDay) {
        map.set(activityId, enrollments.length)
        continue
      }
      const todayCount = enrollments.filter((e) =>
        enrollmentMeetsToday(e, activity, date, schoolDay)
      ).length
      map.set(activityId, todayCount)
    }
    return map
  }, [rawEnrollmentsByActivity, allActivities, schoolDay, date])

  const lateArrivals = useMemo(() => {
    const map = new Map()
    for (const [activityId, enrollments] of rawEnrollmentsByActivity) {
      const activity = allActivities.find((a) => a.id === activityId)
      const todayEnrollments = activity && schoolDay
        ? enrollments.filter((e) => enrollmentMeetsToday(e, activity, date, schoolDay))
        : enrollments
      const lateOnes = todayEnrollments.filter((e) => e.start_time_override != null)
      if (lateOnes.length === 0) continue
      const earliest = lateOnes
        .map((e) => e.start_time_override)
        .reduce((a, b) => (a < b ? a : b))
      map.set(activityId, { count: lateOnes.length, earliestTime: earliest })
    }
    return map
  }, [rawEnrollmentsByActivity, allActivities, schoolDay, date])

  const yours = useMemo(
    () => todayActivities.filter((a) => getViewerRole(a, teacherId) !== null),
    [todayActivities, teacherId]
  )
  const others = useMemo(
    () => todayActivities.filter((a) => getViewerRole(a, teacherId) === null),
    [todayActivities, teacherId]
  )

  return {
    yours,
    others,
    enrollmentCounts,
    lateArrivals,
    hasAny: todayActivities.length > 0,
    isLoading: query.isLoading,
    error: query.error,
  }
}
```

### Query key note

`['agenda', 'visible-to-all', orgId, dateStr]` is distinct from `['teacher-agenda', teacherId, dateStr]`. Both must be invalidated when attendance is saved from a sidebar-originated roster modal (see Step 7).

---

## Step 4 — `AgendaSidebar` component

New file: `src/components/agenda/AgendaSidebar.jsx`

### Props

```ts
{
  yours: Activity[]              // viewer's own visible-to-all activities today
  others: Activity[]             // other teachers' visible-to-all activities today
  enrollmentCounts: Map          // activityId → count (for prep detection in yours)
  lateArrivals: Map              // activityId → { count, earliestTime }
  teacherId: string
  date: Date
  orgId: string
  blockLabels: any[]
  actionSummary: object | null
  schoolDay: object | null
  onOpenRoster: (activity: Activity) => void
}
```

### Aggregation

Use `buildTeacherRenderables` for both sections:

```js
import { buildTeacherRenderables } from './agendaUtils'

const yoursRenderables = useMemo(
  () => buildTeacherRenderables(yours, enrollmentCounts, teacherId, lateArrivals),
  [yours, enrollmentCounts, teacherId, lateArrivals]
)

const othersRenderables = useMemo(
  () => buildTeacherRenderables(others, new Map(), teacherId, lateArrivals),
  [others, lateArrivals, teacherId]
)
```

For `others`, passing an empty `enrollmentCounts` and the viewer's `teacherId` means `getViewerRole` returns `null` for all items → `role = null` for all → they cluster by `(null, start_time, end_time)`. Concurrent activities across different teachers at the same time aggregate into one group.

### Item click handling

```js
const [sidebarPopover, setSidebarPopover] = useState(null) // { renderable, anchorRect }

function handleItemClick(item, e) {
  if (item.isCluster) {
    setSidebarPopover({ renderable: item, anchorRect: e.currentTarget.getBoundingClientRect() })
  } else {
    onOpenRoster(item.isCluster ? null : item.activity)
  }
}
```

### JSX structure

```jsx
<div className="flex flex-col gap-3">
  {/* Section: Yours */}
  {yoursRenderables.length > 0 && (
    <div>
      <div className="text-xs font-semibold text-base-content/40 uppercase tracking-wide px-1 mb-1.5">
        Visible to all · yours
      </div>
      <div className="flex flex-col gap-1">
        {yoursRenderables.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            isMine={true}
            blockLabels={blockLabels}
            onClick={(e) => handleItemClick(item, e)}
          />
        ))}
      </div>
    </div>
  )}

  {/* Section: Others' */}
  {othersRenderables.length > 0 && (
    <div>
      <div className="text-xs font-semibold text-base-content/40 uppercase tracking-wide px-1 mb-1.5">
        Visible to all · others'
      </div>
      <div className="flex flex-col gap-1">
        {othersRenderables.map((item) => (
          <SidebarItem
            key={item.id}
            item={item}
            isMine={false}
            blockLabels={blockLabels}
            onClick={(e) => handleItemClick(item, e)}
          />
        ))}
      </div>
    </div>
  )}

  {/* Empty state */}
  {yoursRenderables.length === 0 && othersRenderables.length === 0 && (
    <p className="text-xs text-base-content/30 text-center py-4">
      No school-wide activities today.
    </p>
  )}

  {/* Sidebar popover */}
  {sidebarPopover && (
    <SidebarPopover
      renderable={sidebarPopover.renderable}
      anchorRect={sidebarPopover.anchorRect}
      blockLabels={blockLabels}
      lateArrivals={lateArrivals}
      date={date}
      orgId={orgId}
      teacherId={teacherId}
      enrollmentCounts={enrollmentCounts}
      actionSummary={actionSummary}
      schoolDay={schoolDay}
      onMemberClick={(activity) => {
        setSidebarPopover(null)
        onOpenRoster(activity)
      }}
      onClose={() => setSidebarPopover(null)}
    />
  )}
</div>
```

### `SidebarItem` sub-component

Compact row-style item. Shows: YOURS badge (if `isMine`), title, late-arrival chip, role badge (if role is non-null), time range.

```jsx
function SidebarItem({ item, isMine, blockLabels, onClick }) {
  const title = item.isCluster ? item.clusterTitle : item.activity.name
  const timeRange = formatTimeRange(item.default_start_time, item.default_end_time)
  const role = item.isCluster ? item.role : item.role

  return (
    <div
      className="bg-base-200/50 border border-base-300 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-base-200 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {isMine && (
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-primary/15 text-primary shrink-0">
            Yours
          </span>
        )}
        <span className="text-sm font-medium leading-tight truncate min-w-0">{title}</span>
        {item.lateCount > 0 && (
          <LateArrivalChip count={item.lateCount} earliestTime={item.earliestArrival} />
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-base-content/50">
        {role && <RoleBadge role={role} />}
        {timeRange && <span>{timeRange}</span>}
      </div>
    </div>
  )
}
```

`LateArrivalChip` and `RoleBadge` are local copies matching the implementations in `TeacherActivityCard.jsx`.

---

## Step 5 — `SidebarPopover` component

New file: `src/components/agenda/SidebarPopover.jsx`

Fork of `ClusterPopover` with one addition: a footer "Take attendance for all" button.

### Props

Same as `ClusterPopover` plus:
- `date: Date`
- `orgId: string`
- `teacherId: string`
- `enrollmentCounts: Map`   // pass-through for prep detection in BlockRosterModal
- `actionSummary: object | null`
- `schoolDay: object | null`

### State

```js
const [groupRosterOpen, setGroupRosterOpen] = useState(false)
```

### Footer

```jsx
{/* Footer */}
<div className="px-4 py-2.5 border-t border-base-200 flex items-center justify-between">
  <span className="text-xs text-base-content/40">
    {renderable.totalEnrollment} student{renderable.totalEnrollment !== 1 ? 's' : ''}
  </span>
  <button
    className="btn btn-xs btn-outline"
    onClick={() => setGroupRosterOpen(true)}
  >
    Take attendance for all
  </button>
</div>
```

### Group roster modal

```jsx
{groupRosterOpen && (
  <BlockRosterModal
    groupTitle={renderable.clusterTitle}
    groupTimeRange={formatTimeRange(renderable.default_start_time, renderable.default_end_time)}
    activities={renderable.activities}
    date={date}
    orgId={orgId}
    teacherId={teacherId}
    blockLabels={blockLabels}
    actionSummary={actionSummary}
    schoolDay={schoolDay}
    enrollmentCounts={enrollmentCounts}
    onClose={() => {
      setGroupRosterOpen(false)
      onClose()
    }}
  />
)}
```

`enrollmentCounts` comes from the `SidebarPopover` prop (passed through from `AgendaSidebar`). For "yours" clusters this gives correct prep detection. For "others'" clusters the viewer has no role on any activity, so `deriveRole` returns `null` regardless of the count — no badge renders either way.

### Positioning and dismissal

Identical to `ClusterPopover` — same `POPOVER_WIDTH`, `POPOVER_GAP`, `fitsAbove` logic, click-outside handler, Escape handler. Copy the positioning math verbatim; don't abstract it.

---

## Step 6 — `BlockRosterModal` invalidation update

`BlockRosterModal.handleSave` currently invalidates `['roster']`, `['teacher-agenda', teacherId, dateStr]`, and `['teacher-action-summary']`. Add sidebar invalidation:

```js
queryClient.invalidateQueries({ queryKey: ['agenda', 'visible-to-all', orgId, dateStr] })
```

This requires `orgId` to be available in the modal. It's already a prop — add it to the invalidation.

---

## Step 7 — Dashboard layout change

### New imports

```js
import { useSidebarActivities } from '@/hooks/useSidebarActivities'
import AgendaSidebar from '@/components/agenda/AgendaSidebar'
```

### New hook call

```js
const {
  yours: sidebarYours,
  others: sidebarOthers,
  enrollmentCounts: sidebarEnrollmentCounts,
  lateArrivals: sidebarLateArrivals,
  hasAny: hasSidebarContent,
  isLoading: sidebarLoading,
} = useSidebarActivities(orgId, date, teacherId, schoolDay)
```

### State for sidebar-opened roster

The sidebar's `onOpenRoster` callback sets `rosterTarget` — same state already used for card-click rosters. No new state needed.

### Layout

Wrap the main agenda content and sidebar in a flex row. The outer `max-w-4xl` becomes `max-w-5xl` to accommodate the sidebar:

```jsx
return (
  <div className="max-w-5xl mx-auto">
    {/* Date navigation header — full width */}
    ...existing date nav...

    {/* Today shortcut */}
    ...existing today shortcut...

    {/* Two-column layout: agenda + sidebar */}
    <div className="flex gap-5 items-start">
      {/* Agenda column */}
      <div className="flex-1 min-w-0">
        {/* Block attendance buttons */}
        ...existing block buttons...

        {/* Loading state */}
        ...existing loading...

        {/* Content */}
        ...existing SingleDayAgenda...

        {/* Empty state */}
        ...existing empty state...
      </div>

      {/* Sidebar column — hidden on narrow viewports */}
      {!sidebarLoading && (
        <div className="hidden lg:block w-56 shrink-0">
          <AgendaSidebar
            yours={sidebarYours}
            others={sidebarOthers}
            enrollmentCounts={sidebarEnrollmentCounts}
            lateArrivals={sidebarLateArrivals}
            teacherId={teacherId}
            date={date}
            orgId={orgId}
            blockLabels={blockLabels}
            actionSummary={actionSummary}
            schoolDay={schoolDay}
            onOpenRoster={(activity) => setRosterTarget(activity)}
          />
        </div>
      )}
    </div>

    {/* Modals — outside the flex row */}
    ...existing ClusterPopover...
    ...existing BlockRosterModal...
    ...existing RosterModal...
  </div>
)
```

The sidebar always mounts when not loading (showing its own empty state if today has nothing). On `<lg` viewports, the sidebar is hidden — narrower screens get the full-width agenda.

---

## Step 8 — Update CLAUDE.md `docs/design-and-specs` table

Mark the 86.5 design doc and all five 86.x build specs as **Implemented** once work is complete.

---

## Acceptance criteria

- [ ] RLS migration creates `activity_is_visible_to_all` helper with REVOKE from PUBLIC / GRANT to authenticated
- [ ] Teachers can read enrollments, activity instances, and attendance records for visible-to-all activities they aren't staffed on
- [ ] Path A write policy is present in the migration file but commented out, awaiting explicit confirmation
- [ ] Sidebar renders on teacher Dashboard alongside the agenda
- [ ] "Yours" section shows viewer's visible-to-all activities; "others'" shows the rest
- [ ] Empty sections are hidden; fully empty sidebar shows "No school-wide activities today."
- [ ] Sidebar aggregates by (role, start_time, end_time) within each section (cross-section aggregation does not occur)
- [ ] YOURS badge appears on items in the "yours" section
- [ ] Late-arrival chips on sidebar items where applicable
- [ ] Solo sidebar item click → opens RosterModal for that activity
- [ ] Cluster sidebar item click → opens SidebarPopover with member cards
- [ ] SidebarPopover "Take attendance for all" → opens BlockRosterModal for the group
- [ ] Agenda cluster popovers (ClusterPopover) do NOT have "Take attendance for all"
- [ ] Attendance saves from sidebar path invalidate both `['teacher-agenda', ...]` and `['agenda', 'visible-to-all', ...]`
- [ ] Sidebar hidden on narrow viewports (`<lg`)
- [ ] No regression on standalone roster modal, block roster modal, or agenda cluster popover

---

## What this spec does not cover

- Sticky sub-headers within the sidebar popover's combined roster
- Student detail overlay from sidebar roster (out of scope for 86.5)
- Mobile sidebar behavior (explicit out-of-scope per design doc)
- Audit trigger on `attendance_records` (none exists; adding one is a separate feature)
- Path A confirmation: once confirmed, uncomment the policy in the migration and re-apply
