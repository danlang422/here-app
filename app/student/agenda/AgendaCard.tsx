'use client'

import { useState, useEffect } from 'react'
import EmojiButton from './EmojiButton'
import CollapsibleSection from './CollapsibleSection'
import CheckInPrompt from './CheckInPrompt'
import CheckOutPrompt from './CheckOutPrompt'
import { createPresenceWave, createCheckIn, createCheckOut } from './actions'

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
  })

  const [disabledMessage, setDisabledMessage] = useState<string | null>(null)

  const requiresCheckIn = section.section_type === 'remote' || section.section_type === 'internship'
  const isPresenceOnly = section.presence_enabled && !requiresCheckIn

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

  // Clear disabled message after 3 seconds
  useEffect(() => {
    if (disabledMessage) {
      const timer = setTimeout(() => {
        setDisabledMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [disabledMessage])

  const handleWaveClick = async () => {
    if (isPresenceOnly) {
      const restriction = checkTimeRestrictions('wave')
      if (!restriction.allowed) {
        setDisabledMessage(restriction.message || 'Not available')
        // Still do the wave animation for fun
        setState((prev) => ({ ...prev, waveAnimation: true }))
        return
      }

      setState((prev) => ({ ...prev, waveAnimation: true }))
      try {
        await createPresenceWave(section.id)
        setState((prev) => ({ ...prev, hasWaved: true }))
        if (onActionComplete) {
          onActionComplete()
        }
      } catch (error) {
        console.error('Failed to create presence wave:', error)
      }
    } else if (requiresCheckIn && !state.isCheckedIn) {
      const restriction = checkTimeRestrictions('checkin')
      if (!restriction.allowed) {
        setDisabledMessage(restriction.message || 'Not available')
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
        setDisabledMessage(restriction.message || 'Not available')
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
        return 'bg-[rgba(124,58,237,0.12)] text-[#7C3AED]'
      case 'internship':
        return 'bg-[rgba(219,39,119,0.12)] text-[#DB2777]'
      case 'class':
        return 'bg-[rgba(245,158,11,0.12)] text-[#D97706]'
      default:
        return ''
    }
  }

  const formatSectionType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
  }

  const getWaveButtonText = () => {
    if (requiresCheckIn) {
      if (state.isCheckedOut) {
        return null
      } else if (state.isCheckedIn) {
        return 'You\'re <span class="here">here</span>.'
      } else {
        return 'Say you\'re <span class="here">here</span>!'
      }
    }
    return null
  }

  const getPeaceButtonText = () => {
    if (state.isCheckedOut) {
      return 'You\'re out!'
    } else if (state.isCheckedIn) {
      return 'Check out'
    }
    return null
  }

  return (
    <div className="mb-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="
          flex-1 lg:max-w-2xl
          relative overflow-hidden
          bg-gradient-to-br from-[#FFFEF9] to-[#FFF8F0]
          rounded-[20px] p-6
          shadow-[0_4px_20px_rgba(0,0,0,0.06)]
          transition-all duration-300
          hover:shadow-[0_8px_30px_rgba(0,0,0,0.1)] hover:-translate-y-0.5
          before:absolute before:top-[-30px] before:right-[-30px]
          before:w-[120px] before:h-[120px]
          before:bg-[radial-gradient(circle,rgba(255,149,0,0.08)_0%,transparent_70%)]
          before:rounded-full before:pointer-events-none
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
          <div className="flex gap-6 justify-center lg:flex-col lg:justify-center lg:-mt-2">
            <div className="flex flex-col items-center gap-2">
              {/* Presence wave gets tooltip, check-in buttons don't */}
              <div 
                className={isPresenceOnly ? 'emoji-tooltip' : ''}
                data-tooltip={isPresenceOnly ? 'Say hey!' : undefined}
              >
                <EmojiButton
                  emoji="👋"
                  onClick={handleWaveClick}
                  pressed={state.hasWaved || state.isCheckedIn}
                  animationType={state.waveAnimation ? 'wave' : null}
                />
              </div>
              {getWaveButtonText() && (
                <span
                  className="text-[13px] font-semibold text-[#1F2937] text-center whitespace-nowrap transition-opacity duration-600"
                  style={{ opacity: state.isCheckedIn && requiresCheckIn ? 0.5 : 1 }}
                  dangerouslySetInnerHTML={{ __html: getWaveButtonText() || '' }}
                />
              )}
              {disabledMessage && !state.isCheckedIn && (
                <span className="text-[11px] font-semibold text-[#FF9500] text-center whitespace-nowrap animate-fade-in-text">
                  {disabledMessage}
                </span>
              )}
            </div>

            {state.isCheckedIn && requiresCheckIn && (
              <div className="flex flex-col items-center gap-2">
                <EmojiButton
                  emoji="✌️"
                  onClick={handlePeaceClick}
                  pressed={state.isCheckedOut}
                  animationType={state.peaceAnimation ? 'peace' : null}
                />
                {getPeaceButtonText() && (
                  <span 
                    className="text-[13px] font-semibold text-[#1F2937] text-center whitespace-nowrap transition-opacity duration-600"
                    style={{ opacity: state.isCheckedOut ? 0.5 : 1 }}
                  >
                    {getPeaceButtonText()}
                  </span>
                )}
                {disabledMessage && state.isCheckedIn && (
                  <span className="text-[11px] font-semibold text-[#FF9500] text-center whitespace-nowrap animate-fade-in-text">
                    {disabledMessage}
                  </span>
                )}
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
    </div>
  )
}
