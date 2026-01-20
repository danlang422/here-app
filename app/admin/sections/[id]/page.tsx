'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSection, type SectionWithTeachers } from '../actions'
import SectionFormModal from '@/components/admin/SectionFormModal'

export default function SectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sectionId = params.id as string

  const [section, setSection] = useState<SectionWithTeachers | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  useEffect(() => {
    loadSection()
  }, [sectionId])

  async function loadSection() {
    setLoading(true)
    const result = await getSection(sectionId)
    if (result.success && result.data) {
      setSection(result.data)
    }
    setLoading(false)
  }

  const handleEditSuccess = async (sectionId: string, enrolledCount?: number) => {
    setIsEditModalOpen(false)
    await loadSection() // Reload to show updated data
  }

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Format schedule pattern
  const formatSchedule = (pattern: string, daysOfWeek?: any) => {
    switch (pattern) {
      case 'every_day':
        return 'Every Day'
      case 'a_days':
        return 'A Days'
      case 'b_days':
        return 'B Days'
      case 'specific_days':
        if (!daysOfWeek) return 'Specific Days'
        try {
          const days = JSON.parse(daysOfWeek as string) as number[]
          const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
          return days.map(d => dayLabels[d]).join(', ')
        } catch {
          return 'Specific Days'
        }
      default:
        return pattern
    }
  }

  // Parse location
  const getLocation = (expectedLocation?: any) => {
    if (!expectedLocation) return null
    try {
      const locationData = JSON.parse(expectedLocation as string)
      return locationData.address || null
    } catch {
      return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading section...</div>
      </div>
    )
  }

  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-gray-600 mb-4">Section not found</div>
        <button
          onClick={() => router.push('/admin/sections')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Sections
        </button>
      </div>
    )
  }

  const primaryTeacher = section.section_teachers?.find(st => st.is_primary)
  const location = getLocation(section.expected_location)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/admin/sections')}
          className="text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Sections
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{section.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                section.type === 'in_person' ? 'bg-blue-100 text-blue-800' :
                section.type === 'remote' ? 'bg-purple-100 text-purple-800' :
                'bg-green-100 text-green-800'
              }`}>
                {section.type === 'in_person' ? 'In Person' :
                 section.type === 'remote' ? 'Remote' :
                 'Internship'}
              </span>
              <span className="text-gray-600">
                {section._count?.section_students || 0} student{section._count?.section_students !== 1 ? 's' : ''} enrolled
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Edit Section
            </button>
            <button
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Section Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Schedule Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Schedule</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Time</dt>
              <dd className="text-sm text-gray-900 mt-1">
                {formatTime(section.start_time)} - {formatTime(section.end_time)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Pattern</dt>
              <dd className="text-sm text-gray-900 mt-1">
                {formatSchedule(section.schedule_pattern, section.days_of_week)}
              </dd>
            </div>
            {section.sis_block && (
              <div>
                <dt className="text-sm font-medium text-gray-500">SIS Block</dt>
                <dd className="text-sm text-gray-900 mt-1">Block {section.sis_block}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Teacher Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Teacher</h2>
          {primaryTeacher ? (
            <div>
              <div className="text-sm font-medium text-gray-900">
                {primaryTeacher.users.first_name} {primaryTeacher.users.last_name}
              </div>
              <div className="text-sm text-gray-500 mt-1">{primaryTeacher.users.email}</div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic">No teacher assigned</div>
          )}
        </div>

        {/* Location Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
          {location ? (
            <div className="text-sm text-gray-900">{location}</div>
          ) : (
            <div className="text-sm text-gray-500 italic">No location specified</div>
          )}
        </div>
      </div>

      {/* Enrolled Students */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Enrolled Students</h2>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
          >
            + Enroll Students
          </button>
        </div>
        <div className="p-6">
          {section._count?.section_students === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No students enrolled</h3>
              <p className="text-gray-600 mb-6">Get started by enrolling students in this section</p>
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Enroll Students
              </button>
            </div>
          ) : (
            <div className="text-gray-600">
              Student enrollment list will go here (coming next)
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <SectionFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        mode="edit"
        sectionId={sectionId}
      />
    </div>
  )
}
