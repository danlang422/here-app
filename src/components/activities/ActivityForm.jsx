import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_DEFAULTS,
  WEEKDAYS,
  getBlocks,
  getBlockLabel,
} from '@/lib/constants'
import { formatUserName } from '@/api/users'
import { useStaffUsers } from '@/hooks/useUsers'
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
  duration_minutes: '',
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
      duration_minutes: activity.duration_minutes != null ? String(activity.duration_minutes) : '',
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

  const { register, handleSubmit, watch, setValue, getValues } = useForm({
    defaultValues: buildInitialForm(activity),
  })

  const { data: staffUsers = [], isLoading: staffLoading } = useStaffUsers(orgId)
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [extraStaffFields, setExtraStaffFields] = useState(new Set())

  const isEdit = !!activity
  const blockCount = orgSettings?.block_count || null
  const blocks = useMemo(() => getBlocks(blockCount), [blockCount])
  const usesRotation = orgSettings?.uses_rotation_schedule || false
  const rotationDayNames = orgSettings?.rotation_day_names || ['A', 'B']

  const watchedType = watch('type')
  const watchedIsNotScheduled = watch('is_not_scheduled')
  const watchedDaysOfWeek = watch('days_of_week')
  const watchedName = watch('name')

  const typeVisibility = TYPE_FIELD_VISIBILITY[watchedType] || TYPE_FIELD_VISIBILITY.regular_class
  const showScheduling = !watchedIsNotScheduled

  function handleTypeChange(newType) {
    const defaults = ACTIVITY_TYPE_DEFAULTS[newType] || {}
    const visibility = TYPE_FIELD_VISIBILITY[newType] || {}

    setValue('type', newType)
    for (const [key, val] of Object.entries(defaults)) {
      setValue(key, val)
    }

    if (!visibility.teacher && !extraStaffFields.has('teacher')) setValue('teacher_id', '')
    if (!visibility.monitor && !extraStaffFields.has('monitor')) setValue('monitor_id', '')
    if (!visibility.instructor && !extraStaffFields.has('instructor')) setValue('instructor_name', '')
    if (!visibility.mentor && !extraStaffFields.has('mentor')) setValue('mentor_name', '')
    if (!visibility.rotation) setValue('rotation_day_type', '')
    setValue('is_not_scheduled', !!visibility.notScheduled)

    setExtraStaffFields(new Set())
  }

  function handleDayToggle(dayValue) {
    const current = getValues('days_of_week')
    const next = current.includes(dayValue)
      ? current.filter((d) => d !== dayValue)
      : [...current, dayValue].sort((a, b) => a - b)
    setValue('days_of_week', next)
  }

  function handleAddStaffField(staffKey) {
    setExtraStaffFields((prev) => new Set(prev).add(staffKey))
    setShowAddStaff(false)
  }

  function isStaffFieldVisible(staffKey) {
    return typeVisibility[staffKey] || extraStaffFields.has(staffKey)
  }

  const addableStaffFields = STAFF_FIELDS.filter((sf) => !isStaffFieldVisible(sf.key))

  function onFormSubmit(formValues) {
    const data = {
      name: formValues.name.trim(),
      type: formValues.type,
      description: formValues.description.trim() || null,
      teacher_id: formValues.teacher_id || null,
      monitor_id: formValues.monitor_id || null,
      instructor_name: formValues.instructor_name.trim() || null,
      mentor_name: formValues.mentor_name.trim() || null,
      block: formValues.block !== '' ? parseInt(formValues.block, 10) : null,
      days_of_week: formValues.days_of_week.length > 0 ? formValues.days_of_week : null,
      rotation_day_type: formValues.rotation_day_type || null,
      default_start_time: formValues.default_start_time || null,
      default_end_time: formValues.default_end_time || null,
      start_date: formValues.start_date || null,
      end_date: formValues.end_date || null,
      is_not_scheduled: formValues.is_not_scheduled,
      is_release: formValues.is_release,
      location: formValues.location.trim() || null,
      requires_attendance: formValues.requires_attendance,
      requires_checkin: formValues.requires_checkin,
      allows_presence_wave: formValues.allows_presence_wave,
      allows_freeform: formValues.allows_freeform,
      requires_geofence: formValues.requires_geofence,
      duration_minutes: formValues.duration_minutes !== '' ? parseInt(formValues.duration_minutes, 10) : null,
    }

    onSave(data)
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* ── Name & Type ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Activity Name *">
          <input
            type="text"
            className="input input-bordered w-full"
            {...register('name', { required: true })}
            placeholder="e.g. Kirkwood English 101"
          />
        </Field>

        <Field label="Type *">
          <select
            className="select select-bordered w-full"
            value={watchedType}
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
          {...register('description')}
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
              registerProps={register('teacher_id')}
              staffUsers={staffUsers}
              loading={staffLoading}
            />
          )}

          {isStaffFieldVisible('monitor') && (
            <StaffDropdown
              label="Monitor"
              registerProps={register('monitor_id')}
              staffUsers={staffUsers}
              loading={staffLoading}
            />
          )}

          {isStaffFieldVisible('instructor') && (
            <Field label="Instructor Name">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                {...register('instructor_name')}
                placeholder="External instructor (not a system user)"
              />
            </Field>
          )}

          {isStaffFieldVisible('mentor') && (
            <Field label="Mentor Name">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                {...register('mentor_name')}
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
                {...register('is_not_scheduled')}
              />
              <span className="text-sm">Not scheduled (no fixed time/place)</span>
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              {...register('is_release')}
              disabled={watchedIsNotScheduled}
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
                    {...register('block')}
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
                  {...register('default_start_time')}
                />
              </Field>

              <Field label="End Time">
                <input
                  type="time"
                  className="input input-bordered input-sm w-full"
                  {...register('default_end_time')}
                />
              </Field>

              <Field label="Duration (min)">
                <input
                  type="number"
                  className="input input-bordered input-sm w-full"
                  {...register('duration_minutes', { min: 1 })}
                  placeholder="e.g. 50"
                  min="1"
                />
              </Field>
            </div>

            {/* Days of week OR Rotation day */}
            {typeVisibility.rotation && usesRotation ? (
              <Field label="Rotation Day">
                <select
                  className="select select-bordered select-sm w-32"
                  {...register('rotation_day_type')}
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
                        watchedDaysOfWeek.includes(day.value)
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
                  {...register('start_date')}
                />
              </Field>
              <Field label="End Date">
                <input
                  type="date"
                  className="input input-bordered input-sm w-full"
                  {...register('end_date')}
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
          {...register('location')}
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
                  {...register(field)}
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
        <button type="submit" className="btn btn-primary" disabled={saving || !watchedName?.trim()}>
          {saving ? <span className="loading loading-spinner loading-sm" /> : null}
          {isEdit ? 'Save Changes' : 'Create Activity'}
        </button>
      </div>
    </form>
  )
}

/** Staff dropdown with consistent Field wrapper */
function StaffDropdown({ label, registerProps, staffUsers, loading }) {
  return (
    <Field label={label}>
      <select
        className="select select-bordered select-sm w-full max-w-xs"
        {...registerProps}
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
