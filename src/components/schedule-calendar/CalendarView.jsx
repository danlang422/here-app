import { useState, useMemo } from 'react'
import useAuthStore from '@/store/authStore'
import useUIStore from '@/store/uiStore'
import { useCalendarUiStore } from '@/store/calendarUiStore'
import { useActivities } from '@/hooks/useActivities'
import { useCalendars } from '@/hooks/useCalendars'
import { useOrgEnrollments } from '@/hooks/useEnrollments'
import { useSchoolDays } from '@/hooks/useSchoolDays'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useStaffUsers, useStudents } from '@/hooks/useUsers'
import { getBlocks, getBlockLabel } from '@/lib/constants'
import { useTerms } from '@/hooks/useTerms'
import { addDays, formatDateISO } from '@/lib/scheduleUtils'
import {
  timeToMinutes,
  floorToHour,
  ceilToHour,
  DEFAULT_GRID_START,
  DEFAULT_GRID_END,
} from '@/components/agenda/agendaUtils'
import { CalendarWeekNav, getWeekStart } from './CalendarWeekNav'
import { CalendarFilterBar } from './CalendarFilterBar'
import { CalendarSidebar } from './CalendarSidebar'
import { CalendarWeekGrid } from './CalendarWeekGrid'
import { CalendarEventPopover } from './CalendarEventPopover'
import { CalendarAggregatePopover } from './CalendarAggregatePopover'

export function CalendarView() {
  const orgId = useAuthStore((s) => s.profile?.organization_id)

  // Server state
  const { data: activities = [] } = useActivities(orgId)
  const { data: calendars = [] } = useCalendars(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)
  const { data: template } = useDefaultScheduleTemplate(orgId)
  const { data: orgSettings = {} } = useOrgSettings(orgId)
  const { data: staffUsers = [] } = useStaffUsers(orgId)
  const { data: students = [] } = useStudents(orgId)
  const { data: terms = [] } = useTerms(orgId)

  // Week anchor
  const selectedDate = useUIStore((s) => s.selectedDate)
  const weekStart = getWeekStart(selectedDate ?? new Date())
  const weekDates = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i))

  // School days for the visible week
  const { data: schoolDays = [] } = useSchoolDays(
    orgId,
    formatDateISO(weekDates[0]),
    formatDateISO(weekDates[4])
  )
  const schoolDaysByDate = useMemo(
    () => Object.fromEntries(schoolDays.map((sd) => [sd.date, sd])),
    [schoolDays]
  )

  // Calendar visibility filter
  const calendarVisibility = useCalendarUiStore((s) => s.calendarVisibility)
  const isCalendarVisible = useCalendarUiStore((s) => s.isCalendarVisible)
  const visibleActivities = useMemo(
    () => activities.filter((a) => a.calendar_id === null || isCalendarVisible(a.calendar_id)),
    [activities, calendarVisibility, isCalendarVisible]
  )

  // Filter state
  const [filterText, setFilterText] = useState('')
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [timeFrom, setTimeFrom] = useState(null)
  const [timeTo, setTimeTo] = useState(null)
  const [selectedStudents, setSelectedStudents] = useState([])
  const [hideNonEnrolled, setHideNonEnrolled] = useState(false)

  // Block dropdown options
  const blockOptions = useMemo(() => {
    const count = orgSettings?.block_count
    const labels = orgSettings?.block_labels
    return getBlocks(count).map((b) => ({ value: b, label: getBlockLabel(b, labels) }))
  }, [orgSettings])

  // Enrolled activity IDs for the selected students (null = no student filter)
  const enrolledActivityIds = useMemo(() => {
    if (selectedStudents.length === 0) return null
    const ids = new Set()
    orgEnrollments.forEach((e) => {
      if (selectedStudents.some((s) => s.id === e.student_id)) ids.add(e.activity_id)
    })
    return ids
  }, [selectedStudents, orgEnrollments])

  // Filter pipeline: calendar visibility → text → block → time range → hide non-enrolled
  const filteredActivities = useMemo(() => {
    let result = visibleActivities

    if (filterText.trim()) {
      const lower = filterText.trim().toLowerCase()
      result = result.filter((a) => {
        if (a.name?.toLowerCase().includes(lower)) return true
        if (a.teacher?.first_name?.toLowerCase().includes(lower)) return true
        if (a.teacher?.last_name?.toLowerCase().includes(lower)) return true
        return false
      })
    }

    if (selectedBlock !== null) {
      result = result.filter((a) => a.block === selectedBlock)
    }

    if (timeFrom !== null || timeTo !== null) {
      result = result.filter((a) => {
        if (!a.default_start_time && !a.default_end_time) return true
        if (timeFrom && a.default_end_time && a.default_end_time <= timeFrom) return false
        if (timeTo && a.default_start_time && a.default_start_time >= timeTo) return false
        return true
      })
    }

    if (hideNonEnrolled && enrolledActivityIds !== null) {
      result = result.filter((a) => enrolledActivityIds.has(a.id))
    }

    return result
  }, [visibleActivities, filterText, selectedBlock, timeFrom, timeTo, hideNonEnrolled, enrolledActivityIds])

  function handleStudentAdd(student) {
    setSelectedStudents((prev) => {
      if (prev.some((s) => s.id === student.id)) return prev
      return [...prev, student]
    })
  }

  function handleStudentRemove(studentId) {
    setSelectedStudents((prev) => {
      const next = prev.filter((s) => s.id !== studentId)
      if (next.length === 0) setHideNonEnrolled(false)
      return next
    })
  }

  // Enrollment count map
  const enrollmentCountByActivity = useMemo(() => {
    const map = {}
    orgEnrollments.forEach((e) => {
      map[e.activity_id] = (map[e.activity_id] ?? 0) + 1
    })
    return map
  }, [orgEnrollments])

  // Grid bounds — same pattern as AgendaView
  const gridBounds = useMemo(() => {
    const timed = visibleActivities.filter((a) => a.default_start_time && a.default_end_time)
    if (timed.length === 0) {
      return { start: DEFAULT_GRID_START, end: DEFAULT_GRID_END }
    }
    const starts = timed.map((a) => a.default_start_time)
    const ends = timed.map((a) => a.default_end_time)
    const minStart = starts.reduce((a, b) => (a < b ? a : b))
    const maxEnd = ends.reduce((a, b) => (a > b ? a : b))
    return {
      start: minStart < DEFAULT_GRID_START ? floorToHour(minStart) : DEFAULT_GRID_START,
      end: maxEnd > DEFAULT_GRID_END ? ceilToHour(maxEnd) : DEFAULT_GRID_END,
    }
  }, [visibleActivities])

  const gridStartMinutes = timeToMinutes(gridBounds.start)
  const gridEndMinutes = timeToMinutes(gridBounds.end)

  // Popover state
  const [popover, setPopover] = useState(null)
  // null | { activity } | { prefillData: { date, startTime, calendarId } }
  const [aggregatePopover, setAggregatePopover] = useState(null)
  // null | { aggregateData: { count, totalEnrollment, activities }, position: { x, y } }

  function handleActivityClick(activity) {
    setPopover({ activity })
  }

  function handleEmptyClick(date, startTime) {
    setPopover({ prefillData: { date, startTime, calendarId: null } })
  }

  function handleAggregateClick(aggregateData, event) {
    setAggregatePopover({ aggregateData, position: { x: event.clientX, y: event.clientY } })
  }

  return (
    <div className="flex flex-col h-full">
      <CalendarWeekNav />
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

      <div className="flex flex-1 overflow-hidden">
        <CalendarSidebar
          calendars={calendars}
          staffUsers={staffUsers}
          orgId={orgId}
        />

        <CalendarWeekGrid
          weekDates={weekDates}
          schoolDaysByDate={schoolDaysByDate}
          activities={filteredActivities}
          enrollmentCountByActivity={enrollmentCountByActivity}
          gridStartMinutes={gridStartMinutes}
          gridEndMinutes={gridEndMinutes}
          onEmptyClick={handleEmptyClick}
          onActivityClick={handleActivityClick}
          onAggregateClick={handleAggregateClick}
          enrolledActivityIds={enrolledActivityIds}
        />
      </div>

      {aggregatePopover && (
        <CalendarAggregatePopover
          aggregateData={aggregatePopover.aggregateData}
          position={aggregatePopover.position}
          onClose={() => setAggregatePopover(null)}
          onActivityClick={(activity) => {
            setAggregatePopover(null)
            handleActivityClick(activity)
          }}
          enrollmentCountByActivity={enrollmentCountByActivity}
        />
      )}

      {popover && (
        <CalendarEventPopover
          activity={popover.activity ?? null}
          prefillData={popover.prefillData ?? null}
          onClose={() => setPopover(null)}
          orgId={orgId}
          orgSettings={orgSettings}
          defaultTemplate={template}
          terms={terms}
          calendars={calendars}
        />
      )}
    </div>
  )
}
