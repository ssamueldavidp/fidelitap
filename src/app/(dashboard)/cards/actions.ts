'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlanLimits, isAtLimit } from '@/lib/plan-limits'
import { generateSlug } from '@/lib/slug'
import { z } from 'zod'

const cardFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres').trim(),
  benefit_description: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres').trim(),
  stamps_required: z.coerce.number().int().min(2, 'Mínimo 2 sellos').max(20, 'Máximo 20 sellos'),
  push_notify_threshold: z.coerce.number().int().min(1).max(5).default(1),
  stamp_icon: z.string().min(1, 'Selecciona un ícono'),
  bg_type: z.enum(['solid', 'image']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
  style: z.enum(['clean', 'modern', 'luxury', 'editorial', 'minimal']).default('clean'),
  bg_mode: z.enum(['light', 'dark']).default('light'),
  multi_rewards: z.coerce.boolean().default(false),
  expires_at: z.string().optional(),
})

const rewardSchema = z.object({
  stamps_required: z.coerce.number().int().min(1, 'stamps_required debe ser ≥ 1'),
  reward_label: z.string().trim().min(1, 'Todos los niveles necesitan descripción').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#00C896'),
})

function parseRewards(raw: FormDataEntryValue | null): { rewards: { stamps_required: number; reward_label: string; color: string }[] } | { error: string } {
  if (!raw || typeof raw !== 'string') return { rewards: [] }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { error: 'Niveles de premio inválidos' }
  }
  const parsed = z.array(rewardSchema).max(20, 'Máximo 20 niveles de premio').safeParse(json)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  return { rewards: parsed.data }
}

async function uploadImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  file: File
): Promise<string | { error: string }> {
  if (file.size > 2 * 1024 * 1024) return { error: 'La imagen no puede superar 2MB' }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()
  const { error } = await supabase.storage
    .from('card-backgrounds')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (error) return { error: 'Error subiendo imagen. Intenta de nuevo.' }
  const { data: { publicUrl } } = supabase.storage
    .from('card-backgrounds')
    .getPublicUrl(path)
  return publicUrl
}

async function uploadLogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  file: File
): Promise<string | { error: string }> {
  if (file.size > 2 * 1024 * 1024) return { error: 'El logo no puede superar 2MB' }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()
  const { error } = await supabase.storage
    .from('card-logos')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (error) return { error: 'Error subiendo logo. Intenta de nuevo.' }
  const { data: { publicUrl } } = supabase.storage
    .from('card-logos')
    .getPublicUrl(path)
  return publicUrl
}

export async function createCardAction(
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  const { count: cardCount } = await supabase
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .is('deleted_at', null)

  const limits = getPlanLimits(business.plan)
  if (isAtLimit(cardCount ?? 0, limits.maxCards)) {
    return { error: 'Límite de tarjetas alcanzado. Actualiza tu plan para agregar más.' }
  }

  const parsed = cardFormSchema.safeParse({
    name: formData.get('name'),
    benefit_description: formData.get('benefit_description'),
    stamps_required: formData.get('stamps_required'),
    push_notify_threshold: formData.get('push_notify_threshold'),
    stamp_icon: formData.get('stamp_icon'),
    bg_type: formData.get('bg_type'),
    color: formData.get('color'),
    style: formData.get('style'),
    bg_mode: formData.get('bg_mode'),
    multi_rewards: formData.get('multi_rewards'),
    expires_at: formData.get('expires_at'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, benefit_description, stamps_required, push_notify_threshold, stamp_icon, bg_type, color, style, bg_mode, multi_rewards, expires_at } = parsed.data

  const rewardsResult = multi_rewards ? parseRewards(formData.get('rewards_json')) : { rewards: [] }
  if ('error' in rewardsResult) return rewardsResult

  let bgImageUrl: string | null = null
  if (bg_type === 'image') {
    const file = formData.get('bg_image') as File | null
    if (file && file.size > 0) {
      const result = await uploadImage(supabase, business.id, file)
      if (typeof result !== 'string') return result
      bgImageUrl = result
    }
  }

  let logoUrl: string | null = null
  const logoFile = formData.get('logo') as File | null
  if (logoFile && logoFile.size > 0) {
    const result = await uploadLogo(supabase, business.id, logoFile)
    if (typeof result !== 'string') return result
    logoUrl = result
  }

  const design_config = {
    color,
    bg_type: bgImageUrl ? 'image' : 'solid',
    bg_value: color,
    bg_image_url: bgImageUrl,
    stamp_icon,
    font: 'default',
    style,
    bg_mode,
    logo_url: logoUrl,
    multi_rewards,
  }

  const { data: newCard, error } = await supabase.from('loyalty_cards').insert({
    business_id: business.id,
    name,
    benefit_description,
    stamps_required,
    push_notify_threshold,
    design_config,
    slug: generateSlug(name),
    is_active: true,
    expires_at: expires_at || null,
  }).select('id').single()

  if (error || !newCard) {
    if (error?.code === '23505') return { error: 'Nombre duplicado. Elige otro nombre.' }
    return { error: 'Error creando tarjeta. Intenta de nuevo.' }
  }

  if (multi_rewards && rewardsResult.rewards.length > 0) {
    const { error: rewardError } = await supabase.from('card_rewards').insert(
      rewardsResult.rewards.map((r, i) => ({
        loyalty_card_id: newCard.id,
        stamps_required: r.stamps_required,
        reward_label: r.reward_label,
        color: r.color,
        sort_order: i,
      }))
    )
    if (rewardError) return { error: 'Tarjeta creada pero los premios no se guardaron.' }
  }

  revalidatePath('/cards')
  redirect('/cards')
}

export async function updateCardAction(
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const cardId = formData.get('id') as string
  if (!cardId) return { error: 'ID inválido' }

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('id, business_id, design_config')
    .eq('id', cardId)
    .single()
  if (!card) return { error: 'Tarjeta no encontrada' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .eq('id', card.business_id)
    .single()
  if (!business) return { error: 'No autorizado' }

  const parsed = cardFormSchema.safeParse({
    name: formData.get('name'),
    benefit_description: formData.get('benefit_description'),
    stamps_required: formData.get('stamps_required'),
    push_notify_threshold: formData.get('push_notify_threshold'),
    stamp_icon: formData.get('stamp_icon'),
    bg_type: formData.get('bg_type'),
    color: formData.get('color'),
    style: formData.get('style'),
    bg_mode: formData.get('bg_mode'),
    multi_rewards: formData.get('multi_rewards'),
    expires_at: formData.get('expires_at'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, benefit_description, stamps_required, push_notify_threshold, stamp_icon, bg_type, color, style, bg_mode, multi_rewards, expires_at } = parsed.data
  const existingConfig = card.design_config as Record<string, unknown>

  const rewardsResult = multi_rewards ? parseRewards(formData.get('rewards_json')) : { rewards: [] }
  if ('error' in rewardsResult) return rewardsResult

  let bgImageUrl = bg_type === 'image'
    ? (existingConfig.bg_image_url as string | null) ?? null
    : null
  if (bg_type === 'image') {
    const file = formData.get('bg_image') as File | null
    if (file && file.size > 0) {
      const result = await uploadImage(supabase, business.id, file)
      if (typeof result !== 'string') return result
      bgImageUrl = result
    }
  }

  let logoUrl = (existingConfig.logo_url as string | null) ?? null
  const logoFile = formData.get('logo') as File | null
  if (logoFile && logoFile.size > 0) {
    const result = await uploadLogo(supabase, business.id, logoFile)
    if (typeof result !== 'string') return result
    logoUrl = result
  }
  if (formData.get('remove_logo') === 'true') logoUrl = null

  const design_config = {
    color,
    bg_type: bgImageUrl ? 'image' : 'solid',
    bg_value: color,
    bg_image_url: bgImageUrl,
    stamp_icon,
    font: 'default',
    style,
    bg_mode,
    logo_url: logoUrl,
    multi_rewards,
  }

  const { error } = await supabase
    .from('loyalty_cards')
    .update({ name, benefit_description, stamps_required, push_notify_threshold, design_config, expires_at: expires_at || null })
    .eq('id', cardId)

  if (error) return { error: 'Error actualizando tarjeta.' }

  // Replace the reward tiers wholesale — simplest correct approach for an edit.
  const { error: deleteRewardsError } = await supabase.from('card_rewards').delete().eq('loyalty_card_id', cardId)
  if (deleteRewardsError) return { error: 'Error actualizando los niveles de premio.' }
  if (multi_rewards && rewardsResult.rewards.length > 0) {
    const { error: rewardError } = await supabase.from('card_rewards').insert(
      rewardsResult.rewards.map((r, i) => ({
        loyalty_card_id: cardId,
        stamps_required: r.stamps_required,
        reward_label: r.reward_label,
        color: r.color,
        sort_order: i,
      }))
    )
    if (rewardError) return { error: 'Tarjeta actualizada pero los premios no se guardaron.' }
  }

  revalidatePath('/cards')
  redirect('/cards')
}

export async function toggleCardAction(
  cardId: string,
  isActive: boolean
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('id, business_id')
    .eq('id', cardId)
    .single()
  if (!card) return { error: 'Tarjeta no encontrada' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .eq('id', card.business_id)
    .single()
  if (!business) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('loyalty_cards')
    .update({ is_active: isActive })
    .eq('id', cardId)

  if (error) return { error: 'Error actualizando estado.' }
  revalidatePath('/cards')
  return null
}

export async function deleteCardAction(
  cardId: string
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('id, business_id')
    .eq('id', cardId)
    .single()
  if (!card) return { error: 'Tarjeta no encontrada' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .eq('id', card.business_id)
    .single()
  if (!business) return { error: 'No autorizado' }

  const { count: customerCount } = await supabase
    .from('customer_cards')
    .select('id', { count: 'exact', head: true })
    .eq('loyalty_card_id', cardId)

  let dbError
  if ((customerCount ?? 0) > 0) {
    const result = await supabase
      .from('loyalty_cards')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', cardId)
    dbError = result.error
  } else {
    const result = await supabase
      .from('loyalty_cards')
      .delete()
      .eq('id', cardId)
    dbError = result.error
  }

  if (dbError) return { error: 'Error eliminando tarjeta.' }
  revalidatePath('/cards')
  return null
}
