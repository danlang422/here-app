import { useQuery } from '@tanstack/react-query'
import { getStudentActivitiesForDate } from '@/api/agenda'
import { getSchoolDays } from '@/api/schoolDays'
import { enrollmentMeetsToday, formatDateISO } from '@/lib/scheduleUtils'

export function useStudentAgenda(studentId, date, orgId) {
  const dateStr = formatDateISO(date)

  const activitiesQuery = useQuery({
    queryKey: ['student-agenda', studentId, dateStr],
    queryFn: () => getStudentActivitiesForDate(studentId, orgId),
    enabled: !!studentId && !!orgId,
  })

  const schoolDayQuery = useQuery({
    queryKey: ['school-days', orgId, dateStr, dateStr],
    queryFn: () => getSchoolDays(orgId, dateStr, dateStr),
    enabled: !!orgId,
  })

  const allActivities = activitiesQuery.data ?? []
  const schoolDay = schoolDayQuery.data?.[0] ?? null

  const activities = allActivities
    .filter((a) => {
      const enrollment = {
        days_of_week:           a.enrollment_days_of_week,
        rotation_day_type:      a.enrollment_rotation_day_type,
        recurrence_interval:    a.enrollment_recurrence_interval,
        recurrence_anchor_date: a.enrollment_recurrence_anchor_date,
      }
      return enrollmentMeetsToday(enrollment, a, date, schoolDay)
    })
    .sort((a, b) => {
      if (!a.default_start_time || !b.default_start_time) return 0
      return a.default_start_time.localeCompare(b.default_start_time)
    })

  return {
    activities,
    allActivities,
    schoolDay,
    isLoading: activitiesQuery.isLoading || schoolDayQuery.isLoading,
    error: activitiesQuery.error || schoolDayQuery.error,
  }
}