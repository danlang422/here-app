'use client'

import { useState, useEffect } from 'react'
import { createInternship, updateInternship, getInternship, getMentors, type InternshipFormData, type InternshipWithMentor } from '@/app/admin/internships/actions'

type InternshipFormModalProps = {
  internshipId?: string
  isOpen: boolean
  onClose: () => void
  onSuccess: (internshipId: string) => void
  createdThisSession: InternshipWithMentor[]
  onClearCreatedList: () => void
}

export default function InternshipFormModal({
  internshipId,
  isOpen,
  onClose,
  onSuccess,
  createdThisSession,
  onClearCreatedList,
}: InternshipFormModalProps) {
  const [formData, setFormData] = useState<InternshipFormData>({
    name: '',
    organization_name: '',
    description: '',
    location: undefined,
    geofence_radius: 100,
    mentor_id: '',
    contact_phone: '',
    contact_email: '',
    available_slots: undefined,
    is_active: true,
    requirements: '',
  })
  
  const [mentors, setMentors] = useState<Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveAndAddAnother, setSaveAndAddAnother] = useState(false)
  const [locationSearch, setLocationSearch] = useState('')

  // Load mentors on mount
  useEffect(() => {
    async function loadMentors() {
      const result = await getMentors()
      if (result.success && result.data) {
        setMentors(result.data)
      }
    }
    loadMentors()
  }, [])

  // Load internship data if editing
  useEffect(() => {
    if (internshipId) {
      loadInternship()
    }
  }, [internshipId])

  async function loadInternship() {
    if (!internshipId) return
    
    const result = await getInternship(internshipId)
    if (result.success && result.data) {
      const internship = result.data
      
      // Parse location if it exists
      let location = undefined
      if (internship.location) {
        try {
          const parsed = typeof internship.location === 'string' 
            ? JSON.parse(internship.location) 
            : internship.location
          location = parsed
          setLocationSearch(parsed.formatted_address || '')
        } catch (e) {
          console.error('Failed to parse location:', e)
        }
      }

      setFormData({
        name: internship.name,
        organization_name: internship.organization_name,
        description: internship.description || '',
        location,
        geofence_radius: internship.geofence_radius || 100,
        mentor_id: internship.mentor_id || '',
        contact_phone: internship.contact_phone || '',
        contact_email: internship.contact_email || '',
        available_slots: internship.available_slots || undefined,
        is_active: internship.is_active,
        requirements: internship.requirements || '',
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent, saveAnother: boolean = false) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSaveAndAddAnother(saveAnother)

    try {
      // Validate required fields
      if (!formData.name || !formData.organization_name) {
        setError('Name and organization are required')
        setIsSubmitting(false)
        return
      }

      let result
      if (internshipId) {
        result = await updateInternship(internshipId, formData)
      } else {
        result = await createInternship(formData)
      }

      if (result.success && result.data) {
        onSuccess(result.data.id)
        
        if (saveAnother) {
          // Reset form for next entry
          setFormData({
            name: '',
            organization_name: '',
            description: '',
            location: undefined,
            geofence_radius: 100,
            mentor_id: '',
            contact_phone: '',
            contact_email: '',
            available_slots: undefined,
            is_active: true,
            requirements: '',
          })
          setLocationSearch('')
          setError(null)
        } else {
          onClose()
        }
      } else {
        setError(result.error || 'Failed to save internship')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error('Form submission error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-start justify-center overflow-y-auto py-8">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 flex">
        {/* Main Form */}
        <div className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {internshipId ? 'Edit Internship' : 'Create Internship'}
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-50"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internship Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Library Assistant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.organization_name}
                    onChange={(e) => setFormData({ ...formData, organization_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Cedar Rapids Public Library"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief description of the internship opportunity..."
                />
              </div>
            </div>

            {/* Location - Placeholder for now */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Location</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search for location... (Leaflet integration coming soon)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Location search with map will be added in next iteration
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Geofence Radius (meters)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="500"
                    value={formData.geofence_radius}
                    onChange={(e) => setFormData({ ...formData, geofence_radius: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Used for check-in location verification (default: 100m)
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mentor
                  </label>
                  <select
                    value={formData.mentor_id || ''}
                    onChange={(e) => setFormData({ ...formData, mentor_id: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No mentor assigned</option>
                    {mentors.map((mentor) => (
                      <option key={mentor.id} value={mentor.id}>
                        {mentor.first_name} {mentor.last_name} ({mentor.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(319) 555-0123"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="contact@organization.org"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Available Slots
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.available_slots || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      available_slots: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave empty for unlimited"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'active' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requirements
                </label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Prerequisites, qualifications, or requirements..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                {!internshipId && (
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, true)}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting && saveAndAddAnother ? 'Saving...' : 'Save & Add Another'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting && !saveAndAddAnother ? 'Saving...' : internshipId ? 'Update' : 'Save & Done'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Sidebar - Created This Session */}
        {!internshipId && createdThisSession.length > 0 && (
          <div className="w-80 bg-gray-50 border-l border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Created This Session
              </h3>
              <button
                onClick={onClearCreatedList}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {createdThisSession.map((internship) => (
                <div
                  key={internship.id}
                  className="p-3 bg-white rounded-md border border-gray-200"
                >
                  <div className="font-medium text-sm text-gray-900">
                    {internship.name}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {internship.organization_name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
