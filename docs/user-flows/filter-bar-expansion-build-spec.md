# Filter Bar Expansion Build Spec

**Design doc:** `docs/user-flows/filter-bar-expansion-design-doc.md`
**Status:** Ready to build
**Depends on:** Layer 2 complete (calendar view fully functional)

---

## What This Delivers

Three new independent filter dimensions added to the existing `CalendarFilterBar`:

1. **Block filter** — dropdown showing only activities assigned to a specific block
2. **Time range filter** — from/to dropdowns constraining the visible time window
3. **Student filter** — search-and-select one or more students; calendar dims non-enrolled activities (with optional hide toggle)

All filters AND together. All state lives in `CalendarView` local state (no persistence).

---

## Build Order

1. `CalendarEventCard` — add `isDimmed` prop (small, standalone, no dependencies)
2. `CalendarDayColumn` — accept `enrolledActivityIds`, compute `isDimmed`, pass to cards
3. `CalendarWeekGrid` — thread `enrolledActivityIds` prop through
4. `CalendarView` — add state, fetch students, expand filter pipeline, derive `enrolledActivityIds`
5. `CalendarFilterBar` — full UI expansion

Items 1–3 are purely additive prop plumbing. Items 4–5 wire everything together.

---

## 1. `CalendarEventCard.jsx`

**File:** `src/components/schedule-calendar/CalendarEventCard.jsx`

Add `isDimmed` prop to the component signature and apply opacity.

**Change the function signature:**
```javascript
// before
export function CalendarEventCard({ activity, enrollmentCount, mode, aggregateData, onClick }) {

// after
export function CalendarEventCard({ activity, enrollmentCount, mode, aggregateData, onClick, isDimmed = false }) {
```

**Aggregate mode** — wrap the return div with opacity:
```javascript
// before
<div
  className="absolute inset-0 rounded bg-base-200 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:bg-base-300 transition-colors"

// after
<div
  className={`absolute inset-0 rounded bg-base-200 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:bg-base-300 transition-all ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
```

**Few mode** — add opacity to the outer div:
```javascript
// before
<div
  className="absolute inset-0 rounded border-l-4 bg-base-100 overflow-hidden cursor-pointer hover:bg-base-200 transition-colors"
  style={{ borderLeftColor: borderColor }}

// after
<div
  className={`absolute inset-0 rounded border-l-4 bg-base-100 overflow-hidden cursor-pointer hover:bg-base-200 transition-all ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
  style={{ borderLeftColor: borderColor }}
```

**Single mode** — same change on its outer div:
```javascript
// before
<div
  className="absolute inset-0 rounded border-l-4 bg-base-100 overflow-hidden cursor-pointer hover:bg-base-200 transition-colors"
  style={{ borderLeftColor: borderColor }}

// after
<div
  className={`absolute inset-0 rounded border-l-4 bg-base-100 overflow-hidden cursor-pointer hover:bg-base-200 transition-all ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
  style={{ borderLeftColor: borderColor }}
```

---

## 2. `CalendarDayColumn.jsx`

**File:** `src/components/schedule-calendar/CalendarDayColumn.jsx`

Accept `enrolledActivityIds` and compute `isDimmed` for each rendered card.

**Add to function signature:**
```javascript
// before
export function CalendarDayColumn({
  date,
  schoolDay,
  activities,
  enrollmentCountByActivity,
  gridStartMinutes,
  onEmptyClick,
  onActivityClick,
  onAggregateClick,
}) {

// after
export function CalendarDayColumn({
  date,
  schoolDay,
  activities,
  enrollmentCountByActivity,
  gridStartMinutes,
  onEmptyClick,
  onActivityClick,
  onAggregateClick,
  enrolledActivityIds = null,
}) {
```

**In the card-building loop, add `isDimmed` computation for each render path:**

For `count === 1` (single card), inside the `cards.push(...)`:
```javascript
// after: const enrollCount = enrollmentCountByActivity[activity.id] ?? 0
const isDimmed = enrolledActivityIds !== null && !enrolledActivityIds.has(activity.id)

// then add isDimmed to CalendarEventCard:
<CalendarEventCard
  activity={activity}
  enrollmentCount={enrollCount}
  mode="single"
  onClick={onActivityClick}
  isDimmed={isDimmed}
/>
```

For `count >= 2 && count <= DENSITY_FEW_MAX` (few cards), inside the `forEach`:
```javascript
// after: const enrollCount = enrollmentCountByActivity[activity.id] ?? 0
const isDimmed = enrolledActivityIds !== null && !enrolledActivityIds.has(activity.id)

// then add isDimmed to CalendarEventCard:
<CalendarEventCard
  activity={activity}
  enrollmentCount={enrollCount}
  mode="few"
  onClick={onActivityClick}
  isDimmed={isDimmed}
/>
```

For `count >= DENSITY_AGG_MIN` (aggregate card), after `aggregateData` is built:
```javascript
// An aggregate is dimmed only if NONE of its activities are enrolled.
// If any activity in the group is enrolled, show the aggregate at full opacity.
const isDimmed = enrolledActivityIds !== null && !groupActivities.some((a) => enrolledActivityIds.has(a.id))

// then add isDimmed to CalendarEventCard:
<CalendarEventCard
  activity={groupActivities[0]}
  enrollmentCount={totalEnrollment}
  mode="aggregate"
  aggregateData={aggregateData}
  onClick={(e) => onAggregateClick(aggregateData, e)}
  isDimmed={isDimmed}
/>
```

---

## 3. `CalendarWeekGrid.jsx`

**File:** `src/components/schedule-calendar/CalendarWeekGrid.jsx`

Thread `enrolledActivityIds` from props down to each `CalendarDayColumn`.

**Add to function signature:**
```javascript
// before
export function CalendarWeekGrid({
  weekDates,
  schoolDaysByDate,
  activities,
  enrollmentCountByActivity,
  gridStartMinutes,
  gridEndMinutes,
  blockDefinitions,
  blockLabels,
  onEmptyClick,
  onActivityClick,
  onAggregateClick,
}) {

// after
export function CalendarWeekGrid({
  weekDates,
  schoolDaysByDate,
  activities,
  enrollmentCountByActivity,
  gridStartMinutes,
  gridEndMinutes,
  blockDefinitions,
  blockLabels,
  onEmptyClick,
  onActivityClick,
  onAggregateClick,
  enrolledActivityIds = null,
}) {
```

**Pass it to each `CalendarDayColumn`:**
```javascript
// before
<CalendarDayColumn
  date={date}
  schoolDay={schoolDay}
  activities={activities}
  enrollmentCountByActivity={enrollmentCountByActivity}
  gridStartMinutes={gridStartMinutes}
  onEmptyClick={onEmptyClick}
  onActivityClick={onActivityClick}
  onAggregateClick={onAggregateClick}
/>

// after
<CalendarDayColumn
  date={date}
  schoolDay={schoolDay}
  activities={activities}
  enrollmentCountByActivity={enrollmentCountByActivity}
  gridStartMinutes={gridStartMinutes}
  onEmptyClick={onEmptyClick}
  onActivityClick={onActivityClick}
  onAggregateClick={onAggregateClick}
  enrolledActivityIds={enrolledActivityIds}
/>
```

---

## 4. `CalendarView.jsx`

**File:** `src/components/schedule-calendar/CalendarView.jsx`

### 4a. Add import

```javascript
// add to existing hook imports
import { useStudents } from '@/hooks/useUsers'
import { getBlocks, getBlockLabel } from '@/lib/constants'
```

### 4b. Fetch students

After the existing `useStaffUsers` call:
```javascript
const { data: students = [] } = useStudents(orgId)
```

### 4c. Add new filter state (after existing `filterText` state)

```javascript
const [selectedBlock, setSelectedBlock] = useState(null)      // null = All
const [timeFrom, setTimeFrom] = useState(null)                // '08:00' or null
const [timeTo, setTimeTo] = useState(null)                    // '11:00' or null
const [selectedStudents, setSelectedStudents] = useState([])  // [{ id, first_name, last_name, preferred_name }]
const [hideNonEnrolled, setHideNonEnrolled] = useState(false)
```

### 4d. Derive `blockOptions` (after orgSettings is available)

```javascript
const blockOptions = useMemo(() => {
  const count = orgSettings?.block_count
  const labels = orgSettings?.block_labels
  return getBlocks(count).map((b) => ({ value: b, label: getBlockLabel(b, labels) }))
}, [orgSettings])
```

### 4e. Derive `enrolledActivityIds`

```javascript
const enrolledActivityIds = useMemo(() => {
  if (selectedStudents.length === 0) return null
  const ids = new Set()
  orgEnrollments.forEach((e) => {
    if (selectedStudents.some((s) => s.id === e.student_id)) ids.add(e.activity_id)
  })
  return ids
}, [selectedStudents, orgEnrollments])
```

### 4f. Expand `filteredActivities` pipeline

Replace the existing `filteredActivities` useMemo with this expanded version:

```javascript
const filteredActivities = useMemo(() => {
  let result = visibleActivities

  // Text filter
  if (filterText.trim()) {
    const lower = filterText.trim().toLowerCase()
    result = result.filter((a) => {
      if (a.name?.toLowerCase().includes(lower)) return true
      if (a.teacher?.first_name?.toLowerCase().includes(lower)) return true
      if (a.teacher?.last_name?.toLowerCase().includes(lower)) return true
      return false
    })
  }

  // Block filter
  if (selectedBlock !== null) {
    result = result.filter((a) => a.block === selectedBlock)
  }

  // Time range filter — activities with no time data pass through
  if (timeFrom !== null || timeTo !== null) {
    result = result.filter((a) => {
      if (!a.default_start_time && !a.default_end_time) return true
      if (timeFrom && a.default_end_time && a.default_end_time <= timeFrom) return false
      if (timeTo && a.default_start_time && a.default_start_time >= timeTo) return false
      return true
    })
  }

  // Hide non-enrolled filter (only when student filter is active and hideNonEnrolled is on)
  if (hideNonEnrolled && enrolledActivityIds !== null) {
    result = result.filter((a) => enrolledActivityIds.has(a.id))
  }

  return result
}, [visibleActivities, filterText, selectedBlock, timeFrom, timeTo, hideNonEnrolled, enrolledActivityIds])
```

### 4g. Student add/remove handlers

```javascript
function handleStudentAdd(student) {
  setSelectedStudents((prev) => {
    if (prev.some((s) => s.id === student.id)) return prev
    return [...prev, student]
  })
}

function handleStudentRemove(studentId) {
  setSelectedStudents((prev) => prev.filter((s) => s.id !== studentId))
  if (selectedStudents.length <= 1) setHideNonEnrolled(false)
}
```

### 4h. Update `CalendarFilterBar` usage in JSX

```javascript
// before
<CalendarFilterBar filterText={filterText} onFilterChange={setFilterText} />

// after
<CalendarFilterBar
  filterText={filterText}
  onFilterChange={setFilterText}
  blockOptions={blockOptions}
  selectedBlock={selectedBlock}
  onBlockChange={setSelectedBlock}
  timeFrom={timeFrom}
  timeTo={timeTo}
  onTimeFromChange={setTimeFrom}
  onTimeToChange={setTimeTo}
  students={students}
  selectedStudents={selectedStudents}
  onStudentAdd={handleStudentAdd}
  onStudentRemove={handleStudentRemove}
  hideNonEnrolled={hideNonEnrolled}
  onHideNonEnrolledChange={setHideNonEnrolled}
/>
```

### 4i. Pass `enrolledActivityIds` to `CalendarWeekGrid`

```javascript
// add to existing CalendarWeekGrid props:
enrolledActivityIds={enrolledActivityIds}
```

---

## 5. `CalendarFilterBar.jsx`

**File:** `src/components/schedule-calendar/CalendarFilterBar.jsx`

Full replacement of the component. The student search text is the only internal state (purely transient UI, no effect outside the component).

```javascript
import { useState, useMemo } from 'react'

// Generate time options in 15-minute increments from 6:00 AM to 6:00 PM
function generateTimeOptions() {
  const options = []
  for (let h = 6; h <= 18; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 18 && m > 0) break
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const suffix = h >= 12 ? 'PM' : 'AM'
      const label = m === 0 ? `${hour12}:00 ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
      options.push({ value, label })
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

export function CalendarFilterBar({
  // existing
  filterText,
  onFilterChange,
  // block filter
  blockOptions = [],
  selectedBlock,
  onBlockChange,
  // time range filter
  timeFrom,
  timeTo,
  onTimeFromChange,
  onTimeToChange,
  // student filter
  students = [],
  selectedStudents = [],
  onStudentAdd,
  onStudentRemove,
  hideNonEnrolled,
  onHideNonEnrolledChange,
}) {
  const [studentSearch, setStudentSearch] = useState('')

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return []
    const lower = studentSearch.trim().toLowerCase()
    return students.filter((s) => {
      const full = `${s.first_name ?? ''} ${s.last_name ?? ''} ${s.preferred_name ?? ''}`.toLowerCase()
      return full.includes(lower) && !selectedStudents.some((sel) => sel.id === s.id)
    }).slice(0, 8)
  }, [studentSearch, students, selectedStudents])

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b border-base-200">

      {/* Text search */}
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="input input-bordered input-sm w-56"
          placeholder="Filter activities..."
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
        />
        {filterText && (
          <button className="btn btn-ghost btn-xs" onClick={() => onFilterChange('')}>
            ✕
          </button>
        )}
      </div>

      {/* Divider */}
      {blockOptions.length > 0 && (
        <div className="border-l border-base-300 self-stretch" />
      )}

      {/* Block filter */}
      {blockOptions.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-base-content/60">Block:</span>
          <select
            className="select select-bordered select-sm"
            value={selectedBlock ?? ''}
            onChange={(e) => onBlockChange(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">All</option>
            {blockOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Divider */}
      <div className="border-l border-base-300 self-stretch" />

      {/* Time range filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-base-content/60">Time:</span>
        <select
          className="select select-bordered select-sm"
          value={timeFrom ?? ''}
          onChange={(e) => onTimeFromChange(e.target.value || null)}
        >
          <option value="">All day</option>
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-xs text-base-content/40">to</span>
        <select
          className="select select-bordered select-sm"
          value={timeTo ?? ''}
          onChange={(e) => onTimeToChange(e.target.value || null)}
        >
          <option value="">—</option>
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {(timeFrom || timeTo) && (
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => { onTimeFromChange(null); onTimeToChange(null) }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="border-l border-base-300 self-stretch" />

      {/* Student filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="relative">
          <input
            type="text"
            className="input input-bordered input-sm w-40"
            placeholder="Search students..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />
          {filteredStudents.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-base-100 border border-base-300 rounded shadow-lg z-50">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-base-200"
                  onClick={() => {
                    onStudentAdd(s)
                    setStudentSearch('')
                  }}
                >
                  {s.preferred_name ?? s.first_name} {s.last_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected student chips */}
        {selectedStudents.map((s) => (
          <div key={s.id} className="badge badge-neutral gap-1">
            <span className="text-xs">{s.preferred_name ?? s.first_name} {s.last_name}</span>
            <button
              className="text-xs leading-none"
              onClick={() => onStudentRemove(s.id)}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Hide non-enrolled toggle — only visible when students are selected */}
        {selectedStudents.length > 0 && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={hideNonEnrolled}
              onChange={(e) => onHideNonEnrolledChange(e.target.checked)}
            />
            <span className="text-xs text-base-content/60">Hide non-enrolled</span>
          </label>
        )}
      </div>
    </div>
  )
}
```

---

## Verification

1. `npm run dev` → navigate to Admin → Calendar
2. **Block filter:** Select a block → only activities with that `block` value visible; null-block activities hidden; select "All" → restored
3. **Time range filter:** Set From to 10:00 AM → activities ending at or before 10:00 AM hidden; set To to 11:00 AM → activities starting at or after 11:00 AM hidden; activities with no time data stay visible; clear ✕ resets both
4. **Student filter:** Type a student name → dropdown appears → click to add chip → non-enrolled activities dim to 30% opacity; add a second student → union of their enrollments at full opacity; toggle "Hide non-enrolled" → non-enrolled activities disappear entirely; ✕ on chip removes the student; last chip removed → all activities return to full opacity; "Hide non-enrolled" toggle disappears
5. **Aggregate cards:** When student filter active, aggregate dims only if none of its activities are enrolled by the selected students
6. **Combined:** All three filters AND together correctly (block + time + student)
7. **Grid bounds** do not reflow when time filter changes (bounds anchored to `visibleActivities`, not `filteredActivities`)
8. `npm run build` — no TypeScript/lint errors
