# Customer Activation + Apple & Google Wallet — Design Spec

**Date:** 2026-05-17
**Status:** Approved
**Plan number:** 5

---

## 1. Goal

Enable the full customer loop: a customer scans the business QR code, registers with name + email, and immediately adds the loyalty card to Apple Wallet or Google Wallet. No account creation, no password.

---

## 2. Scope

**In scope:**
- Public page `/c/[slug]` — card activation landing
- `activateCardAction` server action — upsert customer + customer_card + unique_code
- Apple Wallet pass generation — `GET /api/wallet/apple/[customerCardId]`
- Google Wallet pass generation — `GET /api/wallet/google/[customerCardId]`
- Success screen with wallet buttons
- Test certificates setup for local development (iOS Simulator)

**Out of scope:**
- APNs push updates (stamp counter auto-updates on Wallet) — Plan 6 (Scanner)
- Email magic link / customer portal — Plan 8
- Stamp scanning — Plan 6

---

## 3. Routes

| Route | Type | Auth | Description |
|-------|------|------|-------------|
| `/c/[slug]` | Page (Server Component) | None (public) | Customer activation landing |
| `POST activateCardAction` | Server Action | None (public) | Register customer + create customer_card |
| `GET /api/wallet/apple/[customerCardId]` | API Route | `?token=` query param | Returns `.pkpass` binary |
| `GET /api/wallet/google/[customerCardId]` | API Route | `?token=` query param | Redirects to Google save URL |

---

## 4. Data Flow

```
Customer hits /c/{slug}
  → Server fetches loyalty_cards WHERE slug = slug AND is_active = true AND deleted_at IS NULL
  → Also fetches businesses (name)
  → Renders WalletPreview + form (name, email)

Customer submits form
  → activateCardAction(formData)
    1. Validate: name (min 2), email (valid format)
    2. Upsert customers: INSERT ... ON CONFLICT (email) DO UPDATE SET name
    3. Upsert customer_cards:
       - Try INSERT with unique_code + wallet_pass_serial + wallet_auth_token
       - ON CONFLICT (customer_id, loyalty_card_id) DO UPDATE SET updated_at = now()
       - Always SELECT the final row to get the correct customerCardId + wallet_auth_token
         (handles re-activation: customer scans QR again → same card, same tokens)
    4. Return { customerCardId, walletAuthToken, alreadyHadCard } to client
       - alreadyHadCard: show "Ya tienes esta tarjeta" message on success screen

Client receives result
  → Renders success screen
  → "Agregar a Apple Wallet" → /api/wallet/apple/{customerCardId}?token={walletAuthToken}
  → "Agregar a Google Wallet" → /api/wallet/google/{customerCardId}?token={walletAuthToken}
```

---

## 5. unique_code (anti-fraud)

```ts
import { createHmac } from 'crypto'

function generateUniqueCode(customerCardId: string, businessId: string): string {
  return createHmac('sha256', process.env.APP_HMAC_SECRET!)
    .update(`${customerCardId}.${businessId}`)
    .digest('hex')
}
```

This code lives inside the QR on the customer's wallet card. The business scanner reads this code to add a stamp. It is deterministic (can be re-verified) and unforgeable without the secret.

---

## 6. Apple Wallet Pass

### Package
`passkit-generator` (npm install passkit-generator)

### Pass type
`storeCard`

### Pass structure (pass.json fields)
```json
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.co.fidelitap.card",
  "serialNumber": "{wallet_pass_serial}",
  "teamIdentifier": "{APPLE_TEAM_ID}",
  "organizationName": "{business.name}",
  "description": "{card.name}",
  "backgroundColor": "rgb(15, 23, 42)",
  "foregroundColor": "rgb(255, 255, 255)",
  "storeCard": {
    "primaryFields": [
      { "key": "stamps", "label": "Sellos", "value": "{current_stamps}/{stamps_required}" }
    ],
    "secondaryFields": [
      { "key": "benefit", "label": "Premio", "value": "{benefit_description}" }
    ],
    "auxiliaryFields": [
      { "key": "business", "label": "Negocio", "value": "{business.name}" }
    ],
    "backFields": [
      { "key": "code", "label": "Tu código único", "value": "{unique_code}" }
    ]
  },
  "barcode": {
    "message": "{unique_code}",
    "format": "PKBarcodeFormatQR",
    "messageEncoding": "iso-8859-1"
  },
  "webServiceURL": "{NEXT_PUBLIC_APP_URL}/api/wallet/apple/updates",
  "authenticationToken": "{wallet_auth_token}"
}
```

### API Route behavior
```
GET /api/wallet/apple/[customerCardId]?token={walletAuthToken}
1. Validate token against customer_cards.wallet_auth_token
2. Fetch customer_card + card + business data
3. Generate PKPass with passkit-generator
4. Return binary response:
   Content-Type: application/vnd.apple.pkpass
   Content-Disposition: attachment; filename="fidelitap.pkpass"
```

### Certificates (env vars)
```
APPLE_CERT_BASE64=         # .p12 certificate in base64
APPLE_CERT_PASSPHRASE=     # .p12 password
APPLE_WWDR_BASE64=         # WWDR intermediate cert in base64
APPLE_TEAM_ID=             # e.g. A1B2C3D4E5
APPLE_PASS_TYPE_ID=        # e.g. pass.co.fidelitap.card
```

### Local development (no Apple Developer account)
Use test certificates from `passkit-generator`'s GitHub repo (`certificates/` folder). These generate `.pkpass` files that install on the iOS Simulator (Xcode, free). On real devices they will fail — replace with production certs when acquiring Apple Developer account.

---

## 7. Google Wallet Pass

### No npm package needed
Google Wallet uses signed JWTs. The API is called via HTTP with a Google Service Account.

### Pass types
- **LoyaltyClass**: one per `loyalty_card` (created/updated when card is activated first time)
- **LoyaltyObject**: one per `customer_card`

### LoyaltyClass fields
```json
{
  "id": "{GOOGLE_WALLET_ISSUER_ID}.card-{loyalty_card_id}",
  "issuerName": "FideliTap",
  "programName": "{card.name}",
  "programLogo": { "sourceUri": { "uri": "{NEXT_PUBLIC_APP_URL}/logo.png" } },
  "rewardsTierLabel": "Sellos",
  "reviewStatus": "UNDER_REVIEW"
}
```

### LoyaltyObject fields
```json
{
  "id": "{GOOGLE_WALLET_ISSUER_ID}.cc-{customer_card_id}",
  "classId": "{GOOGLE_WALLET_ISSUER_ID}.card-{loyalty_card_id}",
  "state": "ACTIVE",
  "loyaltyPoints": {
    "label": "Sellos",
    "balance": { "int": "{current_stamps}" }
  },
  "barcode": {
    "type": "QR_CODE",
    "value": "{unique_code}"
  },
  "textModulesData": [
    { "header": "Premio", "body": "{benefit_description}" },
    { "header": "Requerido", "body": "{stamps_required} sellos" }
  ]
}
```

### API Route behavior
```
GET /api/wallet/google/[customerCardId]?token={walletAuthToken}
1. Validate token against customer_cards.wallet_auth_token
2. Fetch customer_card + card + business
3. Upsert LoyaltyClass for the loyalty_card (if not exists)
4. Upsert LoyaltyObject for the customer_card
5. Sign JWT with service account private key
6. Redirect to https://pay.google.com/gp/v/save/{JWT}
```

### JWT payload
```json
{
  "iss": "{GOOGLE_SERVICE_ACCOUNT_EMAIL}",
  "aud": "google",
  "typ": "savetowallet",
  "iat": "{unix_timestamp}",
  "payload": {
    "loyaltyObjects": [{ "id": "...", "classId": "..." }]
  },
  "origins": ["{NEXT_PUBLIC_APP_URL}"]
}
```

### Credentials (env vars)
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=    # client_email from service account JSON
GOOGLE_SERVICE_ACCOUNT_KEY=      # private_key from JSON (newlines as \n)
GOOGLE_WALLET_ISSUER_ID=         # numeric ID from pay.google.com/business/console
```

### Local development
1. Create free Google Cloud project
2. Enable Wallet API
3. Create Issuer account at pay.google.com/business/console (free, no payment needed)
4. Create Service Account → download JSON → extract email + key
5. Test passes install on real Android devices immediately (no approval needed for testing)

---

## 8. TypeScript types updates

Add to `customer_cards.Row` in `src/types/database.ts`:
```ts
wallet_pass_serial: string | null
wallet_auth_token: string | null
apple_pass_url: string | null
google_pass_url: string | null
```

---

## 9. New migration

```sql
-- Add wallet fields to customer_cards (if not already present)
ALTER TABLE public.customer_cards
  ADD COLUMN IF NOT EXISTS wallet_pass_serial text,
  ADD COLUMN IF NOT EXISTS wallet_auth_token text,
  ADD COLUMN IF NOT EXISTS apple_pass_url text,
  ADD COLUMN IF NOT EXISTS google_pass_url text;

-- RLS: public can read customer_cards for activation
-- (existing insert policy covers activation; auth token validates API routes)
```

---

## 10. Environment variables summary

```bash
# Existing
NEXT_PUBLIC_APP_URL=https://fidelitap.app
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# New — Plan 5
APP_HMAC_SECRET=             # random 32-char secret for unique_code generation

# Apple Wallet
APPLE_CERT_BASE64=
APPLE_CERT_PASSPHRASE=
APPLE_WWDR_BASE64=
APPLE_TEAM_ID=
APPLE_PASS_TYPE_ID=

# Google Wallet
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_KEY=
GOOGLE_WALLET_ISSUER_ID=
```

---

## 11. File structure

```
src/
  app/
    c/
      [slug]/
        page.tsx                    # Public activation page (Server Component)
        activate-form.tsx           # Client form component
        success-screen.tsx          # Wallet buttons after activation
    api/
      wallet/
        apple/
          [customerCardId]/
            route.ts                # GET → returns .pkpass binary
        google/
          [customerCardId]/
            route.ts                # GET → redirects to Google save URL
  lib/
    wallet/
      apple.ts                      # passkit-generator wrapper
      google.ts                     # Google Wallet JWT signer
      hmac.ts                       # unique_code generator
  types/
    database.ts                     # Update customer_cards type
  components/
    activation/
      activate-form.tsx             # name + email form (client)
      success-screen.tsx            # wallet buttons (client)
supabase/
  migrations/
    20260517000000_customer_cards_wallet_fields.sql
```

---

## 12. Security

- API routes authenticate via `wallet_auth_token` query param — each customer has a unique token stored in `customer_cards`
- `unique_code` is HMAC-signed — cannot be forged without `APP_HMAC_SECRET`
- `activateCardAction` is rate-limitable via Upstash Redis (already in project)
- Public RLS on `loyalty_cards` already allows reading active cards by slug
- `customer_cards` insert uses upsert ON CONFLICT — safe for duplicate submissions
- Apple webServiceURL endpoint for push updates is a stub for now (returns 200); actual push implemented in Plan 6

---

## 13. Success criteria

- Customer hits `/c/{slug}`, sees card preview, enters name + email
- After submit: sees success screen with both wallet buttons
- Apple button: browser downloads `fidelitap.pkpass`, iOS Simulator opens it and shows the card in Wallet with stamp count + QR
- Google button: redirects to Google's save page, Android adds the card to Google Wallet
- Database: `customers` and `customer_cards` rows created correctly
- `unique_code` is deterministic and verifiable server-side
