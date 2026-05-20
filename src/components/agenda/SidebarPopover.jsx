import { useState, useEffect, useRef } from 'react'
import { X, ArrowUDownLeft } from '@phosphor-icons/react'
import { formatTimeRange, formatTime } from './agendaUtils'
import { getBlockLabel } from '@/lib/constants'
import BlockRosterModal from '@/components/roster/BlockRosterModal'

const POPOVER_WIDTH = 560
const POPOVER_GAP = 8

function SidebarPopover({
  renderable,
  anchorRect,
  blockLabels,
  lateArrivals,
  date,
  orgId,
  teacherId,
  enrollmentCounts,
  actionSummary,
  schoolDay,
  onMemberClick,
  onClose,
}) {
  const ref = useRef(null)
  const [groupRosterOpen, setGroupRosterOpen] = useState(false)

  useEffect(() => {
    function handleMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const popoverHeight = 200
  const fitsAbove = anchorRect.top - POPOVER_GAP - popoverHeight > 0
  const top = fitsAbove
    ? anchorRect.top - POPOVER_GAP
    : anchorRect.bottom + POPOVER_GAP

  const viewportWidth = window.innerWidth
  let left = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2
  left = Math.max(8, Math.min(left, viewportWidth - POPOVER_WIDTH - 8))

  const blockLabelsUnion = renderable.block?.length
    ? renderable.block.map((b) => getBlockLabel(b, blockLabels)).join(', ')
    : null

  const timeRange = formatTimeRange(renderable.default_start_time, renderable.default_end_time)

  return (
    <>
      <div
        ref={ref}
        className="fixed z-50 bg-base-100 border border-base-300 rounded-2xl shadow-xl overflow-hidden"
        style={{
          width: POPOVER_WIDTH,
          left,
          top,
          transform: fitsAbove ? 'translateY(-100%)' : 'none',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-base-200">
          <div>
            <div className="font-semibold">{renderable.clusterTitle}</div>
            <div className="text-sm text-base-content/50 flex items-center gap-1.5 mt-0.5">
              <span>{timeRange}</span>
              {blockLabelsUnion && <><span>·</span><span>{blockLabelsUnion}</span></>}
            </div>
          </div>
          <button className="btn btn-ghost btn-xs btn-circle ml-2" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Member cards */}
        <div
          className="p-3 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${renderable.memberCount}, 1fr)` }}
        >
          {renderable.activities.map((activity) => {
            const late = lateArrivals?.get(activity.id)
            return (
              <MemberCard
                key={activity.id}
                activity={activity}
                blockLabels={blockLabels}
                lateCount={late?.count ?? 0}
                earliestArrival={late?.earliestTime ?? null}
                onClick={() => {
                  onClose()
                  onMemberClick(activity)
                }}
              />
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-base-200 flex items-center justify-between">
          <span className="text-xs text-base-content/40">
            {renderable.totalEnrollment} student{renderable.totalEnrollment !== 1 ? 's' : ''}
          </span>
          <button
            className="btn btn-xs btn-outline"
            onClick={() => setGroupRosterOpen(true)}
          >
            Take attendance for all
          </button>
        </div>
      </div>

      {groupRosterOpen && (
        <BlockRosterModal
          groupTitle={renderable.clusterTitle}
          groupTimeRange={timeRange}
          activities={renderable.activities}
          date={date}
          orgId={orgId}
          teacherId={teacherId}
          blockLabels={blockLabels}
          actionSummary={actionSummary}
          schoolDay={schoolDay}
          enrollmentCounts={enrollmentCounts}
          onClose={() => {
            setGroupRosterOpen(false)
            onClose()
          }}
        />
      )}
    </>
  )
}

function MemberCard({ activity, blockLabels, lateCount, earliestArrival, onClick }) {
  const timeRange = formatTimeRange(activity.default_start_time, activity.default_end_time)
  const blockLabel = activity.block?.length
    ? activity.block.map((b) => getBlockLabel(b, blockLabels)).join(', ')
    : null

  return (
    <div
      className="min-w-0 overflow-hidden bg-base-200/50 border border-base-300 rounded-xl p-2.5 cursor-pointer hover:bg-base-200 transition-colors"
      onClick={onClick}
    >
      <div className="font-medium text-sm leading-tight truncate">{activity.name}</div>
      <div className="text-xs text-base-content/50 mt-0.5">{timeRange}</div>
      {blockLabel && <div className="text-xs text-base-content/40 mt-0.5">{blockLabel}</div>}
      {lateCount > 0 && (
        <div className="flex items-center gap-0.5 mt-1 text-[10px] font-medium text-warning">
          <ArrowUDownLeft size={10} />
          <span>{lateCount} arr {formatTime(earliestArrival)}</span>
        </div>
      )}
    </div>
  )
}

export default SidebarPopover
