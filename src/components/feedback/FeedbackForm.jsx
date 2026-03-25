export default function FeedbackForm({ formData, onChange }) {
  return (
    <div className="space-y-4">
      <div className="form-control">
        <label className="label">
          <span className="label-text">What&apos;s on your mind? <span className="text-error">*</span></span>
        </label>
        <textarea
          className="textarea textarea-bordered h-32"
          placeholder="Share your idea or suggestion…"
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
    </div>
  )
}
