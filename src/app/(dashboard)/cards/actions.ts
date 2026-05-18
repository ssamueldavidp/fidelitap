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
  stamp_icon: z.string().min(1, 'Selecciona un ícono'),
  bg_type: z.enum(['solid', 'image']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
})

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
    stamp_icon: formData.get('stamp_icon'),
    bg_type: formData.get('bg_type'),
    color: formData.get('color'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, benefit_description, stamps_required, stamp_icon, bg_type, color } = parsed.data

  let bgImageUrl: string | null = null
  if (bg_type === 'image') {
    const file = formData.get('bg_image') as File | null
    if (file && file.size > 0) {
      const result = await uploadImage(supabase, business.id, file)
      if (typeof result !== 'string') return result
      bgImageUrl = result
    }
  }

  const design_config = {
    color,
    bg_type: bgImageUrl ? 'image' : 'solid',
    bg_value: color,
    bg_image_url: bgImageUrl,
    stamp_icon,
    font: 'default',
  }

  const { error } = await supabase.from('loyalty_cards').insert({
    business_id: business.id,
    name,
    benefit_description,
    stamps_required,
    design_config,
    slug: generateSlug(name),
    is_active: true,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Nombre duplicado. Elige otro nombre.' }
    return { error: 'Error creando tarjeta. Intenta de nuevo.' }
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
    stamp_icon: formData.get('stamp_icon'),
    bg_type: formData.get('bg_type'),
    color: formData.get('color'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, benefit_description, stamps_required, stamp_icon, bg_type, color } = parsed.data
  const existingConfig = card.design_config as Record<string, unknown>

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

  const design_config = {
    color,
    bg_type: bgImageUrl ? 'image' : 'solid',
    bg_value: color,
    bg_image_url: bgImageUrl,
    stamp_icon,
    font: 'default',
  }

  const { error } = await supabase
    .from('loyalty_cards')
    .update({ name, benefit_description, stamps_required, design_config })
    .eq('id', cardId)

  if (error) return { error: 'Error actualizando tarjeta.' }
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
