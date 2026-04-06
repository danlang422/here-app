import { useState, useEffect, useMemo, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import {
  PencilSimple, Check, X,
  ClipboardText, HandWaving, ListChecks,
  MapPin, DoorOpen, CalendarX, Student,
  Trash, CheckCircle,
} from '@phosphor-icons/react'
import { getBlocks, getBlockLabel, DAYS_OF_WEEK, WEEKDAYS } from '@/lib/constants'
import { useStaffUsers, useStudents } from '@/hooks/useUsers'
import { useActivityTerms, useAddActivityTerm, useRemoveActivityTerm } from '@/hooks/useActivityTerms'
import { useOrgEnrollments, useBulkEnrollStudents, useBulkUnenrollStudents, useUpdateEnrollment } from '@/hooks/useEnrollments'
import { cleanOrphanedEnrollmentDays } from '@/api/enrollments'
import { validateEnrollment } from '@/lib/enrollmentValidation'
import { formatUserName } from '@/api/users'
import useAuthStore from '@/store/authStore'
import StaffRows from './StaffRows'
import { buildStaffRows, staffRowsToFlat } from './staffUtils'

// ─── Behavior flag definitions ────────────────────────────────────────────────

const BEHAVIOR_FLAGS = [
  { field: 'requires_attendance',  icon: ClipboardText, tooltip: 'Requires attendance' },
  { field: 'requires_checkin',     icon: CheckCircle,   tooltip: 'Requires check-in' },
  { field: 'allows_presence_wave', icon: HandWaving,    tooltip: 'Allows presence wave' },
  { field: 'allows_freeform',      icon: ListChecks,    tooltip: 'Allows freeform tagging' },
  { field: 'requires_geofence',    icon: MapPin,        tooltip: 'Requires geofence' },
  { field: 'is_release',           icon: DoorOpen,      tooltip: 'Release (no attendance)' },
  { field: 'is_not_scheduled',     icon: CalendarX,     tooltip: 'Not scheduled' },
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
  calendar_id: null,
  recurrence_interval: 1,
  starting_week: 1,
}

// Derive the "starting week" (1-based) from an existing anchor date + start date.
// If either is missing, defaults to 1 (Week 1 = anchor is the start date).
function deriveStartingWeek(anchorDate, startDate) {
  if (!anchorDate || !startDate) return 1
  const anchor = new Date(anchorDate + 'T00:00:00')
  const start = new Date(startDate + 'T00:00:00')
  const diffDays = Math.round((anchor - start) / (1000 * 60 * 60 * 24))
  return Math.max(1, Math.round(diffDays / 7) + 1)
}

// Compute the anchor date string from a start date and starting week.
// Returns null when interval <= 1 (not needed) or start date is missing.
function computeAnchorDate(startDate, startingWeek, interval) {
  if (interval <= 1 || !startDate) return null
  const d = new Date(startDate + 'T00:00:00')
  d.setDate(d.getDate() + (startingWeek - 1) * 7)
  return d.toISOString().split('T')[0]
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
    calendar_id: activity.calendar_id ?? null,
    recurrence_interval: activity.recurrence_interval ?? 1,
    starting_week: deriveStartingWeek(activity.recurrence_anchor_date, activity.start_date),
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
 *   activity        - activity object (or null for new)
 *   mode            - 'view' | 'edit'
 *   saving          - boolean, disables save while pending
 *   orgSettings     - organization.settings object
 *   defaultTemplate - default schedule template (for block→time auto-fill)
 *   terms           - array of academic term objects (for term selector)
 *   orgId           - organization ID (for enrollment queries and term mutations)
 *   onSave          - called with form data on save
 *   onCancel        - called when edit is cancelled (returns to view)
 *   onEditClick     - called when edit pencil icon is clicked
 */
export default function ActivityDetail({
  activity = null,
  mode = 'view',
  saving = false,
  deleting = false,
  orgSettings = {},
  defaultTemplate = null,
  terms = [],
  calendars = [],
  orgId: orgIdProp = null,
  onSave,
  onCancel,
  onEditClick,
  onDelete,
}) {
  const profile = useAuthStore((s) => s.profile)
  const orgId = orgIdProp || profile?.organization_id
  const { data: staffUsers = [] } = useStaffUsers(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)

  const [orphanWarning, setOrphanWarning] = useState(null) // { data, removedDays, pendingSave }

  const blockCount = orgSettings?.block_count ?? null
  const blockLabels = orgSettings?.block_labels ?? null
  const blocks = useMemo(() => getBlocks(blockCount), [blockCount])
  const rotationDayNames = orgSettings?.rotation_day_names ?? ['A', 'B']

  const { register, handleSubmit, watch, setValue, reset, getValues } = useForm({
    defaultValues: buildInitialValues(activity),
  })

  const [staffRows, setStaffRows] = useState(() => buildStaffRows(activity))
  const [showDescription, setShowDescription] = useState(!!(activity?.description))
  const [pendingTerms, setPendingTerms] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Reset form, staff rows, and pending terms when activity changes
  useEffect(() => {
    reset(buildInitialValues(activity))
    setStaffRows(buildStaffRows(activity))
    setShowDescription(!!(activity?.description))
    setPendingTerms([])
    setShowDeleteConfirm(false)
  }, [activity?.id ?? 'new']) // eslint-disable-line react-hooks/exhaustive-deps

  const watchedIsNotScheduled = watch('is_not_scheduled')
  const watchedDaysOfWeek = watch('days_of_week')
  const watchedRotation = watch('rotation_day_type')
  const watchedName = watch('name')
  const watchedRecurrenceInterval = watch('recurrence_interval')

  // Clamp starting_week when interval drops below the current selection
  useEffect(() => {
    if (getValues('starting_week') > watchedRecurrenceInterval) {
      setValue('starting_week', 1)
    }
  }, [watchedRecurrenceInterval]) // eslint-disable-line react-hooks/exhaustive-deps

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
    // Mutual exclusion: allows_presence_wave ↔ requires_checkin
    if (field === 'allows_presence_wave' && next) setValue('requires_checkin', false)
    if (field === 'requires_checkin' && next) setValue('allows_presence_wave', false)
  }

  // Pending term handlers — used for new (unsaved) activities only
  function handleAddPendingTerm(term) {
    const isFirst = pendingTerms.length === 0
    setPendingTerms((prev) => [...prev, { termId: term.id, is_primary: isFirst, term }])
    if (isFirst && term.start_date && term.end_date) {
      if (!getValues('start_date') && !getValues('end_date')) {
        setValue('start_date', term.start_date)
        setValue('end_date', term.end_date)
      }
    }
  }

  function handleRemovePendingTerm(termId) {
    setPendingTerms((prev) => prev.filter((pt) => pt.termId !== termId))
  }

  // Block → time auto-fill from default template
  const watchedBlock = watch('block')
  useEffect(() => {
    if (mode !== 'edit' || !defaultTemplate?.block_definitions || watchedBlock === '') return
    const blockNum = parseInt(watchedBlock, 10)
    const def = defaultTemplate.block_definitions.find((d) => d.block === blockNum)
    if (!def) return
    const currentStart = getValues('default_start_time')
    const currentEnd = getValues('default_end_time')
    if (!currentStart && !currentEnd) {
      setValue('default_start_time', def.start_time)
      setValue('default_end_time', def.end_time)
      // Auto-fill duration if empty
      if (!getValues('duration_minutes') && def.start_time && def.end_time) {
        const [sh, sm] = def.start_time.split(':').map(Number)
        const [eh, em] = def.end_time.split(':').map(Number)
        const mins = (eh * 60 + em) - (sh * 60 + sm)
        if (mins > 0) setValue('duration_minutes', String(mins))
      }
    }
  }, [watchedBlock]) // eslint-disable-line react-hooks/exhaustive-deps

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
      duration_minutes: (formValues.default_start_time && formValues.default_end_time)
        ? null
        : (formValues.duration_minutes !== '' ? parseInt(formValues.duration_minutes, 10) : null),
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
      calendar_id: formValues.calendar_id || null,
      recurrence_interval: formValues.recurrence_interval,
      recurrence_anchor_date: computeAnchorDate(formValues.start_date, formValues.starting_week, formValues.recurrence_interval),
      // For new activities: carry pending terms to the parent for post-create insertion
      ...(!activity ? { _pendingTerms: pendingTerms } : {}),
    }

    // Check for orphaned enrollment days before saving
    if (activity?.id && activity?.days_of_week) {
      const newDays = data.days_of_week ?? []
      const removedDays = activity.days_of_week.filter((d) => !newDays.includes(d))
      if (removedDays.length > 0) {
        const affected = orgEnrollments.filter(
          (e) => e.activity_id === activity.id &&
            e.days_of_week?.some((d) => removedDays.includes(d))
        )
        if (affected.length > 0) {
          setOrphanWarning({ data, removedDays, affectedCount: affected.length })
          return
        }
      }
    }

    onSave?.(data)
  }

  async function handleOrphanConfirm() {
    if (!orphanWarning) return
    const { data, removedDays } = orphanWarning
    setOrphanWarning(null)
    onSave?.(data)
    // Clean up orphaned enrollment days after activity save
    if (activity?.id) {
      try {
        await cleanOrphanedEnrollmentDays(activity.id, removedDays)
      } catch (err) {
        console.error('Failed to clean orphaned enrollment days:', err)
      }
    }
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
          {mode === 'view' ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={onEditClick}
              title="Edit"
            >
              <PencilSimple size={13} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle text-base-content/60"
                onClick={onCancel}
                title="Cancel"
              >
                <X size={14} />
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm btn-circle"
                disabled={saving || !watchedName?.trim()}
                title="Save"
              >
                {saving
                  ? <span className="loading loading-spinner loading-xs" />
                  : <Check size={12} />
                }
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Properties tray: behavior flags ── */}
      <div className="bg-base-200 rounded-lg px-4 py-3 w-fit">
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

        {/* Location — full width, above staff */}
        {mode === 'view' ? (
          activity?.location ? (
            <span className="text-sm text-base-content/70">{activity.location}</span>
          ) : null
        ) : (
          <div>
            <label className="label-text text-xs text-base-content/50 mb-1 block">Location</label>
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              placeholder="Room, building, or address"
              {...register('location')}
            />
          </div>
        )}

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

        {/* Calendar */}
        {mode === 'view' ? (
          activity?.calendar && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="inline-block w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: activity.calendar.color }}
              />
              <span className="text-base-content/70">{activity.calendar.name}</span>
            </div>
          )
        ) : (
          <div>
            <label className="label-text text-xs text-base-content/50 mb-1 block">Calendar</label>
            <select className="select select-bordered select-sm w-full" {...register('calendar_id')}>
              <option value="">Unassigned</option>
              {calendars.map((cal) => (
                <option key={cal.id} value={cal.id}>{cal.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Block / Time / Duration */}
        <div>
          {mode === 'view' ? (
            <SchedulingView activity={activity} blockLabels={blockLabels} />
          ) : (
            <SchedulingEdit
              register={register}
              watch={watch}
              setValue={setValue}
              blocks={blocks}
              blockLabels={blockLabels}
              disabled={watchedIsNotScheduled}
              daysSelected={daysSelected}
              rotationSelected={rotationSelected}
              rotationDayNames={rotationDayNames}
              watchedDaysOfWeek={watchedDaysOfWeek}
              watchedRotation={watchedRotation}
              onDayToggle={handleDayToggle}
              onRotationChange={handleRotationChange}
              watchedStartTime={watch('default_start_time')}
              watchedEndTime={watch('default_end_time')}
              watchedRecurrenceInterval={watchedRecurrenceInterval}
            />
          )}
        </div>

        {/* Term + Dates */}
        <div>
          {mode === 'view' ? (
            <DatesView activity={activity} />
          ) : (
            <DatesEdit
              register={register} setValue={setValue} getValues={getValues}
              activity={activity} terms={terms} orgId={orgId}
              pendingTerms={pendingTerms}
              onAddPendingTerm={handleAddPendingTerm}
              onRemovePendingTerm={handleRemovePendingTerm}
            />
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

      {/* ── Orphaned enrollment warning ── */}
      {orphanWarning && (
        <div className="bg-warning/10 border border-warning/40 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium">
            Removing these days affects {orphanWarning.affectedCount} student enrollment{orphanWarning.affectedCount !== 1 ? 's' : ''}.
          </p>
          <p className="text-xs text-base-content/60">
            Enrollment day schedules will be adjusted to remove the days you&apos;re deleting. Students with no remaining days will be deactivated and need re-enrollment.
          </p>
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn btn-warning btn-sm" onClick={handleOrphanConfirm}>
              Save and adjust
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOrphanWarning(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Inline enrollment section ── */}
      <InlineEnrollmentSection key={activity?.id ?? 'new'} activity={activity} orgId={orgId} orgSettings={orgSettings} />

      {/* ── Delete — only for existing activities in edit mode ── */}
      {mode === 'edit' && activity?.id && onDelete && (
        <div className="border-t border-base-300 pt-4 mt-1">
          {showDeleteConfirm ? (
            <div className="bg-error/10 border border-error/30 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-error">
                Delete &ldquo;{activity.name}&rdquo;?
              </p>
              <p className="text-xs text-base-content/60">
                This will permanently remove all associated enrollments, attendance records, and other data.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-error btn-sm"
                  disabled={deleting}
                  onClick={() => onDelete(activity.id)}
                >
                  {deleting
                    ? <span className="loading loading-spinner loading-xs" />
                    : 'Delete permanently'
                  }
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={deleting}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-xs text-error/60 hover:text-error gap-1"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash size={11} /> Delete activity
            </button>
          )}
        </div>
      )}
    </form>
  )
}

// ─── Scheduling view/edit sub-components ──────────────────────────────────────

function SchedulingView({ activity, blockLabels }) {
  if (activity?.is_not_scheduled) {
    return <span className="text-sm text-base-content/40 italic">Not scheduled</span>
  }

  const parts = []
  if (activity?.block != null) parts.push(getBlockLabel(activity.block, blockLabels))

  const timeParts = []
  if (activity?.default_start_time) timeParts.push(formatTime(activity.default_start_time))
  if (activity?.default_end_time) timeParts.push(formatTime(activity.default_end_time))
  if (timeParts.length) {
    parts.push(timeParts.join('–'))
  } else if (activity?.duration_minutes) {
    parts.push(`${activity.duration_minutes} min (planned)`)
  }

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
  register, blocks, blockLabels, disabled,
  daysSelected, rotationSelected, rotationDayNames,
  watchedDaysOfWeek, watchedRotation,
  onDayToggle, onRotationChange,
  watchedStartTime, watchedEndTime,
  watchedRecurrenceInterval,
}) {
  const hasTimesSet = !!(watchedStartTime && watchedEndTime)
  const computedDuration = hasTimesSet
    ? (() => {
        const [sh, sm] = watchedStartTime.split(':').map(Number)
        const [eh, em] = watchedEndTime.split(':').map(Number)
        const mins = (eh * 60 + em) - (sh * 60 + sm)
        return mins > 0 ? mins : null
      })()
    : null

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
                <option key={b} value={b}>{getBlockLabel(b, blockLabels)}</option>
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
          <label className="label-text text-xs text-base-content/50 mb-1 block">
            {hasTimesSet ? 'Duration' : 'Planned Duration (min)'}
          </label>
          {hasTimesSet ? (
            <span className="text-sm text-base-content/70">
              {computedDuration != null ? `${computedDuration} min` : '—'}
            </span>
          ) : (
            <>
              <input
                type="number"
                className="input input-bordered input-sm w-full"
                min="1"
                placeholder="e.g. 90"
                {...register('duration_minutes', { min: 1 })}
                disabled={disabled}
              />
              <p className="text-xs text-base-content/40 mt-0.5">How long this activity needs when scheduled</p>
            </>
          )}
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

      {/* Recurrence interval — only shown when days or rotation is set */}
      {(daysSelected || rotationSelected) && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="label-text text-xs text-base-content/50 whitespace-nowrap">
              Repeats every
            </label>
            <select
              className="select select-bordered select-sm w-20"
              {...register('recurrence_interval', { valueAsNumber: true })}
              disabled={disabled}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="label-text text-xs text-base-content/50">week(s)</span>
          </div>

          {/* Starting week — only shown when interval > 1 */}
          {watchedRecurrenceInterval > 1 && (
            <div className="flex items-center gap-2">
              <label className="label-text text-xs text-base-content/50 whitespace-nowrap">
                starting week
              </label>
              <select
                className="select select-bordered select-sm w-16"
                {...register('starting_week', { valueAsNumber: true })}
                disabled={disabled}
              >
                {Array.from({ length: watchedRecurrenceInterval }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DatesView({ activity }) {
  const { data: liveTerms } = useActivityTerms(activity?.id)
  // Fall back to the joined data from the activities query on first render
  const activityTerms = liveTerms ?? activity?.activity_terms ?? []
  const parts = []

  if (activityTerms.length > 0) {
    const termNames = activityTerms
      .map((at) => at.term?.name)
      .filter(Boolean)
      .join(', ')
    if (termNames) parts.push(termNames)
  }

  const dateParts = []
  if (activity?.start_date) dateParts.push(formatDate(activity.start_date))
  if (activity?.end_date) dateParts.push(formatDate(activity.end_date))
  if (dateParts.length) parts.push(dateParts.join(' – '))

  if (!parts.length) return null
  return <span className="text-sm text-base-content/70">{parts.join(' · ')}</span>
}

function DatesEdit({ register, setValue, getValues, activity, terms, orgId, pendingTerms, onAddPendingTerm, onRemovePendingTerm }) {
  const isNew = !activity?.id

  // For existing activities: live query + immediate mutations
  const { data: savedTerms = [] } = useActivityTerms(activity?.id)
  const addMutation = useAddActivityTerm(activity?.id, orgId)
  const removeMutation = useRemoveActivityTerm(activity?.id, orgId)

  // Displayed terms depend on whether this is a new or existing activity
  const activityTerms = isNew ? pendingTerms : savedTerms

  const availableTerms = terms.filter((t) =>
    !activityTerms.some((at) => (isNew ? at.termId : at.term_id) === t.id)
  )

  function handleAddTerm(termId) {
    const term = terms.find((t) => t.id === termId)
    if (!term) return

    if (isNew) {
      onAddPendingTerm(term)
    } else {
      const isFirst = savedTerms.length === 0
      addMutation.mutate(
        { termId, isPrimary: isFirst },
        {
          onSuccess: (newAssoc) => {
            if (isFirst) {
              const t = newAssoc.term
              if (t?.start_date && t?.end_date) {
                if (!getValues('start_date') && !getValues('end_date')) {
                  setValue('start_date', t.start_date)
                  setValue('end_date', t.end_date)
                }
              }
            }
          },
        }
      )
    }
  }

  function handleRemoveTerm(at) {
    if (isNew) {
      onRemovePendingTerm(at.termId)
    } else {
      removeMutation.mutate(at.id)
    }
  }

  return (
    <div className="space-y-3">
      {/* Term tags */}
      <div>
        <label className="label-text text-xs text-base-content/50 mb-1 block">Terms</label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {activityTerms.map((at) => (
            <span key={isNew ? at.termId : at.id} className="badge badge-sm gap-1">
              {at.term?.name}
              {at.is_primary && <span className="text-[9px] opacity-50">(primary)</span>}
              <button
                type="button"
                className="text-base-content/40 hover:text-error"
                onClick={() => handleRemoveTerm(at)}
              >
                ✕
              </button>
            </span>
          ))}

          {availableTerms.length > 0 && (
            <select
              className="select select-bordered select-xs"
              value=""
              onChange={(e) => {
                if (e.target.value) handleAddTerm(e.target.value)
              }}
            >
              <option value="">+ Add term</option>
              {availableTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_current ? ' (current)' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">Start Date</label>
          <input type="date" className="input input-bordered input-sm w-full" {...register('start_date')} />
        </div>
        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">End Date</label>
          <input type="date" className="input input-bordered input-sm w-full" {...register('end_date')} />
        </div>
      </div>
    </div>
  )
}

// ─── Inline enrollment section ─────────────────────────────────────────────────

function InlineEnrollmentSection({ activity, orgId, orgSettings = {} }) {
  const activityId = activity?.id
  const isNew = !activityId

  const { data: students = [] } = useStudents(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)
  const enrollMutation = useBulkEnrollStudents()
  const unenrollMutation = useBulkUnenrollStudents()
  const updateEnrollmentMutation = useUpdateEnrollment()

  const [stagedStudentIds, setStagedStudentIds] = useState(new Set())
  const [unstagedEnrollmentIds, setUnstagedEnrollmentIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [submitPhase, setSubmitPhase] = useState('ready') // 'ready' | 'confirm' | 'done'
  const [submitResult, setSubmitResult] = useState(null)
  // Per-enrollment schedule editing state
  const [expandedEnrollmentId, setExpandedEnrollmentId] = useState(null)
  const [localSchedules, setLocalSchedules] = useState(new Map()) // enrollmentId → draft

  // Activity enrollments from org cache
  const activityEnrollments = useMemo(
    () => (activityId ? orgEnrollments.filter((e) => e.activity_id === activityId) : []),
    [orgEnrollments, activityId]
  )

  const enrolledStudentIds = useMemo(
    () => new Set(activityEnrollments.map((e) => e.student_id)),
    [activityEnrollments]
  )

  const enrollmentByStudentId = useMemo(() => {
    const map = new Map()
    for (const e of activityEnrollments) map.set(e.student_id, e)
    return map
  }, [activityEnrollments])

  // Conflict map: studentId → { hasConflict, conflicts }
  const conflictMap = useMemo(() => {
    const map = new Map()
    if (!activity) return map
    for (const student of students) {
      const studentEnrollments = orgEnrollments.filter(
        (e) => e.student_id === student.id && e.activity_id !== activityId
      )
      // Use the student's actual enrollment schedule for this activity (if enrolled)
      // so conflict detection sees the narrowed effective schedule, not the full activity schedule.
      const thisEnrollment = enrollmentByStudentId.get(student.id)
      const enrollmentSchedule = thisEnrollment
        ? {
            days_of_week: thisEnrollment.days_of_week,
            rotation_day_type: thisEnrollment.rotation_day_type,
            recurrence_interval: thisEnrollment.recurrence_interval,
            recurrence_anchor_date: thisEnrollment.recurrence_anchor_date,
          }
        : null
      const result = validateEnrollment(activity, enrollmentSchedule, studentEnrollments)
      if (result.conflicts.length > 0) {
        map.set(student.id, { hasConflict: true, conflicts: result.conflicts })
      }
    }
    return map
  }, [activity, activityId, orgEnrollments, students, enrollmentByStudentId])

  // Grade options for filter
  const gradeOptions = useMemo(() => {
    const grades = new Set(students.map((s) => s.grade_level).filter(Boolean))
    return Array.from(grades).sort((a, b) => a - b)
  }, [students])

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const name = `${s.first_name} ${s.last_name} ${s.preferred_name || ''}`.toLowerCase()
        if (!name.includes(q)) return false
      }
      if (gradeFilter && String(s.grade_level) !== gradeFilter) return false
      return true
    })
  }, [students, searchQuery, gradeFilter])

  // Partition into enrolled (left) / available (right)
  const { enrolledStudents, availableStudents } = useMemo(() => {
    const enrolled = []
    const available = []

    for (const student of filteredStudents) {
      const isEnrolled = enrolledStudentIds.has(student.id)
      const isNewlyStaged = stagedStudentIds.has(student.id)
      const enrollment = enrollmentByStudentId.get(student.id)
      const isPendingUnenroll = enrollment && unstagedEnrollmentIds.has(enrollment.id)

      if (isPendingUnenroll) {
        available.push({ ...student, pendingUnenroll: true, enrollmentId: enrollment.id })
      } else if (isEnrolled || isNewlyStaged) {
        enrolled.push({ ...student, isNewlyStaged: !isEnrolled })
      } else {
        available.push({ ...student, pendingUnenroll: false })
      }
    }

    enrolled.sort((a, b) => {
      if (a.isNewlyStaged !== b.isNewlyStaged) return a.isNewlyStaged ? 1 : -1
      return (a.last_name || '').localeCompare(b.last_name || '')
    })
    available.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))

    return { enrolledStudents: enrolled, availableStudents: available }
  }, [filteredStudents, enrolledStudentIds, stagedStudentIds, unstagedEnrollmentIds, enrollmentByStudentId])

  const hasChanges = stagedStudentIds.size > 0 || unstagedEnrollmentIds.size > 0

  // Submit summary
  const submitSummary = useMemo(() => {
    const clean = []
    const conflicted = []
    for (const studentId of stagedStudentIds) {
      const conflict = conflictMap.get(studentId)
      if (conflict?.hasConflict) {
        conflicted.push({ studentId, conflicts: conflict.conflicts })
      } else {
        clean.push(studentId)
      }
    }
    return { clean, conflicted, unenrollIds: Array.from(unstagedEnrollmentIds) }
  }, [stagedStudentIds, conflictMap, unstagedEnrollmentIds])

  const handleStageStudent = useCallback((studentId) => {
    setStagedStudentIds((prev) => { const next = new Set(prev); next.add(studentId); return next })
    setSubmitPhase('ready')
  }, [])

  const handleUnstageStudent = useCallback((studentId) => {
    const enrollment = enrollmentByStudentId.get(studentId)
    if (enrollment) {
      setUnstagedEnrollmentIds((prev) => { const next = new Set(prev); next.add(enrollment.id); return next })
    } else {
      setStagedStudentIds((prev) => { const next = new Set(prev); next.delete(studentId); return next })
    }
    setSubmitPhase('ready')
  }, [enrollmentByStudentId])

  const handleRestageStudent = useCallback((enrollmentId) => {
    setUnstagedEnrollmentIds((prev) => { const next = new Set(prev); next.delete(enrollmentId); return next })
    setSubmitPhase('ready')
  }, [])

  function handleSubmitClick() {
    if (submitPhase === 'ready') setSubmitPhase('confirm')
  }

  async function handleConfirm() {
    const { clean, conflicted, unenrollIds } = submitSummary
    const allToEnroll = [...clean, ...conflicted.map((c) => c.studentId)]
    try {
      const promises = []
      if (allToEnroll.length > 0) {
        promises.push(enrollMutation.mutateAsync(
          allToEnroll.map((studentId) => ({
            student_id: studentId,
            activity_id: activityId,
            block: activity?.block ?? null,
          }))
        ))
      }
      if (unenrollIds.length > 0) {
        promises.push(unenrollMutation.mutateAsync(unenrollIds))
      }
      await Promise.all(promises)
      setSubmitResult({
        enrolled: allToEnroll.length,
        enrolledWithConflicts: conflicted.length,
        unenrolled: unenrollIds.length,
      })
      setStagedStudentIds(new Set())
      setUnstagedEnrollmentIds(new Set())
      setSubmitPhase('done')
    } catch {
      // Error surfaced via mutation.error
    }
  }

  function handleBack() {
    setSubmitPhase('ready')
  }

  const isSubmitting = enrollMutation.isPending || unenrollMutation.isPending
  const submitError = enrollMutation.error || unenrollMutation.error
  const interactionDisabled = submitPhase !== 'ready'

  return (
    <div className="border-t border-base-300 pt-4 mt-1">
      <h3 className="font-semibold text-sm mb-3">
        Enrolled Students
        {!isNew && (
          <span className="ml-2 badge badge-sm badge-ghost">{enrolledStudents.length}</span>
        )}
      </h3>

      {isNew ? (
        <div className="text-center py-6 text-base-content/40">
          <Student size={24} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Save activity to enroll students.</p>
        </div>
      ) : (
        <>
          {/* Search + grade filter */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              className="input input-bordered input-xs flex-1"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {gradeOptions.length > 0 && (
              <select
                className="select select-bordered select-xs"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
              >
                <option value="">All grades</option>
                {gradeOptions.map((g) => (
                  <option key={g} value={String(g)}>Gr. {g}</option>
                ))}
              </select>
            )}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-2 gap-3">
            {/* Left: Enrolled */}
            <div>
              <div className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1">
                Enrolled ({enrolledStudents.length})
              </div>
              <div className="border border-base-300 rounded-lg overflow-y-auto" style={{ height: '180px' }}>
                {enrolledStudents.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-base-content/30">
                    None enrolled
                  </div>
                ) : (
                  enrolledStudents.map((student) => {
                    const enrollment = enrollmentByStudentId.get(student.id)
                    const isExpanded = enrollment && expandedEnrollmentId === enrollment.id
                    return (
                      <EnrollmentStudentRow
                        key={student.id}
                        student={student}
                        zone="enrolled"
                        conflict={conflictMap.get(student.id)}
                        enrollment={enrollment ?? null}
                        activity={activity}
                        orgSettings={orgSettings}
                        isExpanded={isExpanded}
                        localSchedule={enrollment ? (localSchedules.get(enrollment.id) ?? null) : null}
                        onToggleExpand={() => {
                          if (!enrollment) return
                          setExpandedEnrollmentId(isExpanded ? null : enrollment.id)
                        }}
                        onScheduleChange={(field, value) => {
                          if (!enrollment) return
                          setLocalSchedules((prev) => {
                            const next = new Map(prev)
                            next.set(enrollment.id, { ...(prev.get(enrollment.id) ?? {}), [field]: value })
                            return next
                          })
                        }}
                        onScheduleSave={async () => {
                          if (!enrollment) return
                          const draft = localSchedules.get(enrollment.id) ?? {}
                          await updateEnrollmentMutation.mutateAsync({ id: enrollment.id, ...draft })
                          setLocalSchedules((prev) => { const next = new Map(prev); next.delete(enrollment.id); return next })
                          setExpandedEnrollmentId(null)
                        }}
                        onScheduleCancel={() => {
                          if (!enrollment) return
                          setLocalSchedules((prev) => { const next = new Map(prev); next.delete(enrollment.id); return next })
                          setExpandedEnrollmentId(null)
                        }}
                        onClick={() => handleUnstageStudent(student.id)}
                        disabled={interactionDisabled}
                      />
                    )
                  })
                )}
              </div>
            </div>

            {/* Right: Available */}
            <div>
              <div className="text-xs font-semibold text-base-content/50 uppercase tracking-wide mb-1">
                Available ({availableStudents.length})
              </div>
              <div className="border border-base-300 rounded-lg overflow-y-auto" style={{ height: '180px' }}>
                {availableStudents.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-base-content/30">
                    All enrolled
                  </div>
                ) : (
                  availableStudents.map((student) => (
                    <EnrollmentStudentRow
                      key={student.id}
                      student={student}
                      zone="available"
                      conflict={conflictMap.get(student.id)}
                      onClick={() =>
                        student.pendingUnenroll
                          ? handleRestageStudent(student.enrollmentId)
                          : handleStageStudent(student.id)
                      }
                      disabled={interactionDisabled}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Action footer */}
          <InlineEnrollmentFooter
            submitPhase={submitPhase}
            hasChanges={hasChanges}
            submitSummary={submitSummary}
            submitResult={submitResult}
            submitError={submitError}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmitClick}
            onConfirm={handleConfirm}
            onBack={handleBack}
          />
        </>
      )}
    </div>
  )
}

// ─── EnrollmentStudentRow ───────────────────────────────────────────────────────

function EnrollmentStudentRow({
  student, zone, conflict, onClick, disabled,
  // Schedule editor props (enrolled zone only)
  enrollment = null, activity = null, orgSettings = {},
  isExpanded = false, localSchedule = null,
  onToggleExpand, onScheduleChange, onScheduleSave, onScheduleCancel,
}) {
  const isPendingUnenroll = student.pendingUnenroll
  const canEdit = zone === 'enrolled' && !student.isNewlyStaged && !isPendingUnenroll && enrollment && activity?.days_of_week?.length > 0

  // Compute collapsed schedule summary from current enrollment fields (or local draft)
  const effectiveEnrollment = localSchedule
    ? { ...enrollment, ...localSchedule }
    : enrollment
  const scheduleSummary = canEdit ? getEnrollmentScheduleSummary(effectiveEnrollment, activity) : null

  return (
    <div className={isPendingUnenroll ? 'bg-error/10' : ''}>
      {/* Main row */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={[
          'w-full text-left px-2 py-1.5 flex items-center gap-2 transition-colors text-sm',
          disabled ? 'opacity-60 cursor-default' : 'cursor-pointer hover:bg-base-200',
        ].join(' ')}
        onClick={disabled ? undefined : onClick}
        onKeyDown={disabled ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {zone === 'available' && !isPendingUnenroll && conflict?.hasConflict && (
              <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" title="Has same-block enrollment — may need day adjustment" />
            )}
            <span className="text-sm truncate">{formatUserName(student)}</span>
            {student.grade_level && (
              <span className="text-xs text-base-content/40 flex-shrink-0">{student.grade_level}</span>
            )}
          </div>
          {zone === 'enrolled' && conflict?.hasConflict && (
            <div className="text-xs text-warning mt-0.5">
              {conflict.conflicts.map((c, i) => (
                <div key={i}>Conflicts with {c.activity.name}{c.activity.block != null && ` — ${getBlockLabel(c.activity.block)}`}</div>
              ))}
            </div>
          )}
          {isPendingUnenroll && (
            <div className="text-xs text-error mt-0.5">Will be unenrolled</div>
          )}
          {scheduleSummary && (
            <div className="text-xs text-base-content/40 mt-0.5">{scheduleSummary}</div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {canEdit && !disabled && (
            <button
              type="button"
              className="btn btn-ghost btn-xs px-1 text-base-content/40 hover:text-base-content"
              title="Edit schedule"
              onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
            >
              <PencilSimple size={12} />
            </button>
          )}
          <span className="text-base-content/30 text-xs">
            {zone === 'available' && !isPendingUnenroll && '+'}
            {zone === 'enrolled' && '−'}
            {isPendingUnenroll && '↩'}
          </span>
        </div>
      </div>

      {/* Inline schedule editor */}
      {isExpanded && canEdit && (
        <EnrollmentScheduleEditor
          enrollment={effectiveEnrollment}
          activity={activity}
          orgSettings={orgSettings}
          localSchedule={localSchedule ?? {}}
          onChange={onScheduleChange}
          onSave={onScheduleSave}
          onCancel={onScheduleCancel}
        />
      )}
    </div>
  )
}

// Build a compact text summary of a student's enrollment schedule.
// Returns null when the enrollment follows the activity (all null fields — most enrollments).
function getEnrollmentScheduleSummary(enrollment, activity) {
  if (!enrollment || !activity) return null
  const hasDays = enrollment.days_of_week != null
  const hasRotation = enrollment.rotation_day_type != null
  const hasRecurrence = enrollment.recurrence_interval != null && enrollment.recurrence_interval > 1

  if (!hasDays && !hasRotation && !hasRecurrence) return null

  const parts = []
  if (hasRecurrence) parts.push(`Every ${enrollment.recurrence_interval} wks`)
  if (hasRotation) parts.push(`${enrollment.rotation_day_type} days`)
  if (hasDays) {
    const labels = enrollment.days_of_week
      .map((v) => DAYS_OF_WEEK.find((d) => d.value === v)?.short ?? v)
      .join(' ')
    parts.push(labels)
  }
  return parts.join(' · ') || null
}

// ─── EnrollmentScheduleEditor ──────────────────────────────────────────────────

function EnrollmentScheduleEditor({ enrollment, activity, orgSettings, localSchedule, onChange, onSave, onCancel }) {
  const rotationDayNames = orgSettings?.rotation_day_names ?? ['A', 'B']

  // The days the activity runs — only these are valid options
  const activityDays = activity?.days_of_week ?? []
  // Effective days for this enrollment (local draft takes precedence)
  const effectiveDays = localSchedule.days_of_week !== undefined
    ? localSchedule.days_of_week
    : (enrollment.days_of_week ?? null)

  // Effective rotation for this enrollment
  const effectiveRotation = localSchedule.rotation_day_type !== undefined
    ? localSchedule.rotation_day_type
    : (enrollment.rotation_day_type ?? null)

  // Show rotation control only when the activity doesn't fix a rotation
  const showRotation = activity?.rotation_day_type == null && rotationDayNames.length > 0

  const activityRecurrence = activity?.recurrence_interval ?? 1

  // Effective recurrence interval for this enrollment (local draft > saved > activity default)
  const effectiveRecurrenceInterval = (() => {
    if (localSchedule.recurrence_interval !== undefined) return localSchedule.recurrence_interval ?? activityRecurrence
    return enrollment.recurrence_interval ?? activityRecurrence
  })()

  // Activity start date for anchor computation
  const activityStartDate = activity?.start_date ?? null

  // Derive starting week from current anchor date
  const effectiveAnchorDate = localSchedule.recurrence_anchor_date !== undefined
    ? localSchedule.recurrence_anchor_date
    : (enrollment.recurrence_anchor_date ?? null)
  const effectiveStartingWeek = deriveStartingWeek(effectiveAnchorDate, activityStartDate)

  function handleDayToggle(dayValue) {
    const current = effectiveDays ?? activityDays
    const next = current.includes(dayValue)
      ? current.filter((d) => d !== dayValue)
      : [...current, dayValue].sort((a, b) => a - b)
    // If all activity days are selected, revert to null (follow activity)
    const isAllDays = activityDays.length > 0 && activityDays.every((d) => next.includes(d)) && next.length === activityDays.length
    onChange('days_of_week', isAllDays ? null : next)
  }

  return (
    <div className="mx-2 mb-2 px-2 py-2 bg-base-200 rounded text-xs space-y-2">
      {/* Day pills */}
      {activityDays.length > 0 && (
        <div>
          <div className="text-base-content/50 mb-1">Days</div>
          <div className="flex gap-1 flex-wrap">
            {activityDays.map((dayVal) => {
              const day = DAYS_OF_WEEK.find((d) => d.value === dayVal)
              const isActive = effectiveDays == null
                ? true // null = follows activity = all activity days active
                : effectiveDays.includes(dayVal)
              return (
                <button
                  key={dayVal}
                  type="button"
                  className={`btn btn-xs min-w-8 ${isActive ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => handleDayToggle(dayVal)}
                >
                  {day?.short ?? dayVal}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Rotation control */}
      {showRotation && (
        <div>
          <div className="text-base-content/50 mb-1">Rotation</div>
          <div className="flex gap-1">
            <button
              type="button"
              className={`btn btn-xs ${effectiveRotation == null ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onChange('rotation_day_type', null)}
            >
              Both
            </button>
            {rotationDayNames.map((name) => (
              <button
                key={name}
                type="button"
                className={`btn btn-xs ${effectiveRotation === name ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => onChange('rotation_day_type', name)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recurrence controls */}
      <div>
        <div className="text-base-content/50 mb-1">Repeats every</div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="select select-bordered select-xs w-16"
            value={effectiveRecurrenceInterval}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              const isDefault = val === activityRecurrence
              onChange('recurrence_interval', isDefault ? null : val)
              if (val <= 1 || isDefault) {
                onChange('recurrence_anchor_date', null)
              }
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="text-base-content/50">week(s)</span>

          {effectiveRecurrenceInterval > 1 && (
            <>
              <span className="text-base-content/50 ml-1">starting week</span>
              <select
                className="select select-bordered select-xs w-14"
                value={effectiveStartingWeek}
                onChange={(e) => {
                  const week = parseInt(e.target.value, 10)
                  const anchor = computeAnchorDate(activityStartDate, week, effectiveRecurrenceInterval)
                  onChange('recurrence_anchor_date', anchor)
                }}
              >
                {Array.from({ length: effectiveRecurrenceInterval }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-1">
        <button type="button" className="btn btn-xs btn-primary" onClick={onSave}>
          Save
        </button>
        <button type="button" className="btn btn-xs btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── InlineEnrollmentFooter ─────────────────────────────────────────────────────

function InlineEnrollmentFooter({
  submitPhase, hasChanges, submitSummary, submitResult,
  submitError, isSubmitting, onSubmit, onConfirm, onBack,
}) {
  if (submitPhase === 'done' && submitResult) {
    return (
      <div className="mt-3 pt-3 border-t border-base-300 text-sm space-y-0.5">
        {submitResult.enrolled > 0 && (
          <div className="text-success">{submitResult.enrolled} enrolled</div>
        )}
        {submitResult.enrolledWithConflicts > 0 && (
          <div className="text-warning">
            {submitResult.enrolledWithConflicts} enrolled with conflicts — adjust their days below
          </div>
        )}
        {submitResult.unenrolled > 0 && (
          <div className="text-error">{submitResult.unenrolled} unenrolled</div>
        )}
        <button type="button" className="btn btn-ghost btn-xs mt-1" onClick={onBack}>
          Make more changes
        </button>
      </div>
    )
  }

  if (submitPhase === 'confirm') {
    return (
      <div className="mt-3 pt-3 border-t border-base-300">
        <div className="text-sm mb-2">
          {submitSummary.clean.length > 0 && (
            <div>{submitSummary.clean.length} student{submitSummary.clean.length !== 1 ? 's' : ''} to enroll</div>
          )}
          {submitSummary.conflicted.length > 0 && (
            <div className="text-warning">
              {submitSummary.conflicted.length} student{submitSummary.conflicted.length !== 1 ? 's' : ''} with scheduling conflicts — adjust days after enrolling
            </div>
          )}
          {submitSummary.unenrollIds.length > 0 && (
            <div className="text-error">
              {submitSummary.unenrollIds.length} student{submitSummary.unenrollIds.length !== 1 ? 's' : ''} to unenroll
            </div>
          )}
        </div>
        {submitError && <div className="text-error text-xs mb-2">{submitError.message}</div>}
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={onBack} disabled={isSubmitting}>
            Back
          </button>
          <button type="button" className="btn btn-primary btn-sm flex-1" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? <span className="loading loading-spinner loading-xs" /> : 'Confirm'}
          </button>
        </div>
      </div>
    )
  }

  // Ready phase
  return (
    <div className="mt-3 pt-3 border-t border-base-300">
      {hasChanges ? (
        <div className="flex items-center justify-between">
          <div className="text-sm text-base-content/60">
            {submitSummary.clean.length + submitSummary.conflicted.length > 0 && (
              <span>{submitSummary.clean.length + submitSummary.conflicted.length} to enroll</span>
            )}
            {submitSummary.unenrollIds.length > 0 && (
              <span>
                {submitSummary.clean.length + submitSummary.conflicted.length > 0 && ', '}
                {submitSummary.unenrollIds.length} to unenroll
              </span>
            )}
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={onSubmit}>
            {submitSummary.unenrollIds.length > 0 && submitSummary.clean.length + submitSummary.conflicted.length > 0
              ? 'Save Changes'
              : submitSummary.unenrollIds.length > 0
                ? 'Unenroll'
                : 'Enroll'
            }
          </button>
        </div>
      ) : (
        <div className="text-sm text-base-content/40 text-center py-1">
          Click students to stage enrollment changes
        </div>
      )}
    </div>
  )
}
