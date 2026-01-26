'use client'

import { useState } from 'react'
import { saveAttendance } from '@/lib/teacher/attendance-actions'

interface Student {
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
}

interface Section {
  id: string
  name: string
  type: string
  start_time: string
  end_time: string
  attendance_enabled: boolean | null
  total_students: number
  students: Student[]
}

interface AttendanceModalProps {
  section: Section
  date: string
  onClose: () => void
  onUpdate: () => void
}

export default function AttendanceModal({ section, date, onClose, onUpdate }: AttendanceModalProps) {
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set())
  const [attendanceData, setAttendanceData] = useState<Record<string, string>>(
    section.students.reduce((acc, student) => ({
      ...acc,
      [student.id]: student.attendance_status || ''
    }), {})
  )
  const [notes, setNotes] = useState<Record<string, string>>(
    section.students.reduce((acc, student) => ({
      ...acc,
      [student.id]: student.attendance_notes || ''
    }), {})
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleStudent = (studentId: string) => {
    const newExpanded = new Set(expandedStudents)
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId)
    } else {
      newExpanded.add(studentId)
    }
    setExpandedStudents(newExpanded)
  }

  const markAttendance = (studentId: string, status: string) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: prev[studentId] === status ? '' : status // Toggle off if clicking same status
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    
    // Build attendance data array
    const attendanceArray = section.students.map(student => ({
      studentId: student.id,
      status: attendanceData[student.id] || null,
      notes: notes[student.id] || undefined
    }))
    
    // Call server action
    const result = await saveAttendance(section.id, date, attendanceArray)
    
    if (result.success) {
      setSaving(false)
      onUpdate() // Refresh parent data
      onClose()  // Close modal
    } else {
      setSaving(false)
      setError(result.error || 'Failed to save attendance')
    }
  }

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return null
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{section.name}</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {section.start_time} - {section.end_time}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick Stats */}
            {section.attendance_enabled && (
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Marked: {Object.values(attendanceData).filter(Boolean).length}/{section.total_students}
                </span>
                <span className="text-gray-400">•</span>
                <button
                  onClick={() => {
                    const allPresent = section.students.reduce((acc, s) => ({
                      ...acc,
                      [s.id]: 'present'
                    }), {})
                    setAttendanceData(allPresent)
                  }}
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Mark All Present
                </button>
              </div>
            )}
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-2">
              {section.students.map(student => {
                const isExpanded = expandedStudents.has(student.id)
                const currentStatus = attendanceData[student.id]

                return (
                  <div
                    key={student.id}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Student Row */}
                    <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Expand/Collapse Button */}
                        <button
                          onClick={() => toggleStudent(student.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {isExpanded ? '▾' : '▸'}
                        </button>

                        {/* Visual Indicators */}
                        <div className="flex items-center gap-1 text-lg min-w-[60px]">
                          {student.presence_mood && <span>{student.presence_mood}</span>}
                          {student.check_in_time && <span>✓</span>}
                          {student.prompt_response && <span>📝</span>}
                        </div>

                        {/* Student Name */}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {student.last_name}, {student.first_name}
                          </div>
                          {student.check_in_time && (
                            <div className="text-xs text-gray-500">
                              Checked in at {formatTime(student.check_in_time)}
                              {student.check_in_verified === false && ' ⚠️ Location unverified'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Attendance Buttons */}
                      {section.attendance_enabled && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => markAttendance(student.id, 'present')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              currentStatus === 'present'
                                ? 'bg-green-100 text-green-700 border-2 border-green-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => markAttendance(student.id, 'absent')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              currentStatus === 'absent'
                                ? 'bg-red-100 text-red-700 border-2 border-red-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => markAttendance(student.id, 'excused')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              currentStatus === 'excused'
                                ? 'bg-blue-100 text-blue-700 border-2 border-blue-600'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Excused
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                        <div className="space-y-3">
                          {/* Check-in Details */}
                          {student.check_in_time && (
                            <div>
                              <div className="text-xs font-medium text-gray-500 uppercase">Check-in</div>
                              <div className="mt-1 text-sm text-gray-900">
                                {formatTime(student.check_in_time)}
                                {student.check_in_verified === false && (
                                  <span className="ml-2 text-amber-600">⚠️ Location outside geofence</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Check-out Details */}
                          {student.check_out_time && (
                            <div>
                              <div className="text-xs font-medium text-gray-500 uppercase">Check-out</div>
                              <div className="mt-1 text-sm text-gray-900">
                                {formatTime(student.check_out_time)}
                              </div>
                            </div>
                          )}

                          {/* Prompt Response */}
                          {student.prompt_response && (
                            <div>
                              <div className="text-xs font-medium text-gray-500 uppercase">Plans</div>
                              <div className="mt-1 text-sm text-gray-700 italic">
                                "{student.prompt_response}"
                              </div>
                            </div>
                          )}

                          {/* Teacher Notes */}
                          {student.attendance_notes && (
                            <div>
                              <div className="text-xs font-medium text-gray-500 uppercase">Notes</div>
                              <div className="mt-1 text-sm text-gray-700">
                                {student.attendance_notes}
                              </div>
                            </div>
                          )}

                          {/* Teacher Notes/Comment */}
                          <div>
                            <textarea
                              placeholder="Add a comment..."
                              value={notes[student.id] || ''}
                              onChange={(e) => setNotes(prev => ({
                                ...prev,
                                [student.id]: e.target.value
                              }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            
            {/* Buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save & Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
