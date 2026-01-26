'use client'

import { useState, useTransition } from 'react'
import { getTeacherAgenda } from '@/lib/teacher/actions'
import AttendanceModal from '@/components/teacher/AttendanceModal'

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
  presence_enabled: boolean | null
  total_students: number
  marked_students: number
  presence_count: number
  checked_in_count: number
  students: Student[]
}

interface TeacherAgendaClientProps {
  initialDate: string
  initialSections: Section[]
}

export default function TeacherAgendaClient({ initialDate, initialSections }: TeacherAgendaClientProps) {
  const [date, setDate] = useState(initialDate)
  const [sections, setSections] = useState(initialSections)
  const [isPending, startTransition] = useTransition()
  const [selectedSection, setSelectedSection] = useState<Section | null>(null)

  const changeDate = (days: number) => {
    const currentDate = new Date(date)
    currentDate.setDate(currentDate.getDate() + days)
    const newDate = currentDate.toISOString().split('T')[0]
    
    setDate(newDate)
    
    // Fetch new data
    startTransition(async () => {
      const newSections = await getTeacherAgenda(newDate)
      setSections(newSections)
    })
  }

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setDate(today)
    
    startTransition(async () => {
      const newSections = await getTeacherAgenda(today)
      setSections(newSections)
    })
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isToday = date === new Date().toISOString().split('T')[0]

  const handleAttendanceUpdate = () => {
    // Refresh the current date's data
    startTransition(async () => {
      const newSections = await getTeacherAgenda(date)
      setSections(newSections)
    })
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Agenda</h1>
        <p className="text-gray-600 mt-1">View and manage attendance for your sections</p>
      </div>

      {/* Date Navigation */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => changeDate(-1)}
            disabled={isPending}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            ← Previous Day
          </button>
          
          <div className="flex items-center gap-4">
            <div className="text-lg font-medium">
              {formatDate(date)}
            </div>
            {!isToday && (
              <button
                onClick={goToToday}
                disabled={isPending}
                className="px-3 py-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors disabled:opacity-50"
              >
                Today
              </button>
            )}
          </div>
          
          <button 
            onClick={() => changeDate(1)}
            disabled={isPending}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Next Day →
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isPending && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <p className="text-gray-600 mt-2">Loading sections...</p>
        </div>
      )}

      {/* Section Cards */}
      {!isPending && sections.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No sections scheduled for this date.</p>
        </div>
      )}

      {!isPending && sections.length > 0 && (
        <div className="space-y-4">
          {sections.map(section => (
            <div key={section.id} className="bg-white rounded-lg shadow">
              {/* Section Header */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{section.name}</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                      <span>{section.start_time} - {section.end_time}</span>
                      <span className="px-2 py-0.5 bg-gray-100 rounded">
                        {section.type === 'in_person' && '🏫 In-Person'}
                        {section.type === 'remote' && '💻 Remote'}
                        {section.type === 'internship' && '💼 Internship'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Indicators */}
                  <div className="flex items-center gap-3 text-sm">
                    {section.presence_enabled && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
                        👋 ({section.presence_count})
                      </span>
                    )}
                    {section.type !== 'in_person' && (
                      <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded">
                        ✓ ({section.checked_in_count})
                      </span>
                    )}
                    {section.attendance_enabled && (
                      <span className={`px-2 py-1 rounded ${
                        section.marked_students === section.total_students
                          ? 'bg-green-50 text-green-700'
                          : section.marked_students > 0
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-gray-50 text-gray-700'
                      }`}>
                        {section.marked_students === section.total_students && '✓ Complete'}
                        {section.marked_students > 0 && section.marked_students < section.total_students && '⚠ In Progress'}
                        {section.marked_students === 0 && 'Not Started'}
                        {' '}({section.marked_students}/{section.total_students})
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                {section.attendance_enabled ? (
                  <button
                    onClick={() => setSelectedSection(section)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Mark Attendance
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedSection(section)}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    View Roster
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attendance Modal */}
      {selectedSection && (
        <AttendanceModal
          section={selectedSection}
          date={date}
          onClose={() => setSelectedSection(null)}
          onUpdate={handleAttendanceUpdate}
        />
      )}
    </div>
  )
}
