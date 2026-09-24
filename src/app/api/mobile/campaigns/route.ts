import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { isPushEligible } from '@/lib/push/eligibility'
import { createCampaign } from '@/lib/push/campaigns'

// Mobile counterpart of the web /campaigns page — same rules, same lib.
async function getOwnedBusiness(userId: string) {
  const db = createServiceClient()
  const { data } = await db
    .from('businesses')
    .select('id, plan, subscription_status')
    .eq('owner_id', userId)
    .single()
  return { db, business: data }
}

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { db, business } = await getOwnedBusiness(user.id)
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const eligible = isPushEligible(business.plan, business.subscription_status)
  if (!eligible) return NextResponse.json({ eligible: false, cards: [], campaigns: [] })

  const [{ data: cards }, { data: campaigns }] = await Promise.all([
    db.from('loyalty_cards').select('id, name').eq('business_id', business.id)
      .is('deleted_at', null).eq('is_active', true).order('created_at', { ascending: true }),
    db.from('push_campaigns')
      .select('id, title, body, status, scheduled_at, sent_at, recipients_count, loyalty_card_id')
      .eq('business_id', business.id).order('created_at', { ascending: false }).limit(20),
  ])

  return NextResponse.json({ eligible: true, cards: cards ?? [], campaigns: campaigns ?? [] })
}

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { db, business } = await getOwnedBusiness(user.id)
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const result = await createCampaign(db, business, {
    title: body?.title,
    body: body?.body,
    loyaltyCardId: body?.loyaltyCardId || '',
    scheduledAt: body?.scheduledAt || '',
  })
  if (result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
