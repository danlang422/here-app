import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getStaffUsers, getStudents, createUser, updateUser } from '@/api/users'

export function useUsers(orgId) {
  return useQuery({
    queryKey: ['users', orgId],
    queryFn: () => getUsers(orgId),
    enabled: !!orgId,
  })
}

export function useStaffUsers(orgId) {
  return useQuery({
    queryKey: ['staff-users', orgId],
    queryFn: () => getStaffUsers(orgId),
    enabled: !!orgId,
  })
}

export function useStudents(orgId) {
  return useQuery({
    queryKey: ['students', orgId],
    queryFn: () => getStudents(orgId),
    enabled: !!orgId,
  })
}

export function useCreateUser(orgId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userData) => createUser({ ...userData, organization_id: orgId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', orgId] })
    },
  })
}

export function useUpdateUser(orgId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }) => updateUser(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', orgId] })
    },
  })
}
