import 'server-only'
// src/lib/mercadopago.ts
// Server-only MercadoPago client. Never import in 'use client' files.
import { MercadoPagoConfig, PreApproval, Payment } from 'mercadopago'
import type { MpAuthorizedPayment } from '@/lib/subscriptions/apply'

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

export function getPlanPrice(slug: PlanSlug): number {
  return PLAN_PRICES_COP[slug]
}

export function getPlanName(slug: PlanSlug): string {
  return PLAN_NAMES[slug]
}

// En sandbox MercadoPago solo acepta como pagador el correo de un usuario de prueba
// ("Both payer and collector must be real or test users"). MP_SANDBOX_PAYER_EMAIL lo
// reemplaza únicamente en pruebas; en producción se usa el correo real del negocio.
export function getPayerEmail(businessEmail: string): string {
  return process.env.MP_SANDBOX_PAYER_EMAIL || businessEmail
}

/**
 * Crea una suscripción mensual automática (PreApproval) en estado "pending" y devuelve
 * la URL donde el negocio autoriza el cobro recurrente en MercadoPago.
 * `external_reference` = `${businessId}:${planSlug}` es lo que usa el webhook para
 * saber a qué negocio y plan corresponde.
 */
export async function createSubscriptionLink(opts: {
  businessId: string
  businessEmail: string
  planSlug: PlanSlug
}): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const response = await mpPreApproval.create({
    body: {
      reason:             `FideliTap Plan ${getPlanName(opts.planSlug)}`,
      external_reference: `${opts.businessId}:${opts.planSlug}`,
      payer_email:        getPayerEmail(opts.businessEmail),
      back_url:           `${appUrl}/dashboard?subscription=success`,
      status:             'pending',
      auto_recurring: {
        frequency:          1,
        frequency_type:     'months',
        transaction_amount: getPlanPrice(opts.planSlug),
        currency_id:        'COP',
      },
    },
  })
  if (!response.init_point) throw new Error('MercadoPago no devolvió init_point')
  return response.init_point
}

/** Detiene los cobros futuros de una suscripción. */
export async function cancelMpSubscription(preapprovalId: string): Promise<void> {
  await mpPreApproval.update({ id: preapprovalId, body: { status: 'cancelled' } })
}

/** Cada cobro mensual de una suscripción (el SDK no lo expone). */
export async function getAuthorizedPayment(id: string): Promise<MpAuthorizedPayment> {
  const res = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN ?? ''}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`authorized_payments/${id} respondió ${res.status}`)
  return res.json() as Promise<MpAuthorizedPayment>
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
