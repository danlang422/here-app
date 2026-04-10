import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAllActiveEnrollments } from '@/api/attendance'
import { getSchoolDay } from '@/api/schoolDays'
import { getInstancesForDate } from '@/api/instances'
import { getAttendanceForInstances } from '@/api/agenda'
import { enrollmentMeetsToday, formatDateISO } from '@/lib/scheduleUtils'

const STATUS_SORT_ORDER = {
  absent: 0,
  tardy: 1,
  null: 2,    // unmarked
  excused: 3,
  present: 4,
  na: 5,      // requires_attendance = false
}

function getStatusKey(row) {
  if (!row.requiresAttendance) return 'na'
  if (!row.attendanceRecord) return 'null'
  return row.attendanceRecord.status ?? 'null'
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const aKey = getStatusKey(a)
    const bKey = getStatusKey(b)
    const orderDiff = (STATUS_SORT_ORDER[aKey] ?? 2) - (STATUS_SORT_ORDER[bKey] ?? 2)
    if (orderDiff !== 0) return orderDiff
    // Alphabetical by last name within the same status bucket
    const aLast = a.student?.last_name ?? ''
    const bLast = b.student?.last_name ?? ''
    return aLast.localeCompare(bLast)
  })
}

export function useAttendanceRollup(orgId, date) {
  const dateStr = formatDateISO(date)

  const enrollmentsQuery = useQuery({
    queryKey: ['rollup-enrollments', orgId],
    queryFn: () => getAllActiveEnrollments(),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })

  const schoolDayQuery = useQuery({
    queryKey: ['rollup-school-day', orgId, dateStr],
    queryFn: () => getSchoolDay(orgId, dateStr),
    enabled: !!orgId,
  })

  const instancesQuery = useQuery({
    queryKey: ['activity-instances', orgId, dateStr],
    queryFn: () => getInstancesForDate(orgId, dateStr),
    enabled: !!orgId,
  })

  const instanceIds = useMemo(
    () => (instancesQuery.data ?? []).map((i) => i.id),
    [instancesQuery.data]
  )

  const attendanceQuery = useQuery({
    queryKey: ['rollup-attendance', orgId, dateStr],
    queryFn: () => getAttendanceForInstances(instanceIds),
    enabled: !!orgId && instancesQuery.isSuccess,
  })

  const schoolDay = schoolDayQuery.data ?? null

  const { blockGroups, stats } = useMemo(() => {
    const enrollments = enrollmentsQuery.data ?? []
    const instances = instancesQuery.data ?? []
    const attendanceRecords = attendanceQuery.data ?? []

    // Build lookup maps
    const instanceMap = new Map(instances.map((i) => [i.activity_id, i]))
    const attendanceMap = new Map(
      attendanceRecords.map((r) => [`${r.activity_instance_id}:${r.student_id}`, r])
    )

    // Bucket enrollments into blocks
    const rawBlockGroups = new Map()

    for (const enrollment of enrollments) {
      const activity = enrollment.activity
      const student = enrollment.student
      if (!activity || !student) continue

      if (!enrollmentMeetsToday(enrollment, activity, date, schoolDay)) continue

      const block = enrollment.block ?? activity.block
      if (block === null || block === undefined) continue

      const instance = instanceMap.get(activity.id) ?? null
      const attendanceRecord = instance
        ? (attendanceMap.get(`${instance.id}:${enrollment.student_id}`) ?? null)
        : null

      const row = {
        student,
        activity,
        attendanceRecord,
        requiresAttendance: activity.requires_attendance ?? false,
        hasConflict: false, // resolved below
      }

      if (!rawBlockGroups.has(block)) rawBlockGroups.set(block, [])
      rawBlockGroups.get(block).push(row)
    }

    // Flag multi-activity students within the same block
    for (const [, rows] of rawBlockGroups) {
      const studentCounts = new Map()
      for (const row of rows) {
        studentCounts.set(row.student.id, (studentCounts.get(row.student.id) ?? 0) + 1)
      }
      for (const row of rows) {
        if (studentCounts.get(row.student.id) > 1) row.hasConflict = true
      }
    }

    // Sort rows within each block
    const blockGroups = new Map()
    for (const [block, rows] of rawBlockGroups) {
      blockGroups.set(block, sortRows(rows))
    }

    // Compute stats across all blocks
    let totalStudents = 0, marked = 0, unmarked = 0
    let absent = 0, tardy = 0, excused = 0, present = 0

    for (const [, rows] of blockGroups) {
      for (const row of rows) {
        if (!row.requiresAttendance) continue
        totalStudents++
        if (row.attendanceRecord) {
          marked++
          const s = row.attendanceRecord.status
          if (s === 'absent') absent++
          else if (s === 'tardy') tardy++
          else if (s === 'excused') excused++
          else if (s === 'present') present++
        } else {
          unmarked++
        }
      }
    }

    const stats = {
      totalStudents,
      marked,
      unmarked,
      absent,
      tardy,
      excused,
      present,
      totalExceptions: absent + tardy + excused + unmarked,
    }

    return { blockGroups, stats }
  }, [
    enrollmentsQuery.data,
    instancesQuery.data,
    attendanceQuery.data,
    schoolDay,
    date,
  ])

  return {
    blockGroups,
    schoolDay,
    isLoading:
      enrollmentsQuery.isLoading ||
      schoolDayQuery.isLoading ||
      instancesQuery.isLoading ||
      (instancesQuery.isSuccess && attendanceQuery.isLoading),
    error:
      enrollmentsQuery.error ||
      schoolDayQuery.error ||
      instancesQuery.error ||
      attendanceQuery.error,
    stats,
  }
}
