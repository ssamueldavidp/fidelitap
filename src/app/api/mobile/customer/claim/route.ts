import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

// Account recovery for the mobile app. The caller has just proven ownership of
// their email by verifying a Supabase email OTP (so the JWT carries a
// confirmed email); we then re-link the existing customer row and its cards
// to this session. Unlike the web's email-only card recovery, nobody can claim
// someone else's cards by merely typing their address.
export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!user.email || !user.email_confirmed_at) {
    return NextResponse.json({ error: 'Verifica tu correo para recuperar tu cuenta' }, { status: 403 })
  }

  const email = user.email.toLowerCase().trim()
  const db = createServiceClient()

  const { data: customer } = await db.from('customers').select('id').eq('email', email).maybeSingle()
  if (!customer) {
    return NextResponse.json({ error: 'No encontramos una cuenta con ese correo. Regístrate primero.' }, { status: 404 })
  }

  // auth_user_id is unique — free it if this session was linked to another row.
  await db.from('customers').update({ auth_user_id: null }).eq('auth_user_id', user.id).neq('id', customer.id)

  const { error } = await db.from('customers').update({ auth_user_id: user.id }).eq('id', customer.id)
  if (error) return NextResponse.json({ error: 'Error al recuperar tu cuenta' }, { status: 500 })

  const { data: cards } = await db
    .from('customer_cards')
    .update({ linked_auth_user_id: user.id })
    .eq('customer_id', customer.id)
    .select('id')

  return NextResponse.json({ recovered_cards: cards?.length ?? 0 })
}
