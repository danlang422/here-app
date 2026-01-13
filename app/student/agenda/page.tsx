'use client'

import { useState } from 'react'

const schedule = [
  { id: 1, name: 'English Literature', start: 8, end: 9, type: 'class', color: '#fbbf24' },
  { id: 2, name: 'Remote Work - Code Development', start: 9, end: 11, type: 'remote', color: '#a78bfa', checkedIn: false },
  { id: 3, name: 'Lunch', start: 11, end: 12, type: 'break', color: '#fb923c' },
  { id: 4, name: 'Internship - Local Coffee Shop', start: 12, end: 15, type: 'internship', color: '#f472b6', checkedIn: false },
  { id: 5, name: 'Math Tutoring', start: 15, end: 15.75, type: 'remote', color: '#60a5fa', checkedIn: false }
]

const rotations = [0.5, -0.8, 1.2, -0.5, 0.7]

const formatTime = (time: number): string => {
  const hours = Math.floor(time)
  const minutes = Math.round((time - hours) * 60)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours > 12 ? hours - 12 : hours
  return minutes === 0 
    ? `${displayHours}:00 ${period}` 
    : `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

interface Section {
  id: number
  name: string
  start: number
  end: number
  type: string
  color: string
  checkedIn?: boolean
}

interface AgendaCardProps {
  item: Section
  rotation: number
  onToggle: (id: number) => void
  expandedId: number | null
  setExpandedId: (id: number | null) => void
}

const AgendaCard = ({ item, rotation, onToggle, expandedId, setExpandedId }: AgendaCardProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const [response, setResponse] = useState('')
  const isInteractive = item.type === 'remote' || item.type === 'internship'
  const isExpanded = expandedId === item.id

  const handleCheckInClick = () => {
    if (!item.checkedIn) {
      setExpandedId(item.id)
    }
  }

  const handleSubmit = () => {
    if (response.trim()) {
      onToggle(item.id)
      setExpandedId(null)
      setResponse('')
    }
  }

  const handleCancel = () => {
    setExpandedId(null)
    setResponse('')
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #f8f9fb 0%, #ffffff 100%)',
        borderRadius: '24px',
        padding: '24px',
        transform: `rotate(${isExpanded ? 0 : rotation}deg) ${isHovered && !isExpanded ? 'translateY(-4px) scale(1.02)' : ''}`,
        boxShadow: isInteractive
          ? item.checkedIn
            ? '0 12px 30px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)'
            : isExpanded
              ? '0 20px 50px rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.1)'
              : 'inset 0 2px 8px rgba(0,0,0,0.06), inset 0 -2px 8px rgba(255,255,255,0.8)'
          : '0 8px 24px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative',
        overflow: 'hidden',
        border: isInteractive && item.checkedIn ? `3px solid ${item.color}50` : 'none'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '140px',
        height: '140px',
        background: `radial-gradient(circle, ${item.color}20 0%, transparent 70%)`,
        borderRadius: '50%',
        pointerEvents: 'none',
        opacity: isExpanded ? 0.3 : 1,
        transition: 'opacity 0.5s ease'
      }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px',
        position: 'relative'
      }}>
        <div style={{
          background: item.color,
          color: '#ffffff',
          borderRadius: '12px',
          padding: '6px 14px',
          fontSize: '13px',
          fontWeight: '700',
          boxShadow: `0 4px 12px ${item.color}40`,
          transform: `rotate(${isExpanded ? 0 : -1}deg)`,
          transition: 'transform 0.5s ease'
        }}>
          {formatTime(item.start)}
        </div>
        <span style={{ 
          fontSize: '18px',
          color: '#cbd5e0',
          fontWeight: '600'
        }}>→</span>
        <div style={{
          background: '#e2e8f0',
          color: '#64748b',
          borderRadius: '12px',
          padding: '6px 14px',
          fontSize: '13px',
          fontWeight: '600',
          transform: `rotate(${isExpanded ? 0 : 0.5}deg)`,
          transition: 'transform 0.5s ease'
        }}>
          {formatTime(item.end)}
        </div>
      </div>

      <h3 style={{
        fontSize: '20px',
        fontWeight: '700',
        color: '#1e293b',
        lineHeight: '1.3',
        margin: '0 0 20px 0',
        position: 'relative'
      }}>
        {item.name}
      </h3>

      {isInteractive && !isExpanded && (
        <button
          onClick={handleCheckInClick}
          style={{
            width: '100%',
            background: item.checkedIn 
              ? `linear-gradient(135deg, ${item.color} 0%, ${item.color}dd 100%)`
              : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
            color: item.checkedIn ? '#ffffff' : '#475569',
            border: 'none',
            borderRadius: '16px',
            padding: '14px 24px',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: item.checkedIn 
              ? `0 6px 20px ${item.color}50, inset 0 1px 2px rgba(255,255,255,0.3)`
              : '0 4px 12px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.8)',
            transition: 'all 0.3s ease',
            transform: 'rotate(-0.3deg)',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            if (!item.checkedIn) {
              e.currentTarget.style.transform = 'rotate(-0.3deg) translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12), inset 0 1px 2px rgba(255,255,255,0.8)'
            }
          }}
          onMouseLeave={(e) => {
            if (!item.checkedIn) {
              e.currentTarget.style.transform = 'rotate(-0.3deg) translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.8)'
            }
          }}
        >
          {item.checkedIn ? '✓ Checked In' : 'Check In'}
        </button>
      )}

      {isInteractive && isExpanded && (
        <div style={{
          animation: 'slideIn 0.5s ease-out',
          transformOrigin: 'top'
        }}>
          <div style={{
            background: `linear-gradient(135deg, ${item.color}20 0%, ${item.color}10 100%)`,
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            border: `2px solid ${item.color}30`
          }}>
            <p style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#475569',
              margin: 0
            }}>
              What are your plans for this session?
            </p>
          </div>

          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Share your goals and plans..."
            autoFocus
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '14px',
              fontSize: '15px',
              fontFamily: 'inherit',
              border: `2px solid ${item.color}30`,
              borderRadius: '14px',
              outline: 'none',
              resize: 'vertical',
              background: '#ffffff',
              color: '#1e293b',
              marginBottom: '16px',
              transition: 'border-color 0.3s ease',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = item.color
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = `${item.color}30`
            }}
          />

          <div style={{
            display: 'flex',
            gap: '12px'
          }}>
            <button
              onClick={handleCancel}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                color: '#64748b',
                border: 'none',
                borderRadius: '14px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!response.trim()}
              style={{
                flex: 2,
                background: response.trim()
                  ? `linear-gradient(135deg, ${item.color} 0%, ${item.color}dd 100%)`
                  : 'linear-gradient(135deg, #cbd5e0 0%, #94a3b8 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: response.trim() ? 'pointer' : 'not-allowed',
                boxShadow: response.trim()
                  ? `0 4px 16px ${item.color}50, inset 0 1px 2px rgba(255,255,255,0.3)`
                  : '0 2px 8px rgba(0,0,0,0.06)',
                transition: 'all 0.3s ease',
                opacity: response.trim() ? 1 : 0.6
              }}
              onMouseEnter={(e) => {
                if (response.trim()) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = `0 6px 20px ${item.color}60, inset 0 1px 2px rgba(255,255,255,0.3)`
                }
              }}
              onMouseLeave={(e) => {
                if (response.trim()) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = `0 4px 16px ${item.color}50, inset 0 1px 2px rgba(255,255,255,0.3)`
                }
              }}
            >
              Submit Check-In
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

export default function StudentAgenda() {
  const [items, setItems] = useState(schedule)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const toggleCheckIn = (id: number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, checkedIn: !item.checkedIn } : item
    ))
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #faf5ff 0%, #f0f9ff 50%, #fef3c7 100%)',
      padding: '40px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto 40px',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '36px',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '8px'
        }}>
          Your Schedule
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#64748b',
          fontWeight: '500'
        }}>
          Monday, January 13, 2026
        </p>
      </div>

      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {items.map((item, index) => (
          <AgendaCard 
            key={item.id} 
            item={item} 
            rotation={rotations[index]}
            onToggle={toggleCheckIn}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
          />
        ))}
      </div>
    </div>
  )
}
