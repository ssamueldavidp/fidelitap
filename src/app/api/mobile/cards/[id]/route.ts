import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database, Json } from '@/lib/supabase/database.types'

type LoyaltyCardUpdate = Database['public']['Tables']['loyalty_cards']['Update']

async function getOwnedCard(userId: string, cardId: string) {
  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .single()
  if (!business) return null

  const { data: card } = await serviceClient
    .from('loyalty_cards')
    .select('id, business_id, name, stamps_required, benefit_description, design_config, is_active')
    .eq('id', cardId)
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .single()

  return card ? { card, serviceClient } : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const owned = await getOwnedCard(user.id, params.id)
  if (!owned) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const body = await req.json()
  const {
    name,
    stamps_required,
    benefit_description,
    stamp_icon,
    color,
    bg_type,
    bg_value,
    bg_image_url,
    font,
    logo_url,
    expires_at,
    max_uses_per_customer,
    multi_rewards,
    rewards,
  } = body

  // Validate rewards if provided
  if (Array.isArray(rewards)) {
    if (rewards.length > 20)
      return NextResponse.json({ error: 'Máximo 20 niveles de premio' }, { status: 400 })
    for (const r of rewards) {
      if (!Number.isInteger(Number(r.stamps_required)) || Number(r.stamps_required) < 1)
        return NextResponse.json({ error: 'stamps_required en reward debe ser ≥ 1' }, { status: 400 })
      if (!String(r.reward_label ?? '').trim())
        return NextResponse.json({ error: 'reward_label requerido en cada nivel' }, { status: 400 })
    }
  }

  const existingConfig = (owned.card.design_config as Record<string, Json | undefined>) ?? {}
  const update: LoyaltyCardUpdate = {}

  if (name?.trim()) update.name = name.trim()
  if (stamps_required && Number(stamps_required) >= 2 && Number(stamps_required) <= 20)
    update.stamps_required = Number(stamps_required)
  if (benefit_description?.trim()) update.benefit_description = benefit_description.trim()
  if (logo_url !== undefined) update.logo_url = logo_url
  if (expires_at !== undefined) update.expires_at = expires_at
  if (max_uses_per_customer !== undefined)
    update.max_uses_per_customer = max_uses_per_customer ? Number(max_uses_per_customer) : null

  // Merge design_config — only override keys that were explicitly provided
  const designUpdate: Record<string, Json | undefined> = { ...existingConfig }
  if (stamp_icon !== undefined) designUpdate.stamp_icon = stamp_icon as Json
  if (color !== undefined) designUpdate.color = color as Json
  if (bg_type !== undefined) designUpdate.bg_type = bg_type as Json
  if (bg_value !== undefined) designUpdate.bg_value = bg_value as Json
  if (bg_image_url !== undefined) designUpdate.bg_image_url = bg_image_url as Json
  if (font !== undefined) designUpdate.font = font as Json
  if (multi_rewards !== undefined) designUpdate.multi_rewards = multi_rewards as Json
  update.design_config = designUpdate as Json

  const { data, error } = await owned.serviceClient
    .from('loyalty_cards')
    .update(update)
    .eq('id', params.id)
    .select('id, name, stamps_required, benefit_description, is_active, slug, design_config, logo_url, expires_at, max_uses_per_customer')
    .single()

  if (error) {
    console.error('[PATCH /api/mobile/cards/[id]]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }

  // Upsert rewards: delete-then-insert with best-effort rollback
  let persistedRewards: { id: string; stamps_required: number; reward_label: string; color: string; sort_order: number }[] = []
  if (Array.isArray(rewards)) {
    // Save existing rewards before deleting (for rollback)
    const { data: existingRewards } = await owned.serviceClient
      .from('card_rewards')
      .select('stamps_required, reward_label, color, sort_order')
      .eq('loyalty_card_id', params.id)
      .order('sort_order', { ascending: true })

    const { error: delError } = await owned.serviceClient
      .from('card_rewards')
      .delete()
      .eq('loyalty_card_id', params.id)
    if (delError) {
      console.error('[PATCH /api/mobile/cards/[id]] reward delete', delError)
      return NextResponse.json({ error: 'Error al actualizar premios' }, { status: 500 })
    }

    if (rewards.length > 0) {
      const rows = rewards.map((r: { stamps_required: number; reward_label: string; color?: string }, i: number) => ({
        loyalty_card_id: params.id,
        stamps_required: Number(r.stamps_required),
        reward_label: String(r.reward_label).trim(),
        color: r.color ?? '#00C896',
        sort_order: i,
      }))
      const { data: inserted, error: insError } = await owned.serviceClient
        .from('card_rewards')
        .insert(rows)
        .select('id, stamps_required, reward_label, color, sort_order')
      if (insError) {
        console.error('[PATCH /api/mobile/cards/[id]] reward insert', insError)
        // Best-effort rollback: restore previous rewards
        if (existingRewards && existingRewards.length > 0) {
          await owned.serviceClient.from('card_rewards').insert(
            existingRewards.map((r) => ({ ...r, loyalty_card_id: params.id }))
          )
        }
        return NextResponse.json({ error: 'Error al guardar premios' }, { status: 500 })
      }
      persistedRewards = inserted ?? []
    }
  }

  const cfg = data.design_config as Record<string, unknown> | null
  return NextResponse.json({
    ...data,
    stamp_icon: (cfg?.stamp_icon as string) ?? '⭐',
    color: (cfg?.color as string) ?? '#00C896',
    bg_type: (cfg?.bg_type as string) ?? 'solid',
    bg_value: (cfg?.bg_value as string) ?? '#0f172a',
    bg_image_url: (cfg?.bg_image_url as string | null) ?? null,
    font: (cfg?.font as string) ?? 'default',
    multi_rewards: (cfg?.multi_rewards as boolean) ?? false,
    ...(Array.isArray(rewards) ? { rewards: persistedRewards } : {}),
  })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const owned = await getOwnedCard(user.id, params.id)
  if (!owned) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const { error } = await owned.serviceClient
    .from('loyalty_cards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
