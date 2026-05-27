import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mpPreApproval, verifyMpSignature } from '@/lib/mercadopago'
import type { Json } from '@/types/database'

const SUBSCRIPTION_PLANS: Record<string, 'basic' | 'pro' | 'premium'> = {
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
      await handlePayment(notificationId, body, serviceClient)
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

  const { data: business } = await serviceClient
    .from('businesses')
    .select('id, plan')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle()

  const { data: businessByEmail } = !business
    ? await serviceClient
        .from('businesses')
        .select('id, plan')
        .eq('mp_payer_email', preapproval.payer_email ?? '')
        .maybeSingle()
    : { data: null }

  const biz = business ?? businessByEmail
  if (!biz) {
    console.warn('[mp-webhook] Business not found for preapproval:', preapprovalId)
    return
  }

  const planSlug =
    preapproval.preapproval_plan_id
      ? (SUBSCRIPTION_PLANS[preapproval.preapproval_plan_id] ?? biz.plan)
      : biz.plan

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
    await serviceClient
      .from('businesses')
      .update({
        subscription_status: 'canceled',
        plan:                'free',
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
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  console.log('[mp-webhook] payment received:', paymentId, rawPayload)
}
