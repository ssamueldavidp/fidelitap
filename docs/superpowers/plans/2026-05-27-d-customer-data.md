# FideliTap v2 — D: Extended Customer Data Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the public card activation form (`/c/[slug]`) to collect optional marketing data (birthday, city, gender, marketing consent) based on the business's plan tier. Add these columns to the customer list in `/customers`. Add CSV export for Pro+ plans.

**Architecture:** The public activation form reads the business's plan from the loyalty card query and conditionally renders extra fields. The `activateCardAction` server action saves the new fields to `customers` table. The `/customers` page gets new columns and a CSV export button (plan-gated). No new routes needed.

**Tech Stack:** Next.js 14 Server Actions + Server Components, Zod validation, Tailwind CSS

**Prerequisite:** Plan A1 migrations applied (needs `customers.birthday/gender/city/marketing_consent` columns).

---

## File Map

- Modify: `src/app/c/[slug]/page.tsx` — pass plan to ActivateForm
- Modify: `src/app/c/[slug]/activate-form.tsx` — render extra fields based on plan
- Modify: `src/app/c/[slug]/actions.ts` — save new fields, validate, handle existing customers
- Modify: `src/app/(dashboard)/customers/page.tsx` — new columns, CSV export button
- Create: `src/app/api/customers/export/route.ts` — CSV export API (Pro+)

---

### Task 1: Update public card page to pass business plan to form

**Files:**
- Modify: `src/app/c/[slug]/page.tsx`

The page must fetch the business `plan` from the loyalty card query and pass it to `ActivateForm`.

- [ ] **Step 1: Read current `src/app/c/[slug]/page.tsx`**

```bash
cat "src/app/c/[slug]/page.tsx"
```

- [ ] **Step 2: Update the query to include the business plan**

Find the Supabase query in the page that fetches the loyalty card. It currently selects from `loyalty_cards` joined with `businesses`. Update the `businesses` select to include `plan`:

Before (approximate):
```typescript
const { data: card } = await supabase
  .from('loyalty_cards')
  .select('id, name, ..., businesses(id, name, ...)')
  .eq('slug', slug)
  ...
```

After (add `plan` to businesses select):
```typescript
const { data: card } = await supabase
  .from('loyalty_cards')
  .select('id, name, ..., businesses(id, name, plan, ...)')
  .eq('slug', slug)
  ...
```

Then pass `businessPlan={card.businesses.plan}` to `<ActivateForm>`.

The exact edit depends on the current file. Read it first, then make the minimal targeted change to add `plan` to the businesses select and pass it as a prop.

- [ ] **Step 3: Update ActivateForm props interface to accept `businessPlan`**

In `activate-form.tsx`, update the interface:
```typescript
interface ActivateFormProps {
  loyaltyCardId: string
  businessId: string
  businessPlan: string   // ADD THIS
}
```

And update the function signature:
```typescript
export function ActivateForm({ loyaltyCardId, businessId, businessPlan }: ActivateFormProps) {
```

- [ ] **Step 4: Commit this prep work**

```bash
git add "src/app/c/[slug]/page.tsx" "src/app/c/[slug]/activate-form.tsx"
git commit -m "feat(activate): pass businessPlan to ActivateForm"
```

---

### Task 2: Add conditional marketing fields to ActivateForm

**Files:**
- Modify: `src/app/c/[slug]/activate-form.tsx`

The form renders extra fields based on `businessPlan`:
- All plans: name (required), email (required), phone (optional)
- `basic` or higher: birthday (optional), city (optional)
- `pro` or higher: gender (optional), marketing consent checkbox

- [ ] **Step 1: Replace `activate-form.tsx` with the extended version**

```typescript
// src/app/c/[slug]/activate-form.tsx
'use client'

import { useState, useTransition } from 'react'
import { activateCardAction } from './actions'
import { SuccessScreen } from './success-screen'

interface ActivateFormProps {
  loyaltyCardId: string
  businessId: string
  businessName: string
  businessPlan: string
}

function meetsMinPlan(current: string, min: string): boolean {
  const order = ['free', 'basic', 'pro', 'premium']
  return order.indexOf(current) >= order.indexOf(min)
}

export function ActivateForm({ loyaltyCardId, businessId, businessName, businessPlan }: ActivateFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)
  const [result, setResult]          = useState<{
    customerCardId: string
    walletAuthToken: string
    alreadyHadCard: boolean
  } | null>(null)
  const [marketingConsent, setMarketingConsent] = useState(false)

  const showBirthdayCity   = meetsMinPlan(businessPlan, 'basic')
  const showGenderMarketing = meetsMinPlan(businessPlan, 'pro')

  if (result) return <SuccessScreen {...result} />

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.append('loyalty_card_id', loyaltyCardId)
    fd.append('business_id', businessId)
    fd.append('marketing_consent', marketingConsent ? 'true' : 'false')

    startTransition(async () => {
      const res = await activateCardAction(fd)
      if ('error' in res) {
        setError(res.error)
      } else {
        setResult(res)
      }
    })
  }

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00C896]"
  const labelCls = "block text-xs text-slate-400 mb-1.5"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Required fields — all plans */}
      <div>
        <label className={labelCls}>Tu nombre *</label>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder="Ej: María García"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Tu email *</label>
        <input
          name="email"
          type="email"
          required
          placeholder="Ej: maria@gmail.com"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Teléfono (opcional)</label>
        <input
          name="phone"
          type="tel"
          placeholder="Ej: 3001234567"
          className={inputCls}
        />
      </div>

      {/* Basic+ fields */}
      {showBirthdayCity && (
        <>
          <div>
            <label className={labelCls}>Fecha de nacimiento (opcional)</label>
            <input
              name="birthday"
              type="date"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Ciudad (opcional)</label>
            <input
              name="city"
              placeholder="Ej: Bogotá"
              maxLength={80}
              className={inputCls}
            />
          </div>
        </>
      )}

      {/* Pro+ fields */}
      {showGenderMarketing && (
        <>
          <div>
            <label className={labelCls}>Género (opcional)</label>
            <select name="gender" className={inputCls} defaultValue="">
              <option value="">Prefiero no decir</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
              <option value="other">Otro</option>
              <option value="prefer_not">Prefiero no decir</option>
            </select>
          </div>

          <div className="flex items-start gap-3 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <input
              type="checkbox"
              id="marketing_consent"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-0.5 accent-[#00C896]"
            />
            <label htmlFor="marketing_consent" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
              Acepto recibir comunicaciones de marketing de {businessName} sobre promociones y ofertas especiales.
            </label>
          </div>
        </>
      )}

      {/* Privacy notice */}
      <p className="text-xs text-slate-600 leading-relaxed">
        Tus datos son usados por {businessName} para su programa de fidelización.
        Puedes solicitar su eliminación escribiendo al negocio directamente.
      </p>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-[#00C896] text-slate-900 font-bold text-sm rounded-xl py-3 hover:bg-[#00b386] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Activando...' : 'Activar mi tarjeta'}
      </button>

      <p className="text-xs text-slate-600 text-center">
        Sin contraseña. Solo nombre y email son obligatorios.
      </p>
    </form>
  )
}
```

Note: `businessName` is needed for the privacy notice and marketing consent label. Update the `ActivateFormProps` to include it if not already passed from the page.

- [ ] **Step 2: Commit**

```bash
git add "src/app/c/[slug]/activate-form.tsx"
git commit -m "feat(activate): extended form with birthday, city, gender, marketing consent"
```

---

### Task 3: Update activateCardAction to save marketing fields

**Files:**
- Modify: `src/app/c/[slug]/actions.ts`

- [ ] **Step 1: Replace the full `actions.ts` with the extended version**

```typescript
// src/app/c/[slug]/actions.ts
'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { generateUniqueCode } from '@/lib/wallet/hmac'
import { sendCustomerWelcome } from '@/lib/email/send-customer-welcome'

const schema = z.object({
  name:              z.string().min(2, 'Mínimo 2 caracteres').max(80).trim(),
  email:             z.string().email('Email inválido').toLowerCase(),
  loyalty_card_id:   z.string().uuid(),
  business_id:       z.string().uuid(),
  // Optional fields
  phone:             z.string().max(30).optional().nullable(),
  birthday:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  city:              z.string().max(80).optional().nullable(),
  gender:            z.enum(['M', 'F', 'other', 'prefer_not', '']).optional().nullable(),
  marketing_consent: z.string().optional(), // 'true' | 'false' from formData
})

export type ActivateResult =
  | { error: string }
  | { customerCardId: string; walletAuthToken: string; alreadyHadCard: boolean }

export async function activateCardAction(formData: FormData): Promise<ActivateResult> {
  const rawData = {
    name:              formData.get('name'),
    email:             formData.get('email'),
    loyalty_card_id:   formData.get('loyalty_card_id'),
    business_id:       formData.get('business_id'),
    phone:             formData.get('phone') || null,
    birthday:          formData.get('birthday') || null,
    city:              formData.get('city') || null,
    gender:            formData.get('gender') || null,
    marketing_consent: formData.get('marketing_consent') ?? 'false',
  }

  const parsed = schema.safeParse(rawData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const {
    name, email, loyalty_card_id, business_id,
    phone, birthday, city, gender, marketing_consent,
  } = parsed.data

  const consentBool = marketing_consent === 'true'
  // Only save optional fields if marketing_consent is given (or they're just basic fields)
  const optionalFields = {
    ...(phone    ? { phone }    : {}),
    ...(birthday ? { birthday } : {}),
    ...(city     ? { city }     : {}),
    ...(gender && gender !== '' ? { gender } : {}),
    marketing_consent: consentBool,
  }

  const supabase = createServiceClient()

  // Fetch card slug + business name for the welcome email
  const { data: cardInfo } = (await supabase
    .from('loyalty_cards')
    .select('slug, businesses(name)')
    .eq('id', loyalty_card_id)
    .single()) as { data: { slug: string; businesses: { name: string } | null } | null; error: unknown }

  // 1. Find or create customer
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!customer) {
    const { data: newCustomer, error: insertErr } = await supabase
      .from('customers')
      .insert({ email, name, ...optionalFields })
      .select('id')
      .single()
    if (insertErr || !newCustomer) return { error: 'Error al registrarte. Intenta de nuevo.' }
    customer = newCustomer
  } else {
    // Update optional fields for returning customers if they provided them
    const hasOptional = Object.keys(optionalFields).some(
      (k) => k !== 'marketing_consent' && optionalFields[k as keyof typeof optionalFields] !== undefined,
    )
    if (hasOptional || consentBool) {
      await supabase
        .from('customers')
        .update(optionalFields)
        .eq('id', customer.id)
    }
  }

  // 2. Find or create customer_card
  const { data: existing } = await supabase
    .from('customer_cards')
    .select('id, wallet_auth_token')
    .eq('customer_id', customer.id)
    .eq('loyalty_card_id', loyalty_card_id)
    .maybeSingle()

  if (existing) {
    return {
      customerCardId:  existing.id,
      walletAuthToken: existing.wallet_auth_token!,
      alreadyHadCard:  true,
    }
  }

  // Pre-generate ID so we can use it in unique_code
  const newId       = crypto.randomUUID()
  const unique_code = generateUniqueCode(newId, business_id)

  const { data: newCard, error: cardErr } = await supabase
    .from('customer_cards')
    .insert({
      id: newId,
      customer_id:       customer.id,
      loyalty_card_id,
      unique_code,
      wallet_pass_serial: crypto.randomUUID(),
      wallet_auth_token:  crypto.randomUUID(),
    })
    .select('id, wallet_auth_token')
    .single()

  if (cardErr || !newCard) return { error: 'Error al activar la tarjeta. Intenta de nuevo.' }

  // Send welcome email fire-and-forget
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const biz    = cardInfo?.businesses
  if (biz && cardInfo?.slug) {
    void sendCustomerWelcome({
      to:           email,
      customerName: name,
      businessName: biz.name,
      cardUrl:      `${appUrl}/c/${cardInfo.slug}`,
    })
  }

  return {
    customerCardId:  newCard.id,
    walletAuthToken: newCard.wallet_auth_token!,
    alreadyHadCard:  false,
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/c/[slug]/actions.ts"
git commit -m "feat(activate): save birthday, city, gender, marketing_consent fields"
```

---

### Task 4: Add marketing columns to customers list page

**Files:**
- Modify: `src/app/(dashboard)/customers/page.tsx`

- [ ] **Step 1: Read the current customers page**

```bash
cat src/app/(dashboard)/customers/page.tsx
```

- [ ] **Step 2: Update the Supabase query to include marketing columns**

Find the query that fetches customers. Add these columns to the select:
```typescript
.select('id, name, email, phone, birthday, city, marketing_consent, created_at, ...')
```

- [ ] **Step 3: Add City and Marketing consent columns to the table**

In the table header row, add:
```tsx
<th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Ciudad</th>
<th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Marketing</th>
```

In each customer row, add:
```tsx
<td className="px-4 py-3 text-sm text-muted-foreground">{customer.city ?? '—'}</td>
<td className="px-4 py-3">
  {customer.marketing_consent ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-950 text-green-400 text-xs font-medium">
      Sí
    </span>
  ) : (
    <span className="text-muted-foreground text-xs">No</span>
  )}
</td>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/customers/page.tsx
git commit -m "feat(customers): show city and marketing_consent columns"
```

---

### Task 5: CSV export API route (Pro+ plan only)

**Files:**
- Create: `src/app/api/customers/export/route.ts`

- [ ] **Step 1: Create the export route**

```typescript
// src/app/api/customers/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { meetsMinPlan } from '@/lib/plan-guard'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single()

  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  if (!meetsMinPlan(business.plan, 'pro')) {
    return NextResponse.json(
      { error: 'Exportar CSV requiere el plan Pro o superior.' },
      { status: 403 },
    )
  }

  const serviceClient = createServiceClient()

  // Fetch all customers for this business via customer_cards join
  const { data: rows } = await serviceClient
    .from('customer_cards')
    .select(`
      customers (
        name,
        email,
        phone,
        birthday,
        gender,
        city,
        marketing_consent,
        created_at
      ),
      loyalty_cards!inner ( business_id )
    `)
    .eq('loyalty_cards.business_id', business.id)

  if (!rows) return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 })

  // Build CSV
  const headers = ['Nombre', 'Email', 'Teléfono', 'Cumpleaños', 'Género', 'Ciudad', 'Consentimiento marketing', 'Fecha registro']
  const csvRows = rows
    .map((r) => {
      const c = r.customers as {
        name: string; email: string; phone: string | null;
        birthday: string | null; gender: string | null; city: string | null;
        marketing_consent: boolean; created_at: string;
      } | null
      if (!c) return null
      return [
        c.name,
        c.email,
        c.phone ?? '',
        c.birthday ?? '',
        c.gender ?? '',
        c.city ?? '',
        c.marketing_consent ? 'Sí' : 'No',
        new Date(c.created_at).toLocaleDateString('es-CO'),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    })
    .filter(Boolean)

  const csv = [headers.join(','), ...csvRows].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="clientes.csv"',
    },
  })
}
```

- [ ] **Step 2: Add CSV export button to customers page (Pro+ only)**

In `src/app/(dashboard)/customers/page.tsx`, the page fetches `business.plan`. Add this button near the page header (only shown for Pro+ plans):

```tsx
{meetsMinPlan(business.plan, 'pro') && (
  <a
    href="/api/customers/export"
    className="flex items-center gap-1.5 text-sm bg-card border border-border text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
  >
    Exportar CSV
  </a>
)}
```

Import `meetsMinPlan` from `@/lib/plan-guard` in the page.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/customers/export/route.ts \
        src/app/(dashboard)/customers/page.tsx
git commit -m "feat(customers): CSV export API for Pro+ plans"
```

---

### Task 6: Smoke test the activation flow

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test with a free plan business**

1. Open any card's public URL (`/c/[slug]`)
2. Verify form shows: name, email, phone only (no birthday, city, gender, consent)
3. Submit and verify customer is created successfully

- [ ] **Step 3: Test with a pro plan business (requires seeded test account from Plan E3)**

1. Open a Pro plan card's public URL
2. Verify form shows all fields including gender and marketing consent checkbox
3. Submit with consent checked → verify `marketing_consent = true` in DB:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "SELECT name, email, birthday, city, gender, marketing_consent FROM customers ORDER BY created_at DESC LIMIT 5;"
```

- [ ] **Step 4: Test CSV export**

Navigate to `http://localhost:3000/api/customers/export` while logged in as Pro+ user → verify CSV downloads with all columns.
