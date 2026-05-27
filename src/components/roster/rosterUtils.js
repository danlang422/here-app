export function formatTimestamp(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export const STATUS_OPTIONS = [
  { key: 'present', label: 'P', fullLabel: 'Present', btnClass: 'btn-success' },
  { key: 'absent', label: 'A', fullLabel: 'Absent', btnClass: 'btn-error' },
  { key: 'excused', label: 'E', fullLabel: 'Excused', btnClass: 'btn-warning' },
  { key: 'tardy', label: 'T', fullLabel: 'Tardy', btnClass: 'btn-info' },
]
