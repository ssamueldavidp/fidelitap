# Dashboard Métricas + Lista de Clientes + Stamp Cooldown — Design Spec

**Date:** 2026-05-18
**Status:** Approved
**Plan number:** 7

---

## 1. Goal

Fill in the dashboard metrics placeholders with real data, build a `/customers` page with search and detail view, and add configurable stamp cooldown per business to prevent double-scanning.

---

## 2. Scope

**In scope:**
- `/dashboard` — replace placeholder "—" metrics with real Supabase queries
- `/customers` — list of customers with name search + loyalty card filter
- `/customers/[customerId]` — stamp history detail for a specific customer
- `/settings` — business settings page with stamp cooldown selector
- `addStampAction` — cooldown check before adding stamp
- Migration: add `stamp_cooldown_seconds` to `businesses`

**Out of scope:**
- Customer edit / delete — future plan
- Email notifications — Plan 8
- Poster/cartel — future plan
- Stripe subscriptions — future plan

---

## 3. Routes

| Route | Type | Auth | Description |
|-------|------|------|-------------|
| `/dashboard` | Page (Server Component) | Business owner session | 4 real metric cards |
| `/customers` | Page (Server Component) | Business owner session | Customer list with search + card filter |
| `/customers/[customerId]` | Page (Server Component) | Business owner session | Stamp history for one customer |
| `/settings` | Page (Server Component + Client form) | Business owner session | Business settings including cooldown |
| `saveSettingsAction` | Server Action | Business owner session | Save stamp_cooldown_seconds to businesses |

---

## 4. Data Model

### Migration: add cooldown to businesses

```sql
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS stamp_cooldown_seconds INT NOT NULL DEFAULT 0;
```

`0` = no cooldown. Allowed values match UI options: 0, 60, 300, 900, 3600, 86400.

### Existing tables used

- `stamp_events` — `business_id`, `customer_card_id`, `created_at`
- `customer_cards` — `customer_id`, `loyalty_card_id`, `current_stamps`, `times_completed`
- `loyalty_cards` — `business_id`, `name`, `stamps_required`
- `customers` — `name`, `email`
- `businesses` — `owner_id`, `name`, `stamp_cooldown_seconds` (new)

---

## 5. Dashboard Metrics

Four queries run in parallel (`Promise.all`) on the server, all filtered by `business_id`:

### Clientes activos
```sql
SELECT COUNT(DISTINCT cc.customer_id)
FROM customer_cards cc
JOIN stamp_events se ON se.customer_card_id = cc.id
WHERE se.business_id = $business_id
  AND se.created_at >= now() - interval '30 days'
```

### Sellos hoy
```sql
SELECT COUNT(*)
FROM stamp_events
WHERE business_id = $business_id
  AND created_at >= current_date
```

### Canjes totales
```sql
SELECT COALESCE(SUM(cc.times_completed), 0)
FROM customer_cards cc
JOIN loyalty_cards lc ON cc.loyalty_card_id = lc.id
WHERE lc.business_id = $business_id
```

### Retención 30d
```
retención = ROUND(clientes_activos / total_clientes * 100)
```
`total_clientes` = COUNT DISTINCT customer_id across all customer_cards for this business. Returns `"0%"` if no customers.

---

## 6. Customers List

### Query
```sql
SELECT
  c.id AS customer_id,
  c.name,
  lc.name AS card_name,
  lc.id AS loyalty_card_id,
  cc.current_stamps,
  lc.stamps_required,
  cc.times_completed,
  MAX(se.created_at) AS last_visit
FROM customers c
JOIN customer_cards cc ON cc.customer_id = c.id
JOIN loyalty_cards lc ON cc.loyalty_card_id = lc.id
LEFT JOIN stamp_events se ON se.customer_card_id = cc.id
WHERE lc.business_id = $business_id
  AND (c.name ILIKE '%' || $q || '%' OR $q IS NULL)
GROUP BY c.id, c.name, lc.name, lc.id, cc.current_stamps, lc.stamps_required, cc.times_completed
ORDER BY last_visit DESC NULLS LAST
```

Filter by card: add `AND lc.id = $card_filter` when set.

### UI
- Search: `?q=nombre` — URL param, Server Component re-fetches on submit
- Filter: `?card=uuid` — dropdown listing all loyalty cards for this business
- Table columns: Nombre, Tarjeta, Progreso (dot indicators), Última visita (relative time), Completadas
- Each row links to `/customers/[customerId]`
- Empty state: "No hay clientes aún" when table is empty

---

## 7. Customer Detail

### Route: `/customers/[customerId]`

Fetches:
1. Customer name + email from `customers`
2. All `customer_cards` for this customer belonging to this business (with loyalty_card name, current_stamps, stamps_required, times_completed)
3. All `stamp_events` for those customer_cards, ordered by `created_at DESC`, limited to 50

### UI
- Header: customer name + email
- Card summary: tarjeta, progreso actual, veces completadas
- Stamp history table: Fecha, Hora (formatted), Escaneado por (stamped_by UUID — show "Cajero" as display name since we don't join to auth.users)
- "Volver a clientes" back link

---

## 8. Settings Page

### Route: `/settings`

Server Component fetches `businesses.stamp_cooldown_seconds` for current user.

Client Component form with:
- **Cooldown entre sellos**: `<select>` with options:
  - `0` → "Sin cooldown"
  - `60` → "1 minuto"
  - `300` → "5 minutos"
  - `900` → "15 minutos"
  - `3600` → "1 hora"
  - `86400` → "24 horas"
- Save button → calls `saveSettingsAction`

### `saveSettingsAction`

```typescript
'use server'
export async function saveSettingsAction(cooldownSeconds: number): Promise<{ error?: string }>
```

- Validates `cooldownSeconds` is one of the allowed values: `[0, 60, 300, 900, 3600, 86400]`
- Updates `businesses SET stamp_cooldown_seconds = $value WHERE owner_id = user.id`
- Returns `{}` on success, `{ error: string }` on failure

---

## 9. Stamp Cooldown in addStampAction

The initial business query in `addStampAction` already fetches `id` — extend it to also fetch `stamp_cooldown_seconds` so no extra round-trip is needed:

```typescript
// Existing query — add stamp_cooldown_seconds
const { data: business } = await supabase
  .from('businesses')
  .select('id, stamp_cooldown_seconds')
  .eq('owner_id', user.id)
  .single()
```

Then, after verifying business ownership, before calling `add_stamp` RPC:

```typescript
if (business.stamp_cooldown_seconds > 0) {
  // Find last stamp for this customer_card
  const { data: lastStamp } = await serviceClient
    .from('stamp_events')
    .select('created_at')
    .eq('customer_card_id', cc.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastStamp) {
    const secondsSinceLast = (Date.now() - new Date(lastStamp.created_at).getTime()) / 1000
    if (secondsSinceLast < biz.stamp_cooldown_seconds) {
      const waitMinutes = Math.ceil((biz.stamp_cooldown_seconds - secondsSinceLast) / 60)
      return { error: `Espera ${waitMinutes} min antes del próximo sello` }
    }
  }
}
```

This check happens server-side and is not bypassable from the client.

---

## 10. File Structure

```
supabase/
  migrations/
    20260518010000_business_cooldown.sql

src/
  app/
    (dashboard)/
      dashboard/
        page.tsx                    — MODIFY: replace placeholders with real metrics
      customers/
        page.tsx                    — NEW: customer list with search + filter
        [customerId]/
          page.tsx                  — NEW: customer stamp history
      settings/
        page.tsx                    — NEW: Server Component + renders SettingsForm
        settings-form.tsx           — NEW: Client Component with cooldown selector
        actions.ts                  — NEW: saveSettingsAction
      scanner/
        actions.ts                  — MODIFY: add cooldown check
  types/
    database.ts                     — MODIFY: add stamp_cooldown_seconds to businesses
```

---

## 11. Security

- All dashboard/customers/settings pages verify `user` from session and fetch `business_id` via `owner_id` — no direct business_id from URL
- `saveSettingsAction` validates allowed cooldown values server-side (whitelist)
- Cooldown check in `addStampAction` uses service client reading from DB — not client-provided

---

## 12. Success Criteria

- `/dashboard` shows real numbers for all 4 metric cards
- `/customers` lists all customers for the business with correct stamp progress
- Search by name filters the list live (on submit)
- `/customers/[customerId]` shows stamp history for that customer
- `/settings` saves cooldown; next scan respects the cooldown window
- Scanner returns `"Espera X min..."` error when cooldown not elapsed
