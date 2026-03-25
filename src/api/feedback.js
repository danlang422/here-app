import { supabase } from '@/api/supabase'

/**
 * Submit a feedback report via the Edge Function.
 * The Edge Function handles: saving to DB, uploading screenshot, creating Linear issue.
 */
export async function submitFeedback(reportData) {
  const { data, error } = await supabase.functions.invoke('submit-feedback', {
    body: reportData,
  })

  if (error) {
    try {
      const body = await error.context.json()
      if (body?.error) throw new Error(body.error)
    } catch (parseErr) {
      if (parseErr.message && parseErr.message !== error.message) throw parseErr
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data
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
