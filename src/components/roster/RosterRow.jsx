import { HandWaving, CheckCircle, SignOut, Prohibit, NotePencil } from '@phosphor-icons/react'
import { formatTimestamp, STATUS_OPTIONS } from './rosterUtils'

export function StudentRow({
  student,
  isAggregate,
  currentStatus,
  onToggle,
  actionData,
  onClick,
  isEven,
  timeAnnotation = null,
}) {
  const displayName = student.preferredName
    ? `${student.preferredName} ${student.lastName}`
    : `${student.firstName} ${student.lastName}`

  return (
    <div
      className={`flex items-center gap-2 py-2.5 px-2 rounded-lg cursor-pointer hover:bg-base-200/50 transition-colors ${
        isEven ? 'bg-base-200/30' : ''
      }`}
      onClick={onClick}
    >
      <div className="min-w-30 max-w-45 truncate font-medium">{displayName}</div>

      {isAggregate && (
        <div className="min-w-20 max-w-35 text-sm text-base-content/50 italic truncate">
          {student.activityName}
        </div>
      )}

      {timeAnnotation && (
        <span className="text-[11px] text-warning shrink-0">{timeAnnotation}</span>
      )}

      <div className="flex-1 flex items-center gap-1.5 justify-end">
        {actionData.wave && (
          <span className="text-success" title={`Waved at ${formatTimestamp(actionData.wave.waved_at)}`}>
            <HandWaving size={16} />
          </span>
        )}
        {actionData.checkIn && <CheckInIcon checkIn={actionData.checkIn} />}
        {actionData.checkIn?.geofence_validated === false && (
          <span className="text-error" title="Location check failed">
            <Prohibit size={16} />
          </span>
        )}
        {actionData.statusCount > 0 && (
          <span className="flex items-center gap-0.5 text-base-content/50" title={`${actionData.statusCount} status update(s)`}>
            <NotePencil size={14} />
            <span className="text-xs">({actionData.statusCount})</span>
          </span>
        )}
      </div>

      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        {!student.scheduledToday ? (
          <span className="text-xs text-base-content/30 shrink-0 italic">Not today</span>
        ) : student.requiresAttendance ? (
          <div className="flex items-center">
            {STATUS_OPTIONS.map(({ key, label, fullLabel, btnClass }) => (
              <button
                key={key}
                className={`btn btn-sm rounded-none first:rounded-l last:rounded-r ${
                  currentStatus === key ? btnClass : 'btn-ghost'
                }`}
                title={fullLabel}
                onClick={() => onToggle(student.studentId, key)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-base-content/40 shrink-0">No attendance</span>
        )}
      </div>
    </div>
  )
}

function CheckInIcon({ checkIn }) {
  if (checkIn.checked_out_at) {
    return (
      <span
        className="text-success"
        title={`Checked in ${formatTimestamp(checkIn.checked_in_at)}, out ${formatTimestamp(checkIn.checked_out_at)}`}
      >
        <SignOut size={16} />
      </span>
    )
  }
  return (
    <span className="text-success" title={`Checked in at ${formatTimestamp(checkIn.checked_in_at)}`}>
      <CheckCircle weight="fill" size={16} />
    </span>
  )
}
