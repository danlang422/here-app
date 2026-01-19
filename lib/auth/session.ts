import { cookies } from 'next/headers'

/**
 * Get the current role from session cookie
 * Defaults to user's primary role if not set
 */
export async function getCurrentRole(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('current_role')?.value || null
}

/**
 * Set the current role in session cookie
 */
export async function setCurrentRole(role: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('current_role', role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  })
}

/**
 * Clear the current role from session cookie
 */
export async function clearCurrentRole(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('current_role')
}
