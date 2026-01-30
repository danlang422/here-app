'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get student's schedule for a specific date
 */
export async function getStudentSchedule(date: string) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('Authentication error:', authError)
    return []
  }

  // Get day of week and check if it's an A or B day
  const targetDate = new Date(date)
  const dayOfWeek = targetDate.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Get calendar day info for A/B designation
  const { data: calendarDay } = await supabase
    .from('calendar_days')
    .select('ab_designation')
    .eq('date', date)
    .single()

  const abDesignation = calendarDay?.ab_designation

  // Query sections where student is enrolled
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('section_students')
    .select(
      `
      section_id,
      sections!inner (
        id,
        name,
        type,
        start_time,
        end_time,
        presence_enabled,
        schedule_pattern,
        days_of_week
      )
    `
    )
    .eq('student_id', user.id)
    .eq('active', true)

  if (enrollmentError) {
    console.error('Error fetching enrollments:', enrollmentError)
    return []
  }

  if (!enrollments) return []

  // Filter sections based on schedule pattern
  const filteredSections = enrollments
    .filter((enrollment: any) => {
      const section = enrollment.sections
      const schedulePattern = section.schedule_pattern

      if (schedulePattern === 'every_day') {
        return true
      } else if (schedulePattern === 'specific_days') {
        const daysOfWeek = section.days_of_week as number[]
        return daysOfWeek && daysOfWeek.includes(dayOfWeek)
      } else if (schedulePattern === 'a_days') {
        return abDesignation === 'a_day'
      } else if (schedulePattern === 'b_days') {
        return abDesignation === 'b_day'
      }
      return false
    })
    .map((enrollment: any) => enrollment.sections)

  // For each section, check if student has checked in/out today
  const sectionsWithStatus = await Promise.all(
    filteredSections.map(async (section: any) => {
      // Check for check-in event
      const { data: checkInEvent } = await supabase
        .from('attendance_events')
        .select('id, timestamp')
        .eq('section_id', section.id)
        .eq('student_id', user.id)
        .eq('event_type', 'check_in')
        .gte('timestamp', `${date}T00:00:00`)
        .lte('timestamp', `${date}T23:59:59`)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single()

      // Check for check-out event
      const { data: checkOutEvent } = await supabase
        .from('attendance_events')
        .select('id')
        .eq('section_id', section.id)
        .eq('student_id', user.id)
        .eq('event_type', 'check_out')
        .gte('timestamp', `${date}T00:00:00`)
        .lte('timestamp', `${date}T23:59:59`)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single()

      // Check for presence wave
      const { data: presenceWave } = await supabase
        .from('interactions')
        .select('id')
        .eq('section_id', section.id)
        .eq('author_id', user.id)
        .eq('type', 'presence')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)
        .limit(1)
        .single()

      // Get plans from check-in interaction
      let existingPlans = null
      if (checkInEvent) {
        const { data: plansInteraction } = await supabase
          .from('interactions')
          .select('content')
          .eq('attendance_event_id', checkInEvent.id)
          .eq('type', 'prompt_response')
          .limit(1)
          .single()

        existingPlans = plansInteraction?.content || null
      }

      // Get progress from check-out interaction
      let existingProgress = null
      if (checkOutEvent) {
        const { data: progressInteraction } = await supabase
          .from('interactions')
          .select('content')
          .eq('attendance_event_id', checkOutEvent.id)
          .eq('type', 'prompt_response')
          .limit(1)
          .single()

        existingProgress = progressInteraction?.content || null
      }

      return {
        id: section.id,
        name: section.name,
        section_type: section.type,
        start_time: section.start_time,
        end_time: section.end_time,
        presence_enabled: section.presence_enabled,
        hasCheckedIn: !!checkInEvent,
        hasCheckedOut: !!checkOutEvent,
        hasWaved: !!presenceWave,
        existingPlans,
        existingProgress,
      }
    })
  )

  // Sort by start time
  sectionsWithStatus.sort((a, b) => a.start_time.localeCompare(b.start_time))

  return sectionsWithStatus
}

/**
 * Create presence wave (optional, casual)
 */
export async function createPresenceWave(sectionId: string, moodEmoji?: string) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify section has presence_enabled
  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('presence_enabled')
    .eq('id', sectionId)
    .single()

  if (sectionError || !section) {
    return { success: false, error: 'Section not found' }
  }

  if (!section.presence_enabled) {
    return { success: false, error: 'Presence waves not enabled for this section' }
  }

  // Create interaction record
  const { data: interaction, error: interactionError } = await supabase
    .from('interactions')
    .insert({
      type: 'presence',
      section_id: sectionId,
      author_id: user.id,
      author_role: 'student',
      content: moodEmoji || '👋',
    })
    .select()
    .single()

  if (interactionError) {
    console.error('Error creating presence wave:', interactionError)
    return { success: false, error: 'Failed to create presence wave' }
  }

  revalidatePath('/student/agenda')
  return { success: true, data: interaction }
}

/**
 * Create check-in (required, with prompt)
 */
export async function createCheckIn(sectionId: string, plans: string, location?: any) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify section requires check-in (remote or internship)
  const { data: section, error: sectionError } = await supabase
    .from('sections')
    .select('type, expected_location, geofence_radius')
    .eq('id', sectionId)
    .single()

  if (sectionError || !section) {
    return { success: false, error: 'Section not found' }
  }

  if (section.type !== 'remote' && section.type !== 'internship') {
    return { success: false, error: 'This section does not require check-in' }
  }

  // Check if already checked in today
  const today = new Date().toISOString().split('T')[0]
  const { data: existingCheckIn } = await supabase
    .from('attendance_events')
    .select('id')
    .eq('section_id', sectionId)
    .eq('student_id', user.id)
    .eq('event_type', 'check_in')
    .gte('timestamp', `${today}T00:00:00`)
    .lte('timestamp', `${today}T23:59:59`)
    .limit(1)
    .single()

  if (existingCheckIn) {
    return { success: false, error: 'Already checked in today' }
  }

  // For internships, perform soft location verification
  let locationVerified = null
  if (section.type === 'internship' && location) {
    // Soft check - just log the location, don't enforce strictly
    locationVerified = true // Could implement actual geofencing here
  }

  // Create attendance_event record
  const { data: attendanceEvent, error: attendanceError } = await supabase
    .from('attendance_events')
    .insert({
      event_type: 'check_in',
      section_id: sectionId,
      student_id: user.id,
      timestamp: new Date().toISOString(),
      location: location || null,
      location_verified: locationVerified,
    })
    .select()
    .single()

  if (attendanceError) {
    console.error('Error creating attendance event:', attendanceError)
    return { success: false, error: 'Failed to create check-in' }
  }

  // Create interaction record with plans
  const { error: interactionError } = await supabase.from('interactions').insert({
    type: 'prompt_response',
    attendance_event_id: attendanceEvent.id,
    section_id: sectionId,
    author_id: user.id,
    author_role: 'student',
    content: plans,
  })

  if (interactionError) {
    console.error('Error creating interaction:', interactionError)
    // Don't fail the check-in if interaction fails, just log it
  }

  revalidatePath('/student/agenda')
  return { success: true, data: attendanceEvent }
}

/**
 * Create check-out (required, with prompt)
 */
export async function createCheckOut(sectionId: string, progress: string) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Check if already checked out today
  const today = new Date().toISOString().split('T')[0]
  const { data: existingCheckOut } = await supabase
    .from('attendance_events')
    .select('id')
    .eq('section_id', sectionId)
    .eq('student_id', user.id)
    .eq('event_type', 'check_out')
    .gte('timestamp', `${today}T00:00:00`)
    .lte('timestamp', `${today}T23:59:59`)
    .limit(1)
    .single()

  if (existingCheckOut) {
    return { success: false, error: 'Already checked out today' }
  }

  // Verify student has checked in today
  const { data: checkInEvent } = await supabase
    .from('attendance_events')
    .select('id')
    .eq('section_id', sectionId)
    .eq('student_id', user.id)
    .eq('event_type', 'check_in')
    .gte('timestamp', `${today}T00:00:00`)
    .lte('timestamp', `${today}T23:59:59`)
    .limit(1)
    .single()

  if (!checkInEvent) {
    return { success: false, error: 'Must check in before checking out' }
  }

  // Create attendance_event record
  const { data: attendanceEvent, error: attendanceError } = await supabase
    .from('attendance_events')
    .insert({
      event_type: 'check_out',
      section_id: sectionId,
      student_id: user.id,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single()

  if (attendanceError) {
    console.error('Error creating attendance event:', attendanceError)
    return { success: false, error: 'Failed to create check-out' }
  }

  // Create interaction record with progress
  const { error: interactionError } = await supabase.from('interactions').insert({
    type: 'prompt_response',
    attendance_event_id: attendanceEvent.id,
    section_id: sectionId,
    author_id: user.id,
    author_role: 'student',
    content: progress,
  })

  if (interactionError) {
    console.error('Error creating interaction:', interactionError)
    // Don't fail the check-out if interaction fails, just log it
  }

  revalidatePath('/student/agenda')
  return { success: true, data: attendanceEvent }
}
