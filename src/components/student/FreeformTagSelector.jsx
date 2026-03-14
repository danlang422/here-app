import { useState } from 'react'

function FreeformTagSelector({
  isOpen,
  onClose,
  onConfirm,
  availableActivities,
  activityName,
}) {
  const [selected, setSelected] = useState(new Set())

  const toggleActivity = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    if (selected.size === 0) return
    onConfirm([...selected])
    setSelected(new Set())
  }

  const handleClose = () => {
    setSelected(new Set())
    onClose()
  }

  if (!isOpen) return null

  return (
    <dialog className="modal modal-open">
      <div className="modal-box">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">What are you working on?</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-base-content/60 mb-3">
          Select the activities you're working on during {activityName}
        </p>

        {/* Activity checkboxes */}
        <div className="flex flex-col gap-2">
          {availableActivities.map((activity) => (
            <label
              key={activity.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 cursor-pointer"
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={selected.has(activity.id)}
                onChange={() => toggleActivity(activity.id)}
              />
              <span className="text-sm">{activity.name}</span>
            </label>
          ))}
        </div>

        {availableActivities.length === 0 && (
          <p className="text-sm text-base-content/50 text-center py-4">
            No other activities available for tagging.
          </p>
        )}

        {/* Footer */}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={handleClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={selected.size === 0}
          >
            Continue
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  )
}

export default FreeformTagSelector
