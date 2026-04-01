import { useEffect, useRef } from 'react'

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'p' : 'a'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

export function CalendarAggregatePopover({
  aggregateData,
  position,
  onClose,
  onActivityClick,
  enrollmentCountByActivity,
}) {
  const ref = useRef(null)

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const style = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex: 50,
    maxWidth: '280px',
    maxHeight: `calc(100vh - ${position.y + 16}px)`,
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={ref}
        className="bg-base-100 border border-base-300 rounded-lg shadow-lg"
        style={style}
      >
        <div className="px-3 py-2 border-b border-base-200 text-xs font-semibold text-base-content/70 shrink-0 rounded-t-lg">
          {aggregateData.count} activities &middot; {aggregateData.totalEnrollment} students
        </div>
        <ul className="flex-1 divide-y divide-base-200 overflow-y-auto">
          {aggregateData.activities.map((activity) => {
            const enrollCount = enrollmentCountByActivity[activity.id] ?? 0
            const borderColor = activity.calendar?.color ?? '#94a3b8'
            return (
              <li
                key={activity.id}
                className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-base-200 transition-colors"
                onClick={() => onActivityClick(activity)}
              >
                <div
                  className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                  style={{ backgroundColor: borderColor }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{activity.name}</span>
                  <span className="text-xs text-base-content/60">
                    {formatTime(activity.default_start_time)}&ndash;{formatTime(activity.default_end_time)}
                    {activity.teacher?.last_name && ` \u00b7 ${activity.teacher.last_name}`}
                    {` \u00b7 ${enrollCount} student${enrollCount !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
