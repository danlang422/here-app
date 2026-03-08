import { useMemo } from 'react'
import { FaTasks, FaUserPlus, FaCog } from 'react-icons/fa'
import useAuthStore from '@/store/authStore'
import useUIStore from '@/store/uiStore'
import { useActivities } from '@/hooks/useActivities'
import { useOrgEnrollments } from '@/hooks/useEnrollments'
import { useOrgSettings } from '@/hooks/useOrgSettings'
import AgendaView from '@/components/agenda/AgendaView'

function DashboardToolbar({ hasFocus, onClearFocus }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold">Here &mdash; Schedule</h2>

      <div className="flex items-center gap-2">
        {hasFocus && (
          <button className="btn btn-sm btn-ghost" onClick={onClearFocus}>
            Clear filters
          </button>
        )}

        {/* Panel launch button stubs — no functionality yet */}
        <button className="btn btn-sm btn-ghost btn-square" title="Activities" disabled>
          <FaTasks className="w-4 h-4" />
        </button>
        <button className="btn btn-sm btn-ghost btn-square" title="Enrollment" disabled>
          <FaUserPlus className="w-4 h-4" />
        </button>
        <button className="btn btn-sm btn-ghost btn-square" title="Settings" disabled>
          <FaCog className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function Dashboard() {
  const orgId = useAuthStore((s) => s.profile?.organization_id)

  const { data: activities = [], isLoading: activitiesLoading } = useActivities(orgId)
  const { data: orgEnrollments = [] } = useOrgEnrollments(orgId)
  const { data: orgSettings = {} } = useOrgSettings(orgId)

  const enrollmentCountByActivity = useMemo(() => {
    const map = new Map()
    for (const e of orgEnrollments) {
      map.set(e.activity_id, (map.get(e.activity_id) ?? 0) + 1)
    }
    return map
  }, [orgEnrollments])

  const scheduledActivities = useMemo(
    () =>
      activities.filter(
        (a) =>
          a.is_active &&
          !a.is_not_scheduled &&
          a.default_start_time &&
          a.default_end_time,
      ),
    [activities],
  )

  const agendaFocusedBlock = useUIStore((s) => s.agendaFocusedBlock)
  const agendaFocusedDay = useUIStore((s) => s.agendaFocusedDay)
  const clearAgendaFocus = useUIStore((s) => s.clearAgendaFocus)
  const hasFocus = agendaFocusedBlock != null || agendaFocusedDay != null

  if (activitiesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <DashboardToolbar hasFocus={hasFocus} onClearFocus={clearAgendaFocus} />

      <AgendaView
        activities={scheduledActivities}
        enrollmentCountByActivity={enrollmentCountByActivity}
        blockCount={orgSettings?.settings?.block_count ?? 0}
      />
    </div>
  )
}

export default Dashboard
