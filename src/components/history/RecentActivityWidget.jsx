import { Link } from 'react-router-dom'
import { ClockCounterClockwise, HandWaving, CheckCircle, NotePencil } from '@phosphor-icons/react'
import { useRecentStudentActivity, useRecentTeacherActivity } from '@/hooks/useHistory'
import { formatDateISO } from '@/lib/scheduleUtils'
import { getDevToday } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production

function formatActionTime(timestamp, instanceDate) {
  const today = formatDateISO(getDevToday())
  const d = new Date(instanceDate + 'T12:00:00')
  const yesterday = new Date(getDevToday())
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDateISO(yesterday)

  if (instanceDate === today) {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  if (instanceDate === yesterdayStr) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SectionHeader({ children }) {
  return (
    <div className="text-[10px] font-semibold text-base-content/40 uppercase tracking-wide px-0.5 mb-1.5">
      {children}
    </div>
  )
}

function StudentRow({ entry }) {
  const today = formatDateISO(getDevToday())
  const isToday = entry.date === today
  const dateLabel = isToday
    ? null
    : new Date(entry.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="flex items-center gap-1.5 py-1">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: entry.calendarColor ?? 'currentColor' }}
      />
      <span className="flex-1 min-w-0 text-xs truncate">{entry.activityName}</span>
      <div className="flex items-center gap-0.5 shrink-0">
        {entry.wave && <HandWaving size={11} weight="fill" className="text-info" />}
        {entry.checkIn && <CheckCircle size={11} weight="fill" className="text-success" />}
        {entry.statusUpdates.length > 0 && <NotePencil size={11} weight="fill" className="text-primary" />}
      </div>
      {dateLabel && (
        <span className="text-[10px] text-base-content/40 shrink-0">{dateLabel}</span>
      )}
    </div>
  )
}

function TeacherRow({ action }) {
  const ActionIcon =
    action.type === 'wave' ? HandWaving
    : action.type === 'checkin' ? CheckCircle
    : NotePencil
  const iconClass =
    action.type === 'wave' ? 'text-info'
    : action.type === 'checkin' ? 'text-success'
    : 'text-primary'

  return (
    <div className="flex items-center gap-1.5 py-1">
      <ActionIcon size={11} weight="fill" className={`${iconClass} shrink-0`} />
      <span className="text-xs font-medium shrink-0 max-w-[72px] truncate">{action.studentName}</span>
      <span className="text-xs text-base-content/50 flex-1 min-w-0 truncate">{action.activityName}</span>
      <span className="text-[10px] text-base-content/40 shrink-0">
        {formatActionTime(action.timestamp, action.instanceDate)}
      </span>
    </div>
  )
}

function StudentWidget({ studentId }) {
  const { entries, isLoading } = useRecentStudentActivity({ studentId })

  return (
    <div>
      <SectionHeader>Recent Activity</SectionHeader>

      {isLoading && (
        <div className="flex justify-center py-3">
          <span className="loading loading-spinner loading-xs" />
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <p className="text-xs text-base-content/30 text-center py-3">No recent activity.</p>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="divide-y divide-base-200">
          {entries.map((entry) => (
            <StudentRow key={`${entry.instanceId}:${entry.studentId}`} entry={entry} />
          ))}
        </div>
      )}

      <Link
        to="/history"
        className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
      >
        <ClockCounterClockwise size={12} />
        View full history
      </Link>
    </div>
  )
}

function TeacherWidget({ teacherId }) {
  const { actions, isLoading } = useRecentTeacherActivity({ teacherId })

  return (
    <div>
      <SectionHeader>Recent Student Activity</SectionHeader>

      {isLoading && (
        <div className="flex justify-center py-3">
          <span className="loading loading-spinner loading-xs" />
        </div>
      )}

      {!isLoading && actions.length === 0 && (
        <p className="text-xs text-base-content/30 text-center py-3">No recent activity.</p>
      )}

      {!isLoading && actions.length > 0 && (
        <div className="divide-y divide-base-200">
          {actions.map((action, i) => (
            <TeacherRow key={i} action={action} />
          ))}
        </div>
      )}

      <Link
        to="/history"
        className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
      >
        <ClockCounterClockwise size={12} />
        View all
      </Link>
    </div>
  )
}

// Pass either studentId (student variant) or teacherId (teacher variant).
function RecentActivityWidget({ studentId, teacherId }) {
  if (teacherId) return <TeacherWidget teacherId={teacherId} />
  return <StudentWidget studentId={studentId} />
}

export default RecentActivityWidget
