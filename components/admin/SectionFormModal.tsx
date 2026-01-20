'use client'

import { useState, useEffect } from 'react'
import { createSection, updateSection, getSection, getTeachers, type SectionFormData, type SectionWithTeachers } from '@/app/admin/sections/actions'
import type { Database } from '@/lib/types/database'

type SectionType = Database['public']['Enums']['section_type']
type SchedulePattern = Database['public']['Enums']['schedule_pattern']

type Teacher = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

type SectionFormModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (sectionId: string) => void
  sectionId?: string // For edit mode
  mode?: 'create' | 'edit'
  createdSections?: SectionWithTeachers[] // Sections created this session
}

const SECTION_TYPES: { value: SectionType; label: string }[] = [
  { value: 'in_person', label: 'In Person' },
  { value: 'remote', label: 'Remote' },
  { value: 'internship', label: 'Internship' },
]

const SCHEDULE_PATTERNS: { value: SchedulePattern; label: string }[] = [
  { value: 'every_day', label: 'Every Day' },
  { value: 'specific_days', label: 'Specific Days' },
  { value: 'a_days', label: 'A Days' },
  { value: 'b_days', label: 'B Days' },
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'M' },
  { value: 1, label: 'T' },
  { value: 2, label: 'W' },
  { value: 3, label: 'Th' },
  { value: 4, label: 'F' },
]

// Format time for display (convert 24h to 12h)
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

// Format schedule pattern for display
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
        const dayLabels = ['M', 'T', 'W', 'Th', 'F']
        return days.map(d => dayLabels[d]).join(', ')
      } catch {
        return 'Specific Days'
      }
    default:
      return pattern
  }
}

export default function SectionFormModal({
  isOpen,
  onClose,
  onSuccess,
  sectionId,
  mode = 'create',
  createdSections = [],
}: SectionFormModalProps) {
  const [formData, setFormData] = useState<SectionFormData>({
    name: '',
    type: 'in_person',
    start_time: '08:00',
    end_time: '09:00',
    schedule_pattern: 'every_day',
    days_of_week: [],
    teacher_id: '',
    location: '',
    sis_block: undefined,
  })

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingSection, setLoadingSection] = useState(false)

  // Load teachers on mount
  useEffect(() => {
    async function loadTeachers() {
      const result = await getTeachers()
      if (result.success && result.data) {
        setTeachers(result.data)
      }
    }
    loadTeachers()
  }, [])

  // Load section data if in edit mode
  useEffect(() => {
    async function loadSection() {
      if (mode === 'edit' && sectionId) {
        setLoadingSection(true)
        const result = await getSection(sectionId)
        if (result.success && result.data) {
          const section = result.data
          
          // Parse days_of_week from JSON
          let daysOfWeek: number[] = []
          if (section.days_of_week) {
            try {
              daysOfWeek = JSON.parse(section.days_of_week as string)
            } catch (e) {
              console.error('Error parsing days_of_week:', e)
            }
          }

          // Parse location from JSON
          let location = ''
          if (section.expected_location) {
            try {
              const locationData = JSON.parse(section.expected_location as string)
              location = locationData.address || ''
            } catch (e) {
              console.error('Error parsing location:', e)
            }
          }

          // Get primary teacher
          const primaryTeacher = section.section_teachers?.find(st => st.is_primary)

          setFormData({
            name: section.name,
            type: section.type,
            start_time: section.start_time,
            end_time: section.end_time,
            schedule_pattern: section.schedule_pattern,
            days_of_week: daysOfWeek,
            teacher_id: primaryTeacher?.teacher_id || '',
            location: location,
            sis_block: section.sis_block || undefined,
          })
        }
        setLoadingSection(false)
      }
    }
    loadSection()
  }, [mode, sectionId])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen && mode === 'create') {
      setFormData({
        name: '',
        type: 'in_person',
        start_time: '08:00',
        end_time: '09:00',
        schedule_pattern: 'every_day',
        days_of_week: [],
        teacher_id: '',
        location: '',
        sis_block: undefined,
      })
      setError(null)
    }
  }, [isOpen, mode])

  const handleSubmit = async (e: React.FormEvent, saveAndAddAnother: boolean = false) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = mode === 'edit' && sectionId
        ? await updateSection(sectionId, formData)
        : await createSection(formData)

      if (result.success && result.data) {
        onSuccess(result.data.id)
        
        if (saveAndAddAnother) {
          // Reset form for next entry, keep some defaults
          setFormData(prev => ({
            name: '',
            type: prev.type,
            start_time: prev.start_time,
            end_time: prev.end_time,
            schedule_pattern: prev.schedule_pattern,
            days_of_week: prev.days_of_week,
            teacher_id: '',
            location: prev.location,
            sis_block: undefined,
          }))
        } else {
          onClose()
        }
      } else {
        setError(result.error || 'Failed to save section')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Form submission error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week?.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...(prev.days_of_week || []), day],
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'edit' ? 'Edit Section' : 'Create New Section'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex">
          {/* Form - Left Side */}
          <div className="flex-1 p-6">
            {loadingSection ? (
              <div className="text-center text-gray-600">Loading section data...</div>
            ) : (
              <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {/* Section Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Section Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., English 10A"
                  />
                </div>

                {/* Type */}
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="type"
                    required
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as SectionType }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {SECTION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      id="start_time"
                      required
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      id="end_time"
                      required
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Schedule Pattern */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Pattern <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {SCHEDULE_PATTERNS.map(pattern => (
                      <label key={pattern.value} className="flex items-center">
                        <input
                          type="radio"
                          name="schedule_pattern"
                          value={pattern.value}
                          checked={formData.schedule_pattern === pattern.value}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            schedule_pattern: e.target.value as SchedulePattern,
                            days_of_week: e.target.value !== 'specific_days' ? [] : prev.days_of_week,
                          }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">{pattern.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Days of Week (only for specific_days) */}
                {formData.schedule_pattern === 'specific_days' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Days <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => handleDayToggle(day.value)}
                          className={`w-10 h-10 rounded-full font-medium transition-colors ${
                            formData.days_of_week?.includes(day.value)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teacher */}
                <div>
                  <label htmlFor="teacher_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Teacher
                  </label>
                  <select
                    id="teacher_id"
                    value={formData.teacher_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, teacher_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No teacher assigned</option>
                    {teachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.last_name}, {teacher.first_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Location (for in_person and internship) */}
                {(formData.type === 'in_person' || formData.type === 'internship') && (
                  <div>
                    <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <input
                      type="text"
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={formData.type === 'in_person' ? 'e.g., Room 204' : 'e.g., 123 Main St'}
                    />
                  </div>
                )}

                {/* SIS Block */}
                <div>
                  <label htmlFor="sis_block" className="block text-sm font-medium text-gray-700 mb-1">
                    SIS Block Number
                  </label>
                  <input
                    type="number"
                    id="sis_block"
                    value={formData.sis_block || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      sis_block: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1, 2, 3..."
                    min="1"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  {mode === 'create' && (
                    <button
                      type="button"
                      onClick={(e) => handleSubmit(e as any, true)}
                      disabled={loading}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {loading ? 'Saving...' : 'Save & Add Another'}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className={`${mode === 'create' ? 'flex-1' : 'flex-1'} bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium`}
                  >
                    {loading ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Save & Done'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Created This Session - Right Side */}
          {mode === 'create' && createdSections.length > 0 && (
            <div className="w-80 bg-green-50 border-l border-green-200 p-6">
              <h3 className="font-semibold text-green-900 mb-4">Created This Session ({createdSections.length})</h3>
              <div className="space-y-3 max-h-[calc(90vh-120px)] overflow-y-auto">
                {createdSections.map(section => {
                  const primaryTeacher = section.section_teachers?.find(st => st.is_primary)
                  return (
                    <div key={section.id} className="bg-white rounded-md p-3 text-sm border border-green-200">
                      <div className="font-medium text-gray-900 mb-1">{section.name}</div>
                      <div className="text-gray-600 text-xs space-y-0.5">
                        <div>{formatTime(section.start_time)} - {formatTime(section.end_time)}</div>
                        <div>{formatSchedule(section.schedule_pattern, section.days_of_week)}</div>
                        {primaryTeacher && (
                          <div className="text-gray-500">
                            {primaryTeacher.users.first_name} {primaryTeacher.users.last_name}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
