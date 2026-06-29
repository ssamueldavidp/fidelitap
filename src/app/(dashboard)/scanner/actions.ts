'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { addStampForBusiness, claimRewardForBusiness } from '@/lib/scanner/add-stamp'

export type { CardStatus, StampResult, ClaimResult } from '@/lib/scanner/add-stamp'

export async function addStampAction(uniqueCode: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  return addStampForBusiness(
    createServiceClient(),
    business.id,
    business.name,
    user.id,
    business.stamp_cooldown_seconds,
    uniqueCode
  )
}

export async function claimRewardAction(customerCardId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  return claimRewardForBusiness(createServiceClient(), business.id, user.id, customerCardId)
}
