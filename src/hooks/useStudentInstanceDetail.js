import { useQuery } from '@tanstack/react-query'
import { getStudentInstanceDetail, getWaveHistory } from '@/api/agenda'
import { getSchoolDays } from '@/api/schoolDays'
import { formatDateISO, subDays } from '@/lib/scheduleUtils'
import { calculateStreak } from '@/lib/streakUtils'

export function useStudentInstanceDetail(studentId, instanceId, activity, orgId) {
  return useQuery({
    queryKey: ['student-instance-detail', studentId, instanceId],
    queryFn: async () => {
      const detail = await getStudentInstanceDetail(studentId, instanceId)

      // Calculate streak if wave exists and activity info is available
      let streak = 0
      if (detail.wave && activity && orgId) {
        const today = new Date()
        const sinceDate = formatDateISO(subDays(today, 90))
        const todayStr = formatDateISO(today)

        const [waves, schoolDays] = await Promise.all([
          getWaveHistory(studentId, [activity.id], sinceDate),
          getSchoolDays(orgId, sinceDate, todayStr),
        ])

        const schoolDaySet = new Set(
          schoolDays
            .filter((sd) => sd.is_school_day)
            .map((sd) => sd.date)
        )

        // Group wave dates for this activity
        const waveDates = new Set()
        for (const wave of waves) {
          if (wave.activity_instance) {
            waveDates.add(wave.activity_instance.date)
          }
        }

        streak = calculateStreak(activity, waveDates, schoolDaySet, today)
      }

      return { ...detail, streak }
    },
    enabled: !!studentId && !!instanceId,
  })
}
