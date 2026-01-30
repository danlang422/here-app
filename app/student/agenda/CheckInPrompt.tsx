'use client'

import { useState } from 'react'

interface CheckInPromptProps {
  sectionId: string
  onSubmit: (plans: string) => Promise<void>
  onCancel: () => void
}

export default function CheckInPrompt({ sectionId, onSubmit, onCancel }: CheckInPromptProps) {
  const [plans, setPlans] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plans.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit(plans)
    } catch (error) {
      console.error('Failed to check in:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-4 p-5 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border-2 border-[rgba(255,149,0,0.2)]">
      <form onSubmit={handleSubmit}>
        <div>
          <h4 className="m-0 mb-3 text-base font-semibold text-[#1F2937]">
            What are your plans for this session?
          </h4>
        </div>
        <textarea
          value={plans}
          onChange={(e) => setPlans(e.target.value)}
          placeholder="Share what you'll be working on..."
          rows={4}
          disabled={isSubmitting}
          autoFocus
          className="
            w-full p-3 rounded-xl
            border-2 border-gray-200
            text-sm
            transition-colors duration-200
            focus:border-[#FF9500] focus:outline-none
            resize-vertical
            disabled:bg-gray-50 disabled:cursor-not-allowed
          "
        />
        <div className="flex gap-3 justify-end mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="
              px-5 py-2.5 rounded-xl
              bg-transparent text-[#6B7280]
              text-sm font-semibold
              cursor-pointer transition-all duration-200
              border-2 border-gray-200
              hover:bg-gray-50 hover:text-[#1F2937]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !plans.trim()}
            className="
              px-5 py-2.5 rounded-xl
              bg-gradient-to-br from-[#FF9500] to-[#F59E0B]
              text-white text-sm font-semibold
              cursor-pointer transition-all duration-200
              border-0
              shadow-[0_2px_8px_rgba(255,149,0,0.3)]
              hover:shadow-[0_4px_12px_rgba(255,149,0,0.4)] hover:-translate-y-px
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  )
}
