import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { cancelMpSubscription } from '@/lib/mercadopago'

// "Cancelar" detiene la renovación automática en MercadoPago y deja el plan activo hasta
// la fecha de corte (subscription_end_date, que fija el webhook en cada cobro aprobado).
// Después, el cron downgrade-expired lo pasa a Gratis. Si el cliente no cancela antes de
// esa fecha, MercadoPago cobra el siguiente mes automáticamente.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan, subscription_status, subscription_end_date, mp_preapproval_id')
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

  // Primero MercadoPago: si falla no marcamos nada, para no dejar al cliente creyendo que
  // canceló mientras se le sigue cobrando.
  if (business.mp_preapproval_id) {
    try {
      await cancelMpSubscription(business.mp_preapproval_id)
    } catch (err) {
      console.error('[subscriptions/cancel] MercadoPago', err)
      return NextResponse.json({ error: 'No se pudo cancelar en MercadoPago. Intenta de nuevo en unos minutos.' }, { status: 502 })
    }
  }

  // Si la fecha de corte ya pasó (o no existe), la cancelación aplica de inmediato.
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
    business_id:       business.id,
    mp_preapproval_id: business.mp_preapproval_id,
    event_type:        'subscription_cancelled',
    plan_slug:         business.plan,
    status:            'pending_cancel',
  })

  return NextResponse.json({ availableUntil: endDate.toISOString() })
}
