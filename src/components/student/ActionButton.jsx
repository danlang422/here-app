import { HandWaving, CheckCircle, NotePencil, SignOut } from '@phosphor-icons/react'

const stateStyles = {
  inactive: 'border-base-content/20 text-base-content/40',
  available: 'border-info/85 text-info/85 cursor-pointer hover:border-info hover:text-info',
  completed: 'border-success/80 text-success/80',
  'checked-in': 'border-success/80 text-success/80',
  'checkout-available': 'border-info/85 text-info/85 cursor-pointer hover:border-info hover:text-info',
  'checked-out': 'border-success/80 text-success/80',
  'has-updates': 'border-info/85 text-info/85 cursor-pointer hover:border-info hover:text-info',
}

const icons = {
  wave: {
    available: <HandWaving size={20} />,
    completed: <CheckCircle weight="fill" size={20} />,
  },
  checkin: {
    available: <CheckCircle size={20} />,
    'checked-in': <CheckCircle weight="fill" size={20} />,
    'checkout-available': <SignOut size={20} />,
    'checked-out': <CheckCircle weight="fill" size={20} />,
  },
  status: {
    available: <NotePencil size={20} />,
    'has-updates': <NotePencil size={20} />,
  },
}

function ActionButton({ type, state, onClick, hasUpdates }) {
  if (state === 'inactive') {
    // Show the default icon in inactive state
    const inactiveIcon =
      type === 'wave' ? <HandWaving size={20} /> :
      type === 'checkin' ? <CheckCircle size={20} /> :
      <NotePencil size={20} />

    return (
      <div
        className={`w-7 h-7 rounded-full bg-base-100 border-2 flex items-center justify-center z-[15] ${stateStyles.inactive}`}
      >
        {inactiveIcon}
      </div>
    )
  }

  const icon = icons[type]?.[state]
  const style = stateStyles[state] ?? stateStyles.inactive
  const isClickable = ['available', 'checkout-available', 'has-updates'].includes(state)
    || (type === 'status' && state === 'available')

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`w-7 h-7 rounded-full bg-base-100 border-2 flex items-center justify-center z-[15] relative ${style} ${
        !isClickable ? 'cursor-default' : ''
      }`}
    >
      {icon}
      {type === 'status' && hasUpdates && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success" />
      )}
    </button>
  )
}

export default ActionButton
