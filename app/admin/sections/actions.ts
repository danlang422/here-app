'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/lib/types/database'

type SectionInsert = Database['public']['Tables']['sections']['Insert']
type SectionUpdate = Database['public']['Tables']['sections']['Update']

export type SectionFormData = {
  name: string
  type: Database['public']['Enums']['section_type']
  start_time: string
  end_time: string
  schedule_pattern: Database['public']['Enums']['schedule_pattern']
  days_of_week?: number[] // Array of day numbers: 0=Monday, 1=Tuesday, etc.
  teacher_id?: string
  location?: string
  sis_block?: number
  parent_section_id?: string
  student_ids?: string[] // Array of student IDs to enroll
  // Feature toggles
  attendance_enabled?: boolean
  presence_enabled?: boolean
  presence_mood_enabled?: boolean
  // Internship fields
  internship_opportunity_id?: string
  geofence_radius?: number
  // Instructor display fields
  instructor_name?: string
  show_assigned_teacher?: boolean
}

export type SectionWithTeachers = Database['public']['Tables']['sections']['Row'] & {
  section_teachers: Array<{
    teacher_id: string
    is_primary: boolean
    users: {
      id: string
      first_name: string | null
      last_name: string | null
      email: string
    }
  }>
  _count?: {
    section_students: number
  }
}

/**
 * Create a new section
 */
export async function createSection(data: SectionFormData) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Prepare section data
    const sectionData: SectionInsert = {
      name: data.name,
      type: data.type,
      start_time: data.start_time,
      end_time: data.end_time,
      schedule_pattern: data.schedule_pattern,
      days_of_week: data.days_of_week ? JSON.stringify(data.days_of_week) : null,
      sis_block: data.sis_block || null,
      parent_section_id: data.parent_section_id || null,
      created_by: user.id,
      // Feature toggles
      attendance_enabled: data.attendance_enabled ?? false,
      presence_enabled: data.presence_enabled ?? false,
      presence_mood_enabled: data.presence_mood_enabled ?? false,
      // Internship fields
      internship_opportunity_id: data.internship_opportunity_id || null,
      geofence_radius: data.geofence_radius || null,
      // Instructor display fields
      instructor_name: data.instructor_name || null,
      show_assigned_teacher: data.show_assigned_teacher ?? true,
    }

    // Handle location for in_person and internship types
    if (data.location && (data.type === 'in_person' || data.type === 'internship')) {
      sectionData.expected_location = JSON.stringify({ address: data.location })
    }

    // Insert section
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .insert(sectionData)
      .select()
      .single()

    if (sectionError) {
      console.error('Section creation error:', sectionError)
      return { success: false, error: sectionError.message }
    }

    // If teacher_id is provided, add them as primary teacher
    if (data.teacher_id && section) {
      const { error: teacherError } = await supabase
        .from('section_teachers')
        .insert({
          section_id: section.id,
          teacher_id: data.teacher_id,
          is_primary: true,
        })

      if (teacherError) {
        console.error('Teacher assignment error:', teacherError)
        // Don't fail the whole operation, just log it
      }
    }

    // If student_ids are provided, enroll them
    let enrolledCount = 0
    if (data.student_ids && data.student_ids.length > 0 && section) {
      const enrollResult = await enrollStudents(section.id, data.student_ids)
      if (enrollResult.success && 'enrolled' in enrollResult) {
        enrolledCount = enrollResult.enrolled || 0
      }
    }

    revalidatePath('/admin/sections')
    return { success: true, data: section, enrolled: enrolledCount }
  } catch (error) {
    console.error('Unexpected error creating section:', error)
    return { success: false, error: 'Failed to create section' }
  }
}

/**
 * Update an existing section
 */
export async function updateSection(sectionId: string, data: SectionFormData) {
  const supabase = await createClient()
  
  try {
    // Prepare section data
    const sectionData: SectionUpdate = {
      name: data.name,
      type: data.type,
      start_time: data.start_time,
      end_time: data.end_time,
      schedule_pattern: data.schedule_pattern,
      days_of_week: data.days_of_week ? JSON.stringify(data.days_of_week) : null,
      sis_block: data.sis_block || null,
      parent_section_id: data.parent_section_id || null,
      updated_at: new Date().toISOString(),
      // Feature toggles
      attendance_enabled: data.attendance_enabled ?? false,
      presence_enabled: data.presence_enabled ?? false,
      presence_mood_enabled: data.presence_mood_enabled ?? false,
      // Internship fields
      internship_opportunity_id: data.internship_opportunity_id || null,
      geofence_radius: data.geofence_radius || null,
      // Instructor display fields
      instructor_name: data.instructor_name || null,
      show_assigned_teacher: data.show_assigned_teacher ?? true,
    }

    // Handle location
    if (data.location && (data.type === 'in_person' || data.type === 'internship')) {
      sectionData.expected_location = JSON.stringify({ address: data.location })
    } else {
      sectionData.expected_location = null
    }

    // Update section
    const { data: section, error: sectionError } = await supabase
      .from('sections')
      .update(sectionData)
      .eq('id', sectionId)
      .select()
      .single()

    if (sectionError) {
      console.error('Section update error:', sectionError)
      return { success: false, error: sectionError.message }
    }

    // Update teacher if provided
    if (data.teacher_id) {
      // Remove existing primary teacher
      await supabase
        .from('section_teachers')
        .delete()
        .eq('section_id', sectionId)
        .eq('is_primary', true)

      // Add new primary teacher
      const { error: teacherError } = await supabase
        .from('section_teachers')
        .insert({
          section_id: sectionId,
          teacher_id: data.teacher_id,
          is_primary: true,
        })

      if (teacherError) {
        console.error('Teacher assignment error:', teacherError)
      }
    }

    // Update student enrollment if provided
    let enrolledCount = 0
    if (data.student_ids && data.student_ids.length > 0) {
      const enrollResult = await enrollStudents(sectionId, data.student_ids)
      if (enrollResult.success && 'enrolled' in enrollResult) {
        enrolledCount = enrollResult.enrolled || 0
      }
    }

    revalidatePath('/admin/sections')
    revalidatePath(`/admin/sections/${sectionId}`)
    return { success: true, data: section, enrolled: enrolledCount }
  } catch (error) {
    console.error('Unexpected error updating section:', error)
    return { success: false, error: 'Failed to update section' }
  }
}

/**
 * Get all sections with teacher info and enrollment count
 * Uses a single query with the sections_with_enrollment_counts view to eliminate N+1 queries
 */
export async function getSections() {
  const supabase = await createClient()

  try {
    // Query the view which pre-computes active student counts
    const { data: sections, error } = await supabase
      .from('sections_with_enrollment_counts')
      .select(`
        *,
        section_teachers (
          teacher_id,
          is_primary,
          users:teacher_id (
            id,
            first_name,
            last_name,
            email
          )
        )
      `)
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching sections:', error)
      return { success: false, error: error.message }
    }

    // Transform data to match SectionWithTeachers type
    const sectionsWithCounts = (sections || []).map((section: any) => {
      const { active_student_count, ...sectionData } = section
      return {
        ...sectionData,
        _count: {
          section_students: active_student_count || 0,
        },
      }
    })

    return { success: true, data: sectionsWithCounts as SectionWithTeachers[] }
  } catch (error) {
    console.error('Unexpected error fetching sections:', error)
    return { success: false, error: 'Failed to fetch sections' }
  }
}

/**
 * Get a single section by ID with full details
 * Uses the sections_with_enrollment_counts view for consistency
 */
export async function getSection(sectionId: string) {
  const supabase = await createClient()

  try {
    const { data: section, error } = await supabase
      .from('sections_with_enrollment_counts')
      .select(`
        *,
        section_teachers (
          teacher_id,
          is_primary,
          users:teacher_id (
            id,
            first_name,
            last_name,
            email
          )
        )
      `)
      .eq('id', sectionId)
      .single()

    if (error) {
      console.error('Error fetching section:', error)
      return { success: false, error: error.message }
    }

    // Transform data to match SectionWithTeachers type
    const { active_student_count, ...sectionData } = section as any
    const sectionWithCount = {
      ...sectionData,
      _count: {
        section_students: active_student_count || 0,
      },
    }

    return { success: true, data: sectionWithCount as SectionWithTeachers }
  } catch (error) {
    console.error('Unexpected error fetching section:', error)
    return { success: false, error: 'Failed to fetch section' }
  }
}

/**
 * Delete a section
 */
export async function deleteSection(sectionId: string) {
  const supabase = await createClient()
  
  try {
    // Check if section has enrolled students
    const { count } = await supabase
      .from('section_students')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', sectionId)
      .eq('active', true)

    if (count && count > 0) {
      return { success: false, error: `Cannot delete section with ${count} enrolled students` }
    }

    // Delete section (cascade will handle section_teachers)
    const { error } = await supabase
      .from('sections')
      .delete()
      .eq('id', sectionId)

    if (error) {
      console.error('Error deleting section:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/sections')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error deleting section:', error)
    return { success: false, error: 'Failed to delete section' }
  }
}

/**
 * Get potential parent sections
 * Returns all sections ordered by time to help with grouping
 */
export async function getPotentialParentSections() {
  const supabase = await createClient()
  
  try {
    const { data: sections, error } = await supabase
      .from('sections')
      .select('id, name, type, start_time, end_time, schedule_pattern')
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching potential parent sections:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: sections }
  } catch (error) {
    console.error('Unexpected error fetching potential parent sections:', error)
    return { success: false, error: 'Failed to fetch potential parent sections' }
  }
}

/**
 * Get all teachers (users with teacher role)
 */
export async function getTeachers() {
  const supabase = await createClient()
  
  try {
    const { data: teachers, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('primary_role', 'teacher')
      .order('last_name', { ascending: true })

    if (error) {
      console.error('Error fetching teachers:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: teachers }
  } catch (error) {
    console.error('Unexpected error fetching teachers:', error)
    return { success: false, error: 'Failed to fetch teachers' }
  }
}

/**
 * Get all students (users with student role)
 */
export async function getStudents() {
  const supabase = await createClient()
  
  try {
    const { data: students, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('primary_role', 'student')
      .order('last_name', { ascending: true })

    if (error) {
      console.error('Error fetching students:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: students }
  } catch (error) {
    console.error('Unexpected error fetching students:', error)
    return { success: false, error: 'Failed to fetch students' }
  }
}

/**
 * Get students enrolled in a specific section
 */
export async function getEnrolledStudents(sectionId: string) {
  const supabase = await createClient()
  
  try {
    const { data: enrollments, error } = await supabase
      .from('section_students')
      .select(`
        id,
        enrolled_at,
        active,
        users:student_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('section_id', sectionId)
      .eq('active', true)
      .order('enrolled_at', { ascending: true })

    if (error) {
      console.error('Error fetching enrolled students:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: enrollments }
  } catch (error) {
    console.error('Unexpected error fetching enrolled students:', error)
    return { success: false, error: 'Failed to fetch enrolled students' }
  }
}

/**
 * Enroll multiple students in a section
 */
export async function enrollStudents(sectionId: string, studentIds: string[]) {
  const supabase = await createClient()
  
  try {
    // Check which students are already enrolled (active or inactive)
    const { data: existingEnrollments } = await supabase
      .from('section_students')
      .select('student_id, active')
      .eq('section_id', sectionId)
      .in('student_id', studentIds)

    const existingMap = new Map(
      (existingEnrollments || []).map(e => [e.student_id, e.active])
    )

    // Separate students into new enrollments and reactivations
    const newEnrollments: Array<{ section_id: string; student_id: string }> = []
    const reactivations: string[] = []

    studentIds.forEach(studentId => {
      if (!existingMap.has(studentId)) {
        // New enrollment
        newEnrollments.push({
          section_id: sectionId,
          student_id: studentId,
        })
      } else if (existingMap.get(studentId) === false) {
        // Inactive enrollment - reactivate it
        reactivations.push(studentId)
      }
      // If already active, skip (idempotent)
    })

    // Insert new enrollments
    if (newEnrollments.length > 0) {
      const { error: insertError } = await supabase
        .from('section_students')
        .insert(newEnrollments)

      if (insertError) {
        console.error('Error enrolling students:', insertError)
        return { success: false, error: insertError.message }
      }
    }

    // Reactivate inactive enrollments
    if (reactivations.length > 0) {
      const { error: updateError } = await supabase
        .from('section_students')
        .update({ active: true, enrolled_at: new Date().toISOString() })
        .eq('section_id', sectionId)
        .in('student_id', reactivations)

      if (updateError) {
        console.error('Error reactivating students:', updateError)
        return { success: false, error: updateError.message }
      }
    }

    revalidatePath('/admin/sections')
    revalidatePath(`/admin/sections/${sectionId}`)
    return { 
      success: true, 
      enrolled: newEnrollments.length + reactivations.length,
      skipped: studentIds.length - newEnrollments.length - reactivations.length 
    }
  } catch (error) {
    console.error('Unexpected error enrolling students:', error)
    return { success: false, error: 'Failed to enroll students' }
  }
}

/**
 * Get all active internship opportunities
 */
export async function getInternshipOpportunities() {
  const supabase = await createClient()
  
  try {
    const { data: opportunities, error } = await supabase
      .from('internship_opportunities')
      .select('id, organization_name, name, location, geofence_radius')
      .eq('is_active', true)
      .order('organization_name', { ascending: true })

    if (error) {
      console.error('Error fetching internship opportunities:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: opportunities }
  } catch (error) {
    console.error('Unexpected error fetching internship opportunities:', error)
    return { success: false, error: 'Failed to fetch internship opportunities' }
  }
}

/**
 * Unenroll a student from a section (soft delete - sets active to false)
 */
export async function unenrollStudent(sectionId: string, studentId: string) {
  const supabase = await createClient()
  
  try {
    const { error } = await supabase
      .from('section_students')
      .update({ active: false })
      .eq('section_id', sectionId)
      .eq('student_id', studentId)

    if (error) {
      console.error('Error unenrolling student:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/sections')
    revalidatePath(`/admin/sections/${sectionId}`)
    return { success: true }
  } catch (error) {
    console.error('Unexpected error unenrolling student:', error)
    return { success: false, error: 'Failed to unenroll student' }
  }
}

/**
 * Bulk update multiple sections with the same changes
 * Used for enabling/disabling attendance and presence features across multiple sections
 */
export async function bulkUpdateSections(
  sectionIds: string[],
  updates: {
    attendance_enabled?: boolean
    presence_enabled?: boolean
    presence_mood_enabled?: boolean
  }
) {
  // Use admin client for bulk operations to bypass RLS
  const supabase = createAdminClient()

  try {
    // Validate that we have sections to update
    if (!sectionIds || sectionIds.length === 0) {
      return { success: false, error: 'No sections selected' }
    }

    // Validate that we have updates to apply
    if (Object.keys(updates).length === 0) {
      return { success: false, error: 'No updates specified' }
    }

    // Prepare update data
    const updateData: SectionUpdate = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    // Perform bulk update
    const { error } = await supabase
      .from('sections')
      .update(updateData)
      .in('id', sectionIds)

    if (error) {
      console.error('Error bulk updating sections:', error)
      return { success: false, error: error.message }
    }

    // Revalidate the sections list page
    revalidatePath('/admin/sections')
    
    return { success: true, count: sectionIds.length }
  } catch (error) {
    console.error('Unexpected error bulk updating sections:', error)
    return { success: false, error: 'Failed to bulk update sections' }
  }
}
