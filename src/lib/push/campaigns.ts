import 'server-only'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { createServiceClient } from '@/lib/supabase/service'
import { sendCampaignPush } from '@/lib/push/send'
import { isPushEligible } from '@/lib/push/eligibility'

// One implementation of the campaign rules (Pro+ gate, validation,
// scheduling, immediate dispatch, cancel), shared by the web server actions
// and the /api/mobile/campaigns routes so the two clients can't diverge.
export const campaignSchema = z.object({
  title: z.string().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres').trim(),
  body: z.string().min(2, 'Mínimo 2 caracteres').max(150, 'Máximo 150 caracteres').trim(),
  loyaltyCardId: z.string().uuid().optional().or(z.literal('')),
  scheduledAt: z.string().optional().or(z.literal('')),
})

type Db = SupabaseClient<Database>
type Biz = { id: string; plan: string; subscription_status: string }

export async function createCampaign(
  db: Db,
  business: Biz,
  input: unknown
): Promise<{ error: string } | null> {
  if (!isPushEligible(business.plan, business.subscription_status)) {
    return { error: 'Las campañas push requieren plan Pro o Premium' }
  }

  const parsed = campaignSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { title, body, loyaltyCardId, scheduledAt } = parsed.data
  const loyalty_card_id = loyaltyCardId || null
  const scheduled_at = scheduledAt ? new Date(scheduledAt).toISOString() : null

  if (scheduled_at && new Date(scheduled_at) <= new Date()) {
    return { error: 'La fecha programada debe ser en el futuro' }
  }

  const { data: campaign, error } = await db
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
  return null
}

export async function cancelCampaign(
  db: Db,
  businessId: string,
  campaignId: string
): Promise<{ error: string } | null> {
  const { error } = await db
    .from('push_campaigns')
    .update({ status: 'failed' })
    .eq('id', campaignId)
    .eq('business_id', businessId)
    .eq('status', 'scheduled')

  return error ? { error: 'Error cancelando la campaña' } : null
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
    const sentCount = await sendCampaignPush(serviceClient, { businessId, loyaltyCardId, title, body })
    await serviceClient
      .from('push_campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString(), recipients_count: sentCount })
      .eq('id', campaignId)
  } catch (err) {
    console.error('[campaigns] dispatch failed', err)
    await serviceClient.from('push_campaigns').update({ status: 'failed' }).eq('id', campaignId)
  }
}
