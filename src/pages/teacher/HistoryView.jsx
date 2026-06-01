import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ClockCounterClockwise } from '@phosphor-icons/react'
import useAuthStore from '@/store/authStore'
import { useTeacherStudentHistory } from '@/hooks/useHistory'
import { useTerms } from '@/hooks/useTerms'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { formatDateISO, subDays } from '@/lib/scheduleUtils'
import { getDevToday } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
import StudentActionFeed from '@/components/history/StudentActionFeed'

function getStartDate(dateRange, terms) {
  if (dateRange === 'all') return null
  if (dateRange === 'last-7') return formatDateISO(subDays(getDevToday(), 7))
  if (dateRange === 'last-30') return formatDateISO(subDays(getDevToday(), 30))
  const currentTerm = terms.find((t) => t.is_current)
  return currentTerm?.start_date ?? null
}

function TeacherHistoryView() {
  const [searchParams] = useSearchParams()
  const presetStudentId = searchParams.get('studentId')

  const profile = useAuthStore((s) => s.profile)
  const orgId = profile?.organization_id
  const teacherId = profile?.id

  const { data: terms = [] } = useTerms(orgId)
  const { data: orgSettings } = useOrgSettings(orgId)

  const [dateRange, setDateRange] = useState('term')
  const [filterStudentId, setFilterStudentId] = useState(presetStudentId ?? null)
  const [activityId, setActivityId] = useState(null)
  const [actionType, setActionType] = useState('all')

  const startDate = useMemo(() => getStartDate(dateRange, terms), [dateRange, terms])

  // Fetch all entries without student filter — student filter applied below
  const { entries: allEntries, isLoading, isError } = useTeacherStudentHistory({
    teacherId,
    startDate,
    activityId,
    actionType,
  })

  // Apply student filter client-side so the full dataset stays cached
  const entries = useMemo(() => {
    if (!filterStudentId) return allEntries
    return allEntries.filter((e) => e.studentId === filterStudentId)
  }, [allEntries, filterStudentId])

  // Student options derived from unfiltered entries (shows all students with activity in range)
  const studentOptions = useMemo(() => {
    const seen = new Map()
    for (const e of allEntries) {
      if (e.studentId && !seen.has(e.studentId)) seen.set(e.studentId, e.studentName)
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [allEntries])

  // Activity options derived from filtered entries (respects student + action type filters)
  const activityOptions = useMemo(() => {
    const seen = new Map()
    for (const e of entries) {
      if (e.activityId && !seen.has(e.activityId)) seen.set(e.activityId, e.activityName)
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [entries])

  const blockLabels = orgSettings?.block_labels ?? []

  function handleDateRangeChange(e) {
    setDateRange(e.target.value)
    setActivityId(null)
  }

  if (isError) {
    return (
      <div className="text-error text-center py-8">Failed to load history. Please try again.</div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link to="/teacher" className="btn btn-ghost btn-sm btn-circle">
          <ArrowLeft size={18} />
        </Link>
        <ClockCounterClockwise size={20} weight="duotone" className="text-primary" />
        <h1 className="text-xl font-bold">Student Activity History</h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="select select-sm select-bordered"
          value={dateRange}
          onChange={handleDateRangeChange}
        >
          <option value="term">This term</option>
          <option value="last-7">Last 7 days</option>
          <option value="last-30">Last 30 days</option>
          <option value="all">All time</option>
        </select>

        {studentOptions.length > 0 && (
          <select
            className="select select-sm select-bordered"
            value={filterStudentId ?? ''}
            onChange={(e) => setFilterStudentId(e.target.value || null)}
          >
            <option value="">All students</option>
            {studentOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}

        {activityOptions.length > 1 && (
          <select
            className="select select-sm select-bordered"
            value={activityId ?? ''}
            onChange={(e) => setActivityId(e.target.value || null)}
          >
            <option value="">All activities</option>
            {activityOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        <select
          className="select select-sm select-bordered"
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
        >
          <option value="all">All actions</option>
          <option value="checkin">Check-ins</option>
          <option value="wave">Waves</option>
          <option value="status">Status updates</option>
        </select>
      </div>

      <StudentActionFeed
        entries={entries}
        isLoading={isLoading}
        isTeacherView={true}
        emptyMessage="No student activity recorded for this period."
        blockLabels={blockLabels}
      />
    </div>
  )
}

export default TeacherHistoryView
