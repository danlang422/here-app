'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string
  onClose: () => void
  duration?: number
}

export default function Toast({ message, onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-toast-in">
      <div className="
        bg-gradient-to-br from-[#1F2937] to-[#374151]
        text-white px-6 py-3 rounded-2xl
        shadow-[0_8px_24px_rgba(0,0,0,0.2)]
        font-semibold text-sm
        backdrop-blur-sm
      ">
        {message}
      </div>
    </div>
  )
}
