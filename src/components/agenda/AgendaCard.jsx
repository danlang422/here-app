import { getBlockLabel } from '@/lib/constants'
import useUIStore from '@/store/uiStore'

function SingleCard({ activity, enrollmentCount }) {
  const startTime = formatTime(activity.default_start_time)
  const endTime = formatTime(activity.default_end_time)
  const teacherName = activity.teacher?.last_name ?? ''

  return (
    <div className="flex flex-col gap-0.5 overflow-hidden h-full p-1.5">
      <span className="text-xs font-semibold truncate">{activity.name}</span>
      {teacherName && (
        <span className="text-[10px] text-base-content/60 truncate">{teacherName}</span>
      )}
      <span className="text-[10px] text-base-content/60">
        {enrollmentCount} student{enrollmentCount !== 1 ? 's' : ''}
      </span>
      <span className="text-[10px] text-base-content/50">{startTime}–{endTime}</span>
      {activity.block != null && (
        <span className="badge badge-xs badge-ghost mt-auto text-[9px]">
          {getBlockLabel(activity.block)}
        </span>
      )}
    </div>
  )
}

function FewCard({ activity, enrollmentCount }) {
  return (
    <div className="flex flex-col gap-0.5 overflow-hidden h-full p-1.5">
      <span className="text-xs font-semibold truncate">{activity.name}</span>
      <span className="text-[10px] text-base-content/60">
        {enrollmentCount} student{enrollmentCount !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

function AggregateCard({ activities, totalEnrollment, block, dayValue }) {
  const setAgendaFocusedBlock = useUIStore((s) => s.setAgendaFocusedBlock)
  const setAgendaFocusedDay = useUIStore((s) => s.setAgendaFocusedDay)

  const tooltipContent = activities
    .map((a) => {
      const teacher = a.teacher?.last_name ?? ''
      return teacher ? `${a.name} — ${teacher}` : a.name
    })
    .join('\n')

  const handleClick = (e) => {
    e.stopPropagation()
    setAgendaFocusedBlock(block === 'null' ? null : block)
    setAgendaFocusedDay(dayValue)
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full p-1.5 tooltip tooltip-bottom cursor-pointer"
      data-tip={tooltipContent}
      onClick={handleClick}
    >
      <span className="text-xs font-semibold">{activities.length} Activities</span>
      <span className="text-[10px] text-base-content/60">
        {totalEnrollment} Student{totalEnrollment !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

function AgendaCard({ density, activity, activities, enrollmentCount, totalEnrollment, block, dayValue }) {
  if (density === 'aggregate') {
    return (
      <AggregateCard
        activities={activities}
        totalEnrollment={totalEnrollment}
        block={block}
        dayValue={dayValue}
      />
    )
  }

  if (density === 'few') {
    return <FewCard activity={activity} enrollmentCount={enrollmentCount} />
  }

  return <SingleCard activity={activity} enrollmentCount={enrollmentCount} />
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'p' : 'a'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}

export default AgendaCard
