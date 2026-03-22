import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getActivityTerms, addActivityTerm, removeActivityTerm } from '@/api/activityTerms'

export function useActivityTerms(activityId) {
  return useQuery({
    queryKey: ['activity-terms', activityId],
    queryFn: () => getActivityTerms(activityId),
    enabled: !!activityId,
  })
}

export function useAddActivityTerm(activityId, orgId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ termId, isPrimary }) => addActivityTerm(activityId, termId, { isPrimary }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-terms', activityId] })
      queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
    },
  })
}

export function useRemoveActivityTerm(activityId, orgId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (activityTermId) => removeActivityTerm(activityTermId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-terms', activityId] })
      queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
    },
  })
}
