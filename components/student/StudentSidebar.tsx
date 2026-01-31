'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import RoleSwitcher from '@/components/admin/RoleSwitcher'
import { logout } from '@/lib/auth/actions'

interface NavItem {
  name: string
  href: string
  icon: string
}

interface StudentSidebarProps {
  userEmail: string
  userRole: string
  availableRoles?: string[]
}

export default function StudentSidebar({ userEmail, userRole, availableRoles = [] }: StudentSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const pathname = usePathname()

  // Update CSS variable when collapse state changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      isCollapsed ? '5rem' : '16rem'
    )
  }, [isCollapsed])

  const navItems: NavItem[] = [
    { name: 'Agenda', href: '/student/agenda', icon: '📅' },
    { name: 'Settings', href: '/student/settings', icon: '⚙️' },
  ]

  const isActive = (href: string) => {
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen bg-white border-r border-gray-200
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Header / Profile Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">Here</h2>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded mt-1">
                {userRole}
              </span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="text-xl">{isCollapsed ? '→' : '←'}</span>
          </button>
        </div>
        {isCollapsed && (
          <div className="mt-2 text-center">
            <div className="w-10 h-10 mx-auto bg-gray-500 text-white rounded-full flex items-center justify-center font-bold">
              {userEmail.charAt(0).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      {/* Role Switcher - only shows if user has multiple roles */}
      {availableRoles.length > 1 && (
        <div className="px-4 pt-4 pb-2">
          <RoleSwitcher 
            currentRole={userRole}
            availableRoles={availableRoles}
            isCollapsed={isCollapsed}
          />
        </div>
      )}

      {/* Navigation Items */}
      <nav className="p-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex items-center px-3 py-2.5 rounded-lg transition-colors
              ${isActive(item.href) 
                ? 'bg-gray-100 text-gray-900 font-medium' 
                : 'text-gray-700 hover:bg-gray-50'
              }
              ${isCollapsed ? 'justify-center' : 'gap-3'}
            `}
          >
            <span className="text-xl">{item.icon}</span>
            {!isCollapsed && <span className="text-sm">{item.name}</span>}
          </Link>
        ))}
      </nav>

      {/* Footer - Sign out */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <form action={logout}>
          {!isCollapsed ? (
            <button 
              type="submit"
              className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-left"
            >
              Sign Out
            </button>
          ) : (
            <button 
              type="submit"
              className="w-full p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex justify-center"
            >
              <span className="text-xl">🚪</span>
            </button>
          )}
        </form>
      </div>
    </aside>
  )
}
