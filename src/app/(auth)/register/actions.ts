'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailSchema } from '@/lib/validations/common'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { loginRateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'
import { sendBusinessWelcome } from '@/lib/email/send-business-welcome'
import { createSubscriptionLink, type PlanSlug } from '@/lib/mercadopago'

const PAID_PLANS: PlanSlug[] = ['basic', 'pro', 'premium']

const registerSchema = z.object({
  businessName: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(128, 'Máximo 128 caracteres')
    .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe tener al menos un número'),
  plan: z.enum(['free', 'basic', 'pro', 'premium']).default('free'),
})

export type RegisterResult =
  | { error: string }
  | { checkoutUrl: string }
  | null

export async function registerAction(
  _prevState: RegisterResult,
  formData: FormData
): Promise<RegisterResult> {
  const headersList = await headers()
  const forwarded = headersList.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0].trim() || '127.0.0.1'

  const { success } = await loginRateLimit.limit(ip)
  if (!success) {
    return { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' }
  }

  const parsed = registerSchema.safeParse({
    businessName: formData.get('businessName'),
    email: formData.get('email'),
    password: formData.get('password'),
    plan: formData.get('plan') || 'free',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { businessName, email, password, plan } = parsed.data

  // 1. Crear usuario en Supabase Auth
  const supabase = await createClient()
  const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

  if (signUpError) {
    console.error('[register] signUpError:', signUpError.message, signUpError.status)
    return { error: 'Error al crear la cuenta. Intenta de nuevo.' }
  }
  if (!data.user) {
    return { error: 'Error al crear la cuenta. Intenta de nuevo.' }
  }

  // 2. Crear negocio — siempre inicia en free; el plan pago se activa tras el pago
  const admin = createAdminClient()
  const { data: newBiz, error: bizError } = await admin
    .from('businesses')
    .insert({ owner_id: data.user.id, name: businessName, email })
    .select('id')
    .single()

  if (bizError || !newBiz) {
    console.error('[register] bizError:', bizError?.message)
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: 'Error al crear el negocio. Intenta de nuevo.' }
  }

  // 3. Email de bienvenida (fire-and-forget)
  void sendBusinessWelcome({ to: email, businessName })

  // 4a. Plan gratis → dashboard inmediato
  if (!PAID_PLANS.includes(plan as PlanSlug)) {
    redirect('/dashboard')
  }

  // 4b. Plan pago → crear la suscripción automática en MercadoPago y devolver la URL de autorización
  try {
    const checkoutUrl = await createSubscriptionLink({
      businessId: newBiz.id,
      businessEmail: email,
      planSlug: plan as PlanSlug,
    })

    return { checkoutUrl }
  } catch (err) {
    console.error('[register] MP subscription error:', err)
    redirect('/dashboard')
  }
}
