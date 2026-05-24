import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const isDev = process.env.NODE_ENV === 'development'

const noopLimiter = {
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

// 20 requests por minuto para API general
export const apiRateLimit = isDev
  ? noopLimiter
  : new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'rl:api',
    })

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
