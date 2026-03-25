import ScreenshotPicker from './ScreenshotPicker'

export default function BugReportForm({ formData, onChange, onScreenshotChange }) {
  return (
    <div className="space-y-4">
      <div className="form-control">
        <label className="label">
          <span className="label-text">What happened? <span className="text-error">*</span></span>
        </label>
        <textarea
          className="textarea textarea-bordered h-24"
          placeholder="Describe what went wrong…"
          value={formData.description}
          onChange={(e) => onChange('description', e.target.value)}
          maxLength={2000}
        />
        <label className="label">
          <span className="label-text-alt text-base-content/50">
            {formData.description.length}/2000
          </span>
        </label>
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">What were you trying to do?</span>
        </label>
        <textarea
          className="textarea textarea-bordered h-16"
          placeholder="Optional — describe what you were attempting…"
          value={formData.expected_behavior}
          onChange={(e) => onChange('expected_behavior', e.target.value)}
          maxLength={1000}
        />
      </div>

      <ScreenshotPicker file={formData.screenshot} onChange={onScreenshotChange} />
    </div>
  )
}
