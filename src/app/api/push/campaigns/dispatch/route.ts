import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { sendCampaignPush } from '@/lib/push/send'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret') ?? ''
  const expected = process.env.CRON_SECRET ?? ''
  if (
    !secret ||
    !expected ||
    secret.length !== expected.length ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Atomically claim due campaigns by flipping status away from 'scheduled' in one statement,
  // so a concurrent cron tick (if the previous run is still in flight) can't pick up the same row.
  const { data: due } = await supabase
    .from('push_campaigns')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .select('id, business_id, loyalty_card_id, title, body')

  if (!due || due.length === 0) {
    return NextResponse.json({ dispatched: 0 })
  }

  let dispatched = 0
  for (const campaign of due) {
    try {
      const sentCount = await sendCampaignPush(supabase, {
        businessId: campaign.business_id,
        loyaltyCardId: campaign.loyalty_card_id,
        title: campaign.title,
        body: campaign.body,
      })

      await supabase
        .from('push_campaigns')
        .update({ recipients_count: sentCount })
        .eq('id', campaign.id)

      dispatched++
    } catch (err) {
      console.error('[campaigns] scheduled dispatch failed', err)
      await supabase
        .from('push_campaigns')
        .update({ status: 'failed' })
        .eq('id', campaign.id)
    }
  }

  return NextResponse.json({ dispatched })
}
