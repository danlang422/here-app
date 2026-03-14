import { useQuery } from '@tanstack/react-query'
import { formatDateISO } from '@/lib/scheduleUtils'
import {
  getInstancesForActivities,
  getStudentCheckIns,
  getStudentWaves,
  getStudentStatusCounts,
} from '@/api/agenda'

export function useStudentActions(studentId, activities, date, orgId) {
  const dateStr = formatDateISO(date)
  const activityIds = activities.map((a) => a.id)

  return useQuery({
    queryKey: ['student-actions', studentId, dateStr],
    queryFn: async () => {
      // Step 1: Resolve instance IDs for the activities on this date
      const instanceMap = await getInstancesForActivities(orgId, dateStr, activityIds)

      const instanceIds = [...instanceMap.values()]
      if (instanceIds.length === 0) {
        return {
          checkIns: new Map(),
          waves: new Map(),
          statusCounts: new Map(),
          instances: new Map(),
        }
      }

      // Step 2: Fetch all action data in parallel
      const [checkInsData, wavesData, statusData] = await Promise.all([
        getStudentCheckIns(studentId, instanceIds),
        getStudentWaves(studentId, instanceIds),
        getStudentStatusCounts(studentId, instanceIds),
      ])

      // Build reverse map: instanceId → activityId
      const instanceToActivity = new Map()
      for (const [activityId, instanceId] of instanceMap) {
        instanceToActivity.set(instanceId, activityId)
      }

      // Map check-ins by activityId
      const checkIns = new Map()
      for (const ci of checkInsData) {
        const actId = instanceToActivity.get(ci.activity_instance_id)
        if (actId) checkIns.set(actId, ci)
      }

      // Map waves by activityId
      const waves = new Map()
      for (const w of wavesData) {
        const actId = instanceToActivity.get(w.activity_instance_id)
        if (actId) waves.set(actId, w)
      }

      // Count status updates by activityId
      const statusCounts = new Map()
      for (const s of statusData) {
        const actId = instanceToActivity.get(s.activity_instance_id)
        if (actId) statusCounts.set(actId, (statusCounts.get(actId) ?? 0) + 1)
      }

      return { checkIns, waves, statusCounts, instances: instanceMap }
    },
    enabled: !!studentId && !!orgId && activityIds.length > 0,
  })
}
