import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateApplePass } from '@/lib/wallet/apple'
import { validateAppleWebServiceAuth } from '@/lib/wallet/apple-webservice-auth'

type Params = {
  passTypeIdentifier: string
  serialNumber: string
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = await validateAppleWebServiceAuth(request, params.serialNumber)
  if (!auth.valid) return new NextResponse(null, { status: 401 })

  const supabase = createServiceClient()

  const { data: ccRaw } = await supabase
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
    .eq('wallet_pass_serial', params.serialNumber)
    .single()

  if (!ccRaw) return new NextResponse(null, { status: 404 })

  const cc = ccRaw as unknown as {
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

  const card = cc.loyalty_cards
  if (!card) return new NextResponse(null, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.app'

  if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID) {
    return new NextResponse(null, { status: 503 })
  }

  try {
    const passBuffer = await generateApplePass({
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
      teamIdentifier: process.env.APPLE_TEAM_ID,
      serialNumber: cc.wallet_pass_serial ?? cc.id,
      authenticationToken: cc.wallet_auth_token!,
      organizationName: card.businesses?.name ?? 'FideliTap',
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
        'Last-Modified': new Date().toUTCString(),
      },
    })
  } catch (err) {
    console.error('Pass regeneration error:', err)
    return new NextResponse(null, { status: 500 })
  }
}
