import { useQuery } from '@tanstack/react-query'
import { getTerms } from '@/api/terms'

export function useTerms(orgId) {
  return useQuery({
    queryKey: ['terms', orgId],
    queryFn: () => getTerms(orgId),
    enabled: !!orgId,
  })
}
