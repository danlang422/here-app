import { useState } from 'react'
import useAuthStore from '@/store/authStore'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import { useAttendanceRollup } from '@/hooks/useAttendanceRollup'
import { getBlocks, getBlockLabel } from '@/lib/constants'
import { getDevToday } from '@/lib/devOverrides'
import { formatDateISO } from '@/lib/scheduleUtils'
import RollupDatePicker from './RollupDatePicker'
import RollupBlockSection from './RollupBlockSection'

const OVERRIDE_REASON_LABELS = {
  weather: 'Weather',
  planned_holiday: 'Planned Holiday',
  emergency: 'Emergency',
}

function SummaryBar({ viewMode, stats, blockCount }) {
  const { totalExceptions, absent, tardy, excused, unmarked, marked, totalStudents } = stats

  if (viewMode === 'exceptions') {
    const parts = [
      absent > 0 && `${absent} absent`,
      tardy > 0 && `${tardy} tardy`,
      excused > 0 && `${excused} excused`,
      unmarked > 0 && `${unmarked} unmarked`,
    ].filter(Boolean)

    return (
      <div className="text-sm text-base-content/60 pt-2 border-t border-base-300">
        {totalExceptions === 0 ? (
          <span className="text-success">No exceptions — all students present</span>
        ) : (
          <>
            <span className="font-medium text-base-content">
              {totalExceptions} exception{totalExceptions !== 1 ? 's' : ''}
            </span>
            {' across '}
            {blockCount} block{blockCount !== 1 ? 's' : ''}
            {parts.length > 0 && (
              <> — {parts.join(' · ')}</>
            )}
          </>
        )}
      </div>
    )
  }

  const parts = [
    absent > 0 && `${absent} absent`,
    tardy > 0 && `${tardy} tardy`,
    excused > 0 && `${excused} excused`,
    unmarked > 0 && `${unmarked} unmarked`,
  ].filter(Boolean)

  return (
    <div className="text-sm text-base-content/60 pt-2 border-t border-base-300">
      <span className="font-medium text-base-content">
        {marked}/{totalStudents} marked
      </span>
      {parts.length > 0 && (
        <> — {parts.join(' · ')}</>
      )}
    </div>
  )
}

function AttendanceRollup() {
  const orgId = useAuthStore((s) => s.profile?.organization_id)
  const [date, setDate] = useState(getDevToday())
  const [viewMode, setViewMode] = useState('exceptions')

  const { data: orgSettings = {} } = useOrgSettings(orgId)
  const { blockGroups, schoolDay, isLoading, error, stats } = useAttendanceRollup(orgId, date)

  const blocks = getBlocks(orgSettings.block_count)
  const blockLabels = orgSettings.block_labels ?? {}
  const scheduleTemplate = schoolDay?.schedule_template ?? null

  const isNonSchoolDay = schoolDay !== null && schoolDay !== undefined && !schoolDay.is_school_day

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Attendance</h2>
        <RollupDatePicker date={date} onChange={setDate} />
      </div>

      {/* View toggle */}
      <div className="tabs tabs-bordered mb-6">
        <button
          className={`tab ${viewMode === 'exceptions' ? 'tab-active' : 'text-base-content/60'}`}
          onClick={() => setViewMode('exceptions')}
        >
          Exceptions
        </button>
        <button
          className={`tab ${viewMode === 'full' ? 'tab-active' : 'text-base-content/60'}`}
          onClick={() => setViewMode('full')}
        >
          Full Rollup
        </button>
      </div>

      {/* Non-school day */}
      {isNonSchoolDay && (
        <div className="text-center py-12 text-base-content/50">
          <p className="text-lg font-medium">
            No school on {formatDateISO(date)}
          </p>
          {schoolDay.override_reason && (
            <p className="text-sm mt-1">
              {OVERRIDE_REASON_LABELS[schoolDay.override_reason] ?? schoolDay.override_reason}
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {!isNonSchoolDay && isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-base-200 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!isNonSchoolDay && error && (
        <div className="alert alert-error">
          <span>Failed to load attendance data. Please refresh.</span>
        </div>
      )}

      {/* No school day record yet */}
      {!isNonSchoolDay && !isLoading && !error && schoolDay === null && (
        <div className="text-center py-12 text-base-content/50">
          <p>No school day record for this date.</p>
        </div>
      )}

      {/* Block sections */}
      {!isNonSchoolDay && !isLoading && !error && schoolDay !== null && (
        <>
          {blocks.length === 0 ? (
            <div className="text-center py-12 text-base-content/50">
              <p>Block schedule not configured. Add block count in Settings.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blocks.map((block) => (
                <RollupBlockSection
                  key={block}
                  block={block}
                  blockLabel={getBlockLabel(block, blockLabels)}
                  rows={blockGroups.get(block) ?? []}
                  viewMode={viewMode}
                  scheduleTemplate={scheduleTemplate}
                />
              ))}
            </div>
          )}

          <div className="mt-4">
            <SummaryBar viewMode={viewMode} stats={stats} blockCount={blocks.length} />
          </div>
        </>
      )}
    </div>
  )
}

export default AttendanceRollup
