import useUIStore from '@/store/uiStore'
import { addDays, subDays } from '@/lib/scheduleUtils'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day // Mon = day 1
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatNavRange(mon, fri) {
  const monMonth = MONTH_ABBR[mon.getMonth()]
  const friMonth = MONTH_ABBR[fri.getMonth()]
  const monDay = mon.getDate()
  const friDay = fri.getDate()
  const year = fri.getFullYear()

  if (monMonth === friMonth) {
    return `${monMonth} ${monDay} \u2013 ${friDay}, ${year}`
  }
  return `${monMonth} ${monDay} \u2013 ${friMonth} ${friDay}, ${year}`
}

export function CalendarWeekNav() {
  const selectedDate = useUIStore((s) => s.selectedDate)
  const setSelectedDate = useUIStore((s) => s.setSelectedDate)

  const anchor = selectedDate ?? new Date()
  const weekStart = getWeekStart(anchor)
  const weekFriday = addDays(weekStart, 4)

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-base-200">
      <button
        className="btn btn-ghost btn-square"
        onClick={() => setSelectedDate(subDays(anchor, 7))}
        title="Previous week"
      >
        &#8249;
      </button>
      <span className="font-semibold text-sm flex-1 text-center">
        {formatNavRange(weekStart, weekFriday)}
      </span>
      <button
        className="btn btn-ghost btn-square"
        onClick={() => setSelectedDate(addDays(anchor, 7))}
        title="Next week"
      >
        &#8250;
      </button>
      <button className="btn btn-ghost" onClick={() => setSelectedDate(new Date())}>
        Today
      </button>
    </div>
  )
}

export { getWeekStart }
