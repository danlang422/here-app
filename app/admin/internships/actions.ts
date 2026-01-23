'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/lib/types/database'

type InternshipInsert = Database['public']['Tables']['internship_opportunities']['Insert']
type InternshipUpdate = Database['public']['Tables']['internship_opportunities']['Update']

export type InternshipFormData = {
  name: string
  organization_name: string
  description?: string
  location?: {
    formatted_address: string
    lat: number
    lng: number
    place_id?: string
  }
  geofence_radius?: number
  mentor_id?: string
  contact_phone?: string
  contact_email?: string
  available_slots?: number
  is_active?: boolean
  requirements?: string
}

export type InternshipWithMentor = Database['public']['Tables']['internship_opportunities']['Row'] & {
  mentor?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  _count?: {
    sections: number
  }
}

/**
 * Create a new internship opportunity
 */
export async function createInternship(data: InternshipFormData) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Prepare internship data
    const internshipData: InternshipInsert = {
      name: data.name,
      organization_name: data.organization_name,
      description: data.description || null,
      location: data.location ? JSON.stringify(data.location) : null,
      geofence_radius: data.geofence_radius || 100,
      mentor_id: data.mentor_id || null,
      contact_phone: data.contact_phone || null,
      contact_email: data.contact_email || null,
      available_slots: data.available_slots || null,
      is_active: data.is_active ?? true,
      requirements: data.requirements || null,
      created_by: user.id,
    }

    // Insert internship
    const { data: internship, error: internshipError } = await supabase
      .from('internship_opportunities')
      .insert(internshipData)
      .select()
      .single()

    if (internshipError) {
      console.error('Internship creation error:', internshipError)
      return { success: false, error: internshipError.message }
    }

    revalidatePath('/admin/internships')
    return { success: true, data: internship }
  } catch (error) {
    console.error('Unexpected error creating internship:', error)
    return { success: false, error: 'Failed to create internship' }
  }
}

/**
 * Update an existing internship opportunity
 */
export async function updateInternship(internshipId: string, data: InternshipFormData) {
  const supabase = await createClient()
  
  try {
    // Prepare internship data
    const internshipData: InternshipUpdate = {
      name: data.name,
      organization_name: data.organization_name,
      description: data.description || null,
      location: data.location ? JSON.stringify(data.location) : null,
      geofence_radius: data.geofence_radius || 100,
      mentor_id: data.mentor_id || null,
      contact_phone: data.contact_phone || null,
      contact_email: data.contact_email || null,
      available_slots: data.available_slots || null,
      is_active: data.is_active ?? true,
      requirements: data.requirements || null,
      updated_at: new Date().toISOString(),
    }

    // Update internship
    const { data: internship, error: internshipError } = await supabase
      .from('internship_opportunities')
      .update(internshipData)
      .eq('id', internshipId)
      .select()
      .single()

    if (internshipError) {
      console.error('Internship update error:', internshipError)
      return { success: false, error: internshipError.message }
    }

    revalidatePath('/admin/internships')
    revalidatePath(`/admin/internships/${internshipId}`)
    return { success: true, data: internship }
  } catch (error) {
    console.error('Unexpected error updating internship:', error)
    return { success: false, error: 'Failed to update internship' }
  }
}

/**
 * Get all internship opportunities with mentor info and section count
 */
export async function getInternships() {
  const supabase = await createClient()

  try {
    const { data: internships, error } = await supabase
      .from('internship_opportunities')
      .select(`
        *,
        mentor:mentor_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .order('organization_name', { ascending: true })

    if (error) {
      console.error('Error fetching internships:', error)
      return { success: false, error: error.message }
    }

    // Get section counts for each internship
    const internshipsWithCounts = await Promise.all(
      (internships || []).map(async (internship) => {
        const { count } = await supabase
          .from('sections')
          .select('*', { count: 'exact', head: true })
          .eq('internship_opportunity_id', internship.id)

        return {
          ...internship,
          _count: {
            sections: count || 0,
          },
        }
      })
    )

    return { success: true, data: internshipsWithCounts as InternshipWithMentor[] }
  } catch (error) {
    console.error('Unexpected error fetching internships:', error)
    return { success: false, error: 'Failed to fetch internships' }
  }
}

/**
 * Get a single internship opportunity by ID
 */
export async function getInternship(internshipId: string) {
  const supabase = await createClient()

  try {
    const { data: internship, error } = await supabase
      .from('internship_opportunities')
      .select(`
        *,
        mentor:mentor_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', internshipId)
      .single()

    if (error) {
      console.error('Error fetching internship:', error)
      return { success: false, error: error.message }
    }

    // Get section count
    const { count } = await supabase
      .from('sections')
      .select('*', { count: 'exact', head: true })
      .eq('internship_opportunity_id', internshipId)

    const internshipWithCount = {
      ...internship,
      _count: {
        sections: count || 0,
      },
    }

    return { success: true, data: internshipWithCount as InternshipWithMentor }
  } catch (error) {
    console.error('Unexpected error fetching internship:', error)
    return { success: false, error: 'Failed to fetch internship' }
  }
}

/**
 * Delete an internship opportunity
 */
export async function deleteInternship(internshipId: string) {
  const supabase = await createClient()
  
  try {
    // Check if internship has associated sections
    const { count } = await supabase
      .from('sections')
      .select('*', { count: 'exact', head: true })
      .eq('internship_opportunity_id', internshipId)

    if (count && count > 0) {
      return { success: false, error: `Cannot delete internship with ${count} associated section(s)` }
    }

    // Delete internship
    const { error } = await supabase
      .from('internship_opportunities')
      .delete()
      .eq('id', internshipId)

    if (error) {
      console.error('Error deleting internship:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/internships')
    return { success: true }
  } catch (error) {
    console.error('Unexpected error deleting internship:', error)
    return { success: false, error: 'Failed to delete internship' }
  }
}

/**
 * Get all mentors (users with mentor role)
 */
export async function getMentors() {
  const supabase = await createClient()
  
  try {
    const { data: mentors, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('primary_role', 'mentor')
      .order('last_name', { ascending: true })

    if (error) {
      console.error('Error fetching mentors:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: mentors }
  } catch (error) {
    console.error('Unexpected error fetching mentors:', error)
    return { success: false, error: 'Failed to fetch mentors' }
  }
}
