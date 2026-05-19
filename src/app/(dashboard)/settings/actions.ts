'use server'

import { createClient } from '@/lib/supabase/server'

const ALLOWED_COOLDOWNS = [0, 60, 300, 900, 3600, 86400]

export async function saveSettingsAction(
  cooldownSeconds: number
): Promise<{ error?: string }> {
  if (!ALLOWED_COOLDOWNS.includes(cooldownSeconds)) {
    return { error: 'Valor de cooldown no válido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('businesses')
    .update({ stamp_cooldown_seconds: cooldownSeconds })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al guardar configuración' }
  return {}
}
