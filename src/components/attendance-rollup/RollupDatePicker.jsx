import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { addDays, subDays } from '@/lib/scheduleUtils'

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function RollupDatePicker({ date, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        className="btn btn-ghost btn-sm btn-square"
        onClick={() => onChange(subDays(date, 1))}
        aria-label="Previous day"
      >
        <CaretLeft size={16} />
      </button>
      <span className="text-sm font-medium min-w-[180px] text-center">
        {formatDisplayDate(date)}
      </span>
      <button
        className="btn btn-ghost btn-sm btn-square"
        onClick={() => onChange(addDays(date, 1))}
        aria-label="Next day"
      >
        <CaretRight size={16} />
      </button>
    </div>
  )
}

export default RollupDatePicker
