import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FaPlus, FaTimes, FaTrash } from 'react-icons/fa'
import useAuthStore from '@/store/authStore'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useDefaultScheduleTemplate } from '@/hooks/useScheduleTemplate'
import { useTerms } from '@/hooks/useTerms'
import { updateOrgSettings } from '@/api/organizations'
import { upsertDefaultTemplate } from '@/api/scheduleTemplates'
import { createTerm, updateTerm, deleteTerm, setCurrentTerm } from '@/api/terms'
import { getBlocks } from '@/lib/constants'

// ─── Block Schedule Section ──────────────────────────────────────────────────

function BlockScheduleSection({ orgSettings, defaultTemplate, orgId }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmReduce, setConfirmReduce] = useState(null)

  const initialCount = orgSettings?.block_count ?? 6
  const initialLabels = orgSettings?.block_labels ?? []
  const initialDefs = defaultTemplate?.block_definitions ?? []

  const [blockCount, setBlockCount] = useState(initialCount)
  const [blockLabels, setBlockLabels] = useState(() =>
    Array.from({ length: initialCount }, (_, i) => initialLabels[i] || '')
  )
  const [blockTimes, setBlockTimes] = useState(() =>
    Array.from({ length: initialCount }, (_, i) => {
      const def = initialDefs.find((d) => d.block === i)
      return { start_time: def?.start_time || '', end_time: def?.end_time || '' }
    })
  )

  // Sync from server when data loads
  useEffect(() => {
    const count = orgSettings?.block_count ?? 6
    const labels = orgSettings?.block_labels ?? []
    const defs = defaultTemplate?.block_definitions ?? []
    setBlockCount(count)
    setBlockLabels(Array.from({ length: count }, (_, i) => labels[i] || ''))
    setBlockTimes(Array.from({ length: count }, (_, i) => {
      const def = defs.find((d) => d.block === i)
      return { start_time: def?.start_time || '', end_time: def?.end_time || '' }
    }))
  }, [orgSettings?.block_count, orgSettings?.block_labels, defaultTemplate?.block_definitions])

  function handleCountChange(newCount) {
    const n = parseInt(newCount, 10)
    if (isNaN(n) || n < 1) return

    if (n < blockCount) {
      const removed = Array.from({ length: blockCount - n }, (_, i) => n + i)
      setConfirmReduce({ newCount: n, removed })
      return
    }

    applyCountChange(n)
  }

  function applyCountChange(n) {
    setBlockCount(n)
    setBlockLabels((prev) => {
      const next = Array.from({ length: n }, (_, i) => prev[i] || '')
      return next
    })
    setBlockTimes((prev) => {
      const next = Array.from({ length: n }, (_, i) => prev[i] || { start_time: '', end_time: '' })
      return next
    })
    setConfirmReduce(null)
  }

  function handleLabelChange(idx, value) {
    setBlockLabels((prev) => {
      const next = [...prev]
      next[idx] = value
      return next
    })
  }

  function handleTimeChange(idx, field, value) {
    setBlockTimes((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function validate() {
    for (let i = 0; i < blockCount; i++) {
      const t = blockTimes[i]
      const hasStart = !!t.start_time
      const hasEnd = !!t.end_time
      if (hasStart !== hasEnd) {
        return `Block ${i}: both start and end times are required if either is set.`
      }
      if (hasStart && hasEnd && t.end_time <= t.start_time) {
        return `Block ${i}: end time must be after start time.`
      }
    }
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) {
      setToast({ type: 'error', message: err })
      setTimeout(() => setToast(null), 4000)
      return
    }

    setSaving(true)
    try {
      // Save block count + labels to org settings
      const labelsToSave = blockLabels.map((l, i) => l || `Block ${i}`)
      await updateOrgSettings(orgId, {
        block_count: blockCount,
        block_labels: labelsToSave,
      })

      // Save block times to default schedule template
      const hasAnyTimes = blockTimes.some((t) => t.start_time && t.end_time)
      if (hasAnyTimes) {
        const blockDefinitions = blockTimes
          .map((t, i) => (t.start_time && t.end_time ? { block: i, start_time: t.start_time, end_time: t.end_time } : null))
          .filter(Boolean)
        await upsertDefaultTemplate(orgId, blockDefinitions)
      }

      queryClient.invalidateQueries({ queryKey: ['org-settings', orgId] })
      queryClient.invalidateQueries({ queryKey: ['schedule-template-default', orgId] })
      setToast({ type: 'success', message: 'Block schedule saved.' })
    } catch (e) {
      setToast({ type: 'error', message: e.message })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const blocks = getBlocks(blockCount)

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title text-lg">Block Schedule</h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
          </button>
        </div>

        {toast && (
          <div className={`alert ${toast.type === 'error' ? 'alert-error' : 'alert-success'} mb-4 py-2`}>
            <span className="text-sm">{toast.message}</span>
          </div>
        )}

        {/* Block count selector */}
        <div className="flex items-center gap-3 mb-4">
          <label className="label-text text-sm font-medium">Number of blocks:</label>
          <select
            className="select select-bordered select-sm w-20"
            value={blockCount}
            onChange={(e) => handleCountChange(e.target.value)}
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Reduce confirmation */}
        {confirmReduce && (
          <div className="alert alert-warning mb-4 py-2">
            <div className="flex-1">
              <span className="text-sm">
                Reducing from {blockCount} to {confirmReduce.newCount} blocks will remove{' '}
                {confirmReduce.removed.map((b) => `Block ${b}`).join(' and ')}.
                Activities assigned to those blocks will not be reassigned.
              </span>
            </div>
            <div className="flex gap-1">
              <button className="btn btn-ghost btn-xs" onClick={() => setConfirmReduce(null)}>Cancel</button>
              <button className="btn btn-warning btn-xs" onClick={() => applyCountChange(confirmReduce.newCount)}>Continue</button>
            </div>
          </div>
        )}

        {/* Block table */}
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th className="w-40">Block</th>
                <th className="w-36">Start</th>
                <th className="w-36">End</th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b}>
                  <td>
                    <input
                      type="text"
                      className="input input-bordered input-sm w-full"
                      value={blockLabels[b] || ''}
                      onChange={(e) => handleLabelChange(b, e.target.value)}
                      placeholder={`Block ${b}`}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      className="input input-bordered input-sm w-full"
                      value={blockTimes[b]?.start_time || ''}
                      onChange={(e) => handleTimeChange(b, 'start_time', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      className="input input-bordered input-sm w-full"
                      value={blockTimes[b]?.end_time || ''}
                      onChange={(e) => handleTimeChange(b, 'end_time', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Academic Terms Section ──────────────────────────────────────────────────

function AcademicTermsSection({ terms, orgId }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Form state for add/edit
  const [formName, setFormName] = useState('')
  const [formStart, setFormStart] = useState('')
  const [formEnd, setFormEnd] = useState('')
  const [formCurrent, setFormCurrent] = useState(false)

  function showToast(type, message) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  function resetForm() {
    setFormName('')
    setFormStart('')
    setFormEnd('')
    setFormCurrent(false)
    setAdding(false)
    setEditingId(null)
  }

  function startEdit(term) {
    setEditingId(term.id)
    setAdding(false)
    setFormName(term.name)
    setFormStart(term.start_date)
    setFormEnd(term.end_date)
    setFormCurrent(term.is_current || false)
  }

  function startAdd() {
    setAdding(true)
    setEditingId(null)
    setFormName('')
    setFormStart('')
    setFormEnd('')
    setFormCurrent(false)
  }

  function validateForm() {
    if (!formName.trim()) return 'Name is required.'
    if (!formStart) return 'Start date is required.'
    if (!formEnd) return 'End date is required.'
    if (formEnd <= formStart) return 'End date must be after start date.'
    return null
  }

  async function handleAdd() {
    const err = validateForm()
    if (err) { showToast('error', err); return }

    setSaving(true)
    try {
      const newTerm = await createTerm(orgId, {
        name: formName.trim(),
        start_date: formStart,
        end_date: formEnd,
        is_current: false,
      })
      if (formCurrent) {
        await setCurrentTerm(orgId, newTerm.id)
      }
      queryClient.invalidateQueries({ queryKey: ['terms', orgId] })
      resetForm()
      showToast('success', 'Term created.')
    } catch (e) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    const err = validateForm()
    if (err) { showToast('error', err); return }

    setSaving(true)
    try {
      await updateTerm(editingId, {
        name: formName.trim(),
        start_date: formStart,
        end_date: formEnd,
      })
      if (formCurrent) {
        await setCurrentTerm(orgId, editingId)
      }
      queryClient.invalidateQueries({ queryKey: ['terms', orgId] })
      resetForm()
      showToast('success', 'Term updated.')
    } catch (e) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(termId) {
    setSaving(true)
    try {
      await deleteTerm(termId)
      queryClient.invalidateQueries({ queryKey: ['terms', orgId] })
      resetForm()
      setConfirmDelete(null)
      showToast('success', 'Term deleted.')
    } catch (e) {
      showToast('error', e.message)
    } finally {
      setSaving(false)
    }
  }

  function formatDate(d) {
    if (!d) return ''
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title text-lg">Academic Terms</h3>
          <button className="btn btn-ghost btn-sm gap-1" onClick={startAdd}>
            <FaPlus size={10} /> Add
          </button>
        </div>

        {toast && (
          <div className={`alert ${toast.type === 'error' ? 'alert-error' : 'alert-success'} mb-4 py-2`}>
            <span className="text-sm">{toast.message}</span>
          </div>
        )}

        {/* Term list */}
        <div className="space-y-1">
          {(!terms || terms.length === 0) && !adding && (
            <p className="text-sm text-base-content/40 py-4 text-center">No terms defined yet.</p>
          )}

          {terms?.map((term) => (
            editingId === term.id ? (
              <TermForm
                key={term.id}
                formName={formName}
                formStart={formStart}
                formEnd={formEnd}
                formCurrent={formCurrent}
                setFormName={setFormName}
                setFormStart={setFormStart}
                setFormEnd={setFormEnd}
                setFormCurrent={setFormCurrent}
                saving={saving}
                onSave={handleUpdate}
                onCancel={resetForm}
                onDelete={() => setConfirmDelete(term.id)}
                isEdit
              />
            ) : (
              <div
                key={term.id}
                className="flex items-center justify-between py-2 px-3 rounded hover:bg-base-200 cursor-pointer"
                onClick={() => startEdit(term)}
              >
                <div className="flex items-center gap-2">
                  {term.is_current && (
                    <span className="w-2 h-2 rounded-full bg-success shrink-0" title="Current term" />
                  )}
                  <span className="font-medium text-sm">{term.name}</span>
                </div>
                <span className="text-sm text-base-content/60">
                  {formatDate(term.start_date)} – {formatDate(term.end_date)}
                </span>
              </div>
            )
          ))}

          {/* Add form */}
          {adding && (
            <TermForm
              formName={formName}
              formStart={formStart}
              formEnd={formEnd}
              formCurrent={formCurrent}
              setFormName={setFormName}
              setFormStart={setFormStart}
              setFormEnd={setFormEnd}
              setFormCurrent={setFormCurrent}
              saving={saving}
              onSave={handleAdd}
              onCancel={resetForm}
            />
          )}
        </div>

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="alert alert-warning mt-3 py-2">
            <span className="text-sm">Delete this term? Activities referencing it will keep their dates but lose the term association.</span>
            <div className="flex gap-1">
              <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-error btn-xs" onClick={() => handleDelete(confirmDelete)} disabled={saving}>Delete</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TermForm({
  formName, formStart, formEnd, formCurrent,
  setFormName, setFormStart, setFormEnd, setFormCurrent,
  saving, onSave, onCancel, onDelete, isEdit,
}) {
  return (
    <div className="bg-base-200 rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">Name</label>
          <input
            type="text"
            className="input input-bordered input-sm w-full"
            placeholder='e.g. "Fall 2025"'
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
        </div>
        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">Start Date</label>
          <input
            type="date"
            className="input input-bordered input-sm w-full"
            value={formStart}
            onChange={(e) => setFormStart(e.target.value)}
          />
        </div>
        <div>
          <label className="label-text text-xs text-base-content/50 mb-1 block">End Date</label>
          <input
            type="date"
            className="input input-bordered input-sm w-full"
            value={formEnd}
            onChange={(e) => setFormEnd(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={formCurrent}
            onChange={(e) => setFormCurrent(e.target.checked)}
          />
          <span className="label-text text-sm">Set as current term</span>
        </label>

        <div className="flex items-center gap-1">
          {isEdit && onDelete && (
            <button type="button" className="btn btn-ghost btn-xs text-error" onClick={onDelete}>
              <FaTrash size={10} />
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-xs" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-primary btn-xs" onClick={onSave} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : (isEdit ? 'Update' : 'Add')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Rotation Days Section ───────────────────────────────────────────────────

function RotationDaysSection({ orgSettings, orgId }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const [usesRotation, setUsesRotation] = useState(orgSettings?.uses_rotation_schedule ?? false)
  const [dayNames, setDayNames] = useState(orgSettings?.rotation_day_names ?? ['A', 'B'])
  const [rotationMode, setRotationMode] = useState(orgSettings?.rotation_mode ?? 'continue')

  // Sync from server
  useEffect(() => {
    setUsesRotation(orgSettings?.uses_rotation_schedule ?? false)
    setDayNames(orgSettings?.rotation_day_names ?? ['A', 'B'])
    setRotationMode(orgSettings?.rotation_mode ?? 'continue')
  }, [orgSettings?.uses_rotation_schedule, orgSettings?.rotation_day_names, orgSettings?.rotation_mode])

  function handleDayNameChange(idx, value) {
    setDayNames((prev) => {
      const next = [...prev]
      next[idx] = value
      return next
    })
  }

  function addDayName() {
    setDayNames((prev) => [...prev, ''])
  }

  function removeDayName(idx) {
    if (dayNames.length <= 2) return
    setDayNames((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateOrgSettings(orgId, {
        uses_rotation_schedule: usesRotation,
        rotation_day_names: dayNames.map((n) => n.trim() || `Day ${dayNames.indexOf(n) + 1}`),
        rotation_mode: rotationMode,
      })
      queryClient.invalidateQueries({ queryKey: ['org-settings', orgId] })
      setToast({ type: 'success', message: 'Rotation settings saved.' })
    } catch (e) {
      setToast({ type: 'error', message: e.message })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-title text-lg">Rotation Days</h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="loading loading-spinner loading-xs" /> : 'Save'}
          </button>
        </div>

        {toast && (
          <div className={`alert ${toast.type === 'error' ? 'alert-error' : 'alert-success'} mb-4 py-2`}>
            <span className="text-sm">{toast.message}</span>
          </div>
        )}

        {/* Toggle */}
        <label className="label cursor-pointer justify-start gap-3 mb-3">
          <input
            type="checkbox"
            className="checkbox"
            checked={usesRotation}
            onChange={(e) => setUsesRotation(e.target.checked)}
          />
          <span className="label-text font-medium">Uses rotation schedule</span>
        </label>

        {usesRotation && (
          <div className="space-y-4 pl-1">
            {/* Day names */}
            <div>
              <label className="label-text text-sm font-medium mb-2 block">Day names</label>
              <div className="flex flex-wrap gap-2 items-center">
                {dayNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="text"
                      className="input input-bordered input-sm w-28"
                      value={name}
                      onChange={(e) => handleDayNameChange(idx, e.target.value)}
                      placeholder={`Day ${idx + 1}`}
                    />
                    {dayNames.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-circle"
                        onClick={() => removeDayName(idx)}
                      >
                        <FaTimes size={10} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-xs gap-1" onClick={addDayName}>
                  <FaPlus size={10} /> Add
                </button>
              </div>
              <p className="text-xs text-base-content/40 mt-2">
                Rotation day names identify alternating schedule days. Common examples: A Day / B Day, Gold / Maroon.
              </p>
            </div>

            {/* Cancellation mode */}
            <div>
              <label className="label-text text-sm font-medium mb-2 block">On cancellation</label>
              <div className="space-y-2">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="radio"
                    className="radio radio-sm"
                    name="rotation_mode"
                    checked={rotationMode === 'continue'}
                    onChange={() => setRotationMode('continue')}
                  />
                  <div>
                    <span className="label-text font-medium">Continue</span>
                    <p className="text-xs text-base-content/50">Skip cancelled days in the rotation (Snow day on A → next day is B)</p>
                  </div>
                </label>
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="radio"
                    className="radio radio-sm"
                    name="rotation_mode"
                    checked={rotationMode === 'repeat'}
                    onChange={() => setRotationMode('repeat')}
                  />
                  <div>
                    <span className="label-text font-medium">Repeat</span>
                    <p className="text-xs text-base-content/50">Repeat cancelled days (Snow day on A → next day is also A)</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── OrgSettings Page ────────────────────────────────────────────────────────

export default function OrgSettings() {
  const orgId = useAuthStore((s) => s.profile?.organization_id)
  const { data: orgSettings, isLoading: settingsLoading } = useOrgSettings(orgId)
  const { data: defaultTemplate, isLoading: templateLoading } = useDefaultScheduleTemplate(orgId)
  const { data: terms = [], isLoading: termsLoading } = useTerms(orgId)

  const loading = settingsLoading || templateLoading || termsLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-base-content/60 text-sm mt-1">
          Organization schedule configuration
        </p>
      </div>

      <div className="space-y-6 max-w-3xl">
        <BlockScheduleSection orgSettings={orgSettings} defaultTemplate={defaultTemplate} orgId={orgId} />
        <AcademicTermsSection terms={terms} orgId={orgId} />
        <RotationDaysSection orgSettings={orgSettings} orgId={orgId} />
      </div>
    </div>
  )
}
