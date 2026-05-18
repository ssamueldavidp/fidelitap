# Scanner — Stamp Addition + Apple & Google Wallet Real-Time Updates — Design Spec

**Date:** 2026-05-18
**Status:** Approved
**Plan number:** 6

---

## 1. Goal

Enable a business owner to scan a customer's QR code (from Apple Wallet or Google Wallet) and add a stamp to their loyalty card. The customer's wallet card updates in real-time via APNs push (Apple) and Google Wallet API PATCH (Google).

---

## 2. Scope

**In scope:**
- `/scanner` dashboard page — camera QR scanner + manual code fallback
- `addStampAction` server action — atomic stamp increment + stamp_events log
- Apple Wallet web service protocol (5 routes) — device registration, pass re-download, APNs push
- Google Wallet real-time update — PATCH loyaltyObject after each stamp
- `device_registrations` migration

**Out of scope:**
- Stamp cooldown / double-scan protection — future plan
- Customer portal — Plan 8
- Email notifications — Plan 8

---

## 3. Routes

| Route | Type | Auth | Description |
|-------|------|------|-------------|
| `/scanner` | Page (Client Component) | Business owner session | Camera QR scanner + manual fallback |
| `addStampAction` | Server Action | Business owner session | Validate QR, add stamp, fire wallet updates |
| `POST /api/wallet/apple/updates/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]` | API Route | `Authorization: ApplePass <token>` | Register device push token |
| `DELETE /api/wallet/apple/updates/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]` | API Route | `Authorization: ApplePass <token>` | Unregister device |
| `GET /api/wallet/apple/updates/v1/devices/[deviceId]/registrations/[passTypeId]` | API Route | `Authorization: ApplePass <token>` | List passes changed since timestamp |
| `GET /api/wallet/apple/updates/v1/passes/[passTypeId]/[serialNumber]` | API Route | `Authorization: ApplePass <token>` | Return updated .pkpass binary |
| `POST /api/wallet/apple/updates/v1/log` | API Route | None | Apple Wallet error log (ignore body, return 200) |

---

## 4. Data Model

### New table: `device_registrations`

```sql
CREATE TABLE public.device_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_library_identifier TEXT NOT NULL,
  push_token TEXT NOT NULL,
  pass_type_identifier TEXT NOT NULL,
  serial_number TEXT NOT NULL,  -- = customer_cards.wallet_pass_serial
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (device_library_identifier, pass_type_identifier, serial_number)
);

-- Only service role can access (no public RLS)
ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;
```

### Existing tables used

- `customer_cards.unique_code` — QR code value scanned by cashier
- `customer_cards.current_stamps` — incremented atomically
- `customer_cards.is_complete` — set true when stamps >= required
- `customer_cards.times_completed` — incremented on completion
- `customer_cards.wallet_pass_serial` — used to look up device registrations
- `stamp_events` — immutable audit log (already exists)

---

## 5. Data Flow

### Scanner → Stamp

```
Business owner opens /scanner
  → camera starts (html5-qrcode), OR manual input shown

Customer shows QR (from Apple/Google Wallet)
  → QR value = unique_code (HMAC-SHA256)

Scanner detects QR / cashier submits manual code
  → addStampAction(uniqueCode)
    1. Get current user's business_id from session
    2. SELECT customer_cards JOIN loyalty_cards JOIN customers
       WHERE unique_code = scannedCode
    3. Verify loyalty_card.business_id === user.business_id
       (anti-fraud: only your store can stamp your cards)
    4. UPDATE customer_cards
       SET current_stamps = current_stamps + 1,
           updated_at = now()
       WHERE id = customerCard.id
    5. Check completion:
       IF current_stamps >= stamps_required:
         UPDATE SET is_complete = true,
                    times_completed = times_completed + 1,
                    current_stamps = 0   ← resets for new cycle
    6. INSERT stamp_events (immutable log)
    7. SELECT push_token FROM device_registrations WHERE serial_number = wallet_pass_serial
       Promise.allSettled([
         sendApnsPush([...pushTokens]),             ← fire-and-forget
         updateGoogleWalletStamps(...)              ← fire-and-forget
       ])
    8. Return { customerName, currentStamps, stampsRequired, isComplete, timesCompleted }

Scanner shows success state:
  → customer name, stamp dots progress, completion message if isComplete
```

### Apple Wallet Push Flow

```
Pass installed on iPhone
  → Apple calls POST /v1/devices/{deviceId}/registrations/{passTypeId}/{serialNumber}
  → Body: { "pushToken": "abc123..." }
  → We store in device_registrations
  → Return 201

Stamp added (addStampAction)
  → SELECT push_token FROM device_registrations WHERE serial_number = wallet_pass_serial
  → For each token: send APNs push with payload {} (empty — wallet knows to re-fetch)
  → Apple Wallet calls GET /v1/passes/{passTypeId}/{serialNumber}
  → We return regenerated .pkpass with updated stamp count
  → Customer sees updated card in seconds

Pass removed from iPhone
  → Apple calls DELETE /v1/devices/{deviceId}/registrations/{passTypeId}/{serialNumber}
  → We delete from device_registrations
  → Return 200
```

---

## 6. addStampAction

```typescript
'use server'

export type StampResult =
  | { error: string }
  | {
      customerName: string
      currentStamps: number
      stampsRequired: number
      isComplete: boolean
      timesCompleted: number
    }

export async function addStampAction(uniqueCode: string): Promise<StampResult>
```

**Validation errors returned:**
- `'Código QR inválido'` — unique_code not found
- `'Esta tarjeta pertenece a otro negocio'` — business_id mismatch
- `'Error al agregar sello'` — DB error

---

## 7. Scanner UI

**`/app/(dashboard)/scanner/page.tsx`** — Server Component that fetches business context and renders `<ScannerClient>`.

**`/app/(dashboard)/scanner/scanner-client.tsx`** — Client Component:

```
States:
  idle     → camera active, waiting for QR
  scanning → QR detected, addStampAction running
  success  → stamp added, show result card
  error    → show error message, reset after 3s

Layout:
  [Camera viewfinder with green corner brackets]
  [Manual input: "Ingresar código manualmente"]
  
  On success:
  [✓] [Customer name]
  [Stamp dots: ● ● ● ○ ○] 3/5 sellos
  [Premio: 1 café gratis] ← if isComplete
```

Uses `html5-qrcode` (npm install html5-qrcode). Camera stops scanning after successful read to prevent double-scans.

---

## 8. Apple Wallet Web Service Implementation

### Auth header validation

All Apple web service routes validate:
```
Authorization: ApplePass {wallet_auth_token}
```

Lookup: `SELECT wallet_auth_token FROM customer_cards WHERE wallet_pass_serial = serialNumber`.
Return 401 if missing or mismatch.

### Route behaviors

**POST `/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]`**
- Parse `pushToken` from request body
- Upsert into `device_registrations` (ON CONFLICT DO UPDATE SET push_token = EXCLUDED.push_token)
- Return 201 (new) or 200 (already registered)

**DELETE `/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]`**
- Delete from `device_registrations`
- Return 200

**GET `/v1/devices/[deviceId]/registrations/[passTypeId]?passesUpdatedSince=...`**
- Return `{ "serialNumbers": [wallet_pass_serial], "lastUpdated": "..." }` for all passes associated with this device that changed since the timestamp
- Join `device_registrations → customer_cards` and filter by `updated_at > passesUpdatedSince`

**GET `/v1/passes/[passTypeId]/[serialNumber]`**
- Look up `customer_cards WHERE wallet_pass_serial = serialNumber`
- Validate `Authorization: ApplePass {wallet_auth_token}`
- Regenerate and return updated `.pkpass` binary (reuse `generateApplePass`)

**POST `/v1/log`**
- Return 200 (no processing needed)

### `src/lib/wallet/apns.ts`

```typescript
import apn from '@parse/node-apn'

export async function sendApnsPush(pushTokens: string[]): Promise<void>
```

- Uses `APPLE_APN_KEY_BASE64` (APNs Auth Key p8, base64), `APPLE_APN_KEY_ID`, `APPLE_APN_TEAM_ID`
- Topic = `APPLE_PASS_TYPE_ID`
- Payload: `{}` (empty — Apple Wallet fetches updated pass via GET)
- Production: `gateway.push.apple.com` / Sandbox: `gateway.sandbox.push.apple.com`

**New env vars:**
```
APPLE_APN_KEY_BASE64=     # APNs Auth Key (.p8 file), base64-encoded
APPLE_APN_KEY_ID=         # 10-char key ID from Apple Developer
APPLE_APN_TEAM_ID=        # Same as APPLE_TEAM_ID
```

---

## 9. Google Wallet Real-Time Update

Refactor `src/lib/wallet/google.ts` to export:

```typescript
export async function updateGoogleWalletStamps(
  customerCardId: string,
  loyaltyCardId: string,
  newStampCount: number
): Promise<void>
```

- Gets access token (same `getAccessToken` already implemented)
- PATCH `loyaltyObject/{issuerId}.cc-{customerCardId}`:
  ```json
  { "loyaltyPoints": { "label": "Sellos", "balance": { "int": newStampCount } } }
  ```
- Throws on non-OK response (caught by `Promise.allSettled` in addStampAction)

---

## 10. Environment Variables

```bash
# New — Plan 6
APPLE_APN_KEY_BASE64=     # APNs Auth Key p8 (base64) — get from Apple Developer
APPLE_APN_KEY_ID=         # 10-char key ID
# APPLE_APN_TEAM_ID reuses APPLE_TEAM_ID
```

Google Wallet and HMAC vars already set from Plan 5.

---

## 11. File Structure

```
src/
  app/
    (dashboard)/
      scanner/
        page.tsx                    # Server Component — fetches business, renders ScannerClient
        scanner-client.tsx          # Client Component — camera + manual + success/error states
        actions.ts                  # addStampAction
    api/
      wallet/
        apple/
          updates/
            v1/
              devices/
                [deviceLibraryIdentifier]/
                  registrations/
                    [passTypeIdentifier]/
                      [serialNumber]/
                        route.ts    # POST (register) + DELETE (unregister)
                      route.ts      # GET (list changed passes for device)
              passes/
                [passTypeIdentifier]/
                  [serialNumber]/
                    route.ts        # GET (re-download updated pass)
              log/
                route.ts            # POST (error log stub)
  lib/
    wallet/
      apns.ts                       # APNs push via @parse/node-apn
      google.ts                     # Add exported updateGoogleWalletStamps
supabase/
  migrations/
    20260518000000_device_registrations.sql
```

---

## 12. Security

- `addStampAction` verifies `loyalty_card.business_id === user.business_id` — prevents cross-business stamping
- Apple web service routes validate `Authorization: ApplePass {wallet_auth_token}` using `timingSafeEqual`
- Stamp increment is a single atomic PostgreSQL UPDATE — concurrent scans from multiple cashiers always produce correct counts
- `stamp_events` is immutable — provides full audit trail of who stamped, when, from which IP

---

## 13. Concurrency

Multiple stores scanning simultaneously is safe because each store's customers have separate `customer_card` rows (one per `loyalty_card`, which belongs to one business). No shared state between stores.

Multiple cashiers at the same store scanning the same customer simultaneously: PostgreSQL's row-level locking on `UPDATE ... SET current_stamps = current_stamps + 1` guarantees each scan increments exactly once. Each scan also creates a `stamp_event` row.

---

## 14. Success Criteria

- Business opens `/scanner`, camera activates on mobile
- Customer shows Apple/Google Wallet QR
- Scanner reads QR → success state shows customer name + updated stamp count
- Manual fallback: cashier types unique_code → same flow
- Apple Wallet: customer sees updated stamp count within ~3 seconds (APNs push)
- Google Wallet: loyalty points balance updates on next open
- Supabase: `customer_cards.current_stamps` incremented, `stamp_events` row created
- After completing card: `current_stamps` resets to 0, `is_complete = true`, `times_completed` incremented
