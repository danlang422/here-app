import { useState } from 'react'
import { HandWaving, CheckCircle, NotePencil } from '@phosphor-icons/react'
import { getBlockLabel } from '@/lib/constants'

const STATUS_TYPE_STYLES = {
  plans: 'text-info',
  progress: 'text-success',
  reflection: 'text-base-content/70',
}

function formatTime(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function FeedEntryCard({ entry, isTeacherView, blockLabels }) {
  const [showAll, setShowAll] = useState(false)

  const dateLabel = new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const blockBadge = (entry.block ?? []).map((b) => getBlockLabel(b, blockLabels)).join(', ')
  const meta = [blockBadge, entry.location ?? entry.staffDisplayName].filter(Boolean).join(' · ')

  const visibleUpdates = showAll ? entry.statusUpdates : entry.statusUpdates.slice(0, 1)
  const hiddenCount = entry.statusUpdates.length - 1

  return (
    <div
      className="card bg-base-100 border border-base-300 shadow-sm border-l-4"
      style={entry.calendarColor ? { borderLeftColor: entry.calendarColor } : { borderLeftColor: 'transparent' }}
    >
      <div className="card-body p-3 gap-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm leading-tight">{entry.activityName}</div>
            {isTeacherView && entry.studentName && (
              <div className="text-xs text-base-content/60 mt-0.5">{entry.studentName}</div>
            )}
          </div>
          <div className="text-xs text-base-content/50 shrink-0 pt-0.5">{dateLabel}</div>
        </div>

        {/* Meta */}
        {meta && (
          <div className="text-xs text-base-content/50 -mt-1">{meta}</div>
        )}

        {/* Action summary */}
        <div className="flex items-center gap-3">
          {entry.wave && (
            <div className="flex items-center gap-1 text-xs text-base-content/70">
              <HandWaving size={13} weight="fill" className="text-info" />
              <span>{formatTime(entry.wave.waved_at)}</span>
            </div>
          )}
          {entry.checkIn && (
            <div className="flex items-center gap-1 text-xs text-base-content/70">
              <CheckCircle size={13} weight="fill" className="text-success" />
              <span>
                {formatTime(entry.checkIn.checked_in_at)}
                {entry.checkIn.checked_out_at && ` – ${formatTime(entry.checkIn.checked_out_at)}`}
              </span>
            </div>
          )}
          {entry.statusUpdates.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-base-content/70">
              <NotePencil size={13} weight="fill" className="text-primary" />
              <span>{entry.statusUpdates.length}</span>
            </div>
          )}
        </div>

        {/* Status updates */}
        {entry.statusUpdates.length > 0 && (
          <div className="space-y-1.5">
            {visibleUpdates.map((su) => (
              <div key={su.id} className="bg-base-200/60 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-xs font-medium capitalize ${STATUS_TYPE_STYLES[su.status_type] ?? 'text-base-content/60'}`}>
                    {su.status_type}
                  </span>
                  <span className="text-xs text-base-content/40">·</span>
                  <span className="text-xs text-base-content/40">{formatTime(su.created_at)}</span>
                </div>
                <p className="text-sm text-base-content leading-snug">{su.content}</p>
              </div>
            ))}
            {!showAll && hiddenCount > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setShowAll(true)}
              >
                Show {hiddenCount} more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FeedEntryCard
