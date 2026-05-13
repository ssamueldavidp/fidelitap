# Pricing Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the pricing section on the landing page, plan limits enforcement utilities, and a dashboard usage indicator that warns businesses when they approach or hit their plan limits.

**Architecture:** A `PricingSection` client component (monthly/annual toggle) lives on the landing page. A `plan-limits.ts` utility holds all limit constants and state helpers — used by the dashboard and future scan endpoint. A `PlanUsage` server component in the dashboard sidebar shows live customer/card counts vs. limits with color-coded warnings.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase SSR (`@supabase/ssr`)

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create migration | `supabase/migrations/20260512000000_fix_basic_plan_cards.sql` | Fix Basic plan: 3 cards → 1 card in DB |
| Create | `src/lib/plan-limits.ts` | Plan limit constants + state helpers |
| Create | `src/components/landing/pricing-section.tsx` | Landing pricing UI with toggle |
| Modify | `src/app/page.tsx` | Add `<PricingSection />` before `<CtaSection />` |
| Modify | `src/components/landing/cta-section.tsx` | Move `id="precios"` anchor to PricingSection |
| Create | `src/components/dashboard/plan-usage.tsx` | Server component: usage bars + warnings |
| Modify | `src/app/(dashboard)/layout.tsx` | Add `<PlanUsage>` to sidebar |

---

## Task 1: Migration — Fix Basic plan card limit

**Files:**
- Create: `supabase/migrations/20260512000000_fix_basic_plan_cards.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Fix: Basic plan should have max_loyalty_cards = 1 (was 3)
update public.subscription_plans
set max_loyalty_cards = 1
where slug = 'basic';
```

- [ ] **Step 2: Apply migration locally**

```bash
supabase db push
```

Expected: `Applied 1 migration` (or similar success message)

If supabase CLI isn't linked, apply manually in Supabase dashboard SQL editor.

- [ ] **Step 3: Verify in DB**

```bash
supabase db execute "select slug, max_loyalty_cards, max_customers from subscription_plans order by price_cop"
```

Expected output:
```
 slug    | max_loyalty_cards | max_customers
---------+-------------------+--------------
 free    |                 1 |            20
 basic   |                 1 |           500
 pro     |                10 |          2000
 premium |            (null) |        (null)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260512000000_fix_basic_plan_cards.sql
git commit -m "fix: basic plan max_loyalty_cards 3 → 1"
```

---

## Task 2: Plan limits utility

**Files:**
- Create: `src/lib/plan-limits.ts`

- [ ] **Step 1: Create the file**

```typescript
export type PlanSlug = 'free' | 'basic' | 'pro' | 'premium'
export type UsageState = 'ok' | 'warning' | 'full'

export interface PlanLimits {
  maxCustomers: number | null  // null = unlimited
  maxCards: number | null
}

export const PLAN_LIMITS: Record<PlanSlug, PlanLimits> = {
  free:    { maxCustomers: 20,   maxCards: 1 },
  basic:   { maxCustomers: 500,  maxCards: 1 },
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/samuelrodriguez/development/fidelitap && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `plan-limits.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/plan-limits.ts
git commit -m "feat: add plan limits utility"
```

---

## Task 3: PricingSection component

**Files:**
- Create: `src/components/landing/pricing-section.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

type Billing = 'monthly' | 'annual'

const ANNUAL_FACTOR = 10 / 12 // 2 months free

function formatCOP(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

interface PlanFeature {
  text: string
  included: boolean
}

interface PaidPlan {
  key: string
  name: string
  monthlyPrice: number
  perDayCopy: string
  features: PlanFeature[]
  cta: string
  ctaStyle: 'outline' | 'filled'
  highlight: boolean
  roiHint?: string
}

const PAID_PLANS: PaidPlan[] = [
  {
    key: 'basic',
    name: 'Básico',
    monthlyPrice: 49900,
    perDayCopy: 'menos que un café',
    cta: 'Elegir Básico',
    ctaStyle: 'outline',
    highlight: false,
    features: [
      { text: '1 tarjeta de fidelización', included: true },
      { text: 'Hasta 500 clientes activos', included: true },
      { text: 'Apple & Google Wallet', included: true },
      { text: 'Escaneo QR ilimitado', included: true },
      { text: 'Cartel QR imprimible', included: true },
      { text: 'Soporte por email', included: true },
      { text: 'Estadísticas de retención', included: false },
      { text: 'Soporte prioritario', included: false },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyPrice: 99900,
    perDayCopy: 'el costo de perder un cliente',
    cta: 'Quiero el Pro →',
    ctaStyle: 'filled',
    highlight: true,
    roiHint: 'Si recuperas solo 2 clientes recurrentes al mes, el plan se paga solo.',
    features: [
      { text: '10 tarjetas de fidelización', included: true },
      { text: 'Hasta 2.000 clientes activos', included: true },
      { text: 'Apple & Google Wallet', included: true },
      { text: 'Escaneo QR ilimitado', included: true },
      { text: 'Cartel QR imprimible', included: true },
      { text: 'Estadísticas de retención', included: true },
      { text: 'Soporte prioritario', included: true },
      { text: 'Diseño personalizado avanzado', included: true },
    ],
  },
  {
    key: 'premium',
    name: 'Premium',
    monthlyPrice: 179900,
    perDayCopy: 'para negocios en serio',
    cta: 'Elegir Premium',
    ctaStyle: 'outline',
    highlight: false,
    features: [
      { text: 'Tarjetas ilimitadas', included: true },
      { text: 'Clientes ilimitados', included: true },
      { text: 'Apple & Google Wallet', included: true },
      { text: 'Escaneo QR ilimitado', included: true },
      { text: 'Cartel QR imprimible', included: true },
      { text: 'Estadísticas avanzadas + exportar', included: true },
      { text: 'Soporte dedicado (WhatsApp)', included: true },
      { text: 'Acceso anticipado a novedades', included: true },
    ],
  },
]

export function PricingSection() {
  const [billing, setBilling] = useState<Billing>('monthly')
  const isAnnual = billing === 'annual'

  function price(monthlyPrice: number) {
    return formatCOP(isAnnual ? monthlyPrice * ANNUAL_FACTOR : monthlyPrice)
  }

  function perDay(monthlyPrice: number) {
    const daily = (isAnnual ? monthlyPrice * ANNUAL_FACTOR : monthlyPrice) / 30
    return formatCOP(daily)
  }

  function saving(monthlyPrice: number) {
    return formatCOP(monthlyPrice * 2)
  }

  return (
    <section id="precios" className="bg-slate-50 py-20 px-6 border-t border-slate-100">
      <div className="max-w-5xl mx-auto">

        {/* Launch banner */}
        <div className="bg-slate-900 rounded-2xl px-5 py-3.5 flex items-center gap-3 mb-8">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C896] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00C896]" />
          </span>
          <p className="text-sm text-slate-400 flex-1">
            <span className="text-white font-semibold">Precio de lanzamiento</span>
            {' '}— Primeros 100 negocios en Colombia
          </p>
          <span className="text-[10px] font-bold text-[#00C896] border border-[#00C896]/30 bg-[#00C896]/10 rounded-full px-3 py-1 whitespace-nowrap">
            🇨🇴 Oferta fundadores
          </span>
        </div>

        {/* Section header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Planes y precios
          </h2>
          <p className="text-slate-500 text-[15px]">Sin contrato. Cancela cuando quieras.</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setBilling('monthly')}
            className={`text-sm font-semibold transition-colors ${billing === 'monthly' ? 'text-slate-900' : 'text-slate-400'}`}
          >
            Mensual
          </button>
          <button
            onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
            className="relative w-11 h-6 bg-[#00C896] rounded-full"
            aria-label="Cambiar facturación"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isAnnual ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`text-sm font-semibold transition-colors ${billing === 'annual' ? 'text-slate-900' : 'text-slate-400'}`}
          >
            Anual
          </button>
          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 rounded-full px-2.5 py-0.5">
            2 meses gratis
          </span>
        </div>

        {/* Free plan banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center justify-between gap-6 mb-4">
          <div className="flex-1">
            <p className="font-black text-slate-900 text-base mb-0.5">Plan Gratis — para siempre</p>
            <p className="text-slate-500 text-sm mb-3">Empieza sin riesgo. Sin tarjeta de crédito.</p>
            <div className="flex flex-wrap gap-4">
              {['1 tarjeta de sellos', 'Hasta 20 clientes', 'Apple & Google Wallet', 'Escaneo QR', 'Panel de gestión'].map(f => (
                <span key={f} className="text-xs text-slate-500 flex items-center gap-1">
                  <span className="text-[#00C896] font-bold">✓</span> {f}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-black text-slate-900">$0</p>
            <p className="text-xs text-slate-400 mb-2">sin límite de tiempo</p>
            <Link
              href="/register"
              className="text-sm font-bold text-[#00C896] hover:text-[#00b386] transition-colors"
            >
              Empezar gratis →
            </Link>
          </div>
        </div>

        {/* Paid plans grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PAID_PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl p-5 flex flex-col border ${
                plan.highlight
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00C896] text-slate-900 text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap tracking-wide">
                  ★ MÁS POPULAR
                </div>
              )}

              {/* Price block */}
              <p className={`text-sm font-black mb-1.5 ${plan.highlight ? 'text-white' : 'text-slate-900'}`}>
                {plan.name}
              </p>
              <div className="flex items-end gap-2 mb-0.5">
                <span className={`text-3xl font-black leading-none ${plan.highlight ? 'text-[#00C896]' : 'text-slate-900'}`}>
                  {price(plan.monthlyPrice)}
                </span>
                {isAnnual && (
                  <span className="text-sm text-slate-400 line-through mb-0.5">
                    {formatCOP(plan.monthlyPrice)}
                  </span>
                )}
              </div>
              <p className={`text-[11px] mb-1 ${plan.highlight ? 'text-slate-400' : 'text-slate-400'}`}>
                /mes · facturación {isAnnual ? 'anual' : 'mensual'}
              </p>
              <p className="text-[11px] font-semibold text-[#00C896] mb-1">
                ≈ {perDay(plan.monthlyPrice)}/día — {plan.perDayCopy}
              </p>
              {isAnnual && (
                <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-100 rounded-md px-2 py-0.5 w-fit mb-3">
                  Ahorras {saving(plan.monthlyPrice)}/año
                </span>
              )}

              <div className={`border-t my-4 ${plan.highlight ? 'border-white/10' : 'border-slate-100'}`} />

              {/* ROI hint (Pro only) */}
              {plan.roiHint && (
                <div className="bg-[#00C896]/10 border border-[#00C896]/20 rounded-xl p-3 text-[11px] text-emerald-700 leading-relaxed mb-4">
                  💡 {plan.roiHint}
                </div>
              )}

              {/* Features */}
              <ul className="flex flex-col gap-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <li key={f.text} className={`flex items-start gap-2 text-xs leading-snug ${plan.highlight ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span className={`text-sm font-bold shrink-0 ${f.included ? 'text-[#00C896]' : 'text-slate-300'}`}>
                      {f.included ? '✓' : '✕'}
                    </span>
                    {f.text}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={`/register?plan=${plan.key}`}
                className={`block text-center text-sm font-bold py-2.5 rounded-xl transition-colors mt-auto ${
                  plan.ctaStyle === 'filled'
                    ? 'bg-[#00C896] text-slate-900 hover:bg-[#00b386]'
                    : plan.highlight
                      ? 'bg-white text-slate-900 hover:bg-slate-100'
                      : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 mt-6">
          ✓ Sin contrato · Cancela cuando quieras · Todos los planes incluyen actualizaciones de Wallet automáticas
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/samuelrodriguez/development/fidelitap && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/pricing-section.tsx
git commit -m "feat: add PricingSection component with monthly/annual toggle"
```

---

## Task 4: Wire PricingSection into landing page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/landing/cta-section.tsx`

- [ ] **Step 1: Add PricingSection to landing page**

Replace the content of `src/app/page.tsx` with:

```tsx
import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { PricingSection } from '@/components/landing/pricing-section'
import { CtaSection } from '@/components/landing/cta-section'

export default function HomePage() {
  return (
    <div className="bg-white">
      <Navbar />
      <Hero />
      <HowItWorks />
      <PricingSection />
      <CtaSection />
    </div>
  )
}
```

- [ ] **Step 2: Remove `id="precios"` from CtaSection (PricingSection now owns it)**

In `src/components/landing/cta-section.tsx`, change line 7:

```tsx
// Before:
<section id="precios" className="bg-white py-20 px-6 border-t border-slate-100 text-center">

// After:
<section className="bg-white py-20 px-6 border-t border-slate-100 text-center">
```

- [ ] **Step 3: Start dev server and verify**

```bash
cd /Users/samuelrodriguez/development/fidelitap && pnpm dev
```

Open http://localhost:3000 — scroll down and verify:
- Launch banner with pulsing dot appears
- Toggle switches between monthly/annual and prices update
- Annual mode shows struck-through price + savings badge
- Free plan banner is horizontal
- Pro card is dark with green price
- ROI hint appears only on Pro
- Clicking "Empezar gratis →" navigates to /register
- Navbar link `#precios` scrolls to the pricing section

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/landing/cta-section.tsx
git commit -m "feat: integrate PricingSection into landing page"
```

---

## Task 5: Dashboard plan usage component

**Files:**
- Create: `src/components/dashboard/plan-usage.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getPlanLimits, getUsagePct, getUsageState } from '@/lib/plan-limits'

interface PlanUsageProps {
  businessId: string
  plan: string
}

export async function PlanUsage({ businessId, plan }: PlanUsageProps) {
  const supabase = await createClient()

  // Count distinct customers across all loyalty cards for this business
  const { count: customerCount } = await supabase
    .from('customer_cards')
    .select('customer_id', { count: 'exact', head: true })
    .in(
      'loyalty_card_id',
      supabase
        .from('loyalty_cards')
        .select('id')
        .eq('business_id', businessId)
    )

  // Count active loyalty cards for this business
  const { count: cardCount } = await supabase
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('is_active', true)

  const limits = getPlanLimits(plan)
  const customers = customerCount ?? 0
  const cards = cardCount ?? 0

  const customerState = getUsageState(customers, limits.maxCustomers)
  const customerPct = getUsagePct(customers, limits.maxCustomers)
  const cardState = getUsageState(cards, limits.maxCards)

  const showWarning = customerState !== 'ok' || cardState !== 'ok'

  return (
    <div className="px-3 mt-4 flex flex-col gap-2">
      {/* Plan badge */}
      <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Plan actual</p>
        <p className="text-sm font-bold text-white capitalize mb-2">{plan}</p>

        {/* Customer usage */}
        {limits.maxCustomers !== null && (
          <div className="mb-2">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-slate-400">Clientes</span>
              <span className={
                customerState === 'full' ? 'text-red-400 font-bold' :
                customerState === 'warning' ? 'text-amber-400 font-bold' :
                'text-slate-400'
              }>
                {customers}/{limits.maxCustomers}
              </span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  customerState === 'full' ? 'bg-red-500' :
                  customerState === 'warning' ? 'bg-amber-400' :
                  'bg-[#00C896]'
                }`}
                style={{ width: `${customerPct ?? 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Warning message */}
        {customerState === 'full' && (
          <p className="text-[10px] text-red-400 leading-relaxed mb-2">
            Límite alcanzado. No se registrarán nuevos clientes.
          </p>
        )}
        {customerState === 'warning' && (
          <p className="text-[10px] text-amber-400 leading-relaxed mb-2">
            Casi al límite. Quedan {(limits.maxCustomers ?? 0) - customers} espacios.
          </p>
        )}

        {showWarning ? (
          <Link
            href="/settings#plan"
            className="block text-center text-xs font-bold bg-[#00C896] text-slate-900 rounded-lg py-1.5 hover:bg-[#00b386] transition-colors"
          >
            ↑ Actualizar plan
          </Link>
        ) : (
          <Link
            href="/settings#plan"
            className="block text-center text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            Actualizar plan →
          </Link>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/samuelrodriguez/development/fidelitap && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/plan-usage.tsx
git commit -m "feat: add PlanUsage dashboard component with usage bars and warnings"
```

---

## Task 6: Wire PlanUsage into dashboard layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Replace the static plan badge with PlanUsage**

Replace the entire content of `src/app/(dashboard)/layout.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlanUsage } from '@/components/dashboard/plan-usage'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/cards', label: 'Mis tarjetas', icon: '◉' },
  { href: '/customers', label: 'Clientes', icon: '◎' },
  { href: '/scanner', label: 'Escanear', icon: '⌻' },
  { href: '/poster', label: 'Plantilla', icon: '▤' },
  { href: '/settings', label: 'Ajustes', icon: '⚙' },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-slate-800 flex flex-col py-6">
        <Link href="/dashboard" className="px-6 pb-8 text-xl font-black tracking-tight">
          fideli<span className="text-[#00C896]">tap</span>
        </Link>

        <nav className="flex-1 flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <PlanUsage businessId={business.id} plan={business.plan} />
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify the dashboard renders**

With the dev server running, log in and open http://localhost:3000/dashboard.

Verify:
- Sidebar shows plan name
- Customer count bar appears (e.g., "0/20" for a free plan account with no customers)
- Bar color is green when usage is low
- "Actualizar plan →" link appears in subdued style when not at warning level

- [ ] **Step 3: Build check**

```bash
cd /Users/samuelrodriguez/development/fidelitap && pnpm build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx
git commit -m "feat: wire PlanUsage into dashboard sidebar"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✓ Launch banner with pulsing dot → Task 3
- ✓ Monthly/annual toggle → Task 3
- ✓ Free plan horizontal banner → Task 3
- ✓ 3 paid plan cards with features → Task 3
- ✓ Per-day framing copy → Task 3
- ✓ ROI hint on Pro → Task 3
- ✓ Annual savings badge → Task 3
- ✓ Basic plan 1 card → Task 1 (migration) + Task 3 (features list)
- ✓ Plan limits constants → Task 2
- ✓ Dashboard usage bar (80% warning, 100% full) → Task 5
- ✓ Friendly copy on limit states → Task 5
- ✓ Upgrade CTA highlighted when at warning/full → Task 5
- ✓ Data preservation: only `businesses.plan` changes, no deletes → enforced by design (no delete code anywhere)
- ✓ `isAtLimit` helper for future scan endpoint → Task 2

**Type consistency:** `PlanUsage` receives `businessId: string, plan: string` — `layout.tsx` passes `business.id` (uuid string) and `business.plan` (string). ✓

**Placeholder scan:** No TBDs, no "add appropriate error handling" — all code is complete. ✓
