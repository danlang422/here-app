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
      const todayEnrollments =
        activity && schoolDay
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
