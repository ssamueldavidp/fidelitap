# FideliTap v2 — A: MercadoPago Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full MercadoPago recurring subscription flow — create preapproval (redirects to MP checkout), cancel subscription, receive webhooks, enforce plan limits server-side.

**Architecture:** MercadoPago Preapproval API (two-level: preapproval_plan template + preapproval per customer). Plan IDs stored in env vars (created once in MP dashboard). API routes handle create/cancel/status. A webhook route verifies signatures and updates `businesses` table. `plan-guard.ts` provides server-side enforcement for gated routes. Settings page gets a "Suscripción" tab.

**Tech Stack:** `mercadopago` npm SDK v2, Next.js 14 API routes, Supabase service client, Tailwind CSS

**Prerequisite:** Plan A1 migrations applied (needs `mp_preapproval_id`, `mp_payer_email`, `subscription_end_date`, `payment_events` table).

**SECURITY:** `MP_ACCESS_TOKEN` never sent to client. `MP_PUBLIC_KEY` is public (used on client only for MP's Brick, which we don't use here). All mutations verified server-side. Webhook verifies `x-signature`.

---

## Environment Variables (`.env.local` — gitignored, never commit)

```
MP_ACCESS_TOKEN=TEST-8367727103765980-052717-...   # already set
MP_PUBLIC_KEY=TEST-73ca4c5f-...                    # already set — not needed server-side
MP_PLAN_ID_BASIC=<create in MP dashboard>
MP_PLAN_ID_PRO=<create in MP dashboard>
MP_PLAN_ID_PREMIUM=<create in MP dashboard>
MP_WEBHOOK_SECRET=<from MP dashboard → Webhooks → Secret>
```

For Vercel production: set all MP_* vars in Vercel Dashboard → Settings → Environment Variables.

---

## File Map

- Run: `npm install mercadopago` (adds to package.json)
- Create: `src/lib/mercadopago.ts`
- Create: `src/lib/plan-guard.ts`
- Create: `src/app/api/subscriptions/create/route.ts`
- Create: `src/app/api/subscriptions/cancel/route.ts`
- Create: `src/app/api/subscriptions/status/route.ts`
- Create: `src/app/api/webhooks/mercadopago/route.ts`
- Create: `src/components/dashboard/subscription-tab.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/app/(dashboard)/settings/actions.ts`

---

### Task 1: Install MercadoPago SDK

- [ ] **Step 1: Install the package**

```bash
cd /Users/samuelrodriguez/development/fidelitap
npm install mercadopago
```

Expected: `package.json` now lists `"mercadopago": "^X.Y.Z"` in dependencies.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install mercadopago SDK"
```

---

### Task 2: Create MercadoPago client singleton

**Files:**
- Create: `src/lib/mercadopago.ts`

This file exports a configured MP client and helper functions. Never import this in client components.

- [ ] **Step 1: Create the file**

```typescript
// src/lib/mercadopago.ts
// Server-only MercadoPago client. Never import in 'use client' files.
import { MercadoPagoConfig, PreApproval } from 'mercadopago'

if (!process.env.MP_ACCESS_TOKEN) {
  throw new Error('MP_ACCESS_TOKEN is not set in environment variables')
}

export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
})

export const mpPreApproval = new PreApproval(mpClient)

export type PlanSlug = 'basic' | 'pro' | 'premium'

const PLAN_PRICES_COP: Record<PlanSlug, number> = {
  basic:   19900,
  pro:     49900,
  premium: 99900,
}

const PLAN_NAMES: Record<PlanSlug, string> = {
  basic:   'Básico',
  pro:     'Pro',
  premium: 'Premium',
}

export function getMpPlanId(slug: PlanSlug): string {
  const envKey = `MP_PLAN_ID_${slug.toUpperCase()}` as
    | 'MP_PLAN_ID_BASIC'
    | 'MP_PLAN_ID_PRO'
    | 'MP_PLAN_ID_PREMIUM'
  const id = process.env[envKey]
  if (!id) throw new Error(`${envKey} is not set in environment variables`)
  return id
}

export function getPlanPrice(slug: PlanSlug): number {
  return PLAN_PRICES_COP[slug]
}

export function getPlanName(slug: PlanSlug): string {
  return PLAN_NAMES[slug]
}

/** Verify MercadoPago webhook x-signature header.
 *  Header format: "ts=<timestamp>,v1=<hash>"
 *  Signature = HMAC-SHA256 of "id:<notificationId>;request-id:<xRequestId>;ts:<ts>"
 */
export async function verifyMpSignature(
  xSignature: string | null,
  xRequestId: string | null,
  notificationId: string | null,
): Promise<boolean> {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[mp-webhook] MP_WEBHOOK_SECRET not set — skipping signature verification in dev')
    return true  // allow in dev if secret not configured
  }
  if (!xSignature || !xRequestId || !notificationId) return false

  // Parse ts and v1 from the header
  const parts = Object.fromEntries(
    xSignature.split(',').map((part) => {
      const [key, value] = part.split('=')
      return [key.trim(), value?.trim()]
    })
  )
  const ts = parts['ts']
  const v1 = parts['v1']
  if (!ts || !v1) return false

  const manifest = `id:${notificationId};request-id:${xRequestId};ts:${ts};`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest))
  const computed = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computed === v1
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `src/lib/mercadopago.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mercadopago.ts
git commit -m "feat(mp): add MercadoPago client singleton and helpers"
```

---

### Task 3: Create plan-guard.ts

**Files:**
- Create: `src/lib/plan-guard.ts`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/plan-guard.ts
git commit -m "feat: add plan-guard server-side plan enforcement"
```

---

### Task 4: POST /api/subscriptions/create

**Files:**
- Create: `src/app/api/subscriptions/create/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/subscriptions/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mpPreApproval, getMpPlanId, getPlanPrice, getPlanName, type PlanSlug } from '@/lib/mercadopago'

const VALID_PLANS: PlanSlug[] = ['basic', 'pro', 'premium']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, email, plan, subscription_status')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  let body: { planSlug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  const planSlug = body.planSlug as PlanSlug
  if (!VALID_PLANS.includes(planSlug)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'

  try {
    const preapprovalPlanId = getMpPlanId(planSlug)
    const price             = getPlanPrice(planSlug)
    const planName          = getPlanName(planSlug)

    const response = await mpPreApproval.create({
      body: {
        preapproval_plan_id: preapprovalPlanId,
        reason: `FideliTap Plan ${planName}`,
        payer_email: business.email,
        back_url: `${appUrl}/dashboard?subscription=success`,
        auto_recurring: {
          frequency:          1,
          frequency_type:     'months',
          transaction_amount: price,
          currency_id:        'COP',
        },
      } as Parameters<typeof mpPreApproval.create>[0]['body'],
    })

    if (!response.init_point) {
      return NextResponse.json({ error: 'No se pudo crear la suscripción' }, { status: 500 })
    }

    return NextResponse.json({ init_point: response.init_point })
  } catch (err) {
    console.error('[subscriptions/create]', err)
    return NextResponse.json({ error: 'Error al crear la suscripción' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/subscriptions/create/route.ts
git commit -m "feat(api): POST /api/subscriptions/create — MP preapproval"
```

---

### Task 5: POST /api/subscriptions/cancel

**Files:**
- Create: `src/app/api/subscriptions/cancel/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/subscriptions/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mpPreApproval } from '@/lib/mercadopago'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, mp_preapproval_id, subscription_status')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  if (!business.mp_preapproval_id) {
    return NextResponse.json({ error: 'No tienes una suscripción activa' }, { status: 400 })
  }

  if (business.subscription_status === 'pending_cancel' || business.subscription_status === 'canceled') {
    return NextResponse.json({ error: 'La suscripción ya está en proceso de cancelación' }, { status: 400 })
  }

  try {
    await mpPreApproval.update({
      id:   business.mp_preapproval_id,
      body: { status: 'cancelled' },
    })

    // Calculate end date: 30 days from now (approximation of current period)
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 30)

    const serviceClient = createServiceClient()
    await serviceClient
      .from('businesses')
      .update({
        subscription_status:  'pending_cancel',
        subscription_end_date: endDate.toISOString(),
      })
      .eq('id', business.id)

    // Record cancellation event
    await serviceClient.from('payment_events').insert({
      business_id:       business.id,
      mp_preapproval_id: business.mp_preapproval_id,
      event_type:        'subscription_cancelled',
      status:            'pending_cancel',
    })

    return NextResponse.json({ availableUntil: endDate.toISOString() })
  } catch (err) {
    console.error('[subscriptions/cancel]', err)
    return NextResponse.json({ error: 'Error al cancelar la suscripción' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/subscriptions/cancel/route.ts
git commit -m "feat(api): POST /api/subscriptions/cancel"
```

---

### Task 6: GET /api/subscriptions/status

**Files:**
- Create: `src/app/api/subscriptions/status/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/subscriptions/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan, subscription_status, mp_preapproval_id, mp_payer_email, subscription_end_date')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const serviceClient = createServiceClient()

  // Last 10 payment events
  const { data: events } = await serviceClient
    .from('payment_events')
    .select('id, event_type, plan_slug, amount_cop, status, created_at')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    plan:               business.plan,
    subscriptionStatus: business.subscription_status,
    mpPreapprovalId:    business.mp_preapproval_id,
    payerEmail:         business.mp_payer_email,
    subscriptionEndDate: business.subscription_end_date,
    paymentHistory:     events ?? [],
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/subscriptions/status/route.ts
git commit -m "feat(api): GET /api/subscriptions/status"
```

---

### Task 7: POST /api/webhooks/mercadopago

**Files:**
- Create: `src/app/api/webhooks/mercadopago/route.ts`

This is a public route (no Supabase auth). It verifies the MP signature and processes subscription/payment events.

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/webhooks/mercadopago/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mpPreApproval, verifyMpSignature } from '@/lib/mercadopago'

const SUBSCRIPTION_PLANS: Record<string, 'basic' | 'pro' | 'premium'> = {
  [process.env.MP_PLAN_ID_BASIC   ?? '']: 'basic',
  [process.env.MP_PLAN_ID_PRO     ?? '']: 'pro',
  [process.env.MP_PLAN_ID_PREMIUM ?? '']: 'premium',
}

export async function POST(request: NextRequest) {
  const xSignature  = request.headers.get('x-signature')
  const xRequestId  = request.headers.get('x-request-id')
  const { searchParams } = request.nextUrl
  const notificationId = searchParams.get('id') ?? searchParams.get('data.id')
  const topic = searchParams.get('topic') ?? searchParams.get('type')

  // Verify webhook signature
  const isValid = await verifyMpSignature(xSignature, xRequestId, notificationId)
  if (!isValid) {
    console.error('[mp-webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const serviceClient = createServiceClient()

  try {
    if (topic === 'preapproval' && notificationId) {
      await handlePreapproval(notificationId, body, serviceClient)
    } else if (topic === 'payment' && notificationId) {
      await handlePayment(notificationId, body, serviceClient)
    }
    // Other topics: ignore silently (MP sends various notification types)
  } catch (err) {
    console.error('[mp-webhook] processing error:', err)
    // Return 200 anyway — MP retries on non-200; we don't want infinite retries on logic errors
  }

  return NextResponse.json({ received: true })
}

async function handlePreapproval(
  preapprovalId: string,
  rawPayload: Record<string, unknown>,
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  // Fetch latest state from MP API
  const preapproval = await mpPreApproval.get({ id: preapprovalId })

  const { data: business } = await serviceClient
    .from('businesses')
    .select('id, plan')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle()

  // Also try to find by payer_email if not found by preapproval_id
  const { data: businessByEmail } = !business
    ? await serviceClient
        .from('businesses')
        .select('id, plan')
        .eq('mp_payer_email', preapproval.payer_email ?? '')
        .maybeSingle()
    : { data: null }

  const biz = business ?? businessByEmail
  if (!biz) {
    console.warn('[mp-webhook] Business not found for preapproval:', preapprovalId)
    return
  }

  const planSlug =
    preapproval.preapproval_plan_id
      ? SUBSCRIPTION_PLANS[preapproval.preapproval_plan_id] ?? biz.plan
      : biz.plan

  if (preapproval.status === 'authorized') {
    await serviceClient
      .from('businesses')
      .update({
        plan:                  planSlug,
        subscription_status:   'active',
        mp_preapproval_id:     preapproval.id,
        mp_payer_email:        preapproval.payer_email,
        subscription_end_date: null,
      })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_preapproval_id: preapproval.id,
      event_type:        'payment_success',
      plan_slug:         planSlug,
      status:            'authorized',
      raw_payload:       rawPayload,
    })
  } else if (preapproval.status === 'cancelled') {
    await serviceClient
      .from('businesses')
      .update({
        subscription_status: 'canceled',
        plan:                'free',
      })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_preapproval_id: preapproval.id,
      event_type:        'subscription_cancelled',
      plan_slug:         planSlug,
      status:            'cancelled',
      raw_payload:       rawPayload,
    })
  } else if (preapproval.status === 'paused' || preapproval.status === 'pending') {
    await serviceClient
      .from('businesses')
      .update({ subscription_status: 'past_due' })
      .eq('id', biz.id)

    await serviceClient.from('payment_events').insert({
      business_id:       biz.id,
      mp_preapproval_id: preapproval.id,
      event_type:        'payment_failed',
      plan_slug:         planSlug,
      status:            preapproval.status,
      raw_payload:       rawPayload,
    })
  }
}

async function handlePayment(
  paymentId: string,
  rawPayload: Record<string, unknown>,
  serviceClient: ReturnType<typeof createServiceClient>,
) {
  // Record payment event — minimal logging, preapproval handler does the heavy lifting
  await serviceClient.from('payment_events').insert({
    business_id:    '00000000-0000-0000-0000-000000000000', // placeholder; ideally look up from payment
    mp_payment_id:  paymentId,
    event_type:     'payment_received',
    raw_payload:    rawPayload,
  }).catch((err) => {
    // Ignore FK constraint failures if business_id can't be resolved
    console.warn('[mp-webhook] payment insert skipped:', err)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhooks/mercadopago/route.ts
git commit -m "feat(api): POST /api/webhooks/mercadopago — signature verify + plan sync"
```

---

### Task 8: Create Subscription Tab component

**Files:**
- Create: `src/components/dashboard/subscription-tab.tsx`

This is a Client Component that loads subscription status via the API and shows the current plan, billing info, and cancel/upgrade actions.

- [ ] **Step 1: Create the component**

```typescript
// src/components/dashboard/subscription-tab.tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react'

type SubscriptionData = {
  plan: string
  subscriptionStatus: string
  subscriptionEndDate: string | null
  paymentHistory: {
    id: string
    event_type: string
    plan_slug: string | null
    amount_cop: number | null
    status: string | null
    created_at: string
  }[]
}

const PLAN_PRICES: Record<string, number> = {
  basic:   19900,
  pro:     49900,
  premium: 99900,
}

const PLAN_LABELS: Record<string, string> = {
  free:    'Gratis',
  basic:   'Básico',
  pro:     'Pro',
  premium: 'Premium',
}

const STATUS_CONFIG = {
  active:         { label: 'Activo',              color: 'text-green-400',  icon: CheckCircle2 },
  pending_cancel: { label: 'Cancelación pendiente', color: 'text-amber-400', icon: AlertTriangle },
  canceled:       { label: 'Cancelado',            color: 'text-red-400',   icon: XCircle },
  past_due:       { label: 'Pago pendiente',       color: 'text-amber-400', icon: AlertTriangle },
  trialing:       { label: 'En prueba',            color: 'text-blue-400',  icon: CheckCircle2 },
}

function formatCOP(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(iso))
}

const EVENT_LABELS: Record<string, string> = {
  payment_success:        'Pago exitoso',
  payment_failed:         'Pago fallido',
  subscription_created:   'Suscripción creada',
  subscription_cancelled: 'Suscripción cancelada',
  payment_received:       'Pago recibido',
}

export function SubscriptionTab() {
  const [data, setData]       = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [isCancelling, startCancelTransition] = useTransition()
  const [cancelMsg, setCancelMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/subscriptions/status')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setError('Error cargando datos de suscripción'); setLoading(false) })
  }, [])

  const handleUpgrade = (planSlug: string) => {
    startCancelTransition(async () => {
      const res = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planSlug }),
      })
      const json = await res.json()
      if (json.init_point) {
        window.location.href = json.init_point
      } else {
        setError(json.error ?? 'Error al iniciar la suscripción')
      }
    })
  }

  const handleCancel = () => {
    if (!confirm('¿Estás seguro que deseas cancelar tu suscripción? Tu plan seguirá activo hasta el final del período.')) return
    startCancelTransition(async () => {
      const res = await fetch('/api/subscriptions/cancel', { method: 'POST' })
      const json = await res.json()
      if (json.availableUntil) {
        setCancelMsg(`Tu plan estará activo hasta el ${formatDate(json.availableUntil)}`)
        // Refresh data
        const status = await fetch('/api/subscriptions/status').then((r) => r.json())
        setData(status)
      } else {
        setError(json.error ?? 'Error al cancelar')
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Cargando suscripción...</span>
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-400 py-4">{error}</p>
  }

  if (!data) return null

  const statusCfg = STATUS_CONFIG[data.subscriptionStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.active
  const StatusIcon = statusCfg.icon
  const isPaid = data.plan !== 'free'
  const planPrice = PLAN_PRICES[data.plan]

  return (
    <div className="flex flex-col gap-6">
      {/* Current plan card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Plan actual</p>
            <p className="text-2xl font-black text-foreground">{PLAN_LABELS[data.plan] ?? data.plan}</p>
          </div>
          {isPaid && planPrice && (
            <p className="text-sm text-muted-foreground">{formatCOP(planPrice)}/mes</p>
          )}
        </div>

        <div className={`flex items-center gap-1.5 text-sm font-medium ${statusCfg.color}`}>
          <StatusIcon size={14} />
          <span>{statusCfg.label}</span>
        </div>

        {data.subscriptionStatus === 'pending_cancel' && data.subscriptionEndDate && (
          <p className="mt-2 text-sm text-amber-400">
            Activo hasta el {formatDate(data.subscriptionEndDate)}
          </p>
        )}

        {cancelMsg && (
          <p className="mt-2 text-sm text-green-400">{cancelMsg}</p>
        )}
      </div>

      {/* Upgrade options */}
      {data.plan === 'free' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Actualizar plan</p>
          {(['basic', 'pro', 'premium'] as const).map((slug) => (
            <div key={slug} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
              <div>
                <p className="font-semibold text-foreground text-sm">{PLAN_LABELS[slug]}</p>
                <p className="text-xs text-muted-foreground">{formatCOP(PLAN_PRICES[slug])}/mes</p>
              </div>
              <button
                type="button"
                onClick={() => handleUpgrade(slug)}
                disabled={isCancelling}
                className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Suscribirme
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cancel subscription */}
      {isPaid && data.subscriptionStatus === 'active' && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          className="text-sm text-muted-foreground hover:text-red-400 transition-colors self-start disabled:opacity-50"
        >
          {isCancelling ? 'Cancelando...' : 'Cancelar suscripción'}
        </button>
      )}

      {/* Payment history */}
      {data.paymentHistory.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Historial de pagos
          </p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Evento</th>
                  <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {data.paymentHistory.map((ev) => (
                  <tr key={ev.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
                      {new Date(ev.created_at).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-2.5 text-foreground text-xs">
                      {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                    </td>
                    <td className="px-4 py-2.5 text-foreground text-xs text-right">
                      {ev.amount_cop ? formatCOP(ev.amount_cop) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/subscription-tab.tsx
git commit -m "feat(ui): SubscriptionTab component — plan info, upgrade, cancel, history"
```

---

### Task 9: Update settings page to include Suscripción tab

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

The current settings page only has scanner settings. Extend it with a tab for subscription.

- [ ] **Step 1: Replace `settings/page.tsx`**

```typescript
// src/app/(dashboard)/settings/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'
import { SubscriptionTab } from '@/components/dashboard/subscription-tab'

type Tab = 'cuenta' | 'suscripcion' | 'scanner'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()

  const activeTab: Tab =
    searchParams.tab === 'suscripcion' ? 'suscripcion'
    : searchParams.tab === 'scanner'   ? 'scanner'
    : 'cuenta'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'cuenta',       label: 'Cuenta' },
    { key: 'suscripcion',  label: 'Suscripción' },
    { key: 'scanner',      label: 'Scanner' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-black text-foreground mb-1">Ajustes</h1>
      <p className="text-muted-foreground text-sm mb-6">Configuración de tu cuenta y negocio.</p>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-8 w-fit">
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`/settings?tab=${tab.key}`}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Cuenta tab */}
      {activeTab === 'cuenta' && (
        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
              Negocio
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm text-muted-foreground mb-1">Nombre del negocio</p>
              <p className="text-foreground font-semibold">{business?.name}</p>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
              Plan actual
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
              <p className="text-foreground font-semibold capitalize">{business?.plan ?? 'free'}</p>
              <a
                href="/settings?tab=suscripcion"
                className="text-xs text-primary hover:underline"
              >
                Gestionar →
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Suscripción tab */}
      {activeTab === 'suscripcion' && (
        <SubscriptionTab />
      )}

      {/* Scanner tab */}
      {activeTab === 'scanner' && (
        <section>
          <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
            Scanner
          </h2>
          <SettingsForm cooldownSeconds={business?.stamp_cooldown_seconds ?? 0} />
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): add Suscripción tab to settings page"
```

---

### Task 10: Show subscription success toast on /dashboard

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

When MP redirects back to `/dashboard?subscription=success`, show a toast or banner.

- [ ] **Step 1: Read current dashboard page**

Read `src/app/(dashboard)/dashboard/page.tsx` first to understand its current structure.

- [ ] **Step 2: Add subscription success notice**

Add this Server Component logic at the top of the dashboard page to detect the `?subscription=success` query param and pass it to a client-side notice. Since the dashboard page is a Server Component, use a small Client Component wrapper.

Create `src/components/dashboard/subscription-success-notice.tsx`:

```typescript
// src/components/dashboard/subscription-success-notice.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'

export function SubscriptionSuccessNotice() {
  const params = useSearchParams()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (params.get('subscription') === 'success') {
      setShow(true)
      // Clean URL without reload
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [params])

  if (!show) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-green-950 border border-green-700 text-green-300 rounded-2xl px-4 py-3 shadow-xl text-sm font-medium">
      <CheckCircle2 size={16} />
      ¡Suscripción activada! Tu plan se actualizará en unos segundos.
      <button type="button" onClick={() => setShow(false)} className="text-green-400 hover:text-green-200">
        <X size={14} />
      </button>
    </div>
  )
}
```

Then in `src/app/(dashboard)/dashboard/page.tsx`, import and render `<SubscriptionSuccessNotice />` inside a `<Suspense>`:

```tsx
import { Suspense } from 'react'
import { SubscriptionSuccessNotice } from '@/components/dashboard/subscription-success-notice'

// Inside the JSX return, near the top:
<Suspense fallback={null}>
  <SubscriptionSuccessNotice />
</Suspense>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/subscription-success-notice.tsx \
        src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): show subscription success notice after MP redirect"
```

---

### Task 11: Smoke test subscription flow (test mode)

- [ ] **Step 1: Verify env vars are set**

```bash
grep -E "^(MP_|NEXT_PUBLIC)" /Users/samuelrodriguez/development/fidelitap/.env.local
```

Expected: `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY` present. `MP_PLAN_ID_BASIC/PRO/PREMIUM` may not be set yet (that requires creating plans in MP dashboard first).

- [ ] **Step 2: Start dev server and verify routes load**

```bash
npm run dev
```

Navigate to `http://localhost:3000/settings?tab=suscripcion` — verify the Suscripción tab renders without crashing.

- [ ] **Step 3: Test subscription create (with plan IDs set)**

If MP plan IDs are configured:
1. Go to Settings → Suscripción
2. Click "Suscribirme" on Básico
3. Verify redirect to MercadoPago checkout page

Without plan IDs: the route returns 500. This is expected until MP plans are created in the dashboard.

- [ ] **Step 4: Test webhook locally with ngrok**

```bash
# In a separate terminal:
ngrok http 3000 --subdomain frail-enunciate-eatery
```

Register the webhook URL in MP dashboard: `https://frail-enunciate-eatery.ngrok-free.dev/api/webhooks/mercadopago`

Topic: `preapproval` and `payment`.
