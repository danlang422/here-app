import { useState } from 'react'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import RollupStudentRow from './RollupStudentRow'

function formatBlockTime(scheduleTemplate, block) {
  const def = scheduleTemplate?.block_definitions?.[block]
  if (!def?.start_time || !def?.end_time) return null
  return `${def.start_time} – ${def.end_time}`
}

function RollupBlockSection({ block, blockLabel, rows, viewMode, scheduleTemplate }) {
  const exceptionRows = rows.filter(
    (r) => r.requiresAttendance && r.attendanceRecord?.status !== 'present'
  )
  const requiresAttendanceRows = rows.filter((r) => r.requiresAttendance)
  const markedCount = requiresAttendanceRows.filter((r) => r.attendanceRecord).length

  const hasExceptions = exceptionRows.length > 0
  const defaultOpen = viewMode === 'full' || hasExceptions
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const visibleRows = viewMode === 'full' ? rows : exceptionRows

  const headerBadge =
    viewMode === 'exceptions' ? (
      hasExceptions ? (
        <span className="badge badge-error badge-sm">
          {exceptionRows.length} exception{exceptionRows.length !== 1 ? 's' : ''}
        </span>
      ) : (
        <span className="text-success text-sm font-medium">✓ All present</span>
      )
    ) : (
      <span className="badge badge-ghost badge-sm">
        {markedCount}/{requiresAttendanceRows.length} marked
      </span>
    )

  const blockTime = formatBlockTime(scheduleTemplate, block)

  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-base-200/50 hover:bg-base-200 transition-colors text-left"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
      >
        {isOpen ? <CaretDown size={14} /> : <CaretRight size={14} />}
        <span className="font-semibold text-sm">{blockLabel}</span>
        {blockTime && (
          <span className="text-base-content/50 text-xs">{blockTime}</span>
        )}
        <span className="ml-auto">{headerBadge}</span>
      </button>

      {isOpen && visibleRows.length > 0 && (
        <div className="divide-y divide-base-200 px-1 py-1">
          {visibleRows.map((row, i) => (
            <RollupStudentRow key={`${row.student.id}-${row.activity.id}-${i}`} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

export default RollupBlockSection
