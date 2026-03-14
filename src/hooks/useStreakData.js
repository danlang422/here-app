import { useQuery } from '@tanstack/react-query'
import { getWaveHistory } from '@/api/agenda'
import { getSchoolDays } from '@/api/calendar'
import { formatDateISO, subDays } from '@/lib/scheduleUtils'
import { calculateStreak } from '@/lib/streakUtils'

export function useStreakData(studentId, activities, orgId) {
  // Only wave-enabled activities need streak calculation
  const waveActivities = activities.filter((a) => a.allows_presence_wave)
  const activityIds = waveActivities.map((a) => a.id)

  return useQuery({
    queryKey: ['streaks', studentId],
    queryFn: async () => {
      const today = new Date()
      const sinceDate = formatDateISO(subDays(today, 90)) // ~60 school days
      const todayStr = formatDateISO(today)

      // Fetch wave history and school days in parallel
      const [waves, schoolDays] = await Promise.all([
        getWaveHistory(studentId, activityIds, sinceDate),
        getSchoolDays(orgId, sinceDate, todayStr),
      ])

      // Build set of actual school days
      const schoolDaySet = new Set(
        schoolDays
          .filter((sd) => sd.is_school_day)
          .map((sd) => sd.date)
      )

      // Group waves by activityId and date
      const wavesByActivity = new Map()
      for (const wave of waves) {
        if (!wave.activity_instance) continue
        const actId = wave.activity_instance.activity_id
        const waveDate = wave.activity_instance.date
        if (!wavesByActivity.has(actId)) wavesByActivity.set(actId, new Set())
        wavesByActivity.get(actId).add(waveDate)
      }

      // Calculate streak for each wave-enabled activity
      const streaks = new Map()
      for (const activity of waveActivities) {
        const waveDates = wavesByActivity.get(activity.id) ?? new Set()
        const streak = calculateStreak(activity, waveDates, schoolDaySet, today)
        if (streak > 0) streaks.set(activity.id, streak)
      }

      return streaks
    },
    enabled: !!studentId && !!orgId && activityIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}