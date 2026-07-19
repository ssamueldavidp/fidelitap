import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  req: NextRequest,
  { params }: { params: { customerCardId: string } }
) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: card, error } = await serviceClient
    .from('customer_cards')
    .select('id, wallet_auth_token, linked_auth_user_id')
    .eq('id', params.customerCardId)
    .eq('linked_auth_user_id', user.id)
    .single()

  if (error || !card)
    return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  // Generate wallet_auth_token if missing
  let token = card.wallet_auth_token
  if (!token) {
    token = crypto.randomUUID()
    await serviceClient
      .from('customer_cards')
      .update({ wallet_auth_token: token })
      .eq('id', card.id)
  }

  // Use the request's own host so wallet URLs always reach the same server
  // (avoids stale ngrok URLs stored in NEXT_PUBLIC_APP_URL)
  const base = `${req.nextUrl.protocol}//${req.nextUrl.host}`
  const appleUrl = `${base}/api/wallet/apple/${card.id}?token=${token}`
  const googleUrl = `${base}/api/wallet/google/${card.id}?token=${token}`

  return NextResponse.json({
    apple_url: appleUrl,
    google_url: googleUrl,
    has_google_wallet: !!process.env.GOOGLE_WALLET_ISSUER_ID,
  })
}
