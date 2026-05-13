'use server'
import { createClient } from '@/lib/supabase/server'
import { loginRateLimit } from '@/lib/rate-limit'
import { emailSchema } from '@/lib/validations/common'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export async function loginAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  // 1. Rate limiting por IP
  const headersList = await headers()
  const forwarded = headersList.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0].trim() || '127.0.0.1'

  const { success } = await loginRateLimit.limit(ip)
  if (!success) {
    return { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' }
  }

  // 2. Validar inputs con Zod
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // 3. Autenticar con Supabase (nunca revelar si el email existe)
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { error: 'Email o contraseña incorrectos.' }
  }

  // 4. Redirect — sesión en httpOnly cookie, nunca en cliente
  // Redirect — validate to prevent open redirect
  const rawRedirect = (formData.get('redirectTo') as string | null) ?? '/dashboard'
  const safePath = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/dashboard'
  redirect(safePath)
}
