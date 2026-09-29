import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { isPushEligible } from '@/lib/push/eligibility'
import { sendPushToTokens, type PushPayload } from '@/lib/push/firebase'
import { sendWebPush } from '@/lib/push/webpush'

type ServiceClient = ReturnType<typeof createServiceClient>

export type { PushPayload }

// Re-export for callers that previously imported isPushEligible from this file
export { isPushEligible }

// Sends to both delivery channels for a set of customer_ids: FCM device
// tokens (mobile app) and browser Web Push subscriptions (opted in from the
// public activation success screen, no app installed). Deactivates any
// subscription the push service reports as gone. Returns the combined count.
async function sendToCustomers(
  service: ServiceClient,
  customerIds: string[],
  payload: PushPayload
): Promise<number> {
  if (customerIds.length === 0) return 0

  const [tokenRes, subRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).from('device_tokens').select('expo_token').in('customer_id', customerIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('customer_id', customerIds)
      .eq('active', true),
  ])

  const tokens = ((tokenRes.data ?? []) as { expo_token: string }[]).map((r) => r.expo_token)
  const fcmSent = tokens.length > 0 ? await sendPushToTokens(tokens, payload) : 0

  const subs = (subRes.data ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]
  const { sent: webSent, expired } = await sendWebPush(subs, { title: payload.title, body: payload.body })
  if (expired.length > 0) {
    await service.from('push_subscriptions').update({ active: false }).in('id', expired)
  }

  return fcmSent + webSent
}

/**
 * Sends a push notification to a given customer_card's owner, on every
 * channel they're reachable on (mobile app FCM token, browser Web Push
 * subscription). Returns count sent.
 */
export async function sendPushToCustomerCard(
  _serviceClient: ServiceClient,
  customerCardId: string,
  payload: PushPayload
): Promise<number> {
  const service = createServiceClient()

  // Resolve customer_id from customer_cards
  const { data: cc } = await service
    .from('customer_cards')
    .select('customer_id')
    .eq('id', customerCardId)
    .maybeSingle()

  if (!cc?.customer_id) return 0

  return sendToCustomers(service, [cc.customer_id], payload)
}

/**
 * Sends a campaign push to every customer with active cards for a business,
 * optionally filtered to one specific loyalty card.
 * Checks plan eligibility (Pro/Premium) before sending.
 * Returns count sent.
 */
export async function sendCampaignPush(
  _serviceClient: ServiceClient,
  params: { businessId: string; loyaltyCardId: string | null; title: string; body: string }
): Promise<number> {
  const service = createServiceClient()

  // Check plan eligibility
  const { data: business } = await service
    .from('businesses')
    .select('plan, subscription_status')
    .eq('id', params.businessId)
    .single()

  if (!business || !isPushEligible(business.plan, business.subscription_status)) return 0

  // Get customer_ids with active cards for this business
  let cardQuery = service
    .from('customer_cards')
    .select('customer_id, loyalty_cards!inner(business_id)')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('loyalty_cards.business_id' as any, params.businessId)

  if (params.loyaltyCardId) {
    cardQuery = cardQuery.eq('loyalty_card_id', params.loyaltyCardId) as typeof cardQuery
  }

  const { data: cardRows } = await cardQuery

  if (!cardRows || cardRows.length === 0) return 0

  const customerIds = Array.from(new Set(cardRows.map((r) => r.customer_id as string)))

  return sendToCustomers(service, customerIds, { title: params.title, body: params.body })
}

/**
 * Sends a push notification to a customer by their customer ID.
 * Convenience wrapper used when you already have the customer_id.
 */
export async function sendPushToCustomer(
  customerId: string,
  payload: PushPayload
): Promise<void> {
  const service = createServiceClient()
  await sendToCustomers(service, [customerId], payload)
}

/**
 * Sends a push to all customers of a business, on every channel they're
 * reachable on. Does NOT check plan eligibility — caller is responsible.
 * Returns count sent.
 */
export async function sendPushToBusinessCustomers(
  businessId: string,
  payload: PushPayload
): Promise<number> {
  const service = createServiceClient()

  const { data: cardRows } = await service
    .from('customer_cards')
    .select('customer_id, loyalty_cards!inner(business_id)')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('loyalty_cards.business_id' as any, businessId)

  if (!cardRows || cardRows.length === 0) return 0

  const customerIds = Array.from(new Set(cardRows.map((r) => r.customer_id as string)))

  return sendToCustomers(service, customerIds, payload)
}
