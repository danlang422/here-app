'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SectionFormModal from '@/components/admin/SectionFormModal'
import BulkActionsDropdown from '@/components/admin/BulkActionsDropdown'
import ConfirmationDialog from '@/components/admin/ConfirmationDialog'
import { getSections, bulkUpdateSections, type SectionWithTeachers } from '@/app/admin/sections/actions'

type SectionsPageClientProps = {
  initialSections: SectionWithTeachers[]
}

type BulkAction = 
  | 'enable_attendance'
  | 'disable_attendance'
  | 'enable_presence'
  | 'disable_presence'

export default function SectionsPageClient({ initialSections }: SectionsPageClientProps) {
  const router = useRouter()
  const [sections, setSections] = useState<SectionWithTeachers[]>(initialSections)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSectionId, setEditingSectionId] = useState<string | undefined>(undefined)
  const [createdThisSession, setCreatedThisSession] = useState<Array<SectionWithTeachers & { enrolledCount?: number }>>([])
  const [filterType, setFilterType] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Bulk actions state
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set())
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    action: BulkAction | null
    title: string
    message: string
  }>({ isOpen: false, action: null, title: '', message: '' })
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  async function loadSections() {
    const result = await getSections()
    if (result.success && result.data) {
      setSections(result.data)
    }
  }

  const handleSectionCreated = async (sectionId: string, enrolledCount?: number) => {
    // Reload sections to get the newly created one
    await loadSections()

    // Find the newly created section and add it to "created this session" list
    const result = await getSections()
    if (result.success && result.data) {
      const newSection = result.data.find(s => s.id === sectionId)
      if (newSection) {
        setCreatedThisSession(prev => [{ ...newSection, enrolledCount }, ...prev])
      }
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingSectionId(undefined)
    // Clear "created this session" when modal is closed via "Save & Done"
    if (createdThisSession.length > 0) {
      // Don't clear immediately - let them see the list
      // setCreatedThisSession([])
    }
  }

  const handleEditSection = (sectionId: string) => {
    setEditingSectionId(sectionId)
    setIsModalOpen(true)
  }

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedSectionIds.size === filteredSections.length) {
      setSelectedSectionIds(new Set())
    } else {
      setSelectedSectionIds(new Set(filteredSections.map(s => s.id)))
    }
  }

  const toggleSelectSection = (sectionId: string) => {
    const newSelected = new Set(selectedSectionIds)
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId)
    } else {
      newSelected.add(sectionId)
    }
    setSelectedSectionIds(newSelected)
  }

  // Bulk action handlers
  const handleBulkAction = (action: BulkAction) => {
    const actionLabels = {
      enable_attendance: { title: 'Enable Attendance', message: 'attendance will be enabled' },
      disable_attendance: { title: 'Disable Attendance', message: 'attendance will be disabled' },
      enable_presence: { title: 'Enable Presence', message: 'presence waves will be enabled' },
      disable_presence: { title: 'Disable Presence', message: 'presence waves will be disabled' },
    }

    const label = actionLabels[action]
    setConfirmDialog({
      isOpen: true,
      action,
      title: label.title,
      message: `Are you sure you want to update ${selectedSectionIds.size} section(s)? For all selected sections, ${label.message}.`,
    })
  }

  const executeBulkAction = async () => {
    if (!confirmDialog.action) return

    const updates = {
      enable_attendance: { attendance_enabled: true },
      disable_attendance: { attendance_enabled: false },
      enable_presence: { presence_enabled: true },
      disable_presence: { presence_enabled: false },
    }[confirmDialog.action]

    const result = await bulkUpdateSections(Array.from(selectedSectionIds), updates)

    if (result.success) {
      // Reload sections to show updated data
      await loadSections()
      
      // Clear selection
      setSelectedSectionIds(new Set())
      
      // Show success message
      setSuccessMessage(`Successfully updated ${result.count} section(s)`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } else {
      alert(`Error: ${result.error}`)
    }

    // Close confirmation dialog
    setConfirmDialog({ isOpen: false, action: null, title: '', message: '' })
  }

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

  // Filter sections
  const filteredSections = sections.filter(section => {
    // Filter by type
    if (filterType !== 'all' && section.type !== filterType) {
      return false
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = section.name.toLowerCase().includes(query)
      const matchesTeacher = section.section_teachers?.some(st => {
        const teacherName = `${st.users.first_name} ${st.users.last_name}`.toLowerCase()
        return teacherName.includes(query)
      })
      return matchesName || matchesTeacher
    }

    return true
  })

  return (
    <div>
      {/* Success Message */}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sections</h1>
          <p className="text-gray-600 mt-1">Manage class sections, schedules, and assignments</p>
        </div>
        <div className="flex items-center gap-3">
          <BulkActionsDropdown
            selectedCount={selectedSectionIds.size}
            onAction={handleBulkAction}
          />
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            + Create Section
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div className="sm:w-48">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="in_person">In Person</option>
              <option value="remote">Remote</option>
              <option value="internship">Internship</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sections Table */}
      {filteredSections.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery || filterType !== 'all' ? 'No sections found' : 'No sections yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || filterType !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first section'}
          </p>
          {!searchQuery && filterType === 'all' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Create First Section
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedSectionIds.size === filteredSections.length && filteredSections.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Schedule
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teacher
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enrolled
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSections.map((section) => {
                const primaryTeacher = section.section_teachers?.find(st => st.is_primary)
                const isSelected = selectedSectionIds.has(section.id)

                return (
                  <tr key={section.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectSection(section.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{section.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        section.type === 'in_person' ? 'bg-blue-100 text-blue-800' :
                        section.type === 'remote' ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {section.type === 'in_person' ? 'In Person' :
                         section.type === 'remote' ? 'Remote' :
                         'Internship'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatTime(section.start_time)} - {formatTime(section.end_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatSchedule(section.schedule_pattern, section.days_of_week)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {primaryTeacher ? (
                        <div>
                          {primaryTeacher.users.first_name} {primaryTeacher.users.last_name}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No teacher</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {section._count?.section_students || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => router.push(`/admin/sections/${section.id}`)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleEditSection(section.id)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Section Form Modal */}
      <SectionFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSectionCreated}
        onClearCreatedList={() => setCreatedThisSession([])}
        mode={editingSectionId ? 'edit' : 'create'}
        sectionId={editingSectionId}
        createdSections={createdThisSession}
      />

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Update Sections"
        onConfirm={executeBulkAction}
        onCancel={() => setConfirmDialog({ isOpen: false, action: null, title: '', message: '' })}
      />
    </div>
  )
}
