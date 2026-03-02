import { useState, useEffect, useCallback } from 'react'
import ActivityForm from '@/components/activities/ActivityForm'
import ActivityTable from '@/components/activities/ActivityTable'
import { getActivities, createActivity, updateActivity } from '@/api/activities'
import { getOrgSettings } from '@/api/organizations'
import useAuthStore from '@/store/authStore'
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from '@/lib/constants'

function ActivityManagement() {
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id

  // Data state
  const [activities, setActivities] = useState([])
  const [orgSettings, setOrgSettings] = useState({})
  const [loading, setLoading] = useState(true)

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState('')

  const loadData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    try {
      const [activitiesData, settings] = await Promise.all([
        getActivities(orgId),
        getOrgSettings(orgId),
      ])
      setActivities(activitiesData)
      setOrgSettings(settings)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('Failed to load activities. Please try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

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
  }

  async function handleSave(formData) {
    setSaving(true)
    setError(null)
    try {
      if (editingActivity) {
        await updateActivity(editingActivity.id, formData)
      } else {
        await createActivity({ ...formData, organization_id: orgId })
      }
      setShowForm(false)
      setEditingActivity(null)
      await loadData()
    } catch (err) {
      console.error('Failed to save activity:', err)
      setError(err.message || 'Failed to save activity.')
    } finally {
      setSaving(false)
    }
  }

  // Apply filters
  const filteredActivities = activities.filter((a) => {
    if (typeFilter && a.type !== typeFilter) return false
    return true
  })

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
          <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>✕</button>
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
        loading={loading}
        onEdit={handleEdit}
        orgSettings={orgSettings}
      />
    </div>
  )
}

export default ActivityManagement
