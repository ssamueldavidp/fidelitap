# Email Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send three transactional emails via Resend (business welcome, customer welcome, card complete) using React Email templates, triggered fire-and-forget from existing Server Actions.

**Architecture:** A `src/lib/email/` module centralises the Resend singleton, three React Email templates, and three typed send functions. Each send function catches all errors and logs them — it never throws. Triggers are added to `registerAction`, `activateCardAction`, and `addStampAction` as `void` calls, matching the existing pattern for APNs and Google Wallet updates.

**Tech Stack:** Next.js 14 Server Actions, Resend SDK (already installed), `@react-email/components`, `@react-email/render`, TypeScript

---

## File Map

**Created:**
```
src/lib/email/client.ts
src/lib/email/templates/business-welcome.tsx
src/lib/email/templates/customer-welcome.tsx
src/lib/email/templates/card-complete.tsx
src/lib/email/send-business-welcome.tsx
src/lib/email/send-customer-welcome.tsx
src/lib/email/send-card-complete.tsx
```

**Modified:**
```
src/app/(auth)/register/actions.ts            — add void sendBusinessWelcome(...)
src/app/c/[slug]/actions.ts                   — fetch cardInfo, add void sendCustomerWelcome(...)
src/app/(dashboard)/scanner/actions.ts        — extend selects, add sendCardComplete in allSettled
```

---

## Task 1: Install React Email + Resend client

**Context:** Resend SDK is already installed (`"resend": "^6.12.3"`). React Email components and renderer are not installed yet. The client singleton follows the same pattern as `src/lib/wallet/apns.ts` (module-scope instance).

**Files:**
- Create: `src/lib/email/client.ts`

- [ ] **Step 1: Install React Email packages**

```bash
cd /Users/samuelrodriguez/development/fidelitap && pnpm add @react-email/components @react-email/render
```

Expected: packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `src/lib/email/client.ts`**

```typescript
import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)
export const FROM = process.env.RESEND_FROM ?? 'FideliTap <noreply@fidelitap.co>'
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/samuelrodriguez/development/fidelitap
git add package.json pnpm-lock.yaml src/lib/email/client.ts
git commit -m "feat: install @react-email packages and add Resend client singleton"
```

---

## Task 2: Business welcome email

**Context:** Triggered from `registerAction` after the business row is inserted, before `redirect('/dashboard')`. Data available: `parsed.data.businessName`, `parsed.data.email`.

**Files:**
- Create: `src/lib/email/templates/business-welcome.tsx`
- Create: `src/lib/email/send-business-welcome.tsx`
- Modify: `src/app/(auth)/register/actions.ts`

- [ ] **Step 1: Create `src/lib/email/templates/business-welcome.tsx`**

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export function BusinessWelcomeEmail({
  businessName,
  appUrl,
}: {
  businessName: string
  appUrl: string
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>¡Bienvenido a FideliTap, {businessName}!</Preview>
      <Body style={{ backgroundColor: '#0B0B0B', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Text style={{ color: '#00C896', fontSize: '24px', fontWeight: 'bold', margin: '0 0 32px' }}>
            FideliTap
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>
            ¡Ya puedes empezar a fidelizar!
          </Text>
          <Text style={{ color: '#6B7280', fontSize: '16px', margin: '0 0 24px' }}>
            Hola {businessName}, tu negocio está registrado en FideliTap. Crea tu primera tarjeta de
            sellos y comparte el cartel con tus clientes.
          </Text>
          <Button
            href={`${appUrl}/dashboard`}
            style={{
              backgroundColor: '#00C896',
              color: '#0B0B0B',
              fontWeight: 'bold',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              display: 'inline-block',
              textDecoration: 'none',
            }}
          >
            Ir al dashboard
          </Button>
          <Hr style={{ borderColor: '#1F2937', margin: '32px 0' }} />
          <Text style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>
            © 2026 FideliTap · fidelitap.co
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Create `src/lib/email/send-business-welcome.tsx`**

```tsx
import { render } from '@react-email/render'
import { resend, FROM } from './client'
import { BusinessWelcomeEmail } from './templates/business-welcome'

export async function sendBusinessWelcome(params: {
  to: string
  businessName: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  try {
    const html = await render(
      <BusinessWelcomeEmail businessName={params.businessName} appUrl={appUrl} />
    )
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `Bienvenido a FideliTap, ${params.businessName}`,
      html,
    })
  } catch (err) {
    console.error('[email] sendBusinessWelcome failed:', err)
  }
}
```

- [ ] **Step 3: Modify `src/app/(auth)/register/actions.ts`**

Add the import at the top of the file (after existing imports):

```typescript
import { sendBusinessWelcome } from '@/lib/email/send-business-welcome'
```

Then find this block (the final section before `redirect`):

```typescript
  // 4. Redirigir — si hay sesión activa, el middleware lleva al dashboard
  redirect('/dashboard')
```

Replace with:

```typescript
  // 4. Enviar welcome email (fire-and-forget — no bloquea el redirect)
  void sendBusinessWelcome({
    to: parsed.data.email,
    businessName: parsed.data.businessName,
  })

  // 5. Redirigir — si hay sesión activa, el middleware lleva al dashboard
  redirect('/dashboard')
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/samuelrodriguez/development/fidelitap
git add src/lib/email/templates/business-welcome.tsx \
        src/lib/email/send-business-welcome.tsx \
        "src/app/(auth)/register/actions.ts"
git commit -m "feat: business welcome email on registration"
```

---

## Task 3: Customer welcome email

**Context:** Triggered from `activateCardAction` only when a brand-new card is created (`!existing`). Need to fetch the loyalty card's `slug` and the business `name` to build the card URL and subject line. `activateCardAction` uses `createServiceClient()` throughout (no auth cookie).

**Files:**
- Create: `src/lib/email/templates/customer-welcome.tsx`
- Create: `src/lib/email/send-customer-welcome.tsx`
- Modify: `src/app/c/[slug]/actions.ts`

- [ ] **Step 1: Create `src/lib/email/templates/customer-welcome.tsx`**

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export function CustomerWelcomeEmail({
  customerName,
  businessName,
  cardUrl,
}: {
  customerName: string
  businessName: string
  cardUrl: string
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>¡Tu tarjeta de {businessName} está lista!</Preview>
      <Body style={{ backgroundColor: '#0B0B0B', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Text style={{ color: '#00C896', fontSize: '24px', fontWeight: 'bold', margin: '0 0 32px' }}>
            FideliTap
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>
            Hola {customerName}, tu tarjeta de sellos está activa
          </Text>
          <Text style={{ color: '#6B7280', fontSize: '16px', margin: '0 0 24px' }}>
            Tu tarjeta de <strong style={{ color: '#FFFFFF' }}>{businessName}</strong> ya está
            lista. Muéstrasela al negocio cada vez que visites para acumular sellos.
          </Text>
          <Button
            href={cardUrl}
            style={{
              backgroundColor: '#00C896',
              color: '#0B0B0B',
              fontWeight: 'bold',
              borderRadius: '8px',
              padding: '12px 24px',
              fontSize: '14px',
              display: 'inline-block',
              textDecoration: 'none',
            }}
          >
            Ver mi tarjeta
          </Button>
          <Hr style={{ borderColor: '#1F2937', margin: '32px 0' }} />
          <Text style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>
            © 2026 FideliTap · fidelitap.co
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Create `src/lib/email/send-customer-welcome.tsx`**

```tsx
import { render } from '@react-email/render'
import { resend, FROM } from './client'
import { CustomerWelcomeEmail } from './templates/customer-welcome'

export async function sendCustomerWelcome(params: {
  to: string
  customerName: string
  businessName: string
  cardUrl: string
}): Promise<void> {
  try {
    const html = await render(
      <CustomerWelcomeEmail
        customerName={params.customerName}
        businessName={params.businessName}
        cardUrl={params.cardUrl}
      />
    )
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `¡Tu tarjeta de ${params.businessName} está lista!`,
      html,
    })
  } catch (err) {
    console.error('[email] sendCustomerWelcome failed:', err)
  }
}
```

- [ ] **Step 3: Modify `src/app/c/[slug]/actions.ts`**

Read the current file first. Add the import at the top:

```typescript
import { sendCustomerWelcome } from '@/lib/email/send-customer-welcome'
```

Then find the section after `const { name, email, loyalty_card_id, business_id } = parsed.data` and `const supabase = createServiceClient()`. Add a fetch for card info right after those two lines:

```typescript
  // Fetch card slug + business name for the welcome email
  const { data: cardInfo } = await supabase
    .from('loyalty_cards')
    .select('slug, businesses(name)')
    .eq('id', loyalty_card_id)
    .single()
```

Then find the block where `newCard` is returned successfully:

```typescript
  if (cardErr || !newCard) return { error: 'Error al activar la tarjeta. Intenta de nuevo.' }

  return {
    customerCardId: newCard.id,
    walletAuthToken: newCard.wallet_auth_token!,
    alreadyHadCard: false,
  }
```

Replace with:

```typescript
  if (cardErr || !newCard) return { error: 'Error al activar la tarjeta. Intenta de nuevo.' }

  // Send welcome email fire-and-forget
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const biz = cardInfo?.businesses as { name: string } | null
  if (biz && cardInfo?.slug) {
    void sendCustomerWelcome({
      to: email,
      customerName: name,
      businessName: biz.name,
      cardUrl: `${appUrl}/c/${cardInfo.slug}`,
    })
  }

  return {
    customerCardId: newCard.id,
    walletAuthToken: newCard.wallet_auth_token!,
    alreadyHadCard: false,
  }
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/samuelrodriguez/development/fidelitap
git add src/lib/email/templates/customer-welcome.tsx \
        src/lib/email/send-customer-welcome.tsx \
        "src/app/c/[slug]/actions.ts"
git commit -m "feat: customer welcome email on first card activation"
```

---

## Task 4: Card complete email

**Context:** Triggered from `addStampAction` when `isComplete === true`, inside the existing `void Promise.allSettled([...])`. Requires extending two existing queries: `businesses` must also return `name`; `customer_cards` join must also return `customers(email)`.

**Files:**
- Create: `src/lib/email/templates/card-complete.tsx`
- Create: `src/lib/email/send-card-complete.tsx`
- Modify: `src/app/(dashboard)/scanner/actions.ts`

- [ ] **Step 1: Create `src/lib/email/templates/card-complete.tsx`**

```tsx
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export function CardCompleteEmail({
  customerName,
  businessName,
  appleWalletUrl,
  googleWalletUrl,
}: {
  customerName: string
  businessName: string
  appleWalletUrl: string
  googleWalletUrl: string
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>¡Completaste tu tarjeta de {businessName}! 🎉</Preview>
      <Body style={{ backgroundColor: '#0B0B0B', fontFamily: 'system-ui, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Text style={{ color: '#00C896', fontSize: '24px', fontWeight: 'bold', margin: '0 0 32px' }}>
            FideliTap
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>
            ¡Felicidades, {customerName}!
          </Text>
          <Text style={{ color: '#6B7280', fontSize: '16px', margin: '0 0 24px' }}>
            Completaste tu tarjeta de <strong style={{ color: '#FFFFFF' }}>{businessName}</strong>.
            Muéstrale este email al negocio para reclamar tu recompensa.
          </Text>
          <Section style={{ marginBottom: '16px' }}>
            <Button
              href={appleWalletUrl}
              style={{
                backgroundColor: '#00C896',
                color: '#0B0B0B',
                fontWeight: 'bold',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                display: 'inline-block',
                textDecoration: 'none',
                marginRight: '12px',
              }}
            >
              Apple Wallet
            </Button>
            <Button
              href={googleWalletUrl}
              style={{
                backgroundColor: '#1F2937',
                color: '#FFFFFF',
                fontWeight: 'bold',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                display: 'inline-block',
                textDecoration: 'none',
              }}
            >
              Google Wallet
            </Button>
          </Section>
          <Hr style={{ borderColor: '#1F2937', margin: '32px 0' }} />
          <Text style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>
            © 2026 FideliTap · fidelitap.co
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Create `src/lib/email/send-card-complete.tsx`**

```tsx
import { render } from '@react-email/render'
import { resend, FROM } from './client'
import { CardCompleteEmail } from './templates/card-complete'

export async function sendCardComplete(params: {
  to: string
  customerName: string
  businessName: string
  appleWalletUrl: string
  googleWalletUrl: string
}): Promise<void> {
  try {
    const html = await render(
      <CardCompleteEmail
        customerName={params.customerName}
        businessName={params.businessName}
        appleWalletUrl={params.appleWalletUrl}
        googleWalletUrl={params.googleWalletUrl}
      />
    )
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: `¡Completaste tu tarjeta de ${params.businessName}! 🎉`,
      html,
    })
  } catch (err) {
    console.error('[email] sendCardComplete failed:', err)
  }
}
```

- [ ] **Step 3: Extend `businesses` query in `src/app/(dashboard)/scanner/actions.ts`**

Read the current file first. Find:

```typescript
  const { data: business } = await supabase
    .from('businesses')
    .select('id, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()
```

Replace with:

```typescript
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()
```

- [ ] **Step 4: Extend `customer_cards` join to include `customers(email)`**

Find:

```typescript
  const { data: ccRaw } = await serviceClient
    .from('customer_cards')
    .select(`
      id,
      wallet_pass_serial,
      loyalty_card_id,
      loyalty_cards ( id, stamps_required, business_id ),
      customers ( name )
    `)
    .eq('unique_code', uniqueCode.trim())
    .maybeSingle()
```

Replace with:

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

- [ ] **Step 5: Update the `cc` type cast to include `customers.email` and `business.name`**

Find the `cc` type cast block:

```typescript
  const cc = ccRaw as unknown as {
    id: string
    wallet_pass_serial: string | null
    loyalty_card_id: string
    loyalty_cards: { id: string; stamps_required: number; business_id: string } | null
    customers: { name: string } | null
  }
```

Replace with:

```typescript
  const cc = ccRaw as unknown as {
    id: string
    wallet_pass_serial: string | null
    loyalty_card_id: string
    loyalty_cards: { id: string; stamps_required: number; business_id: string } | null
    customers: { name: string; email: string | null } | null
  }
```

- [ ] **Step 6: Add import and wire `sendCardComplete` into `Promise.allSettled`**

Add the import at the top of the file (after existing imports):

```typescript
import { sendCardComplete } from '@/lib/email/send-card-complete'
```

Find the `void Promise.allSettled` block:

```typescript
  void Promise.allSettled([
    pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve(),
    updateGoogleWalletStamps(cc.id, card.id, currentStamps),
  ])
```

Replace with:

```typescript
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const customerEmail = cc.customers?.email
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

- [ ] **Step 7: Verify TypeScript**

```bash
cd /Users/samuelrodriguez/development/fidelitap && npx tsc --noEmit 2>&1
```

Expected: no errors. `business.name` is typed correctly since `database.ts` already has `name: string` in `businesses.Row`.

- [ ] **Step 8: Full build check**

```bash
cd /Users/samuelrodriguez/development/fidelitap && pnpm build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
cd /Users/samuelrodriguez/development/fidelitap
git add src/lib/email/templates/card-complete.tsx \
        src/lib/email/send-card-complete.tsx \
        "src/app/(dashboard)/scanner/actions.ts"
git commit -m "feat: card complete email when stamp card is filled"
```

---

## End-to-End Test Checklist

After all tasks:

- [ ] Add `RESEND_API_KEY` and `RESEND_FROM` to `.env.local`
- [ ] Register a new business at `/register` → check inbox for welcome email
- [ ] Activate a loyalty card at `/c/[slug]` with a new email → check inbox for customer welcome
- [ ] Scan the same card until `isComplete === true` → check inbox for card complete email with Apple + Google Wallet buttons
- [ ] Simulate Resend failure (set invalid `RESEND_API_KEY`) → confirm registration and scanning still work, error logged to console only
