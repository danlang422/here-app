import { useEffect } from 'react'
import { HandWaving, CheckCircle, SignOut, Prohibit, Flame } from '@phosphor-icons/react'
import { useStudentInstanceDetail } from '@/hooks/useStudentInstanceDetail'
import { getBlockLabel } from '@/lib/constants'

const STATUS_TYPE_STYLES = {
  plans: 'text-info',
  progress: 'text-success',
  reflection: 'text-base-content/70',
}

function StudentDetailOverlay({
  isOpen,
  onClose,
  student,
  instanceId,
  activity,
  orgId,
  blockLabels,
}) {
  const { data: detail, isLoading } = useStudentInstanceDetail(
    student?.studentId,
    instanceId,
    activity,
    orgId
  )

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !student) return null

  const displayName = student.preferredName
    ? `${student.preferredName} ${student.lastName}`
    : `${student.firstName} ${student.lastName}`

  const activityName = activity?.name ?? student.activityName ?? ''
  const blockLabel = activity?.block?.length > 0
    ? activity.block.map(b => getBlockLabel(b, blockLabels)).join(', ')
    : null
  const subtitle = [activityName, blockLabel].filter(Boolean).join(' \u00b7 ')

  const hasData =
    detail && (detail.checkIn || detail.wave || detail.statusUpdates?.length > 0)

  return (
    <dialog className="modal modal-open" style={{ zIndex: 60 }}>
      <div className="modal-box max-w-md">
        {/* Header */}
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="mb-2">
          <h3 className="font-bold text-lg">{displayName}</h3>
          {subtitle && (
            <p className="text-sm text-base-content/60">{subtitle}</p>
          )}
        </div>

        <div className="divider my-0" />

        {/* Body */}
        <div className="py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          )}

          {!isLoading && !hasData && (
            <p className="text-base-content/50 text-center py-8">
              No activity recorded for this date.
            </p>
          )}

          {!isLoading && detail && (
            <>
              {/* Check-In Section */}
              {detail.checkIn && (
                <div>
                  <SectionHeader>CHECK-IN</SectionHeader>
                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle weight="fill" size={16} className="text-success shrink-0" />
                      <span>
                        Checked in at{' '}
                        {formatTimestamp(detail.checkIn.checked_in_at)}
                      </span>
                    </div>
                    {detail.checkIn.checked_out_at && (
                      <div className="flex items-center gap-2 text-sm">
                        <SignOut size={16} className="text-success shrink-0" />
                        <span>
                          Checked out at{' '}
                          {formatTimestamp(detail.checkIn.checked_out_at)}
                        </span>
                      </div>
                    )}
                    {detail.checkIn.geofence_validated === false && (
                      <div className="flex items-center gap-2 text-sm text-error">
                        <Prohibit size={16} className="shrink-0" />
                        <span>Location check failed</span>
                      </div>
                    )}
                    {detail.freeformTags?.length > 0 && (
                      <div className="text-sm text-base-content/70 mt-1">
                        Working on: {detail.freeformTags.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Wave Section */}
              {detail.wave && (
                <div>
                  <SectionHeader>WAVE</SectionHeader>
                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <HandWaving size={16} className="text-success shrink-0" />
                      <span>
                        Waved at {formatTimestamp(detail.wave.waved_at)}
                      </span>
                    </div>
                    {detail.streak > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Flame
                          weight="fill"
                          size={16}
                          className={`shrink-0 ${
                            detail.streak >= 5
                              ? 'text-amber-500'
                              : 'text-base-content/40'
                          }`}
                        />
                        <span>{detail.streak} day streak</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Updates Section */}
              {detail.statusUpdates?.length > 0 && (
                <div>
                  <SectionHeader>STATUS UPDATES</SectionHeader>
                  <div className="space-y-0 mt-2 border border-base-300 rounded-lg overflow-hidden">
                    {detail.statusUpdates.map((update, i) => (
                      <div
                        key={update.id}
                        className={`p-3 ${
                          i > 0 ? 'border-t border-base-300' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-medium ${
                              STATUS_TYPE_STYLES[update.status_type] ?? ''
                            }`}
                          >
                            {update.status_type}
                          </span>
                          <span className="text-xs text-base-content/40">
                            {formatTimestamp(update.created_at)}
                          </span>
                        </div>
                        <p className="text-sm">{update.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" style={{ zIndex: -1 }}>
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}

function SectionHeader({ children }) {
  return (
    <h4 className="text-xs font-semibold tracking-wide text-base-content/40 uppercase">
      {children}
    </h4>
  )
}

function formatTimestamp(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default StudentDetailOverlay
