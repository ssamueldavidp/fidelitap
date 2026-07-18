import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToTokens } from '@/lib/push/firebase'

type BusinessRow = {
  plan: string
  geofence_enabled: boolean
  geofence_message: string | null
  geofence_cooldown_h: number
  timezone: string
  quiet_hours_start: number
  quiet_hours_end: number
}

function isQuietHours(biz: BusinessRow): boolean {
  const localHour = parseInt(
    new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      hour12: false,
      timeZone: biz.timezone,
    }).format(new Date())
  )
  const { quiet_hours_start: start, quiet_hours_end: end } = biz
  // Interval crosses midnight (e.g. start=22, end=6)
  if (start > end) return localHour >= start || localHour < end
  return localHour >= start && localHour < end
}

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { business_id } = await req.json()
  if (!business_id) return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })

  const db = createServiceClient()

  // 1. Verify business plan + geofence config
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: biz, error: bizErr } = await (db.from('businesses') as any)
    .select('plan, geofence_enabled, geofence_message, geofence_cooldown_h, timezone, quiet_hours_start, quiet_hours_end')
    .eq('id', business_id)
    .single() as { data: BusinessRow | null; error: unknown }

  if (bizErr || !biz) return NextResponse.json({ skipped: 'not_found' })
  if (!['pro', 'premium'].includes(biz.plan)) return NextResponse.json({ skipped: 'plan' })
  if (!biz.geofence_enabled) return NextResponse.json({ skipped: 'disabled' })
  if (isQuietHours(biz)) return NextResponse.json({ skipped: 'quiet_hours' })

  // 2. Find customer_card for this user + business
  const { data: cards } = await db
    .from('customer_cards')
    .select('id, loyalty_cards(businesses(id))')
    .eq('linked_auth_user_id', user.id)

  const cc = (cards ?? []).find((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lc = c.loyalty_cards as any
    const bizes = Array.isArray(lc?.businesses) ? lc.businesses : [lc?.businesses]
    return bizes.some((b: { id: string } | null) => b?.id === business_id)
  })

  if (!cc) return NextResponse.json({ skipped: 'no_card' })

  // 3. Check cooldown
  const cooldownMs = (biz.geofence_cooldown_h ?? 24) * 3600 * 1000
  const since = new Date(Date.now() - cooldownMs).toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (db.from('geofence_notifications') as any)
    .select('id', { count: 'exact', head: true })
    .eq('customer_card_id', cc.id)
    .eq('business_id', business_id)
    .gte('sent_at', since)

  if ((count ?? 0) > 0) return NextResponse.json({ skipped: 'cooldown' })

  // 4. Get FCM tokens for this user
  const { data: tokenRows } = await db
    .from('device_tokens')
    .select('fcm_token')
    .eq('user_id', user.id)

  const tokens = (tokenRows ?? []).map((t) => t.fcm_token)

  // 5. Send notification (no-op if FIREBASE_SERVICE_ACCOUNT_JSON not set)
  if (tokens.length > 0 && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      await sendPushToTokens(tokens, {
        title: '¡Estás cerca! 📍',
        body: biz.geofence_message ?? '¡Tienes una tarjeta activa aquí! Acumula sellos.',
        data: { business_id },
      })
    } catch (e) {
      console.error('[geofence/notify] FCM error:', e)
    }
  }

  // 6. Record notification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.from('geofence_notifications') as any)
    .insert({ customer_card_id: cc.id, business_id })

  return NextResponse.json({ ok: true })
}
