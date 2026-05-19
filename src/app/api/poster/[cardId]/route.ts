import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generatePosterPng, generatePosterPdf, buildQrDataUrl } from '@/lib/poster/generate'

export async function GET(
  request: NextRequest,
  { params }: { params: { cardId: string } }
) {
  // Auth: must be a logged-in business owner
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const format = request.nextUrl.searchParams.get('format') ?? 'png'
  const orientation = request.nextUrl.searchParams.get('orientation') ?? 'vertical'

  if (!['png', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
  }
  if (!['vertical', 'horizontal'].includes(orientation)) {
    return NextResponse.json({ error: 'Orientación inválida' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Load card + business, verify ownership
  const { data: cardRaw } = await serviceClient
    .from('loyalty_cards')
    .select(`
      id,
      slug,
      stamps_required,
      poster_reward_text,
      businesses ( id, owner_id, name, poster_bg_color, poster_bg_image_url )
    `)
    .eq('id', params.cardId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!cardRaw) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const card = cardRaw as unknown as {
    id: string
    slug: string
    stamps_required: number
    poster_reward_text: string | null
    businesses: {
      id: string
      owner_id: string
      name: string
      poster_bg_color: string
      poster_bg_image_url: string | null
    } | null
  }

  if (!card.businesses || card.businesses.owner_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const biz = card.businesses
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const joinUrl = `${appUrl}/c/${card.slug}`

  try {
    const qrDataUrl = await buildQrDataUrl(joinUrl)

    const posterData = {
      businessName: biz.name,
      rewardText: card.poster_reward_text ?? '',
      stampsRequired: card.stamps_required,
      qrDataUrl,
      bgColor: biz.poster_bg_color,
      bgImageUrl: biz.poster_bg_image_url,
      orientation: orientation as 'vertical' | 'horizontal',
    }

    if (format === 'pdf') {
      const pdf = await generatePosterPdf(posterData)
      return new NextResponse(Uint8Array.from(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="cartel.pdf"',
          'Cache-Control': 'no-store',
        },
      })
    }

    const png = await generatePosterPng(posterData)
    return new NextResponse(Uint8Array.from(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="cartel.png"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[poster] generation error:', err)
    return NextResponse.json({ error: 'Error generando el cartel' }, { status: 500 })
  }
}
