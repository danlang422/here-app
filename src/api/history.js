import { supabase } from './supabase'
import { batchGetProfileDisplayInfo, formatDisplayName } from './profiles'

const ACTION_WITH_INSTANCE = `
  *,
  activity_instance:activity_instance_id(
    id, date,
    activity:activity_id(
      id, name, block, location,
      calendar:calendar_id(color),
      activity_staff(user_id, role)
    )
  )
`

const INSTANCE_WITH_ACTIVITY = `
  id, date,
  activity:activity_id(
    id, name, block, location,
    calendar:calendar_id(color),
    activity_staff(user_id, role)
  )
`

function resolveStaffDisplayName(activityStaff, profileMap) {
  if (!activityStaff || activityStaff.length === 0) return null
  const teacher = activityStaff.find((s) => s.role === 'teacher')
  const primary = teacher ?? activityStaff[0]
  return formatDisplayName(profileMap.get(primary.user_id))
}

// Assembles raw action rows into FeedEntry[] grouped by (instanceId, studentId).
// instanceResolver: (actionRow) → instanceData object (has .date and .activity)
// staffProfiles: Map<userId, profile> — for resolving staff display names
// studentProfiles: Map<userId, profile> | null — null for student-scoped view
function assembleFeedEntries({ checkIns, waves, statusUpdates, instanceResolver, staffProfiles, studentProfiles = null }) {
  const entries = new Map()

  function makeKey(instanceId, studentId) {
    return studentProfiles ? `${instanceId}:${studentId}` : instanceId
  }

  function getOrCreate(instanceId, studentId, instanceData) {
    const key = makeKey(instanceId, studentId)
    if (!entries.has(key)) {
      const activity = instanceData.activity
      entries.set(key, {
        instanceId,
        date: instanceData.date,
        activityId: activity?.id ?? null,
        activityName: activity?.name ?? null,
        calendarColor: activity?.calendar?.color ?? null,
        block: activity?.block ?? [],
        location: activity?.location ?? null,
        staffDisplayName: resolveStaffDisplayName(activity?.activity_staff ?? [], staffProfiles),
        wave: null,
        checkIn: null,
        statusUpdates: [],
        studentId,
        studentName: studentProfiles ? formatDisplayName(studentProfiles.get(studentId)) : null,
      })
    }
    return entries.get(key)
  }

  for (const ci of checkIns) {
    const instanceData = instanceResolver(ci)
    if (!instanceData?.activity) continue
    const entry = getOrCreate(ci.activity_instance_id, ci.student_id, instanceData)
    entry.checkIn = { checked_in_at: ci.checked_in_at, checked_out_at: ci.checked_out_at }
  }

  for (const w of waves) {
    const instanceData = instanceResolver(w)
    if (!instanceData?.activity) continue
    const entry = getOrCreate(w.activity_instance_id, w.student_id, instanceData)
    entry.wave = { waved_at: w.waved_at }
  }

  for (const su of statusUpdates) {
    const instanceData = instanceResolver(su)
    if (!instanceData?.activity) continue
    const entry = getOrCreate(su.activity_instance_id, su.student_id, instanceData)
    entry.statusUpdates.push({
      id: su.id,
      status_type: su.status_type,
      content: su.content,
      created_at: su.created_at,
    })
  }

  for (const entry of entries.values()) {
    entry.statusUpdates.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  return [...entries.values()].sort((a, b) => b.date.localeCompare(a.date))
}

// Fetch all activity instances where a student took at least one action,
// starting from startDate (if provided). Returns assembled FeedEntry[].
export async function getStudentActionHistory(studentId, { startDate } = {}) {
  const buildQuery = (table, timestampCol) => {
    let q = supabase.from(table).select(ACTION_WITH_INSTANCE).eq('student_id', studentId)
    if (startDate) q = q.gte(timestampCol, startDate)
    return q
  }

  const [checkInsResult, wavesResult, statusUpdatesResult] = await Promise.all([
    buildQuery('check_ins', 'checked_in_at'),
    buildQuery('presence_waves', 'waved_at'),
    buildQuery('status_updates', 'created_at'),
  ])

  if (checkInsResult.error) throw checkInsResult.error
  if (wavesResult.error) throw wavesResult.error
  if (statusUpdatesResult.error) throw statusUpdatesResult.error

  const { data: checkIns } = checkInsResult
  const { data: waves } = wavesResult
  const { data: statusUpdates } = statusUpdatesResult

  const allStaffIds = [
    ...checkIns.flatMap((ci) => ci.activity_instance?.activity?.activity_staff?.map((s) => s.user_id) ?? []),
    ...waves.flatMap((w) => w.activity_instance?.activity?.activity_staff?.map((s) => s.user_id) ?? []),
    ...statusUpdates.flatMap((su) => su.activity_instance?.activity?.activity_staff?.map((s) => s.user_id) ?? []),
  ]
  const staffProfiles = await batchGetProfileDisplayInfo(allStaffIds)

  return assembleFeedEntries({
    checkIns,
    waves,
    statusUpdates,
    instanceResolver: (item) => item.activity_instance,
    staffProfiles,
  })
}

// Fetch all student actions across a teacher's activities, starting from
// startDate (if provided). Returns assembled FeedEntry[] with studentName populated.
export async function getTeacherStudentActionHistory(teacherId, { startDate } = {}) {
  // Step 1: activity IDs for this teacher
  const { data: staffRows, error: staffError } = await supabase
    .from('activity_staff')
    .select('activity_id')
    .eq('user_id', teacherId)
  if (staffError) throw staffError

  const activityIds = staffRows.map((r) => r.activity_id)
  if (activityIds.length === 0) return []

  // Step 2: instances for those activities in the date range
  let instanceQuery = supabase
    .from('activity_instances')
    .select(INSTANCE_WITH_ACTIVITY)
    .in('activity_id', activityIds)
  if (startDate) instanceQuery = instanceQuery.gte('date', startDate)

  const { data: instances, error: instanceError } = await instanceQuery
  if (instanceError) throw instanceError
  if (instances.length === 0) return []

  const instanceIds = instances.map((i) => i.id)
  const instanceMap = new Map(instances.map((i) => [i.id, i]))

  // Step 3: action tables filtered by instance IDs (parallel)
  const [checkInsResult, wavesResult, statusUpdatesResult] = await Promise.all([
    supabase.from('check_ins').select('*').in('activity_instance_id', instanceIds),
    supabase.from('presence_waves').select('*').in('activity_instance_id', instanceIds),
    supabase.from('status_updates').select('*').in('activity_instance_id', instanceIds),
  ])

  if (checkInsResult.error) throw checkInsResult.error
  if (wavesResult.error) throw wavesResult.error
  if (statusUpdatesResult.error) throw statusUpdatesResult.error

  const { data: checkIns } = checkInsResult
  const { data: waves } = wavesResult
  const { data: statusUpdates } = statusUpdatesResult

  // Step 4: resolve staff + student names together in one batch
  const staffIds = instances.flatMap((i) => i.activity?.activity_staff?.map((s) => s.user_id) ?? [])
  const studentIds = [
    ...checkIns.map((c) => c.student_id),
    ...waves.map((w) => w.student_id),
    ...statusUpdates.map((s) => s.student_id),
  ]
  const allProfiles = await batchGetProfileDisplayInfo([...staffIds, ...studentIds])

  return assembleFeedEntries({
    checkIns,
    waves,
    statusUpdates,
    instanceResolver: (item) => instanceMap.get(item.activity_instance_id),
    staffProfiles: allProfiles,
    studentProfiles: allProfiles,
  })
}

// Fetch the most recent N student actions across a teacher's activities as flat
// notification rows (not instance-grouped). Used by the teacher sidebar widget.
export async function getRecentTeacherActions(teacherId, { sinceDate, limit = 5 } = {}) {
  const { data: staffRows, error: staffError } = await supabase
    .from('activity_staff')
    .select('activity_id')
    .eq('user_id', teacherId)
  if (staffError) throw staffError

  const activityIds = staffRows.map((r) => r.activity_id)
  if (activityIds.length === 0) return []

  let instanceQuery = supabase
    .from('activity_instances')
    .select('id, date, activity:activity_id(id, name)')
    .in('activity_id', activityIds)
  if (sinceDate) instanceQuery = instanceQuery.gte('date', sinceDate)

  const { data: instances, error: instanceError } = await instanceQuery
  if (instanceError) throw instanceError
  if (instances.length === 0) return []

  const instanceIds = instances.map((i) => i.id)
  const instanceMap = new Map(instances.map((i) => [i.id, i]))

  const [checkInsResult, wavesResult, statusUpdatesResult] = await Promise.all([
    supabase.from('check_ins').select('student_id, activity_instance_id, checked_in_at').in('activity_instance_id', instanceIds),
    supabase.from('presence_waves').select('student_id, activity_instance_id, waved_at').in('activity_instance_id', instanceIds),
    supabase.from('status_updates').select('student_id, activity_instance_id, created_at, status_type').in('activity_instance_id', instanceIds),
  ])

  if (checkInsResult.error) throw checkInsResult.error
  if (wavesResult.error) throw wavesResult.error
  if (statusUpdatesResult.error) throw statusUpdatesResult.error

  const rows = [
    ...checkInsResult.data.map((ci) => ({
      type: 'checkin',
      studentId: ci.student_id,
      instanceId: ci.activity_instance_id,
      timestamp: ci.checked_in_at,
    })),
    ...wavesResult.data.map((w) => ({
      type: 'wave',
      studentId: w.student_id,
      instanceId: w.activity_instance_id,
      timestamp: w.waved_at,
    })),
    ...statusUpdatesResult.data.map((su) => ({
      type: 'status',
      studentId: su.student_id,
      instanceId: su.activity_instance_id,
      timestamp: su.created_at,
      statusType: su.status_type,
    })),
  ]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit)

  const studentIds = rows.map((r) => r.studentId)
  const studentProfiles = await batchGetProfileDisplayInfo(studentIds)

  return rows.map((r) => ({
    ...r,
    studentName: formatDisplayName(studentProfiles.get(r.studentId)),
    activityId: instanceMap.get(r.instanceId)?.activity?.id ?? null,
    activityName: instanceMap.get(r.instanceId)?.activity?.name ?? null,
    instanceDate: instanceMap.get(r.instanceId)?.date ?? null,
  }))
}
