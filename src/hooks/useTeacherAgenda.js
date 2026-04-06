import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTeacherActivitiesForDate } from '@/api/agenda'
import { getSchoolDays } from '@/api/schoolDays'
import { activityMeetsToday, enrollmentMeetsToday, formatDateISO } from '@/lib/scheduleUtils'

export function useTeacherAgenda(teacherId, date, orgId) {
  const dateStr = formatDateISO(date)

  const activitiesQuery = useQuery({
    queryKey: ['teacher-agenda', teacherId, dateStr],
    queryFn: () => getTeacherActivitiesForDate(teacherId, orgId),
    enabled: !!teacherId && !!orgId,
  })

  const schoolDayQuery = useQuery({
    queryKey: ['school-days', orgId, dateStr, dateStr],
    queryFn: () => getSchoolDays(orgId, dateStr, dateStr),
    enabled: !!orgId,
  })

  const allActivities = useMemo(
    () => activitiesQuery.data?.activities ?? [],
    [activitiesQuery.data]
  )
  const rawEnrollmentsByActivity = useMemo(
    () => activitiesQuery.data?.enrollmentsByActivity ?? new Map(),
    [activitiesQuery.data]
  )
  const schoolDay = schoolDayQuery.data?.[0] ?? null

  // Compute date-filtered enrollment counts now that schoolDay is available.
  // Falls back to total count when schoolDay is null (safe — cards won't render anyway).
  const enrollmentCounts = useMemo(() => {
    const map = new Map()
    for (const [activityId, activityEnrollments] of rawEnrollmentsByActivity) {
      const activity = allActivities.find((a) => a.id === activityId)
      if (!activity || !schoolDay) {
        map.set(activityId, activityEnrollments.length)
        continue
      }
      const todayCount = activityEnrollments.filter((e) =>
        enrollmentMeetsToday(e, activity, date, schoolDay)
      ).length
      map.set(activityId, todayCount)
    }
    return map
  }, [rawEnrollmentsByActivity, allActivities, schoolDay, date])

  const activities = allActivities
    .filter((a) => activityMeetsToday(a, date, schoolDay))
    .sort((a, b) => {
      if (!a.default_start_time || !b.default_start_time) return 0
      return a.default_start_time.localeCompare(b.default_start_time)
    })

  return {
    activities,
    allActivities,
    enrollmentCounts,
    schoolDay,
    isLoading: activitiesQuery.isLoading || schoolDayQuery.isLoading,
    error: activitiesQuery.error || schoolDayQuery.error,
  }
}
