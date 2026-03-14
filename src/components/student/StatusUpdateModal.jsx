import { useState } from 'react'

const STATUS_TYPES = ['plans', 'progress', 'reflection']

function StatusUpdateModal({
  isOpen,
  onClose,
  onSave,
  activityName,
  promptText,
  defaultType = 'reflection',
  allowTypeChange = true,
  saving = false,
}) {
  const [content, setContent] = useState('')
  const [statusType, setStatusType] = useState(defaultType)

  const charCount = content.length
  const isValid = charCount >= 1 && charCount <= 500

  const handleSave = async () => {
    if (!isValid || saving) return
    await onSave(content, statusType)
    setContent('')
    setStatusType(defaultType)
  }

  const handleClose = () => {
    setContent('')
    setStatusType(defaultType)
    onClose()
  }

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">{activityName}</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        {/* Prompt */}
        <p className="text-base-content/70 mb-3">{promptText}</p>

        {/* Textarea */}
        <textarea
          className="textarea textarea-bordered w-full h-28 resize-none"
          placeholder="Type here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          autoFocus
        />

        {/* Character count */}
        <div className="text-right mt-1">
          <span
            className={`text-sm ${
              charCount > 450 ? 'text-error' : 'text-base-content/50'
            }`}
          >
            {charCount} / 500
          </span>
        </div>

        {/* Type selector (conditional) */}
        {allowTypeChange && (
          <div className="join mt-3">
            {STATUS_TYPES.map((type) => (
              <button
                key={type}
                className={`join-item btn btn-sm ${
                  statusType === type ? 'btn-active' : ''
                }`}
                onClick={() => setStatusType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isValid || saving}
          >
            {saving && <span className="loading loading-spinner loading-xs" />}
            Save
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  )
}

export default StatusUpdateModal
