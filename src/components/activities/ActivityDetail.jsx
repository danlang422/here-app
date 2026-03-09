import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import {
  FaPencilAlt, FaCheck, FaTimes, FaUserPlus,
  FaClipboardList, FaClock, FaHandPaper, FaTags,
  FaMapMarkerAlt, FaDoorOpen, FaCalendarTimes, FaUserGraduate,
} from 'react-icons/fa'
import { getBlocks, getBlockLabel, WEEKDAYS } from '@/lib/constants'
import { useStaffUsers } from '@/hooks/useUsers'
import useAuthStore from '@/store/authStore'
import StaffRows from './StaffRows'
import { buildStaffRows, staffRowsToFlat } from './staffUtils'

// ─── Behavior flag definitions ────────────────────────────────────────────────

const BEHAVIOR_FLAGS = [
  { field: 'requires_attendance',  icon: FaClipboardList, tooltip: 'Requires attendance' },
  { field: 'requires_checkin',     icon: FaClock,         tooltip: 'Requires check-in' },
  { field: 'allows_presence_wave', icon: FaHandPaper,     tooltip: 'Allows presence wave' },
  { field: 'allows_freeform',      icon: FaTags,          tooltip: 'Allows freeform tagging' },
  { field: 'requires_geofence',    icon: FaMapMarkerAlt,  tooltip: 'Requires geofence' },
  { field: 'is_release',           icon: FaDoorOpen,      tooltip: 'Release (no attendance)' },
  { field: 'is_not_scheduled',     icon: FaCalendarTimes, tooltip: 'Not scheduled' },
]

// ─── Form value helpers ────────────────────────────────────────────────────────

const DEFAULT_VALUES = {
  name: '',
  description: '',
  block: '',
  days_of_week: [],
  rotation_day_type: '',
  default_start_time: '',
  default_end_time: '',
  duration_minutes: '',
  start_date: '',
  end_date: '',
  location: '',
  requires_attendance: true,
  requires_checkin: false,
  allows_presence_wave: false,
  allows_freeform: false,
  requires_geofence: false,
  is_release: false,
  is_not_scheduled: false,
}

function buildInitialValues(activity) {
  if (!activity) return DEFAULT_VALUES
  return {
    ...DEFAULT_VALUES,
    name: activity.name || '',
    description: activity.description || '',
    block: activity.block != null ? String(activity.block) : '',
    days_of_week: activity.days_of_week || [],
    rotation_day_type: activity.rotation_day_type || '',
    default_start_time: activity.default_start_time || '',
    default_end_time: activity.default_end_time || '',
    duration_minutes: activity.duration_minutes != null ? String(activity.duration_minutes) : '',
    start_date: activity.start_date || '',
    end_date: activity.end_date || '',
    location: activity.location || '',
    requires_attendance: activity.requires_attendance ?? true,
    requires_checkin: activity.requires_checkin ?? false,
    allows_presence_wave: activity.allows_presence_wave ?? false,
    allows_freeform: activity.allows_freeform ?? false,
    requires_geofence: activity.requires_geofence ?? false,
    is_release: activity.is_release ?? false,
    is_not_scheduled: activity.is_not_scheduled ?? false,
  }
}

// ─── Time formatting helpers ───────────────────────────────────────────────────

function formatTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${String(m).padStart(2, '0')}${period}`
}

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d + 'T00:00:00')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const DAY_LABELS = { 1: 'M', 2: 'Tu', 3: 'W', 4: 'Th', 5: 'F', 0: 'Su', 6: 'Sa' }

// ─── ActivityDetail ────────────────────────────────────────────────────────────

/**
 * ActivityDetail — unified view/edit component for a single activity.
 *
 * Props:
 *   activity      - activity object (or null for new)
 *   mode          - 'view' | 'edit'
 *   saving        - boolean, disables save while pending
 *   orgSettings   - organization.settings object
 *   enrollments   - array of enrollment objects (with .student)
 *   onSave        - called with form data on save
 *   onCancel      - called when edit is cancelled (returns to view)
 *   onEditClick   - called when edit pencil icon is clicked
 *   onEnrollClick - called when enroll icon is clicked
 */
export default function ActivityDetail({
  activity = null,
  mode = 'view',
  saving = false,
  orgSettings = {},
  enrollments = [],
  onSave,
  onCancel,
  onEditClick,
  onEnrollClick,
}) {
  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id
  const { data: staffUsers = [] } = useStaffUsers(orgId)

  const blockCount = orgSettings?.block_count ?? null
  const blocks = useMemo(() => getBlocks(blockCount), [blockCount])
  const rotationDayNames = orgSettings?.rotation_day_names ?? ['A', 'B']

  const { register, handleSubmit, watch, setValue, reset, getValues } = useForm({
    defaultValues: buildInitialValues(activity),
  })

  const [staffRows, setStaffRows] = useState(() => buildStaffRows(activity))
  const [showDescription, setShowDescription] = useState(!!(activity?.description))

  // Reset form and staff rows when activity changes
  useEffect(() => {
    reset(buildInitialValues(activity))
    setStaffRows(buildStaffRows(activity))
    setShowDescription(!!(activity?.description))
  }, [activity?.id ?? 'new']) // eslint-disable-line react-hooks/exhaustive-deps

  const watchedIsNotScheduled = watch('is_not_scheduled')
  const watchedDaysOfWeek = watch('days_of_week')
  const watchedRotation = watch('rotation_day_type')
  const watchedName = watch('name')

  // Derived scheduling UI state
  const daysSelected = watchedDaysOfWeek?.length > 0
  const rotationSelected = !!watchedRotation

  function handleDayToggle(dayValue) {
    const current = getValues('days_of_week')
    const next = current.includes(dayValue)
      ? current.filter((d) => d !== dayValue)
      : [...current, dayValue].sort((a, b) => a - b)
    setValue('days_of_week', next)
    if (next.length > 0) setValue('rotation_day_type', '')
  }

  function handleRotationChange(value) {
    setValue('rotation_day_type', value)
    if (value) setValue('days_of_week', [])
  }

  function handleFlagToggle(field) {
    const current = getValues(field)
    const next = !current
    setValue(field, next)
    // Mutual exclusion: is_release ↔ requires_attendance
    if (field === 'is_release' && next) setValue('requires_attendance', false)
    if (field === 'requires_attendance' && next) setValue('is_release', false)
  }

  function onFormSubmit(formValues) {
    const staffFlat = staffRowsToFlat(staffRows)
    const data = {
      name: formValues.name.trim(),
      description: formValues.description?.trim() || null,
      ...staffFlat,
      block: formValues.block !== '' ? parseInt(formValues.block, 10) : null,
      days_of_week: formValues.days_of_week?.length > 0 ? formValues.days_of_week : null,
      rotation_day_type: formValues.rotation_day_type || null,
      default_start_time: formValues.default_start_time || null,
      default_end_time: formValues.default_end_time || null,
      duration_minutes: formValues.duration_minutes !== '' ? parseInt(formValues.duration_minutes, 10) : null,
      start_date: formValues.start_date || null,
      end_date: formValues.end_date || null,
      location: formValues.location?.trim() || null,
      requires_attendance: formValues.requires_attendance,
      requires_checkin: formValues.requires_checkin,
      allows_presence_wave: formValues.allows_presence_wave,
      allows_freeform: formValues.allows_freeform,
      requires_geofence: formValues.requires_geofence,
      is_release: formValues.is_release,
      is_not_scheduled: formValues.is_not_scheduled,
      type: 'regular_class', // DB constraint workaround — column stays for now
    }
    onSave?.(data)
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-5">

      {/* ── Top bar: name + action icons ── */}
      <div className="flex items-start gap-3 pr-1">
        <div className="flex-1 min-w-0">
          {mode === 'view' ? (
            <h2 className="text-xl font-bold leading-tight">
              {activity?.name || <span className="text-base-content/40 italic">Untitled</span>}
            </h2>
          ) : (
            <input
              type="text"
              className="input input-ghost text-xl font-bold w-full px-0 focus:bg-base-200 focus:px-2 rounded transition-all"
              placeholder="Activity name"
              {...register('name', { required: true })}
            />
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Enroll button — always visible */}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onEnrollClick}
            title="Enroll students"
          >
            <FaUserPlus size={14} />
          </button>

          {mode === 'view' ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={onEditClick}
              title="Edit"
            >
              <FaPencilAlt size={13} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle text-base-content/60"
                onClick={onCancel}
                title="Cancel"
              >
                <FaTimes size={14} />
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm btn-circle"
                disabled={saving || !watchedName?.trim()}
                title="Save"
              >
                {saving
                  ? <span className="loading loading-spinner loading-xs" />
                  : <FaCheck size={12} />
                }
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Properties tray: behavior flags ── */}
      <div className="bg-base-200 rounded-lg px-4 py-3">
        <div className="flex gap-1 flex-wrap">
          {BEHAVIOR_FLAGS.map((flag) => {
            const active = watch(flag.field)
            const FlagIcon = flag.icon
            return (
              <button
                key={flag.field}
                type="button"
                className={[
                  'btn btn-sm btn-circle',
                  active ? 'btn-primary' : 'btn-ghost text-base-content/30',
                  mode === 'edit' ? '' : 'cursor-default pointer-events-none',
                ].join(' ')}
                onClick={mode === 'edit' ? () => handleFlagToggle(flag.field) : undefined}
                title={flag.tooltip}
                tabIndex={mode === 'view' ? -1 : 0}
              >
                <FlagIcon size={14} />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Detail fields ── */}
      <div className="space-y-4">

        {/* Staff */}
        <div>
          <StaffRows
            mode={mode}
            activity={activity}
            staffUsers={staffUsers}
            rows={staffRows}
            onChange={setStaffRows}
          />
        </div>

        {/* Block / Time / Duration */}
        <div>
          {mode === 'view' ? (
            <SchedulingView activity={activity} />
          ) : (
            <SchedulingEdit
              register={register}
              watch={watch}
              setValue={setValue}
              blocks={blocks}
              disabled={watchedIsNotScheduled}
              daysSelected={daysSelected}
              rotationSelected={rotationSelected}
              rotationDayNames={rotationDayNames}
              watchedDaysOfWeek={watchedDaysOfWeek}
              watchedRotation={watchedRotation}
              onDayToggle={handleDayToggle}
              onRotationChange={handleRotationChange}
            />
          )}
        </div>

        {/* Dates + Location */}
        <div>
          {mode === 'view' ? (
            <DatesLocationView activity={activity} />
          ) : (
            <DatesLocationEdit register={register} />
          )}
        </div>

        {/* Description */}
        {mode === 'view' ? (
          activity?.description ? (
            <p className="text-sm text-base-content/60 leading-relaxed">{activity.description}</p>
          ) : null
        ) : (
          showDescription ? (
            <textarea
              className="textarea textarea-bordered w-full text-sm"
              rows={2}
              placeholder="Description or notes"
              {...register('description')}
            />
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-xs text-base-content/50"
              onClick={() => setShowDescription(true)}
            >
              + Description
            </button>
          )
        )}
      </div>

      {/* ── Roster section — only for existing activities ── */}
      {activity?.id && (
        <RosterSection enrollments={enrollments} onEnrollClick={onEnrollClick} />
      )}
    </form>
  )
}

// ─── Scheduling view/edit sub-components ──────────────────────────────────────

function SchedulingView({ activity }) {
  if (activity?.is_not_scheduled) {
    return <span className="text-sm text-base-content/40 italic">Not scheduled</span>
  }

  const parts = []
  if (activity?.block != null) parts.push(getBlockLabel(activity.block))

  const timeParts = []
  if (activity?.default_start_time) timeParts.push(formatTime(activity.default_start_time))
  if (activity?.default_end_time) timeParts.push(formatTime(activity.default_end_time))
  if (timeParts.length) parts.push(timeParts.join('–'))

  if (activity?.duration_minutes) parts.push(`${activity.duration_minutes} min`)

  const scheduling = parts.length > 0 ? (
    <span className="text-sm">{parts.join(' · ')}</span>
  ) : (
    <span className="text-sm text-base-content/40">—</span>
  )

  const daysParts = []
  if (activity?.rotation_day_type) {
    daysParts.push(
      <span key="rot" className="badge badge-outline badge-sm">{activity.rotation_day_type} Day</span>
    )
  } else if (activity?.days_of_week?.length > 0) {
    daysParts.push(
      <span key="days" className="text-sm">
        {activity.days_of_week.map((d) => DAY_LABELS[d] || d).join(' ')}
      </span>
    )
  }

  return (
    <div className="space-y-1">
      <div>{scheduling}</div>
      {daysParts.length > 0 && <div className="flex gap-1 items-center">{daysParts}</div>}
    </div>
  )
}

function SchedulingEdit({
  register, blocks, disabled,
  daysSelected, rotationSelected, rotationDayNames,
  watchedDaysOfWeek, watchedRotation,
  onDayToggle, onRotationChange,
}) {
  return (
    <div className={`space-y-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Block / Start / End / Duration */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">Block</label>
          {blocks.length > 0 ? (
            <select className="select select-bordered select-sm w-full" {...register('block')} disabled={disabled}>
              <option value="">—</option>
              {blocks.map((b) => (
                <option key={b} value={b}>{getBlockLabel(b)}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-base-content/40 italic">Not defined</span>
          )}
        </div>

        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">Start</label>
          <input type="time" className="input input-bordered input-sm w-full" {...register('default_start_time')} disabled={disabled} />
        </div>

        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">End</label>
          <input type="time" className="input input-bordered input-sm w-full" {...register('default_end_time')} disabled={disabled} />
        </div>

        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">Duration (min)</label>
          <input
            type="number"
            className="input input-bordered input-sm w-full"
            min="1"
            placeholder="e.g. 90"
            {...register('duration_minutes', { min: 1 })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Days / Rotation */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-1">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              className={`btn btn-xs min-w-9 ${
                watchedDaysOfWeek?.includes(day.value) ? 'btn-primary' : 'btn-outline'
              }`}
              disabled={disabled || rotationSelected}
              onClick={() => onDayToggle(day.value)}
            >
              {day.short}
            </button>
          ))}
        </div>

        <select
          className="select select-bordered select-sm w-28"
          value={watchedRotation}
          onChange={(e) => onRotationChange(e.target.value)}
          disabled={disabled || daysSelected}
        >
          <option value="">Rotation</option>
          {rotationDayNames.map((name) => (
            <option key={name} value={name}>{name} Day</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function DatesLocationView({ activity }) {
  const parts = []
  const dateParts = []
  if (activity?.start_date) dateParts.push(formatDate(activity.start_date))
  if (activity?.end_date) dateParts.push(formatDate(activity.end_date))
  if (dateParts.length) parts.push(dateParts.join(' – '))
  if (activity?.location) parts.push(activity.location)

  if (!parts.length) return null
  return <span className="text-sm text-base-content/70">{parts.join(' · ')}</span>
}

function DatesLocationEdit({ register }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div>
        <label className="label-text text-xs text-base-content/50 mb-1 block">Start Date</label>
        <input type="date" className="input input-bordered input-sm w-full" {...register('start_date')} />
      </div>
      <div>
        <label className="label-text text-xs text-base-content/50 mb-1 block">End Date</label>
        <input type="date" className="input input-bordered input-sm w-full" {...register('end_date')} />
      </div>
      <div>
        <label className="label-text text-xs text-base-content/50 mb-1 block">Location</label>
        <input
          type="text"
          className="input input-bordered input-sm w-full"
          placeholder="Room, building, or address"
          {...register('location')}
        />
      </div>
    </div>
  )
}

// ─── Roster section ────────────────────────────────────────────────────────────

function RosterSection({ enrollments, onEnrollClick }) {
  const count = enrollments.length

  return (
    <div className="border-t border-base-300 pt-4 mt-1">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">
          Enrolled Students
          <span className="ml-2 badge badge-sm badge-ghost">{count}</span>
        </h3>
      </div>

      {count === 0 ? (
        <div className="text-center py-6 text-base-content/40">
          <FaUserGraduate size={24} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No students enrolled</p>
          <button
            type="button"
            className="btn btn-ghost btn-xs mt-2 gap-1"
            onClick={onEnrollClick}
          >
            <FaUserPlus size={11} /> Enroll students
          </button>
        </div>
      ) : (
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {enrollments.map((e) => {
            const s = e.student
            if (!s) return null
            const name = s.preferred_name
              ? `${s.last_name}, ${s.preferred_name}`
              : `${s.last_name}, ${s.first_name}`
            return (
              <div key={e.id} className="flex items-center justify-between py-1 px-1 hover:bg-base-100 rounded text-sm">
                <span>{name}</span>
                {s.grade_level && (
                  <span className="text-xs text-base-content/40">Gr. {s.grade_level}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
