'use client'

import { useState, useEffect } from 'react'
import { getStudents } from '@/app/admin/sections/actions'

type Student = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

type StudentSelectorProps = {
  selectedStudentIds: string[]
  onSelectionChange: (studentIds: string[]) => void
  enrolledStudentIds?: string[] // Students already enrolled (shows "currently enrolled" label)
  showEnrolledLabel?: boolean // Whether to show "(currently enrolled)" label
  maxHeight?: string // Max height for scrollable list (e.g., "16rem", "300px")
}

export default function StudentSelector({
  selectedStudentIds,
  onSelectionChange,
  enrolledStudentIds = [],
  showEnrolledLabel = false,
  maxHeight = '16rem',
}: StudentSelectorProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Load students on mount
  useEffect(() => {
    async function loadStudents() {
      setLoading(true)
      const result = await getStudents()
      if (result.success && result.data) {
        setStudents(result.data)
      }
      setLoading(false)
    }
    loadStudents()
  }, [])

  const handleToggle = (studentId: string) => {
    const newSelection = selectedStudentIds.includes(studentId)
      ? selectedStudentIds.filter(id => id !== studentId)
      : [...selectedStudentIds, studentId]
    onSelectionChange(newSelection)
  }

  // Filter students based on search
  const filteredStudents = students.filter(student => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase()
    const email = student.email.toLowerCase()
    return fullName.includes(query) || email.includes(query)
  })

  if (loading) {
    return (
      <div className="text-center py-4 text-sm text-gray-500">
        Loading students...
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <input
        type="text"
        placeholder="Search students by name or email..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Student List */}
      <div 
        className="overflow-y-auto border border-gray-200 rounded-md"
        style={{ maxHeight }}
      >
        {filteredStudents.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {searchQuery ? 'No students found matching your search' : 'No students available'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredStudents.map(student => {
              const isSelected = selectedStudentIds.includes(student.id)
              const isEnrolled = enrolledStudentIds.includes(student.id)
              
              return (
                <label
                  key={student.id}
                  className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(student.id)}
                    className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {student.last_name}, {student.first_name}
                      {showEnrolledLabel && isEnrolled && (
                        <span className="ml-2 text-xs text-gray-500">(currently enrolled)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{student.email}</div>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </div>

      {/* Selection Summary */}
      <div className="text-xs text-gray-600">
        {selectedStudentIds.length === 0 ? (
          'No students selected'
        ) : (
          `${selectedStudentIds.length} student${selectedStudentIds.length !== 1 ? 's' : ''} selected`
        )}
      </div>
    </div>
  )
}
