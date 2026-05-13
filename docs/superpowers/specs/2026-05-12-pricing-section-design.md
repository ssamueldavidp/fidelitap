# Pricing Section — Design Spec

## Overview

Add a `PricingSection` component to the FideliTap landing page (`/`). The section replaces the placeholder `#precios` anchor in `CtaSection`. Layout B: free plan as a horizontal banner at the top, three paid plans in a grid below. Monthly/annual billing toggle (client-side only — no subscription backend in this spec).

## Plans & Limits

| Plan    | Price (monthly) | Cards | Max clients |
|---------|----------------|-------|-------------|
| Gratis  | $0             | 1     | 20          |
| Básico  | $49.900 COP    | 3     | 500         |
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
| Tarjetas de fidelización  | 1      | 3      | 10  | ∞       |
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

## Out of scope

- Actual payment/subscription processing (Stripe, etc.)
- Plan enforcement in the dashboard
- Email confirmation flows per plan
