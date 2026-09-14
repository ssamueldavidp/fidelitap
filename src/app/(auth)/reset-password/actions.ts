'use server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(128, 'Máximo 128 caracteres')
  .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
  .regex(/[0-9]/, 'Debe tener al menos un número')

export async function resetPasswordAction(
  _prevState: { error: string } | { done: true } | null,
  formData: FormData
): Promise<{ error: string } | { done: true }> {
  const parsed = passwordSchema.safeParse(formData.get('password'))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'El enlace expiró o ya se usó. Solicita uno nuevo.' }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) {
    return { error: 'No se pudo actualizar la contraseña. Intenta de nuevo.' }
  }

  return { done: true }
}
