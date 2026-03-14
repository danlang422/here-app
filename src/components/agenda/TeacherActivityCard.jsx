import { FaLayerGroup } from 'react-icons/fa6'
import { PiHandWaving } from 'react-icons/pi'
import { getBlockLabel } from '@/lib/constants'

function TeacherActivityCard({ item, blockLabels, waveCount = 0, onClick }) {
  if (item.isAggregate) {
    return (
      <AggregateCard
        item={item}
        blockLabels={blockLabels}
        waveCount={waveCount}
        onClick={onClick}
      />
    )
  }

  return (
    <SingleCard
      item={item}
      blockLabels={blockLabels}
      waveCount={waveCount}
      onClick={onClick}
    />
  )
}

function SingleCard({ item, blockLabels, waveCount, onClick }) {
  const timeRange = formatTimeRange(
    item.default_start_time,
    item.default_end_time
  )
  const blockLabel =
    item.block != null ? getBlockLabel(item.block, blockLabels) : null
  const metaParts = [timeRange, blockLabel, item.location].filter(Boolean)
  const metaLine = metaParts.join(' \u00b7 ')

  const count = item.enrollmentCount ?? 0

  return (
    <div
      className="bg-base-100 border border-base-300 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow h-full"
      onClick={onClick}
    >
      <div className="p-3 flex flex-col gap-0.5">
        <div className="font-medium truncate">{item.name}</div>
        <div className="text-sm text-base-content/60 truncate">
          {metaLine && <>{metaLine} &middot; </>}
          <span>{count}</span>
          {waveCount > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-0.5">
              <PiHandWaving size={14} className="inline" />
              <span>{waveCount}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function AggregateCard({ item, blockLabels, waveCount, onClick }) {
  const timeRange = formatTimeRange(
    item.default_start_time,
    item.default_end_time
  )
  const blockLabel =
    item.block != null ? getBlockLabel(item.block, blockLabels) : 'Unassigned'

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
        <div className="text-sm text-base-content/60 truncate">
          {timeRange && <>{timeRange} &middot; </>}
          <span>{item.activityCount} activities</span>
          <span> &middot; {item.totalEnrollment}</span>
          {waveCount > 0 && (
            <span className="ml-1.5 inline-flex items-center gap-0.5">
              <PiHandWaving size={14} className="inline" />
              <span>{waveCount}</span>
            </span>
          )}
        </div>
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
