# Email Notifications con Resend — Design Spec

**Date:** 2026-05-18
**Status:** Approved
**Plan number:** 8

---

## 1. Goal

Send three transactional emails via Resend using React Email templates: a welcome to new businesses, a welcome to new customers when they activate their first loyalty card, and a completion notification when a customer fills a stamp card.

---

## 2. Scope

**In scope:**
- Install `@react-email/components` and `@react-email/render`
- `src/lib/email/` module: Resend client + 3 templates + 3 send functions
- Trigger business-welcome from `registerAction`
- Trigger customer-welcome from `activateCardAction` (new card only)
- Trigger card-complete from `addStampAction` (when `isComplete === true`)

**Out of scope:**
- Email unsubscribe / preferences — future plan
- Bulk/campaign emails — not transactional
- Email previews in dashboard — future plan
- Supabase Edge Functions or webhooks — all triggers are in existing Server Actions

---

## 3. New Dependency

```
@react-email/components   ^0.0.x   — pre-built email primitives
@react-email/render       ^1.x     — renders JSX → HTML string
```

Both are devDependencies-safe but installed as regular dependencies since `render()` runs server-side at send time.

---

## 4. Environment Variables

```
RESEND_API_KEY=re_...
RESEND_FROM=FideliTap <noreply@fidelitap.co>
```

`NEXT_PUBLIC_APP_URL` already exists (e.g. `https://fidelitap.co`). Used to build absolute links in emails.

---

## 5. File Structure

```
src/lib/email/
  client.ts                      — Resend singleton
  templates/
    business-welcome.tsx         — React Email template
    customer-welcome.tsx         — React Email template
    card-complete.tsx            — React Email template
  send-business-welcome.ts       — typed send function
  send-customer-welcome.ts       — typed send function
  send-card-complete.ts          — typed send function
```

---

## 6. Email Module

### `client.ts`

```typescript
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
export const FROM = process.env.RESEND_FROM ?? 'FideliTap <noreply@fidelitap.co>'
```

### Send functions — shared contract

Each send function:
- Receives typed props
- Renders the template with `render()` from `@react-email/render`
- Calls `resend.emails.send()`
- On error: `console.error(...)` only — never throws, never blocks the caller
- Returns `void`

All three are called fire-and-forget: `void sendX(...)`.

---

## 7. Email Descriptions

### 7.1 Business Welcome

**Trigger:** `src/app/(auth)/register/actions.ts` — after `admin.from('businesses').insert(...)` succeeds, before `redirect('/dashboard')`

**Data available:** `parsed.data.businessName`, `parsed.data.email`

**Subject:** `Bienvenido a FideliTap, [businessName]`

**Content:**
- Heading: "¡Ya puedes empezar a fidelizar!"
- Body: "Crea tu primera tarjeta de sellos y comparte el cartel con tus clientes."
- CTA button: "Ir al dashboard" → `${NEXT_PUBLIC_APP_URL}/dashboard`

**Send function signature:**
```typescript
export async function sendBusinessWelcome(params: {
  to: string
  businessName: string
}): Promise<void>
```

---

### 7.2 Customer Welcome

**Trigger:** `src/app/c/[slug]/actions.ts` — when `!existing` (new card created, `alreadyHadCard === false`)

**Data needed:**
- `email` — already in `parsed.data`
- `name` — already in `parsed.data`
- `businessName` — fetch from `loyalty_cards` JOIN `businesses` on `loyalty_card_id`; the action already has `loyalty_card_id` and `business_id`
- `cardSlug` — fetch from `loyalty_cards` on `loyalty_card_id`

**Extend the serviceClient query in `activateCardAction`** to also select `slug` and join `businesses(name)`:

```typescript
const { data: cardInfo } = await supabase
  .from('loyalty_cards')
  .select('slug, businesses(name)')
  .eq('id', loyalty_card_id)
  .single()
```

**Subject:** `¡Tu tarjeta de [businessName] está lista!`

**Content:**
- Heading: "Hola [customerName], tu tarjeta de sellos está activa"
- Body: "Muéstrasela al negocio cada vez que visites para acumular sellos."
- CTA button: "Ver mi tarjeta" → `${NEXT_PUBLIC_APP_URL}/c/[cardSlug]`

**Send function signature:**
```typescript
export async function sendCustomerWelcome(params: {
  to: string
  customerName: string
  businessName: string
  cardUrl: string
}): Promise<void>
```

---

### 7.3 Card Complete

**Trigger:** `src/app/(dashboard)/scanner/actions.ts` — inside `void Promise.allSettled([...])` when `isComplete === true`

**Data needed:**
- `customerEmail` — extend the `customer_cards` join to also select `customers(name, email)` (currently only `customers(name)`)
- `customerName` — already fetched (`cc.customers?.name`)
- `businessName` — extend the initial `businesses` query to also select `name` (currently only `id, stamp_cooldown_seconds`)
- `cardId` — `cc.id` (for wallet download link)

**Wallet links:**
- Apple: `${NEXT_PUBLIC_APP_URL}/api/wallet/apple/[cc.id]`
- Google: `${NEXT_PUBLIC_APP_URL}/api/wallet/google/[cc.id]`

**Subject:** `¡Completaste tu tarjeta! 🎉`

**Content:**
- Heading: "¡Felicidades, [customerName]!"
- Body: "Completaste tu tarjeta de [businessName]. Muéstrale este email al negocio para reclamar tu recompensa."
- Two CTA buttons: "Descargar para Apple Wallet" and "Descargar para Google Wallet"

**Send function signature:**
```typescript
export async function sendCardComplete(params: {
  to: string
  customerName: string
  businessName: string
  appleWalletUrl: string
  googleWalletUrl: string
}): Promise<void>
```

---

## 8. Template Design

All templates share the same visual shell:

- Background: `#0B0B0B`
- Accent: `#00C896`
- Text: `#FFFFFF` (primary), `#6B7280` (secondary)
- Font: system-ui / sans-serif (email-safe)
- Max width: 600px, centered
- Header: FideliTap logotype (text, not image — email-safe)
- Footer: "© 2026 FideliTap · fidelitap.co"

CTA buttons: `background: #00C896`, `color: #0B0B0B`, `font-weight: bold`, `border-radius: 8px`.

---

## 9. Modified Files

| File | Change |
|------|--------|
| `src/app/(auth)/register/actions.ts` | Add `void sendBusinessWelcome(...)` before `redirect('/dashboard')` |
| `src/app/c/[slug]/actions.ts` | Fetch `cardInfo` (slug + businessName), add `void sendCustomerWelcome(...)` when new card |
| `src/app/(dashboard)/scanner/actions.ts` | Extend `businesses` select to include `name`; extend `customer_cards` join to include `customers(name, email)`; add `sendCardComplete` inside `Promise.allSettled` when `isComplete` |

---

## 10. Security

- `RESEND_API_KEY` is server-only (no `NEXT_PUBLIC_` prefix) — never exposed to client
- All send functions run server-side only (Server Actions)
- Email addresses come from DB, not from client-provided input
- No unsubscribe token needed for MVP (transactional emails exempt in most jurisdictions)

---

## 11. Error Handling

All send functions swallow errors with `console.error`. Email failure never:
- Blocks the user registration
- Blocks the card activation
- Blocks the stamp from being recorded

This matches the existing pattern for APNs and Google Wallet updates.

---

## 12. Success Criteria

- New business registration → business owner receives welcome email within seconds
- New customer activates a card → customer receives welcome email with link to their card
- Customer fills a stamp card (`is_complete === true`) → customer receives email with Apple + Google Wallet download buttons
- Email failure (bad key, rate limit) → logged to console only, no user-visible error
- `npx tsc --noEmit` passes after all changes
