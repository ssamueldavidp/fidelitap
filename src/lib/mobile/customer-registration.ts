import 'server-only'
import { z } from 'zod'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { emailSchema } from '@/lib/validations/common'

// Shared by /api/mobile/activate (register + join a specific card) and
// /api/mobile/customer/register (register with no card yet) — same
// customer profile shape either way.
export const customerProfileSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(80).trim(),
  email: emailSchema,
  phone: z.string().max(20).trim().optional(),
  data_consent: z.literal(true, { message: 'Debes aceptar el tratamiento de datos para continuar.' }),
  marketing_consent: z.boolean().default(false),
})

export type CustomerProfileInput = z.infer<typeof customerProfileSchema>

export async function findOrCreateCustomer(serviceClient: SupabaseClient<Database>, input: CustomerProfileInput) {
  const { name, email, phone, marketing_consent } = input

  const { data: existing } = await serviceClient
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!existing) {
    const { data: created, error } = await serviceClient
      .from('customers')
      .insert({ email, name, phone: phone ?? null, marketing_consent })
      .select('id')
      .single()
    if (error || !created) return null
    return created
  }

  if (phone || marketing_consent) {
    await serviceClient
      .from('customers')
      .update({ ...(phone ? { phone } : {}), ...(marketing_consent ? { marketing_consent: true } : {}) })
      .eq('id', existing.id)
  }
  return existing
}
