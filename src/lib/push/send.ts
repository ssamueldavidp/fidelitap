import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { isPushEligible } from '@/lib/push/eligibility'
import { sendPushToTokens, type PushPayload } from '@/lib/push/firebase'

type ServiceClient = ReturnType<typeof createServiceClient>

export type { PushPayload }

// Re-export for callers that previously imported isPushEligible from this file
export { isPushEligible }

/**
 * Sends a push notification to all FCM tokens registered for a given customer_card.
 * Looks up the customer_id from customer_cards, then fetches tokens from device_tokens.
 * Returns count sent.
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

  // Fetch all FCM tokens for this customer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tokenRows } = await (service as any)
    .from('device_tokens')
    .select('expo_token')
    .eq('customer_id', cc.customer_id)

  if (!tokenRows || tokenRows.length === 0) return 0

  const tokens = (tokenRows as { expo_token: string }[]).map((r) => r.expo_token)
  return sendPushToTokens(tokens, payload)
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

  // Fetch FCM tokens for all these customers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tokenRows } = await (service as any)
    .from('device_tokens')
    .select('expo_token')
    .in('customer_id', customerIds)

  if (!tokenRows || tokenRows.length === 0) return 0

  const tokens = (tokenRows as { expo_token: string }[]).map((r) => r.expo_token)
  return sendPushToTokens(tokens, { title: params.title, body: params.body })
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tokenRows } = await (service as any)
    .from('device_tokens')
    .select('expo_token')
    .eq('customer_id', customerId)

  if (!tokenRows || tokenRows.length === 0) return

  const tokens = (tokenRows as { expo_token: string }[]).map((r) => r.expo_token)
  await sendPushToTokens(tokens, payload)
}

/**
 * Sends a push to all customers of a business who have FCM tokens registered.
 * Does NOT check plan eligibility — caller is responsible.
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tokenRows } = await (service as any)
    .from('device_tokens')
    .select('expo_token')
    .in('customer_id', customerIds)

  if (!tokenRows || tokenRows.length === 0) return 0

  const tokens = (tokenRows as { expo_token: string }[]).map((r) => r.expo_token)
  return sendPushToTokens(tokens, payload)
}
