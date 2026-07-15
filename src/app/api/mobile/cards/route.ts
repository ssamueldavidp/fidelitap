import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

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
  const { name, stamps_required, benefit_description, stamp_icon = '⭐', color = '#00C896' } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (!stamps_required || stamps_required < 2 || stamps_required > 50)
    return NextResponse.json({ error: 'Sellos: entre 2 y 50' }, { status: 400 })
  if (!benefit_description?.trim())
    return NextResponse.json({ error: 'Premio requerido' }, { status: 400 })

  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const { count } = await serviceClient
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .is('deleted_at', null)

  const limits: Record<string, number | null> = { free: 1, basic: 3, pro: 10, premium: null }
  const maxCards = limits[business.plan] ?? null
  if (maxCards !== null && (count ?? 0) >= maxCards)
    return NextResponse.json(
      { error: `Tu plan ${business.plan} permite máximo ${maxCards} tarjeta(s)` },
      { status: 403 }
    )

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`

  const design_config = {
    color,
    bg_type: 'solid',
    bg_value: '#0f172a',
    bg_image_url: null,
    stamp_icon,
    font: 'default',
    style: 'clean',
    bg_mode: 'dark',
    logo_url: null,
  }

  const { data, error } = await serviceClient
    .from('loyalty_cards')
    .insert({
      business_id: business.id,
      name: name.trim(),
      stamps_required: Number(stamps_required),
      benefit_description: benefit_description.trim(),
      design_config,
      slug,
    })
    .select('id, name, stamps_required, benefit_description, is_active')
    .single()

  if (error) return NextResponse.json({ error: 'Error al crear tarjeta' }, { status: 500 })
  return NextResponse.json({ ...data, stamp_icon, color }, { status: 201 })
}
