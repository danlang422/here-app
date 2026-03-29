import { useState, useEffect, useRef } from 'react'
import { OVERRIDE_REASON_LABELS } from '@/lib/constants'

const REASONS = [
  { value: 'planned_holiday', label: 'Planned holiday' },
  { value: 'weather', label: 'Weather' },
  { value: 'emergency', label: 'Emergency' },
]

function formatDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function DayPopover({
  date,
  anchorRect,
  schoolDay,
  onMarkDayOff,
  onRestoreSchoolDay,
  onMarkRange,
  onClose,
}) {
  const [mode, setMode] = useState('single') // 'single' | 'range'
  const [reason, setReason] = useState('planned_holiday')
  const [notes, setNotes] = useState('')
  const [endDate, setEndDate] = useState(date)
  const [saving, setSaving] = useState(false)
  const popoverRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Reset form when date changes
  useEffect(() => {
    setMode('single')
    setReason(schoolDay?.override_reason || 'planned_holiday')
    setNotes(schoolDay?.notes || '')
    setEndDate(date)
    setSaving(false)
  }, [date, schoolDay])

  const isSchoolDay = schoolDay?.is_school_day === true
  const isException = schoolDay && !schoolDay.is_school_day
  const isOutside = !schoolDay

  async function handleSaveSingle() {
    setSaving(true)
    try {
      await onMarkDayOff(date, reason, notes)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveRange() {
    if (endDate < date) return
    setSaving(true)
    try {
      await onMarkRange(date, endDate, reason, notes)
    } finally {
      setSaving(false)
    }
  }

  async function handleRestore() {
    setSaving(true)
    try {
      await onRestoreSchoolDay(date)
    } finally {
      setSaving(false)
    }
  }

  // Position the popover relative to the anchor
  const style = {}
  if (anchorRect) {
    // Position below and centered on the clicked cell
    style.position = 'fixed'
    style.top = anchorRect.bottom + 4
    style.left = Math.max(8, anchorRect.left + anchorRect.width / 2 - 150)
    style.zIndex = 50

    // Prevent overflow off right edge
    if (typeof window !== 'undefined' && style.left + 300 > window.innerWidth) {
      style.left = window.innerWidth - 308
    }
    // If it would go below viewport, position above instead
    if (typeof window !== 'undefined' && style.top + 300 > window.innerHeight) {
      style.top = anchorRect.top - 4
      style.transform = 'translateY(-100%)'
    }
  }

  return (
    <div
      ref={popoverRef}
      className="card bg-base-100 shadow-xl border border-base-300 w-[300px]"
      style={style}
    >
      <div className="card-body p-3 space-y-2">
        {/* Date header */}
        <div className="text-sm font-medium">{formatDateDisplay(date)}</div>

        {/* Current status */}
        <div className="text-xs text-base-content/60">
          {isSchoolDay && 'School day'}
          {isException && (
            <>
              {OVERRIDE_REASON_LABELS[schoolDay.override_reason] || 'Day off'}
              {schoolDay.notes && <span className="italic ml-1">— {schoolDay.notes}</span>}
            </>
          )}
          {isOutside && 'Outside term range'}
        </div>

        {/* Exception day — show restore and change options */}
        {isException && (
          <div className="space-y-2">
            <button
              className="btn btn-ghost btn-xs w-full justify-start"
              onClick={handleRestore}
              disabled={saving}
            >
              Restore school day
            </button>

            <div className="divider my-0 text-xs text-base-content/40">Change reason</div>
            <ReasonAndNotesForm
              reason={reason}
              setReason={setReason}
              notes={notes}
              setNotes={setNotes}
            />
            <div className="flex justify-end gap-1">
              <button className="btn btn-ghost btn-xs" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-xs" onClick={handleSaveSingle} disabled={saving}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* School day or outside — show mark off options */}
        {(isSchoolDay || isOutside) && (
          <div className="space-y-2">
            {/* Mode toggle */}
            <div className="tabs tabs-boxed tabs-xs">
              <button
                className={`tab tab-xs ${mode === 'single' ? 'tab-active' : ''}`}
                onClick={() => setMode('single')}
              >
                This day
              </button>
              <button
                className={`tab tab-xs ${mode === 'range' ? 'tab-active' : ''}`}
                onClick={() => setMode('range')}
              >
                Date range
              </button>
            </div>

            {mode === 'range' && (
              <div>
                <label className="label-text text-xs text-base-content/50 mb-1 block">End date</label>
                <input
                  type="date"
                  className="input input-bordered input-xs w-full"
                  value={endDate}
                  min={date}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}

            <ReasonAndNotesForm
              reason={reason}
              setReason={setReason}
              notes={notes}
              setNotes={setNotes}
            />

            <div className="flex justify-end gap-1">
              <button className="btn btn-ghost btn-xs" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary btn-xs"
                onClick={mode === 'single' ? handleSaveSingle : handleSaveRange}
                disabled={saving}
              >
                {saving ? <span className="loading loading-spinner loading-xs" /> : (
                  mode === 'single' ? 'Mark day off' : 'Mark range'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ReasonAndNotesForm({ reason, setReason, notes, setNotes }) {
  return (
    <>
      <div>
        <label className="label-text text-xs text-base-content/50 mb-1 block">Reason</label>
        <select
          className="select select-bordered select-xs w-full"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          {REASONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label-text text-xs text-base-content/50 mb-1 block">Notes (optional)</label>
        <input
          type="text"
          className="input input-bordered input-xs w-full"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder='e.g. "Spring Break"'
        />
      </div>
    </>
  )
}
