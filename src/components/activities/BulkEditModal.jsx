import { useState } from 'react'
import {
  ClipboardText,
  CheckCircle,
  HandWaving,
  ListChecks,
  MapPin,
  DoorOpen,
  CalendarX,
} from '@phosphor-icons/react'
import { getBlocks, getBlockLabel } from '@/lib/constants'
import { useBulkEditActivities } from '@/hooks/useBulkEditActivities'
import { useCalendars } from '@/hooks/useCalendars'

// Mirrors BEHAVIOR_FLAGS in ActivityDetail.jsx
const BEHAVIOR_FLAGS = [
  { field: 'requires_attendance',  icon: ClipboardText, label: 'Requires attendance' },
  { field: 'requires_checkin',     icon: CheckCircle,   label: 'Requires check-in' },
  { field: 'allows_presence_wave', icon: HandWaving,    label: 'Allows presence wave' },
  { field: 'allows_freeform',      icon: ListChecks,    label: 'Allows freeform tagging' },
  { field: 'requires_geofence',    icon: MapPin,        label: 'Requires geofence' },
  { field: 'is_release',           icon: DoorOpen,      label: 'Release (no attendance)' },
  { field: 'is_not_scheduled',     icon: CalendarX,     label: 'Not scheduled' },
]

/**
 * BulkEditModal — edit multiple activities at once.
 *
 * Props:
 *   selectedIds  - Set<string> of activity IDs to edit
 *   terms        - array of { id, name } term objects
 *   orgSettings  - organization settings object (needs block_count, block_labels)
 *   orgId        - organization ID
 *   onClose      - called on cancel or successful save
 */
export default function BulkEditModal({ selectedIds, terms = [], orgSettings, orgId, onClose }) {
  const count = selectedIds.size
  const blockCount = orgSettings?.block_count ?? 0
  const blockLabels = orgSettings?.block_labels ?? {}

  const { data: calendars = [] } = useCalendars(orgId)

  // Section enable toggles
  const [blockEnabled, setBlockEnabled] = useState(false)
  const [timeEnabled, setTimeEnabled] = useState(false)
  const [termsEnabled, setTermsEnabled] = useState(false)
  const [flagsEnabled, setFlagsEnabled] = useState(false)
  const [calendarEnabled, setCalendarEnabled] = useState(false)

  // Field values
  const [block, setBlock] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [selectedTermIds, setSelectedTermIds] = useState([])
  const [calendarId, setCalendarId] = useState('')
  // Tri-state flags: null = no change, true = on, false = off
  const [flagState, setFlagState] = useState(() =>
    Object.fromEntries(BEHAVIOR_FLAGS.map((f) => [f.field, null]))
  )

  const { bulkEdit, isPending, progress, errors } = useBulkEditActivities(orgId)

  function toggleTermId(termId) {
    setSelectedTermIds((prev) =>
      prev.includes(termId) ? prev.filter((id) => id !== termId) : [...prev, termId]
    )
  }

  function cycleFlag(field) {
    setFlagState((prev) => {
      const current = prev[field]
      const next = current === null ? true : current === true ? false : null

      const updated = { ...prev, [field]: next }

      // Mutual exclusion: is_release ↔ requires_attendance
      if (field === 'is_release' && next === true) updated.requires_attendance = false
      if (field === 'requires_attendance' && next === true) updated.is_release = false
      // Mutual exclusion: allows_presence_wave ↔ requires_checkin
      if (field === 'allows_presence_wave' && next === true) updated.requires_checkin = null
      if (field === 'requires_checkin' && next === true) updated.allows_presence_wave = null

      return updated
    })
  }

  function buildChanges() {
    const changes = {}

    if (blockEnabled) {
      changes.block = block === '' ? null : Number(block)
    }
    if (timeEnabled) {
      changes.time = { start: startTime, end: endTime }
    }
    if (termsEnabled) {
      changes.termIds = selectedTermIds
    }
    if (flagsEnabled) {
      const activeFlags = {}
      for (const { field } of BEHAVIOR_FLAGS) {
        if (flagState[field] !== null) activeFlags[field] = flagState[field]
      }
      if (Object.keys(activeFlags).length > 0) changes.flags = activeFlags
    }
    if (calendarEnabled) {
      changes.calendarId = calendarId === '' ? null : calendarId
    }

    return changes
  }

  async function handleSubmit() {
    const changes = buildChanges()
    const nothingEnabled = !blockEnabled && !timeEnabled && !termsEnabled && !flagsEnabled && !calendarEnabled
    if (nothingEnabled) return

    const result = await bulkEdit({ selectedIds, changes })
    if (result.success) onClose()
  }

  const totalSteps = (blockEnabled || timeEnabled || flagsEnabled || calendarEnabled ? 1 : 0) +
    (termsEnabled ? count : 0)
  const progressPct = totalSteps > 0 ? Math.round((progress / totalSteps) * 100) : 0

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">Edit {count} {count === 1 ? 'activity' : 'activities'}</h3>

        <div className="flex flex-col gap-4">
          {/* Block */}
          <Section
            enabled={blockEnabled}
            onToggle={() => setBlockEnabled((v) => !v)}
            label="Block"
          >
            <select
              className="select select-sm w-full max-w-xs"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              disabled={!blockEnabled}
            >
              <option value="">No block</option>
              {getBlocks(blockCount).map((b) => (
                <option key={b} value={b}>
                  {getBlockLabel(b, blockLabels)}
                </option>
              ))}
            </select>
          </Section>

          {/* Time */}
          <Section
            enabled={timeEnabled}
            onToggle={() => setTimeEnabled((v) => !v)}
            label="Time"
          >
            <div className="flex items-center gap-2">
              <input
                type="time"
                className="input input-sm w-36"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={!timeEnabled}
              />
              <span className="text-base-content/50 text-sm">to</span>
              <input
                type="time"
                className="input input-sm w-36"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={!timeEnabled}
              />
            </div>
          </Section>

          {/* Terms */}
          <Section
            enabled={termsEnabled}
            onToggle={() => setTermsEnabled((v) => !v)}
            label="Terms"
            hint="Replaces all existing terms on each activity"
          >
            {terms.length === 0 ? (
              <p className="text-sm text-base-content/50">No terms defined.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {terms.map((term) => {
                  const checked = selectedTermIds.includes(term.id)
                  return (
                    <label
                      key={term.id}
                      className={`flex items-center gap-1.5 cursor-pointer select-none px-2 py-1 rounded border text-sm transition-colors ${
                        checked
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-base-300 text-base-content/70'
                      } ${!termsEnabled ? 'opacity-40 pointer-events-none' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        onChange={() => toggleTermId(term.id)}
                        disabled={!termsEnabled}
                      />
                      {term.name}
                    </label>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Behavior Flags */}
          <Section
            enabled={flagsEnabled}
            onToggle={() => setFlagsEnabled((v) => !v)}
            label="Behavior flags"
            hint="Only toggled flags will be changed"
          >
            <div className="flex flex-wrap gap-1">
              {BEHAVIOR_FLAGS.map(({ field, icon: Icon, label }) => {
                const state = flagState[field]
                const btnClass =
                  state === null
                    ? 'btn-ghost text-base-content/40'
                    : state === true
                    ? 'btn-primary'
                    : 'btn-outline btn-error'
                return (
                  <button
                    key={field}
                    type="button"
                    className={`btn btn-xs gap-1 ${btnClass}`}
                    title={`${label} — click to cycle: no change → on → off`}
                    onClick={() => cycleFlag(field)}
                    disabled={!flagsEnabled}
                  >
                    <Icon size={11} />
                    <span className="hidden sm:inline text-xs">{label}</span>
                    {state === null && <span className="text-xs opacity-60">—</span>}
                    {state === true && <span className="text-xs">on</span>}
                    {state === false && <span className="text-xs">off</span>}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Calendar */}
          <Section
            enabled={calendarEnabled}
            onToggle={() => setCalendarEnabled((v) => !v)}
            label="Calendar"
          >
            <select
              className="select select-sm w-full max-w-xs"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              disabled={!calendarEnabled}
            >
              <option value="">None / Unassigned</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
          </Section>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="alert alert-error mt-4 text-sm">
            <span>
              {errors[0].phase === 'scalar'
                ? `Failed to update fields: ${errors[0].error?.message}`
                : `${errors.length} of ${count} activities failed to update terms.`}
            </span>
          </div>
        )}

        {/* Progress */}
        {isPending && (
          <div className="mt-4">
            <progress className="progress progress-primary w-full" value={progressPct} max="100" />
            <p className="text-xs text-base-content/50 mt-1 text-center">{progress} / {totalSteps}</p>
          </div>
        )}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isPending || (!blockEnabled && !timeEnabled && !termsEnabled && !flagsEnabled && !calendarEnabled)}
          >
            {isPending ? <span className="loading loading-spinner loading-xs" /> : null}
            Apply to {count} {count === 1 ? 'activity' : 'activities'}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={!isPending ? onClose : undefined} />
    </dialog>
  )
}

/** Collapsible section with enable checkbox */
function Section({ enabled, onToggle, label, hint, children }) {
  return (
    <div className={`border rounded-lg p-3 transition-colors ${enabled ? 'border-primary/40 bg-base-100' : 'border-base-300 bg-base-200/40'}`}>
      <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
        <input
          type="checkbox"
          className="checkbox checkbox-sm checkbox-primary"
          checked={enabled}
          onChange={onToggle}
        />
        <span className="font-medium text-sm">{label}</span>
        {hint && <span className="text-xs text-base-content/50 ml-1">({hint})</span>}
      </label>
      <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
        {children}
      </div>
    </div>
  )
}
