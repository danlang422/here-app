import { useState, useEffect } from 'react'
import { supabase } from '@/api/supabase'
import useAuthStore from '@/store/authStore'
import ScreenshotPicker from './ScreenshotPicker'

const OTHER_VALUE = '__other__'

export default function ScheduleIssueForm({ formData, onChange, onScreenshotChange }) {
  const { profile, currentRole } = useAuthStore()
  const [activities, setActivities] = useState([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [showFreeform, setShowFreeform] = useState(false)

  useEffect(() => {
    if (currentRole === 'admin' || !profile?.id) return

    setLoadingActivities(true)

    async function fetchActivities() {
      try {
        if (currentRole === 'student') {
          const { data } = await supabase
            .from('enrollments')
            .select('activity:activities(id, name, block)')
            .eq('student_id', profile.id)
            .eq('is_active', true)
          setActivities(data?.map((e) => e.activity).filter(Boolean) ?? [])
        } else if (currentRole === 'teacher') {
          const { data } = await supabase
            .from('activities')
            .select('id, name, block')
            .eq('is_active', true)
            .order('block')
          setActivities(data ?? [])
        }
      } catch {
        // If the query fails, fall back gracefully to freeform only
        setActivities([])
      } finally {
        setLoadingActivities(false)
      }
    }

    fetchActivities()
  }, [profile?.id, currentRole])

  function handleDropdownChange(e) {
    const value = e.target.value
    if (value === OTHER_VALUE) {
      setShowFreeform(true)
      onChange('activity_id', null)
      onChange('activity_name_text', '')
    } else if (value) {
      setShowFreeform(false)
      const selected = activities.find((a) => a.id === value)
      onChange('activity_id', value)
      onChange('activity_name_text', selected?.name ?? '')
    } else {
      setShowFreeform(false)
      onChange('activity_id', null)
      onChange('activity_name_text', '')
    }
  }

  const blockLabel = (block) => (block != null ? ` (Block ${block})` : '')

  return (
    <div className="space-y-4">
      <div className="form-control">
        <label className="label">
          <span className="label-text">Which activity or block is wrong?</span>
        </label>

        {currentRole === 'admin' ? (
          <input
            type="text"
            className="input input-bordered"
            placeholder="Activity or block name…"
            value={formData.activity_name_text}
            onChange={(e) => onChange('activity_name_text', e.target.value)}
            maxLength={200}
          />
        ) : loadingActivities ? (
          <div className="skeleton h-10 w-full rounded" />
        ) : (
          <>
            <select
              className="select select-bordered"
              defaultValue=""
              onChange={handleDropdownChange}
            >
              <option value="">Select an activity…</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{blockLabel(a.block)}
                </option>
              ))}
              <option value={OTHER_VALUE}>Other / not listed</option>
            </select>

            {showFreeform && (
              <input
                type="text"
                className="input input-bordered mt-2"
                placeholder="Describe the activity or block…"
                value={formData.activity_name_text}
                onChange={(e) => onChange('activity_name_text', e.target.value)}
                maxLength={200}
              />
            )}
          </>
        )}
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">What&apos;s wrong with it? <span className="text-error">*</span></span>
        </label>
        <textarea
          className="textarea textarea-bordered h-24"
          placeholder="Describe the schedule problem…"
          value={formData.description}
          onChange={(e) => onChange('description', e.target.value)}
          maxLength={2000}
        />
        <label className="label">
          <span className="label-text-alt text-base-content/50">
            {formData.description.length}/2000
          </span>
        </label>
      </div>

      <ScreenshotPicker file={formData.screenshot} onChange={onScreenshotChange} />
    </div>
  )
}
