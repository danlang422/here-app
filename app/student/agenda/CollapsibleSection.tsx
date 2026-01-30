'use client'

import { useState, useEffect } from 'react'

interface CollapsibleSectionProps {
  sectionId: string
  plans: string | null
  progress: string | null
  isExpanded: boolean
  onToggle: () => void
}

export default function CollapsibleSection({
  sectionId,
  plans,
  progress,
  isExpanded,
  onToggle,
}: CollapsibleSectionProps) {
  const [activeTab, setActiveTab] = useState<'plans' | 'progress'>('plans')

  // Load collapsed state from sessionStorage on mount
  useEffect(() => {
    const storageKey = `agenda-card-${sectionId}-collapsed`
    const wasCollapsed = sessionStorage.getItem(storageKey) === 'true'
    if (wasCollapsed !== !isExpanded) {
      onToggle()
    }
  }, [sectionId])

  // Save collapsed state to sessionStorage
  useEffect(() => {
    const storageKey = `agenda-card-${sectionId}-collapsed`
    sessionStorage.setItem(storageKey, (!isExpanded).toString())
  }, [isExpanded, sectionId])

  return (
    <div className="mt-4">
      <button
        onClick={onToggle}
        className="
          w-full bg-transparent border-0 py-2
          flex items-center gap-2
          text-sm font-semibold text-[#6B7280]
          cursor-pointer transition-colors duration-200
          hover:text-[#1F2937]
        "
      >
        <span className={`transition-transform duration-300 ${isExpanded ? '' : '-rotate-90'}`}>
          ▼
        </span>
        Your plans & progress
      </button>

      {isExpanded && (
        <div className="
          mt-2 p-4 rounded-xl
          bg-[rgba(255,149,0,0.03)]
          border-l-[3px] border-l-[#FF9500]
        ">
          <div className="flex gap-4 mb-3 border-b-2 border-b-[rgba(0,0,0,0.05)]">
            <button
              onClick={() => setActiveTab('plans')}
              className={`
                bg-transparent border-0 px-1 py-2
                text-sm font-semibold
                cursor-pointer transition-all duration-200
                border-b-2 -mb-0.5
                ${activeTab === 'plans'
                  ? 'text-[#FF9500] border-b-[#FF9500]'
                  : 'text-[#6B7280] border-b-transparent hover:text-[#1F2937]'
                }
              `}
            >
              Plans
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`
                bg-transparent border-0 px-1 py-2
                text-sm font-semibold
                cursor-pointer transition-all duration-200
                border-b-2 -mb-0.5
                ${activeTab === 'progress'
                  ? 'text-[#FF9500] border-b-[#FF9500]'
                  : 'text-[#6B7280] border-b-transparent hover:text-[#1F2937]'
                }
              `}
            >
              Progress
            </button>
          </div>
          <div>
            {activeTab === 'plans' ? (
              <div className="text-sm leading-relaxed text-[#1F2937] whitespace-pre-wrap">
                {plans || 'No plans yet.'}
              </div>
            ) : (
              <div className="text-sm leading-relaxed text-[#1F2937] whitespace-pre-wrap">
                {progress || 'No progress yet.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
