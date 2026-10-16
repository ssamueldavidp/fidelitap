import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000 // Colombia no usa horario de verano
const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

/** Clave YYYY-MM-DD del día en hora de Colombia. */
function bogotaDayKey(date: Date): string {
  return new Date(date.getTime() + BOGOTA_OFFSET_MS).toISOString().slice(0, 10)
}

export interface DayBar {
  key: string
  label: string
  count: number
  isToday: boolean
}

export interface ActivityItem {
  id: string
  who: string
  kind: 'stamp' | 'reward'
  at: string
}

export interface DashboardOverview {
  days: DayBar[]
  stampsToday: number
  stampsYesterday: number
  weekTotal: number
  rewardsThisMonth: number
  activity: ActivityItem[]
  hasAnyStamp: boolean
}

export async function getDashboardOverview(businessId: string): Promise<DashboardOverview> {
  const service = createServiceClient()
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const since = new Date(now.getTime() - 7 * DAY_MS).toISOString()

  const [weekRes, monthRewardsRes, recentRes, anyRes] = await Promise.all([
    service
      .from('stamp_events')
      .select('created_at')
      .eq('business_id', businessId)
      .eq('type', 'stamp')
      .gte('created_at', since),
    service
      .from('stamp_events')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('type', 'reward_claimed')
      .gte('created_at', monthStart),
    service
      .from('stamp_events')
      .select('id, type, created_at, customer_cards(customers(name))')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(5),
    service
      .from('stamp_events')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId),
  ])

  const counts = new Map<string, number>()
  for (const row of weekRes.data ?? []) {
    const key = bogotaDayKey(new Date(row.created_at))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const todayKey = bogotaDayKey(now)
  const days: DayBar[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS)
    const key = bogotaDayKey(d)
    const weekday = new Date(d.getTime() + BOGOTA_OFFSET_MS).getUTCDay()
    days.push({ key, label: WEEKDAYS[weekday], count: counts.get(key) ?? 0, isToday: key === todayKey })
  }

  const activity: ActivityItem[] = (recentRes.data ?? []).map((row) => {
    const cc = row.customer_cards as unknown as { customers: { name: string } | null } | null
    return {
      id: row.id,
      who: cc?.customers?.name ?? 'Cliente',
      kind: row.type === 'reward_claimed' ? 'reward' : 'stamp',
      at: row.created_at,
    }
  })

  return {
    days,
    stampsToday: days[days.length - 1].count,
    stampsYesterday: days[days.length - 2].count,
    weekTotal: days.reduce((sum, d) => sum + d.count, 0),
    rewardsThisMonth: monthRewardsRes.count ?? 0,
    activity,
    hasAnyStamp: (anyRes.count ?? 0) > 0,
  }
}

/** "hace 2 min", "hace 3 h", "hace 2 d" */
export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.round(hours / 24)} d`
}
