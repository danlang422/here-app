import { useQuery } from '@tanstack/react-query'
import {
  getRosterForActivities,
  getAttendanceForInstances,
  getInstancesForActivities,
} from '@/api/agenda'
import { formatDateISO } from '@/lib/scheduleUtils'

export function useRoster(activityIds, date, orgId, activities = []) {
  const dateStr = formatDateISO(date)
  const sortedKey = [...activityIds].sort().join(',')

  const rosterQuery = useQuery({
    queryKey: ['roster', sortedKey, dateStr],
    queryFn: async () => {
      // 1. Fetch enrollments with student profiles
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

      // 5. Build activity lookup for names/locations/flags
      const activityLookup = new Map()
      for (const a of activities) {
        activityLookup.set(a.id, a)
      }

      // 6. Flatten enrollments into student list
      const students = enrollments
        .map((e) => {
          const activity = activityLookup.get(e.activity_id)
          return {
            studentId: e.student.id,
            firstName: e.student.first_name,
            lastName: e.student.last_name,
            preferredName: e.student.preferred_name,
            activityId: e.activity_id,
            activityName: activity?.name ?? '',
            activityLocation: activity?.location ?? null,
            requiresAttendance: activity?.requires_attendance ?? true,
          }
        })
        .sort((a, b) => a.lastName.localeCompare(b.lastName))

      return { students, attendanceByStudent, instances: instanceMap }
    },
    enabled: activityIds.length > 0 && !!orgId,
  })

  return {
    students: rosterQuery.data?.students ?? [],
    attendanceByStudent: rosterQuery.data?.attendanceByStudent ?? new Map(),
    instances: rosterQuery.data?.instances ?? new Map(),
    isLoading: rosterQuery.isLoading,
    error: rosterQuery.error,
  }
}
