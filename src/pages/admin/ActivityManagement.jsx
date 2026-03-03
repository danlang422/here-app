import { useState } from 'react'
import ActivityForm from '@/components/activities/ActivityForm'
import ActivityTable from '@/components/activities/ActivityTable'
import { useActivities, useCreateActivity, useUpdateActivity } from '@/hooks/useActivities'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import useAuthStore from '@/store/authStore'
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from '@/lib/constants'

function ActivityManagement() {
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id

  // Server state
  const { data: activities = [], isLoading, error: loadError } = useActivities(orgId)
  const { data: orgSettings = {} } = useOrgSettings(orgId)
  const createMutation = useCreateActivity(orgId)
  const updateMutation = useUpdateActivity(orgId)

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [typeFilter, setTypeFilter] = useState('')

  const saving = createMutation.isPending || updateMutation.isPending
  const mutationError = createMutation.error || updateMutation.error

  function handleCreate() {
    setEditingActivity(null)
    setShowForm(true)
  }

  function handleEdit(activity) {
    setEditingActivity(activity)
    setShowForm(true)
  }

  function handleCancel() {
    setShowForm(false)
    setEditingActivity(null)
    createMutation.reset()
    updateMutation.reset()
  }

  function handleSave(formData) {
    const onSuccess = () => {
      setShowForm(false)
      setEditingActivity(null)
    }

    if (editingActivity) {
      updateMutation.mutate({ id: editingActivity.id, updates: formData }, { onSuccess })
    } else {
      createMutation.mutate(formData, { onSuccess })
    }
  }

  // Apply filters
  const filteredActivities = activities.filter((a) => {
    if (typeFilter && a.type !== typeFilter) return false
    return true
  })

  const error = loadError?.message || mutationError?.message

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Activities</h2>
          <p className="text-base-content/60 text-sm mt-1">
            {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
          </p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={handleCreate}>
            + New Activity
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { createMutation.reset(); updateMutation.reset() }}>✕</button>
        </div>
      )}

      {showForm && (
        <div className="card bg-base-100 shadow-lg mb-6">
          <div className="card-body">
            <h3 className="card-title text-lg mb-2">
              {editingActivity ? 'Edit Activity' : 'New Activity'}
            </h3>
            <ActivityForm
              activity={editingActivity}
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
              orgSettings={orgSettings}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      {!showForm && activities.length > 0 && (
        <div className="flex gap-2 mb-4">
          <select
            className="select select-bordered select-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      )}

      <ActivityTable
        activities={filteredActivities}
        loading={isLoading}
        onEdit={handleEdit}
        orgSettings={orgSettings}
      />
    </div>
  )
}

export default ActivityManagement
