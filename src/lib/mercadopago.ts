// src/lib/mercadopago.ts
// Server-only MercadoPago client. Never import in 'use client' files.
import { MercadoPagoConfig, PreApproval, Payment } from 'mercadopago'

export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN ?? '',
})

export const mpPreApproval = new PreApproval(mpClient)
export const mpPayment = new Payment(mpClient)

export type PlanSlug = 'basic' | 'pro' | 'premium'

const PLAN_PRICES_COP: Record<PlanSlug, number> = {
  basic:   49900,
  pro:     99900,
  premium: 179900,
}

const PLAN_NAMES: Record<PlanSlug, string> = {
  basic:   'Básico',
  pro:     'Pro',
  premium: 'Premium',
}

export function getMpPlanId(slug: PlanSlug): string {
  const envKey = `MP_PLAN_ID_${slug.toUpperCase()}` as
    | 'MP_PLAN_ID_BASIC'
    | 'MP_PLAN_ID_PRO'
    | 'MP_PLAN_ID_PREMIUM'
  const id = process.env[envKey]
  if (!id) throw new Error(`${envKey} is not set in environment variables`)
  return id
}

export function getPlanPrice(slug: PlanSlug): number {
  return PLAN_PRICES_COP[slug]
}

export function getPlanName(slug: PlanSlug): string {
  return PLAN_NAMES[slug]
}

/**
 * Verify MercadoPago webhook x-signature header.
 * Header format: "ts=<timestamp>,v1=<hash>"
 */
export async function verifyMpSignature(
  xSignature: string | null,
  xRequestId: string | null,
  notificationId: string | null,
): Promise<boolean> {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[mp-webhook] MP_WEBHOOK_SECRET not set — skipping signature verification in dev')
    return true
  }
  if (!xSignature || !xRequestId || !notificationId) return false

  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const [key, value] = part.split('=')
      return [key.trim(), value?.trim()]
    })
  )
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  const manifest = `id:${notificationId};request-id:${xRequestId};ts:${ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const computed = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computed === v1
}
