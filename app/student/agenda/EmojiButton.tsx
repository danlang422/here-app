'use client'

import { useState } from 'react'

interface EmojiButtonProps {
  emoji: string
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
  animationType?: 'wave' | 'peace' | null
}

export default function EmojiButton({
  emoji,
  onClick,
  pressed = false,
  disabled = false,
  animationType = null,
}: EmojiButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  const handleClick = () => {
    if (disabled) return

    // Trigger animation
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), animationType === 'wave' ? 1200 : 500)

    onClick()
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="bg-transparent border-0 p-0 cursor-pointer"
      aria-label={`${emoji} button`}
    >
      <span className={`
        text-5xl inline-block
        transition-all duration-300
        ${!pressed && !disabled ? 'hover:scale-110 hover:-translate-y-1 drop-shadow-[0_4px_8px_rgba(255,149,0,0.3)]' : ''}
        ${pressed ? 'translate-y-2 opacity-60 grayscale drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isAnimating && animationType === 'wave' ? 'animate-wave' : ''}
        ${isAnimating && animationType === 'peace' ? 'animate-peace' : ''}
      `}>{emoji}</span>
    </button>
  )
}
