'use client'

import { useState, useEffect } from 'react'
import AgendaCard from './AgendaCard'
import { getStudentSchedule } from './actions'

interface Section {
  id: string
  name: string
  section_type: 'remote' | 'internship' | 'class'
  start_time: string
  end_time: string
  presence_enabled: boolean
  hasCheckedIn?: boolean
  hasCheckedOut?: boolean
  hasWaved?: boolean
  existingPlans?: string
  existingProgress?: string
}

interface AgendaClientProps {
  initialSections: Section[]
  initialDate: string
}

export default function AgendaClient({ initialSections, initialDate }: AgendaClientProps) {
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [sections, setSections] = useState<Section[]>(initialSections)
  const [loading, setLoading] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  
  // Cache to store fetched schedules by date
  const [scheduleCache, setScheduleCache] = useState<Record<string, Section[]>>({
    [initialDate]: initialSections
  })

  // Function to refresh current date's data (called after actions like wave, check-in, check-out)
  const refreshCurrentDate = async () => {
    try {
      const freshSections = await getStudentSchedule(currentDate)
      setSections(freshSections)
      setScheduleCache(prev => ({ ...prev, [currentDate]: freshSections }))
    } catch (error) {
      console.error('Failed to refresh schedule:', error)
    }
  }

  // Apply "here" color rotation on mount and when sections change
  useEffect(() => {
    const COLORS = ['#FF9500', '#7C3AED', '#DB2777', '#F59E0B']
    const startIndex = Math.floor(Math.random() * COLORS.length)

    const hereElements = document.querySelectorAll('.here')
    hereElements.forEach((el, i) => {
      const colorIndex = (startIndex + i) % COLORS.length
      ;(el as HTMLElement).style.color = COLORS[colorIndex]
    })
  }, [sections])

  // Fetch schedule when date changes
  useEffect(() => {
    if (isInitialLoad) {
      // On first mount, we already have initialSections, don't fetch
      setIsInitialLoad(false)
    } else {
      // On any subsequent date change, fetch (even if returning to today)
      fetchSchedule(currentDate)
    }
  }, [currentDate])

  const fetchSchedule = async (date: string) => {
    // Check cache first - show cached data immediately while fetching fresh data
    if (scheduleCache[date]) {
      setSections(scheduleCache[date])
      // Still fetch fresh data in the background to update any changes
      // but don't show loading state since we have cached data
      try {
        const freshSections = await getStudentSchedule(date)
        setSections(freshSections)
        setScheduleCache(prev => ({ ...prev, [date]: freshSections }))
      } catch (error) {
        console.error('Failed to fetch fresh schedule:', error)
        // Keep using cached data on error
      }
    } else {
      // No cache - show loading state while fetching
      setLoading(true)
      try {
        const newSections = await getStudentSchedule(date)
        setSections(newSections)
        setScheduleCache(prev => ({ ...prev, [date]: newSections }))
      } catch (error) {
        console.error('Failed to fetch schedule:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      // Get today's date in local timezone
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      setCurrentDate(`${year}-${month}-${day}`)
      return
    }

    // Parse the current date string and adjust
    const [year, month, day] = currentDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    if (direction === 'prev') {
      date.setDate(date.getDate() - 1)
    } else if (direction === 'next') {
      date.setDate(date.getDate() + 1)
    }

    const newYear = date.getFullYear()
    const newMonth = String(date.getMonth() + 1).padStart(2, '0')
    const newDay = String(date.getDate()).padStart(2, '0')
    setCurrentDate(`${newYear}-${newMonth}-${newDay}`)
  }

  const formatDisplayDate = (dateStr: string) => {
    // Parse the date string as local date (not UTC)
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    
    // Get today's date in local timezone
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const isToday = date.getTime() === today.getTime()

    if (isToday) {
      return 'Today'
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="
        flex items-center justify-center gap-4 mb-8 p-5
        bg-gradient-to-br from-[#FFFEF9] to-[#FFF8F0]
        rounded-[20px]
        shadow-[0_2px_10px_rgba(0,0,0,0.05)]
      ">
        <button
          onClick={() => navigateDate('prev')}
          className="
            px-5 py-2.5
            bg-transparent border-2 border-gray-200 rounded-xl
            text-sm font-semibold text-[#6B7280]
            cursor-pointer transition-all duration-200
            hover:bg-gray-50 hover:border-gray-300 hover:text-[#1F2937]
          "
        >
          Previous
        </button>
        <div className="text-xl font-bold text-[#1F2937] min-w-[250px] text-center">
          {formatDisplayDate(currentDate)}
        </div>
        <button
          onClick={() => navigateDate('today')}
          className="
            px-5 py-2.5
            bg-gradient-to-br from-[#FF9500] to-[#F59E0B]
            border-0 rounded-xl text-white
            text-sm font-semibold
            cursor-pointer transition-all duration-200
            shadow-[0_2px_8px_rgba(255,149,0,0.3)]
            hover:shadow-[0_4px_12px_rgba(255,149,0,0.4)] hover:-translate-y-0.5
          "
        >
          Today
        </button>
        <button
          onClick={() => navigateDate('next')}
          className="
            px-5 py-2.5
            bg-transparent border-2 border-gray-200 rounded-xl
            text-sm font-semibold text-[#6B7280]
            cursor-pointer transition-all duration-200
            hover:bg-gray-50 hover:border-gray-300 hover:text-[#1F2937]
          "
        >
          Next
        </button>
      </div>

      {loading ? (
        <div className="text-center py-15 px-5 text-base text-[#6B7280]">
          Loading schedule...
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-15 px-5">
          <p className="text-base text-[#6B7280] m-0">
            No sections scheduled for {formatDisplayDate(currentDate)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0">
          {sections.map((section) => (
            <AgendaCard 
              key={section.id} 
              section={section}
              currentDate={currentDate}
              onActionComplete={refreshCurrentDate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
