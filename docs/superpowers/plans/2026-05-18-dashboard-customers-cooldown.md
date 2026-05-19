# Dashboard Métricas + Lista de Clientes + Stamp Cooldown — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill in the dashboard metric placeholders with real data, build `/customers` and `/customers/[customerId]` pages, add `/settings` with stamp cooldown configuration, and enforce that cooldown in `addStampAction`.

**Architecture:** Two PostgreSQL RPC functions (`get_business_metrics`, `get_customers_list`) handle the complex aggregation queries. All new pages are Server Components reading from Supabase service client. The cooldown is stored in `businesses.stamp_cooldown_seconds` and checked server-side in `addStampAction` before calling the `add_stamp` RPC.

**Tech Stack:** Next.js 14 App Router, Supabase (service role + cookie session), PostgreSQL RPC functions, Tailwind CSS

---

## File Map

**Modified:**
```
supabase/migrations/20260518010000_dashboard_metrics.sql  — new migration
src/types/database.ts                                     — add stamp_cooldown_seconds + 2 new Functions
src/app/(dashboard)/dashboard/page.tsx                    — replace placeholder metrics with real data
src/app/(dashboard)/scanner/actions.ts                    — add cooldown check
```

**Created:**
```
src/app/(dashboard)/customers/page.tsx
src/app/(dashboard)/customers/[customerId]/page.tsx
src/app/(dashboard)/settings/page.tsx
src/app/(dashboard)/settings/settings-form.tsx
src/app/(dashboard)/settings/actions.ts
```

---

## Task 1: Migration — stamp_cooldown_seconds + RPC functions

**Context:** The metrics queries require GROUP BY and COUNT DISTINCT across joined tables — not easily expressible with Supabase's JS client. Two PostgreSQL RPC functions handle this. The `businesses` table gets a new `stamp_cooldown_seconds` column.

**Files:**
- Create: `supabase/migrations/20260518010000_dashboard_metrics.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260518010000_dashboard_metrics.sql`:

```sql
-- Add stamp cooldown configuration to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS stamp_cooldown_seconds INT NOT NULL DEFAULT 0;

-- get_business_metrics: returns 4 dashboard metrics for a business in one call
CREATE OR REPLACE FUNCTION public.get_business_metrics(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activos   INT := 0;
  v_hoy       INT := 0;
  v_canjes    BIGINT := 0;
  v_total     INT := 0;
BEGIN
  -- Sellos hoy
  SELECT COUNT(*) INTO v_hoy
  FROM stamp_events
  WHERE business_id = p_business_id
    AND created_at >= current_date;

  -- Clientes activos (últimos 30 días)
  SELECT COUNT(DISTINCT cc.customer_id) INTO v_activos
  FROM customer_cards cc
  JOIN stamp_events se ON se.customer_card_id = cc.id
  WHERE se.business_id = p_business_id
    AND se.created_at >= now() - interval '30 days';

  -- Canjes totales
  SELECT COALESCE(SUM(cc.times_completed), 0) INTO v_canjes
  FROM customer_cards cc
  JOIN loyalty_cards lc ON cc.loyalty_card_id = lc.id
  WHERE lc.business_id = p_business_id;

  -- Total clientes únicos
  SELECT COUNT(DISTINCT cc.customer_id) INTO v_total
  FROM customer_cards cc
  JOIN loyalty_cards lc ON cc.loyalty_card_id = lc.id
  WHERE lc.business_id = p_business_id;

  RETURN jsonb_build_object(
    'activos',       v_activos,
    'sellos_hoy',    v_hoy,
    'canjes_totales', v_canjes,
    'retencion_pct', CASE WHEN v_total > 0
                          THEN ROUND(v_activos::numeric / v_total * 100)
                          ELSE 0
                     END
  );
END;
$$;

-- get_customers_list: customers with search, card filter, and last visit
CREATE OR REPLACE FUNCTION public.get_customers_list(
  p_business_id UUID,
  p_q          TEXT DEFAULT NULL,
  p_card_id    UUID DEFAULT NULL
)
RETURNS TABLE (
  customer_id    UUID,
  customer_name  TEXT,
  card_name      TEXT,
  loyalty_card_id UUID,
  current_stamps  INT,
  stamps_required INT,
  times_completed INT,
  last_visit      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    lc.name,
    lc.id,
    cc.current_stamps,
    lc.stamps_required,
    cc.times_completed,
    MAX(se.created_at)
  FROM customers c
  JOIN customer_cards cc ON cc.customer_id = c.id
  JOIN loyalty_cards lc  ON cc.loyalty_card_id = lc.id
  LEFT JOIN stamp_events se ON se.customer_card_id = cc.id
  WHERE lc.business_id = p_business_id
    AND (p_q IS NULL OR c.name ILIKE '%' || p_q || '%')
    AND (p_card_id IS NULL OR lc.id = p_card_id)
  GROUP BY c.id, c.name, lc.name, lc.id, cc.current_stamps, lc.stamps_required, cc.times_completed
  ORDER BY MAX(se.created_at) DESC NULLS LAST;
END;
$$;
```

- [ ] **Step 2: Apply the migration**

```bash
supabase --workdir /Users/samuelrodriguez/development/fidelitap db reset
```

Expected: migration runs without errors. If Docker isn't running, start it first with Docker Desktop.

- [ ] **Step 3: Update `src/types/database.ts`**

Read the file first. Add `stamp_cooldown_seconds` to the `businesses` type. Find the `businesses` Row block and add the new field:

```typescript
// In businesses.Row — add after wompi_customer_id:
stamp_cooldown_seconds: number

// In businesses.Insert — add after wompi_customer_id:
stamp_cooldown_seconds?: number

// In businesses.Update — add after wompi_customer_id:
stamp_cooldown_seconds?: number
```

Also add the two new RPC functions to the `Functions` section (currently has `add_stamp`):

```typescript
    Functions: {
      add_stamp: {
        Args: { p_card_id: string }
        Returns: { current_stamps: number; is_complete: boolean; times_completed: number }
      }
      get_business_metrics: {
        Args: { p_business_id: string }
        Returns: { activos: number; sellos_hoy: number; canjes_totales: number; retencion_pct: number }
      }
      get_customers_list: {
        Args: { p_business_id: string; p_q?: string; p_card_id?: string }
        Returns: {
          customer_id: string
          customer_name: string
          card_name: string
          loyalty_card_id: string
          current_stamps: number
          stamps_required: number
          times_completed: number
          last_visit: string | null
        }[]
      }
    }
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260518010000_dashboard_metrics.sql src/types/database.ts
git commit -m "feat: stamp_cooldown_seconds column + get_business_metrics and get_customers_list RPCs"
```

---

## Task 2: Dashboard metrics — fill in the real data

**Context:** The existing `dashboard/page.tsx` renders 4 metric cards with hardcoded "—". Replace with a call to `get_business_metrics` RPC. The layout already provides the sidebar nav.

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Rewrite `src/app/(dashboard)/dashboard/page.tsx`**

Replace the entire file content with:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const serviceClient = createServiceClient()
  const { data: metricsRaw } = await serviceClient.rpc('get_business_metrics', {
    p_business_id: business.id,
  })

  const m = metricsRaw as {
    activos: number
    sellos_hoy: number
    canjes_totales: number
    retencion_pct: number
  } | null

  const cards = [
    { label: 'Clientes activos', value: m ? String(m.activos) : '—' },
    { label: 'Sellos hoy', value: m ? String(m.sellos_hoy) : '—' },
    { label: 'Canjes totales', value: m ? String(m.canjes_totales) : '—' },
    { label: 'Retención 30d', value: m ? `${m.retencion_pct}%` : '—' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-white mb-1">
        Hola, {business.name} 👋
      </h1>
      <p className="text-slate-500 text-sm mb-8">Tu resumen de hoy.</p>

      <div className="grid grid-cols-2 gap-4 max-w-lg">
        {cards.map(({ label, value }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-slate-500 text-xs font-medium mb-2">{label}</p>
            <p className="text-3xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: dashboard metrics with real data from get_business_metrics RPC"
```

---

## Task 3: Customers list page

**Context:** `/customers` is already in the nav (layout.tsx line 9) but the page doesn't exist yet. It lists all customers for the business with search by name and filter by loyalty card. Uses the `get_customers_list` RPC.

**Files:**
- Create: `src/app/(dashboard)/customers/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p "src/app/(dashboard)/customers"
```

- [ ] **Step 2: Create `src/app/(dashboard)/customers/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

type CustomerRow = {
  customer_id: string
  customer_name: string
  card_name: string
  loyalty_card_id: string
  current_stamps: number
  stamps_required: number
  times_completed: number
  last_visit: string | null
}

function relativeTime(date: string | null): string {
  if (!date) return 'Sin visitas'
  const diffMs = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string; card?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const serviceClient = createServiceClient()

  const [customersResult, cardsResult] = await Promise.all([
    serviceClient.rpc('get_customers_list', {
      p_business_id: business.id,
      p_q: searchParams.q ?? null,
      p_card_id: searchParams.card ?? null,
    }),
    serviceClient
      .from('loyalty_cards')
      .select('id, name')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .order('name'),
  ])

  const customers = (customersResult.data ?? []) as CustomerRow[]
  const loyaltyCards = cardsResult.data ?? []

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-white mb-6">Clientes</h1>

      {/* Search + filter */}
      <form className="flex gap-3 mb-6 flex-wrap">
        <input
          name="q"
          defaultValue={searchParams.q}
          placeholder="Buscar por nombre..."
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00C896] w-56"
        />
        <select
          name="card"
          defaultValue={searchParams.card ?? ''}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00C896]"
        >
          <option value="">Todas las tarjetas</option>
          {loyaltyCards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-lg px-4 py-2 hover:bg-[#00b386] transition-colors"
        >
          Buscar
        </button>
        {(searchParams.q || searchParams.card) && (
          <Link href="/customers" className="text-slate-400 text-sm underline self-center">
            Limpiar
          </Link>
        )}
      </form>

      {/* Table */}
      {customers.length === 0 ? (
        <p className="text-slate-500 text-sm">No hay clientes aún.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left py-3 pr-6 font-medium">Nombre</th>
                <th className="text-left py-3 pr-6 font-medium">Tarjeta</th>
                <th className="text-left py-3 pr-6 font-medium">Progreso</th>
                <th className="text-left py-3 pr-6 font-medium">Última visita</th>
                <th className="text-left py-3 font-medium">Completadas</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={`${c.customer_id}-${c.loyalty_card_id}`}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3 pr-6">
                    <Link
                      href={`/customers/${c.customer_id}`}
                      className="text-white font-medium hover:text-[#00C896] transition-colors"
                    >
                      {c.customer_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-6 text-slate-400">{c.card_name}</td>
                  <td className="py-3 pr-6">
                    <span className="tracking-tight">
                      {Array.from({ length: c.stamps_required }).map((_, i) => (
                        <span
                          key={i}
                          className={i < c.current_stamps ? 'text-[#00C896]' : 'text-slate-700'}
                        >
                          ●
                        </span>
                      ))}
                    </span>
                    <span className="text-slate-500 text-xs ml-2">
                      {c.current_stamps}/{c.stamps_required}
                    </span>
                  </td>
                  <td className="py-3 pr-6 text-slate-400">{relativeTime(c.last_visit)}</td>
                  <td className="py-3 text-slate-400">{c.times_completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/customers/page.tsx"
git commit -m "feat: /customers page with search, card filter, and stamp progress"
```

---

## Task 4: Customer detail page

**Context:** Clicking a customer in the list navigates to `/customers/[customerId]`. This page shows the customer's name, email, current card progress, and the last 50 stamp events in reverse chronological order. Only shows data for cards belonging to this business.

**Files:**
- Create: `src/app/(dashboard)/customers/[customerId]/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "src/app/(dashboard)/customers/[customerId]"
```

- [ ] **Step 2: Create `src/app/(dashboard)/customers/[customerId]/page.tsx`**

```typescript
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import Link from 'next/link'

export default async function CustomerDetailPage({
  params,
}: {
  params: { customerId: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const serviceClient = createServiceClient()

  // Fetch customer basic info
  const { data: customer } = await serviceClient
    .from('customers')
    .select('id, name, email')
    .eq('id', params.customerId)
    .single()
  if (!customer) notFound()

  // Fetch customer's cards that belong to this business
  const { data: ccRaw } = await serviceClient
    .from('customer_cards')
    .select(`
      id,
      current_stamps,
      times_completed,
      loyalty_cards ( id, name, stamps_required, business_id )
    `)
    .eq('customer_id', params.customerId)

  const customerCards = (ccRaw ?? []).filter((cc) => {
    const lc = cc.loyalty_cards as { business_id: string } | null
    return lc?.business_id === business.id
  })

  if (customerCards.length === 0) notFound()

  const cardIds = customerCards.map((cc) => cc.id)

  // Fetch stamp history
  const { data: stampEvents } = await serviceClient
    .from('stamp_events')
    .select('id, created_at, customer_card_id')
    .in('customer_card_id', cardIds)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/customers" className="text-slate-400 text-sm hover:text-white mb-6 inline-block">
        ← Volver a clientes
      </Link>

      <h1 className="text-2xl font-black text-white mb-1">{customer.name}</h1>
      {customer.email && <p className="text-slate-500 text-sm mb-6">{customer.email}</p>}

      {/* Card summaries */}
      <div className="flex flex-col gap-3 mb-8">
        {customerCards.map((cc) => {
          const lc = cc.loyalty_cards as { name: string; stamps_required: number } | null
          return (
            <div key={cc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{lc?.name}</p>
              <div className="flex items-center gap-3">
                <span className="tracking-tight">
                  {Array.from({ length: lc?.stamps_required ?? 0 }).map((_, i) => (
                    <span
                      key={i}
                      className={i < cc.current_stamps ? 'text-[#00C896]' : 'text-slate-700'}
                    >
                      ●
                    </span>
                  ))}
                </span>
                <span className="text-slate-400 text-sm">
                  {cc.current_stamps}/{lc?.stamps_required}
                </span>
                <span className="text-slate-600 text-xs">·</span>
                <span className="text-slate-400 text-xs">{cc.times_completed} completadas</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Stamp history */}
      <h2 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">
        Historial de sellos
      </h2>
      {!stampEvents || stampEvents.length === 0 ? (
        <p className="text-slate-600 text-sm">Sin sellos registrados.</p>
      ) : (
        <div className="flex flex-col">
          {stampEvents.map((se) => {
            const d = new Date(se.created_at)
            return (
              <div key={se.id} className="flex items-center gap-4 py-3 border-b border-slate-800/50">
                <div className="w-2 h-2 rounded-full bg-[#00C896] shrink-0" />
                <span className="text-white text-sm">
                  {d.toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-slate-500 text-sm">
                  {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-slate-600 text-xs ml-auto">Cajero</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/customers/[customerId]/page.tsx"
git commit -m "feat: customer detail page with card progress and stamp history"
```

---

## Task 5: Settings page + saveSettingsAction

**Context:** `/settings` is already in the nav but the page doesn't exist. It shows a single setting: stamp cooldown. The Server Component fetches the current value and passes it to a Client Component form. The form calls `saveSettingsAction` on submit.

**Files:**
- Create: `src/app/(dashboard)/settings/actions.ts`
- Create: `src/app/(dashboard)/settings/settings-form.tsx`
- Create: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "src/app/(dashboard)/settings"
```

- [ ] **Step 2: Create `src/app/(dashboard)/settings/actions.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

const ALLOWED_COOLDOWNS = [0, 60, 300, 900, 3600, 86400]

export async function saveSettingsAction(
  cooldownSeconds: number
): Promise<{ error?: string }> {
  if (!ALLOWED_COOLDOWNS.includes(cooldownSeconds)) {
    return { error: 'Valor de cooldown no válido' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('businesses')
    .update({ stamp_cooldown_seconds: cooldownSeconds })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al guardar configuración' }
  return {}
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/settings/settings-form.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { saveSettingsAction } from './actions'

const COOLDOWN_OPTIONS = [
  { value: 0, label: 'Sin cooldown' },
  { value: 60, label: '1 minuto' },
  { value: 300, label: '5 minutos' },
  { value: 900, label: '15 minutos' },
  { value: 3600, label: '1 hora' },
  { value: 86400, label: '24 horas' },
]

export function SettingsForm({ cooldownSeconds }: { cooldownSeconds: number }) {
  const [value, setValue] = useState(cooldownSeconds)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    setError('')
    startTransition(async () => {
      const res = await saveSettingsAction(value)
      if (res.error) {
        setError(res.error)
      } else {
        setSaved(true)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <div>
        <label className="text-xs text-slate-400 mb-2 block">Cooldown entre sellos</label>
        <select
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00C896]"
        >
          {COOLDOWN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-600 mt-1">
          Tiempo mínimo entre dos sellos para el mismo cliente.
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-lg px-4 py-2.5 hover:bg-[#00b386] disabled:opacity-40 transition-colors self-start"
      >
        {isPending ? 'Guardando...' : 'Guardar'}
      </button>

      {saved && <p className="text-[#00C896] text-sm">✓ Configuración guardada</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 4: Create `src/app/(dashboard)/settings/page.tsx`**

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black text-white mb-1">Ajustes</h1>
      <p className="text-slate-500 text-sm mb-8">Configuración de tu negocio.</p>

      <section>
        <h2 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider">
          Scanner
        </h2>
        <SettingsForm cooldownSeconds={business?.stamp_cooldown_seconds ?? 0} />
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/settings/"
git commit -m "feat: settings page with stamp cooldown configuration"
```

---

## Task 6: Stamp cooldown enforcement in addStampAction

**Context:** `src/app/(dashboard)/scanner/actions.ts` already has the full `addStampAction`. Add two changes: (1) extend the initial business query to also fetch `stamp_cooldown_seconds`, (2) after verifying business ownership, check the last stamp event for this customer_card and return an error if the cooldown hasn't elapsed.

**Files:**
- Modify: `src/app/(dashboard)/scanner/actions.ts`

- [ ] **Step 1: Read `src/app/(dashboard)/scanner/actions.ts`**

Read the current file. The relevant section is the business query near the top and the section after the `card.business_id !== business.id` check.

- [ ] **Step 2: Extend the business query to include `stamp_cooldown_seconds`**

Find:
```typescript
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
```

Replace with:
```typescript
  const { data: business } = await supabase
    .from('businesses')
    .select('id, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()
```

- [ ] **Step 3: Add cooldown check after the business_id guard**

Find this block (after the business_id mismatch check):
```typescript
  const card = cc.loyalty_cards
  if (!card || card.business_id !== business.id) {
    return { error: 'Esta tarjeta pertenece a otro negocio' }
  }

  const { data: stampResult, error: rpcError } = await serviceClient.rpc('add_stamp', {
```

Replace with:
```typescript
  const card = cc.loyalty_cards
  if (!card || card.business_id !== business.id) {
    return { error: 'Esta tarjeta pertenece a otro negocio' }
  }

  // Cooldown check — prevent double-scanning within the configured window
  if (business.stamp_cooldown_seconds > 0) {
    const { data: lastStamp } = await serviceClient
      .from('stamp_events')
      .select('created_at')
      .eq('customer_card_id', cc.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastStamp) {
      const secondsSinceLast = (Date.now() - new Date(lastStamp.created_at).getTime()) / 1000
      if (secondsSinceLast < business.stamp_cooldown_seconds) {
        const waitMinutes = Math.ceil((business.stamp_cooldown_seconds - secondsSinceLast) / 60)
        return { error: `Espera ${waitMinutes} min antes del próximo sello` }
      }
    }
  }

  const { data: stampResult, error: rpcError } = await serviceClient.rpc('add_stamp', {
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors. The `stamp_cooldown_seconds` field is now in database.ts (Task 1), so Supabase client will type it correctly.

- [ ] **Step 5: Full build check**

```bash
pnpm build 2>&1 | tail -20
```

Expected: build succeeds. Routes `/customers`, `/customers/[customerId]`, `/settings` should appear in output.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/scanner/actions.ts"
git commit -m "feat: stamp cooldown enforcement in addStampAction"
```

---

## End-to-End Test Checklist

After all tasks:

- [ ] Open `http://localhost:3000/dashboard` — all 4 metric cards show real numbers (or 0 if no data yet)
- [ ] Open `http://localhost:3000/customers` — shows customer list (or "No hay clientes aún")
- [ ] Enter a name in search → click Buscar → list filters correctly
- [ ] Click a customer name → `/customers/[id]` shows card progress + stamp history
- [ ] Open `http://localhost:3000/settings` → set cooldown to "1 minuto" → click Guardar → "✓ Configuración guardada" appears
- [ ] Scanner: scan a QR or enter a unique_code → success → scan the same code within 1 min → error "Espera 1 min antes del próximo sello"
- [ ] Supabase Studio: `businesses.stamp_cooldown_seconds = 60` for your business
