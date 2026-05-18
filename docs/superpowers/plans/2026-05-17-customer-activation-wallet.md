# Customer Activation + Apple & Google Wallet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable a customer to scan a QR code, register with name + email, and immediately add the loyalty card to Apple Wallet or Google Wallet.

**Architecture:** A public Next.js page `/c/[slug]` handles registration via a Server Action that uses the Supabase service role client (bypasses RLS) to upsert customers and customer_cards. Two API routes generate the wallet passes — one returns a `.pkpass` binary for Apple using `passkit-generator`, the other returns a redirect JWT URL for Google Wallet using Node.js built-in crypto.

**Tech Stack:** Next.js 14 App Router, Supabase (service role), `passkit-generator` (Apple Wallet), Node.js `crypto` (Google Wallet JWT), HMAC-SHA256 (unique_code anti-fraud)

---

## Environment Variables Required

Add to `.env.local` before starting:

```bash
# Anti-fraud (generate with: openssl rand -hex 32)
APP_HMAC_SECRET=your_32_char_hex_secret_here

# Apple Wallet (see Task 4 for how to get test certs)
APPLE_CERT_BASE64=
APPLE_CERT_PASSPHRASE=
APPLE_WWDR_BASE64=
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_PASS_TYPE_ID=pass.co.fidelitap.card

# Google Wallet (see Task 6 for setup)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_WALLET_ISSUER_ID=
```

---

## Task 1: Migration — Fix public RLS policy for loyalty_cards

**Context:** The existing public read policy for `loyalty_cards` does not exclude soft-deleted cards (`deleted_at IS NULL`). Fix it.

**Files:**
- Create: `supabase/migrations/20260517000000_fix_public_card_read_policy.sql`

- [ ] **Step 1: Write migration**

```sql
-- Fix: exclude soft-deleted cards from public read
DROP POLICY IF EXISTS "loyalty_cards: public can read active cards" ON public.loyalty_cards;

CREATE POLICY "loyalty_cards: public can read active cards"
  ON public.loyalty_cards FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);
```

Save to `supabase/migrations/20260517000000_fix_public_card_read_policy.sql`.

- [ ] **Step 2: Apply migration**

```bash
supabase db push
```

Expected: `Applying migration 20260517000000_fix_public_card_read_policy.sql... done`

If Docker isn't running: `supabase start` first.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260517000000_fix_public_card_read_policy.sql
git commit -m "fix: exclude deleted cards from public loyalty_cards read policy"
```

---

## Task 2: Service Role Client

**Context:** The activation Server Action runs without a user session. It needs a Supabase client that bypasses RLS (service role) to upsert customers and read customer_cards. The existing `createClient()` in `src/lib/supabase/server.ts` is cookie-based (user session). We need a separate service client.

**Files:**
- Create: `src/lib/supabase/service.ts`

- [ ] **Step 1: Create service client**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

Save to `src/lib/supabase/service.ts`.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/service.ts
git commit -m "feat: add supabase service role client"
```

---

## Task 3: HMAC Utility + Activation Server Action

**Context:** `unique_code` is an HMAC-SHA256 of the customer_card ID and business ID. This code goes inside the QR on the wallet card — the scanner reads it to verify authenticity. The `activateCardAction` server action:
1. Validates name + email
2. Finds or creates `customers` row (by email)
3. Finds or creates `customer_cards` row (by customer_id + loyalty_card_id)
4. Returns customerCardId + walletAuthToken to the client

**Files:**
- Create: `src/lib/wallet/hmac.ts`
- Create: `src/app/c/[slug]/actions.ts`

- [ ] **Step 1: Create HMAC utility**

```typescript
import { createHmac } from 'crypto'

export function generateUniqueCode(customerCardId: string, businessId: string): string {
  return createHmac('sha256', process.env.APP_HMAC_SECRET!)
    .update(`${customerCardId}.${businessId}`)
    .digest('hex')
}
```

Save to `src/lib/wallet/hmac.ts`.

- [ ] **Step 2: Create activation server action**

```typescript
'use server'

import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { generateUniqueCode } from '@/lib/wallet/hmac'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(80).trim(),
  email: z.string().email('Email inválido').toLowerCase(),
  loyalty_card_id: z.string().uuid(),
  business_id: z.string().uuid(),
})

export type ActivateResult =
  | { error: string }
  | { customerCardId: string; walletAuthToken: string; alreadyHadCard: boolean }

export async function activateCardAction(formData: FormData): Promise<ActivateResult> {
  const parsed = schema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    loyalty_card_id: formData.get('loyalty_card_id'),
    business_id: formData.get('business_id'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, email, loyalty_card_id, business_id } = parsed.data
  const supabase = createServiceClient()

  // 1. Find or create customer
  let { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!customer) {
    const { data: newCustomer, error: insertErr } = await supabase
      .from('customers')
      .insert({ email, name })
      .select('id')
      .single()
    if (insertErr || !newCustomer) return { error: 'Error al registrarte. Intenta de nuevo.' }
    customer = newCustomer
  }

  // 2. Find or create customer_card
  let { data: existing } = await supabase
    .from('customer_cards')
    .select('id, wallet_auth_token')
    .eq('customer_id', customer.id)
    .eq('loyalty_card_id', loyalty_card_id)
    .maybeSingle()

  if (existing) {
    return {
      customerCardId: existing.id,
      walletAuthToken: existing.wallet_auth_token!,
      alreadyHadCard: true,
    }
  }

  // Pre-generate ID so we can use it in unique_code
  const newId = crypto.randomUUID()
  const unique_code = generateUniqueCode(newId, business_id)

  const { data: newCard, error: cardErr } = await supabase
    .from('customer_cards')
    .insert({
      id: newId,
      customer_id: customer.id,
      loyalty_card_id,
      unique_code,
      wallet_pass_serial: crypto.randomUUID(),
      wallet_auth_token: crypto.randomUUID(),
    })
    .select('id, wallet_auth_token')
    .single()

  if (cardErr || !newCard) return { error: 'Error al activar la tarjeta. Intenta de nuevo.' }

  return {
    customerCardId: newCard.id,
    walletAuthToken: newCard.wallet_auth_token!,
    alreadyHadCard: false,
  }
}
```

Save to `src/app/c/[slug]/actions.ts`.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wallet/hmac.ts "src/app/c/[slug]/actions.ts"
git commit -m "feat: HMAC unique_code utility and card activation server action"
```

---

## Task 4: Activation Page + Form + Success Screen

**Context:** `/c/[slug]` is a public page. The Server Component fetches the card by slug. `ActivateForm` is a client component with name + email fields. `SuccessScreen` shows the wallet buttons after activation. The page renders either the form or the success screen based on local state.

**Files:**
- Create: `src/app/c/[slug]/page.tsx`
- Create: `src/app/c/[slug]/activate-form.tsx`
- Create: `src/app/c/[slug]/success-screen.tsx`

- [ ] **Step 1: Create the activation page (Server Component)**

```typescript
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { ActivateForm } from './activate-form'
import type { CardDesignConfig } from '@/types/database'

export default async function CardActivationPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = await createClient()

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('id, name, benefit_description, stamps_required, design_config, business_id')
    .eq('slug', params.slug)
    .is('deleted_at', null)
    .eq('is_active', true)
    .single()

  if (!card) notFound()

  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', card.business_id)
    .single()

  const design = card.design_config as unknown as CardDesignConfig

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-[#00C896] text-xs font-bold uppercase tracking-widest mb-1">
            {business?.name}
          </p>
          <h1 className="text-2xl font-black">{card.name}</h1>
          <p className="text-slate-400 text-sm mt-1">{card.benefit_description}</p>
        </div>

        {/* Card Preview */}
        <WalletPreview
          businessName={business?.name ?? ''}
          name={card.name}
          benefitDescription={card.benefit_description}
          stampsRequired={card.stamps_required}
          stampIcon={design.stamp_icon}
          color={design.color}
          bgType={design.bg_type === 'image' ? 'image' : 'solid'}
          bgImageUrl={design.bg_image_url}
          filledStamps={0}
        />

        {/* Form */}
        <ActivateForm
          loyaltyCardId={card.id}
          businessId={card.business_id}
        />
      </div>
    </div>
  )
}
```

Save to `src/app/c/[slug]/page.tsx`.

- [ ] **Step 2: Create ActivateForm client component**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { activateCardAction } from './actions'
import { SuccessScreen } from './success-screen'

interface ActivateFormProps {
  loyaltyCardId: string
  businessId: string
}

export function ActivateForm({ loyaltyCardId, businessId }: ActivateFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    customerCardId: string
    walletAuthToken: string
    alreadyHadCard: boolean
  } | null>(null)

  if (result) return <SuccessScreen {...result} />

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.append('loyalty_card_id', loyaltyCardId)
    fd.append('business_id', businessId)

    startTransition(async () => {
      const res = await activateCardAction(fd)
      if ('error' in res) {
        setError(res.error)
      } else {
        setResult(res)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Tu nombre</label>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder="Ej: María García"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00C896]"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Tu email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="Ej: maria@gmail.com"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00C896]"
        />
      </div>

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
        Sin contraseña. Solo nombre y email.
      </p>
    </form>
  )
}
```

Save to `src/app/c/[slug]/activate-form.tsx`.

- [ ] **Step 3: Create SuccessScreen client component**

```typescript
'use client'

interface SuccessScreenProps {
  customerCardId: string
  walletAuthToken: string
  alreadyHadCard: boolean
}

export function SuccessScreen({
  customerCardId,
  walletAuthToken,
  alreadyHadCard,
}: SuccessScreenProps) {
  const appleUrl = `/api/wallet/apple/${customerCardId}?token=${walletAuthToken}`
  const googleUrl = `/api/wallet/google/${customerCardId}?token=${walletAuthToken}`

  return (
    <div className="flex flex-col gap-5 text-center">
      <div>
        <p className="text-4xl mb-2">🎉</p>
        <h2 className="text-xl font-black text-white">
          {alreadyHadCard ? '¡Ya tienes esta tarjeta!' : '¡Tarjeta activada!'}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Agrégala a tu Wallet para acumular sellos
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Apple Wallet */}
        <a
          href={appleUrl}
          className="flex items-center justify-center gap-2 bg-black text-white font-semibold text-sm rounded-xl py-3 border border-slate-700 hover:border-slate-500 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Agregar a Apple Wallet
        </a>

        {/* Google Wallet */}
        <a
          href={googleUrl}
          className="flex items-center justify-center gap-2 bg-white text-slate-900 font-semibold text-sm rounded-xl py-3 hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Agregar a Google Wallet
        </a>
      </div>

      <p className="text-xs text-slate-600">
        Muestra el QR de tu tarjeta en cada visita para acumular sellos
      </p>
    </div>
  )
}
```

Save to `src/app/c/[slug]/success-screen.tsx`.

- [ ] **Step 4: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/c/"
git commit -m "feat: customer activation page with name/email form and wallet buttons"
```

---

## Task 5: Install passkit-generator + Test Certificates Setup

**Context:** Apple Wallet passes require `passkit-generator` and valid certificates. For local development (no Apple Developer account), use test certificates from passkit-generator's GitHub repo. These work in the iOS Simulator (Xcode, free).

**Files:**
- No code files — dependency install + cert setup

- [ ] **Step 1: Install passkit-generator**

```bash
npm install passkit-generator
npm install --save-dev @types/node
```

Expected: `added X packages`

- [ ] **Step 2: Download test certificates**

Download Apple's free WWDR G4 certificate (no account needed):

```bash
curl -L "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer" -o /tmp/wwdr.cer
# Convert DER to PEM
openssl x509 -inform DER -in /tmp/wwdr.cer -out /tmp/wwdr.pem
# Encode to base64 for env var
base64 -i /tmp/wwdr.pem | tr -d '\n' > /tmp/wwdr_b64.txt
echo "WWDR base64:"
cat /tmp/wwdr_b64.txt
```

For the signer cert + key (test only, iOS Simulator):

```bash
# 1. Clone passkit-generator to get test certs
git clone --depth 1 https://github.com/alexandercerutti/passkit-generator.git /tmp/passkit-gen

# 2. Check if test certs exist
ls /tmp/passkit-gen/certificates/

# 3. If .p12 file exists, convert to base64:
base64 -i /tmp/passkit-gen/certificates/signerCert.pem | tr -d '\n'
base64 -i /tmp/passkit-gen/certificates/signerKey.pem | tr -d '\n'
```

Note: If the repo structure differs, the test certificates are in the `spec/` or `certificates/` folder. Check with `find /tmp/passkit-gen -name "*.pem" -o -name "*.p12"`.

- [ ] **Step 3: Set env vars in .env.local**

```bash
# Paste the base64 values from Step 2
APPLE_WWDR_BASE64=<paste wwdr base64>
APPLE_CERT_BASE64=<paste signerCert base64>
APPLE_CERT_PASSPHRASE=<passphrase or empty string>
APPLE_TEAM_ID=TESTTEAMID     # placeholder for local dev
APPLE_PASS_TYPE_ID=pass.co.fidelitap.card  # placeholder for local dev

APP_HMAC_SECRET=<generate: openssl rand -hex 32>
```

- [ ] **Step 4: Generate a test icon for the pass**

Apple Wallet requires an `icon.png` (29x29px minimum). Create a placeholder:

```bash
# Create a minimal 29x29 green PNG programmatically (requires Node)
node -e "
const { createCanvas } = require('canvas');
" 2>/dev/null || echo "canvas not available — use any 29x29 PNG"
```

If `canvas` is not available, use any square PNG image renamed to `icon.png`. Place it at `public/wallet-icon.png` (the API route will read it from `public/`).

Alternative — download a placeholder:
```bash
# Create a simple green square PNG (using ImageMagick if available)
which convert && convert -size 29x29 xc:#00C896 public/wallet-icon.png || echo "Place any 29x29 PNG at public/wallet-icon.png"
```

- [ ] **Step 5: Commit dependency**

```bash
git add package.json package-lock.json
git commit -m "feat: add passkit-generator for Apple Wallet pass generation"
```

---

## Task 6: Apple Wallet Library + API Route

**Context:** `src/lib/wallet/apple.ts` wraps `passkit-generator` to generate a `.pkpass` binary given card data. The API route at `/api/wallet/apple/[customerCardId]` validates the token, fetches data, calls the library, and returns the binary.

**Files:**
- Create: `src/lib/wallet/apple.ts`
- Create: `src/app/api/wallet/apple/[customerCardId]/route.ts`

- [ ] **Step 1: Create Apple Wallet library**

```typescript
import { PKPass } from 'passkit-generator'
import { readFileSync } from 'fs'
import { join } from 'path'

interface ApplePassData {
  passTypeIdentifier: string
  teamIdentifier: string
  serialNumber: string
  authenticationToken: string
  organizationName: string
  description: string
  stampsCurrent: number
  stampsRequired: number
  benefitDescription: string
  uniqueCode: string
  color: string
  appUrl: string
}

export async function generateApplePass(data: ApplePassData): Promise<Buffer> {
  const wwdr = Buffer.from(process.env.APPLE_WWDR_BASE64!, 'base64')
  const signerCert = Buffer.from(process.env.APPLE_CERT_BASE64!, 'base64')
  const signerKeyPassphrase = process.env.APPLE_CERT_PASSPHRASE!

  // Read icon from public folder (bundled at build time)
  let iconBuffer: Buffer
  try {
    iconBuffer = readFileSync(join(process.cwd(), 'public', 'wallet-icon.png'))
  } catch {
    // Fallback: 1x1 green PNG (valid minimal PNG)
    iconBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
  }

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: data.passTypeIdentifier,
    serialNumber: data.serialNumber,
    teamIdentifier: data.teamIdentifier,
    organizationName: data.organizationName,
    description: data.description,
    backgroundColor: 'rgb(15, 23, 42)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(148, 163, 184)',
    webServiceURL: `${data.appUrl}/api/wallet/apple/updates`,
    authenticationToken: data.authenticationToken,
    storeCard: {
      primaryFields: [
        {
          key: 'stamps',
          label: 'Sellos',
          value: `${data.stampsCurrent} / ${data.stampsRequired}`,
        },
      ],
      secondaryFields: [
        {
          key: 'benefit',
          label: 'Premio',
          value: data.benefitDescription,
        },
      ],
      auxiliaryFields: [
        {
          key: 'business',
          label: 'Negocio',
          value: data.organizationName,
        },
      ],
      backFields: [
        {
          key: 'code',
          label: 'Tu código único',
          value: data.uniqueCode,
        },
        {
          key: 'instructions',
          label: 'Cómo funciona',
          value: 'Muestra el QR en cada visita. El negocio lo escanea para agregar un sello.',
        },
      ],
    },
    barcode: {
      message: data.uniqueCode,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
    },
    barcodes: [
      {
        message: data.uniqueCode,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      },
    ],
  }

  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': iconBuffer,
      'icon@2x.png': iconBuffer,
    },
    {
      wwdr,
      signerCert,
      signerKey: signerCert, // test: same buffer — replace with actual key in production
      signerKeyPassphrase,
    }
  )

  return pass.getAsBuffer()
}
```

Save to `src/lib/wallet/apple.ts`.

**Note:** In the `signerKey` field above, for testing with PEM files, the key should be the private key PEM buffer (separate from the cert). If you have `.pem` files from the test repo, pass each buffer separately. In production with a `.p12`, you extract the cert and key using `openssl pkcs12 -in cert.p12 -clcerts -nokeys -out cert.pem` and `openssl pkcs12 -in cert.p12 -nocerts -nodes -out key.pem`.

- [ ] **Step 2: Create Apple Wallet API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateApplePass } from '@/lib/wallet/apple'
import type { CardDesignConfig } from '@/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { customerCardId: string } }
) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: cc } = await supabase
    .from('customer_cards')
    .select(`
      id,
      wallet_auth_token,
      wallet_pass_serial,
      unique_code,
      current_stamps,
      loyalty_cards (
        id,
        name,
        benefit_description,
        stamps_required,
        design_config,
        business_id,
        businesses (name)
      )
    `)
    .eq('id', params.customerCardId)
    .single()

  if (!cc || cc.wallet_auth_token !== token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const card = cc.loyalty_cards as {
    id: string
    name: string
    benefit_description: string
    stamps_required: number
    design_config: unknown
    business_id: string
    businesses: { name: string } | null
  } | null

  if (!card) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const design = card.design_config as CardDesignConfig
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.app'

  try {
    const passBuffer = await generateApplePass({
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
      teamIdentifier: process.env.APPLE_TEAM_ID!,
      serialNumber: cc.wallet_pass_serial ?? cc.id,
      authenticationToken: cc.wallet_auth_token!,
      organizationName: card.businesses?.name ?? 'FideliTap',
      description: card.name,
      stampsCurrent: cc.current_stamps,
      stampsRequired: card.stamps_required,
      benefitDescription: card.benefit_description,
      uniqueCode: cc.unique_code,
      color: design.color,
      appUrl,
    })

    return new NextResponse(passBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'attachment; filename="fidelitap.pkpass"',
        'Content-Length': String(passBuffer.length),
      },
    })
  } catch (err) {
    console.error('Apple pass generation error:', err)
    return NextResponse.json({ error: 'Error generando el pass' }, { status: 500 })
  }
}
```

Save to `src/app/api/wallet/apple/[customerCardId]/route.ts`.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test the route (manual)**

Start the dev server: `npm run dev`

In another terminal, after activating a card via `/c/[slug]`:
```bash
curl -I "http://localhost:3000/api/wallet/apple/<customerCardId>?token=<walletAuthToken>"
```

Expected: `Content-Type: application/vnd.apple.pkpass` with status 200.

If you have the iOS Simulator open, drag the downloaded `.pkpass` file onto the simulator window to add it to Wallet.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallet/apple.ts "src/app/api/wallet/apple/"
git commit -m "feat: Apple Wallet pass generation API route"
```

---

## Task 7: Google Wallet Library + API Route

**Context:** Google Wallet uses signed JWTs (RS256) to save passes. No npm package needed — Node.js `crypto` handles RS256 signing. The flow: create/update a LoyaltyClass (once per loyalty_card), create a LoyaltyObject (once per customer_card), sign a JWT, redirect to `pay.google.com/gp/v/save/{jwt}`.

**Files:**
- Create: `src/lib/wallet/google.ts`
- Create: `src/app/api/wallet/google/[customerCardId]/route.ts`

**Google Wallet setup (one-time, before testing):**
1. Go to [pay.google.com/business/console](https://pay.google.com/business/console) — free, no payment needed
2. Create an Issuer account → note the numeric Issuer ID
3. In Google Cloud Console: enable "Google Wallet API"
4. Create a Service Account → create a JSON key → download
5. From the JSON, extract `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
6. Extract `private_key` → replace all `\n` with actual newlines → `GOOGLE_SERVICE_ACCOUNT_KEY`
7. Set `GOOGLE_WALLET_ISSUER_ID` to the numeric Issuer ID from step 2

- [ ] **Step 1: Create Google Wallet library**

```typescript
import { createSign } from 'crypto'

const GOOGLE_WALLET_BASE_URL = 'https://walletobjects.googleapis.com/walletobjects/v1'

interface GoogleServiceAccount {
  email: string
  privateKey: string
}

function getServiceAccount(): GoogleServiceAccount {
  return {
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY!.replace(/\\n/g, '\n'),
  }
}

function signRS256JWT(payload: Record<string, unknown>, privateKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const data = `${header}.${body}`
  const sign = createSign('RSA-SHA256')
  sign.update(data)
  const signature = sign.sign(privateKey, 'base64url')
  return `${data}.${signature}`
}

async function getAccessToken(sa: GoogleServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const jwtPayload = {
    iss: sa.email,
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const jwt = signRS256JWT(jwtPayload, sa.privateKey)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export interface LoyaltyPassData {
  issuerId: string
  loyaltyCardId: string
  customerCardId: string
  businessName: string
  cardName: string
  benefitDescription: string
  stampsRequired: number
  stampsCurrent: number
  uniqueCode: string
  color: string
  appUrl: string
}

async function upsertLoyaltyClass(
  accessToken: string,
  data: LoyaltyPassData
): Promise<void> {
  const classId = `${data.issuerId}.card-${data.loyaltyCardId}`
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgb(${r}, ${g}, ${b})`
  }

  const loyaltyClass = {
    id: classId,
    issuerName: 'FideliTap',
    programName: data.cardName,
    programLogo: {
      sourceUri: { uri: `${data.appUrl}/wallet-icon.png` },
      contentDescription: { defaultValue: { language: 'es', value: data.cardName } },
    },
    rewardsTierLabel: 'Sellos',
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: data.color,
    countryCode: 'CO',
    redemptionIssuers: [data.issuerId],
  }

  // Try GET first, then POST if not found
  const getRes = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyClass/${classId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (getRes.status === 404) {
    await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyClass`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loyaltyClass),
    })
  } else {
    await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyClass/${classId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ programName: data.cardName }),
    })
  }
}

async function upsertLoyaltyObject(
  accessToken: string,
  data: LoyaltyPassData
): Promise<void> {
  const classId = `${data.issuerId}.card-${data.loyaltyCardId}`
  const objectId = `${data.issuerId}.cc-${data.customerCardId}`

  const loyaltyObject = {
    id: objectId,
    classId,
    state: 'ACTIVE',
    loyaltyPoints: {
      label: 'Sellos',
      balance: { int: data.stampsCurrent },
    },
    secondaryLoyaltyPoints: {
      label: 'Meta',
      balance: { int: data.stampsRequired },
    },
    barcode: {
      type: 'QR_CODE',
      value: data.uniqueCode,
      alternateText: data.uniqueCode.slice(0, 8),
    },
    textModulesData: [
      {
        header: 'Premio al completar',
        body: data.benefitDescription,
        id: 'benefit',
      },
    ],
    infoModuleData: {
      labelValueRows: [
        {
          columns: [
            { label: 'Negocio', value: data.businessName },
            { label: 'Sellos requeridos', value: String(data.stampsRequired) },
          ],
        },
      ],
    },
  }

  const getRes = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyObject/${objectId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (getRes.status === 404) {
    await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyObject`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loyaltyObject),
    })
  } else {
    await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyObject/${objectId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        loyaltyPoints: { label: 'Sellos', balance: { int: data.stampsCurrent } },
      }),
    })
  }
}

export async function getGoogleWalletSaveUrl(data: LoyaltyPassData): Promise<string> {
  const sa = getServiceAccount()
  const accessToken = await getAccessToken(sa)

  await upsertLoyaltyClass(accessToken, data)
  await upsertLoyaltyObject(accessToken, data)

  const now = Math.floor(Date.now() / 1000)
  const jwtPayload = {
    iss: sa.email,
    aud: 'google',
    typ: 'savetowallet',
    iat: now,
    origins: [data.appUrl],
    payload: {
      loyaltyObjects: [
        {
          id: `${data.issuerId}.cc-${data.customerCardId}`,
          classId: `${data.issuerId}.card-${data.loyaltyCardId}`,
        },
      ],
    },
  }

  const jwt = signRS256JWT(jwtPayload, sa.privateKey)
  return `https://pay.google.com/gp/v/save/${jwt}`
}
```

Save to `src/lib/wallet/google.ts`.

- [ ] **Step 2: Create Google Wallet API route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getGoogleWalletSaveUrl } from '@/lib/wallet/google'
import type { CardDesignConfig } from '@/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { customerCardId: string } }
) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 401 })

  const supabase = createServiceClient()

  const { data: cc } = await supabase
    .from('customer_cards')
    .select(`
      id,
      wallet_auth_token,
      unique_code,
      current_stamps,
      loyalty_cards (
        id,
        name,
        benefit_description,
        stamps_required,
        design_config,
        business_id,
        businesses (name)
      )
    `)
    .eq('id', params.customerCardId)
    .single()

  if (!cc || cc.wallet_auth_token !== token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const card = cc.loyalty_cards as {
    id: string
    name: string
    benefit_description: string
    stamps_required: number
    design_config: unknown
    business_id: string
    businesses: { name: string } | null
  } | null

  if (!card) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const design = card.design_config as CardDesignConfig
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.app'
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!

  try {
    const saveUrl = await getGoogleWalletSaveUrl({
      issuerId,
      loyaltyCardId: card.id,
      customerCardId: cc.id,
      businessName: card.businesses?.name ?? 'FideliTap',
      cardName: card.name,
      benefitDescription: card.benefit_description,
      stampsRequired: card.stamps_required,
      stampsCurrent: cc.current_stamps,
      uniqueCode: cc.unique_code,
      color: design.color,
      appUrl,
    })

    return NextResponse.redirect(saveUrl)
  } catch (err) {
    console.error('Google Wallet error:', err)
    return NextResponse.json({ error: 'Error generando el pass' }, { status: 500 })
  }
}
```

Save to `src/app/api/wallet/google/[customerCardId]/route.ts`.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test manually**

Start the dev server: `npm run dev`

Navigate to `/c/[any-active-card-slug]`, complete the form, and click "Agregar a Google Wallet". Expected: browser redirects to `pay.google.com/gp/v/save/...`. If Google credentials are not yet set up, you'll get a 500 — the code is correct, credentials are missing.

To verify the JWT is well-formed without credentials:
```bash
# Test the route returns a redirect (not an error) when credentials are set
curl -I "http://localhost:3000/api/wallet/google/<customerCardId>?token=<walletAuthToken>"
# Expected: 307 redirect to pay.google.com/...
```

- [ ] **Step 5: Build verification**

```bash
npm run build
```

Expected: build succeeds. Routes `/c/[slug]` and both API routes appear in the output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/wallet/google.ts "src/app/api/wallet/google/"
git commit -m "feat: Google Wallet pass generation API route"
```

---

## End-to-End Test Checklist

After all tasks are complete:

- [ ] Navigate to `http://localhost:3000/c/<your-card-slug>`
- [ ] Verify: card name, business name, WalletPreview renders correctly
- [ ] Fill name + email → click Activar → verify success screen with both buttons
- [ ] Check Supabase Studio (`http://localhost:54323`): `customers` table has new row, `customer_cards` has new row with `unique_code`, `wallet_pass_serial`, `wallet_auth_token`
- [ ] Click "Agregar a Apple Wallet" → file downloads → drag to iOS Simulator → card appears in Wallet with QR code
- [ ] Click "Agregar a Google Wallet" → redirects to Google's save page → card added to Wallet on Android
- [ ] Re-submit the same email → success screen shows "¡Ya tienes esta tarjeta!"

---

## Production Checklist (when acquiring Apple Developer account)

1. Log in to [developer.apple.com](https://developer.apple.com)
2. Go to Certificates, IDs & Profiles → Identifiers → Register a Pass Type ID: `pass.co.fidelitap.card`
3. Create a Pass Type ID Certificate → download `.cer` → convert to `.p12` with Keychain Access
4. Export as `.p12` with a passphrase
5. `base64 -i yourCert.p12 | tr -d '\n'` → paste into `APPLE_CERT_BASE64`
6. Set `APPLE_CERT_PASSPHRASE`, `APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`
7. Re-download WWDR G4 from Apple (it may have been updated)
