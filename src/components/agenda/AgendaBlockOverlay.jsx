import { timeToMinutes, minutesToPx, GRID_PAD_Y } from './agendaUtils'

// Renders alternating subtle block bands on the time grid.
// Degrades to nothing when blockDefinitions is empty/undefined
// (backward compatible with admin AgendaGrid's current prop passing).
function AgendaBlockOverlay({ blockDefinitions, gridStartMinutes, blockLabels }) {
  if (!blockDefinitions || blockDefinitions.length === 0) return null

  return (
    <>
      {blockDefinitions.map((blockDef, idx) => {
        const startMin = timeToMinutes(blockDef.start_time)
        const endMin = timeToMinutes(blockDef.end_time)
        const top = minutesToPx(startMin - gridStartMinutes) + GRID_PAD_Y
        const height = minutesToPx(endMin - startMin)

        // Alternating band colors
        const isEven = idx % 2 === 0
        const bgClass = isEven ? 'bg-primary/5' : 'bg-secondary/5'

        // Resolve block label
        const label = blockLabels?.[blockDef.block] || `B${blockDef.block}`

        return (
          <div
            key={blockDef.block}
            className={`absolute left-0 right-0 ${bgClass}`}
            style={{ top: `${top}px`, height: `${height}px`, zIndex: 0 }}
          >
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-base-content/30 font-medium select-none">
              {label}
            </span>
          </div>
        )
      })}
    </>
  )
}

export default AgendaBlockOverlay
