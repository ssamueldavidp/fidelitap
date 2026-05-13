'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { redirect } from 'next/navigation'

const onboardingSchema = z.object({
  businessName: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
})

export async function onboardingAction(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const parsed = onboardingSchema.safeParse({
    businessName: formData.get('businessName'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificar que no tiene negocio ya (idempotencia)
  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (existing) redirect('/dashboard')

  const admin = createAdminClient()
  const { error } = await admin.from('businesses').insert({
    owner_id: user.id,
    name: parsed.data.businessName,
    email: user.email!,
  })

  if (error) {
    return { error: 'Error al guardar el negocio. Intenta de nuevo.' }
  }

  redirect('/dashboard')
}
