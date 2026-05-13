'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailSchema } from '@/lib/validations/common'
import { z } from 'zod'
import { redirect } from 'next/navigation'

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
    if (signUpError.message.toLowerCase().includes('already registered')) {
      return { error: 'Este email ya está registrado. Intenta iniciar sesión.' }
    }
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
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: 'Error al crear el negocio. Intenta de nuevo.' }
  }

  // 4. Redirigir — si hay sesión activa, el middleware lleva al dashboard
  redirect('/dashboard')
}
