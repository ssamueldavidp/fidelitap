// Pruebas de la lógica de suscripciones contra la base de Supabase local.
// Correr: pnpm test:subscriptions  (requiere `supabase start` y .env.local)
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import {
  applyPreapproval, applyAuthorizedPayment, computePeriodEnd, findExpiredBusinessIds, parseExternalReference,
} from './apply'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
type Biz = Database['public']['Tables']['businesses']['Row']
type Event = Database['public']['Tables']['payment_events']['Row']

const DAY = 86_400_000
const BIZ_EMAIL = 'owner-free@demo.co'
let bizId = ''
let original: Pick<Biz, 'plan' | 'subscription_status' | 'subscription_end_date' | 'mp_preapproval_id'>
const cancelled: string[] = []
const deps = { cancelOldSubscription: async (id: string) => { cancelled.push(id) } }

const ref = () => `${bizId}:pro`
const pre = (over: Record<string, unknown> = {}) => ({ id: 'pre-A', status: 'authorized', external_reference: ref(), next_payment_date: null, ...over })
async function biz(): Promise<Biz> {
  const { data } = await db.from('businesses').select('*').eq('id', bizId).single()
  assert.ok(data)
  return data
}
async function events(type: string): Promise<Event[]> {
  const { data } = await db.from('payment_events').select('*').eq('business_id', bizId).eq('event_type', type)
  return data ?? []
}

before(async () => {
  const { data } = await db.from('businesses').select('*').eq('email', BIZ_EMAIL).single()
  assert.ok(data, 'falta el negocio semilla owner-free@demo.co (supabase db reset)')
  bizId = data.id
  original = {
    plan: data.plan, subscription_status: data.subscription_status,
    subscription_end_date: data.subscription_end_date, mp_preapproval_id: data.mp_preapproval_id,
  }
})

beforeEach(async () => {
  cancelled.length = 0
  await db.from('payment_events').delete().eq('business_id', bizId)
  await db.from('businesses').update({ plan: 'free', subscription_status: 'active', subscription_end_date: null, mp_preapproval_id: null }).eq('id', bizId)
})

after(async () => {
  await db.from('payment_events').delete().eq('business_id', bizId)
  await db.from('businesses').update(original).eq('id', bizId)
})

test('parseExternalReference solo acepta planes pagos', () => {
  assert.deepEqual(parseExternalReference('abc:pro'), { businessId: 'abc', plan: 'pro' })
  assert.equal(parseExternalReference('abc:free'), null)
  assert.equal(parseExternalReference('sin-dos-puntos'), null)
  assert.equal(parseExternalReference(null), null)
})

test('computePeriodEnd: usa el próximo cobro si está lejos, si no un ciclo de 30 días', () => {
  const now = new Date('2026-10-11T12:00:00Z')
  assert.equal(computePeriodEnd('2026-11-10T12:00:00Z', now).toISOString(), '2026-11-10T12:00:00.000Z')
  assert.equal(computePeriodEnd('2026-10-11T13:00:00Z', now).toISOString(), new Date(now.getTime() + 30 * DAY).toISOString())
  assert.equal(computePeriodEnd(null, now).toISOString(), new Date(now.getTime() + 30 * DAY).toISOString())
})

test('suscripción autorizada activa el plan con fecha de corte y registra el evento una vez', async () => {
  const next = new Date(Date.now() + 29 * DAY).toISOString()
  assert.equal(await applyPreapproval(db, pre({ next_payment_date: next }), deps), 'activated')
  const b = await biz()
  assert.equal(b.plan, 'pro')
  assert.equal(b.subscription_status, 'active')
  assert.equal(b.mp_preapproval_id, 'pre-A')
  assert.equal(new Date(b.subscription_end_date ?? 0).toISOString(), new Date(next).toISOString())
  await applyPreapproval(db, pre({ next_payment_date: next }), deps)
  assert.equal((await events('subscription_created')).length, 1)
})

test('renovación mensual aprobada extiende la fecha de corte y no se duplica', async () => {
  await applyPreapproval(db, pre(), deps)
  const next = new Date(Date.now() + 30 * DAY).toISOString()
  const ap = { id: 1, preapproval_id: 'pre-A', status: 'processed', transaction_amount: 99900, payment: { id: 777, status: 'approved' } }
  assert.equal(await applyAuthorizedPayment(db, ap, pre({ next_payment_date: next })), 'renewed')
  const b = await biz()
  assert.equal(new Date(b.subscription_end_date ?? 0).toISOString(), new Date(next).toISOString())
  const ev = await events('payment_success')
  assert.equal(ev.length, 1)
  assert.equal(ev[0].amount_cop, 99900)
  assert.equal(await applyAuthorizedPayment(db, ap, pre({ next_payment_date: next })), 'duplicate')
  assert.equal((await events('payment_success')).length, 1)
})

test('cobro rechazado pasa a past_due y un cobro posterior aprobado lo recupera', async () => {
  await applyPreapproval(db, pre(), deps)
  const bad = { id: 2, preapproval_id: 'pre-A', status: 'recycling', transaction_amount: 99900, payment: { id: 800, status: 'rejected' } }
  assert.equal(await applyAuthorizedPayment(db, bad, pre()), 'payment-failed')
  assert.equal((await biz()).subscription_status, 'past_due')
  assert.equal((await events('payment_failed')).length, 1)
  const good = { id: 2, preapproval_id: 'pre-A', status: 'processed', transaction_amount: 99900, payment: { id: 801, status: 'approved' } }
  await applyAuthorizedPayment(db, good, pre({ next_payment_date: new Date(Date.now() + 30 * DAY).toISOString() }))
  assert.equal((await biz()).subscription_status, 'active')
})

test('cambio de plan cancela la suscripción anterior y deja la nueva', async () => {
  await applyPreapproval(db, pre(), deps)
  const upgraded = pre({ id: 'pre-B', external_reference: `${bizId}:premium` })
  assert.equal(await applyPreapproval(db, upgraded, deps), 'activated')
  assert.deepEqual(cancelled, ['pre-A'])
  const b = await biz()
  assert.equal(b.plan, 'premium')
  assert.equal(b.mp_preapproval_id, 'pre-B')
  // El aviso de "cancelada" de la suscripción vieja no debe tocar el plan nuevo.
  assert.equal(await applyPreapproval(db, pre({ status: 'cancelled' }), deps), 'ignored-other-subscription')
  assert.equal((await biz()).subscription_status, 'active')
})

test('cancelar deja el plan hasta la fecha de corte; un cobro tardío no lo reactiva', async () => {
  const next = new Date(Date.now() + 20 * DAY).toISOString()
  await applyPreapproval(db, pre({ next_payment_date: next }), deps)
  assert.equal(await applyPreapproval(db, pre({ status: 'cancelled' }), deps), 'cancelled')
  const b = await biz()
  assert.equal(b.subscription_status, 'pending_cancel')
  assert.equal(b.plan, 'pro')
  assert.equal(new Date(b.subscription_end_date ?? 0).toISOString(), new Date(next).toISOString())
  assert.equal(await applyPreapproval(db, pre({ status: 'cancelled' }), deps), 'already-cancelled')
  const late = { id: 3, preapproval_id: 'pre-A', status: 'processed', payment: { id: 900, status: 'approved' } }
  assert.equal(await applyAuthorizedPayment(db, late, pre()), 'approved-after-cancel')
  assert.equal((await biz()).subscription_status, 'pending_cancel')
})

test('vencimiento: cancelados al llegar la fecha de corte, impagos tras 3 días de gracia', async () => {
  const set = (status: string, daysAgo: number) =>
    db.from('businesses').update({ plan: 'pro', subscription_status: status, subscription_end_date: new Date(Date.now() - daysAgo * DAY).toISOString() }).eq('id', bizId)
  const isExpired = async () => (await findExpiredBusinessIds(db)).ids.includes(bizId)

  await set('pending_cancel', 1); assert.equal(await isExpired(), true)
  await set('pending_cancel', -5); assert.equal(await isExpired(), false)
  await set('past_due', 1); assert.equal(await isExpired(), false)
  await set('past_due', 4); assert.equal(await isExpired(), true)
  await set('active', 10); assert.equal(await isExpired(), false)
})
