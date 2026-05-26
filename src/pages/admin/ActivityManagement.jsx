import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ActivityTable from '@/components/activities/ActivityTable'
import ActivityToolbar from '@/components/activities/ActivityToolbar'
import ActivitySelectionBar from '@/components/activities/ActivitySelectionBar'
import ActivityDetailModal from '@/components/activities/ActivityDetailModal'
import BulkEditModal from '@/components/activities/BulkEditModal'
import { useActivities, useCreateActivity, useUpdateActivity, useDeleteActivity } from '@/hooks/useActivities'
import { addActivityTerm } from '@/api/activityTerms'
import { setActivityStaff } from '@/api/activities'
import { useOrgEnrollments } from '@/hooks/useEnrollments'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import { useTerms } from '@/hooks/useTerms'
import { useCalendars } from '@/hooks/useCalendars'
import { useStaffUsers } from '@/hooks/useUsers'
import useAuthStore from '@/store/authStore'

function getScheduleStatus(activity) {
  if (activity.is_not_scheduled) return 'not_scheduled'
  if (activity.is_release) return 'release'
  if (!activity.days_of_week && !activity.rotation_day_type) return 'needs_scheduling'
  if (!activity.default_start_time) return 'needs_scheduling'
  return 'scheduled'
}

function ActivityManagement() {
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id
  const queryClient = useQueryClient()

  // Server state
  const { data: activities = [], isLoading, error: loadError } = useActivities(orgId)
  const { data: orgSettings = {} } = useOrgSettings(orgId)
  const { data: defaultTemplate = null } = useDefaultScheduleTemplate(orgId)
  const { data: terms = [] } = useTerms(orgId)
  const { data: calendars = [] } = useCalendars(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)
  const { data: staffUsers = [] } = useStaffUsers(orgId)
  const createMutation = useCreateActivity(orgId)
  const updateMutation = useUpdateActivity(orgId)
  const deleteMutation = useDeleteActivity(orgId)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null) // null = new activity
  const [isEditing, setIsEditing] = useState(false)

  // Filter / sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    block: 'all',
    term: 'all',
    status: 'all',
    staff: 'all',
  })
  const [sortField, setSortField] = useState('block')
  const [sortDir, setSortDir] = useState('asc')

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  // Clear selection when filters or search change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [filters, searchQuery])

  // Enrollment counts for the table (Map<activity_id, count>)
  const enrollmentCountByActivity = useMemo(() => {
    const map = new Map()
    for (const e of orgEnrollments) {
      map.set(e.activity_id, (map.get(e.activity_id) || 0) + 1)
    }
    return map
  }, [orgEnrollments])

  // Filtered + sorted activities
  const filteredActivities = useMemo(() => {
    let result = activities

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((a) =>
        a.name?.toLowerCase().includes(q) ||
        a.instructor_name?.toLowerCase().includes(q) ||
        a.mentor_name?.toLowerCase().includes(q) ||
        a.location?.toLowerCase().includes(q) ||
        a.teacher?.last_name?.toLowerCase().includes(q) ||
        a.monitor?.last_name?.toLowerCase().includes(q)
      )
    }

    if (filters.block !== 'all') {
      if (filters.block === 'none') {
        result = result.filter((a) => !a.block?.length)
      } else {
        const filterBlock = Number(filters.block)
        result = result.filter((a) => Array.isArray(a.block) && a.block.includes(filterBlock))
      }
    }

    if (filters.term !== 'all') {
      if (filters.term === 'none') {
        result = result.filter((a) => !a.activity_terms?.length)
      } else {
        result = result.filter((a) =>
          a.activity_terms?.some((at) => at.term_id === filters.term)
        )
      }
    }

    if (filters.status !== 'all') {
      result = result.filter((a) => getScheduleStatus(a) === filters.status)
    }

    if (filters.staff !== 'all') {
      if (filters.staff === 'none') {
        result = result.filter((a) =>
          !a.activity_staff?.length && !a.instructor_name && !a.mentor_name
        )
      } else {
        result = result.filter((a) =>
          a.activity_staff?.some((s) => s.user_id === filters.staff)
        )
      }
    }

    result = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1

      if (sortField === 'name') {
        return dir * (a.name || '').localeCompare(b.name || '')
      }

      if (sortField === 'block') {
        const aMin = a.block?.length ? Math.min(...a.block) : null
        const bMin = b.block?.length ? Math.min(...b.block) : null
        if (aMin == null && bMin == null) return (a.name || '').localeCompare(b.name || '')
        if (aMin == null) return 1
        if (bMin == null) return -1
        if (aMin !== bMin) return dir * (aMin - bMin)
        return (a.name || '').localeCompare(b.name || '')
      }

      if (sortField === 'time') {
        if (!a.default_start_time && !b.default_start_time) return (a.name || '').localeCompare(b.name || '')
        if (!a.default_start_time) return 1
        if (!b.default_start_time) return -1
        if (a.default_start_time !== b.default_start_time) {
          return dir * a.default_start_time.localeCompare(b.default_start_time)
        }
        return (a.name || '').localeCompare(b.name || '')
      }

      if (sortField === 'enrolled') {
        const ca = enrollmentCountByActivity.get(a.id) || 0
        const cb = enrollmentCountByActivity.get(b.id) || 0
        if (ca !== cb) return dir * (ca - cb)
        return (a.name || '').localeCompare(b.name || '')
      }

      return 0
    })

    return result
  }, [activities, searchQuery, filters, sortField, sortDir, enrollmentCountByActivity])

  const hasActiveFilters = searchQuery.trim() || Object.values(filters).some((v) => v !== 'all')

  const saving = createMutation.isPending || updateMutation.isPending
  const deleting = deleteMutation.isPending
  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error
  const error = loadError?.message || mutationError?.message

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleCreate() {
    setSelectedActivity(null)
    setIsEditing(true)
    setModalOpen(true)
  }

  function handleSelect(activity) {
    setSelectedActivity(activity)
    setIsEditing(false)
    setModalOpen(true)
  }

  function handleCloseModal() {
    setModalOpen(false)
    setIsEditing(false)
    setSelectedActivity(null)
    createMutation.reset()
    updateMutation.reset()
    deleteMutation.reset()
  }

  function handleDelete(activityId) {
    deleteMutation.mutate(activityId, {
      onSuccess: () => {
        handleCloseModal()
      },
    })
  }

  function handleEditClick() {
    setIsEditing(true)
  }

  function handleCancel() {
    if (!selectedActivity) {
      handleCloseModal()
    } else {
      setIsEditing(false)
      updateMutation.reset()
    }
  }

  function handleSave(formData) {
    const { _pendingStaff = [], _pendingTerms = [], ...activityData } = formData

    if (selectedActivity) {
      updateMutation.mutate(
        { id: selectedActivity.id, updates: activityData },
        {
          onSuccess: async (updated) => {
            await setActivityStaff(selectedActivity.id, _pendingStaff)
            queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
            setSelectedActivity((prev) => ({ ...prev, ...updated }))
            setIsEditing(false)
          },
        }
      )
    } else {
      createMutation.mutate(activityData, {
        onSuccess: async (created) => {
          await setActivityStaff(created.id, _pendingStaff)
          queryClient.invalidateQueries({ queryKey: ['activities', orgId] })
          for (const pt of _pendingTerms) {
            await addActivityTerm(created.id, pt.termId, { isPrimary: pt.is_primary })
          }
          setSelectedActivity(created)
          setIsEditing(false)
        },
      })
    }
  }

  function handleClearFilters() {
    setSearchQuery('')
    setFilters({ block: 'all', term: 'all', status: 'all', staff: 'all' })
  }

  function handleToggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleToggleSelectAll(filteredIds) {
    const allSelected = filteredIds.every((id) => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredIds))
    }
  }

  function handleBulkEditClose() {
    setBulkEditOpen(false)
    setSelectedIds(new Set())
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Activities</h2>
          <p className="text-base-content/60 text-sm mt-1">
            {filteredActivities.length === activities.length
              ? `${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}`
              : `${filteredActivities.length} of ${activities.length} activities`
            }
            {hasActiveFilters && (
              <button
                className="ml-2 text-primary underline text-xs"
                onClick={handleClearFilters}
              >
                Clear filters
              </button>
            )}
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          + New Activity
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { createMutation.reset(); updateMutation.reset(); deleteMutation.reset() }}
          >
            ✕
          </button>
        </div>
      )}

      {selectedIds.size > 0 ? (
        <ActivitySelectionBar
          selectedCount={selectedIds.size}
          totalFilteredCount={filteredActivities.length}
          onDeselectAll={() => setSelectedIds(new Set())}
          onSelectAll={() => handleToggleSelectAll(filteredActivities.map((a) => a.id))}
          onBulkEdit={() => setBulkEditOpen(true)}
        />
      ) : (
        <ActivityToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          sortField={sortField}
          sortDir={sortDir}
          onSortChange={(field) => {
            if (field === sortField) {
              setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
            } else {
              setSortField(field)
              setSortDir(field === 'enrolled' ? 'desc' : 'asc')
            }
          }}
          terms={terms}
          staffUsers={staffUsers}
          orgSettings={orgSettings}
        />
      )}

      <ActivityTable
        activities={filteredActivities}
        loading={isLoading}
        onSelect={handleSelect}
        enrollmentCounts={enrollmentCountByActivity}
        blockLabels={orgSettings?.block_labels}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
      />

      <ActivityDetailModal
        open={modalOpen}
        activity={selectedActivity}
        isEditing={isEditing}
        saving={saving}
        deleting={deleting}
        orgSettings={orgSettings}
        defaultTemplate={defaultTemplate}
        terms={terms}
        calendars={calendars}
        orgId={orgId}
        onClose={handleCloseModal}
        onEditClick={handleEditClick}
        onCancel={handleCancel}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {bulkEditOpen && (
        <BulkEditModal
          selectedIds={selectedIds}
          terms={terms}
          orgSettings={orgSettings}
          orgId={orgId}
          onClose={handleBulkEditClose}
        />
      )}
    </div>
  )
}

export default ActivityManagement
