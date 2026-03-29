import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCalendars, createCalendar, updateCalendar, deleteCalendar } from '@/api/calendars'

export function useCalendars(orgId) {
  return useQuery({
    queryKey: ['calendars', orgId],
    queryFn: () => getCalendars(orgId),
    enabled: !!orgId,
  })
}

export function useCreateCalendar(orgId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (calendar) => createCalendar({ ...calendar, organization_id: orgId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendars', orgId] }),
  })
}

export function useUpdateCalendar(orgId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }) => updateCalendar(id, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendars', orgId] }),
  })
}

export function useDeleteCalendar(orgId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => deleteCalendar(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars', orgId] })
      // Activities that referenced this calendar now have calendar_id = NULL.
      // Invalidate activities so the UI reflects the unassigned state.
      queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
    },
  })
}
