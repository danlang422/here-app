import { useState, useMemo } from 'react'
import { ArrowUDownLeft } from '@phosphor-icons/react'
import { buildTeacherRenderables, buildOthersRenderables, formatTimeRange, formatTime } from './agendaUtils'
import SidebarPopover from './SidebarPopover'

const ROLE_BADGE = {
  teacher: { label: 'Teacher', className: 'bg-primary/15 text-primary' },
  monitor: { label: 'Monitor', className: 'bg-secondary/15 text-secondary' },
  prep:    { label: 'Prep',    className: 'bg-base-200 text-base-content/50' },
}

function RoleBadge({ role }) {
  if (!role) return null
  const cfg = ROLE_BADGE[role] ?? ROLE_BADGE.teacher
  return (
    <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide shrink-0 ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function LateArrivalChip({ count, earliestTime }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-warning/15 text-warning shrink-0">
      <ArrowUDownLeft size={9} />
      <span>{count} arr {formatTime(earliestTime)}</span>
    </span>
  )
}

function SidebarItem({ item, isMine, onClick }) {
  const title = item.isCluster ? item.clusterTitle : item.activity.name
  const timeRange = formatTimeRange(item.default_start_time, item.default_end_time)

  return (
    <div
      className="bg-base-200/50 border border-base-300 rounded-lg px-2.5 py-1.5 cursor-pointer hover:bg-base-200 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {isMine && (
          <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-primary/15 text-primary shrink-0">
            Yours
          </span>
        )}
        <span className="text-sm font-medium leading-tight truncate min-w-0">{title}</span>
        <LateArrivalChip count={item.lateCount} earliestTime={item.earliestArrival} />
      </div>
      {timeRange && (
        <div className="mt-0.5">
          <span className="text-xs text-base-content/50">{timeRange}</span>
        </div>
      )}
    </div>
  )
}

function AgendaSidebar({
  yours,
  others,
  enrollmentCounts,
  lateArrivals,
  teacherId,
  date,
  orgId,
  blockLabels,
  actionSummary,
  schoolDay,
  onOpenRoster,
}) {
  const [sidebarPopover, setSidebarPopover] = useState(null)

  const yoursRenderables = useMemo(
    () => buildTeacherRenderables(yours, enrollmentCounts, teacherId, lateArrivals),
    [yours, enrollmentCounts, teacherId, lateArrivals]
  )

  const othersRenderables = useMemo(
    () => buildOthersRenderables(others, enrollmentCounts, lateArrivals),
    [others, enrollmentCounts, lateArrivals]
  )

  function handleItemClick(item, e) {
    if (item.isCluster) {
      setSidebarPopover({ renderable: item, anchorRect: e.currentTarget.getBoundingClientRect() })
    } else {
      onOpenRoster(item.activity)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Visible-to-all sections capped at 50vh so the activity widget below stays visible */}
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[50vh]">
        {yoursRenderables.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wide px-1 mb-1.5">
              Visible to all · yours
            </div>
            <div className="flex flex-col gap-1">
              {yoursRenderables.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isMine={true}
                  blockLabels={blockLabels}
                  onClick={(e) => handleItemClick(item, e)}
                />
              ))}
            </div>
          </div>
        )}

        {othersRenderables.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wide px-1 mb-1.5">
              Visible to all · others'
            </div>
            <div className="flex flex-col gap-1">
              {othersRenderables.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isMine={false}
                  blockLabels={blockLabels}
                  onClick={(e) => handleItemClick(item, e)}
                />
              ))}
            </div>
          </div>
        )}

        {yoursRenderables.length === 0 && othersRenderables.length === 0 && (
          <p className="text-xs text-base-content/30 text-center py-4">
            No school-wide activities today.
          </p>
        )}
      </div>

      {sidebarPopover && (
        <SidebarPopover
          renderable={sidebarPopover.renderable}
          anchorRect={sidebarPopover.anchorRect}
          blockLabels={blockLabels}
          lateArrivals={lateArrivals}
          date={date}
          orgId={orgId}
          teacherId={teacherId}
          enrollmentCounts={enrollmentCounts}
          actionSummary={actionSummary}
          schoolDay={schoolDay}
          onMemberClick={(activity) => {
            setSidebarPopover(null)
            onOpenRoster(activity)
          }}
          onClose={() => setSidebarPopover(null)}
        />
      )}
    </div>
  )
}

export default AgendaSidebar
