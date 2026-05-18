import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getGoogleWalletSaveUrl } from '@/lib/wallet/google'

interface CustomerCardRow {
  id: string
  wallet_auth_token: string | null
  unique_code: string
  current_stamps: number
  loyalty_cards: {
    id: string
    name: string
    benefit_description: string
    stamps_required: number
    design_config: unknown
    business_id: string
    businesses: { name: string } | null
  } | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { customerCardId: string } }
) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

  if (!process.env.GOOGLE_WALLET_ISSUER_ID) {
    return NextResponse.json({ error: 'Google Wallet no configurado' }, { status: 503 })
  }

  const supabase = createServiceClient()

  const { data: ccRaw, error: ccError } = await supabase
    .from('customer_cards')
    .select(`
      id,
      wallet_auth_token,
      unique_code,
      current_stamps,
      loyalty_cards (
        id,
        name,
        benefit_description,
        stamps_required,
        design_config,
        business_id,
        businesses (name)
      )
    `)
    .eq('id', params.customerCardId)
    .single()

  if (ccError && ccError.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 })
  }

  const cc = ccRaw as CustomerCardRow | null

  if (!cc) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const storedToken = cc.wallet_auth_token ?? ''
  if (
    storedToken.length !== token.length ||
    !timingSafeEqual(Buffer.from(storedToken), Buffer.from(token))
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const card = cc.loyalty_cards as {
    id: string
    name: string
    benefit_description: string
    stamps_required: number
    design_config: unknown
    business_id: string
    businesses: { name: string } | null
  } | null

  if (!card) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.app'

  try {
    const saveUrl = await getGoogleWalletSaveUrl({
      issuerId: process.env.GOOGLE_WALLET_ISSUER_ID,
      loyaltyCardId: card.id,
      customerCardId: cc.id,
      businessName: card.businesses?.name ?? 'FideliTap',
      cardName: card.name,
      benefitDescription: card.benefit_description,
      stampsRequired: card.stamps_required,
      stampsCurrent: cc.current_stamps,
      uniqueCode: cc.unique_code,
      appUrl,
    })

    return NextResponse.redirect(saveUrl)
  } catch (err) {
    console.error('Google Wallet error:', err)
    return NextResponse.json({ error: 'Error generando el pass' }, { status: 500 })
  }
}
