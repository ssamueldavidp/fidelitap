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
        logo_url,
        businesses ( id, name, latitude, longitude, plan, geofence_enabled, geofence_radius_m ),
        card_rewards ( stamps_required, reward_label, color, sort_order )
      )
    `)
    .eq('linked_auth_user_id', user.id)

  if (error) return NextResponse.json({ error: 'Error al cargar tarjetas' }, { status: 500 })

  // logo_url lives in design_config.logo_url for cards created on the web,
  // and in the top-level loyalty_cards.logo_url column for cards created
  // via the mobile app's older upload path — merge both so a card shows
  // its logo to the customer regardless of which client made it.
  type RawLC = { design_config: Record<string, unknown> | null; logo_url: string | null } & Record<string, unknown>
  const cards = (data ?? []).map((cc) => {
    const lc = cc.loyalty_cards as unknown as RawLC | null
    if (!lc) return cc
    const cfg = (lc.design_config as Record<string, unknown> | null) ?? {}
    return {
      ...cc,
      loyalty_cards: {
        ...lc,
        design_config: { ...cfg, logo_url: (cfg.logo_url as string | null) ?? lc.logo_url ?? null },
      },
    }
  })

  return NextResponse.json({ cards })
}
