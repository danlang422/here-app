'use client'

import { useState } from 'react'

type BulkAction = 
  | 'enable_attendance'
  | 'disable_attendance'
  | 'enable_presence'
  | 'disable_presence'

type BulkActionsDropdownProps = {
  selectedCount: number
  onAction: (action: BulkAction) => void
}

export default function BulkActionsDropdown({ selectedCount, onAction }: BulkActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleAction = (action: BulkAction) => {
    setIsOpen(false)
    onAction(action)
  }

  if (selectedCount === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
      >
        <span>Bulk Actions ({selectedCount})</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                Attendance
              </div>
              <button
                onClick={() => handleAction('enable_attendance')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                ✓ Enable Attendance
              </button>
              <button
                onClick={() => handleAction('disable_attendance')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                ✗ Disable Attendance
              </button>

              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-t border-b border-gray-200 mt-1">
                Presence
              </div>
              <button
                onClick={() => handleAction('enable_presence')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                👋 Enable Presence
              </button>
              <button
                onClick={() => handleAction('disable_presence')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                ✗ Disable Presence
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
