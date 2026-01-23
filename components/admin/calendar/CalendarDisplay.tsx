'use client'

import { useState } from 'react'
import { markDayOff, unmarkDayOff } from '@/lib/actions/calendar'

type CalendarDay = {
  id: string
  date: string
  is_school_day: boolean
  ab_designation: 'a_day' | 'b_day' | null
  notes: string | null
}

type CalendarDisplayProps = {
  initialMonth?: string // YYYY-MM format
  calendarDays: CalendarDay[]
}

export default function CalendarDisplay({ initialMonth, calendarDays }: CalendarDisplayProps) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(
    initialMonth || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  )
  const [loading, setLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    date: string
    currentlyOff: boolean
  } | null>(null)

  // Parse current month
  const [year, month] = currentMonth.split('-').map(Number)
  
  // Get days in month
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay() // 0 = Sunday
  
  // Month navigation
  const goToPreviousMonth = () => {
    const newDate = new Date(year, month - 2, 1)
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
  }
  
  const goToNextMonth = () => {
    const newDate = new Date(year, month, 1)
    setCurrentMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`)
  }

  // Create calendar day lookup
  const dayLookup = new Map<string, CalendarDay>()
  calendarDays.forEach(day => {
    dayLookup.set(day.date, day)
  })

  // Get day info
  const getDayInfo = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = new Date(year, month - 1, day).getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const calendarDay = dayLookup.get(dateStr)
    
    return {
      dateStr,
      isWeekend,
      calendarDay
    }
  }

  // Handle day click
  const handleDayClick = (day: number) => {
    const { dateStr, isWeekend, calendarDay } = getDayInfo(day)
    
    // Don't allow editing weekends
    if (isWeekend) return
    
    // Open confirmation dialog
    setConfirmDialog({
      date: dateStr,
      currentlyOff: calendarDay ? !calendarDay.is_school_day : false
    })
  }

  // Confirm marking day off/on
  const handleConfirm = async () => {
    if (!confirmDialog) return
    
    setLoading(true)
    try {
      if (confirmDialog.currentlyOff) {
        // Unmark as day off (revert to school day)
        await unmarkDayOff(confirmDialog.date)
      } else {
        // Mark as day off
        await markDayOff(confirmDialog.date)
      }
      
      // Refresh the page to show updates
      window.location.reload()
    } catch (error) {
      console.error('Error updating day:', error)
      alert('Failed to update day. Please try again.')
    } finally {
      setLoading(false)
      setConfirmDialog(null)
    }
  }

  // Generate calendar grid
  const calendarGrid = []
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7
  
  for (let i = 0; i < totalCells; i++) {
    const day = i - firstDayOfMonth + 1
    
    if (day < 1 || day > daysInMonth) {
      // Empty cell
      calendarGrid.push(<div key={`empty-${i}`} className="aspect-square" />)
    } else {
      const { dateStr, isWeekend, calendarDay } = getDayInfo(day)
      
      // Determine styling
      let bgColor = 'bg-white'
      let textColor = 'text-gray-900'
      let label = ''
      
      if (isWeekend) {
        bgColor = 'bg-gray-100'
        textColor = 'text-gray-500'
      } else if (calendarDay && !calendarDay.is_school_day) {
        bgColor = 'bg-red-100'
        textColor = 'text-red-800'
        label = 'Off'
      } else if (calendarDay?.ab_designation === 'a_day') {
        bgColor = 'bg-blue-100'
        textColor = 'text-blue-800'
        label = 'A'
      } else if (calendarDay?.ab_designation === 'b_day') {
        bgColor = 'bg-green-100'
        textColor = 'text-green-800'
        label = 'B'
      }
      
      const isClickable = !isWeekend
      
      calendarGrid.push(
        <button
          key={dateStr}
          onClick={() => handleDayClick(day)}
          disabled={!isClickable}
          className={`aspect-square border border-gray-200 p-2 ${bgColor} ${
            isClickable ? 'hover:ring-2 hover:ring-blue-500 cursor-pointer' : 'cursor-default'
          } transition-all`}
        >
          <div className="flex flex-col items-start h-full">
            <span className={`text-sm font-medium ${textColor}`}>{day}</span>
            {label && (
              <span className={`text-xs font-semibold mt-auto ${textColor}`}>
                {label}
              </span>
            )}
          </div>
        </button>
      )
    }
  }

  // Month name
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  })

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{monthName}</h2>
          <div className="flex gap-2">
            <button
              onClick={goToPreviousMonth}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              ← Previous
            </button>
            <button
              onClick={goToNextMonth}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-100 border border-gray-200" />
            <span className="text-gray-600">A Day</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-100 border border-gray-200" />
            <span className="text-gray-600">B Day</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-100 border border-gray-200" />
            <span className="text-gray-600">Day Off</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-100 border border-gray-200" />
            <span className="text-gray-600">Weekend</span>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-0 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0">
          {calendarGrid}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {confirmDialog.currentlyOff ? 'Unmark Day Off?' : 'Mark Day Off?'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {confirmDialog.currentlyOff 
                ? `Are you sure you want to mark ${confirmDialog.date} as a school day?`
                : `Are you sure you want to mark ${confirmDialog.date} as a day off? This will override any A/B designation.`
              }
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={loading}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
