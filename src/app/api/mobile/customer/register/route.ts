import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { customerProfileSchema, findOrCreateCustomer, hasVerifiedEmail, EMAIL_NOT_VERIFIED, checkApiRateLimit } from '@/lib/mobile/customer-registration'

// Lets someone create a customer account inside the app with no loyalty
// card yet — they land on an empty "Mis tarjetas" and can add a card later
// (via /auth/claim, or by joining a business from the Tiendas directory).
// Unlike /api/mobile/activate, this never touches customer_cards; it only
// links the customers row to the caller's auth uid via `auth_user_id`, which
// mobile/lib/core/session_role.dart's resolveRole() checks to recognize
// them as a customer with no card yet.
export async function POST(req: NextRequest) {
  if (!(await checkApiRateLimit(req))) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' }, { status: 429 })
  }

  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = customerProfileSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  if (!hasVerifiedEmail(user, parsed.data.email)) {
    return NextResponse.json({ error: EMAIL_NOT_VERIFIED }, { status: 403 })
  }

  const serviceClient = createServiceClient()

  const customer = await findOrCreateCustomer(serviceClient, parsed.data)
  if (!customer) return NextResponse.json({ error: 'Error al registrarte. Intenta de nuevo.' }, { status: 500 })

  const { error: linkErr } = await serviceClient
    .from('customers')
    .update({ auth_user_id: user.id })
    .eq('id', customer.id)
  if (linkErr) return NextResponse.json({ error: 'Error al registrarte. Intenta de nuevo.' }, { status: 500 })

  return NextResponse.json({ customer_id: customer.id }, { status: 201 })
}
