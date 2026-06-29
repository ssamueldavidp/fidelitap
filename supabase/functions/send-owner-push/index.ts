import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendFcmPush } from '../_shared/fcm.ts'

type OwnerEvent = 'new_customer' | 'card_completed' | 'payment_failed'

const eventCopy: Record<OwnerEvent, (payload: Record<string, string>) => { title: string; body: string }> = {
  new_customer: (p) => ({
    title: '¡Nuevo cliente! 🎉',
    body: `${p.customerName ?? 'Un cliente'} activó tu tarjeta "${p.cardName ?? ''}"`,
  }),
  card_completed: (p) => ({
    title: '¡Premio reclamado! 🏆',
    body: `${p.customerName ?? 'Un cliente'} completó su tarjeta "${p.cardName ?? ''}"`,
  }),
  payment_failed: (_) => ({
    title: 'Problema con tu suscripción ⚠️',
    body: 'El pago de tu plan FideliTap falló. Actualiza tu método de pago.',
  }),
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const { business_id, event, payload = {} } = await req.json() as {
    business_id: string
    event: OwnerEvent
    payload?: Record<string, string>
  }

  if (!business_id || !event) {
    return new Response(JSON.stringify({ error: 'business_id and event required' }), { status: 400 })
  }

  const db = createClient(supabaseUrl, serviceKey)

  // Check business plan is Pro+
  const { data: biz } = await db
    .from('businesses')
    .select('plan, owner_id')
    .eq('id', business_id)
    .single()

  if (!biz || !['pro', 'premium'].includes(biz.plan ?? '')) {
    return new Response(JSON.stringify({ skipped: 'not_pro' }), { status: 200 })
  }

  // Get owner's device tokens
  const { data: tokens } = await db
    .from('device_tokens')
    .select('fcm_token')
    .eq('user_id', biz.owner_id)

  const fcmTokens = tokens?.map((t) => t.fcm_token) ?? []
  if (fcmTokens.length === 0) {
    return new Response(JSON.stringify({ skipped: 'no_tokens' }), { status: 200 })
  }

  const copyFn = eventCopy[event]
  if (!copyFn) {
    return new Response(JSON.stringify({ error: `Unknown event: ${event}` }), { status: 400 })
  }
  const { title, body } = copyFn(payload)

  await sendFcmPush(fcmTokens, title, body, { business_id, event })

  return new Response(
    JSON.stringify({ sent: true, tokens: fcmTokens.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
