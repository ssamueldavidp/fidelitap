import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mpPreApproval, mpPayment, verifyMpSignature } from '@/lib/mercadopago'
import type { Json } from '@/types/database'

const VALID_PAID_PLANS = ['basic', 'pro', 'premium'] as const
type PaidPlan = typeof VALID_PAID_PLANS[number]

const SUBSCRIPTION_PLANS: Record<string, PaidPlan> = {
  [process.env.MP_PLAN_ID_BASIC   ?? 'UNSET_BASIC']:   'basic',
  [process.env.MP_PLAN_ID_PRO     ?? 'UNSET_PRO']:     'pro',
  [process.env.MP_PLAN_ID_PREMIUM ?? 'UNSET_PREMIUM']: 'premium',
}

export async function POST(request: NextRequest) {
  const xSignature  = request.headers.get('x-signature')
  const xRequestId  = request.headers.get('x-request-id')
  const { searchParams } = request.nextUrl
  const notificationId = searchParams.get('id') ?? searchParams.get('data.id')
  const topic = searchParams.get('topic') ?? searchParams.get('type')

  const isValid = await verifyMpSignature(xSignature, xRequestId, notificationId)
  if (!isValid) {
    console.error('[mp-webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: Json
  try {
    body = await request.json() as Json
  } catch {
    body = {}
  }

  // MP can send body with data.id instead of query param
  const paymentId = notificationId
    ?? (body as Record<string, unknown>)?.['data.id'] as string
    ?? ((body as Record<string, unknown>)?.data as Record<string, unknown>)?.id as string

  const serviceClient = createServiceClient()

  try {
    if ((topic === 'payment' || topic === 'payment.updated') && paymentId) {
      await handlePayment(paymentId, body, serviceClient)
    } else if (topic === 'preapproval' && paymentId) {
      await handlePreapproval(paymentId, body, serviceClient)
    }
  } catch (err) {
    console.error('[mp-webhook] processing error:', err)
  }

  return NextResponse.json({ received: true })
}

// Handles payment webhooks — used when subscription_preapproval topic isn't available
async function handlePayment(
  paymentId: string,
  rawPayload: Json,
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payment = await mpPayment.get({ id: Number(paymentId) }) as any

  // Only process subscription payments (have a preapproval_id)
  const preapprovalId = payment.preapproval_id as string | undefined
  if (!preapprovalId) {
    console.log('[mp-webhook] Payment is not a subscription payment, skipping:', paymentId)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preapproval = await mpPreApproval.get({ id: preapprovalId }) as any
  const extRef = preapproval.external_reference as string | undefined

  const biz = await findBusiness(preapprovalId, extRef, payment.payer?.email, serviceClient)
  if (!biz) {
    console.warn('[mp-webhook] Business not found for payment:', paymentId, 'preapproval:', preapprovalId)
    return
  }

  const planSlug = resolvePlanSlug(preapproval, extRef, biz.plan)

  if (payment.status === 'approved') {
    await serviceClient
      .from('businesses')
      .update({
        plan:                  planSlug,
        subscription_status:   'active',
        mp_preapproval_id:     preapprovalId,
        mp_payer_email:        payment.payer?.email ?? null,
        subscription_end_date: null,
      })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_preapproval_id: preapprovalId,
      event_type:        'payment_success',
      plan_slug:         planSlug,
      amount_cop:        payment.transaction_amount ?? null,
      status:            'approved',
      raw_payload:       rawPayload as Json,
    })

    console.log('[mp-webhook] Plan activated:', planSlug, 'for business:', biz.id)

  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    await serviceClient
      .from('businesses')
      .update({ subscription_status: 'past_due' })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_preapproval_id: preapprovalId,
      event_type:        'payment_failed',
      plan_slug:         planSlug,
      amount_cop:        payment.transaction_amount ?? null,
      status:            payment.status,
      raw_payload:       rawPayload as Json,
    })
  }
}

// Handles preapproval webhooks (when topic is available)
async function handlePreapproval(
  preapprovalId: string,
  rawPayload: Json,
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preapproval = await mpPreApproval.get({ id: preapprovalId }) as any
  const extRef = preapproval.external_reference as string | undefined

  const biz = await findBusiness(preapprovalId, extRef, preapproval.payer_email, serviceClient)
  if (!biz) {
    console.warn('[mp-webhook] Business not found for preapproval:', preapprovalId)
    return
  }

  const planSlug = resolvePlanSlug(preapproval, extRef, biz.plan)

  if (preapproval.status === 'authorized') {
    await serviceClient
      .from('businesses')
      .update({
        plan:                  planSlug,
        subscription_status:   'active',
        mp_preapproval_id:     preapproval.id,
        mp_payer_email:        preapproval.payer_email ?? null,
        subscription_end_date: null,
      })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_preapproval_id: preapproval.id,
      event_type:        'payment_success',
      plan_slug:         planSlug,
      status:            'authorized',
      raw_payload:       rawPayload as Json,
    })

  } else if (preapproval.status === 'cancelled') {
    const hasGrace = biz.subscription_end_date
      ? new Date(biz.subscription_end_date) > new Date()
      : false

    await serviceClient
      .from('businesses')
      .update({
        subscription_status: 'canceled',
        ...(hasGrace ? {} : { plan: 'free' }),
      })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_preapproval_id: preapproval.id,
      event_type:        'subscription_cancelled',
      plan_slug:         planSlug,
      status:            'cancelled',
      raw_payload:       rawPayload as Json,
    })

  } else if (preapproval.status === 'paused' || preapproval.status === 'pending') {
    await serviceClient
      .from('businesses')
      .update({ subscription_status: 'past_due' })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_preapproval_id: preapproval.id,
      event_type:        'payment_failed',
      plan_slug:         planSlug,
      status:            preapproval.status,
      raw_payload:       rawPayload as Json,
    })
  }
}

// Lookup business in priority order: preapproval_id → external_reference → payer_email
async function findBusiness(
  preapprovalId: string,
  extRef: string | undefined,
  payerEmail: string | undefined,
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  const { data: byPreapproval } = await serviceClient
    .from('businesses')
    .select('id, plan, subscription_end_date')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle()
  if (byPreapproval) return byPreapproval

  const extRefBusinessId = extRef?.split(':')[0]
  if (extRefBusinessId) {
    const { data: byRef } = await serviceClient
      .from('businesses')
      .select('id, plan, subscription_end_date')
      .eq('id', extRefBusinessId)
      .maybeSingle()
    if (byRef) return byRef
  }

  if (payerEmail) {
    const { data: byEmail } = await serviceClient
      .from('businesses')
      .select('id, plan, subscription_end_date')
      .eq('mp_payer_email', payerEmail)
      .maybeSingle()
    if (byEmail) return byEmail
  }

  return null
}

// Resolve plan slug from preapproval_plan_id > external_reference > fallback
function resolvePlanSlug(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preapproval: any,
  extRef: string | undefined,
  currentPlan: string,
): 'free' | 'basic' | 'pro' | 'premium' {
  if (preapproval.preapproval_plan_id && SUBSCRIPTION_PLANS[preapproval.preapproval_plan_id]) {
    return SUBSCRIPTION_PLANS[preapproval.preapproval_plan_id]
  }
  if (extRef?.includes(':')) {
    const slug = extRef.split(':')[1]
    if (VALID_PAID_PLANS.includes(slug as PaidPlan)) return slug as PaidPlan
  }
  return currentPlan as 'free' | 'basic' | 'pro' | 'premium'
}
