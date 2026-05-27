// src/lib/plan-guard.ts
// Server-side plan enforcement. Never trust the client for plan checks.

export type PlanTier = 'free' | 'basic' | 'pro' | 'premium'

const PLAN_ORDER: PlanTier[] = ['free', 'basic', 'pro', 'premium']

/** Returns true if currentPlan meets the minPlan requirement. */
export function meetsMinPlan(currentPlan: string, minPlan: PlanTier): boolean {
  const currentIdx = PLAN_ORDER.indexOf(currentPlan as PlanTier)
  const minIdx     = PLAN_ORDER.indexOf(minPlan)
  if (currentIdx === -1 || minIdx === -1) return false
  return currentIdx >= minIdx
}

/** Throws a Response with 403 JSON if plan is insufficient. Use in API routes. */
export function requirePlanOrThrow(currentPlan: string, minPlan: PlanTier): void {
  if (!meetsMinPlan(currentPlan, minPlan)) {
    throw new Response(
      JSON.stringify({ error: `Esta función requiere el plan ${minPlan} o superior.` }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

/** Returns an error string if plan is insufficient; null if OK. Use in Server Actions. */
export function checkPlan(currentPlan: string, minPlan: PlanTier): string | null {
  if (!meetsMinPlan(currentPlan, minPlan)) {
    return `Tu plan actual no incluye esta función. Actualiza al plan ${minPlan} o superior.`
  }
  return null
}
