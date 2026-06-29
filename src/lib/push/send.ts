import 'server-only'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'
import { isPushEligible } from '@/lib/push/eligibility'

type ServiceClient = ReturnType<typeof createServiceClient>

const vapidPublicKey  = process.env.VAPID_PUBLIC_KEY ?? ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? ''
const vapidSubject    = process.env.VAPID_SUBJECT ?? 'mailto:soporte@fidelitap.co'

let configured = false
function ensureConfigured() {
  if (configured) return
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas')
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

export interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey)
}

async function sendOne(
  sub: StoredSubscription,
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; expired: boolean }> {
  ensureConfigured()
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    )
    return { ok: true }
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    const expired = statusCode === 404 || statusCode === 410
    if (!expired) {
      console.error('[push] sendNotification failed', { endpoint: sub.endpoint, statusCode }, err)
    }
    return { ok: false, expired }
  }
}

/** Sends to an explicit list of subscriptions. Marks expired ones inactive. Returns count sent. */
export async function sendPushToSubscriptions(
  serviceClient: ServiceClient,
  subscriptions: StoredSubscription[],
  payload: PushPayload
): Promise<number> {
  if (!isPushConfigured() || subscriptions.length === 0) return 0

  let sentCount = 0
  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendOne(sub, payload)
      if (result.ok) {
        sentCount++
        await serviceClient
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)
      } else if (result.expired) {
        await serviceClient
          .from('push_subscriptions')
          .update({ active: false })
          .eq('id', sub.id)
      }
    })
  )
  return sentCount
}

/** Sends to every active subscription belonging to one customer_card. Returns count sent. */
export async function sendPushToCustomerCard(
  serviceClient: ServiceClient,
  customerCardId: string,
  payload: PushPayload
): Promise<number> {
  const { data: subs } = await serviceClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('customer_card_id', customerCardId)
    .eq('active', true)

  if (!subs || subs.length === 0) return 0
  return sendPushToSubscriptions(serviceClient, subs, payload)
}

/**
 * Sends a campaign to every active subscription of a business, optionally filtered
 * to customers of one specific loyalty card. Returns count sent.
 */
export async function sendCampaignPush(
  serviceClient: ServiceClient,
  params: { businessId: string; loyaltyCardId: string | null; title: string; body: string }
): Promise<number> {
  const { data: business } = await serviceClient
    .from('businesses')
    .select('plan, subscription_status')
    .eq('id', params.businessId)
    .single()

  if (!business || !isPushEligible(business.plan, business.subscription_status)) return 0

  const { data: subs } = await serviceClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, customer_card_id')
    .eq('business_id', params.businessId)
    .eq('active', true)

  let filtered = subs ?? []

  if (params.loyaltyCardId) {
    const { data: matchingCards } = await serviceClient
      .from('customer_cards')
      .select('id')
      .eq('loyalty_card_id', params.loyaltyCardId)
    const matchingIds = new Set((matchingCards ?? []).map((c) => c.id))
    filtered = filtered.filter((s) => matchingIds.has(s.customer_card_id))
  }

  return sendPushToSubscriptions(serviceClient, filtered, { title: params.title, body: params.body })
}
