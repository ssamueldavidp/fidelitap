import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { isProPlan } from '@/lib/plan-features'

// "Tiendas cercanas" — the Pro+ perk. One query shared by the mobile API
// (/api/mobile/directory/businesses) and the public web page (/tiendas) so both
// list exactly the same businesses under exactly the same rules.
export type DirectoryParams = {
  lat?: number | null
  lng?: number | null
  radiusKm?: number
  city?: string | null
  category?: string | null
}

export type DirectoryStore = {
  id: string
  name: string
  category: string | null
  address: string | null
  avatar_url: string | null
  distance_km: number | null
  primary_card: {
    id: string
    name: string
    slug: string
    benefit_description: string
    stamps_required: number
    expires_at: string | null
    design_config: Record<string, unknown> | null
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type RawCard = {
  id: string; name: string; slug: string; benefit_description: string
  stamps_required: number; expires_at: string | null
  design_config: Record<string, unknown> | null
  is_active: boolean; deleted_at: string | null; created_at: string
}
type RawBiz = {
  id: string; name: string; category: string | null; address: string | null
  avatar_url: string | null; latitude: number | null; longitude: number | null
  plan: string
  loyalty_cards: RawCard[] | null
}

export async function queryDirectory(
  db: SupabaseClient<Database>,
  { lat = null, lng = null, radiusKm = 25, city = null, category = null }: DirectoryParams
): Promise<DirectoryStore[]> {
  let query = db
    .from('businesses')
    .select(`
      id, name, category, address, avatar_url, latitude, longitude, plan,
      loyalty_cards (
        id, name, slug, benefit_description, stamps_required, expires_at, design_config,
        is_active, deleted_at, created_at
      )
    `)
    .in('plan', ['pro', 'premium'])
    .eq('subscription_status', 'active')
    .limit(200)

  if (city) query = query.ilike('address', `%${city.replace(/[%_]/g, '')}%`)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) throw new Error('directory query failed')

  return ((data ?? []) as unknown as RawBiz[])
    .filter((biz) => isProPlan(biz.plan))
    .map((biz): DirectoryStore | null => {
      const activeCards = (biz.loyalty_cards ?? [])
        .filter((c) => c.is_active && !c.deleted_at)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
      if (activeCards.length === 0) return null
      const primary = activeCards[0]

      const hasCoords = lat != null && lng != null && biz.latitude != null && biz.longitude != null
      const distance_km = hasCoords ? haversineKm(lat!, lng!, biz.latitude!, biz.longitude!) : null

      return {
        id: biz.id,
        name: biz.name,
        category: biz.category,
        address: biz.address,
        avatar_url: biz.avatar_url,
        distance_km,
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
    .filter((s): s is DirectoryStore => s !== null)
    .filter((s) => s.distance_km === null || s.distance_km <= radiusKm)
    .sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return 0
      if (a.distance_km === null) return 1
      if (b.distance_km === null) return -1
      return a.distance_km - b.distance_km
    })
    .slice(0, 50)
}
