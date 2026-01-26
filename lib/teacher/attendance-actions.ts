'use server'

import { createClient } from '@/lib/supabase/server'

interface AttendanceData {
  studentId: string
  status: string | null // 'present', 'absent', 'excused', or null to clear
  notes?: string
}

interface SaveAttendanceResult {
  success: boolean
  error?: string
  savedCount?: number
}

/**
 * Save or update attendance records for multiple students in a section
 * 
 * @param sectionId - The section ID
 * @param date - The date in YYYY-MM-DD format
 * @param attendanceData - Array of student attendance updates
 * @returns Result indicating success/failure and count of saved records
 */
export async function saveAttendance(
  sectionId: string,
  date: string,
  attendanceData: AttendanceData[]
): Promise<SaveAttendanceResult> {
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify teacher is assigned to this section
  const { data: teacherAssignment, error: assignmentError } = await supabase
    .from('section_teachers')
    .select('id')
    .eq('section_id', sectionId)
    .eq('teacher_id', user.id)
    .single()

  if (assignmentError || !teacherAssignment) {
    return { 
      success: false, 
      error: 'You are not assigned to this section' 
    }
  }

  // Filter out records where status is null or empty (user unmarked)
  const recordsToSave = attendanceData.filter(record => 
    record.status && record.status.trim() !== ''
  )

  // If no records to save, we still succeed (user may have unmarked everything)
  if (recordsToSave.length === 0) {
    // Delete any existing records for students that were unmarked
    const studentsToDelete = attendanceData
      .filter(record => !record.status || record.status.trim() === '')
      .map(record => record.studentId)

    if (studentsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('attendance_records')
        .delete()
        .eq('section_id', sectionId)
        .eq('date', date)
        .in('student_id', studentsToDelete)

      if (deleteError) {
        return {
          success: false,
          error: `Failed to clear unmarked records: ${deleteError.message}`
        }
      }
    }

    return { success: true, savedCount: 0 }
  }

  // Prepare records for upsert
  const records = recordsToSave.map(record => ({
    student_id: record.studentId,
    section_id: sectionId,
    date: date,
    status: record.status,
    notes: record.notes || null,
    marked_by: user.id,
    updated_at: new Date().toISOString()
  }))

  // Upsert attendance records
  // On conflict (student_id, section_id, date), update the existing record
  const { error: upsertError } = await supabase
    .from('attendance_records')
    .upsert(records, {
      onConflict: 'student_id,section_id,date'
    })

  if (upsertError) {
    return {
      success: false,
      error: `Failed to save attendance: ${upsertError.message}`
    }
  }

  // Also handle deletion of unmarked records (in case user changed a status to empty)
  const studentsToDelete = attendanceData
    .filter(record => !record.status || record.status.trim() === '')
    .map(record => record.studentId)

  if (studentsToDelete.length > 0) {
    await supabase
      .from('attendance_records')
      .delete()
      .eq('section_id', sectionId)
      .eq('date', date)
      .in('student_id', studentsToDelete)
  }

  return {
    success: true,
    savedCount: recordsToSave.length
  }
}
