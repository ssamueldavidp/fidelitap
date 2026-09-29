import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

// Cron counterpart to /api/subscriptions/cancel: a cancelled business keeps
// its paid plan until subscription_end_date (the grace period), then this
// downgrades it to free. Nothing did this before — a "cancelled" business
// stayed on its paid plan forever. Same auth pattern as
// /api/push/jobs/reengagement (CRON_SECRET header, called by an external
// scheduler daily).
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

  const { data: expired, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('subscription_status', 'pending_cancel')
    .lt('subscription_end_date', new Date().toISOString())

  if (error) return NextResponse.json({ error: 'Error al consultar negocios' }, { status: 500 })
  if (!expired || expired.length === 0) return NextResponse.json({ downgraded: 0 })

  const ids = expired.map((b) => b.id)
  const { error: updateErr } = await supabase
    .from('businesses')
    .update({ plan: 'free', subscription_status: 'canceled' })
    .in('id', ids)

  if (updateErr) return NextResponse.json({ error: 'Error al degradar negocios' }, { status: 500 })

  await supabase.from('payment_events').insert(
    ids.map((business_id) => ({ business_id, event_type: 'plan_downgraded', plan_slug: 'free', status: 'canceled' }))
  )

  return NextResponse.json({ downgraded: ids.length })
}
