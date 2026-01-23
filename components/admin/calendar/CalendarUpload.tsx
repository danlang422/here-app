'use client'

import { useState } from 'react'
import { uploadCalendarCSV } from '@/lib/actions/calendar'

type ParsedDay = {
  date: string
  day_type: 'A' | 'B' | 'off'
}

type UploadResult = {
  success: boolean
  imported?: number
  skipped?: number
  errors?: string[]
}

export default function CalendarUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedDay[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setResult(null)

    // Parse CSV for preview
    const text = await selectedFile.text()
    const lines = text.split('\n').filter(line => line.trim())
    const headers = lines[0].toLowerCase().split(',')
    
    const parsed: ParsedDay[] = []
    for (let i = 1; i < Math.min(lines.length, 11); i++) { // Preview first 10 rows
      const values = lines[i].split(',')
      const dateIndex = headers.indexOf('date')
      const typeIndex = headers.indexOf('day_type')
      
      if (dateIndex !== -1 && typeIndex !== -1) {
        parsed.push({
          date: values[dateIndex].trim(),
          day_type: values[typeIndex].trim().toUpperCase() as 'A' | 'B' | 'off'
        })
      }
    }
    
    setPreview(parsed)
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const result = await uploadCalendarCSV(formData)
      setResult(result)
      
      if (result.success) {
        setFile(null)
        setPreview([])
      }
    } catch (error) {
      setResult({
        success: false,
        errors: ['Upload failed. Please try again.']
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload A/B Day Calendar</h2>
      
      <div className="space-y-4">
        {/* File input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select CSV File
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          <p className="mt-1 text-sm text-gray-500">
            Expected format: date,day_type (e.g., 2025-08-21,A)
          </p>
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Preview (first 10 rows)
            </h3>
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Day Type</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.map((day, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 text-sm text-gray-900">{day.date}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          day.day_type === 'A' ? 'bg-blue-100 text-blue-800' :
                          day.day_type === 'B' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {day.day_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Upload button */}
        {file && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Uploading...' : 'Upload Calendar'}
          </button>
        )}

        {/* Results */}
        {result && (
          <div className={`p-4 rounded-md ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <div className="text-green-800">
                <p className="font-semibold">Upload successful!</p>
                <p className="text-sm mt-1">
                  Imported {result.imported} days{result.skipped && result.skipped > 0 ? ` (${result.skipped} skipped)` : ''}
                </p>
              </div>
            ) : (
              <div className="text-red-800">
                <p className="font-semibold">Upload failed</p>
                {result.errors && (
                  <ul className="text-sm mt-1 list-disc list-inside">
                    {result.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
