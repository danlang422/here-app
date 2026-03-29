import { useState } from 'react'
import ActivityDetailModal from '@/components/activities/ActivityDetailModal'
import { useCreateActivity, useUpdateActivity } from '@/hooks/useActivities'
import { useActivityEnrollments } from '@/hooks/useEnrollments'

function addMinutesToTime(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

export function CalendarEventPopover({
  activity,
  prefillData,
  onClose,
  orgId,
  orgSettings,
  defaultTemplate,
  terms,
  calendars,
}) {
  const isCreateMode = activity === null
  const [isEditing, setIsEditing] = useState(isCreateMode)

  const createMutation = useCreateActivity(orgId)
  const updateMutation = useUpdateActivity(orgId)

  const { data: enrollments = [] } = useActivityEnrollments(activity?.id)

  const prefillActivity = isCreateMode && prefillData
    ? {
        days_of_week: [prefillData.date.getDay()],
        default_start_time: prefillData.startTime,
        default_end_time: addMinutesToTime(prefillData.startTime, 60),
        calendar_id: prefillData.calendarId ?? null,
      }
    : null

  function handleSave(formData) {
    if (isCreateMode) {
      createMutation.mutate(formData, { onSuccess: onClose })
    } else {
      updateMutation.mutate(
        { id: activity.id, updates: formData },
        { onSuccess: onClose }
      )
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <ActivityDetailModal
      open
      activity={isCreateMode ? prefillActivity : activity}
      isEditing={isEditing}
      saving={saving}
      orgSettings={orgSettings}
      enrollments={enrollments}
      defaultTemplate={defaultTemplate}
      terms={terms}
      calendars={calendars}
      orgId={orgId}
      onClose={onClose}
      onEditClick={() => setIsEditing(true)}
      onCancel={isCreateMode ? onClose : () => setIsEditing(false)}
      onSave={handleSave}
      onEnrollClick={null}
    />
  )
}
