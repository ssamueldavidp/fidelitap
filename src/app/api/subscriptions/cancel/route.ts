import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mpPreApproval } from '@/lib/mercadopago'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, mp_preapproval_id, subscription_status')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  if (!business.mp_preapproval_id) {
    return NextResponse.json({ error: 'No tienes una suscripción activa' }, { status: 400 })
  }

  if (business.subscription_status === 'pending_cancel' || business.subscription_status === 'canceled') {
    return NextResponse.json({ error: 'La suscripción ya está en proceso de cancelación' }, { status: 400 })
  }

  try {
    await mpPreApproval.update({
      id:   business.mp_preapproval_id,
      body: { status: 'cancelled' },
    })

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 30)

    const serviceClient = createServiceClient()
    await serviceClient
      .from('businesses')
      .update({
        subscription_status:   'pending_cancel',
        subscription_end_date: endDate.toISOString(),
      })
      .eq('id', business.id)

    await serviceClient.from('payment_events').insert({
      business_id:       business.id,
      mp_preapproval_id: business.mp_preapproval_id,
      event_type:        'subscription_cancelled',
      status:            'pending_cancel',
    })

    return NextResponse.json({ availableUntil: endDate.toISOString() })
  } catch (err) {
    console.error('[subscriptions/cancel]', err)
    return NextResponse.json({ error: 'Error al cancelar la suscripción' }, { status: 500 })
  }
}
