import { useState, useMemo } from 'react'

function generateTimeOptions() {
  const options = []
  for (let h = 6; h <= 18; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 18 && m > 0) break
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const suffix = h >= 12 ? 'PM' : 'AM'
      const label = m === 0 ? `${hour12}:00 ${suffix}` : `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
      options.push({ value, label })
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

export function CalendarFilterBar({
  // existing
  filterText,
  onFilterChange,
  // block filter
  blockOptions = [],
  selectedBlock,
  onBlockChange,
  // time range filter
  timeFrom,
  timeTo,
  onTimeFromChange,
  onTimeToChange,
  // student filter
  students = [],
  selectedStudents = [],
  onStudentAdd,
  onStudentRemove,
  hideNonEnrolled,
  onHideNonEnrolledChange,
}) {
  const [studentSearch, setStudentSearch] = useState('')

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return []
    const lower = studentSearch.trim().toLowerCase()
    return students
      .filter((s) => {
        const full = `${s.first_name ?? ''} ${s.last_name ?? ''} ${s.preferred_name ?? ''}`.toLowerCase()
        return full.includes(lower) && !selectedStudents.some((sel) => sel.id === s.id)
      })
      .slice(0, 8)
  }, [studentSearch, students, selectedStudents])

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 border-b border-base-200">

      {/* Text search */}
      <div className="flex items-center gap-1">
        <input
          type="text"
          className="input input-bordered input-sm w-56"
          placeholder="Filter activities..."
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
        />
        {filterText && (
          <button className="btn btn-ghost btn-xs" onClick={() => onFilterChange('')}>
            ✕
          </button>
        )}
      </div>

      {/* Divider */}
      {blockOptions.length > 0 && (
        <div className="border-l border-base-300 self-stretch" />
      )}

      {/* Block filter */}
      {blockOptions.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-base-content/60">Block:</span>
          <select
            className="select select-bordered select-sm"
            value={selectedBlock ?? ''}
            onChange={(e) => onBlockChange(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">All</option>
            {blockOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Divider */}
      <div className="border-l border-base-300 self-stretch" />

      {/* Time range filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-base-content/60">Time:</span>
        <select
          className="select select-bordered select-sm"
          value={timeFrom ?? ''}
          onChange={(e) => onTimeFromChange(e.target.value || null)}
        >
          <option value="">All day</option>
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="text-xs text-base-content/40">to</span>
        <select
          className="select select-bordered select-sm"
          value={timeTo ?? ''}
          onChange={(e) => onTimeToChange(e.target.value || null)}
        >
          <option value="">—</option>
          {TIME_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {(timeFrom || timeTo) && (
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => { onTimeFromChange(null); onTimeToChange(null) }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="border-l border-base-300 self-stretch" />

      {/* Student filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="relative">
          <input
            type="text"
            className="input input-bordered input-sm w-40"
            placeholder="Search students..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
          />
          {filteredStudents.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-base-100 border border-base-300 rounded shadow-lg z-50">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-base-200"
                  onClick={() => {
                    onStudentAdd(s)
                    setStudentSearch('')
                  }}
                >
                  {s.preferred_name ?? s.first_name} {s.last_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected student chips */}
        {selectedStudents.map((s) => (
          <div key={s.id} className="badge badge-neutral gap-1">
            <span className="text-xs">{s.preferred_name ?? s.first_name} {s.last_name}</span>
            <button
              className="text-xs leading-none"
              onClick={() => onStudentRemove(s.id)}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Hide non-enrolled toggle — only visible when students are selected */}
        {selectedStudents.length > 0 && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={hideNonEnrolled}
              onChange={(e) => onHideNonEnrolledChange(e.target.checked)}
            />
            <span className="text-xs text-base-content/60">Hide non-enrolled</span>
          </label>
        )}
      </div>
    </div>
  )
}
