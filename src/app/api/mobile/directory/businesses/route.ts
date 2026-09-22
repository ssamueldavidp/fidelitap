import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

// Tiendas cercanas — Pro+ perk: only businesses on plan pro/premium, with an
// active subscription and at least one active card, show up here. Public
// business info only (name/photo/address/category), so this uses the
// service-role client rather than an RLS-scoped one, matching the pattern of
// /api/mobile/cards/by-slug/[slug].
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const params = req.nextUrl.searchParams
  const lat = params.get('lat') ? Number(params.get('lat')) : null
  const lng = params.get('lng') ? Number(params.get('lng')) : null
  const radiusKm = params.get('radius_km') ? Number(params.get('radius_km')) : 25
  const city = params.get('city')?.trim() || null
  const category = params.get('category')?.trim() || null

  const serviceClient = createServiceClient()

  let query = serviceClient
    .from('businesses')
    .select(`
      id, name, category, address, avatar_url, latitude, longitude,
      loyalty_cards (
        id, name, slug, benefit_description, stamps_required, expires_at, design_config,
        is_active, deleted_at, created_at
      )
    `)
    .in('plan', ['pro', 'premium'])
    .eq('subscription_status', 'active')
    .limit(200)

  if (city) query = query.ilike('address', `%${city}%`)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Error al cargar tiendas' }, { status: 500 })

  type RawCard = {
    id: string; name: string; slug: string; benefit_description: string
    stamps_required: number; expires_at: string | null
    design_config: Record<string, unknown> | null
    is_active: boolean; deleted_at: string | null; created_at: string
  }
  type RawBiz = {
    id: string; name: string; category: string | null; address: string | null
    avatar_url: string | null; latitude: number | null; longitude: number | null
    loyalty_cards: RawCard[] | null
  }

  const stores = ((data ?? []) as unknown as RawBiz[])
    .map((biz) => {
      const activeCards = (biz.loyalty_cards ?? [])
        .filter((c) => c.is_active && !c.deleted_at)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
      if (activeCards.length === 0) return null
      const primary = activeCards[0]

      const hasCoords = lat != null && lng != null && biz.latitude != null && biz.longitude != null
      const distanceKm = hasCoords ? haversineKm(lat!, lng!, biz.latitude!, biz.longitude!) : null

      return {
        id: biz.id,
        name: biz.name,
        category: biz.category,
        address: biz.address,
        avatar_url: biz.avatar_url,
        distance_km: distanceKm,
        primary_card: {
          id: primary.id,
          name: primary.name,
          slug: primary.slug,
          benefit_description: primary.benefit_description,
          stamps_required: primary.stamps_required,
          expires_at: primary.expires_at,
          design_config: primary.design_config,
        },
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .filter((s) => s.distance_km === null || s.distance_km <= radiusKm)
    .sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return 0
      if (a.distance_km === null) return 1
      if (b.distance_km === null) return -1
      return a.distance_km - b.distance_km
    })
    .slice(0, 50)

  return NextResponse.json({ stores })
}
