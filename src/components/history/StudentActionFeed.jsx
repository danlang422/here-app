import { useMemo } from 'react'
import { ClockCounterClockwise } from '@phosphor-icons/react'
import FeedEntryCard from './FeedEntryCard'

function formatDateHeader(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function StudentActionFeed({ entries, isLoading, isTeacherView, emptyMessage, blockLabels }) {
  const grouped = useMemo(() => {
    const groups = []
    let currentDate = null

    for (const entry of entries) {
      if (entry.date !== currentDate) {
        currentDate = entry.date
        groups.push({ date: entry.date, label: formatDateHeader(entry.date), entries: [] })
      }
      groups[groups.length - 1].entries.push(entry)
    }

    return groups
  }, [entries])

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-md" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body items-center text-center py-12">
          <ClockCounterClockwise size={36} weight="thin" className="text-base-content/30 mb-2" />
          <p className="text-base-content/50 text-sm">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <div key={group.date}>
          <div className="text-xs font-semibold text-base-content/40 uppercase tracking-wide mb-2 px-0.5">
            {group.label}
          </div>
          <div className="space-y-2">
            {group.entries.map((entry) => (
              <FeedEntryCard
                key={`${entry.instanceId}:${entry.studentId}`}
                entry={entry}
                isTeacherView={isTeacherView}
                blockLabels={blockLabels}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default StudentActionFeed
