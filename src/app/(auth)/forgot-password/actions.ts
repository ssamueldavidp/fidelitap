'use server'
import { createClient } from '@/lib/supabase/server'
import { passwordResetRateLimit } from '@/lib/rate-limit'
import { emailSchema } from '@/lib/validations/common'
import { headers } from 'next/headers'

export async function forgotPasswordAction(
  _prevState: { error: string } | { sent: true } | null,
  formData: FormData
): Promise<{ error: string } | { sent: true }> {
  const headersList = await headers()
  const forwarded = headersList.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0].trim() || '127.0.0.1'

  const { success } = await passwordResetRateLimit.limit(ip)
  if (!success) {
    return { error: 'Demasiados intentos. Espera 15 minutos e intenta de nuevo.' }
  }

  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const supabase = await createClient()
  // Never reveal whether the email exists — same response either way.
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  })

  return { sent: true }
}
