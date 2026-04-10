import { Stack, HandWaving, CheckCircle } from '@phosphor-icons/react'
import { getBlockLabel } from '@/lib/constants'
import { formatTimeRange } from './agendaUtils'

function TeacherActivityCard({ item, blockLabels, waveCount = 0, hasAttendanceRecords = false, onClick }) {
  if (item.isAggregate) {
    return (
      <AggregateCard
        item={item}
        blockLabels={blockLabels}
        waveCount={waveCount}
        hasAttendanceRecords={hasAttendanceRecords}
        onClick={onClick}
      />
    )
  }

  return (
    <SingleCard
      item={item}
      blockLabels={blockLabels}
      waveCount={waveCount}
      hasAttendanceRecords={hasAttendanceRecords}
      onClick={onClick}
    />
  )
}

function SingleCard({ item, blockLabels, waveCount, hasAttendanceRecords, onClick }) {
  const timeRange = formatTimeRange(item.default_start_time, item.default_end_time)
  const blockLabel = item.block != null ? getBlockLabel(item.block, blockLabels) : null
  const metaParts = [timeRange, blockLabel, item.location].filter(Boolean)
  const metaLine = metaParts.join(' \u00b7 ')
  const count = item.enrollmentCount ?? 0
  const calendarColor = item.calendar?.color

  return (
    <div
      className="bg-base-100 border border-base-300 border-l-4 rounded-2xl shadow-sm overflow-visible cursor-pointer h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      style={calendarColor ? { borderLeftColor: calendarColor } : undefined}
      onClick={onClick}
    >
      <div className="p-3 flex flex-col gap-0.5">
        <div className="font-medium truncate">{item.name}</div>
        <div className="text-sm text-base-content/60 truncate">
          {metaLine && <>{metaLine} &middot; </>}
          <span>{count}</span>
          {hasAttendanceRecords && (
            <CheckCircle size={14} weight="fill" className="inline ml-1 text-success/60 align-middle" />
          )}
          {waveCount > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 wave-badge">
              <HandWaving size={14} />
              <span>{waveCount}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function AggregateCard({ item, blockLabels, waveCount, hasAttendanceRecords, onClick }) {
  const timeRange = formatTimeRange(item.default_start_time, item.default_end_time)
  const blockLabel = item.block != null ? getBlockLabel(item.block, blockLabels) : 'Unassigned'

  return (
    <div
      className="bg-base-200 border border-base-300 rounded-2xl shadow-sm overflow-visible cursor-pointer h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      onClick={onClick}
    >
      <div className="p-3 flex flex-col gap-0.5">
        <div className="font-medium flex items-center gap-1.5">
          <Stack size={14} />
          <span className="truncate">{blockLabel}</span>
        </div>
        <div className="text-sm text-base-content/60 truncate">
          {timeRange && <>{timeRange} &middot; </>}
          <span>{item.activityCount} activities</span>
          <span> &middot; {item.totalEnrollment}</span>
          {hasAttendanceRecords && (
            <CheckCircle size={14} weight="fill" className="inline ml-1 text-success/60 align-middle" />
          )}
          {waveCount > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 wave-badge">
              <HandWaving size={14} />
              <span>{waveCount}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default TeacherActivityCard
