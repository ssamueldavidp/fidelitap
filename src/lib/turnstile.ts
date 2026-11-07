import 'server-only'

// Protección contra bots (Cloudflare Turnstile). Sin TURNSTILE_SECRET_KEY queda desactivada
// (desarrollo local); en producción se activa al definir las dos llaves.
export function turnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY
}

export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip && ip !== '127.0.0.1') body.set('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (err) {
    console.error('[turnstile] verificación fallida', err instanceof Error ? err.message : err)
    return false
  }
}
