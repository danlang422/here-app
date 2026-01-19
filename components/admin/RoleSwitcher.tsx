'use client'

import { useState, useTransition } from 'react'
import { switchRole } from '@/lib/auth/actions/switchRole'

interface RoleSwitcherProps {
  currentRole: string
  availableRoles: string[]
  isCollapsed?: boolean
}

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  mentor: 'Mentor',
}

const roleIcons: Record<string, string> = {
  admin: '⚙️',
  teacher: '📚',
  student: '🎓',
  mentor: '🤝',
}

export default function RoleSwitcher({ currentRole, availableRoles, isCollapsed = false }: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Don't show switcher if user only has one role
  if (availableRoles.length <= 1) {
    return null
  }

  const handleRoleSwitch = (role: string) => {
    if (role === currentRole) {
      setIsOpen(false)
      return
    }

    startTransition(async () => {
      await switchRole(role)
      setIsOpen(false)
    })
  }

  if (isCollapsed) {
    // Collapsed view - just show icon with dropdown
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full p-2 hover:bg-gray-100 rounded-lg transition-colors flex justify-center"
          disabled={isPending}
        >
          <span className="text-xl">{roleIcons[currentRole]}</span>
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <div className="absolute left-full ml-2 top-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
              {availableRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleSwitch(role)}
                  disabled={isPending}
                  className={`
                    w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors
                    flex items-center gap-2
                    ${role === currentRole ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                    ${isPending ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <span className="text-base">{roleIcons[role]}</span>
                  <span>{roleLabels[role]}</span>
                  {role === currentRole && <span className="ml-auto text-xs">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // Expanded view
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={`
          w-full px-3 py-2 rounded-lg transition-colors text-left
          flex items-center justify-between
          ${isPending ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}
        `}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{roleIcons[currentRole]}</span>
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Role</span>
            <span className="text-sm font-medium text-gray-900">{roleLabels[currentRole]}</span>
          </div>
        </div>
        <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            {availableRoles.map((role) => (
              <button
                key={role}
                onClick={() => handleRoleSwitch(role)}
                disabled={isPending}
                className={`
                  w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors
                  flex items-center gap-2
                  ${role === currentRole ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}
                  ${isPending ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span className="text-base">{roleIcons[role]}</span>
                <span>{roleLabels[role]}</span>
                {role === currentRole && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
