import { HandWaving, CheckCircle, NotePencil, SignOut } from '@phosphor-icons/react'

// State → border/text/bg color class sets
const stateStyles = {
  inactive:             'border-base-content/20 text-base-content/30 bg-base-100 cursor-default',
  available:            'border-info/80 text-info bg-info/8 shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer hover:border-info hover:bg-info/12',
  completed:            'border-success/70 text-success bg-success/8',
  'checked-in':         'border-success/70 text-success bg-success/8',
  'checkout-available': 'border-info/80 text-info bg-info/8 shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer hover:border-info hover:bg-info/12',
  'checked-out':        'border-success/70 text-success bg-success/8',
  'has-updates':        'border-success/70 text-success bg-success/8 cursor-pointer',
}

const icons = {
  wave: {
    inactive:  <HandWaving size={18} />,
    available: <HandWaving size={18} />,
    completed: <CheckCircle weight="fill" size={18} />,
  },
  checkin: {
    inactive:             <CheckCircle size={18} />,
    available:            <CheckCircle size={18} />,
    'checked-in':         <CheckCircle weight="fill" size={18} />,
    'checkout-available': <SignOut size={18} />,
    'checked-out':        <CheckCircle weight="fill" size={18} />,
  },
  status: {
    inactive:     <NotePencil size={18} />,
    available:    <NotePencil size={18} />,
    'has-updates': <NotePencil size={18} />,
  },
}

// Which states allow clicking
const CLICKABLE_STATES = new Set(['available', 'checkout-available', 'has-updates'])

function ActionButton({ type, state, onClick, hasUpdates }) {
  const icon = icons[type]?.[state] ?? icons[type]?.inactive
  const style = stateStyles[state] ?? stateStyles.inactive
  const isClickable = CLICKABLE_STATES.has(state)
  const isAvailable = state === 'available' || state === 'checkout-available'

  // Animation class: wave gets the hand-wave, checkin/status get the pop
  const animClass = isAvailable
    ? (type === 'wave' ? 'active:animate-[wave-hand_0.6s_ease]' : 'active:animate-[check-pop_0.4s_ease]')
    : ''

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`
        relative w-9 h-9 rounded-xl border-2 flex items-center justify-center z-[15]
        transition-all duration-150
        ${style}
        ${animClass}
        ${isAvailable && type !== 'status' ? 'pulse-available' : ''}
      `}
    >
      {icon}
      {type === 'status' && hasUpdates && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border border-base-100" />
      )}
    </button>
  )
}

export default ActionButton
