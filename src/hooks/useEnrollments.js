import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getOrgEnrollments,
  getActivityEnrollments,
  bulkEnrollStudents,
  bulkUnenrollStudents,
  updateEnrollment,
} from '@/api/enrollments'

export function useOrgEnrollments(orgId) {
  return useQuery({
    queryKey: ['enrollments', orgId],
    queryFn: () => getOrgEnrollments(orgId),
    enabled: !!orgId,
  })
}

export function useActivityEnrollments(activityId) {
  return useQuery({
    queryKey: ['enrollments', 'activity', activityId],
    queryFn: () => getActivityEnrollments(activityId),
    enabled: !!activityId,
  })
}

export function useBulkEnrollStudents() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (enrollments) => bulkEnrollStudents(enrollments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
  })
}

export function useBulkUnenrollStudents() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (enrollmentIds) => bulkUnenrollStudents(enrollmentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
  })
}

export function useUpdateEnrollment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...updates }) => updateEnrollment(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] })
    },
  })
}
