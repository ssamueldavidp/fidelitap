import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

const unsubscribeSchema = z.object({
  customerCardId: z.string().uuid(),
  walletAuthToken: z.string().uuid(),
  endpoint: z.string().url(),
})

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null)
  const parsed = unsubscribeSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { customerCardId, walletAuthToken, endpoint } = parsed.data
  const supabase = createServiceClient()

  const { data: cc } = await supabase
    .from('customer_cards')
    .select('id, wallet_auth_token')
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

  await supabase
    .from('push_subscriptions')
    .update({ active: false })
    .eq('customer_card_id', customerCardId)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
