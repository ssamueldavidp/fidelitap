import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mpPreApproval, verifyMpSignature } from '@/lib/mercadopago'
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

  const serviceClient = createServiceClient()

  try {
    if (topic === 'preapproval' && notificationId) {
      await handlePreapproval(notificationId, body, serviceClient)
    } else if (topic === 'payment' && notificationId) {
      await handlePayment(notificationId, body)
    }
  } catch (err) {
    console.error('[mp-webhook] processing error:', err)
  }

  return NextResponse.json({ received: true })
}

async function handlePreapproval(
  preapprovalId: string,
  rawPayload: Json,
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preapproval = await mpPreApproval.get({ id: preapprovalId }) as any

  // Lookup 1: by mp_preapproval_id (already linked)
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id, plan, subscription_end_date')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle()

  // Lookup 2: by external_reference (business.id or business.id:planSlug)
  const extRef = preapproval.external_reference as string | undefined
  const extRefBusinessId = extRef?.split(':')[0]
  const { data: businessByRef } = (!business && extRefBusinessId)
    ? await serviceClient
        .from('businesses')
        .select('id, plan, subscription_end_date')
        .eq('id', extRefBusinessId)
        .maybeSingle()
    : { data: null }

  // Lookup 3: payer email fallback
  const { data: businessByEmail } = (!business && !businessByRef)
    ? await serviceClient
        .from('businesses')
        .select('id, plan, subscription_end_date')
        .eq('mp_payer_email', preapproval.payer_email ?? '')
        .maybeSingle()
    : { data: null }

  const biz = business ?? businessByRef ?? businessByEmail
  if (!biz) {
    console.warn('[mp-webhook] Business not found for preapproval:', preapprovalId)
    return
  }

  // Resolve the plan slug — priority: MP plan ID > external_reference > current plan
  let planSlug: 'free' | 'basic' | 'pro' | 'premium' = biz.plan as 'free' | 'basic' | 'pro' | 'premium'
  if (preapproval.preapproval_plan_id && SUBSCRIPTION_PLANS[preapproval.preapproval_plan_id]) {
    planSlug = SUBSCRIPTION_PLANS[preapproval.preapproval_plan_id]
  } else if (extRef?.includes(':')) {
    const slugFromRef = extRef.split(':')[1]
    if (VALID_PAID_PLANS.includes(slugFromRef as PaidPlan)) {
      planSlug = slugFromRef as PaidPlan
    }
  }

  if (preapproval.status === 'authorized') {
    await serviceClient
      .from('businesses')
      .update({
        plan:                  planSlug,
        subscription_status:   'active',
        mp_preapproval_id:     preapproval.id,
        mp_payer_email:        preapproval.payer_email,
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
    // Only downgrade to free if there's no grace period remaining
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

async function handlePayment(
  paymentId: string,
  rawPayload: Json,
) {
  console.log('[mp-webhook] payment received:', paymentId, rawPayload)
}
