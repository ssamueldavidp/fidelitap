import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan, subscription_status, mp_preapproval_id, mp_payer_email, subscription_end_date')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const serviceClient = createServiceClient()

  const { data: events } = await serviceClient
    .from('payment_events')
    .select('id, event_type, plan_slug, amount_cop, status, created_at')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    plan:                business.plan,
    subscriptionStatus:  business.subscription_status,
    mpPreapprovalId:     business.mp_preapproval_id,
    payerEmail:          business.mp_payer_email,
    subscriptionEndDate: business.subscription_end_date,
    paymentHistory:      events ?? [],
  })
}
