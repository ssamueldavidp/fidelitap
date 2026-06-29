import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mpPreference, getPlanPrice, getPlanName, getCheckoutUrl, type PlanSlug } from '@/lib/mercadopago'

const VALID_PLANS: PlanSlug[] = ['basic', 'pro', 'premium']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan, subscription_status')
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'

  try {
    const price    = getPlanPrice(planSlug)
    const planName = getPlanName(planSlug)

    const response = await mpPreference.create({
      body: {
        items: [
          {
            id:           planSlug,
            title:        `FideliTap Plan ${planName}`,
            quantity:     1,
            unit_price:   price,
            currency_id:  'COP',
          },
        ],
        external_reference:   `${business.id}:${planSlug}`,
        back_urls: {
          success: `${appUrl}/dashboard?subscription=success`,
          failure: `${appUrl}/settings?tab=suscripcion&payment=failed`,
          pending: `${appUrl}/dashboard?subscription=pending`,
        },
        auto_return:          'approved',
        statement_descriptor: 'FideliTap',
        notification_url:     `${appUrl}/api/webhooks/mercadopago`,
        binary_mode:          true,
      },
    })

    const checkoutUrl = getCheckoutUrl(response)
    if (!checkoutUrl) {
      return NextResponse.json({ error: 'No se pudo crear el enlace de pago' }, { status: 500 })
    }

    return NextResponse.json({ init_point: checkoutUrl })
  } catch (err) {
    console.error('[subscriptions/create]', err)
    return NextResponse.json({ error: 'Error al crear la suscripción' }, { status: 500 })
  }
}
