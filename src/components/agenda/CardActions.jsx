import { IoCheckmarkCircleOutline } from 'react-icons/io5'
import { PiHandWaving } from 'react-icons/pi'
import { MdOutlineAddComment } from 'react-icons/md'

// Renders action buttons in a vertical strip.
// All buttons are placeholders (correct icons, non-functional) for this build.
// Isolated component for future mobile overlay swap.
function CardActions({ requiresCheckin, allowsPresenceWave, hasInstance }) {
  // Determine primary action button
  let primaryButton = null
  if (requiresCheckin) {
    primaryButton = (
      <button
        className="btn btn-ghost btn-sm btn-square"
        disabled
        title="Check in"
      >
        <IoCheckmarkCircleOutline size={22} />
      </button>
    )
  } else if (allowsPresenceWave) {
    primaryButton = (
      <button
        className="btn btn-ghost btn-sm btn-square"
        disabled
        title="Presence wave"
      >
        <PiHandWaving size={22} />
      </button>
    )
  }

  // Status update button — shown for any activity with an instance
  const statusButton = hasInstance ? (
    <button
      className="btn btn-ghost btn-sm btn-square"
      disabled
      title="Status update"
    >
      <MdOutlineAddComment size={20} />
    </button>
  ) : null

  const hasOnlyStatus = !primaryButton && statusButton

  return (
    <div
      className={`w-14 border-l border-base-300 bg-base-200/50 flex flex-col items-center gap-2 ${
        hasOnlyStatus ? 'justify-center' : 'justify-center'
      }`}
    >
      {primaryButton}
      {statusButton}
    </div>
  )
}

export default CardActions
