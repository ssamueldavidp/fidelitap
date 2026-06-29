'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendCampaignPush } from '@/lib/push/send'
import { isPushEligible } from '@/lib/push/eligibility'

const campaignSchema = z.object({
  title: z.string().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres').trim(),
  body: z.string().min(2, 'Mínimo 2 caracteres').max(150, 'Máximo 150 caracteres').trim(),
  loyaltyCardId: z.string().uuid().optional().or(z.literal('')),
  scheduledAt: z.string().optional().or(z.literal('')),
})

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
  if (!isPushEligible(business.plan, business.subscription_status)) {
    return { error: 'Las campañas push requieren plan Pro o Premium' }
  }

  const parsed = campaignSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    loyaltyCardId: formData.get('loyaltyCardId') || '',
    scheduledAt: formData.get('scheduledAt') || '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { title, body, loyaltyCardId, scheduledAt } = parsed.data
  const loyalty_card_id = loyaltyCardId || null
  const scheduled_at = scheduledAt ? new Date(scheduledAt).toISOString() : null

  if (scheduled_at && new Date(scheduled_at) <= new Date()) {
    return { error: 'La fecha programada debe ser en el futuro' }
  }

  const { data: campaign, error } = await supabase
    .from('push_campaigns')
    .insert({
      business_id: business.id,
      loyalty_card_id,
      title,
      body,
      scheduled_at,
      status: scheduled_at ? 'scheduled' : 'draft',
    })
    .select('id')
    .single()

  if (error || !campaign) return { error: 'Error creando la campaña' }

  if (!scheduled_at) {
    await dispatchCampaignNow(campaign.id, business.id, loyalty_card_id, title, body)
  }

  revalidatePath('/campaigns')
  return null
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

  const { error } = await supabase
    .from('push_campaigns')
    .update({ status: 'failed' })
    .eq('id', campaignId)
    .eq('business_id', business.id)
    .eq('status', 'scheduled')

  if (error) return { error: 'Error cancelando la campaña' }
  revalidatePath('/campaigns')
  return null
}

async function dispatchCampaignNow(
  campaignId: string,
  businessId: string,
  loyaltyCardId: string | null,
  title: string,
  body: string
) {
  const serviceClient = createServiceClient()
  try {
    const sentCount = await sendCampaignPush(serviceClient, {
      businessId,
      loyaltyCardId,
      title,
      body,
    })

    await serviceClient
      .from('push_campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString(), recipients_count: sentCount })
      .eq('id', campaignId)
  } catch (err) {
    console.error('[campaigns] dispatch failed', err)
    await serviceClient
      .from('push_campaigns')
      .update({ status: 'failed' })
      .eq('id', campaignId)
  }
}
