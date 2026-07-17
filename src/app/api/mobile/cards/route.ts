import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { generateSlug } from '@/lib/slug'
import { getPlanLimits } from '@/lib/plan-limits'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const { data, error } = await serviceClient
    .from('loyalty_cards')
    .select(`
      id, name, stamps_required, benefit_description,
      design_config, is_active, slug, logo_url, expires_at, max_uses_per_customer,
      card_rewards (
        id, stamps_required, reward_label, color, sort_order
      )
    `)
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .order('sort_order', { referencedTable: 'card_rewards', ascending: true })

  if (error) return NextResponse.json({ error: 'Error al cargar tarjetas' }, { status: 500 })

  type RawReward = { id: string; stamps_required: number; reward_label: string; color: string; sort_order: number }
  type RawCard = NonNullable<typeof data>[number]

  const cards = (data ?? []).map((c: RawCard) => {
    const cfg = (c.design_config as Record<string, string | boolean | null> | null) ?? {}
    const rewards = (c.card_rewards as RawReward[] | null) ?? []
    return {
      id: c.id,
      name: c.name,
      stamps_required: c.stamps_required,
      benefit_description: c.benefit_description,
      is_active: c.is_active,
      slug: c.slug,
      logo_url: c.logo_url ?? null,
      expires_at: c.expires_at ?? null,
      max_uses_per_customer: c.max_uses_per_customer ?? null,
      stamp_icon: (cfg.stamp_icon as string) ?? '⭐',
      color: (cfg.color as string) ?? '#00C896',
      bg_type: (cfg.bg_type as string) ?? 'solid',
      bg_value: (cfg.bg_value as string) ?? '#0f172a',
      bg_image_url: (cfg.bg_image_url as string | null) ?? null,
      font: (cfg.font as string) ?? 'default',
      multi_rewards: (cfg.multi_rewards as boolean) ?? false,
      rewards,
    }
  })

  return NextResponse.json(cards)
}

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const {
    name,
    stamps_required,
    benefit_description,
    stamp_icon = '⭐',
    color = '#00C896',
    bg_type = 'solid',
    bg_value = '#0f172a',
    bg_image_url = null,
    font = 'default',
    logo_url = null,
    expires_at = null,
    max_uses_per_customer = null,
    multi_rewards = false,
    rewards = [],
  } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  const stampsNum = Number(stamps_required)
  if (!stampsNum || stampsNum < 2 || stampsNum > 20)
    return NextResponse.json({ error: 'Sellos: entre 2 y 20' }, { status: 400 })
  if (!benefit_description?.trim())
    return NextResponse.json({ error: 'Premio requerido' }, { status: 400 })
  if (typeof color === 'string' && !/^#[0-9A-Fa-f]{6}$/.test(color))
    return NextResponse.json({ error: 'Color inválido' }, { status: 400 })

  if (multi_rewards && Array.isArray(rewards)) {
    if (rewards.length > 20)
      return NextResponse.json({ error: 'Máximo 20 niveles de premio' }, { status: 400 })
    for (const r of rewards) {
      if (!Number.isInteger(Number(r.stamps_required)) || Number(r.stamps_required) < 1)
        return NextResponse.json({ error: 'stamps_required en reward debe ser ≥ 1' }, { status: 400 })
      if (!String(r.reward_label ?? '').trim())
        return NextResponse.json({ error: 'reward_label requerido en cada nivel' }, { status: 400 })
    }
  }

  const serviceClient = createServiceClient()
  const { data: business, error: bizError } = await serviceClient
    .from('businesses')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single()
  if (bizError || !business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const { count } = await serviceClient
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .is('deleted_at', null)

  const { maxCards } = getPlanLimits(business.plan)
  if (maxCards !== null && (count ?? 0) >= maxCards)
    return NextResponse.json(
      { error: `Tu plan ${business.plan} permite máximo ${maxCards} tarjeta(s)` },
      { status: 403 }
    )

  const slug = generateSlug(name.trim())

  const design_config = {
    color,
    bg_type,
    bg_value,
    bg_image_url,
    stamp_icon,
    font,
    multi_rewards,
  }

  const { data, error } = await serviceClient
    .from('loyalty_cards')
    .insert({
      business_id: business.id,
      name: name.trim(),
      stamps_required: stampsNum,
      benefit_description: benefit_description.trim(),
      design_config,
      slug,
      logo_url: logo_url ?? null,
      expires_at: expires_at ?? null,
      max_uses_per_customer: max_uses_per_customer ? Number(max_uses_per_customer) : null,
    })
    .select('id, name, stamps_required, benefit_description, is_active, slug, logo_url, expires_at, max_uses_per_customer')
    .single()

  if (error) {
    console.error('[POST /api/mobile/cards]', error)
    return NextResponse.json({ error: 'Error al crear tarjeta' }, { status: 500 })
  }

  let persistedRewards: { id: string; stamps_required: number; reward_label: string; color: string; sort_order: number }[] = []
  if (multi_rewards && Array.isArray(rewards) && rewards.length > 0) {
    const rewardRows = rewards.map((r: { stamps_required: number; reward_label: string; color?: string }, i: number) => ({
      loyalty_card_id: data.id,
      stamps_required: Number(r.stamps_required),
      reward_label: String(r.reward_label).trim(),
      color: r.color ?? '#00C896',
      sort_order: i,
    }))
    const { data: insertedRewards, error: rewardError } = await serviceClient
      .from('card_rewards')
      .insert(rewardRows)
      .select('id, stamps_required, reward_label, color, sort_order')
    if (rewardError) {
      console.error('[POST /api/mobile/cards] reward insert', rewardError)
      return NextResponse.json({ error: 'Tarjeta creada pero los premios no se guardaron' }, { status: 500 })
    }
    persistedRewards = insertedRewards ?? []
  }

  return NextResponse.json({
    ...data,
    stamp_icon,
    color,
    bg_type,
    bg_value,
    bg_image_url: bg_image_url ?? null,
    font,
    multi_rewards,
    rewards: persistedRewards,
  }, { status: 201 })
}
