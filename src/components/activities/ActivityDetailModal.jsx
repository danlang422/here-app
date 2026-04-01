import { useEffect } from 'react'
import { FaTimes } from 'react-icons/fa'
import ActivityDetail from './ActivityDetail'

/**
 * ActivityDetailModal — thin DaisyUI modal wrapper around ActivityDetail.
 *
 * Props:
 *   open        - boolean, whether modal is visible
 *   activity    - activity object (or null for new)
 *   isEditing   - boolean, controls view vs edit mode
 *   saving      - boolean, passed to ActivityDetail for save button state
 *   orgSettings - org settings object
 *   onClose     - closes the modal entirely
 *   onEditClick - switches to edit mode
 *   onCancel    - cancels edit, returns to view mode
 *   onSave      - called with form data
 */
export default function ActivityDetailModal({
  open,
  activity,
  isEditing,
  saving,
  deleting,
  orgSettings,
  defaultTemplate,
  terms,
  calendars,
  orgId,
  onClose,
  onEditClick,
  onCancel,
  onSave,
  onDelete,
}) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-4xl relative pt-10">
        {/* Modal close button — round, top-right corner of modal frame */}
        <button
          type="button"
          className="btn btn-sm btn-circle absolute right-3 top-3 z-10"
          onClick={onClose}
          title="Close"
        >
          <FaTimes size={12} />
        </button>

        <ActivityDetail
          activity={activity}
          mode={isEditing ? 'edit' : 'view'}
          saving={saving}
          deleting={deleting}
          orgSettings={orgSettings}
          defaultTemplate={defaultTemplate}
          terms={terms}
          calendars={calendars}
          orgId={orgId}
          onSave={onSave}
          onCancel={onCancel}
          onEditClick={onEditClick}
          onDelete={onDelete}
        />
      </div>

      {/* Backdrop — click outside to close */}
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  )
}
