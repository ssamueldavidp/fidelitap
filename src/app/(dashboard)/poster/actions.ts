'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type SavePosterResult = { error?: string }

export async function savePosterSettingsAction(
  formData: FormData
): Promise<SavePosterResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const cardId = formData.get('cardId') as string
  const rewardText = (formData.get('rewardText') as string | null) ?? ''
  if (rewardText.length > 120) return { error: 'El texto de recompensa no puede superar 120 caracteres' }
  const bgType = formData.get('bgType') as 'color' | 'photo'
  if (bgType !== 'color' && bgType !== 'photo') return { error: 'Tipo de fondo inválido' }
  const bgColor = (formData.get('bgColor') as string | null) ?? '#0B0B0B'
  const bgImage = formData.get('bgImage') as File | null

  if (!cardId) return { error: 'Tarjeta requerida' }

  const serviceClient = createServiceClient()

  // Verify ownership
  const { data: card } = await serviceClient
    .from('loyalty_cards')
    .select('id, businesses ( id, owner_id )')
    .eq('id', cardId)
    .is('deleted_at', null)
    .maybeSingle()

  const cardTyped = card as unknown as {
    id: string
    businesses: { id: string; owner_id: string } | null
  } | null

  if (!cardTyped?.businesses || cardTyped.businesses.owner_id !== user.id) {
    return { error: 'No autorizado' }
  }

  const businessId = cardTyped.businesses.id

  // Save reward text on loyalty_cards
  const { error: cardErr } = await serviceClient
    .from('loyalty_cards')
    .update({ poster_reward_text: rewardText.trim() || null })
    .eq('id', cardId)

  if (cardErr) return { error: 'Error al guardar texto de recompensa' }

  // Save background
  if (bgType === 'photo' && bgImage && bgImage.size > 0) {
    if (bgImage.size > 5 * 1024 * 1024) return { error: 'La imagen no debe superar 5MB' }

    const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg']
    if (!ALLOWED_IMAGE_TYPES.includes(bgImage.type)) return { error: 'Solo se permiten PNG o JPEG' }

    const arrayBuffer = await bgImage.arrayBuffer()
    const ext = bgImage.type === 'image/png' ? 'png' : 'jpg'
    const filePath = `${businessId}/bg.${ext}`

    const { error: uploadErr } = await serviceClient.storage
      .from('poster-backgrounds')
      .upload(filePath, arrayBuffer, { contentType: bgImage.type, upsert: true })

    if (uploadErr) return { error: 'Error al subir la imagen' }

    const { data: { publicUrl } } = serviceClient.storage
      .from('poster-backgrounds')
      .getPublicUrl(filePath)

    const { error: bizErr } = await serviceClient
      .from('businesses')
      .update({ poster_bg_color: '#0B0B0B', poster_bg_image_url: publicUrl })
      .eq('id', businessId)

    if (bizErr) return { error: 'Error al guardar fondo' }
  } else if (bgType === 'color') {
    // Color mode — validate hex and clear image
    if (!/^#[0-9A-Fa-f]{6}$/.test(bgColor)) return { error: 'Color inválido' }

    const { error: bizErr } = await serviceClient
      .from('businesses')
      .update({ poster_bg_color: bgColor, poster_bg_image_url: null })
      .eq('id', businessId)

    if (bizErr) return { error: 'Error al guardar color' }

    // Clean up orphaned storage files (attempt both extensions, ignore errors)
    await Promise.allSettled([
      serviceClient.storage.from('poster-backgrounds').remove([`${businessId}/bg.png`]),
      serviceClient.storage.from('poster-backgrounds').remove([`${businessId}/bg.jpg`]),
    ])
  }
  // if bgType === 'photo' but no new file: keep existing photo as-is

  revalidatePath('/poster')
  return {}
}
