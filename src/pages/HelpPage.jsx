import { useState } from 'react'
import { MdBugReport } from 'react-icons/md'
import FeedbackModal from '@/components/feedback/FeedbackModal'

export default function HelpPage() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Help Center</h1>
      <p className="text-base-content/60 mb-6">
        Need help? Found a bug? Have a suggestion?
      </p>

      <button
        className="w-full text-left p-5 rounded-xl border-2 border-base-300 hover:border-primary hover:bg-base-200 transition-colors mb-8"
        onClick={() => setModalOpen(true)}
      >
        <div className="flex items-center gap-4">
          <MdBugReport className="w-8 h-8 text-primary shrink-0" />
          <div>
            <div className="font-semibold text-lg">Submit Feedback</div>
            <div className="text-base-content/60 text-sm mt-0.5">
              Report a bug, flag a schedule issue, or share a suggestion.
            </div>
          </div>
        </div>
      </button>

      <div className="divider" />

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-1">Frequently Asked Questions</h2>
        <p className="text-base-content/40 text-sm italic">Coming soon</p>
      </div>

      <FeedbackModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
