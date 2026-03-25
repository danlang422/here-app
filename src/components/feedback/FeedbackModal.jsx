import { useState, useEffect } from 'react'
import { FaTimes, FaArrowLeft, FaBug, FaCalendarAlt, FaLightbulb } from 'react-icons/fa'
import useAuthStore from '@/store/authStore'
import { submitFeedback, fileToBase64 } from '@/api/feedback'
import BugReportForm from './BugReportForm'
import ScheduleIssueForm from './ScheduleIssueForm'
import FeedbackForm from './FeedbackForm'

const REPORT_TYPES = [
  {
    key: 'bug',
    icon: FaBug,
    label: 'Bug Report',
    description: 'Something isn\'t working right',
  },
  {
    key: 'schedule_issue',
    icon: FaCalendarAlt,
    label: 'Schedule Issue',
    description: 'My schedule is wrong or missing something',
  },
  {
    key: 'feedback',
    icon: FaLightbulb,
    label: 'Feedback / Suggestion',
    description: 'An idea or something that could be better',
  },
]

const initialFormData = {
  description: '',
  expected_behavior: '',
  activity_id: null,
  activity_name_text: '',
  screenshot: null,
}

export default function FeedbackModal({ isOpen, onClose }) {
  const { currentRole } = useAuthStore()
  const [step, setStep] = useState('select') // 'select' | 'form' | 'success'
  const [reportType, setReportType] = useState(null)
  const [formData, setFormData] = useState(initialFormData)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('select')
      setReportType(null)
      setFormData(initialFormData)
      setSubmitError(null)
    }
  }, [isOpen])

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  function handleTypeSelect(type) {
    setReportType(type)
    setFormData(initialFormData)
    setSubmitError(null)
    setStep('form')
  }

  function handleBack() {
    setStep('select')
    setReportType(null)
    setSubmitError(null)
  }

  function handleFieldChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function handleScreenshotChange(file) {
    setFormData((prev) => ({ ...prev, screenshot: file }))
  }

  function isFormValid() {
    return formData.description.trim().length >= 10
  }

  async function handleSubmit() {
    if (!isFormValid() || submitting) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        report_type: reportType,
        description: formData.description.trim(),
        page_route: window.location.pathname,
        user_agent: navigator.userAgent,
        screen_size: `${window.innerWidth}x${window.innerHeight}`,
        user_role: currentRole,
      }

      if (reportType === 'bug' && formData.expected_behavior.trim()) {
        payload.expected_behavior = formData.expected_behavior.trim()
      }

      if (reportType === 'schedule_issue') {
        if (formData.activity_id) payload.activity_id = formData.activity_id
        if (formData.activity_name_text.trim()) {
          payload.activity_name_text = formData.activity_name_text.trim()
        }
      }

      if (formData.screenshot) {
        payload.screenshot_base64 = await fileToBase64(formData.screenshot)
        payload.screenshot_filename = formData.screenshot.name
        payload.screenshot_content_type = formData.screenshot.type
      }

      await submitFeedback(payload)
      setStep('success')

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedType = REPORT_TYPES.find((t) => t.key === reportType)

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-lg relative">
        {/* Close button */}
        <button
          className="btn btn-sm btn-circle absolute right-3 top-3"
          onClick={onClose}
          aria-label="Close"
        >
          <FaTimes size={12} />
        </button>

        {/* Step: Type selection */}
        {step === 'select' && (
          <>
            <h3 className="font-bold text-lg mb-4">What would you like to report?</h3>
            <div className="space-y-3">
              {REPORT_TYPES.map(({ key, icon, label, description }) => {
                const TypeIcon = icon
                return (
                  <button
                    key={key}
                    className="w-full text-left p-4 rounded-lg border border-base-300 hover:border-primary hover:bg-base-200 transition-colors"
                    onClick={() => handleTypeSelect(key)}
                  >
                    <div className="flex items-center gap-3">
                      <TypeIcon className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-sm text-base-content/60">{description}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Step: Form */}
        {step === 'form' && selectedType && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button
                className="btn btn-ghost btn-xs"
                onClick={handleBack}
                aria-label="Back"
              >
                <FaArrowLeft size={12} />
              </button>
              <h3 className="font-bold text-lg">{selectedType.label}</h3>
            </div>

            {reportType === 'bug' && (
              <BugReportForm
                formData={formData}
                onChange={handleFieldChange}
                onScreenshotChange={handleScreenshotChange}
              />
            )}
            {reportType === 'schedule_issue' && (
              <ScheduleIssueForm
                formData={formData}
                onChange={handleFieldChange}
                onScreenshotChange={handleScreenshotChange}
              />
            )}
            {reportType === 'feedback' && (
              <FeedbackForm formData={formData} onChange={handleFieldChange} />
            )}

            {submitError && (
              <div className="alert alert-error mt-4 text-sm">
                <span>{submitError}</span>
              </div>
            )}

            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={handleBack} disabled={submitting}>
                Back
              </button>
              <button
                className={`btn btn-primary ${submitting ? 'loading' : ''}`}
                onClick={handleSubmit}
                disabled={!isFormValid() || submitting}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✓</div>
            <h3 className="font-bold text-lg mb-1">Thanks! We got your report.</h3>
            <p className="text-base-content/60 text-sm">This window will close automatically.</p>
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  )
}
