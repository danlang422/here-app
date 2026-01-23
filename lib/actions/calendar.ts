'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type CalendarDay = {
  date: string
  is_school_day: boolean
  ab_designation: 'a_day' | 'b_day' | null
  notes: string | null
}

export async function uploadCalendarCSV(formData: FormData) {
  try {
    const file = formData.get('file') as File
    if (!file) {
      return { success: false, errors: ['No file provided'] }
    }

    // Parse CSV
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return { success: false, errors: ['CSV file is empty or invalid'] }
    }

    // Parse header
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
    const dateIndex = headers.indexOf('date')
    const typeIndex = headers.indexOf('day_type')

    if (dateIndex === -1 || typeIndex === -1) {
      return { 
        success: false, 
        errors: ['CSV must have "date" and "day_type" columns'] 
      }
    }

    // Parse data rows
    const calendarDays: CalendarDay[] = []
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const date = values[dateIndex]
      const dayType = values[typeIndex]?.toUpperCase()

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push(`Row ${i + 1}: Invalid date format "${date}" (expected YYYY-MM-DD)`)
        continue
      }

      // Validate day type
      if (!['A', 'B', 'OFF'].includes(dayType)) {
        errors.push(`Row ${i + 1}: Invalid day_type "${dayType}" (expected A, B, or off)`)
        continue
      }

      // Convert to database format
      calendarDays.push({
        date,
        is_school_day: dayType !== 'OFF',
        ab_designation: dayType === 'A' ? 'a_day' : dayType === 'B' ? 'b_day' : null,
        notes: dayType === 'OFF' ? 'Day off' : null
      })
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return { success: false, errors }
    }

    // Insert into database
    const supabase = await createClient()
    
    // Delete existing calendar days first (to allow re-upload)
    const { error: deleteError } = await supabase
      .from('calendar_days')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteError) {
      return { 
        success: false, 
        errors: [`Database error: ${deleteError.message}`] 
      }
    }

    // Insert new calendar days
    const { error: insertError } = await supabase
      .from('calendar_days')
      .insert(calendarDays)

    if (insertError) {
      return { 
        success: false, 
        errors: [`Database error: ${insertError.message}`] 
      }
    }

    // Revalidate the settings page
    revalidatePath('/admin/settings')

    return { 
      success: true, 
      imported: calendarDays.length,
      skipped: 0 
    }

  } catch (error) {
    console.error('Calendar upload error:', error)
    return { 
      success: false, 
      errors: ['An unexpected error occurred during upload'] 
    }
  }
}

export async function getCalendarDays(startDate?: string, endDate?: string) {
  const supabase = await createClient()
  
  let query = supabase
    .from('calendar_days')
    .select('*')
    .order('date')

  if (startDate) {
    query = query.gte('date', startDate)
  }
  
  if (endDate) {
    query = query.lte('date', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching calendar days:', error)
    return []
  }

  return data || []
}

export async function markDayOff(date: string) {
  const supabase = await createClient()
  
  // Check if day already exists
  const { data: existing } = await supabase
    .from('calendar_days')
    .select('id')
    .eq('date', date)
    .single()

  if (existing) {
    // Update existing day to mark as off
    const { error } = await supabase
      .from('calendar_days')
      .update({
        is_school_day: false,
        ab_designation: null,
        notes: 'Day off'
      })
      .eq('date', date)

    if (error) throw error
  } else {
    // Insert new day marked as off
    const { error } = await supabase
      .from('calendar_days')
      .insert({
        date,
        is_school_day: false,
        ab_designation: null,
        notes: 'Day off'
      })

    if (error) throw error
  }

  revalidatePath('/admin/settings')
}

export async function unmarkDayOff(date: string) {
  const supabase = await createClient()
  
  // Delete the day entry (reverts to default behavior)
  const { error } = await supabase
    .from('calendar_days')
    .delete()
    .eq('date', date)

  if (error) throw error

  revalidatePath('/admin/settings')
}
