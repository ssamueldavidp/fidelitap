'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailSchema } from '@/lib/validations/common'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { loginRateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'

const registerSchema = z.object({
  businessName: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(128, 'Máximo 128 caracteres')
    .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe tener al menos un número'),
})

export async function registerAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  // Rate limiting por IP
  const headersList = await headers()
  const forwarded = headersList.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0].trim() || '127.0.0.1'

  const { success } = await loginRateLimit.limit(ip)
  if (!success) {
    return { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' }
  }

  // 1. Validar con Zod antes de tocar Supabase
  const parsed = registerSchema.safeParse({
    businessName: formData.get('businessName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // 2. Crear usuario en Supabase Auth
  const supabase = await createClient()
  const { data, error: signUpError } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (signUpError) {
    return { error: 'Error al crear la cuenta. Intenta de nuevo.' }
  }

  if (!data.user) {
    return { error: 'Error al crear la cuenta. Intenta de nuevo.' }
  }

  // 3. Crear registro del negocio con admin client (server-only)
  // Se usa admin porque en entornos con email confirmation,
  // el usuario aún no tiene sesión activa en este punto.
  const admin = createAdminClient()
  const { error: bizError } = await admin.from('businesses').insert({
    owner_id: data.user.id,
    name: parsed.data.businessName,
    email: parsed.data.email,
  })

  if (bizError) {
    // Limpiar el usuario auth si falla la creación del negocio
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id)
    if (deleteError) {
      console.error('[register] Failed to delete orphaned auth user', data.user.id, deleteError.message)
    }
    return { error: 'Error al crear el negocio. Intenta de nuevo.' }
  }

  // 4. Redirigir — si hay sesión activa, el middleware lleva al dashboard
  redirect('/dashboard')
}
