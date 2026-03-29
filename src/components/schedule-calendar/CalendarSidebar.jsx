import { useState, useRef, useEffect } from 'react'
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa'
import { useCalendarUiStore } from '@/store/calendarUiStore'
import {
  useCreateCalendar,
  useUpdateCalendar,
  useDeleteCalendar,
} from '@/hooks/useCalendars'

const PRESET_COLORS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#a855f7',
  '#f97316',
  '#64748b',
]

// ── Calendar group (Teachers or Organizations) ──────────────────────────────

function CalendarGroup({ title, calendars, isCalendarVisible, toggleCalendar, setGroupVisibility, onEditCalendar, showOwner }) {
  const groupRef = useRef(null)
  const visibleCount = calendars.filter((c) => isCalendarVisible(c.id)).length
  const allVisible = calendars.length > 0 && visibleCount === calendars.length
  const someVisible = visibleCount > 0 && visibleCount < calendars.length

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.indeterminate = someVisible
    }
  }, [someVisible])

  if (calendars.length === 0) return null

  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-2 py-1">
        <input
          type="checkbox"
          ref={groupRef}
          className="checkbox checkbox-xs"
          checked={allVisible}
          onChange={() => setGroupVisibility(calendars.map((c) => c.id), !allVisible)}
        />
        <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wide flex-1">
          {title}
        </span>
      </div>
      {calendars.map((cal) => (
        <div key={cal.id} className="flex items-center gap-2 group py-1 px-2 rounded hover:bg-base-200">
          <input
            type="checkbox"
            className="checkbox checkbox-xs"
            checked={isCalendarVisible(cal.id)}
            onChange={() => toggleCalendar(cal.id)}
          />
          <span
            className="inline-block w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: cal.color }}
          />
          <button
            className="text-sm truncate flex-1 text-left"
            onClick={() => onEditCalendar(cal)}
          >
            {cal.name}
          </button>
          {showOwner && cal.owner && (
            <span className="text-[10px] text-base-content/40 truncate max-w-[60px]">
              {cal.owner.last_name}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Create / Edit modal ──────────────────────────────────────────────────────

function CalendarModal({ mode, calendar, staffUsers, orgId, onClose }) {
  const [name, setName] = useState(calendar?.name ?? '')
  const [color, setColor] = useState(calendar?.color ?? PRESET_COLORS[0])
  const [ownerId, setOwnerId] = useState(calendar?.owner_id ?? '')

  const createMutation = useCreateCalendar(orgId)
  const updateMutation = useUpdateCalendar(orgId)
  const deleteMutation = useDeleteCalendar(orgId)

  const saving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  const error = createMutation.error?.message || updateMutation.error?.message || deleteMutation.error?.message

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      name: name.trim(),
      color,
      owner_id: ownerId || null,
    }

    if (mode === 'create') {
      createMutation.mutate(payload, { onSuccess: onClose })
    } else {
      updateMutation.mutate({ id: calendar.id, updates: payload }, { onSuccess: onClose })
    }
  }

  function handleDelete() {
    if (!window.confirm(`Delete calendar "${calendar.name}"? Activities assigned to it will become unassigned.`)) return
    deleteMutation.mutate(calendar.id, { onSuccess: onClose })
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box modal-sm relative">
        <button
          type="button"
          className="btn btn-sm btn-circle absolute right-3 top-3"
          onClick={onClose}
        >
          <FaTimes size={12} />
        </button>

        <h3 className="font-semibold text-base mb-4">
          {mode === 'create' ? 'New Calendar' : 'Edit Calendar'}
        </h3>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="form-control">
            <label className="label label-text text-sm">Name</label>
            <input
              type="text"
              className="input input-bordered input-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-control">
            <label className="label label-text text-sm">Color</label>
            <div className="flex flex-wrap gap-2 items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#000' : 'transparent',
                  }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
              <input
                type="color"
                className="w-6 h-6 rounded cursor-pointer border border-base-300"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                title="Custom color"
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label label-text text-sm">Owner</label>
            <select
              className="select select-bordered select-sm"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">None (organization calendar)</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          <div className="modal-action mt-2">
            {mode === 'edit' && (
              <button
                type="button"
                className="btn btn-error btn-sm mr-auto"
                onClick={handleDelete}
                disabled={saving}
              >
                Delete
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !name.trim()}>
              {saving ? <span className="loading loading-spinner loading-xs" /> : mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

export function CalendarSidebar({ calendars, staffUsers, orgId }) {
  const {
    sidebarMinimized,
    isCalendarVisible,
    toggleCalendar,
    setGroupVisibility,
    toggleSidebarMinimized,
  } = useCalendarUiStore()

  const [modalState, setModalState] = useState(null)
  // null | { mode: 'create' } | { mode: 'edit', calendar: cal }

  const teacherCalendars = calendars.filter((c) => c.owner_id !== null)
  const orgCalendars = calendars.filter((c) => c.owner_id === null)

  if (sidebarMinimized) {
    return (
      <div className="flex flex-col items-center gap-2 py-2 px-1 border-r border-base-200 w-11 shrink-0">
        <button
          className="btn btn-ghost btn-xs btn-square"
          onClick={toggleSidebarMinimized}
          title="Expand sidebar"
        >
          <FaChevronRight size={10} />
        </button>
        {calendars.map((cal) => (
          <button
            key={cal.id}
            className="w-4 h-4 rounded-full border-2 shrink-0"
            style={{
              backgroundColor: cal.color,
              borderColor: isCalendarVisible(cal.id) ? cal.color : '#e5e7eb',
              opacity: isCalendarVisible(cal.id) ? 1 : 0.4,
            }}
            title={cal.name}
            onClick={() => toggleCalendar(cal.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col border-r border-base-200 shrink-0 overflow-y-auto" style={{ width: '220px' }}>
        {/* Header */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-base-200">
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={toggleSidebarMinimized}
            title="Minimize sidebar"
          >
            <FaChevronLeft size={10} />
          </button>
          <span className="text-sm font-semibold flex-1">Calendars</span>
        </div>

        {/* Calendar groups */}
        <div className="flex flex-col gap-1 p-2 flex-1">
          <CalendarGroup
            title="Teachers"
            calendars={teacherCalendars}
            isCalendarVisible={isCalendarVisible}
            toggleCalendar={toggleCalendar}
            setGroupVisibility={setGroupVisibility}
            onEditCalendar={(cal) => setModalState({ mode: 'edit', calendar: cal })}
            showOwner
          />

          <CalendarGroup
            title="Organizations"
            calendars={orgCalendars}
            isCalendarVisible={isCalendarVisible}
            toggleCalendar={toggleCalendar}
            setGroupVisibility={setGroupVisibility}
            onEditCalendar={(cal) => setModalState({ mode: 'edit', calendar: cal })}
            showOwner={false}
          />

          {/* Unassigned — always visible pseudo-entry */}
          <div className="px-2 py-1">
            <span className="text-xs text-base-content/40">── Unassigned ──</span>
          </div>
        </div>

        {/* Add calendar button */}
        <div className="px-2 py-2 border-t border-base-200">
          <button
            className="btn btn-ghost btn-sm w-full justify-start text-primary"
            onClick={() => setModalState({ mode: 'create' })}
          >
            + Add calendar
          </button>
        </div>
      </div>

      {modalState && (
        <CalendarModal
          mode={modalState.mode}
          calendar={modalState.calendar}
          staffUsers={staffUsers}
          orgId={orgId}
          onClose={() => setModalState(null)}
        />
      )}
    </>
  )
}
