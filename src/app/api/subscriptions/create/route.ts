import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSubscriptionLink, type PlanSlug } from '@/lib/mercadopago'

const VALID_PLANS: PlanSlug[] = ['basic', 'pro', 'premium']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, email, plan, subscription_status')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  let body: { planSlug?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  const planSlug = body.planSlug as PlanSlug
  if (!VALID_PLANS.includes(planSlug)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  if (business.plan === planSlug && business.subscription_status === 'active') {
    return NextResponse.json({ error: 'Ya tienes este plan activo' }, { status: 400 })
  }

  try {
    const initPoint = await createSubscriptionLink({
      businessId: business.id,
      businessEmail: business.email,
      planSlug,
    })
    return NextResponse.json({ init_point: initPoint })
  } catch (err) {
    console.error('[subscriptions/create]', err)
    return NextResponse.json({ error: 'Error al crear la suscripción' }, { status: 500 })
  }
}
