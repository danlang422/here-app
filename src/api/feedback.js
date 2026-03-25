import { supabase } from '@/api/supabase'

/**
 * Submit a feedback report via the Edge Function.
 * The Edge Function handles: saving to DB, uploading screenshot, creating Linear issue.
 */
export async function submitFeedback(reportData) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-feedback`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(reportData),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to submit feedback')
  }

  return response.json()
}

/**
 * Convert a File object to base64 string for transmission.
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Strip the data URL prefix (data:image/png;base64,)
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
