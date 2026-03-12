import { useQuery } from '@tanstack/react-query'
import { getStudentActivitiesForDate } from '@/api/agenda'
import { getSchoolDays } from '@/api/calendar'
import { activityMeetsToday, formatDateISO } from '@/lib/scheduleUtils'

export function useStudentAgenda(studentId, date, orgId) {
  const dateStr = formatDateISO(date)

  // Fetch all actively enrolled activities (unfiltered by date)
  const activitiesQuery = useQuery({
    queryKey: ['student-agenda', studentId, dateStr],
    queryFn: () => getStudentActivitiesForDate(studentId, orgId),
    enabled: !!studentId && !!orgId,
  })

  // Fetch the school day record for this date
  const schoolDayQuery = useQuery({
    queryKey: ['school-days', orgId, dateStr, dateStr],
    queryFn: () => getSchoolDays(orgId, dateStr, dateStr),
    enabled: !!orgId,
  })

  const allActivities = activitiesQuery.data ?? []
  const schoolDay = schoolDayQuery.data?.[0] ?? null

  // Filter to activities that meet on this date, sort by start time
  const activities = allActivities
    .filter((a) => activityMeetsToday(a, date, schoolDay))
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
