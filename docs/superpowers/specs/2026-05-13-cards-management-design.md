# Cards Management — Design Spec

**Date:** 2026-05-13  
**Feature:** Gestión de tarjetas de fidelización (`/cards`)

---

## Overview

Page where merchants create, configure, and manage their loyalty card programs. Provides a card grid view with a slide-out drawer for quick stats/actions, and a dedicated editor page with live Wallet preview.

---

## Routes

| Route | Description |
|---|---|
| `/cards` | Main grid — list of all loyalty cards |
| `/cards/nueva` | Dedicated editor — create new card |
| `/cards/[id]/editar` | Dedicated editor — edit existing card |

All routes are under the `(dashboard)` layout group (auth-protected, sidebar included).

---

## Page: `/cards`

### Layout

Full-width page with:
- **Header**: title "Mis tarjetas" + subtitle + "Nueva tarjeta" button (top-right, green, links to `/cards/nueva`)
- **Tabs**: Activas (N) · Inactivas (N) — filter by `is_active`
- **Grid**: 3-column responsive grid of `CardWidget` components
- **Empty state**: last slot is always a dashed "Nueva tarjeta" card; if zero cards, show centered empty state with CTA

### Plan Limit Check

Before rendering the "Nueva tarjeta" button as enabled, check current card count against `PLAN_LIMITS[plan].maxCards`:
- At limit → button is disabled, shows tooltip "Actualizá tu plan para agregar más tarjetas"
- The dashed "nueva" card in the grid also shows the upgrade prompt when at limit

### CardWidget

Displays each loyalty card as a visual tile:

```
┌─────────────────────────┐
│ ● Activa          [badge]│
│ ☕                       │
│ Café mensual             │
│ Premio: 1 café gratis    │
│ ● ● ● ○ ○ ○ ○ ○         │
│ 134 clientes  23 canjes  │
└─────────────────────────┘
```

- Background styled from `design_config` (`solid` color or `image` bg)
- Stamp dots: filled dots up to `stamps_required`, colored per card color
- Click anywhere → opens `CardDrawer`
- Hover: slight lift (`translateY(-2px)`)

### CardDrawer

Slides in from the right, overlaying the grid (grid dims to 0.4 opacity behind). Closes on backdrop click or ✕.

**Contents (top to bottom):**

1. **Header**: card name + ✕ close button
2. **Mini Wallet Preview**: small replica of the card (icon, name, stamp dots, reward)
3. **Stats**:
   - Clientes (distinct customer count)
   - Canjes (redemptions count)
4. **"✏️ Editar tarjeta →"** — navigates to `/cards/[id]/editar`
5. **Toggle "Tarjeta activa"**: toggles `is_active` via Server Action; optimistic UI update; moves card between tabs on next revalidation
6. **QR / Link section**:
   - Displays `fidelitap.app/c/[slug]` as a copyable link
   - QR code rendered client-side (e.g., `qrcode.react`)
   - "Copiar enlace" button
7. **"Eliminar tarjeta"** (red, bottom): triggers delete confirmation modal

### Delete Flow

**If card has 0 customers:**
> Modal: "¿Eliminar esta tarjeta? Esta acción no se puede deshacer." → Confirm → hard delete

**If card has customers:**
> Modal: "Esta tarjeta tiene {N} clientes con sellos acumulados. Al eliminar, sus datos se conservarán en tu historial pero la tarjeta dejará de funcionar para nuevos sellos. ¿Continuar?" → Confirm → soft delete (`deleted_at = now()`)

Soft-deleted cards are excluded from all queries via a default filter `where deleted_at is null`.

---

## Page: `/cards/nueva` and `/cards/[id]/editar`

### Layout

Two-column layout:
- **Left (form)**: all editable fields
- **Right (preview)**: live `WalletPreview` component, updates on every field change

Back navigation: "← Mis tarjetas" link at top-left.

### Form Fields

| Field | Input Type | Validation |
|---|---|---|
| Nombre de la tarjeta | text input | required, max 50 chars |
| Premio al completar | text input | required, max 100 chars |
| Sellos requeridos | number input (stepper) | integer, min 1, max 20 |
| Ícono | emoji picker grid (24 options) | required |
| Fondo | toggle: "Color" \| "Foto" | — |
| Color (if solid) | color swatches (6 predefined) | required when bg_type=solid |
| Foto (if image) | file upload | JPG/PNG, max 2MB, uploaded to Supabase Storage |

**Predefined colors:** `#00C896`, `#6366f1`, `#f59e0b`, `#ef4444`, `#ec4899`, `#0ea5e9`

**Predefined emoji options:** ☕ 🍕 🌮 🍔 🎂 ✂️ 🛍️ 💈 🍦 🥐 🍣 🎯 💪 📚 🌸 🎵 🍷 🧁 🏋️ 🎨 🐾 🧘 🚀 ⭐

### WalletPreview (live)

Right column shows a replica of how the card will look in the customer's Apple/Google Wallet pass:

```
┌─────────────────────┐
│ [Business name]     │
│ ☕ Café mensual     │
│ ● ● ● ○ ○ ○ ○ ○    │
│ Premio: 1 café gratis│
└─────────────────────┘
```

Updates in real-time via React controlled state (no API calls). Background reflects selected color or uploaded photo.

### Save Action

Client-side validation with Zod before submit. Server Action handles:

**Create (`/cards/nueva`):**
1. Validate business owns the session
2. Check plan card limit (rejects if at limit)
3. Generate `slug` from card name (slugify, ensure uniqueness)
4. If `bg_type === 'image'`, upload file to Supabase Storage → store URL in `design_config.bg_image_url`
5. Insert into `loyalty_cards`
6. `revalidatePath('/cards')` → redirect to `/cards`

**Update (`/cards/[id]/editar`):**
1. Validate business owns the card
2. If new image uploaded, upload to Storage (delete old if replacing)
3. Update `loyalty_cards` row
4. `revalidatePath('/cards')` → redirect to `/cards`

### Slug Generation

Custom utility (no library needed):
1. Lowercase + remove accents (normalize to NFD, strip combining chars)
2. Replace non-alphanumeric with `-`, collapse multiple `-`
3. Append 4-char hex suffix from `crypto.randomUUID()` to guarantee uniqueness
4. Max length: 60 chars

Example: `"Café mensual"` → `"cafe-mensual-a3f2"`

Enforce unique constraint on `slug` column in DB.

---

## Database Changes

### Migration: add `slug` and `deleted_at` to `loyalty_cards`

```sql
ALTER TABLE public.loyalty_cards
  ADD COLUMN slug text UNIQUE,
  ADD COLUMN deleted_at timestamptz DEFAULT NULL;

-- Backfill slug for existing cards
UPDATE public.loyalty_cards
SET slug = slugify(name) || '-' || substr(gen_random_uuid()::text, 1, 4)
WHERE slug IS NULL;

ALTER TABLE public.loyalty_cards
  ALTER COLUMN slug SET NOT NULL;

-- Index for soft-delete filter
CREATE INDEX idx_loyalty_cards_deleted_at ON public.loyalty_cards(deleted_at)
  WHERE deleted_at IS NULL;
```

### Supabase Storage Bucket

Bucket: `card-backgrounds`
- Public read (backgrounds are shown to customers in Wallet)
- Authenticated write (only business owner uploads)
- Max file size: 2MB
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`

### RLS Policies (loyalty_cards)

Existing policies apply. Ensure:
- `SELECT`: `business_id = auth.uid()` AND `deleted_at IS NULL`
- `UPDATE`: `business_id = auth.uid()`
- `DELETE`: `business_id = auth.uid()` (soft delete handled at app layer)

---

## Component Tree

```
/cards
└── CardsPage (Server Component)
    ├── PageHeader (title, Nueva button)
    ├── CardsTabs (Client Component — tab state)
    │   └── CardsGrid
    │       ├── CardWidget × N (each card)
    │       └── NewCardSlot (dashed CTA)
    └── CardDrawer (Client Component — drawer state)
        ├── WalletPreview (mini, read-only)
        ├── CardStats
        ├── ActiveToggle
        ├── ShareSection (QR + copy link)
        └── DeleteButton → DeleteConfirmModal

/cards/nueva
/cards/[id]/editar
└── CardEditorPage (Client Component)
    ├── EditorForm
    │   ├── TextField (nombre, premio)
    │   ├── NumberStepper (sellos)
    │   ├── EmojiPicker
    │   └── BackgroundPicker (color swatches | image upload)
    └── WalletPreview (live, synced to form state)
```

---

## Out of Scope (future features)

- Customer-facing route `/c/[slug]` — the page customers visit to join a loyalty card (separate plan)
- Card analytics page (detailed stamp timeline, customer list per card)
- Duplicate card
- Card templates
- Archived/trash view for soft-deleted cards
- Push notifications when customers reach milestone stamps

---

## Success Criteria

- Merchant can create a card with all fields and see it immediately in the grid
- Merchant can edit any field and the Wallet preview updates live
- Merchant can toggle active/inactive from the drawer without leaving the grid
- Merchant can share the card link via QR or copy
- Deleting a card with customers preserves all customer stamp data
- Plan limits block card creation at the correct threshold with an upgrade CTA
