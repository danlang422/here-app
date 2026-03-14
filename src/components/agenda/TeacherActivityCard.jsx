import { FaLayerGroup } from 'react-icons/fa6'
import { getBlockLabel } from '@/lib/constants'

function TeacherActivityCard({ item, blockLabels, onClick }) {
  if (item.isAggregate) {
    return (
      <AggregateCard
        item={item}
        blockLabels={blockLabels}
        onClick={onClick}
      />
    )
  }

  return <SingleCard item={item} blockLabels={blockLabels} onClick={onClick} />
}

function SingleCard({ item, blockLabels, onClick }) {
  const timeRange = formatTimeRange(
    item.default_start_time,
    item.default_end_time
  )
  const blockLabel =
    item.block != null ? getBlockLabel(item.block, blockLabels) : null
  const metaParts = [timeRange, blockLabel, item.location].filter(Boolean)
  const metaLine = metaParts.join(' \u00b7 ')

  const count = item.enrollmentCount ?? 0
  const countLabel = `${count} student${count !== 1 ? 's' : ''}`

  return (
    <div
      className="bg-base-100 border border-base-300 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow h-full"
      onClick={onClick}
    >
      <div className="p-3 flex flex-col gap-0.5">
        <div className="font-medium truncate">{item.name}</div>
        {metaLine && (
          <div className="text-sm text-base-content/60 truncate">
            {metaLine}
          </div>
        )}
        <div className="text-sm text-base-content/50">{countLabel}</div>
      </div>
    </div>
  )
}

function AggregateCard({ item, blockLabels, onClick }) {
  const timeRange = formatTimeRange(
    item.default_start_time,
    item.default_end_time
  )
  const blockLabel =
    item.block != null ? getBlockLabel(item.block, blockLabels) : 'Unassigned'

  const countLabel = `${item.activityCount} activities \u00b7 ${item.totalEnrollment} students`

  return (
    <div
      className="bg-base-200 border border-base-300 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow h-full"
      onClick={onClick}
    >
      <div className="p-3 flex flex-col gap-0.5">
        <div className="font-medium flex items-center gap-1.5">
          <FaLayerGroup size={14} />
          <span className="truncate">{blockLabel}</span>
        </div>
        {timeRange && (
          <div className="text-sm text-base-content/60">{timeRange}</div>
        )}
        <div className="text-sm text-base-content/50">{countLabel}</div>
      </div>
    </div>
  )
}

function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return null
  return `${formatTime(startTime)} \u2013 ${formatTime(endTime)}`
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'p' : 'a'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0
    ? `${hour12}${suffix}`
    : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

export default TeacherActivityCard
