# Push Notifications & Campañas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Web Push notifications (stamp-progress alerts, 14-day re-engagement reminders, and business-configured marketing campaigns) exclusive to Pro/Premium plans, per `docs/superpowers/specs/2026-06-25-push-notifications-design.md`.

**Architecture:** Web Push API (VAPID) + a Service Worker (`public/sw.js`) for delivery; Supabase `pg_cron`/`pg_net` to dispatch scheduled campaigns and daily re-engagement checks; plan-gating enforced server-side at every send point, not just in the UI.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + pg_cron + pg_net), `web-push` npm package, TypeScript, Tailwind.

**Testing note:** This repository has no automated test framework configured (no Jest/Vitest, confirmed via `package.json` and a repo-wide search). Adding one is out of scope for this feature (YAGNI). Each task below is verified with `pnpm tsc --noEmit` (type safety) plus a manual `curl`/browser check described in the task — not automated unit tests.

---

### Task 1: Database migration — tables, columns, RLS

**Files:**
- Create: `supabase/migrations/20260625000000_push_subscriptions_and_campaigns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260625000000_push_subscriptions_and_campaigns.sql
-- Web Push subscriptions + business marketing campaigns (Pro/Premium only)

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_card_id uuid not null references public.customer_cards(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
create index push_subscriptions_customer_card_id_idx on public.push_subscriptions (customer_card_id);
create index push_subscriptions_business_active_idx on public.push_subscriptions (business_id) where active;

alter table public.push_subscriptions enable row level security;

-- Inserts/updates happen only via the service role (API routes use createServiceClient()
-- after validating wallet_auth_token), so only a read policy is needed for the dashboard.
create policy "push_subscriptions: owner can read own business subscriptions"
  on public.push_subscriptions for select
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create table public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  loyalty_card_id uuid references public.loyalty_cards(id) on delete cascade, -- null = todas las tarjetas
  title text not null,
  body text not null,
  scheduled_at timestamptz, -- null = enviar inmediatamente al crear
  sent_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','failed')),
  recipients_count int,
  created_at timestamptz not null default now()
);

create index push_campaigns_business_id_idx on public.push_campaigns (business_id);
create index push_campaigns_pending_idx on public.push_campaigns (status, scheduled_at) where status = 'scheduled';

alter table public.push_campaigns enable row level security;

create policy "push_campaigns: owner can read own"
  on public.push_campaigns for select
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "push_campaigns: owner can insert"
  on public.push_campaigns for insert
  with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "push_campaigns: owner can update own"
  on public.push_campaigns for update
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

alter table public.loyalty_cards
  add column push_notify_threshold int not null default 1;

alter table public.customer_cards
  add column near_completion_notified_at timestamptz,
  add column last_stamp_at timestamptz,
  add column reengagement_sent_at timestamptz;
```

- [ ] **Step 2: Apply the migration locally**

Run: `pnpm supabase migration up`
Expected: output ends with `Applying migration 20260625000000_push_subscriptions_and_campaigns.sql...` and no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260625000000_push_subscriptions_and_campaigns.sql
git commit -m "feat(db): add push_subscriptions, push_campaigns tables and notification columns"
```

---

### Task 2: Database migration — pg_cron jobs

**Files:**
- Create: `supabase/migrations/20260625000001_push_cron_jobs.sql`

- [ ] **Step 1: Write the cron migration**

```sql
-- supabase/migrations/20260625000001_push_cron_jobs.sql
-- Schedules pg_cron jobs that dispatch scheduled campaigns and send re-engagement reminders.
--
-- IMPORTANT: app.settings.app_url and app.settings.cron_secret are NOT set by this migration
-- because the app URL changes between local/ngrok/production. After applying this migration,
-- run the ALTER DATABASE commands documented in Task 2 Step 3 of this plan, once per environment.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'dispatch-push-campaigns',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/push/campaigns/dispatch',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', current_setting('app.settings.cron_secret', true)),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'reengagement-reminders',
  '0 14 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/push/jobs/reengagement',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', current_setting('app.settings.cron_secret', true)),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 2: Apply the migration locally**

Run: `pnpm supabase migration up`
Expected: applies cleanly, no errors (the cron jobs will fail silently with a null URL until Step 3 below is run — that's expected and harmless).

- [ ] **Step 3: Configure app_url and cron_secret (manual, per environment)**

Generate a secret value first:

Run: `openssl rand -hex 32`
Expected: a 64-character hex string. Copy it — you'll reuse it in Task 4 as `CRON_SECRET`.

Open the local Postgres SQL console and run (replace the ngrok URL with your current one, and the secret with the value you just generated):

Run: `pnpm supabase db psql -- -c "alter database postgres set app.settings.app_url = 'https://your-ngrok-url.ngrok-free.dev'; alter database postgres set app.settings.cron_secret = 'paste-the-generated-secret-here'; select pg_reload_conf();"`
Expected: `ALTER DATABASE`, `ALTER DATABASE`, then a row with `pg_reload_conf = t`.

Note for later: every time the ngrok URL changes, re-run the `app.settings.app_url` ALTER DATABASE command — this mirrors the existing manual step for `NEXT_PUBLIC_APP_URL` in `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260625000001_push_cron_jobs.sql
git commit -m "feat(db): schedule pg_cron jobs for campaign dispatch and re-engagement reminders"
```

---

### Task 3: Regenerate database types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Regenerate types from the local database**

Run: `pnpm supabase gen types typescript --local > src/types/database.ts`
Expected: command exits 0, file is rewritten.

- [ ] **Step 2: Restore the custom types block at the bottom of the file**

The regeneration wipes everything after the auto-generated `Database` type. Open `src/types/database.ts`, scroll to the end, and confirm it ends with:

```typescript
} as const
```

Append this block immediately after it (this is the same block that existed before regeneration, plus two new type exports for the tables added in Task 1):

```typescript

// Helpers para tablas individuales
export type Business = Database['public']['Tables']['businesses']['Row']
export type BusinessInsert = Database['public']['Tables']['businesses']['Insert']
export type BusinessUpdate = Database['public']['Tables']['businesses']['Update']

export type LoyaltyCard = Database['public']['Tables']['loyalty_cards']['Row']
export type LoyaltyCardInsert = Database['public']['Tables']['loyalty_cards']['Insert']

export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']

export type CustomerCard = Database['public']['Tables']['customer_cards']['Row']
export type CustomerCardInsert = Database['public']['Tables']['customer_cards']['Insert']

export type StampEvent = Database['public']['Tables']['stamp_events']['Row']
export type StampEventInsert = Database['public']['Tables']['stamp_events']['Insert']

export type DeviceRegistration = Database['public']['Tables']['device_registrations']['Row']

export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row']
export type PushSubscriptionInsert = Database['public']['Tables']['push_subscriptions']['Insert']

export type PushCampaign = Database['public']['Tables']['push_campaigns']['Row']
export type PushCampaignInsert = Database['public']['Tables']['push_campaigns']['Insert']

// Design config de tarjeta con tipos fuertes
export interface CardDesignConfig {
  color: string
  bg_type: 'solid' | 'gradient' | 'image'
  bg_value: string
  bg_image_url: string | null
  stamp_icon: string
  font: 'default' | 'rounded' | 'mono'
  style: 'clean' | 'modern' | 'luxury' | 'editorial' | 'minimal'
  bg_mode: 'light' | 'dark'
  logo_url: string | null
}

export type CardStyle = CardDesignConfig['style']

export type PlanSlug = 'free' | 'basic' | 'pro' | 'premium'
```

- [ ] **Step 3: Verify the new columns exist**

Run: `grep -n "push_notify_threshold\|near_completion_notified_at\|push_subscriptions:" src/types/database.ts`
Expected: at least 3 matching lines (the new column in `loyalty_cards`, the new column in `customer_cards`, and the `push_subscriptions` table definition).

- [ ] **Step 4: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors (existing code doesn't reference the new fields yet, so nothing should break).

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(types): regenerate database types for push_subscriptions/push_campaigns"
```

---

### Task 4: Install web-push, generate VAPID keys, configure env vars

**Files:**
- Modify: `package.json`
- Modify: `.env.local`
- Modify: `.env.local.example`

- [ ] **Step 1: Install dependencies**

Run: `pnpm add web-push && pnpm add -D @types/web-push`
Expected: both packages appear in `package.json` (`web-push` under `dependencies`, `@types/web-push` under `devDependencies`).

- [ ] **Step 2: Generate VAPID keys**

Run: `npx web-push generate-vapid-keys`
Expected output looks like:
```
=======================================

Public Key:
BN4...(a long base64url string)...

Private Key:
8x...(a shorter base64url string)...

=======================================
```

- [ ] **Step 3: Add the keys to `.env.local`**

Append to `.env.local` (replace the placeholder values with what Step 2 printed, and `CRON_SECRET` with the value generated in Task 2 Step 3):

```bash
# Web Push (Pro/Premium notifications)
VAPID_PUBLIC_KEY=paste-public-key-here
VAPID_PRIVATE_KEY=paste-private-key-here
NEXT_PUBLIC_VAPID_PUBLIC_KEY=paste-same-public-key-here
VAPID_SUBJECT=mailto:soporte@fidelitap.co
CRON_SECRET=paste-the-secret-from-task-2-step-3-here
```

- [ ] **Step 4: Add placeholders to `.env.local.example`**

Append to `.env.local.example`:

```bash
# Web Push (Pro/Premium notifications)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_SUBJECT=mailto:soporte@fidelitap.co
CRON_SECRET=
```

- [ ] **Step 5: Restart the dev server so the new env vars load**

Run: `lsof -ti:3000 | xargs kill -9 2>/dev/null; pnpm dev > /tmp/fidelitap-dev.log 2>&1 &`
Run: `sleep 6 && curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml .env.local.example
git commit -m "feat(push): add web-push dependency and VAPID/CRON_SECRET env placeholders"
```

(`.env.local` is gitignored and is not committed — verify with `git status` that it does not appear as a staged file.)

---

### Task 5: Push sending library

**Files:**
- Create: `src/lib/push/send.ts`

- [ ] **Step 1: Write the library**

```typescript
import 'server-only'
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceClient>

const vapidPublicKey  = process.env.VAPID_PUBLIC_KEY ?? ''
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? ''
const vapidSubject    = process.env.VAPID_SUBJECT ?? 'mailto:soporte@fidelitap.co'

let configured = false
function ensureConfigured() {
  if (configured) return
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas')
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

export interface StoredSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export function isPushConfigured(): boolean {
  return Boolean(vapidPublicKey && vapidPrivateKey)
}

async function sendOne(
  sub: StoredSubscription,
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; expired: boolean }> {
  ensureConfigured()
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    )
    return { ok: true }
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    return { ok: false, expired: statusCode === 404 || statusCode === 410 }
  }
}

/** Sends to an explicit list of subscriptions. Marks expired ones inactive. Returns count sent. */
export async function sendPushToSubscriptions(
  serviceClient: ServiceClient,
  subscriptions: StoredSubscription[],
  payload: PushPayload
): Promise<number> {
  if (!isPushConfigured() || subscriptions.length === 0) return 0

  let sentCount = 0
  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendOne(sub, payload)
      if (result.ok) {
        sentCount++
        await serviceClient
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)
      } else if (result.expired) {
        await serviceClient
          .from('push_subscriptions')
          .update({ active: false })
          .eq('id', sub.id)
      }
    })
  )
  return sentCount
}

/** Sends to every active subscription belonging to one customer_card. Returns count sent. */
export async function sendPushToCustomerCard(
  serviceClient: ServiceClient,
  customerCardId: string,
  payload: PushPayload
): Promise<number> {
  const { data: subs } = await serviceClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('customer_card_id', customerCardId)
    .eq('active', true)

  if (!subs || subs.length === 0) return 0
  return sendPushToSubscriptions(serviceClient, subs, payload)
}

/**
 * Sends a campaign to every active subscription of a business, optionally filtered
 * to customers of one specific loyalty card. Returns count sent.
 */
export async function sendCampaignPush(
  serviceClient: ServiceClient,
  params: { businessId: string; loyaltyCardId: string | null; title: string; body: string }
): Promise<number> {
  const { data: subs } = await serviceClient
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, customer_card_id')
    .eq('business_id', params.businessId)
    .eq('active', true)

  let filtered = subs ?? []

  if (params.loyaltyCardId) {
    const { data: matchingCards } = await serviceClient
      .from('customer_cards')
      .select('id')
      .eq('loyalty_card_id', params.loyaltyCardId)
    const matchingIds = new Set((matchingCards ?? []).map((c) => c.id))
    filtered = filtered.filter((s) => matchingIds.has(s.customer_card_id))
  }

  return sendPushToSubscriptions(serviceClient, filtered, { title: params.title, body: params.body })
}
```

- [ ] **Step 2: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/push/send.ts
git commit -m "feat(push): add server-only Web Push sending library"
```

---

### Task 6: Service Worker

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: Write the service worker**

```javascript
self.addEventListener('push', (event) => {
  if (!event.data) return
  const payload = event.data.json()
  const title = payload.title || 'FideliTap'
  const options = {
    body: payload.body || '',
    icon: '/wallet-icon.png',
    badge: '/wallet-icon.png',
    data: { url: payload.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
```

- [ ] **Step 2: Verify it's served**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/sw.js`
Expected: `200`

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "feat(push): add service worker for push notification delivery"
```

---

### Task 7: Subscribe / unsubscribe API routes

**Files:**
- Create: `src/app/api/push/subscribe/route.ts`
- Create: `src/app/api/push/unsubscribe/route.ts`

- [ ] **Step 1: Write the subscribe route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const subscribeSchema = z.object({
  customerCardId: z.string().uuid(),
  walletAuthToken: z.string().uuid(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
})

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null)
  const parsed = subscribeSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { customerCardId, walletAuthToken, subscription } = parsed.data
  const supabase = createServiceClient()

  const { data: cc } = await supabase
    .from('customer_cards')
    .select(`
      id,
      customer_id,
      wallet_auth_token,
      loyalty_cards ( business_id, businesses ( plan ) )
    `)
    .eq('id', customerCardId)
    .maybeSingle()

  if (!cc || cc.wallet_auth_token !== walletAuthToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const card = cc.loyalty_cards as unknown as {
    business_id: string
    businesses: { plan: string } | null
  } | null

  if (!card) {
    return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })
  }

  const plan = card.businesses?.plan
  if (plan !== 'pro' && plan !== 'premium') {
    return NextResponse.json({ error: 'Notificaciones no disponibles en este plan' }, { status: 403 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        customer_card_id: customerCardId,
        customer_id: cc.customer_id,
        business_id: card.business_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        active: true,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    return NextResponse.json({ error: 'Error guardando suscripción' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Write the unsubscribe route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const unsubscribeSchema = z.object({
  customerCardId: z.string().uuid(),
  walletAuthToken: z.string().uuid(),
  endpoint: z.string().url(),
})

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null)
  const parsed = unsubscribeSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { customerCardId, walletAuthToken, endpoint } = parsed.data
  const supabase = createServiceClient()

  const { data: cc } = await supabase
    .from('customer_cards')
    .select('id, wallet_auth_token')
    .eq('id', customerCardId)
    .maybeSingle()

  if (!cc || cc.wallet_auth_token !== walletAuthToken) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  await supabase
    .from('push_subscriptions')
    .update({ active: false })
    .eq('customer_card_id', customerCardId)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual smoke test (expect a 401, proving the route is wired and validating auth)**

Run: `curl -s -X POST http://localhost:3000/api/push/subscribe -H "Content-Type: application/json" -d '{"customerCardId":"00000000-0000-0000-0000-000000000000","walletAuthToken":"00000000-0000-0000-0000-000000000000","subscription":{"endpoint":"https://example.com/x","keys":{"p256dh":"a","auth":"b"}}}'`
Expected: `{"error":"No autorizado"}`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/push/subscribe/route.ts src/app/api/push/unsubscribe/route.ts
git commit -m "feat(push): add subscribe/unsubscribe API routes with plan gating"
```

---

### Task 8: Client opt-in component

**Files:**
- Create: `src/components/push/push-opt-in.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'

interface PushOptInProps {
  customerCardId: string
  walletAuthToken: string
}

type Status = 'idle' | 'loading' | 'enabled' | 'denied' | 'unsupported' | 'error'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function PushOptIn({ customerCardId, walletAuthToken }: PushOptInProps) {
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('push_prompt_dismissed') === 'true') {
      setStatus('denied')
    }
  }, [])

  async function handleEnable() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        localStorage.setItem('push_prompt_dismissed', 'true')
        return
      }

      const registration = await navigator.serviceWorker.register('/sw.js')
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerCardId,
          walletAuthToken,
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh')),
              auth: arrayBufferToBase64Url(subscription.getKey('auth')),
            },
          },
        }),
      })

      if (!res.ok) throw new Error('subscribe failed')
      setStatus('enabled')
    } catch {
      setStatus('error')
    }
  }

  function handleDismiss() {
    localStorage.setItem('push_prompt_dismissed', 'true')
    setStatus('denied')
  }

  if (status === 'enabled') {
    return (
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-[#00C896]">
        <Bell size={14} />
        Notificaciones activadas
      </div>
    )
  }

  if (status === 'denied' || status === 'unsupported') {
    return null
  }

  return (
    <div className="flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <Bell size={14} className="text-[#00C896]" />
        Recibe un aviso cuando estés cerca de tu premio
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Te avisamos solo cuando te falte poco para completar tus sellos, o si el negocio tiene una promo. Nada más.
      </p>
      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={handleEnable}
          disabled={status === 'loading'}
          className="flex-1 bg-[#00C896] text-slate-900 font-semibold text-xs rounded-lg py-2 hover:bg-[#00b386] disabled:opacity-50 transition-colors"
        >
          {status === 'loading' ? 'Activando...' : 'Activar'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex items-center gap-1 px-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <BellOff size={12} />
          No, gracias
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/push/push-opt-in.tsx
git commit -m "feat(push): add client opt-in component for Web Push subscription"
```

---

### Task 9: Wire opt-in into the activation flow

**Files:**
- Modify: `src/app/c/[slug]/page.tsx`
- Modify: `src/app/c/[slug]/activate-form.tsx`
- Modify: `src/app/c/[slug]/success-screen.tsx`

- [ ] **Step 1: Fetch the business plan in `page.tsx`**

In `src/app/c/[slug]/page.tsx`, change:

```typescript
  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', card.business_id)
    .single()
```

to:

```typescript
  const { data: business } = await supabase
    .from('businesses')
    .select('name, plan')
    .eq('id', card.business_id)
    .single()
```

And change the `<ActivateForm ... />` call from:

```tsx
        <ActivateForm
          loyaltyCardId={card.id}
          businessId={card.business_id}
          shareUrl={shareUrl}
        />
```

to:

```tsx
        <ActivateForm
          loyaltyCardId={card.id}
          businessId={card.business_id}
          shareUrl={shareUrl}
          businessPlan={business?.plan ?? 'free'}
        />
```

- [ ] **Step 2: Forward the plan through `activate-form.tsx`**

In `src/app/c/[slug]/activate-form.tsx`, change the props interface from:

```typescript
interface ActivateFormProps {
  loyaltyCardId: string
  businessId:   string
  shareUrl:     string
}
```

to:

```typescript
interface ActivateFormProps {
  loyaltyCardId: string
  businessId:   string
  shareUrl:     string
  businessPlan: string
}
```

Change the function signature from:

```typescript
export function ActivateForm({ loyaltyCardId, businessId, shareUrl }: ActivateFormProps) {
```

to:

```typescript
export function ActivateForm({ loyaltyCardId, businessId, shareUrl, businessPlan }: ActivateFormProps) {
```

Change the early return from:

```typescript
  if (result) return <SuccessScreen {...result} shareUrl={shareUrl} />
```

to:

```typescript
  if (result) return <SuccessScreen {...result} shareUrl={shareUrl} businessPlan={businessPlan} />
```

- [ ] **Step 3: Render the opt-in in `success-screen.tsx`**

In `src/app/c/[slug]/success-screen.tsx`, add the import:

```typescript
import { PushOptIn } from '@/components/push/push-opt-in'
```

Change the props interface from:

```typescript
interface SuccessScreenProps {
  customerCardId: string
  walletAuthToken: string
  alreadyHadCard: boolean
  shareUrl: string
}
```

to:

```typescript
interface SuccessScreenProps {
  customerCardId: string
  walletAuthToken: string
  alreadyHadCard: boolean
  shareUrl: string
  businessPlan: string
}
```

Change the function signature from:

```typescript
export function SuccessScreen({
  customerCardId,
  walletAuthToken,
  alreadyHadCard,
  shareUrl,
}: SuccessScreenProps) {
```

to:

```typescript
export function SuccessScreen({
  customerCardId,
  walletAuthToken,
  alreadyHadCard,
  shareUrl,
  businessPlan,
}: SuccessScreenProps) {
```

Add the opt-in card right after the Wallet buttons `</div>` and before the `{/* Large QR */}` comment:

```tsx
      {(businessPlan === 'pro' || businessPlan === 'premium') && (
        <PushOptIn customerCardId={customerCardId} walletAuthToken={walletAuthToken} />
      )}

```

- [ ] **Step 4: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual browser check**

Run: `open http://localhost:3000/c/<some-existing-card-slug>` (use a real slug from your local data) and activate a test card on a Pro/Premium business. Confirm the "Recibe un aviso..." card renders below the Wallet buttons.

- [ ] **Step 6: Commit**

```bash
git add "src/app/c/[slug]/page.tsx" "src/app/c/[slug]/activate-form.tsx" "src/app/c/[slug]/success-screen.tsx"
git commit -m "feat(push): show opt-in prompt on success screen for Pro/Premium businesses"
```

---

### Task 10: Per-card notification threshold

**Files:**
- Modify: `src/components/cards/card-editor.tsx`
- Modify: `src/app/(dashboard)/cards/actions.ts`

- [ ] **Step 1: Add state in `card-editor.tsx`**

Change:

```typescript
  const [stampsRequired,  setStampsRequired]= useState(card?.stamps_required ?? 8)
```

to:

```typescript
  const [stampsRequired,  setStampsRequired]= useState(card?.stamps_required ?? 8)
  const [pushThreshold,   setPushThreshold] = useState(card?.push_notify_threshold ?? 1)
```

- [ ] **Step 2: Append the field to the form data**

Change:

```typescript
    fd.append('stamps_required',    String(stampsRequired))
```

to:

```typescript
    fd.append('stamps_required',    String(stampsRequired))
    fd.append('push_notify_threshold', String(pushThreshold))
```

- [ ] **Step 3: Add the UI control**

Right after the existing stamps-required `Field` block:

```tsx
            <Field label={`Sellos requeridos: ${stampsRequired}`}>
              <input
                type="range" min={2} max={20} value={stampsRequired}
                onChange={e => setStampsRequired(Number(e.target.value))}
                className="w-full accent-[#00C896]"
              />
              <div className="flex justify-between text-[10px] text-white/20 mt-1"><span>2</span><span>20</span></div>
            </Field>
```

add:

```tsx
            <Field label={`Avisar por push cuando falte${pushThreshold === 1 ? '' : 'n'}: ${pushThreshold} sello${pushThreshold === 1 ? '' : 's'}`}>
              <input
                type="range" min={1} max={5} value={pushThreshold}
                onChange={e => setPushThreshold(Number(e.target.value))}
                className="w-full accent-[#00C896]"
              />
              <div className="flex justify-between text-[10px] text-white/20 mt-1"><span>1</span><span>5</span></div>
              <p className="text-[10px] text-white/30 mt-1">Solo aplica si tu plan incluye notificaciones push (Pro/Premium).</p>
            </Field>
```

- [ ] **Step 4: Accept the field in `cards/actions.ts` schema**

Change:

```typescript
const cardFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres').trim(),
  benefit_description: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres').trim(),
  stamps_required: z.coerce.number().int().min(2, 'Mínimo 2 sellos').max(20, 'Máximo 20 sellos'),
  stamp_icon: z.string().min(1, 'Selecciona un ícono'),
  bg_type: z.enum(['solid', 'image']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
  style: z.enum(['clean', 'modern', 'luxury', 'editorial', 'minimal']).default('clean'),
  bg_mode: z.enum(['light', 'dark']).default('light'),
})
```

to:

```typescript
const cardFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres').trim(),
  benefit_description: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres').trim(),
  stamps_required: z.coerce.number().int().min(2, 'Mínimo 2 sellos').max(20, 'Máximo 20 sellos'),
  push_notify_threshold: z.coerce.number().int().min(1).max(5).default(1),
  stamp_icon: z.string().min(1, 'Selecciona un ícono'),
  bg_type: z.enum(['solid', 'image']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
  style: z.enum(['clean', 'modern', 'luxury', 'editorial', 'minimal']).default('clean'),
  bg_mode: z.enum(['light', 'dark']).default('light'),
})
```

- [ ] **Step 5: Wire it through `createCardAction`**

In the `parsed = cardFormSchema.safeParse({...})` call inside `createCardAction`, change:

```typescript
    stamps_required: formData.get('stamps_required'),
```

to:

```typescript
    stamps_required: formData.get('stamps_required'),
    push_notify_threshold: formData.get('push_notify_threshold'),
```

Change:

```typescript
  const { name, benefit_description, stamps_required, stamp_icon, bg_type, color, style, bg_mode } = parsed.data
```

to:

```typescript
  const { name, benefit_description, stamps_required, push_notify_threshold, stamp_icon, bg_type, color, style, bg_mode } = parsed.data
```

Change the insert call:

```typescript
  const { error } = await supabase.from('loyalty_cards').insert({
    business_id: business.id,
    name,
    benefit_description,
    stamps_required,
    design_config,
    slug: generateSlug(name),
    is_active: true,
  })
```

to:

```typescript
  const { error } = await supabase.from('loyalty_cards').insert({
    business_id: business.id,
    name,
    benefit_description,
    stamps_required,
    push_notify_threshold,
    design_config,
    slug: generateSlug(name),
    is_active: true,
  })
```

- [ ] **Step 6: Wire it through `updateCardAction`**

In the `parsed = cardFormSchema.safeParse({...})` call inside `updateCardAction`, change:

```typescript
    stamps_required: formData.get('stamps_required'),
```

to:

```typescript
    stamps_required: formData.get('stamps_required'),
    push_notify_threshold: formData.get('push_notify_threshold'),
```

Change:

```typescript
  const { name, benefit_description, stamps_required, stamp_icon, bg_type, color, style, bg_mode } = parsed.data
```

to:

```typescript
  const { name, benefit_description, stamps_required, push_notify_threshold, stamp_icon, bg_type, color, style, bg_mode } = parsed.data
```

Change:

```typescript
  const { error } = await supabase
    .from('loyalty_cards')
    .update({ name, benefit_description, stamps_required, design_config })
    .eq('id', cardId)
```

to:

```typescript
  const { error } = await supabase
    .from('loyalty_cards')
    .update({ name, benefit_description, stamps_required, push_notify_threshold, design_config })
    .eq('id', cardId)
```

- [ ] **Step 7: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual check**

Run: `open http://localhost:3000/cards/nueva`, move the new "Avisar por push" slider, save, and confirm no error toast appears.

- [ ] **Step 9: Commit**

```bash
git add src/components/cards/card-editor.tsx "src/app/(dashboard)/cards/actions.ts"
git commit -m "feat(push): add per-card configurable stamp-progress notification threshold"
```

---

### Task 11: Stamp-progress trigger in the scanner flow

**Files:**
- Modify: `src/app/(dashboard)/scanner/actions.ts`

- [ ] **Step 1: Import the push helper**

Add to the top imports:

```typescript
import { sendPushToCustomerCard } from '@/lib/push/send'
```

- [ ] **Step 2: Fetch `plan` on the business and the new columns on the card**

Change:

```typescript
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()
```

to:

```typescript
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stamp_cooldown_seconds, plan')
    .eq('owner_id', user.id)
    .single()
```

Change:

```typescript
  const { data: ccRaw } = await serviceClient
    .from('customer_cards')
    .select(`
      id,
      wallet_pass_serial,
      loyalty_card_id,
      loyalty_cards ( id, stamps_required, business_id ),
      customers ( name, email )
    `)
    .eq('unique_code', uniqueCode.trim())
    .maybeSingle()
```

to:

```typescript
  const { data: ccRaw } = await serviceClient
    .from('customer_cards')
    .select(`
      id,
      wallet_pass_serial,
      loyalty_card_id,
      near_completion_notified_at,
      loyalty_cards ( id, stamps_required, business_id, push_notify_threshold ),
      customers ( name, email )
    `)
    .eq('unique_code', uniqueCode.trim())
    .maybeSingle()
```

Change the `cc` type cast:

```typescript
  const cc = ccRaw as unknown as {
    id: string
    wallet_pass_serial: string | null
    loyalty_card_id: string
    loyalty_cards: { id: string; stamps_required: number; business_id: string } | null
    customers: { name: string; email: string | null } | null
  }
```

to:

```typescript
  const cc = ccRaw as unknown as {
    id: string
    wallet_pass_serial: string | null
    loyalty_card_id: string
    near_completion_notified_at: string | null
    loyalty_cards: { id: string; stamps_required: number; business_id: string; push_notify_threshold: number } | null
    customers: { name: string; email: string | null } | null
  }
```

- [ ] **Step 3: Compute the trigger and persist `last_stamp_at` right after the `stamp_events` insert**

Change:

```typescript
  // Record stamp event with type='stamp'
  await serviceClient.from('stamp_events').insert({
    customer_card_id: cc.id,
    business_id: business.id,
    stamped_by: user.id,
    scan_token: crypto.randomUUID(),
    type: 'stamp',
  })

  let pushTokens: string[] = []
```

to:

```typescript
  // Record stamp event with type='stamp'
  await serviceClient.from('stamp_events').insert({
    customer_card_id: cc.id,
    business_id: business.id,
    stamped_by: user.id,
    scan_token: crypto.randomUUID(),
    type: 'stamp',
  })

  const remaining = card.stamps_required - currentStamps
  const shouldNotifyProgress =
    !isComplete &&
    remaining === card.push_notify_threshold &&
    !cc.near_completion_notified_at &&
    (business.plan === 'pro' || business.plan === 'premium')

  await serviceClient
    .from('customer_cards')
    .update({
      last_stamp_at: new Date().toISOString(),
      ...(shouldNotifyProgress ? { near_completion_notified_at: new Date().toISOString() } : {}),
    })
    .eq('id', cc.id)

  let pushTokens: string[] = []
```

- [ ] **Step 4: Add the Web Push send to the existing `Promise.allSettled`**

Change:

```typescript
  void Promise.allSettled([
    pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve(),
    updateGoogleWalletStamps(cc.id, card.id, currentStamps),
    isComplete && customerEmail
      ? sendCardComplete({
          to: customerEmail,
          customerName: cc.customers?.name ?? 'Cliente',
          businessName: business.name,
          appleWalletUrl: `${appUrl}/api/wallet/apple/${cc.id}`,
          googleWalletUrl: `${appUrl}/api/wallet/google/${cc.id}`,
        })
      : Promise.resolve(),
  ])
```

to:

```typescript
  void Promise.allSettled([
    pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve(),
    updateGoogleWalletStamps(cc.id, card.id, currentStamps),
    isComplete && customerEmail
      ? sendCardComplete({
          to: customerEmail,
          customerName: cc.customers?.name ?? 'Cliente',
          businessName: business.name,
          appleWalletUrl: `${appUrl}/api/wallet/apple/${cc.id}`,
          googleWalletUrl: `${appUrl}/api/wallet/google/${cc.id}`,
        })
      : Promise.resolve(),
    shouldNotifyProgress
      ? sendPushToCustomerCard(serviceClient, cc.id, {
          title: '¡Ya casi! 🎉',
          body: `Te falta${remaining === 1 ? '' : 'n'} ${remaining} sello${remaining === 1 ? '' : 's'} para tu premio en ${business.name}`,
        })
      : Promise.resolve(),
  ])
```

- [ ] **Step 5: Reset the flag on reward claim**

In `claimRewardAction`, change:

```typescript
  // Record reward_claimed event
  await serviceClient.from('stamp_events').insert({
    customer_card_id: customerCardId,
    business_id: business.id,
    stamped_by: user.id,
    scan_token: crypto.randomUUID(),
    type: 'reward_claimed',
  })

  return {
```

to:

```typescript
  // Record reward_claimed event
  await serviceClient.from('stamp_events').insert({
    customer_card_id: customerCardId,
    business_id: business.id,
    stamped_by: user.id,
    scan_token: crypto.randomUUID(),
    type: 'reward_claimed',
  })

  await serviceClient
    .from('customer_cards')
    .update({ near_completion_notified_at: null })
    .eq('id', customerCardId)

  return {
```

- [ ] **Step 6: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual check**

Using the scanner UI (`/scanner`) on a Pro/Premium test business, stamp a test card until `remaining` equals its configured threshold (default 1). Confirm in the Network tab (or server logs) that no error is thrown, and check `select near_completion_notified_at from customer_cards where id = '<id>'` via `pnpm supabase db psql` shows a timestamp.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/scanner/actions.ts"
git commit -m "feat(push): trigger stamp-progress push when customer nears their reward"
```

---

### Task 12: Re-engagement reminder job

**Files:**
- Create: `src/app/api/push/jobs/reengagement/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendPushToCustomerCard } from '@/lib/push/send'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates } = await supabase
    .from('customer_cards')
    .select(`
      id,
      current_stamps,
      last_stamp_at,
      reengagement_sent_at,
      loyalty_cards ( stamps_required, business_id, businesses ( name, plan, subscription_status ) )
    `)
    .eq('status', 'active')
    .lt('last_stamp_at', fourteenDaysAgo)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  let sent = 0
  for (const cc of candidates) {
    const card = cc.loyalty_cards as unknown as {
      stamps_required: number
      business_id: string
      businesses: { name: string; plan: string; subscription_status: string } | null
    } | null
    const biz = card?.businesses
    if (!card || !biz) continue
    if (biz.plan !== 'pro' && biz.plan !== 'premium') continue
    if (biz.subscription_status !== 'active') continue
    if (cc.reengagement_sent_at && cc.last_stamp_at && cc.reengagement_sent_at >= cc.last_stamp_at) continue

    const remaining = card.stamps_required - cc.current_stamps
    const count = await sendPushToCustomerCard(supabase, cc.id, {
      title: `${biz.name} te espera 👋`,
      body: `Te falta${remaining === 1 ? '' : 'n'} ${remaining} sello${remaining === 1 ? '' : 's'} para tu premio. ¡No los pierdas!`,
    })

    if (count > 0) {
      await supabase
        .from('customer_cards')
        .update({ reengagement_sent_at: new Date().toISOString() })
        .eq('id', cc.id)
      sent++
    }
  }

  return NextResponse.json({ sent })
}
```

- [ ] **Step 2: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test (auth check)**

Run: `curl -s -X POST http://localhost:3000/api/push/jobs/reengagement`
Expected: `{"error":"No autorizado"}`

Run: `curl -s -X POST http://localhost:3000/api/push/jobs/reengagement -H "x-cron-secret: $(grep CRON_SECRET .env.local | cut -d= -f2)"`
Expected: `{"sent":0}` (or a positive number if you have real inactive Pro/Premium test cards locally).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/push/jobs/reengagement/route.ts
git commit -m "feat(push): add 14-day re-engagement reminder job endpoint"
```

---

### Task 13: Campaign dashboard page

**Files:**
- Create: `src/app/(dashboard)/campaigns/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CampaignForm } from './campaign-form'
import { CancelCampaignButton } from './cancel-campaign-button'

export default async function CampaignsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  if (business.plan !== 'pro' && business.plan !== 'premium') {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-black text-white mb-2">Campañas push</h1>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-300 text-sm">
            Las campañas push están disponibles en los planes <strong className="text-white">Pro</strong> y{' '}
            <strong className="text-white">Premium</strong>.
          </p>
          <a
            href="/settings?tab=suscripcion"
            className="inline-block mt-4 bg-[#00C896] text-slate-900 font-semibold text-sm rounded-lg px-4 py-2 hover:bg-[#00b386] transition-colors"
          >
            Ver planes
          </a>
        </div>
      </div>
    )
  }

  const { data: cards } = await supabase
    .from('loyalty_cards')
    .select('id, name')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const { data: campaigns } = await supabase
    .from('push_campaigns')
    .select('id, title, body, status, scheduled_at, sent_at, recipients_count, loyalty_card_id')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-black text-white">Campañas push</h1>
        <p className="text-slate-500 text-sm mt-1">
          Envía promociones a los clientes que tienen tu tarjeta activa.
        </p>
      </div>

      <CampaignForm cards={cards ?? []} />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Historial</p>
        {(!campaigns || campaigns.length === 0) && (
          <p className="text-sm text-slate-600">Todavía no has enviado ninguna campaña.</p>
        )}
        {campaigns?.map((c) => (
          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{c.title}</p>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  c.status === 'sent'
                    ? 'bg-green-950 text-green-400'
                    : c.status === 'scheduled'
                    ? 'bg-amber-950 text-amber-400'
                    : c.status === 'failed'
                    ? 'bg-red-950 text-red-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {c.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">{c.body}</p>
            <div className="flex items-center justify-between mt-1">
              {c.recipients_count !== null ? (
                <p className="text-[11px] text-slate-600">{c.recipients_count} destinatarios</p>
              ) : (
                <span />
              )}
              {c.status === 'scheduled' && <CancelCampaignButton campaignId={c.id} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit (after Task 14 adds the missing `CampaignForm`/`CancelCampaignButton` import targets — do not commit yet, continue to Task 14 first)**

(No commit here — `page.tsx` imports `./campaign-form` and `./cancel-campaign-button`, which don't exist until Task 14. Commit everything together at the end of Task 14.)

---

### Task 14: Campaign form, cancel button, and server actions

**Files:**
- Create: `src/app/(dashboard)/campaigns/campaign-form.tsx`
- Create: `src/app/(dashboard)/campaigns/cancel-campaign-button.tsx`
- Create: `src/app/(dashboard)/campaigns/actions.ts`

- [ ] **Step 1: Write the server actions**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendCampaignPush } from '@/lib/push/send'

const campaignSchema = z.object({
  title: z.string().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres').trim(),
  body: z.string().min(2, 'Mínimo 2 caracteres').max(150, 'Máximo 150 caracteres').trim(),
  loyaltyCardId: z.string().uuid().optional().or(z.literal('')),
  scheduledAt: z.string().optional().or(z.literal('')),
})

export async function createCampaignAction(formData: FormData): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }
  if (business.plan !== 'pro' && business.plan !== 'premium') {
    return { error: 'Las campañas push requieren plan Pro o Premium' }
  }

  const parsed = campaignSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    loyaltyCardId: formData.get('loyaltyCardId') || '',
    scheduledAt: formData.get('scheduledAt') || '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { title, body, loyaltyCardId, scheduledAt } = parsed.data
  const loyalty_card_id = loyaltyCardId || null
  const scheduled_at = scheduledAt ? new Date(scheduledAt).toISOString() : null

  const { data: campaign, error } = await supabase
    .from('push_campaigns')
    .insert({
      business_id: business.id,
      loyalty_card_id,
      title,
      body,
      scheduled_at,
      status: scheduled_at ? 'scheduled' : 'draft',
    })
    .select('id')
    .single()

  if (error || !campaign) return { error: 'Error creando la campaña' }

  if (!scheduled_at) {
    await dispatchCampaignNow(campaign.id, business.id, loyalty_card_id, title, body)
  }

  revalidatePath('/campaigns')
  return null
}

export async function cancelCampaignAction(campaignId: string): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  const { error } = await supabase
    .from('push_campaigns')
    .update({ status: 'failed' })
    .eq('id', campaignId)
    .eq('business_id', business.id)
    .eq('status', 'scheduled')

  if (error) return { error: 'Error cancelando la campaña' }
  revalidatePath('/campaigns')
  return null
}

async function dispatchCampaignNow(
  campaignId: string,
  businessId: string,
  loyaltyCardId: string | null,
  title: string,
  body: string
) {
  const serviceClient = createServiceClient()
  const sentCount = await sendCampaignPush(serviceClient, {
    businessId,
    loyaltyCardId,
    title,
    body,
  })

  await serviceClient
    .from('push_campaigns')
    .update({ status: 'sent', sent_at: new Date().toISOString(), recipients_count: sentCount })
    .eq('id', campaignId)
}
```

- [ ] **Step 2: Write the form component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { createCampaignAction } from './actions'

interface Card {
  id: string
  name: string
}

interface CampaignFormProps {
  cards: Card[]
}

const input =
  'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#00C896] transition-colors'

export function CampaignForm({ cards }: CampaignFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    const form = e.currentTarget
    const fd = new FormData(form)
    startTransition(async () => {
      const res = await createCampaignAction(fd)
      if (res?.error) setError(res.error)
      else {
        setSuccess(true)
        form.reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
      <div>
        <label className="text-xs text-slate-400 mb-1.5 block font-medium">Título</label>
        <input name="title" required maxLength={60} placeholder="Ej: 20% de descuento este finde" className={input} />
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1.5 block font-medium">Mensaje</label>
        <textarea
          name="body"
          required
          maxLength={150}
          rows={2}
          placeholder="Ej: Aplica en toda la tienda hasta el domingo"
          className={`${input} resize-none`}
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1.5 block font-medium">Tarjeta</label>
        <select name="loyaltyCardId" className={input}>
          <option value="">Todas las tarjetas</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-slate-400 mb-1.5 block font-medium">Programar envío (opcional)</label>
        <input name="scheduledAt" type="datetime-local" className={input} />
      </div>
      {error && <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
      {success && <p className="text-xs text-[#00C896]">✓ Campaña creada</p>}
      <button
        type="submit"
        disabled={isPending}
        className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-xl py-3 hover:bg-[#00b386] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Enviando...' : 'Crear campaña'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Write the cancel button**

```tsx
'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelCampaignAction } from './actions'

interface CancelCampaignButtonProps {
  campaignId: string
}

export function CancelCampaignButton({ campaignId }: CancelCampaignButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCancel() {
    startTransition(async () => {
      await cancelCampaignAction(campaignId)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={isPending}
      className="text-[11px] text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
    >
      {isPending ? 'Cancelando...' : 'Cancelar envío'}
    </button>
  )
}
```

- [ ] **Step 4: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run: `open http://localhost:3000/campaigns` while logged in as a Pro/Premium test business. Create a campaign without a scheduled date and confirm "✓ Campaña creada" appears and the item shows up in Historial with status `sent`.

Then create a second campaign with a future `scheduledAt`, confirm it shows status `scheduled` with a "Cancelar envío" button, click it, and confirm the status flips to `failed` and the button disappears.

Then check as a free/basic test business that the upsell screen renders instead of the form.

- [ ] **Step 6: Commit (covers Task 13's `page.tsx` too)**

```bash
git add "src/app/(dashboard)/campaigns/page.tsx" "src/app/(dashboard)/campaigns/campaign-form.tsx" "src/app/(dashboard)/campaigns/cancel-campaign-button.tsx" "src/app/(dashboard)/campaigns/actions.ts"
git commit -m "feat(push): add campaigns dashboard with immediate, scheduled, and cancellable sending"
```

---

### Task 15: Scheduled campaign dispatch endpoint

**Files:**
- Create: `src/app/api/push/campaigns/dispatch/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendCampaignPush } from '@/lib/push/send'

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: due } = await supabase
    .from('push_campaigns')
    .select('id, business_id, loyalty_card_id, title, body')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())

  if (!due || due.length === 0) {
    return NextResponse.json({ dispatched: 0 })
  }

  let dispatched = 0
  for (const campaign of due) {
    const sentCount = await sendCampaignPush(supabase, {
      businessId: campaign.business_id,
      loyaltyCardId: campaign.loyalty_card_id,
      title: campaign.title,
      body: campaign.body,
    })

    await supabase
      .from('push_campaigns')
      .update({ status: 'sent', sent_at: new Date().toISOString(), recipients_count: sentCount })
      .eq('id', campaign.id)

    dispatched++
  }

  return NextResponse.json({ dispatched })
}
```

- [ ] **Step 2: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual end-to-end test**

Create a campaign in `/campaigns` with a `scheduledAt` value 2 minutes in the future. Then run:

Run: `curl -s -X POST http://localhost:3000/api/push/campaigns/dispatch -H "x-cron-secret: $(grep CRON_SECRET .env.local | cut -d= -f2)"`
Expected (before the scheduled time): `{"dispatched":0}`

Wait until after the scheduled time, run the same curl command again.
Expected: `{"dispatched":1}`, and the campaign's row in `/campaigns` now shows status `sent`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/push/campaigns/dispatch/route.ts
git commit -m "feat(push): add cron-triggered dispatch endpoint for scheduled campaigns"
```

---

### Task 16: Sidebar navigation link

**Files:**
- Modify: `src/components/dashboard/sidebar-nav.tsx`

- [ ] **Step 1: Add the icon import and nav item**

Change:

```typescript
import {
  LayoutDashboard,
  CreditCard,
  Users,
  ScanLine,
  Image,
  Settings,
} from 'lucide-react'
```

to:

```typescript
import {
  LayoutDashboard,
  CreditCard,
  Users,
  ScanLine,
  Image,
  Megaphone,
  Settings,
} from 'lucide-react'
```

Change:

```typescript
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cards', label: 'Mis tarjetas', icon: CreditCard },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/scanner', label: 'Escanear', icon: ScanLine },
  { href: '/poster', label: 'Plantilla', icon: Image },
  { href: '/settings', label: 'Ajustes', icon: Settings },
]
```

to:

```typescript
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/cards', label: 'Mis tarjetas', icon: CreditCard },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/scanner', label: 'Escanear', icon: ScanLine },
  { href: '/poster', label: 'Plantilla', icon: Image },
  { href: '/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/settings', label: 'Ajustes', icon: Settings },
]
```

- [ ] **Step 2: Type check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual check**

Run: `open http://localhost:3000/dashboard` and confirm "Campañas" appears in the sidebar between "Plantilla" and "Ajustes", and clicking it navigates to `/campaigns`.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/sidebar-nav.tsx
git commit -m "feat(push): add Campañas link to dashboard sidebar"
```

---

### Task 17: Full end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Build check**

Run: `pnpm build`
Expected: build completes with no errors, all routes listed including `/campaigns` and the new `/api/push/*` routes.

- [ ] **Step 2: Plan-gating check — free business cannot receive any push**

As a free-plan test business: activate a test card on `/c/<slug>`. Confirm the `PushOptIn` card does NOT render. Attempt `curl -X POST http://localhost:3000/api/push/subscribe ...` directly with that card's real `customerCardId`/`walletAuthToken` (valid token, free plan). Expected: `403` with `"Notificaciones no disponibles en este plan"`.

- [ ] **Step 3: Stamp-progress push — Pro/Premium business**

On a Pro/Premium test business: activate a card, accept the push prompt (grant browser notification permission), then use `/scanner` to stamp the card until `remaining stamps == push_notify_threshold`. Confirm a real OS-level push notification appears with the "¡Ya casi!" message.

- [ ] **Step 4: Campaign send — immediate**

On the same Pro/Premium business, go to `/campaigns`, create a campaign with no scheduled date. Confirm the subscribed test device receives the push notification within a few seconds.

- [ ] **Step 5: Campaign send — scheduled**

Repeat with a `scheduledAt` 2 minutes in the future. Confirm no push arrives immediately. After the pg_cron job fires (within ~1 minute of the scheduled time, since the cron runs every minute) confirm the push arrives and the campaign status flips to `sent` in `/campaigns`.

- [ ] **Step 6: Re-engagement job**

Run: `curl -s -X POST http://localhost:3000/api/push/jobs/reengagement -H "x-cron-secret: $(grep CRON_SECRET .env.local | cut -d= -f2)"`
Expected: `{"sent": N}` where N matches the number of eligible inactive Pro/Premium customer_cards in your local test data (0 is fine if you have none aged past 14 days — you can verify the query logic by temporarily backdating a test row's `last_stamp_at` with `pnpm supabase db psql`).

- [ ] **Step 7: 410 Gone handling**

In Supabase Studio (or `pnpm supabase db psql`), manually corrupt one `push_subscriptions.endpoint` value to a syntactically valid but non-existent push endpoint URL, then trigger any of the send paths above targeting that subscription. Confirm the row's `active` column flips to `false` afterward.

- [ ] **Step 8: No further action needed — mark plan complete**

If all the above checks pass, the feature is complete and matches the approved spec.
