import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendFcmPush } from '../_shared/fcm.ts'

const RADIUS_M = 300

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Authenticate the calling customer
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 })
  }

  const { customer_card_id, business_id, latitude, longitude } = await req.json() as {
    customer_card_id: string
    business_id: string
    latitude: number
    longitude: number
  }

  const db = createClient(supabaseUrl, serviceKey)

  // 1. Check business plan is Pro+
  const { data: biz } = await db
    .from('businesses')
    .select('plan, name, latitude, longitude')
    .eq('id', business_id)
    .single()

  if (!biz || !['pro', 'premium'].includes(biz.plan ?? '')) {
    return new Response(JSON.stringify({ skipped: 'not_pro' }), { status: 200 })
  }

  // 2. Check device is within radius (double-check server-side)
  if (biz.latitude && biz.longitude) {
    const dist = haversineMeters(latitude, longitude, biz.latitude, biz.longitude)
    if (dist > RADIUS_M * 1.5) {
      return new Response(JSON.stringify({ skipped: 'out_of_range', dist_m: dist }), { status: 200 })
    }
  }

  // 3. Cooldown: max 1 per customer_card / business per calendar day
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const { data: recent } = await db
    .from('geofence_notifications')
    .select('id')
    .eq('customer_card_id', customer_card_id)
    .eq('business_id', business_id)
    .gte('sent_at', dayStart.toISOString())
    .limit(1)
    .maybeSingle()

  if (recent) {
    return new Response(JSON.stringify({ skipped: 'cooldown' }), { status: 200 })
  }

  // 4. Compute stamps remaining
  const { data: cc } = await db
    .from('customer_cards')
    .select('current_stamps, loyalty_cards(stamps_required)')
    .eq('id', customer_card_id)
    .single()

  if (!cc) {
    return new Response(JSON.stringify({ error: 'Card not found' }), { status: 404 })
  }

  const lcRaw = cc.loyalty_cards as unknown as { stamps_required: number } | null
  const stampsRequired = lcRaw?.stamps_required ?? 1
  const currentStamps = cc.current_stamps ?? 0
  const missing = stampsRequired - currentStamps

  // 5. Get device tokens for this customer
  const { data: tokens } = await db
    .from('device_tokens')
    .select('fcm_token')
    .eq('user_id', user.id)

  const fcmTokens = tokens?.map((t) => t.fcm_token) ?? []

  // 6. Send push
  if (fcmTokens.length > 0) {
    const title = `¡Estás cerca de ${biz.name}! 📍`
    const body = missing > 0
      ? `Te ${missing === 1 ? 'falta 1 sello' : `faltan ${missing} sellos`} para tu premio`
      : '¡Tu tarjeta está completa! Ve a reclamar tu premio 🎉'
    await sendFcmPush(fcmTokens, title, body, {
      business_id,
      customer_card_id,
      type: 'geofence_reminder',
    })
  }

  // 7. Record cooldown
  await db.from('geofence_notifications').insert({
    customer_card_id,
    business_id,
    sent_at: new Date().toISOString(),
  })

  return new Response(
    JSON.stringify({ sent: true, tokens: fcmTokens.length, missing }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})

function haversineMeters(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
