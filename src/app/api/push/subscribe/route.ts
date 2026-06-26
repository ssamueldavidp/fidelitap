import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { isPushEligible } from '@/lib/push/send'

const subscribeSchema = z.object({
  customerCardId: z.string().uuid(),
  walletAuthToken: z.string().uuid(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
})

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null)
  const parsed = subscribeSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { customerCardId, walletAuthToken, subscription } = parsed.data
  const supabase = createServiceClient()

  const { data: cc } = await supabase
    .from('customer_cards')
    .select(`
      id,
      customer_id,
      wallet_auth_token,
      loyalty_cards ( business_id, businesses ( plan, subscription_status ) )
    `)
    .eq('id', customerCardId)
    .maybeSingle()

  if (!cc) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const storedToken = cc.wallet_auth_token ?? ''
  if (
    storedToken.length !== walletAuthToken.length ||
    !timingSafeEqual(Buffer.from(storedToken), Buffer.from(walletAuthToken))
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const card = cc.loyalty_cards as unknown as {
    business_id: string
    businesses: { plan: string; subscription_status: string } | null
  } | null

  if (!card) {
    return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })
  }

  const plan = card.businesses?.plan
  const subscriptionStatus = card.businesses?.subscription_status
  if (!isPushEligible(plan, subscriptionStatus)) {
    return NextResponse.json({ error: 'Notificaciones no disponibles en este plan' }, { status: 403 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        customer_card_id: customerCardId,
        customer_id: cc.customer_id,
        business_id: card.business_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        active: true,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    return NextResponse.json({ error: 'Error guardando suscripción' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
