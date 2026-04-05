function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'p' : 'a'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

export function CalendarEventCard({ activity, enrollmentCount, mode, aggregateData, onClick, isDimmed = false }) {
  if (mode === 'aggregate') {
    const titleStr = aggregateData.activities?.map((a) => a.name).join('\n') ?? ''
    return (
      <div
        className={`absolute inset-0 rounded bg-base-200 overflow-hidden flex flex-col items-center justify-center cursor-pointer hover:bg-base-300 transition-all ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
        title={titleStr}
        onClick={(e) => onClick(e)}
      >
        <span className="text-xs font-semibold">
          {aggregateData.count} activit{aggregateData.count !== 1 ? 'ies' : 'y'}
        </span>
        <span className="text-[10px] text-base-content/60">
          {aggregateData.totalEnrollment} student{aggregateData.totalEnrollment !== 1 ? 's' : ''}
        </span>
      </div>
    )
  }

  const borderColor = activity.calendar?.color ?? '#94a3b8'
  const bgTint = activity.calendar?.color ? `${activity.calendar.color}0D` : undefined

  if (mode === 'few') {
    return (
      <div
        className={`absolute inset-0 rounded-lg border-l-4 overflow-hidden cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-md ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
        style={{ borderLeftColor: borderColor, backgroundColor: bgTint ?? 'oklch(var(--color-base-100))' }}
        onClick={() => onClick(activity)}
      >
        <div className="flex flex-col gap-0.5 h-full p-1.5 overflow-hidden">
          <span className="text-xs font-semibold truncate">{activity.name}</span>
          <span className="text-[10px] text-base-content/60">
            {enrollmentCount} student{enrollmentCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    )
  }

  // single mode
  return (
    <div
      className={`absolute inset-0 rounded-lg border-l-4 overflow-hidden cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-md ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
      style={{ borderLeftColor: borderColor, backgroundColor: bgTint ?? 'oklch(var(--color-base-100))' }}
      onClick={() => onClick(activity)}
    >
      <div className="flex flex-col gap-0.5 h-full p-1.5 overflow-hidden">
        <span className="text-xs font-semibold truncate">{activity.name}</span>
        {activity.teacher?.last_name && (
          <span className="text-[10px] text-base-content/60 truncate">
            {activity.teacher.last_name}
          </span>
        )}
        <span className="text-[10px] text-base-content/60">
          {enrollmentCount} student{enrollmentCount !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] text-base-content/50">
          {formatTime(activity.default_start_time)}&ndash;{formatTime(activity.default_end_time)}
        </span>
      </div>
    </div>
  )
}
