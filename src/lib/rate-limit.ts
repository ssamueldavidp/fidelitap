import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const isDev = process.env.NODE_ENV === 'development'

const noopLimiter = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  limit: async (_id: string) => ({ success: true, limit: 999, remaining: 999, reset: 0, pending: Promise.resolve() }),
}

const redis = isDev
  ? null
  : new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })

// 10 sellos por minuto por business_id
export const stampRateLimit = isDev
  ? noopLimiter
  : new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'rl:stamp',
    })

// 5 intentos de login por 15 minutos por IP
export const loginRateLimit = isDev
  ? noopLimiter
  : new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix: 'rl:login',
    })

// 3 solicitudes de reseteo de contraseña por 15 minutos por IP
export const passwordResetRateLimit = isDev
  ? noopLimiter
  : new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(3, '15 m'),
      prefix: 'rl:pwreset',
    })

// 5 códigos de verificación por email por 15 minutos por IP — cubre el envío de OTP
// para activar/recuperar tarjeta (web) y registro/activación de cliente (app).
// Complementa, no reemplaza, el max_frequency de Supabase (supabase/config.toml).
export const emailCodeRateLimit = isDev
  ? noopLimiter
  : new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(5, '15 m'),
      prefix: 'rl:emailcode',
    })

// 20 requests por minuto para API general
export const apiRateLimit = isDev
  ? noopLimiter
  : new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'rl:api',
    })

function makeLimiter(count: number, window: `${number} ${'s' | 'm' | 'h'}`, prefix: string) {
  return isDev ? noopLimiter : new Ratelimit({ redis: redis!, limiter: Ratelimit.slidingWindow(count, window), prefix })
}

// 10 subidas de imagen por 10 minutos por usuario
export const uploadRateLimit = makeLimiter(10, '10 m', 'rl:upload')
// 5 intentos de crear suscripción / cancelar por 10 minutos por usuario
export const billingRateLimit = makeLimiter(5, '10 m', 'rl:billing')
// 10 campañas push por 10 minutos por negocio
export const campaignRateLimit = makeLimiter(10, '10 m', 'rl:campaign')
// 10 canjes de premio por minuto por negocio
export const claimRateLimit = makeLimiter(10, '1 m', 'rl:claim')
// 60 peticiones por minuto por IP en endpoints públicos (wallet, directorio, suscripción push)
export const publicRateLimit = makeLimiter(60, '1 m', 'rl:public')

/**
 * Devuelve una respuesta 429 si se excedió el límite, o null si puede seguir.
 * Si Redis falla, deja pasar (disponibilidad) y lo registra; los logins/OTP siguen cerrando en falso
 * porque usan sus limitadores directamente.
 */
export async function rateLimited(
  limiter: { limit: (id: string) => Promise<{ success: boolean }> },
  key: string
): Promise<Response | null> {
  try {
    const { success } = await limiter.limit(key)
    return success ? null : rateLimitExceededResponse()
  } catch (err) {
    console.error('[rate-limit] fallo del limitador', err instanceof Error ? err.message : err)
    return null
  }
}

// Requires a trusted reverse proxy (Vercel/Cloudflare) that strips client-injected x-forwarded-for.
// Without a proxy, this header is attacker-controlled and can be spoofed to bypass rate limits.
export function getIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0].trim() || '127.0.0.1'
  return ip
}

// Helper para respuesta de rate limit excedido
export function rateLimitExceededResponse() {
  return Response.json(
    { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
    { status: 429, headers: { 'Retry-After': '60' } }
  )
}
