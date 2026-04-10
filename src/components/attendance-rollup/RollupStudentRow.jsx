function getStatusDisplay(row) {
  if (!row.requiresAttendance) {
    return { indicator: '—', label: 'N/A', className: 'text-base-content/30 italic' }
  }
  if (!row.attendanceRecord) {
    return { indicator: '○', label: 'Unmarked', className: 'text-base-content/40' }
  }
  switch (row.attendanceRecord.status) {
    case 'present':
      return { indicator: '●', label: 'Present', className: 'text-success' }
    case 'absent':
      return { indicator: '●', label: 'Absent', className: 'text-error font-semibold' }
    case 'tardy':
      return { indicator: '●', label: 'Tardy', className: 'text-warning' }
    case 'excused':
      return { indicator: '●', label: 'Excused', className: 'text-info' }
    default:
      return { indicator: '○', label: 'Unmarked', className: 'text-base-content/40' }
  }
}

function formatStudentName(student) {
  const first = student.preferred_name || student.first_name
  const showPreferred =
    student.preferred_name && student.preferred_name !== student.first_name
  return showPreferred
    ? `${student.last_name}, ${student.first_name} (${student.preferred_name})`
    : `${student.last_name}, ${first}`
}

function RollupStudentRow({ row }) {
  const { indicator, label, className } = getStatusDisplay(row)

  return (
    <div className="flex items-center gap-3 py-1.5 px-3 text-sm hover:bg-base-200/50 rounded">
      <span className="flex-1 font-medium">
        {formatStudentName(row.student)}
        {row.hasConflict && (
          <span className="ml-1.5 text-warning" title="Student appears in multiple activities this block">
            ⚠
          </span>
        )}
      </span>
      <span className="text-base-content/60 truncate max-w-[200px]">
        {row.activity.name}
      </span>
      <span className={`flex items-center gap-1 w-24 justify-end shrink-0 ${className}`}>
        <span>{indicator}</span>
        <span>{label}</span>
      </span>
    </div>
  )
}

export default RollupStudentRow
