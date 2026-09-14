import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id, poster_bg_color, poster_bg_image_url')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const { data: cards } = await serviceClient
    .from('loyalty_cards')
    .select('id, name, slug, stamps_required, poster_reward_text')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    cards: (cards ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      stamps_required: c.stamps_required,
      poster_reward_text: c.poster_reward_text ?? '',
    })),
    bg_color: business.poster_bg_color ?? '#0B0B0B',
    bg_image_url: business.poster_bg_image_url ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const cardId = body.cardId as string | undefined
  const rewardText = (body.rewardText as string | null) ?? ''
  const bgType = body.bgType as 'color' | 'photo' | undefined
  const bgColor = (body.bgColor as string | null) ?? '#0B0B0B'
  const bgImageUrl = body.bgImageUrl as string | null | undefined

  if (rewardText.length > 120)
    return NextResponse.json({ error: 'El texto de recompensa no puede superar 120 caracteres' }, { status: 400 })

  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  if (cardId) {
    const { data: card } = await serviceClient
      .from('loyalty_cards')
      .select('id, business_id')
      .eq('id', cardId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!card || card.business_id !== business.id)
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { error: cardErr } = await serviceClient
      .from('loyalty_cards')
      .update({ poster_reward_text: rewardText.trim() || null })
      .eq('id', cardId)
    if (cardErr) return NextResponse.json({ error: 'Error al guardar texto de recompensa' }, { status: 500 })
  }

  if (bgType === 'photo' && bgImageUrl) {
    const { error: bizErr } = await serviceClient
      .from('businesses')
      .update({ poster_bg_color: '#0B0B0B', poster_bg_image_url: bgImageUrl })
      .eq('id', business.id)
    if (bizErr) return NextResponse.json({ error: 'Error al guardar fondo' }, { status: 500 })
  } else if (bgType === 'color') {
    if (!/^#[0-9A-Fa-f]{6}$/.test(bgColor))
      return NextResponse.json({ error: 'Color inválido' }, { status: 400 })

    const { error: bizErr } = await serviceClient
      .from('businesses')
      .update({ poster_bg_color: bgColor, poster_bg_image_url: null })
      .eq('id', business.id)
    if (bizErr) return NextResponse.json({ error: 'Error al guardar color' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
