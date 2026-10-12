import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mpPayment, mpPreApproval, verifyMpSignature, cancelMpSubscription, getAuthorizedPayment } from '@/lib/mercadopago'
import { applyPreapproval, applyAuthorizedPayment, type MpPreapproval } from '@/lib/subscriptions/apply'
import type { Json } from '@/types/database'

const VALID_PAID_PLANS = ['basic', 'pro', 'premium'] as const
type PaidPlan = typeof VALID_PAID_PLANS[number]

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
    if (!paymentId) {
      // sin id no hay nada que consultar
    } else if (topic === 'subscription_preapproval' || topic === 'preapproval') {
      const pre = await mpPreApproval.get({ id: paymentId }) as unknown as MpPreapproval
      const outcome = await applyPreapproval(serviceClient, pre, { cancelOldSubscription: cancelMpSubscription })
      console.log('[mp-webhook] preapproval', paymentId, pre.status, '->', outcome)
    } else if (topic === 'subscription_authorized_payment' || topic === 'authorized_payment') {
      const ap = await getAuthorizedPayment(paymentId)
      const pre = await mpPreApproval.get({ id: ap.preapproval_id }) as unknown as MpPreapproval
      const outcome = await applyAuthorizedPayment(serviceClient, ap, pre)
      console.log('[mp-webhook] authorized_payment', paymentId, '->', outcome)
    } else if (topic === 'payment' || topic === 'payment.updated') {
      await handlePayment(paymentId, body, serviceClient)
    }
  } catch (err) {
    console.error('[mp-webhook] processing error:', err)
  }

  return NextResponse.json({ received: true })
}

// Pagos sueltos (cobros de suscripción reportados como `payment`, o pagos únicos antiguos)
async function handlePayment(
  paymentId: string,
  rawPayload: Json,
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payment = await mpPayment.get({ id: Number(paymentId) }) as any

  // external_reference is set on the Preference as "businessId:planSlug"
  const extRef = payment.external_reference as string | undefined
  const preapprovalId = payment.preapproval_id as string | undefined

  // Need either external_reference or preapproval_id to identify the business
  if (!extRef && !preapprovalId) {
    console.log('[mp-webhook] Payment has no reference, skipping:', paymentId)
    return
  }

  const biz = await findBusiness(preapprovalId ?? '', extRef, payment.payer?.email, serviceClient)
  if (!biz) {
    console.warn('[mp-webhook] Business not found for payment:', paymentId)
    return
  }

  // Resolve plan: from external_reference (preferred) or current plan
  const planSlug = resolvePlanFromExtRef(extRef, biz.plan)

  if (payment.status === 'approved') {
    // MercadoPago retries webhook deliveries — guard against re-processing the same payment twice
    const { data: existingEvent } = await serviceClient
      .from('payment_events')
      .select('id')
      .eq('mp_payment_id', paymentId)
      .eq('status', 'approved')
      .maybeSingle()

    if (existingEvent) {
      console.log('[mp-webhook] Payment already processed, skipping:', paymentId)
      return
    }

    // next_billing_date = 30 days from now (for tracking renewal)
    const nextBilling = new Date()
    nextBilling.setDate(nextBilling.getDate() + 30)

    await serviceClient
      .from('businesses')
      .update({
        plan:                  planSlug,
        subscription_status:   'active',
        mp_payer_email:        payment.payer?.email ?? null,
        subscription_end_date: nextBilling.toISOString(),
        ...(preapprovalId ? { mp_preapproval_id: preapprovalId } : {}),
      })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_payment_id:     paymentId,
      mp_preapproval_id: preapprovalId ?? null,
      event_type:        'payment_success',
      plan_slug:         planSlug,
      amount_cop:        payment.transaction_amount ?? null,
      status:            'approved',
      raw_payload:       rawPayload as Json,
    })

    console.log('[mp-webhook] Plan activated:', planSlug, 'business:', biz.id)

  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    await serviceClient
      .from('businesses')
      .update({ subscription_status: 'past_due' })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_preapproval_id: preapprovalId ?? null,
      event_type:        'payment_failed',
      plan_slug:         planSlug,
      amount_cop:        payment.transaction_amount ?? null,
      status:            payment.status,
      raw_payload:       rawPayload as Json,
    })
  }
}

// Lookup business in priority order: preapproval_id → external_reference → payer_email
// (preapproval_id is kept as a lookup key only — see the note above the POST handler.
// Checkout Pro payments won't carry one, so this branch is normally a no-op.)
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

function resolvePlanFromExtRef(
  extRef: string | undefined,
  currentPlan: string,
): 'free' | 'basic' | 'pro' | 'premium' {
  if (extRef?.includes(':')) {
    const slug = extRef.split(':')[1]
    if (VALID_PAID_PLANS.includes(slug as PaidPlan)) return slug as PaidPlan
  }
  return currentPlan as 'free' | 'basic' | 'pro' | 'premium'
}

