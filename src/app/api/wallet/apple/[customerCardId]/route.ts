import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateApplePass } from '@/lib/wallet/apple'

interface CustomerCardRow {
  id: string
  wallet_auth_token: string | null
  wallet_pass_serial: string | null
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

  const supabase = createServiceClient()

  const { data: ccRaw, error: ccError } = await supabase
    .from('customer_cards')
    .select(`
      id,
      wallet_auth_token,
      wallet_pass_serial,
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
    // PGRST116 = row not found, treat as 401
    return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 })
  }

  const cc = ccRaw as CustomerCardRow | null

  if (!cc || cc.wallet_auth_token !== token) {
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

  const businessName = card.businesses?.name ?? 'FideliTap'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.app'

  if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID) {
    return NextResponse.json({ error: 'Configuración de Apple Wallet incompleta' }, { status: 503 })
  }

  try {
    const passBuffer = await generateApplePass({
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
      teamIdentifier: process.env.APPLE_TEAM_ID,
      serialNumber: cc.wallet_pass_serial ?? cc.id,
      authenticationToken: cc.wallet_auth_token!,
      organizationName: businessName,
      description: card.name,
      stampsCurrent: cc.current_stamps,
      stampsRequired: card.stamps_required,
      benefitDescription: card.benefit_description,
      uniqueCode: cc.unique_code,
      appUrl,
    })

    return new NextResponse(Uint8Array.from(passBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'attachment; filename="fidelitap.pkpass"',
        'Content-Length': String(passBuffer.length),
      },
    })
  } catch (err) {
    console.error('Apple pass generation error:', err)
    return NextResponse.json({ error: 'Error generando el pass' }, { status: 500 })
  }
}
