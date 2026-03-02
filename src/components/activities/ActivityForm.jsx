import { useState, useEffect, useMemo } from 'react'
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_DEFAULTS,
  WEEKDAYS,
  getBlocks,
  getBlockLabel,
} from '@/lib/constants'
import { getStaffUsers, formatUserName } from '@/api/users'
import useAuthStore from '@/store/authStore'

// Which fields are visible by default for each activity type
const TYPE_FIELD_VISIBILITY = {
  regular_class:      { teacher: true,  monitor: false, instructor: false, mentor: false, rotation: false, notScheduled: false },
  college_course:     { teacher: true,  monitor: false, instructor: true,  mentor: false, rotation: false, notScheduled: false },
  external_hs_course: { teacher: false, monitor: false, instructor: true,  mentor: false, rotation: true,  notScheduled: false },
  online_course:      { teacher: false, monitor: true,  instructor: false, mentor: false, rotation: false, notScheduled: true },
  freeform:           { teacher: false, monitor: true,  instructor: false, mentor: false, rotation: false, notScheduled: false },
  internship:         { teacher: false, monitor: true,  instructor: false, mentor: true,  rotation: false, notScheduled: false },
}

// Staff field definitions for the "+ Add staff" menu
const STAFF_FIELDS = [
  { key: 'teacher', label: 'Teacher', field: 'teacher_id', isDropdown: true },
  { key: 'monitor', label: 'Monitor', field: 'monitor_id', isDropdown: true },
  { key: 'instructor', label: 'Instructor Name', field: 'instructor_name', isDropdown: false },
  { key: 'mentor', label: 'Mentor Name', field: 'mentor_name', isDropdown: false },
]

const EMPTY_FORM = {
  name: '',
  type: 'regular_class',
  description: '',
  teacher_id: '',
  monitor_id: '',
  instructor_name: '',
  mentor_name: '',
  block: '',
  days_of_week: [],
  rotation_day_type: '',
  default_start_time: '',
  default_end_time: '',
  start_date: '',
  end_date: '',
  is_not_scheduled: false,
  is_release: false,
  location: '',
  requires_attendance: true,
  requires_checkin: false,
  allows_presence_wave: false,
  allows_freeform: false,
  requires_geofence: false,
}

function buildInitialForm(activity, type) {
  if (activity) {
    return {
      ...EMPTY_FORM,
      ...activity,
      teacher_id: activity.teacher_id || '',
      monitor_id: activity.monitor_id || '',
      instructor_name: activity.instructor_name || '',
      mentor_name: activity.mentor_name || '',
      block: activity.block != null ? String(activity.block) : '',
      days_of_week: activity.days_of_week || [],
      rotation_day_type: activity.rotation_day_type || '',
      default_start_time: activity.default_start_time || '',
      default_end_time: activity.default_end_time || '',
      start_date: activity.start_date || '',
      end_date: activity.end_date || '',
      location: activity.location || '',
      description: activity.description || '',
    }
  }
  const defaults = ACTIVITY_TYPE_DEFAULTS[type || 'regular_class'] || {}
  return { ...EMPTY_FORM, type: type || 'regular_class', ...defaults }
}

// Simple labeled field wrapper with consistent spacing
function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  )
}

/**
 * ActivityForm — reusable form for creating/editing activities.
 *
 * Props:
 *   activity    - existing activity object for edit mode (null for create)
 *   onSave      - called with form data on submit
 *   onCancel    - called when user cancels
 *   saving      - boolean, disables submit button while saving
 *   orgSettings - organization.settings object (for block_count, rotation config)
 */
export default function ActivityForm({ activity = null, onSave, onCancel, saving = false, orgSettings = {} }) {
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id

  const [form, setForm] = useState(() => buildInitialForm(activity))
  const [staffUsers, setStaffUsers] = useState([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [extraStaffFields, setExtraStaffFields] = useState(new Set())

  const isEdit = !!activity
  const blockCount = orgSettings?.block_count || null
  const blocks = useMemo(() => getBlocks(blockCount), [blockCount])
  const usesRotation = orgSettings?.uses_rotation_schedule || false
  const rotationDayNames = orgSettings?.rotation_day_names || ['A', 'B']

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    setStaffLoading(true)
    getStaffUsers(orgId)
      .then((users) => { if (!cancelled) setStaffUsers(users) })
      .catch((err) => console.error('Failed to load staff:', err))
      .finally(() => { if (!cancelled) setStaffLoading(false) })
    return () => { cancelled = true }
  }, [orgId])

  const typeVisibility = TYPE_FIELD_VISIBILITY[form.type] || TYPE_FIELD_VISIBILITY.regular_class

  function handleTypeChange(newType) {
    const defaults = ACTIVITY_TYPE_DEFAULTS[newType] || {}
    const visibility = TYPE_FIELD_VISIBILITY[newType] || {}
    setForm((prev) => ({
      ...prev,
      type: newType,
      ...defaults,
      teacher_id: (visibility.teacher || extraStaffFields.has('teacher')) ? prev.teacher_id : '',
      monitor_id: (visibility.monitor || extraStaffFields.has('monitor')) ? prev.monitor_id : '',
      instructor_name: (visibility.instructor || extraStaffFields.has('instructor')) ? prev.instructor_name : '',
      mentor_name: (visibility.mentor || extraStaffFields.has('mentor')) ? prev.mentor_name : '',
      rotation_day_type: visibility.rotation ? prev.rotation_day_type : '',
      is_not_scheduled: visibility.notScheduled ? true : false,
    }))
    setExtraStaffFields(new Set())
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleDayToggle(dayValue) {
    setForm((prev) => {
      const current = prev.days_of_week
      const next = current.includes(dayValue)
        ? current.filter((d) => d !== dayValue)
        : [...current, dayValue].sort((a, b) => a - b)
      return { ...prev, days_of_week: next }
    })
  }

  function handleAddStaffField(staffKey) {
    setExtraStaffFields((prev) => new Set(prev).add(staffKey))
    setShowAddStaff(false)
  }

  function isStaffFieldVisible(staffKey) {
    return typeVisibility[staffKey] || extraStaffFields.has(staffKey)
  }

  const addableStaffFields = STAFF_FIELDS.filter((sf) => !isStaffFieldVisible(sf.key))

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return

    const data = {
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim() || null,
      teacher_id: form.teacher_id || null,
      monitor_id: form.monitor_id || null,
      instructor_name: form.instructor_name.trim() || null,
      mentor_name: form.mentor_name.trim() || null,
      block: form.block !== '' ? parseInt(form.block, 10) : null,
      days_of_week: form.days_of_week.length > 0 ? form.days_of_week : null,
      rotation_day_type: form.rotation_day_type || null,
      default_start_time: form.default_start_time || null,
      default_end_time: form.default_end_time || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_not_scheduled: form.is_not_scheduled,
      is_release: form.is_release,
      location: form.location.trim() || null,
      requires_attendance: form.requires_attendance,
      requires_checkin: form.requires_checkin,
      allows_presence_wave: form.allows_presence_wave,
      allows_freeform: form.allows_freeform,
      requires_geofence: form.requires_geofence,
    }

    onSave(data)
  }

  const showScheduling = !form.is_not_scheduled

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Name & Type ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Activity Name *">
          <input
            type="text"
            className="input input-bordered w-full"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Kirkwood English 101"
            required
          />
        </Field>

        <Field label="Type *">
          <select
            className="select select-bordered w-full"
            value={form.type}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          className="textarea textarea-bordered w-full"
          rows={2}
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Optional description or notes"
        />
      </Field>

      {/* ── Staff ── */}
      <div>
        <h3 className="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-3">Staff</h3>
        <div className="space-y-4">
          {isStaffFieldVisible('teacher') && (
            <StaffDropdown
              label="Teacher"
              value={form.teacher_id}
              onChange={(v) => handleChange('teacher_id', v)}
              staffUsers={staffUsers}
              loading={staffLoading}
            />
          )}

          {isStaffFieldVisible('monitor') && (
            <StaffDropdown
              label="Monitor"
              value={form.monitor_id}
              onChange={(v) => handleChange('monitor_id', v)}
              staffUsers={staffUsers}
              loading={staffLoading}
            />
          )}

          {isStaffFieldVisible('instructor') && (
            <Field label="Instructor Name">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={form.instructor_name}
                onChange={(e) => handleChange('instructor_name', e.target.value)}
                placeholder="External instructor (not a system user)"
              />
            </Field>
          )}

          {isStaffFieldVisible('mentor') && (
            <Field label="Mentor Name">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={form.mentor_name}
                onChange={(e) => handleChange('mentor_name', e.target.value)}
                placeholder="Internship mentor (not a system user)"
              />
            </Field>
          )}

          {addableStaffFields.length > 0 && (
            <div className="relative">
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1"
                onClick={() => setShowAddStaff(!showAddStaff)}
              >
                <span className="text-lg leading-none">+</span>
                Add staff
              </button>
              {showAddStaff && (
                <ul className="menu menu-sm bg-base-200 rounded-box shadow-md absolute z-10 mt-1 w-48">
                  {addableStaffFields.map((sf) => (
                    <li key={sf.key}>
                      <button type="button" onClick={() => handleAddStaffField(sf.key)}>
                        {sf.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Scheduling ── */}
      <div>
        <h3 className="text-sm font-semibold text-base-content/60 uppercase tracking-wide mb-3">Scheduling</h3>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
          {typeVisibility.notScheduled && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={form.is_not_scheduled}
                onChange={(e) => handleChange('is_not_scheduled', e.target.checked)}
              />
              <span className="text-sm">Not scheduled (no fixed time/place)</span>
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={form.is_release}
              onChange={(e) => handleChange('is_release', e.target.checked)}
              disabled={form.is_not_scheduled}
            />
            <span className="text-sm">Release (no attendance required)</span>
          </label>
        </div>

        {showScheduling && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Block">
                {blocks.length > 0 ? (
                  <select
                    className="select select-bordered select-sm w-full"
                    value={form.block}
                    onChange={(e) => handleChange('block', e.target.value)}
                  >
                    <option value="">Not assigned</option>
                    {blocks.map((b) => (
                      <option key={b} value={b}>{getBlockLabel(b)}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-base-content/50 italic pt-1">
                    Blocks not yet defined in org settings
                  </p>
                )}
              </Field>

              <Field label="Start Time">
                <input
                  type="time"
                  className="input input-bordered input-sm w-full"
                  value={form.default_start_time}
                  onChange={(e) => handleChange('default_start_time', e.target.value)}
                />
              </Field>

              <Field label="End Time">
                <input
                  type="time"
                  className="input input-bordered input-sm w-full"
                  value={form.default_end_time}
                  onChange={(e) => handleChange('default_end_time', e.target.value)}
                />
              </Field>
            </div>

            {/* Days of week OR Rotation day */}
            {typeVisibility.rotation && usesRotation ? (
              <Field label="Rotation Day">
                <select
                  className="select select-bordered select-sm w-32"
                  value={form.rotation_day_type}
                  onChange={(e) => handleChange('rotation_day_type', e.target.value)}
                >
                  <option value="">Not set</option>
                  {rotationDayNames.map((name) => (
                    <option key={name} value={name}>{name} Day</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Days of Week">
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      className={`btn btn-sm min-w-10 ${
                        form.days_of_week.includes(day.value)
                          ? 'btn-primary'
                          : 'btn-outline'
                      }`}
                      onClick={() => handleDayToggle(day.value)}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {/* Date range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Start Date">
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={form.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                />
              </Field>
              <Field label="End Date">
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  value={form.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* ── Location ── */}
      <Field label="Location">
        <input
          type="text"
          className="input input-bordered input-sm w-full max-w-md"
          value={form.location}
          onChange={(e) => handleChange('location', e.target.value)}
          placeholder="Room number, building, or address"
        />
      </Field>

      {/* ── Behavior flags (collapsible) ── */}
      <div className="collapse collapse-arrow bg-base-200 rounded-lg">
        <input type="checkbox" />
        <div className="collapse-title text-sm font-medium">
          Advanced — Behavior Flags
        </div>
        <div className="collapse-content">
          <div className="flex flex-col gap-3 pt-2">
            {[
              ['requires_attendance', 'Requires attendance'],
              ['requires_checkin', 'Requires check-in'],
              ['allows_presence_wave', 'Allows presence wave'],
              ['allows_freeform', 'Allows freeform tagging'],
              ['requires_geofence', 'Requires geofence'],
            ].map(([field, label]) => (
              <label key={field} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={form[field]}
                  onChange={(e) => handleChange(field, e.target.checked)}
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
          {saving ? <span className="loading loading-spinner loading-sm" /> : null}
          {isEdit ? 'Save Changes' : 'Create Activity'}
        </button>
      </div>
    </form>
  )
}

/** Staff dropdown with consistent Field wrapper */
function StaffDropdown({ label, value, onChange, staffUsers, loading }) {
  return (
    <Field label={label}>
      <select
        className="select select-bordered select-sm w-full max-w-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        <option value="">
          {loading ? 'Loading staff...' : staffUsers.length === 0 ? 'No staff members found' : `Select ${label.toLowerCase()}`}
        </option>
        {staffUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {formatUserName(user)}
          </option>
        ))}
      </select>
    </Field>
  )
}
