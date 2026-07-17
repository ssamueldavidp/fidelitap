import { NextRequest, NextResponse } from 'next/server'
import { mobileSupabaseClient, getMobileUser } from '@/lib/mobile/auth'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = mobileSupabaseClient(req)
  const { data, error } = await supabase
    .from('customer_cards')
    .select(`
      id,
      current_stamps,
      status,
      times_completed,
      loyalty_cards (
        name,
        benefit_description,
        stamps_required,
        expires_at,
        design_config,
        businesses ( name, latitude, longitude, plan ),
        card_rewards ( stamps_required, reward_label, color, sort_order )
      )
    `)
    .eq('linked_auth_user_id', user.id)

  if (error) return NextResponse.json({ error: 'Error al cargar tarjetas' }, { status: 500 })
  return NextResponse.json({ cards: data })
}
