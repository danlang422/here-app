'use server'

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/types/database'

type Section = Database['public']['Tables']['sections']['Row']
type SectionStudent = Database['public']['Tables']['section_students']['Row']
type User = Database['public']['Tables']['users']['Row']
type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row']
type Interaction = Database['public']['Tables']['interactions']['Row']
type AttendanceEvent = Database['public']['Tables']['attendance_events']['Row']

interface SectionWithDetails extends Section {
  total_students: number
  marked_students: number
  presence_count: number
  checked_in_count: number
  students: Array<{
    id: string
    first_name: string | null
    last_name: string | null
    email: string
    attendance_status: string | null
    attendance_notes: string | null
    presence_mood: string | null
    check_in_time: string | null
    check_in_verified: boolean | null
    check_out_time: string | null
    prompt_response: string | null
  }>
}

export async function getTeacherAgenda(date: string) {
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  // Parse the date to get day of week (0 = Sunday, 1 = Monday, etc.)
  const dateObj = new Date(date)
  const dayOfWeek = dateObj.getDay()

  // Get calendar day info (for A/B days)
  const { data: calendarDay } = await supabase
    .from('calendar_days')
    .select('is_school_day, ab_designation')
    .eq('date', date)
    .single()

  // If not a school day, return empty
  if (calendarDay && !calendarDay.is_school_day) {
    return []
  }

  // Get sections where this teacher is assigned
  const { data: teacherSections, error: sectionsError } = await supabase
    .from('section_teachers')
    .select(`
      section_id,
      sections (
        id,
        name,
        type,
        start_time,
        end_time,
        schedule_pattern,
        days_of_week,
        attendance_enabled,
        presence_enabled,
        presence_mood_enabled,
        parent_section_id
      )
    `)
    .eq('teacher_id', user.id)

  if (sectionsError) {
    throw new Error(`Failed to fetch sections: ${sectionsError.message}`)
  }

  // Filter sections based on schedule pattern
  const todaySections = teacherSections?.filter(ts => {
    const section = (ts.sections as any)
    if (!section) return false

    // Check schedule pattern
    if (section.schedule_pattern === 'every_day') {
      return true
    }
    
    if (section.schedule_pattern === 'specific_days') {
      const daysOfWeek = section.days_of_week as number[]
      return daysOfWeek?.includes(dayOfWeek)
    }
    
    if (section.schedule_pattern === 'a_days') {
      return calendarDay?.ab_designation === 'a_day'
    }
    
    if (section.schedule_pattern === 'b_days') {
      return calendarDay?.ab_designation === 'b_day'
    }
    
    return false
  }).map(ts => (ts.sections as any)) || []

  // For each section, get students and attendance data
  const sectionsWithDetails: SectionWithDetails[] = await Promise.all(
    todaySections.map(async (section: Section) => {
      // Get enrolled students
      const { data: enrollments } = await supabase
        .from('section_students')
        .select(`
          student_id,
          users (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('section_id', section.id)
        .eq('active', true)

      const studentIds = enrollments?.map(e => e.student_id) || []

      // Get attendance records for this date
      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('section_id', section.id)
        .eq('date', date)
        .in('student_id', studentIds)

      // Get presence interactions for this date
      const { data: presenceInteractions } = await supabase
        .from('interactions')
        .select('author_id, content, created_at')
        .eq('section_id', section.id)
        .eq('type', 'presence')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`)
        .in('author_id', studentIds)

      // Get check-in events for this date
      const { data: checkInEvents } = await supabase
        .from('attendance_events')
        .select('student_id, timestamp, location_verified, event_type')
        .eq('section_id', section.id)
        .gte('timestamp', `${date}T00:00:00`)
        .lte('timestamp', `${date}T23:59:59`)
        .in('student_id', studentIds)

      // Get prompt responses (linked to check-ins)
      const checkInIds = checkInEvents?.filter(e => e.event_type === 'check_in').map(e => e.student_id) || []
      let promptResponses: Interaction[] = []
      
      if (checkInIds.length > 0) {
        const { data: responses } = await supabase
          .from('interactions')
          .select('*')
          .eq('type', 'prompt_response')
          .in('author_id', checkInIds)
          .gte('created_at', `${date}T00:00:00`)
          .lte('created_at', `${date}T23:59:59`)
        
        promptResponses = responses || []
      }

      // Build student details
      const students = enrollments?.map(enrollment => {
        const user = (enrollment.users as any)
        
        // Skip if user data is missing
        if (!user) {
          console.warn(`Missing user data for enrollment:`, enrollment)
          return null
        }
        
        const attendance = attendanceRecords?.find(ar => ar.student_id === enrollment.student_id)
        const presence = presenceInteractions?.find(pi => pi.author_id === enrollment.student_id)
        const checkIn = checkInEvents?.find(ce => ce.student_id === enrollment.student_id && ce.event_type === 'check_in')
        const checkOut = checkInEvents?.find(ce => ce.student_id === enrollment.student_id && ce.event_type === 'check_out')
        const promptResponse = promptResponses?.find(pr => pr.author_id === enrollment.student_id)

        return {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          attendance_status: attendance?.status || null,
          attendance_notes: attendance?.notes || null,
          presence_mood: presence?.content || null,
          check_in_time: checkIn?.timestamp || null,
          check_in_verified: checkIn?.location_verified || null,
          check_out_time: checkOut?.timestamp || null,
          prompt_response: promptResponse?.content || null,
        }
      }).filter(Boolean) || [] // Filter out null entries

      // Calculate counts
      const total_students = students.length
      const marked_students = attendanceRecords?.length || 0
      const presence_count = presenceInteractions?.length || 0
      const checked_in_count = checkInEvents?.filter(e => e.event_type === 'check_in').length || 0

      return {
        ...section,
        total_students,
        marked_students,
        presence_count,
        checked_in_count,
        students: students.sort((a, b) => {
          const lastNameA = a.last_name || ''
          const lastNameB = b.last_name || ''
          return lastNameA.localeCompare(lastNameB)
        })
      }
    })
  )

  // Sort sections by start time
  return sectionsWithDetails.sort((a, b) => {
    return a.start_time.localeCompare(b.start_time)
  })
}
