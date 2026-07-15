import { useState, useRef, useCallback, useMemo } from 'react'
import { createUser } from '@/api/users'
import { useQueryClient } from '@tanstack/react-query'

const COLUMNS = [
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'email', label: 'Email', required: true },
  { key: 'role', label: 'Role', required: true },
  { key: 'grade_level', label: 'Grade', required: false },
]

const VALID_ROLES = ['student', 'teacher', 'admin']

const HEADER_ALIASES = {
  first_name: ['first_name', 'first name', 'firstname', 'first'],
  last_name: ['last_name', 'last name', 'lastname', 'last'],
  email: ['email', 'e-mail', 'email address'],
  role: ['role', 'roles', 'type'],
  grade_level: ['grade_level', 'grade level', 'grade', 'gradelevel'],
}

function isHeaderRow(cells) {
  const normalized = cells.map((c) => c.trim().toLowerCase())
  let matches = 0
  for (const aliases of Object.values(HEADER_ALIASES)) {
    if (normalized.some((c) => aliases.includes(c))) matches++
  }
  return matches >= 3
}

function detectMultiRole(value) {
  return /[,/;|]/.test(value)
}

function validateRow(row, existingEmails, batchEmails) {
  const errors = []

  if (!row.first_name?.trim()) errors.push({ field: 'first_name', message: 'First name is required' })
  if (!row.last_name?.trim()) errors.push({ field: 'last_name', message: 'Last name is required' })
  if (!row.email?.trim()) errors.push({ field: 'email', message: 'Email is required' })

  if (!row.role?.trim()) {
    errors.push({ field: 'role', message: 'Role is required' })
  } else if (detectMultiRole(row.role)) {
    errors.push({ field: 'role', message: 'One role per entry. Use Edit to add more roles.', severity: 'error' })
  } else if (!VALID_ROLES.includes(row.role.trim().toLowerCase())) {
    errors.push({ field: 'role', message: 'Must be student, teacher, or admin' })
  }

  // Warnings (non-blocking)
  if (row.email?.trim()) {
    const email = row.email.trim().toLowerCase()
    if (existingEmails.has(email)) {
      errors.push({ field: 'email', message: 'User already exists', severity: 'warning' })
    }
    const count = batchEmails.filter((e) => e === email).length
    if (count > 1) {
      errors.push({ field: 'email', message: 'Duplicate in this batch', severity: 'warning' })
    }
  }

  return errors
}

function parseInput(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  // Detect delimiter: tabs first, then commas
  const hasTab = lines.some((line) => line.includes('\t'))
  const delimiter = hasTab ? '\t' : ','

  let dataLines = lines.map((line) => line.split(delimiter).map((cell) => cell.trim()))

  // Strip header row if detected
  if (dataLines.length > 0 && isHeaderRow(dataLines[0])) {
    dataLines = dataLines.slice(1)
  }

  return dataLines.map((cells, i) => ({
    _id: i,
    first_name: cells[0] || '',
    last_name: cells[1] || '',
    email: cells[2] || '',
    role: cells[3] || '',
    grade_level: cells[4] || '',
    _status: 'pending', // pending | creating | created | failed
    _error: null,
  }))
}

// --- Phase: Paste ---

function PasteZone({ onParse }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  function handlePaste() {
    // Let the paste happen, then parse on next tick
    setTimeout(() => {
      const value = textareaRef.current?.value || ''
      if (value.trim()) {
        setText(value)
        const rows = parseInput(value)
        if (rows.length > 0) onParse(rows)
      }
    }, 0)
  }

  function handleParseClick() {
    if (text.trim()) {
      const rows = parseInput(text)
      if (rows.length > 0) onParse(rows)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        ref={textareaRef}
        className="textarea textarea-bordered w-full font-mono text-sm"
        rows={10}
        placeholder="Paste from spreadsheet: first_name, last_name, email, role, grade_level"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={handlePaste}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-base-content/50">
          Copy rows from Excel or Google Sheets and paste above. Tab-separated or comma-separated.
        </p>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleParseClick}
          disabled={!text.trim()}
        >
          Parse
        </button>
      </div>
    </div>
  )
}

// --- Phase: Preview ---

function PreviewTable({ rows, existingEmails, onUpdateRow, onRemoveRow }) {
  const batchEmails = rows.map((r) => r.email.trim().toLowerCase())

  const rowsWithErrors = rows.map((row) => ({
    ...row,
    _errors: validateRow(row, existingEmails, batchEmails),
  }))

  const errorCount = rowsWithErrors.filter((r) =>
    r._errors.some((e) => e.severity !== 'warning')
  ).length
  const warningCount = rowsWithErrors.filter((r) =>
    r._errors.length > 0 && r._errors.every((e) => e.severity === 'warning')
  ).length
  const readyCount = rows.length - errorCount

  function getFieldClass(row, field) {
    const errs = validateRow(row, existingEmails, batchEmails)
    const fieldErr = errs.find((e) => e.field === field)
    if (!fieldErr) return 'input input-bordered input-xs w-full'
    if (fieldErr.severity === 'warning') return 'input input-bordered input-xs w-full input-warning'
    return 'input input-bordered input-xs w-full input-error'
  }

  function getFieldTooltip(row, field) {
    const errs = validateRow(row, existingEmails, batchEmails)
    const fieldErr = errs.find((e) => e.field === field)
    return fieldErr?.message || null
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">{rows.length} rows</span>
        {errorCount > 0 && (
          <span className="text-error">{errorCount} with errors</span>
        )}
        {warningCount > 0 && (
          <span className="text-warning">{warningCount} with warnings</span>
        )}
        {errorCount === 0 && (
          <span className="text-success">{readyCount} ready to create</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="table table-xs">
          <thead className="sticky top-0 bg-base-100 z-10">
            <tr>
              <th className="w-10">#</th>
              {COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th className="w-16">Status</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const rowErrors = validateRow(row, existingEmails, batchEmails)
              const hasError = rowErrors.some((e) => e.severity !== 'warning')
              const hasWarning = rowErrors.some((e) => e.severity === 'warning')

              return (
                <tr key={row._id} className={hasError ? 'bg-error/5' : hasWarning ? 'bg-warning/5' : ''}>
                  <td className="text-base-content/40 text-xs">{i + 1}</td>
                  {COLUMNS.map((col) => (
                    <td key={col.key} className="p-1">
                      <div className="tooltip tooltip-bottom w-full" data-tip={getFieldTooltip(row, col.key)}>
                        <input
                          type="text"
                          className={getFieldClass(row, col.key)}
                          value={row[col.key]}
                          onChange={(e) => onUpdateRow(row._id, col.key, e.target.value)}
                          disabled={row._status === 'creating' || row._status === 'created'}
                        />
                      </div>
                    </td>
                  ))}
                  <td>
                    {row._status === 'pending' && hasError && (
                      <span className="badge badge-error badge-xs">Error</span>
                    )}
                    {row._status === 'pending' && !hasError && hasWarning && (
                      <span className="badge badge-warning badge-xs">Warning</span>
                    )}
                    {row._status === 'pending' && !hasError && !hasWarning && (
                      <span className="badge badge-ghost badge-xs">Ready</span>
                    )}
                    {row._status === 'creating' && (
                      <span className="loading loading-spinner loading-xs" />
                    )}
                    {row._status === 'created' && (
                      <span className="badge badge-success badge-xs">Created</span>
                    )}
                    {row._status === 'failed' && (
                      <div className="tooltip tooltip-left" data-tip={row._error}>
                        <span className="badge badge-error badge-xs cursor-help">Failed</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {(row._status === 'pending' || row._status === 'failed') && (
                      <button
                        className="btn btn-ghost btn-xs text-base-content/40 hover:text-error"
                        onClick={() => onRemoveRow(row._id)}
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Main Component ---

export default function BulkUserEntry({ orgId, existingUsers = [], onDone }) {
  const [phase, setPhase] = useState('paste') // paste | preview | submitting | done
  const [rows, setRows] = useState([])
  const queryClient = useQueryClient()
  const abortRef = useRef(false)

  const existingEmails = useMemo(
    () => new Set(existingUsers.map((u) => u.email?.toLowerCase())),
    [existingUsers]
  )

  function handleParse(parsedRows) {
    setRows(parsedRows)
    setPhase('preview')
  }

  function handleUpdateRow(id, field, value) {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)))
  }

  function handleRemoveRow(id) {
    setRows((prev) => prev.filter((r) => r._id !== id))
  }

  function handleBack() {
    setPhase('paste')
    setRows([])
  }

  const hasBlockingErrors = useCallback(() => {
    const batchEmails = rows.map((r) => r.email.trim().toLowerCase())
    return rows.some((row) => {
      const errors = validateRow(row, existingEmails, batchEmails)
      return errors.some((e) => e.severity !== 'warning')
    })
  }, [rows, existingEmails])

  async function handleSubmit() {
    setPhase('submitting')
    abortRef.current = false

    const pendingRows = rows.filter((r) => r._status === 'pending' || r._status === 'failed')

    for (const row of pendingRows) {
      if (abortRef.current) break

      // Mark as creating
      setRows((prev) => prev.map((r) => (r._id === row._id ? { ...r, _status: 'creating', _error: null } : r)))

      try {
        await createUser({
          organization_id: orgId,
          first_name: row.first_name.trim(),
          last_name: row.last_name.trim(),
          email: row.email.trim(),
          roles: [row.role.trim().toLowerCase()],
          grade_level: row.grade_level.trim() || null,
        })

        setRows((prev) => prev.map((r) => (r._id === row._id ? { ...r, _status: 'created' } : r)))
      } catch (err) {
        setRows((prev) =>
          prev.map((r) =>
            r._id === row._id ? { ...r, _status: 'failed', _error: err.message || 'Creation failed' } : r
          )
        )
      }
    }

    // Invalidate user queries to refresh the list
    queryClient.invalidateQueries({ queryKey: ['users', orgId] })
    queryClient.invalidateQueries({ queryKey: ['students', orgId] })
    queryClient.invalidateQueries({ queryKey: ['staff-users', orgId] })
    setPhase('done')
  }

  // Compute progress for submitting phase
  const total = rows.length
  const created = rows.filter((r) => r._status === 'created').length
  const failed = rows.filter((r) => r._status === 'failed').length
  const processed = created + failed

  return (
    <div className="border border-base-300 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Bulk Add Users</h3>
        {phase !== 'submitting' && (
          <button className="btn btn-ghost btn-sm" onClick={onDone}>
            ✕
          </button>
        )}
      </div>

      {/* Paste phase */}
      {phase === 'paste' && <PasteZone onParse={handleParse} />}

      {/* Preview phase */}
      {phase === 'preview' && (
        <>
          <PreviewTable
            rows={rows}
            existingEmails={existingEmails}
            onUpdateRow={handleUpdateRow}
            onRemoveRow={handleRemoveRow}
          />
          <div className="flex items-center justify-between pt-2">
            <button className="btn btn-ghost btn-sm" onClick={handleBack}>
              Back
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={rows.length === 0 || hasBlockingErrors()}
            >
              Create {rows.length} {rows.length === 1 ? 'User' : 'Users'}
            </button>
          </div>
        </>
      )}

      {/* Submitting phase */}
      {phase === 'submitting' && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Creating user {Math.min(processed + 1, total)} of {total}...</span>
              <span className="text-base-content/50">{created} created{failed > 0 ? `, ${failed} failed` : ''}</span>
            </div>
            <progress className="progress progress-primary w-full" value={processed} max={total} />
          </div>
          <PreviewTable
            rows={rows}
            existingEmails={existingEmails}
            onUpdateRow={handleUpdateRow}
            onRemoveRow={handleRemoveRow}
          />
        </>
      )}

      {/* Done phase */}
      {phase === 'done' && (
        <>
          <div className={`alert ${failed > 0 ? 'alert-warning' : 'alert-success'}`}>
            <span>
              {created} user{created !== 1 ? 's' : ''} created successfully
              {failed > 0 ? `. ${failed} failed — review errors below.` : '.'}
            </span>
          </div>
          <PreviewTable
            rows={rows}
            existingEmails={existingEmails}
            onUpdateRow={handleUpdateRow}
            onRemoveRow={handleRemoveRow}
          />
          <div className="flex items-center justify-between pt-2">
            {failed > 0 && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setPhase('submitting')
                  handleSubmit()
                }}
              >
                Retry Failed
              </button>
            )}
            <div className="ml-auto">
              <button className="btn btn-primary btn-sm" onClick={onDone}>
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
