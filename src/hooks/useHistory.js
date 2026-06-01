import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStudentActionHistory, getTeacherStudentActionHistory, getRecentTeacherActions } from '@/api/history'
import { formatDateISO, subDays } from '@/lib/scheduleUtils'
import { getDevToday } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production

// Full student history feed. startDate is a 'YYYY-MM-DD' string or null (all time).
// activityId and actionType are applied client-side against the fetched dataset.
export function useStudentHistory({ studentId, startDate, activityId, actionType }) {
  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['student-history', studentId, startDate ?? 'all'],
    queryFn: () => getStudentActionHistory(studentId, { startDate }),
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    let result = entries
    if (activityId) result = result.filter((e) => e.activityId === activityId)
    if (actionType === 'checkin') result = result.filter((e) => !!e.checkIn)
    if (actionType === 'wave') result = result.filter((e) => !!e.wave)
    if (actionType === 'status') result = result.filter((e) => e.statusUpdates.length > 0)
    return result
  }, [entries, activityId, actionType])

  return { entries: filtered, isLoading, isError }
}

// Full teacher history feed across all the teacher's activities.
// activityId and actionType are applied client-side. studentId filtering is
// done by the page after receiving entries (to keep the dataset cached for
// switching between students without refetching).
export function useTeacherStudentHistory({ teacherId, startDate, activityId, actionType }) {
  const { data: entries = [], isLoading, isError } = useQuery({
    queryKey: ['teacher-history', teacherId, startDate ?? 'all'],
    queryFn: () => getTeacherStudentActionHistory(teacherId, { startDate }),
    enabled: !!teacherId,
    staleTime: 5 * 60 * 1000,
  })

  const filtered = useMemo(() => {
    let result = entries
    if (activityId) result = result.filter((e) => e.activityId === activityId)
    if (actionType === 'checkin') result = result.filter((e) => !!e.checkIn)
    if (actionType === 'wave') result = result.filter((e) => !!e.wave)
    if (actionType === 'status') result = result.filter((e) => e.statusUpdates.length > 0)
    return result
  }, [entries, activityId, actionType])

  return { entries: filtered, isLoading, isError }
}

// Most recent N student activity instances. Fetches last 30 days — enough for
// the widget's 3-entry summary without fetching a full term.
export function useRecentStudentActivity({ studentId, limit = 3 }) {
  const sinceDate = useMemo(() => formatDateISO(subDays(getDevToday(), 30)), [])

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['student-history-recent', studentId],
    queryFn: () => getStudentActionHistory(studentId, { startDate: sinceDate }),
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000,
  })

  return { entries: entries.slice(0, limit), isLoading }
}

// Most recent N flat action rows across a teacher's activities (last 48 hours).
// Returns notification-style rows, not instance-grouped entries.
export function useRecentTeacherActivity({ teacherId, limit = 5 }) {
  const sinceDate = useMemo(() => formatDateISO(subDays(getDevToday(), 2)), [])

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['teacher-actions-recent', teacherId],
    queryFn: () => getRecentTeacherActions(teacherId, { sinceDate, limit }),
    enabled: !!teacherId,
    staleTime: 2 * 60 * 1000,
  })

  return { actions, isLoading }
}
