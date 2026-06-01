export type PlanSlug = 'free' | 'basic' | 'pro' | 'premium'
export type UsageState = 'ok' | 'warning' | 'full'

export interface PlanLimits {
  maxCustomers: number | null  // null = unlimited
  maxCards: number | null
}

export const PLAN_LIMITS: Record<PlanSlug, PlanLimits> = {
  free:    { maxCustomers: 20,   maxCards: 1 },
  basic:   { maxCustomers: 500,  maxCards: 3 },
  pro:     { maxCustomers: 2000, maxCards: 10 },
  premium: { maxCustomers: null, maxCards: null },
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as PlanSlug] ?? PLAN_LIMITS.free
}

/** Returns null when there is no limit (unlimited plan) */
export function getUsagePct(current: number, limit: number | null): number | null {
  if (limit === null) return null
  return Math.min(100, Math.round((current / limit) * 100))
}

export function getUsageState(current: number, limit: number | null): UsageState {
  if (limit === null) return 'ok'
  const ratio = current / limit
  if (ratio >= 1) return 'full'
  if (ratio >= 0.8) return 'warning'
  return 'ok'
}

/** True if a new customer/card CANNOT be added (at or over limit) */
export function isAtLimit(current: number, limit: number | null): boolean {
  if (limit === null) return false
  return current >= limit
}
