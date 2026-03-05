import { useState, useRef, useCallback, useEffect } from 'react'
import { HiMinus, HiArrowsPointingOut, HiXMark } from 'react-icons/hi2'

// Module-level z-index counter — shared across all FloatingPanel instances
let topZ = 100

/**
 * FloatingPanel — a reusable, draggable, minimizable floating container.
 *
 * Content-agnostic: it renders children inside a floating window with
 * drag-by-title-bar, minimize/restore, close, click-to-front z-index,
 * and viewport clamping.
 *
 * Props:
 *   title        - string shown in the title bar
 *   defaultWidth - panel width in px (default 420)
 *   onClose      - called when the close button is clicked
 *   children     - panel content
 */
export default function FloatingPanel({ title, defaultWidth = 420, onClose, children }) {
  const panelRef = useRef(null)
  const dragState = useRef(null)

  const [position, setPosition] = useState(null) // null = needs initial centering
  const [minimized, setMinimized] = useState(false)
  const [zIndex, setZIndex] = useState(() => ++topZ)

  // Center the panel on first render
  useEffect(() => {
    if (position === null) {
      const x = Math.max(0, Math.round(window.innerWidth / 2 - defaultWidth / 2))
      const y = Math.max(0, Math.round(window.innerHeight / 2 - 200))
      setPosition({ x, y })
    }
  }, [position, defaultWidth])

  // Bring to front on any interaction
  const bringToFront = useCallback(() => {
    const next = ++topZ
    setZIndex(next)
  }, [])

  // --- Drag handling via pointer events on the title bar ---

  const handlePointerDown = useCallback((e) => {
    // Only drag on primary button
    if (e.button !== 0) return
    // Don't start drag when clicking title bar buttons
    if (e.target.closest('button')) return
    e.preventDefault()

    bringToFront()

    const panel = panelRef.current
    if (!panel) return

    const rect = panel.getBoundingClientRect()
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top,
      panelWidth: rect.width,
    }

    panel.setPointerCapture(e.pointerId)
  }, [bringToFront])

  const handlePointerMove = useCallback((e) => {
    if (!dragState.current) return

    const { startX, startY, startLeft, startTop, panelWidth } = dragState.current

    let newX = startLeft + (e.clientX - startX)
    let newY = startTop + (e.clientY - startY)

    // Clamp to viewport
    newX = Math.max(0, Math.min(newX, window.innerWidth - panelWidth))
    newY = Math.max(0, Math.min(newY, window.innerHeight - 40)) // keep at least title bar visible

    setPosition({ x: Math.round(newX), y: Math.round(newY) })
  }, [])

  const handlePointerUp = useCallback((e) => {
    if (!dragState.current) return
    dragState.current = null
    panelRef.current?.releasePointerCapture(e.pointerId)
  }, [])

  // Don't render until position is calculated
  if (position === null) return null

  return (
    <div
      ref={panelRef}
      className="fixed card bg-base-100 shadow-2xl border border-base-300 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: defaultWidth,
        zIndex,
      }}
      onPointerDown={bringToFront}
      onPointerMoveCapture={handlePointerMove}
      onPointerUpCapture={handlePointerUp}
    >
      {/* Title bar — drag handle */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-base-200 cursor-grab active:cursor-grabbing select-none"
        onPointerDown={handlePointerDown}
      >
        <span className="text-sm font-semibold truncate">{title}</span>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={(e) => {
              e.stopPropagation()
              setMinimized((m) => !m)
            }}
            title={minimized ? 'Restore' : 'Minimize'}
          >
            {minimized ? <HiArrowsPointingOut className="w-3.5 h-3.5" /> : <HiMinus className="w-3.5 h-3.5" />}
          </button>
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={(e) => {
              e.stopPropagation()
              onClose?.()
            }}
            title="Close"
          >
            <HiXMark className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel content — hidden when minimized */}
      {!minimized && (
        <div className="card-body p-0">
          {children}
        </div>
      )}
    </div>
  )
}
