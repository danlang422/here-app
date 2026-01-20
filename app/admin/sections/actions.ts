'use server'

import { createClient } from '@/lib/supabase/server'
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
      created_by: user.id,
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

    revalidatePath('/admin/sections')
    return { success: true, data: section }
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
      updated_at: new Date().toISOString(),
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

    revalidatePath('/admin/sections')
    revalidatePath(`/admin/sections/${sectionId}`)
    return { success: true, data: section }
  } catch (error) {
    console.error('Unexpected error updating section:', error)
    return { success: false, error: 'Failed to update section' }
  }
}

/**
 * Get all sections with teacher info and enrollment count
 */
export async function getSections() {
  const supabase = await createClient()
  
  try {
    const { data: sections, error } = await supabase
      .from('sections')
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

    // Get enrollment counts for each section
    const sectionsWithCounts = await Promise.all(
      (sections || []).map(async (section) => {
        const { count } = await supabase
          .from('section_students')
          .select('*', { count: 'exact', head: true })
          .eq('section_id', section.id)
          .eq('active', true)

        return {
          ...section,
          _count: {
            section_students: count || 0,
          },
        }
      })
    )

    return { success: true, data: sectionsWithCounts as SectionWithTeachers[] }
  } catch (error) {
    console.error('Unexpected error fetching sections:', error)
    return { success: false, error: 'Failed to fetch sections' }
  }
}

/**
 * Get a single section by ID with full details
 */
export async function getSection(sectionId: string) {
  const supabase = await createClient()
  
  try {
    const { data: section, error } = await supabase
      .from('sections')
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

    // Get enrollment count
    const { count } = await supabase
      .from('section_students')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', sectionId)
      .eq('active', true)

    const sectionWithCount = {
      ...section,
      _count: {
        section_students: count || 0,
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
