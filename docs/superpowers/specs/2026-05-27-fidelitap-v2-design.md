# FideliTap v2 — Full Feature Design Spec

**Date:** 2026-05-27  
**Status:** Approved by user

---

## Overview

Five independent sub-projects to complete FideliTap as a production-ready SaaS:

- **A** — DB migrations + MercadoPago recurring subscriptions
- **B** — Card completion reward states + scanner claim flow
- **C** — User profile page (account + subscription + usage)
- **D** — Extended customer data capture (marketing fields)
- **E** — Critical fixes (poster export, dark mode, seeds)

---

## Sub-project A: Database + MercadoPago Subscriptions

### A1 — Database Migrations

**Migration 1: businesses — MP subscription fields**
```sql
ALTER TABLE public.businesses
  ADD COLUMN mp_preapproval_id     TEXT,
  ADD COLUMN mp_payer_email        TEXT,
  ADD COLUMN subscription_end_date TIMESTAMPTZ;

-- Update subscription_status check to include 'pending_cancel'
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_subscription_status_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_subscription_status_check
  CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'pending_cancel', 'trialing'));
```

**Migration 2: customer_cards — reward status**
```sql
ALTER TABLE public.customer_cards
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'ready_to_claim', 'claimed'));
```

**Migration 3: customers — marketing fields**
```sql
ALTER TABLE public.customers
  ADD COLUMN birthday          DATE,
  ADD COLUMN gender            TEXT CHECK (gender IN ('M', 'F', 'other', 'prefer_not')),
  ADD COLUMN city              TEXT,
  ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT false;
```

**Migration 4: payment_events table**
```sql
CREATE TABLE public.payment_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  mp_payment_id    TEXT,
  mp_preapproval_id TEXT,
  event_type       TEXT NOT NULL, -- 'subscription_created', 'payment_success', 'payment_failed', 'subscription_cancelled'
  plan_slug        TEXT,
  amount_cop       INT,
  status           TEXT,
  raw_payload      JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_events_business_id ON public.payment_events(business_id);
CREATE INDEX idx_payment_events_created_at  ON public.payment_events(created_at DESC);
```

### A2 — MercadoPago Preapproval Plans (server-side setup)

MercadoPago uses two-level structure:
- `preapproval_plan`: the recurring template (price, frequency, name)
- `preapproval`: a customer's subscription to a plan

**Plan IDs stored in env vars** (created once via MP API, not on every checkout):
```
MP_PLAN_ID_BASIC=<id from MP dashboard>
MP_PLAN_ID_PRO=<id from MP dashboard>
MP_PLAN_ID_PREMIUM=<id from MP dashboard>
```

### A3 — API Routes

**POST `/api/subscriptions/create`**
- Auth required (user must be logged in)
- Body: `{ planSlug: 'basic' | 'pro' | 'premium' }`
- Creates MP preapproval with:
  - `preapproval_plan_id`: from env var
  - `payer_email`: from user's business email
  - `back_url`: `${APP_URL}/dashboard?subscription=success`
  - `reason`: `FideliTap Plan ${planName}`
  - `auto_recurring`: `{ frequency: 1, frequency_type: 'months', transaction_amount: <price>, currency_id: 'COP' }`
- Returns `{ init_point: string }` — frontend redirects to this URL

**POST `/api/webhooks/mercadopago`**
- Public endpoint (no auth) — verified via MP signature header `x-signature`
- Handles:
  - `preapproval` topic → GET preapproval from MP → update businesses
  - `payment` topic → record payment_event
- Logic:
  ```
  if preapproval.status === 'authorized':
    businesses.plan = plan_from_preapproval
    businesses.subscription_status = 'active'
    businesses.mp_preapproval_id = preapproval.id
    businesses.subscription_end_date = NULL (auto-renewing)
    record payment_event (type: 'payment_success')

  if preapproval.status === 'cancelled':
    businesses.subscription_status = 'canceled'
    businesses.plan = 'free'
    record payment_event (type: 'subscription_cancelled')

  if preapproval.status === 'paused' or payment failed:
    businesses.subscription_status = 'past_due'
    record payment_event (type: 'payment_failed')
  ```

**POST `/api/subscriptions/cancel`**
- Auth required
- PUT to `https://api.mercadopago.com/preapproval/{id}` with `{ status: 'cancelled' }`
- Set `subscription_status = 'pending_cancel'`
- Calculate `subscription_end_date` = current period end (next billing date)
- Return `{ availableUntil: Date }`

**GET `/api/subscriptions/status`**
- Returns current plan, status, next_billing_date, payment history

### A4 — Frontend: Pricing Page + Upgrade Flow

**`/settings` → tab "Suscripción"**:
- Shows current plan card
- Shows "Próximo cobro: 27 junio 2026 — $49.900"
- Shows "Cancelar suscripción" button
- Shows plan comparison table with "Actualizar" buttons

**Upgrade flow**:
```
Click "Actualizar a Pro" 
→ POST /api/subscriptions/create { planSlug: 'pro' }
→ redirect to init_point (MercadoPago hosted page)
→ User pays → MP redirects to /dashboard?subscription=success
→ Webhook fires in background, updates plan
→ Dashboard shows success toast + new plan badge
```

**Cancel flow**:
```
Click "Cancelar" → confirmation modal
→ POST /api/subscriptions/cancel
→ Show: "Tu plan Pro estará activo hasta el 27 de junio"
→ subscription_status = 'pending_cancel'
```

**`/pricing` public page**: Plan comparison table, "Empezar gratis" + "Suscribirme" CTAs.

### A5 — Plan Enforcement Middleware

File: `src/lib/plan-guard.ts`
- `requirePlan(minPlan, currentPlan)`: throws/redirects if plan insufficient
- Applied in API routes and Server Actions that are plan-gated
- Plans hierarchy: free < basic < pro < premium

---

## Sub-project B: Card Completion Reward States

### B1 — Database (see Migration 2 above)

`customer_cards.status` states:
- `active` — normal, collecting stamps
- `ready_to_claim` — stamps complete, prize not yet claimed by merchant
- `claimed` — merchant confirmed prize was given, stamps reset

### B2 — Scanner Action Changes

File: `src/app/(dashboard)/scanner/actions.ts`

When `addStampAction` detects completion (currentStamps >= stampsRequired):
- Set `status = 'ready_to_claim'` (NOT reset immediately)
- Return `{ ..., isComplete: true, status: 'ready_to_claim' }`

New action: `claimRewardAction(customerCardId)`:
- Verify card status === 'ready_to_claim'
- Reset: `current_stamps = 0`, `status = 'active'`, `times_completed += 1`
- Insert stamp_event with type `'reward_claimed'`
- Returns updated card data

### B3 — Scanner UI Changes

**Success state when `isComplete: true`:**
- Full-screen celebration overlay
- Confetti animation (CSS-only, no library)
- Shows: prize description prominently
- Two buttons: **"Reclamar premio"** (primary) + **"Escanear otro"** (secondary)
- Tapping "Reclamar premio" → calls `claimRewardAction` → shows "Premio registrado ✓" → resets

**Stamp progress after claim:**
- Stamps reset to 0 visually
- Counter shows `0 / N`

---

## Sub-project C: User Profile Page

### C1 — Route: `/settings` (replaces current settings)

Tabs:
1. **Cuenta** — Display name, email (read-only), change password form
2. **Suscripción** — Plan card, next billing, payment history table, cancel/upgrade actions
3. **Consumo** — Usage bars: clients used / limit, cards used / limit

### C2 — Account Tab

- `updateProfileAction(formData)`: updates `businesses.name` (display name)
- Change password: uses `supabase.auth.updateUser({ password })`
- Profile photo: upload to Supabase Storage `avatars/` bucket, store URL in `businesses.avatar_url`

**DB addition needed:**
```sql
ALTER TABLE public.businesses ADD COLUMN avatar_url TEXT;
```

### C3 — Subscription Tab

Shows:
- Current plan badge (colored by plan tier)
- Status: active (green) / pending_cancel (amber) / canceled (red)
- If pending_cancel: "Activo hasta [subscription_end_date]"
- If active: "Próximo cobro: [date] — $[amount]"
- Plan feature comparison with current plan highlighted
- "Cambiar plan" → links to plan selection
- "Cancelar suscripción" → confirmation modal → POST /api/subscriptions/cancel

Payment history table:
- Date | Plan | Amount | Status
- From `payment_events` table, ordered by created_at DESC

### C4 — Usage Tab

- Clients: progress bar `current/limit`, color-coded (green/amber/red)
- Cards: progress bar `current/limit`
- "Actualizar plan" CTA if near limit

---

## Sub-project D: Extended Customer Data Capture

### D1 — Public card activation page `/c/[code]`

Current: asks name, email, phone (optional).

New form based on business plan tier:
- **All plans**: name (required), email (required), phone (optional)
- **Basic+**: birthday (optional), city (optional)
- **Pro+**: gender (optional), marketing consent checkbox (required to show)

Privacy notice: "Tus datos son usados por [BusinessName] para su programa de fidelización. Puedes solicitar su eliminación escribiendo a [email]."

### D2 — Server Action changes

`activateCardAction(formData)`:
- Validate required fields
- If marketing_consent checked → save all optional fields
- Store in `customers` table with new columns
- Existing customers (by email): update optional fields if provided

### D3 — Business customers view `/customers`

New columns in customer table:
- Birthday (if available)
- City (if available)
- Marketing consent badge

CSV export button (Pro+ plan only): exports customer list with all fields.

---

## Sub-project E: Critical Fixes

### E1 — Poster Export Fix

**Current error**: `Unsupported OpenType signature` in `@resvg/resvg-js`

**Root cause**: The font file being loaded is either corrupted, wrong format, or has a bad header. `@resvg/resvg-js` is strict about font format.

**Fix**:
1. Check what font is being loaded in `src/app/api/poster/[cardId]/route.ts`
2. Replace with a bundled font that's confirmed OTF/TTF compliant
3. Use `Inter` font as base — download the TTF from Google Fonts and bundle at `src/fonts/Inter-Regular.ttf` and `src/fonts/Inter-Bold.ttf`
4. Load with `fs.readFileSync` in the API route

### E2 — Dark Mode Contrast Fixes

Audit all pages for:
- Any remaining `text-white` on dynamic backgrounds
- Any `text-slate-*` that wasn't caught
- Input placeholder contrast in light mode
- Focus ring visibility in both modes

Files to check:
- `src/app/(dashboard)/cards/` pages
- `src/app/(dashboard)/customers/` page
- `src/app/(dashboard)/settings/` page
- `src/app/(dashboard)/poster/` page
- `src/components/cards/card-editor.tsx`

### E3 — Seeds: Test Users (4 plans)

File: `supabase/seed.sql` (runs on `supabase db reset`)

Creates 4 auth users + businesses with different plans:
- `test-free@fidelitap.app` / plan: free
- `test-basic@fidelitap.app` / plan: basic
- `test-pro@fidelitap.app` / plan: pro
- `test-premium@fidelitap.app` / plan: premium

Password for all: stored ONLY in `.env.local` as `SEED_TEST_PASSWORD`.  
**Never hardcoded in seed.sql** — seed.sql reads from a variable or uses a deterministic bcrypt hash generated at seed time.

In practice for local dev: seed creates users via `supabase.auth.admin.createUser()` in a separate `scripts/seed-test-users.ts` script run with `npx tsx scripts/seed-test-users.ts`.

---

## Security Notes

- MP webhook: verify `x-signature` header using MP SDK before processing
- All subscription mutations: server-side only, verify `user.id` owns the business
- Plan enforcement: always check server-side, never trust client-passed plan
- Credentials: `MP_ACCESS_TOKEN` never sent to client; `MP_PUBLIC_KEY` is safe for client (it's public by design)
- Seed passwords: never in git, only in `.env.local`

---

## Implementation Order

1. **E1** — Fix poster export (quick win, unblocks testing)
2. **A1** — DB migrations (foundation for everything)
3. **B** — Reward states (high impact, visible, no external deps)
4. **A2-A5** — MercadoPago subscriptions (most complex)
5. **C** — Profile page
6. **D** — Customer data capture
7. **E2** — Dark mode fixes
8. **E3** — Seeds
