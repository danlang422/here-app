import { useQuery } from '@tanstack/react-query'
import {
  getRosterForActivities,
  getAttendanceForInstances,
  getInstancesForActivities,
} from '@/api/agenda'
import { formatDateISO, enrollmentMeetsToday } from '@/lib/scheduleUtils'

export function useRoster(activityIds, date, orgId, activities = [], schoolDay = null) {
  const dateStr = formatDateISO(date)
  const sortedKey = [...activityIds].sort().join(',')

  // Build activity lookup outside the query fn so it's available for filtering
  const activityLookup = new Map()
  for (const a of activities) {
    activityLookup.set(a.id, a)
  }

  const rosterQuery = useQuery({
    queryKey: ['roster', sortedKey, dateStr],
    queryFn: async () => {
      // 1. Fetch enrollments with student profiles and scheduling fields
      const enrollments = await getRosterForActivities(activityIds)

      // 2. Fetch instance IDs for these activities on this date
      const instanceMap = await getInstancesForActivities(orgId, dateStr, activityIds)

      // 3. Fetch existing attendance records for those instances
      const instanceIds = [...instanceMap.values()]
      const attendanceRecords = await getAttendanceForInstances(instanceIds)

      // 4. Build attendance-by-student map
      const attendanceByStudent = new Map()
      for (const record of attendanceRecords) {
        attendanceByStudent.set(record.student_id, {
          status: record.status,
          recordId: record.id,
        })
      }

      return { enrollments, attendanceByStudent, instances: instanceMap }
    },
    enabled: activityIds.length > 0 && !!orgId,
  })

  // Flatten enrollments into student objects, with scheduledToday flag.
  // Done outside queryFn so schoolDay (a prop, not fetched here) can gate filtering.
  const rawEnrollments = rosterQuery.data?.enrollments ?? []

  const allStudents = rawEnrollments
    .map((e) => {
      const activity = activityLookup.get(e.activity_id)
      const scheduledToday =
        !schoolDay || !activity
          ? true // safe fallback when schoolDay not yet available
          : enrollmentMeetsToday(e, activity, date, schoolDay)
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

  const todayStudents = allStudents.filter((s) => s.scheduledToday)

  return {
    todayStudents,
    allStudents,
    attendanceByStudent: rosterQuery.data?.attendanceByStudent ?? new Map(),
    instances: rosterQuery.data?.instances ?? new Map(),
    isLoading: rosterQuery.isLoading,
    error: rosterQuery.error,
  }
}
