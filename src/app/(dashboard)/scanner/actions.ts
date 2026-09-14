'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  addStampForBusiness,
  claimRewardForBusiness,
  type StampResult,
  type ClaimResult,
} from '@/lib/scanner/add-stamp'

export type { CardStatus, StampResult, ClaimResult } from '@/lib/scanner/add-stamp'

export async function addStampAction(uniqueCode: string): Promise<StampResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stamp_cooldown_seconds, plan, subscription_status')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  return addStampForBusiness({
    serviceClient: createServiceClient(),
    businessId: business.id,
    businessName: business.name,
    businessPlan: business.plan,
    businessSubscriptionStatus: business.subscription_status,
    stampCooldownSeconds: business.stamp_cooldown_seconds,
    ownerId: user.id,
    uniqueCode,
  })
}

export async function claimRewardAction(customerCardId: string): Promise<ClaimResult> {
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
