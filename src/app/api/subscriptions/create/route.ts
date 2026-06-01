import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mpPreApproval, getPlanPrice, getPlanName, type PlanSlug } from '@/lib/mercadopago'

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
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  const planSlug = body.planSlug as PlanSlug
  if (!VALID_PLANS.includes(planSlug)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'

  try {
    const price    = getPlanPrice(planSlug)
    const planName = getPlanName(planSlug)

    // start_date required for standalone preapproval (no preapproval_plan_id)
    const startDate = new Date(Date.now() + 60_000).toISOString()

    const response = await mpPreApproval.create({
      body: {
        reason:             `FideliTap Plan ${planName}`,
        external_reference: `${business.id}:${planSlug}`,
        back_url:           `${appUrl}/dashboard?subscription=success`,
        auto_recurring: {
          frequency:          1,
          frequency_type:     'months',
          transaction_amount: price,
          currency_id:        'COP',
          start_date:         startDate,
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    })

    if (!response.init_point) {
      return NextResponse.json({ error: 'No se pudo crear la suscripción' }, { status: 500 })
    }

    return NextResponse.json({ init_point: response.init_point })
  } catch (err) {
    console.error('[subscriptions/create]', err)
    return NextResponse.json({ error: 'Error al crear la suscripción' }, { status: 500 })
  }
}
