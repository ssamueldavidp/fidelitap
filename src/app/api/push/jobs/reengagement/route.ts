import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToCustomerCard } from '@/lib/push/send'
import { isPushEligible } from '@/lib/push/eligibility'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates } = await supabase
    .from('customer_cards')
    .select(`
      id,
      current_stamps,
      last_stamp_at,
      reengagement_sent_at,
      loyalty_cards ( stamps_required, business_id, businesses ( name, plan, subscription_status ) )
    `)
    .eq('status', 'active')
    .lt('last_stamp_at', fourteenDaysAgo)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  for (const cc of candidates) {
    const card = cc.loyalty_cards as unknown as {
      stamps_required: number
      business_id: string
      businesses: { name: string; plan: string; subscription_status: string } | null
    } | null
    const biz = card?.businesses
    if (!card || !biz) continue
    if (!isPushEligible(biz.plan, biz.subscription_status)) continue
    if (cc.reengagement_sent_at && cc.last_stamp_at && cc.reengagement_sent_at >= cc.last_stamp_at) continue

    const remaining = card.stamps_required - cc.current_stamps
    const count = await sendPushToCustomerCard(supabase, cc.id, {
      title: `${biz.name} te espera 👋`,
      body: `Te falta${remaining === 1 ? '' : 'n'} ${remaining} sello${remaining === 1 ? '' : 's'} para tu premio. ¡No los pierdas!`,
    })

    if (count > 0) {
      await supabase
        .from('customer_cards')
        .update({ reengagement_sent_at: new Date().toISOString() })
        .eq('id', cc.id)
      sent++
    }
  }

  return NextResponse.json({ sent })
}
