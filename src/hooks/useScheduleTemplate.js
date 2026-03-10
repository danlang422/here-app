import { useQuery } from '@tanstack/react-query'
import { getDefaultTemplate } from '@/api/scheduleTemplates'

export function useDefaultScheduleTemplate(orgId) {
  return useQuery({
    queryKey: ['schedule-template-default', orgId],
    queryFn: () => getDefaultTemplate(orgId),
    enabled: !!orgId,
  })
}
