'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import InternshipFormModal from '@/components/admin/InternshipFormModal'
import { getInternships, type InternshipWithMentor, deleteInternship } from '@/app/admin/internships/actions'

type InternshipsPageClientProps = {
  initialInternships: InternshipWithMentor[]
}

export default function InternshipsPageClient({ initialInternships }: InternshipsPageClientProps) {
  const router = useRouter()
  const [internships, setInternships] = useState<InternshipWithMentor[]>(initialInternships)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInternshipId, setEditingInternshipId] = useState<string | undefined>(undefined)
  const [createdThisSession, setCreatedThisSession] = useState<InternshipWithMentor[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  async function loadInternships() {
    const result = await getInternships()
    if (result.success && result.data) {
      setInternships(result.data)
    }
  }

  const handleInternshipCreated = async (internshipId: string) => {
    // Reload internships to get the newly created one
    await loadInternships()

    // Find the newly created internship and add it to "created this session" list
    const result = await getInternships()
    if (result.success && result.data) {
      const newInternship = result.data.find(i => i.id === internshipId)
      if (newInternship) {
        setCreatedThisSession(prev => [newInternship, ...prev])
      }
    }
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingInternshipId(undefined)
  }

  const handleEditInternship = (internshipId: string) => {
    setEditingInternshipId(internshipId)
    setIsModalOpen(true)
  }

  const handleDeleteInternship = async (internshipId: string, internshipName: string) => {
    if (!confirm(`Are you sure you want to delete "${internshipName}"? This cannot be undone.`)) {
      return
    }

    const result = await deleteInternship(internshipId)
    if (result.success) {
      await loadInternships()
      // Remove from created this session if present
      setCreatedThisSession(prev => prev.filter(i => i.id !== internshipId))
    } else {
      alert(result.error || 'Failed to delete internship')
    }
  }

  const handleClearCreatedList = () => {
    if (confirm('Clear the "Created This Session" list?')) {
      setCreatedThisSession([])
    }
  }

  // Parse location from JSONB
  const parseLocation = (location: any): { formatted_address?: string; lat?: number; lng?: number } | null => {
    if (!location) return null
    try {
      if (typeof location === 'string') {
        return JSON.parse(location)
      }
      return location
    } catch {
      return null
    }
  }

  // Filter internships
  const filteredInternships = internships.filter(internship => {
    // Filter by status
    if (filterStatus === 'active' && !internship.is_active) return false
    if (filterStatus === 'inactive' && internship.is_active) return false

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = internship.name.toLowerCase().includes(query)
      const matchesOrg = internship.organization_name.toLowerCase().includes(query)
      const matchesMentor = internship.mentor
        ? `${internship.mentor.first_name} ${internship.mentor.last_name}`.toLowerCase().includes(query)
        : false
      return matchesName || matchesOrg || matchesMentor
    }

    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Internships</h1>
          <p className="text-gray-600 mt-1">Manage internship opportunities and placements</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          + Create Internship
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, organization, or mentor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {filteredInternships.length} of {internships.length} internships
      </div>

      {/* Internships List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Organization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mentor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slots
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredInternships.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No internships found. Create your first internship opportunity to get started.
                </td>
              </tr>
            ) : (
              filteredInternships.map((internship) => {
                const location = parseLocation(internship.location)
                const mentorName = internship.mentor
                  ? `${internship.mentor.first_name} ${internship.mentor.last_name}`
                  : '-'
                
                return (
                  <tr key={internship.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{internship.name}</div>
                      {internship.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {internship.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {internship.organization_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {location?.formatted_address ? (
                        <div className="max-w-xs truncate" title={location.formatted_address}>
                          {location.formatted_address}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {mentorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {internship._count?.sections || 0}
                      {internship.available_slots && ` / ${internship.available_slots}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          internship.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {internship.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEditInternship(internship.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteInternship(internship.id, internship.name)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <InternshipFormModal
          internshipId={editingInternshipId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={handleInternshipCreated}
          createdThisSession={createdThisSession}
          onClearCreatedList={handleClearCreatedList}
        />
      )}
    </div>
  )
}
