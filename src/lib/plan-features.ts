import { getPlanLimits, type PlanSlug } from './plan-limits'

// What each plan includes, in one place, so the web register form, the web
// subscription tab and the mobile API (/api/mobile/plan) never drift apart.
// Numeric limits come from plan-limits.ts; the Pro+ perks are gated in code
// (isProPlan) — this file only *describes* them.
export const PRO_FEATURES = [
  'Notificaciones push a tus clientes (campañas y recordatorios)',
  'Alertas de proximidad en la app (geofencing)',
  'Aparecer en "Tiendas cercanas" de la app',
] as const

export function isProPlan(plan: string): boolean {
  return plan === 'pro' || plan === 'premium'
}

function fmt(n: number | null, singular: string, plural: string): string {
  if (n === null) return `${plural.charAt(0).toUpperCase()}${plural.slice(1)} ilimitados`
  return n === 1 ? `1 ${singular}` : `Hasta ${n.toLocaleString('es-CO')} ${plural}`
}

export function getPlanFeatures(plan: PlanSlug): string[] {
  const { maxCards, maxCustomers } = getPlanLimits(plan)
  const base = [
    fmt(maxCards, 'tarjeta', 'tarjetas'),
    fmt(maxCustomers, 'cliente', 'clientes'),
    'Apple Wallet y Google Wallet',
    'Scanner QR y cartel imprimible',
  ]
  if (plan === 'free') return base
  const withUpdates = [...base, 'Actualización en vivo del Wallet']
  if (plan === 'basic') return withUpdates
  return [...withUpdates, ...PRO_FEATURES]
}
