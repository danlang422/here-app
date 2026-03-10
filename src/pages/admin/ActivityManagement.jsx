import { useState, useMemo } from 'react'
import ActivityTable from '@/components/activities/ActivityTable'
import ActivityDetailModal from '@/components/activities/ActivityDetailModal'
import FloatingPanel from '@/components/panels/FloatingPanel'
import EnrollmentPanel from '@/components/enrollment/EnrollmentPanel'
import { useActivities, useCreateActivity, useUpdateActivity } from '@/hooks/useActivities'
import { useOrgEnrollments, useActivityEnrollments } from '@/hooks/useEnrollments'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import { useTerms } from '@/hooks/useTerms'
import useAuthStore from '@/store/authStore'

function ActivityManagement() {
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id

  // Server state
  const { data: activities = [], isLoading, error: loadError } = useActivities(orgId)
  const { data: orgSettings = {} } = useOrgSettings(orgId)
  const { data: defaultTemplate = null } = useDefaultScheduleTemplate(orgId)
  const { data: terms = [] } = useTerms(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)
  const createMutation = useCreateActivity(orgId)
  const updateMutation = useUpdateActivity(orgId)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState(null) // null = new activity
  const [isEditing, setIsEditing] = useState(false)

  // Enrollment panel state
  const [enrollingActivity, setEnrollingActivity] = useState(null)

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
      // Was creating new — close the modal
      handleCloseModal()
    } else {
      // Was editing existing — return to view
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
            // Merge updated flat fields while preserving joined teacher/monitor objects.
            // The joins may be slightly stale if staff changed, but that's acceptable for v1.
            setSelectedActivity((prev) => ({ ...prev, ...updated }))
            setIsEditing(false)
          },
        }
      )
    } else {
      createMutation.mutate(formData, {
        onSuccess: (created) => {
          // Switch to view mode of the newly created activity
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Activities</h2>
          <p className="text-base-content/60 text-sm mt-1">
            {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
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

      <ActivityTable
        activities={activities}
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
