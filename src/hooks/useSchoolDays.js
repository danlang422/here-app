import { useQuery } from '@tanstack/react-query'
import { getSchoolDays } from '@/api/calendar'

export function useSchoolDays(orgId, startDate, endDate) {
  return useQuery({
    queryKey: ['school-days', orgId, startDate, endDate],
    queryFn: () => getSchoolDays(orgId, startDate, endDate),
    enabled: !!orgId && !!startDate && !!endDate,
  })
}
