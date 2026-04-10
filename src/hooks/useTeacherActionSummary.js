import { useQuery } from '@tanstack/react-query'
import { formatDateISO } from '@/lib/scheduleUtils'
import {
  getInstancesForActivities,
  getWavesForInstances,
  getCheckInsForInstances,
  getStatusUpdatesForInstances,
  getAttendanceForInstances,
} from '@/api/agenda'

export function useTeacherActionSummary(activityIds, date, orgId) {
  const dateStr = formatDateISO(date)
  const sortedKey = [...activityIds].sort().join(',')

  return useQuery({
    queryKey: ['teacher-action-summary', sortedKey, dateStr],
    queryFn: async () => {
      // 1. Get instance IDs
      const instanceMap = await getInstancesForActivities(orgId, dateStr, activityIds)
      const instanceIds = [...instanceMap.values()]

      if (instanceIds.length === 0) {
        return {
          waveCounts: new Map(),
          waves: new Map(),
          checkIns: new Map(),
          statusCounts: new Map(),
          hasAttendanceRecords: new Map(),
          instances: instanceMap,
        }
      }

      // 2. Fetch all action data in parallel
      const [wavesData, checkInsData, statusData, attendanceData] = await Promise.all([
        getWavesForInstances(instanceIds),
        getCheckInsForInstances(instanceIds),
        getStatusUpdatesForInstances(instanceIds),
        getAttendanceForInstances(instanceIds),
      ])

      // Build reverse map: instanceId → activityId
      const instanceToActivity = new Map()
      for (const [activityId, instanceId] of instanceMap) {
        instanceToActivity.set(instanceId, activityId)
      }

      // Wave counts per activity (for cards)
      const waveCounts = new Map()
      // Waves per student+activity (for roster icons)
      const waves = new Map()
      for (const w of wavesData) {
        const actId = instanceToActivity.get(w.activity_instance_id)
        if (actId) {
          waveCounts.set(actId, (waveCounts.get(actId) ?? 0) + 1)
          waves.set(`${w.student_id}-${actId}`, w)
        }
      }

      // Check-ins per student+activity (for roster icons)
      const checkIns = new Map()
      for (const ci of checkInsData) {
        const actId = instanceToActivity.get(ci.activity_instance_id)
        if (actId) {
          checkIns.set(`${ci.student_id}-${actId}`, ci)
        }
      }

      // Status update counts per student+activity (for roster icons)
      const statusCounts = new Map()
      for (const s of statusData) {
        const actId = instanceToActivity.get(s.activity_instance_id)
        if (actId) {
          const key = `${s.student_id}-${actId}`
          statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1)
        }
      }

      // Activities with at least one attendance record
      const hasAttendanceRecords = new Map()
      for (const record of attendanceData) {
        const actId = instanceToActivity.get(record.activity_instance_id)
        if (actId) hasAttendanceRecords.set(actId, true)
      }

      return { waveCounts, waves, checkIns, statusCounts, hasAttendanceRecords, instances: instanceMap }
    },
    enabled: activityIds.length > 0 && !!orgId,
  })
}
