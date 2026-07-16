// Decodes a JWT's payload without verifying its signature. Only used for a
// client-side UX/routing decision (see needsPasswordSetup) — the real
// security boundary is always Postgres RLS/PostgREST re-verifying the token
// server-side, never this.
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1]
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    // atob() requires padding to a multiple of 4; base64url tokens omit it.
    while (base64.length % 4) base64 += '='
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

// Returns the method of the most recent entry in the session's `amr`
// (Authentication Methods Reference) claim — e.g. 'password', 'recovery',
// 'invite' — or null if unavailable.
export function getLatestAuthMethod(session) {
  const payload = session?.access_token && decodeJwtPayload(session.access_token)
  const amr = payload?.amr
  if (!Array.isArray(amr) || amr.length === 0) return null

  // Entries are normally {method, timestamp} objects, but the spec also
  // allows plain strings (RFC 8176) - handle both.
  const latest = amr.reduce((latest, entry) => {
    const ts = typeof entry === 'string' ? 0 : (entry.timestamp ?? 0)
    const latestTs = typeof latest === 'string' ? 0 : (latest?.timestamp ?? 0)
    return ts >= latestTs ? entry : latest
  }, amr[0])

  return typeof latest === 'string' ? latest : latest?.method ?? null
}

// True if the session was most recently established via a password-recovery
// or account-invite link, meaning the user hasn't yet completed setting a
// real password. Used to force a durable redirect to /reset-password —
// re-derived from the session on every load/refresh, not a one-time event
// flag — so it survives navigation away from the password-set page.
//
// Verified live against a real recovery link (session 58): Supabase's actual
// GoTrue server stamps both recovery and invite links with amr method 'otp'
// (its /verify endpoint is a shared OTP-verification path for signup,
// recovery, invite, magiclink, and email_change) — not the type-specific
// 'recovery'/'invite' values the public JWT claims docs describe. 'otp' is
// checked as the real signal; 'recovery'/'invite' are kept as a defensive
// fallback in case that behavior differs by config/version. Confirmed safe
// to gate broadly on 'otp' for this app specifically: Here has no magic-link
// sign-in, no self-serve signup, and no email-change flow, so recovery/invite
// links are the only way a session is ever established via OTP verification.
// See docs/architecture/here-security-decisions.md, Session Management Policy.
export function needsPasswordSetup(session) {
  const method = getLatestAuthMethod(session)
  return method === 'otp' || method === 'recovery' || method === 'invite'
}
