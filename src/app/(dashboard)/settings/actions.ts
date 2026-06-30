'use server'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const ALLOWED_COOLDOWNS = [0, 60, 300, 900, 3600, 86400]

export async function saveSettingsAction(
  cooldownSeconds: number
): Promise<{ error?: string }> {
  if (!ALLOWED_COOLDOWNS.includes(cooldownSeconds)) {
    return { error: 'Valor de cooldown no válido' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('businesses')
    .update({ stamp_cooldown_seconds: cooldownSeconds })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al guardar configuración' }
  return {}
}

const accountSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
  address: z.string().max(200).trim().optional(),
  latitude:  z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
})

export async function saveAccountAction(
  _prev: { error?: string; success?: boolean },
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const raw = {
    name:      formData.get('name'),
    address:   formData.get('address') || undefined,
    latitude:  formData.get('latitude')  ? formData.get('latitude')  : undefined,
    longitude: formData.get('longitude') ? formData.get('longitude') : undefined,
  }

  const parsed = accountSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, address, latitude, longitude } = parsed.data

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('businesses') as any)
    .update({ name, address: address ?? null, latitude: latitude ?? null, longitude: longitude ?? null })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al guardar' }
  revalidatePath('/settings')
  return { success: true }
}
