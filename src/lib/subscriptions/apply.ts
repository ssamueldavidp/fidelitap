// Lógica de estado de las suscripciones automáticas. Sin 'server-only' ni llamadas a
// MercadoPago a propósito: recibe los objetos ya consultados y el cliente de Supabase,
// así se puede probar contra la base local sin tocar la API de MercadoPago.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Db = SupabaseClient<Database>

export const PAID_PLANS = ['basic', 'pro', 'premium'] as const
export type PaidPlan = typeof PAID_PLANS[number]

// Días extra tras la fecha de corte mientras MercadoPago reintenta un cobro fallido.
export const PAST_DUE_GRACE_DAYS = 3
const DAY_MS = 86_400_000

export type MpPreapproval = {
  id: string
  status: string
  external_reference?: string | null
  next_payment_date?: string | null
}

export type MpAuthorizedPayment = {
  id: number | string
  preapproval_id: string
  status?: string
  transaction_amount?: number
  payment?: { id?: number | string; status?: string } | null
}

export function parseExternalReference(ref?: string | null): { businessId: string; plan: PaidPlan } | null {
  if (!ref?.includes(':')) return null
  const [businessId, plan] = ref.split(':')
  if (!businessId || !PAID_PLANS.includes(plan as PaidPlan)) return null
  return { businessId, plan: plan as PaidPlan }
}

// Fecha hasta la que el plan queda pagado. Si MercadoPago ya programó el próximo cobro
// (más de 2 días adelante) esa es la fecha de corte; si no (primer cobro en curso) se
// asume un ciclo mensual completo.
export function computePeriodEnd(nextPaymentDate: string | null | undefined, now = new Date()): Date {
  const next = nextPaymentDate ? new Date(nextPaymentDate) : null
  if (next && !Number.isNaN(next.getTime()) && next.getTime() > now.getTime() + 2 * DAY_MS) return next
  return new Date(now.getTime() + 30 * DAY_MS)
}

const BIZ_COLUMNS = 'id, plan, subscription_status, subscription_end_date, mp_preapproval_id'

async function findBusiness(db: Db, preapprovalId: string, externalReference?: string | null) {
  const { data: bySub } = await db.from('businesses').select(BIZ_COLUMNS).eq('mp_preapproval_id', preapprovalId).maybeSingle()
  if (bySub) return bySub
  const ref = parseExternalReference(externalReference)
  if (!ref) return null
  const { data: byRef } = await db.from('businesses').select(BIZ_COLUMNS).eq('id', ref.businessId).maybeSingle()
  return byRef
}

type Deps = {
  cancelOldSubscription: (preapprovalId: string) => Promise<void>
  now?: Date
}

// Notificación "subscription_preapproval": cambió el estado de la suscripción.
export async function applyPreapproval(db: Db, pre: MpPreapproval, deps: Deps): Promise<string> {
  const now = deps.now ?? new Date()
  const biz = await findBusiness(db, pre.id, pre.external_reference)
  if (!biz) return 'no-business'
  const ref = parseExternalReference(pre.external_reference)

  if (pre.status === 'authorized') {
    if (!ref) return 'no-plan'
    const changed = biz.mp_preapproval_id !== pre.id

    // Cambio de plan: la suscripción anterior deja de cobrar para no cobrar doble.
    if (biz.mp_preapproval_id && biz.mp_preapproval_id !== pre.id) {
      try {
        await deps.cancelOldSubscription(biz.mp_preapproval_id)
      } catch (err) {
        console.error('[subscriptions] no se pudo cancelar la suscripción anterior', biz.mp_preapproval_id, err)
      }
    }

    await db.from('businesses').update({
      plan: ref.plan,
      subscription_status: 'active',
      mp_preapproval_id: pre.id,
      subscription_end_date: computePeriodEnd(pre.next_payment_date, now).toISOString(),
    }).eq('id', biz.id)

    if (changed) {
      await db.from('payment_events').insert({
        business_id: biz.id, mp_preapproval_id: pre.id, event_type: 'subscription_created',
        plan_slug: ref.plan, status: 'authorized',
      })
    }
    return 'activated'
  }

  // Cancelada/pausada: solo importa si es la suscripción vigente del negocio (no una
  // anterior que reemplazamos nosotros).
  if (biz.mp_preapproval_id !== pre.id) return 'ignored-other-subscription'

  if (pre.status === 'cancelled') {
    if (biz.subscription_status === 'pending_cancel' || biz.subscription_status === 'canceled') return 'already-cancelled'
    const end = biz.subscription_end_date && new Date(biz.subscription_end_date) > now ? biz.subscription_end_date : now.toISOString()
    await db.from('businesses').update({ subscription_status: 'pending_cancel', subscription_end_date: end }).eq('id', biz.id)
    await db.from('payment_events').insert({
      business_id: biz.id, mp_preapproval_id: pre.id, event_type: 'subscription_cancelled',
      plan_slug: biz.plan, status: 'pending_cancel',
    })
    return 'cancelled'
  }

  if (pre.status === 'paused') {
    await db.from('businesses').update({ subscription_status: 'past_due' }).eq('id', biz.id)
    return 'paused'
  }

  return 'ignored'
}

// Notificación "subscription_authorized_payment": se intentó el cobro mensual.
export async function applyAuthorizedPayment(
  db: Db,
  ap: MpAuthorizedPayment,
  pre: MpPreapproval,
  deps: { now?: Date } = {},
): Promise<string> {
  const now = deps.now ?? new Date()
  const biz = await findBusiness(db, ap.preapproval_id, pre.external_reference)
  if (!biz) return 'no-business'
  const ref = parseExternalReference(pre.external_reference)
  const paymentId = ap.payment?.id != null ? String(ap.payment.id) : null
  const paymentStatus = ap.payment?.status
  const amount = ap.transaction_amount != null ? Math.round(ap.transaction_amount) : null

  const alreadyLogged = async (status: string) => {
    if (!paymentId) return false
    const { data } = await db.from('payment_events').select('id').eq('mp_payment_id', paymentId).eq('status', status).maybeSingle()
    return !!data
  }

  if (paymentStatus === 'approved') {
    if (await alreadyLogged('approved')) return 'duplicate'
    // Si el cliente ya canceló, un cobro que se procesó tarde no debe reactivar el plan.
    const cancelled = biz.subscription_status === 'pending_cancel' || biz.subscription_status === 'canceled'
    if (!cancelled) {
      await db.from('businesses').update({
        ...(ref ? { plan: ref.plan } : {}),
        subscription_status: 'active',
        mp_preapproval_id: ap.preapproval_id,
        subscription_end_date: computePeriodEnd(pre.next_payment_date, now).toISOString(),
      }).eq('id', biz.id)
    }
    await db.from('payment_events').insert({
      business_id: biz.id, mp_payment_id: paymentId, mp_preapproval_id: ap.preapproval_id,
      event_type: 'payment_success', plan_slug: ref?.plan ?? biz.plan, amount_cop: amount, status: 'approved',
    })
    return cancelled ? 'approved-after-cancel' : 'renewed'
  }

  if (paymentStatus === 'rejected' || paymentStatus === 'cancelled' || ap.status === 'recycling') {
    const status = paymentStatus ?? 'recycling'
    if (await alreadyLogged(status)) return 'duplicate'
    if (biz.subscription_status === 'active') {
      await db.from('businesses').update({ subscription_status: 'past_due' }).eq('id', biz.id)
    }
    await db.from('payment_events').insert({
      business_id: biz.id, mp_payment_id: paymentId, mp_preapproval_id: ap.preapproval_id,
      event_type: 'payment_failed', plan_slug: ref?.plan ?? biz.plan, amount_cop: amount, status,
    })
    return 'payment-failed'
  }

  return 'ignored'
}

// Cron: baja a Free los negocios cuyo periodo pagado ya terminó.
//  - pending_cancel: el cliente canceló; pierde el plan al llegar la fecha de corte.
//  - past_due: el cobro falló; se le da PAST_DUE_GRACE_DAYS días extra mientras MP reintenta.
export async function findExpiredBusinessIds(db: Db, now = new Date()): Promise<{ ids: string[]; error: boolean }> {
  const pastDueCutoff = new Date(now.getTime() - PAST_DUE_GRACE_DAYS * DAY_MS).toISOString()
  const [cancelled, pastDue] = await Promise.all([
    db.from('businesses').select('id').eq('subscription_status', 'pending_cancel').lt('subscription_end_date', now.toISOString()),
    db.from('businesses').select('id').eq('subscription_status', 'past_due').lt('subscription_end_date', pastDueCutoff),
  ])
  if (cancelled.error || pastDue.error) return { ids: [], error: true }
  return { ids: [...(cancelled.data ?? []), ...(pastDue.data ?? [])].map((b) => b.id), error: false }
}
