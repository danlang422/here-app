'use client'

import { useState, useEffect } from 'react'
import EmojiButton from './EmojiButton'
import CollapsibleSection from './CollapsibleSection'
import CheckInPrompt from './CheckInPrompt'
import CheckOutPrompt from './CheckOutPrompt'
import Toast from './Toast'
import { createPresenceWave, createCheckIn, createCheckOut } from './actions'

interface Section {
  id: string
  name: string
  section_type: 'remote' | 'internship' | 'in_person'
  start_time: string
  end_time: string
  presence_enabled: boolean
  hasCheckedIn?: boolean
  hasCheckedOut?: boolean
  hasWaved?: boolean
  existingPlans?: string
  existingProgress?: string
}

interface AgendaCardProps {
  section: Section
  onActionComplete?: () => Promise<void>
  currentDate: string // Pass current date from parent to check if it's today
}

interface CardState {
  hasWaved: boolean
  isCheckedIn: boolean
  isCheckedOut: boolean
  showCheckInPrompt: boolean
  showCheckOutPrompt: boolean
  isCollapsed: boolean
  plans: string | null
  progress: string | null
  waveAnimation: boolean
  peaceAnimation: boolean
  toastMessage: string | null
}

export default function AgendaCard({ section, onActionComplete, currentDate }: AgendaCardProps) {
  const [state, setState] = useState<CardState>({
    hasWaved: section.hasWaved || false,
    isCheckedIn: section.hasCheckedIn || false,
    isCheckedOut: section.hasCheckedOut || false,
    showCheckInPrompt: false,
    showCheckOutPrompt: false,
    isCollapsed: false,
    plans: section.existingPlans || null,
    progress: section.existingProgress || null,
    waveAnimation: false,
    peaceAnimation: false,
    toastMessage: null,
  })

  const requiresCheckIn = section.section_type === 'remote' || section.section_type === 'internship'
  const isPresenceOnly = section.presence_enabled && !requiresCheckIn

  // Apply "here" color rotation whenever component renders
  useEffect(() => {
    const COLORS = ['#FF9500', '#7C3AED', '#DB2777', '#06B6D4']
    const startIndex = Math.floor(Math.random() * COLORS.length)

    const hereElements = document.querySelectorAll('.here')
    hereElements.forEach((el, i) => {
      const colorIndex = (startIndex + i) % COLORS.length
      ;(el as HTMLElement).style.color = COLORS[colorIndex]
    })
  }, [state.isCheckedIn, state.isCheckedOut])

  // Check if current date is today
  const isToday = () => {
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return currentDate === todayStr
  }

  // Time-based restrictions
  const checkTimeRestrictions = (actionType: 'wave' | 'checkin' | 'checkout'): { allowed: boolean; message?: string } => {
    // Only allow actions on today's date
    if (!isToday()) {
      return { allowed: false, message: 'Actions only available for today' }
    }

    const now = new Date()
    const [startHour, startMin] = section.start_time.split(':').map(Number)
    const [endHour, endMin] = section.end_time.split(':').map(Number)

    const sectionStart = new Date()
    sectionStart.setHours(startHour, startMin, 0, 0)

    const sectionEnd = new Date()
    sectionEnd.setHours(endHour, endMin, 0, 0)

    // Check-in: 15 min before start time
    const checkInStart = new Date(sectionStart.getTime() - 15 * 60 * 1000)

    // Presence wave: 5 min before start, no end restriction (can wave all day once enabled)
    const presenceStart = new Date(sectionStart.getTime() - 5 * 60 * 1000)

    if (actionType === 'wave') {
      if (now < presenceStart) {
        const openTime = presenceStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        return { allowed: false, message: `Wave opens at ${openTime}` }
      }
      return { allowed: true }
    }

    if (actionType === 'checkin') {
      if (now < checkInStart) {
        const openTime = checkInStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        return { allowed: false, message: `Check-in opens at ${openTime}` }
      }
      if (now > sectionEnd) {
        return { allowed: false, message: 'Check-in closed' }
      }
      return { allowed: true }
    }

    if (actionType === 'checkout') {
      // Check-out available once checked in, no end time (can check out late)
      return { allowed: true }
    }

    return { allowed: true }
  }

  // Sync state when section data changes (from cache refresh)
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      hasWaved: section.hasWaved || false,
      isCheckedIn: section.hasCheckedIn || false,
      isCheckedOut: section.hasCheckedOut || false,
      plans: section.existingPlans || null,
      progress: section.existingProgress || null,
    }))
  }, [section.hasWaved, section.hasCheckedIn, section.hasCheckedOut, section.existingPlans, section.existingProgress])

  const handleWaveClick = async () => {
    if (isPresenceOnly) {
      const restriction = checkTimeRestrictions('wave')
      if (!restriction.allowed) {
        setState((prev) => ({ ...prev, toastMessage: restriction.message || 'Not available', waveAnimation: true }))
        return
      }

      setState((prev) => ({ ...prev, waveAnimation: true }))
      try {
        await createPresenceWave(section.id)
        setState((prev) => ({ ...prev, hasWaved: true, toastMessage: 'Hey! 👋' }))
        if (onActionComplete) {
          onActionComplete()
        }
      } catch (error) {
        console.error('Failed to create presence wave:', error)
      }
    } else if (requiresCheckIn && !state.isCheckedIn) {
      const restriction = checkTimeRestrictions('checkin')
      if (!restriction.allowed) {
        setState((prev) => ({ ...prev, toastMessage: restriction.message || 'Not available' }))
        return
      }
      setState((prev) => ({ ...prev, showCheckInPrompt: true }))
    }
  }

  const handleCheckInSubmit = async (plans: string) => {
    setState((prev) => ({ ...prev, waveAnimation: true }))
    try {
      await createCheckIn(section.id, plans)
      setState((prev) => ({
        ...prev,
        isCheckedIn: true,
        plans,
        showCheckInPrompt: false,
        toastMessage: "You're here! ✨",
      }))
      if (onActionComplete) {
        onActionComplete()
      }
    } catch (error) {
      console.error('Failed to check in:', error)
      setState((prev) => ({ ...prev, showCheckInPrompt: false }))
    }
  }

  const handleCheckInCancel = () => {
    setState((prev) => ({ ...prev, showCheckInPrompt: false }))
  }

  const handlePeaceClick = () => {
    if (state.isCheckedIn && !state.isCheckedOut) {
      const restriction = checkTimeRestrictions('checkout')
      if (!restriction.allowed) {
        setState((prev) => ({ ...prev, toastMessage: restriction.message || 'Not available' }))
        return
      }
      setState((prev) => ({ ...prev, showCheckOutPrompt: true }))
    }
  }

  const handleCheckOutSubmit = async (progress: string) => {
    setState((prev) => ({ ...prev, peaceAnimation: true }))
    try {
      await createCheckOut(section.id, progress)
      setState((prev) => ({
        ...prev,
        isCheckedOut: true,
        progress,
        showCheckOutPrompt: false,
        toastMessage: 'See you later! ✌️',
      }))
      if (onActionComplete) {
        onActionComplete()
      }
    } catch (error) {
      console.error('Failed to check out:', error)
      setState((prev) => ({ ...prev, showCheckOutPrompt: false }))
    }
  }

  const handleCheckOutCancel = () => {
    setState((prev) => ({ ...prev, showCheckOutPrompt: false }))
  }

  const toggleCollapsed = () => {
    setState((prev) => ({ ...prev, isCollapsed: !prev.isCollapsed }))
  }

  const getBadgeClasses = () => {
    switch (section.section_type) {
      case 'remote':
        return 'bg-[rgba(124,58,237,0.15)] text-[#7C3AED]'
      case 'internship':
        return 'bg-[rgba(219,39,119,0.15)] text-[#DB2777]'
      case 'in_person':
        return 'bg-[rgba(6,182,212,0.15)] text-[#06B6D4]'
      default:
        return ''
    }
  }

  const formatSectionType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const getTooltipText = () => {
    if (isPresenceOnly) {
      return state.hasWaved ? 'Hey!' : 'Say hey!'
    } else if (requiresCheckIn) {
      if (state.isCheckedOut) {
        return null
      } else if (state.isCheckedIn) {
        return "You're here"
      } else {
        return 'Check in here'
      }
    }
    return null
  }

  const getCheckOutTooltip = () => {
    return state.isCheckedOut ? "You're out!" : 'Check out'
  }

  return (
    <div className="mb-5">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="
          w-full lg:w-[700px] lg:flex-shrink-0
          relative overflow-hidden
          bg-white
          rounded-[20px] p-6
          shadow-[0_2px_12px_rgba(0,0,0,0.08)]
          transition-all duration-300
          hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:-translate-y-0.5
        ">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="m-0 mb-1 text-lg font-bold text-[#1F2937]">{section.name}</h3>
              <div className="text-sm text-[#6B7280]">
                {section.start_time} - {section.end_time}
              </div>
            </div>
            <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${getBadgeClasses()}`}>
              {formatSectionType(section.section_type)}
            </span>
          </div>

          {state.isCheckedIn && requiresCheckIn && (
            <CollapsibleSection
              sectionId={section.id}
              plans={state.plans}
              progress={state.progress}
              isExpanded={!state.isCollapsed}
              onToggle={toggleCollapsed}
            />
          )}
        </div>

        {(isPresenceOnly || requiresCheckIn) && (
          <div className="flex gap-6 justify-center lg:flex-col lg:justify-center">
            <div className="flex flex-col items-center">
              <div 
                className="emoji-tooltip"
                data-tooltip={getTooltipText() || undefined}
              >
                <EmojiButton
                  emoji="👋"
                  onClick={handleWaveClick}
                  pressed={state.hasWaved || state.isCheckedIn}
                  animationType={state.waveAnimation ? 'wave' : null}
                />
              </div>
            </div>

            {state.isCheckedIn && requiresCheckIn && (
              <div className="flex flex-col items-center">
                <div 
                  className="emoji-tooltip"
                  data-tooltip={getCheckOutTooltip()}
                >
                  <EmojiButton
                    emoji="✌️"
                    onClick={handlePeaceClick}
                    pressed={state.isCheckedOut}
                    animationType={state.peaceAnimation ? 'peace' : null}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {state.showCheckInPrompt && (
        <CheckInPrompt
          sectionId={section.id}
          onSubmit={handleCheckInSubmit}
          onCancel={handleCheckInCancel}
        />
      )}

      {state.showCheckOutPrompt && (
        <CheckOutPrompt
          sectionId={section.id}
          onSubmit={handleCheckOutSubmit}
          onCancel={handleCheckOutCancel}
        />
      )}

      {state.toastMessage && (
        <Toast
          message={state.toastMessage}
          onClose={() => setState((prev) => ({ ...prev, toastMessage: null }))}
        />
      )}
    </div>
  )
}
