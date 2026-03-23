import { useState, useMemo } from 'react'
import ActivityTable from '@/components/activities/ActivityTable'
import ActivityToolbar from '@/components/activities/ActivityToolbar'
import ActivityDetailModal from '@/components/activities/ActivityDetailModal'
import FloatingPanel from '@/components/panels/FloatingPanel'
import EnrollmentPanel from '@/components/enrollment/EnrollmentPanel'
import { useActivities, useCreateActivity, useUpdateActivity } from '@/hooks/useActivities'
import { addActivityTerm } from '@/api/activityTerms'
import { useOrgEnrollments, useActivityEnrollments } from '@/hooks/useEnrollments'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import { useTerms } from '@/hooks/useTerms'
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

  // Server state
  const { data: activities = [], isLoading, error: loadError } = useActivities(orgId)
  const { data: orgSettings = {} } = useOrgSettings(orgId)
  const { data: defaultTemplate = null } = useDefaultScheduleTemplate(orgId)
  const { data: terms = [] } = useTerms(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)
  const { data: staffUsers = [] } = useStaffUsers(orgId)
  const createMutation = useCreateActivity(orgId)
  const updateMutation = useUpdateActivity(orgId)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null) // null = new activity
  const [isEditing, setIsEditing] = useState(false)

  // Enrollment panel state
  const [enrollingActivity, setEnrollingActivity] = useState(null)

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

  // Enrollment counts for the table (Map<activity_id, count>)
  const enrollmentCountByActivity = useMemo(() => {
    const map = new Map()
    for (const e of orgEnrollments) {
      map.set(e.activity_id, (map.get(e.activity_id) || 0) + 1)
    }
    return map
  }, [orgEnrollments])

  // Enrollments for the detail modal roster
  const { data: activityEnrollments = [] } = useActivityEnrollments(selectedActivity?.id)

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
        result = result.filter((a) => a.block == null)
      } else {
        result = result.filter((a) => a.block === Number(filters.block))
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
          !a.teacher_id && !a.monitor_id && !a.instructor_name && !a.mentor_name
        )
      } else {
        result = result.filter((a) =>
          a.teacher_id === filters.staff || a.monitor_id === filters.staff
        )
      }
    }

    result = [...result].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1

      if (sortField === 'name') {
        return dir * (a.name || '').localeCompare(b.name || '')
      }

      if (sortField === 'block') {
        if (a.block == null && b.block == null) return (a.name || '').localeCompare(b.name || '')
        if (a.block == null) return 1
        if (b.block == null) return -1
        if (a.block !== b.block) return dir * (a.block - b.block)
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
  const mutationError = createMutation.error || updateMutation.error
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
    if (selectedActivity) {
      updateMutation.mutate(
        { id: selectedActivity.id, updates: formData },
        {
          onSuccess: (updated) => {
            setSelectedActivity((prev) => ({ ...prev, ...updated }))
            setIsEditing(false)
          },
        }
      )
    } else {
      const { _pendingTerms = [], ...activityData } = formData
      createMutation.mutate(activityData, {
        onSuccess: async (created) => {
          for (const pt of _pendingTerms) {
            await addActivityTerm(created.id, pt.termId, { isPrimary: pt.is_primary })
          }
          setSelectedActivity(created)
          setIsEditing(false)
        },
      })
    }
  }

  function handleEnrollClick() {
    const target = selectedActivity
    setModalOpen(false)
    setEnrollingActivity(target)
  }

  function handleClearFilters() {
    setSearchQuery('')
    setFilters({ block: 'all', term: 'all', status: 'all', staff: 'all' })
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
            onClick={() => { createMutation.reset(); updateMutation.reset() }}
          >
            ✕
          </button>
        </div>
      )}

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

      <ActivityTable
        activities={filteredActivities}
        loading={isLoading}
        onSelect={handleSelect}
        enrollmentCounts={enrollmentCountByActivity}
        blockLabels={orgSettings?.block_labels}
      />

      <ActivityDetailModal
        open={modalOpen}
        activity={selectedActivity}
        isEditing={isEditing}
        saving={saving}
        orgSettings={orgSettings}
        enrollments={activityEnrollments}
        defaultTemplate={defaultTemplate}
        terms={terms}
        orgId={orgId}
        onClose={handleCloseModal}
        onEditClick={handleEditClick}
        onCancel={handleCancel}
        onSave={handleSave}
        onEnrollClick={handleEnrollClick}
      />

      {enrollingActivity && (
        <FloatingPanel
          title={`Enrollment — ${enrollingActivity.name}`}
          onClose={() => setEnrollingActivity(null)}
        >
          <EnrollmentPanel
            orgId={orgId}
            initialActivityId={enrollingActivity.id}
          />
        </FloatingPanel>
      )}
    </div>
  )
}

export default ActivityManagement
