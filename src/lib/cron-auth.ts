import 'server-only'
import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

/**
 * Autoriza una llamada de cron. Acepta dos formas con el mismo CRON_SECRET:
 * - `x-cron-secret: <secreto>` (un planificador externo o pruebas a mano)
 * - `Authorization: Bearer <secreto>` (lo que envía Vercel Cron automáticamente)
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET ?? ''
  if (!expected) return false

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const candidate = request.headers.get('x-cron-secret') ?? bearer
  if (!candidate || candidate.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))
}
