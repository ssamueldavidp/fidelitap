# Pricing Section — Design Spec

## Overview

Add a `PricingSection` component to the FideliTap landing page (`/`). The section replaces the placeholder `#precios` anchor in `CtaSection`. Layout B: free plan as a horizontal banner at the top, three paid plans in a grid below. Monthly/annual billing toggle (client-side only — no subscription backend in this spec).

## Plans & Limits

| Plan    | Price (monthly) | Cards | Max clients |
|---------|----------------|-------|-------------|
| Gratis  | $0             | 1     | 20          |
| Básico  | $49.900 COP    | 1     | 500         |
| Pro     | $99.900 COP    | 10    | 2.000       |
| Premium | $179.900 COP   | ∞     | ∞           |

Annual billing = 10 months price (2 months free, ~17% discount). Displayed as monthly equivalent with original price struck through.

## Components

### `src/components/landing/pricing-section.tsx`

**Client Component** (`'use client'`) — needs `useState` for monthly/annual toggle.

Sections in order:
1. **Launch banner** — dark bg, pulsing green dot, "Precio de lanzamiento — Primeros 100 negocios en Colombia", badge "🇨🇴 Oferta fundadores"
2. **Billing toggle** — "Mensual / Anual" with animated knob, "2 meses gratis" badge beside it
3. **Free banner** — horizontal card, features inline, "$0 sin límite de tiempo", CTA links to `/register`
4. **Paid grid** — 3 columns (Básico / Pro / Premium)
5. **Footer note** — "Sin contrato · Cancela cuando quieras"

### Plan card anatomy (paid plans)

- Plan name
- Price (updates on toggle)
- Struck-through original price (annual only)
- `/mes · facturación mensual|anual`
- Per-day framing (updates on toggle):
  - Básico: "≈ $X/día — menos que un café"
  - Pro: "≈ $X/día — el costo de perder un cliente"
  - Premium: "≈ $X/día — para negocios en serio"
- Annual savings badge (hidden when monthly, shown when annual)
- Divider
- ROI hint (Pro only): "Si recuperas solo 2 clientes recurrentes al mes, el plan se paga solo."
- Feature list with ✓ / ✕
- CTA button

### CTA copy per plan

| Plan    | CTA text           | Style    |
|---------|--------------------|----------|
| Básico  | "Elegir Básico"    | outline  |
| Pro     | "Quiero el Pro →"  | filled green |
| Premium | "Elegir Premium"   | outline  |

All paid CTAs link to `/register` (query param `?plan=basic|pro|premium` for future use).

## Feature matrix

| Feature                    | Gratis | Básico | Pro | Premium |
|---------------------------|--------|--------|-----|---------|
| Tarjetas de fidelización  | 1      | 1      | 10  | ∞       |
| Clientes activos          | 20     | 500    | 2.000 | ∞    |
| Apple & Google Wallet     | ✓      | ✓      | ✓   | ✓       |
| Escaneo QR ilimitado      | ✓      | ✓      | ✓   | ✓       |
| Cartel QR imprimible      | ✗      | ✓      | ✓   | ✓       |
| Soporte por email         | ✗      | ✓      | ✓   | ✓       |
| Estadísticas de retención | ✗      | ✗      | ✓   | ✓       |
| Soporte prioritario       | ✗      | ✗      | ✓   | ✓       |
| Diseño personalizado avz. | ✗      | ✗      | ✓   | ✓       |
| Soporte dedicado (WA)     | ✗      | ✗      | ✗   | ✓       |
| Acceso anticipado         | ✗      | ✗      | ✗   | ✓       |

## Integration with landing page

`src/app/page.tsx` currently:
```tsx
<Navbar />
<Hero />
<HowItWorks />
<CtaSection />
```

`CtaSection` (`src/components/landing/cta-section.tsx`) returns a Fragment with `<section id="precios">` + `<footer>`. The pricing section inserts **before** `CtaSection`:

```tsx
<Navbar />
<Hero />
<HowItWorks />
<PricingSection />   // new
<CtaSection />
```

`CtaSection`'s `<section id="precios">` anchor can be removed or kept as the CTA below pricing.

## Styling constraints

- Dark mode palette: `#0f172a` bg, `#00C896` accent, consistent with rest of landing
- The landing page uses Tailwind — `PricingSection` uses Tailwind classes only, no separate CSS file
- Pro card: dark bg (`bg-slate-900`), `#00C896` price
- Toggle animation: CSS transition on knob position
- Pulsing dot: `animate-ping` or keyframe animation

## Plan Limits & Upgrade Experience

This is a core product requirement. No data is ever deleted or blocked when a business reaches a limit or changes plans. The experience must feel helpful, not punitive.

### Limit enforcement rules

| Plan    | Client limit | Card limit |
|---------|-------------|------------|
| Gratis  | 20          | 1          |
| Básico  | 500         | 1          |
| Pro     | 2.000       | 10         |
| Premium | ∞           | ∞          |

Limits are checked in two places:
1. **Scan endpoint** — before registering a new client stamp, check if `current_clients >= plan_limit`. If at limit: reject the scan and return a friendly error.
2. **Dashboard** — show usage bar and warnings as the business approaches their limit.

### Warning states (dashboard)

| Usage     | State          | Behavior |
|-----------|----------------|----------|
| < 80%     | Normal         | Show usage count only |
| 80–99%    | Warning        | Yellow banner: "Estás llegando al límite de tu plan. Tienes X espacios restantes." + upgrade CTA |
| 100%      | Full — soft    | Orange banner: "Alcanzaste el límite de X clientes. Los clientes actuales siguen activos, pero no se registrarán nuevos hasta que actualices tu plan." |
| New scan at 100% | Full — hard | Scan fails silently for the end customer. Business owner sees in dashboard: "Intento de registro bloqueado — actualiza tu plan para aceptar más clientes." |

### What happens on scan when at limit

The QR scan endpoint returns a response that the kiosk/app handles:
- If client **already exists** in the business → stamp normally (no block, the client is already registered)
- If client is **new** and business is at limit → return `{ error: 'limit_reached', upgrade_url: '/dashboard/plan' }`

The end customer never sees a cold error — the kiosk/app shows a generic "Algo salió mal, intenta de nuevo" and the business owner sees the blocked attempt in their dashboard.

### Upgrade flow (no payment backend yet)

Until Stripe is integrated, the upgrade CTA leads to a contact/waitlist form or a WhatsApp link. The `plan` field on the `businesses` table is updated manually by the admin. When it changes:
- New limits apply immediately (no restart, no data loss)
- New features unlock immediately (feature flags read `business.plan` at render time)
- All existing clients, stamps, and card history remain intact — nothing is deleted

### Data preservation guarantee

Plan changes only update `businesses.plan` (a single string field). All client records, stamp history, and loyalty cards belong to the business and are independent of the plan. Downgrading (future) will soft-lock access to features above the new limit but **never delete data**.

### Feature flags by plan

Features gated by plan are checked server-side in the dashboard layout or individual pages:

| Feature                   | Gratis | Básico | Pro | Premium |
|--------------------------|--------|--------|-----|---------|
| Multiple cards (>1)      | ✗      | ✗      | ✓   | ✓       |
| Estadísticas avanzadas   | ✗      | ✗      | ✓   | ✓       |
| Diseño personalizado avz.| ✗      | ✗      | ✓   | ✓       |
| Soporte dedicado (WA)    | ✗      | ✗      | ✗   | ✓       |
| Exportar datos           | ✗      | ✗      | ✗   | ✓       |

Locked features show a "Desbloquea con Plan X" badge instead of the feature UI — never a blank or broken page.

## Out of scope (this spec)

- Stripe / payment processing (separate spec)
- Automatic plan downgrades / dunning
- Email alerts when approaching limits (separate notification spec)
