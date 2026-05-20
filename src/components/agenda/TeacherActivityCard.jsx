import { Stack, CheckCircle, HandWaving } from '@phosphor-icons/react'
import { formatTimeRange } from './agendaUtils'
import { getBlockLabel } from '@/lib/constants'

const ROLE_BADGE = {
  teacher: { label: 'Teacher', className: 'bg-primary/15 text-primary' },
  monitor: { label: 'Monitor', className: 'bg-secondary/15 text-secondary' },
  prep:    { label: 'Prep',    className: 'bg-base-200 text-base-content/50' },
}

function RoleBadge({ role }) {
  const cfg = ROLE_BADGE[role] ?? ROLE_BADGE.teacher
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide shrink-0 ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function BlockBadges({ block, blockLabels }) {
  if (!block?.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {block.map((b) => (
        <span key={b} className="text-[10px] text-base-content/40 bg-base-200 rounded px-1 py-0.5">
          {getBlockLabel(b, blockLabels)}
        </span>
      ))}
    </div>
  )
}

function TeacherActivityCard({ item, blockLabels, waveCount = 0, hasAttendanceRecords = false, onClick }) {
  if (item.isCluster) {
    return (
      <ClusterCard
        item={item}
        blockLabels={blockLabels}
        waveCount={waveCount}
        hasAttendanceRecords={hasAttendanceRecords}
        onClick={onClick}
      />
    )
  }
  return (
    <SoloCard
      item={item}
      blockLabels={blockLabels}
      waveCount={waveCount}
      hasAttendanceRecords={hasAttendanceRecords}
      onClick={onClick}
    />
  )
}

function SoloCard({ item, blockLabels, waveCount, hasAttendanceRecords, onClick }) {
  const { activity, role, enrollmentCount } = item
  const isPrepLike = role === 'prep'
  const calendarColor = activity.calendar?.color

  return (
    <div
      className={`border rounded-2xl shadow-sm h-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] overflow-hidden ${
        isPrepLike ? 'bg-base-200/60 border-base-300' : 'bg-base-100 border-base-300 border-l-4'
      }`}
      style={!isPrepLike && calendarColor ? { borderLeftColor: calendarColor } : undefined}
      onClick={onClick}
    >
      <div className="p-2.5 flex flex-col gap-1 h-full">
        <div className="flex items-center justify-between gap-1">
          <RoleBadge role={role} />
          <span className="text-[11px] text-base-content/50 shrink-0 tabular-nums">
            {formatTimeRange(activity.default_start_time, activity.default_end_time)}
          </span>
        </div>

        <div className="font-medium text-sm leading-tight truncate">{activity.name}</div>

        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          <BlockBadges block={activity.block} blockLabels={blockLabels} />
          {hasAttendanceRecords && (
            <CheckCircle size={13} weight="fill" className="text-success/60 shrink-0" />
          )}
          {waveCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-base-content/40 shrink-0">
              <HandWaving size={13} />
              <span className="text-[11px]">{waveCount}</span>
            </span>
          )}
          {!isPrepLike && (
            <span className="text-[11px] text-base-content/40 shrink-0 ml-auto">{enrollmentCount}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ClusterCard({ item, blockLabels, waveCount, hasAttendanceRecords, onClick }) {
  return (
    <div
      className="bg-base-100 border border-base-300 rounded-2xl shadow-sm h-full cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      onClick={onClick}
    >
      <div className="p-2.5 flex flex-col gap-1 h-full">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <RoleBadge role={item.role} />
            <Stack size={12} className="text-base-content/40 shrink-0" />
          </div>
          <span className="text-[11px] text-base-content/50 shrink-0 tabular-nums">
            {formatTimeRange(item.default_start_time, item.default_end_time)}
          </span>
        </div>

        <div className="font-medium text-sm leading-tight truncate">{item.clusterTitle}</div>

        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
          <BlockBadges block={item.block} blockLabels={blockLabels} />
          {hasAttendanceRecords && (
            <CheckCircle size={13} weight="fill" className="text-success/60 shrink-0" />
          )}
          {waveCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-base-content/40 shrink-0">
              <HandWaving size={13} />
              <span className="text-[11px]">{waveCount}</span>
            </span>
          )}
          <span className="text-[11px] text-base-content/40 shrink-0 ml-auto">{item.totalEnrollment}</span>
        </div>
      </div>
    </div>
  )
}

export default TeacherActivityCard
