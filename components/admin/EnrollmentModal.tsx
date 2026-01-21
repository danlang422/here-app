'use client'

import { useState } from 'react'
import { enrollStudents } from '@/app/admin/sections/actions'
import StudentSelector from './StudentSelector'

type EnrollmentModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (enrolledCount: number) => void
  sectionId: string
  sectionName: string
  currentlyEnrolledIds?: string[] // IDs of students already enrolled
}

export default function EnrollmentModal({
  isOpen,
  onClose,
  onSuccess,
  sectionId,
  sectionName,
  currentlyEnrolledIds = [],
}: EnrollmentModalProps) {
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedStudentIds.length === 0) {
      setError('Please select at least one student to enroll')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await enrollStudents(sectionId, selectedStudentIds)
      
      if (result.success && 'enrolled' in result) {
        onSuccess(result.enrolled || 0)
        setSelectedStudentIds([]) // Clear selection
        onClose()
      } else {
        setError(result.error || 'Failed to enroll students')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Enrollment error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setSelectedStudentIds([])
      setError(null)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Enroll Students</h2>
            <p className="text-sm text-gray-600 mt-1">{sectionName}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <StudentSelector
              selectedStudentIds={selectedStudentIds}
              onSelectionChange={setSelectedStudentIds}
              enrolledStudentIds={currentlyEnrolledIds}
              showEnrolledLabel={true}
              maxHeight="400px"
            />
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
            <button
              type="submit"
              disabled={loading || selectedStudentIds.length === 0}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Enrolling...' : `Enroll ${selectedStudentIds.length} Student${selectedStudentIds.length !== 1 ? 's' : ''}`}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
