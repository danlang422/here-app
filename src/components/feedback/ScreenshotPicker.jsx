import { useState, useRef } from 'react'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const MAX_SIZE_MB = 5

export default function ScreenshotPicker({ file, onChange }) {
  const inputRef = useRef(null)
  const [error, setError] = useState(null)

  function handleChange(e) {
    const selected = e.target.files?.[0]
    if (!selected) return

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError('Only PNG, JPG, GIF, and WebP images are supported.')
      return
    }

    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_SIZE_MB}MB.`)
      return
    }

    setError(null)
    onChange(selected)
  }

  function handleRemove() {
    onChange(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const previewUrl = file ? URL.createObjectURL(file) : null

  return (
    <div className="space-y-2">
      <label className="label">
        <span className="label-text">Screenshot (optional)</span>
      </label>

      {file ? (
        <div className="flex items-start gap-3">
          <img
            src={previewUrl}
            alt="Screenshot preview"
            className="w-24 h-24 object-cover rounded border border-base-300"
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm text-base-content/70 break-all">{file.name}</span>
            <button
              type="button"
              className="btn btn-xs btn-ghost text-error w-fit"
              onClick={handleRemove}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="file-input file-input-bordered file-input-sm w-full"
          onChange={handleChange}
        />
      )}

      {error && <p className="text-error text-sm">{error}</p>}
    </div>
  )
}
