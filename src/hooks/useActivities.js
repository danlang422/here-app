import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getActivities, createActivity, updateActivity } from '@/api/activities'

export function useActivities(orgId) {
  return useQuery({
    queryKey: ['activities', orgId],
    queryFn: () => getActivities(orgId),
    enabled: !!orgId,
  })
}

export function useCreateActivity(orgId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (activity) => createActivity({ ...activity, organization_id: orgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
    },
  })
}

export function useUpdateActivity(orgId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }) => updateActivity(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
    },
  })
}
