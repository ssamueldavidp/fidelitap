'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createCampaign, cancelCampaign } from '@/lib/push/campaigns'

export async function createCampaignAction(formData: FormData): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan, name, subscription_status')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  const result = await createCampaign(supabase, business, {
    title: formData.get('title'),
    body: formData.get('body'),
    loyaltyCardId: formData.get('loyaltyCardId') || '',
    scheduledAt: formData.get('scheduledAt') || '',
  })

  revalidatePath('/campaigns')
  return result
}

export async function cancelCampaignAction(campaignId: string): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  const result = await cancelCampaign(supabase, business.id, campaignId)
  revalidatePath('/campaigns')
  return result
}
