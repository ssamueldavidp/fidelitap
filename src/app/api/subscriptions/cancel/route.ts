import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// Checkout Pro (what this project actually uses) is a one-off payment, not a
// recurring MercadoPago subscription — there's no PreApproval object to call
// MercadoPago and cancel. "Cancelar" just means: stop the plan from renewing
// and let it run out at subscription_end_date (set to +30 days by the
// webhook on each approved payment). This previously gated on
// mp_preapproval_id, which handlePayment only ever sets for the unused
// PreApproval path — so this route 404'd with "No tienes una suscripción
// activa" for every real paying business.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan, subscription_status, subscription_end_date')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  if (business.plan === 'free') {
    return NextResponse.json({ error: 'No tienes una suscripción activa' }, { status: 400 })
  }

  if (business.subscription_status === 'pending_cancel' || business.subscription_status === 'canceled') {
    return NextResponse.json({ error: 'La suscripción ya está en proceso de cancelación' }, { status: 400 })
  }

  // If subscription_end_date is somehow already past, cancel takes effect immediately.
  const endDate = business.subscription_end_date && new Date(business.subscription_end_date) > new Date()
    ? new Date(business.subscription_end_date)
    : new Date()

  const serviceClient = createServiceClient()

  const { error } = await serviceClient
    .from('businesses')
    .update({ subscription_status: 'pending_cancel', subscription_end_date: endDate.toISOString() })
    .eq('id', business.id)

  if (error) {
    console.error('[subscriptions/cancel]', error)
    return NextResponse.json({ error: 'Error al cancelar la suscripción' }, { status: 500 })
  }

  await serviceClient.from('payment_events').insert({
    business_id: business.id,
    event_type:  'subscription_cancelled',
    plan_slug:   business.plan,
    status:      'pending_cancel',
  })

  return NextResponse.json({ availableUntil: endDate.toISOString() })
}
