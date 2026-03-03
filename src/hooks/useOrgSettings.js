import { useQuery } from '@tanstack/react-query'
import { getOrgSettings } from '@/api/organizations'

export function useOrgSettings(orgId) {
  return useQuery({
    queryKey: ['org-settings', orgId],
    queryFn: () => getOrgSettings(orgId),
    enabled: !!orgId,
  })
}
