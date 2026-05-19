# Poster/Cartel del Negocio — Design Spec

**Date:** 2026-05-19
**Status:** Approved
**Plan number:** 9

---

## 1. Goal

Allow businesses to generate, customize, and download a printable loyalty-program poster (cartel) in PNG and PDF formats. The poster includes a QR code, business info, reward text, stamp preview, and wallet onboarding instructions.

---

## 2. Scope

**In scope:**
- `/poster` dashboard page with visual editor (orientation toggle, background, reward text)
- PNG + PDF download via API route
- Satori + Sharp + pdf-lib generation stack
- QR code embedded in poster (linking to `/c/{card_slug}`)
- Wallet onboarding section on the poster (3 steps + tutorial URL)
- `/ayuda/wallet` public static tutorial page
- DB columns to persist poster settings per business/card

**Out of scope:**
- Custom fonts upload
- Multiple poster templates
- Poster sharing via link (download only)
- Localization beyond Spanish

---

## 3. New Dependencies

```
satori           ^0.10.x  — JSX → SVG server-side
@resvg/resvg-js  ^2.x     — SVG → PNG (Sharp alternative, WASM-based, works in Edge)
pdf-lib          ^1.x     — wrap PNG into single-page PDF
```

> Note: Use `@resvg/resvg-js` instead of Sharp because Sharp has native binaries that can cause issues in Next.js API routes. `@resvg/resvg-js` is WASM-based and works cleanly in the Node.js runtime.

---

## 4. Database Changes

```sql
-- businesses
ALTER TABLE businesses
  ADD COLUMN poster_bg_color TEXT NOT NULL DEFAULT '#0B0B0B',
  ADD COLUMN poster_bg_image_url TEXT;

-- loyalty_cards
ALTER TABLE loyalty_cards
  ADD COLUMN poster_reward_text TEXT;
```

Types updated in `src/types/database.ts`.

---

## 5. File Structure

```
supabase/migrations/
  YYYYMMDD_poster_settings.sql

src/
  app/
    (dashboard)/
      poster/
        page.tsx                  — Server Component: loads business + cards
        poster-editor.tsx         — Client Component: form + download buttons
        actions.ts                — savePosterSettingsAction
    api/
      poster/
        [cardId]/
          route.ts                — GET ?format=png|pdf&orientation=vertical|horizontal
    ayuda/
      wallet/
        page.tsx                  — Public static tutorial page
  lib/
    poster/
      generate.ts                 — Satori → SVG → PNG → PDF pipeline
      template.tsx                — JSX template (vertical + horizontal variants)
  types/
    database.ts                   — extend with new columns
```

---

## 6. Poster Content

Both orientations contain the same data:

| Element | Source |
|---------|--------|
| "FIDELITAP" header | Static |
| Business name | `businesses.name` |
| Reward text | `loyalty_cards.poster_reward_text` (editable) |
| QR code | Generated from `${APP_URL}/c/{card_slug}` |
| "Escanea para unirte" label | Static |
| Stamp dots | `loyalty_cards.stamps_required` (filled count always 0 on poster — it's a template) |
| Wallet steps (①②③) | Static |
| Tutorial URL | `fidelitap.co/ayuda/wallet` |
| "powered by FideliTap" footer | Static |
| Background | `businesses.poster_bg_color` OR `businesses.poster_bg_image_url` |

---

## 7. Orientations

### Vertical (Portrait — A4 210×297mm @ 96dpi → 794×1123px)

All elements stacked and centered:
1. FideliTap header
2. Business name
3. Reward text
4. QR code (large, centered)
5. "Escanea para unirte"
6. Stamp dots
7. Divider
8. Wallet section (two columns: steps left, tutorial URL right)
9. "powered by FideliTap"

### Horizontal (Landscape — A4 rotated → 1123×794px)

Two-column layout:
- **Left column:** FideliTap header, business name, reward text, stamp dots, wallet steps, tutorial URL, footer
- **Right column:** QR code (large), "Escanea para unirte"

---

## 8. API Route

```
GET /api/poster/[cardId]?format=png|pdf&orientation=vertical|horizontal&bgColor=%230B0B0B&rewardText=...
```

- Auth: validates that `cardId` belongs to the authenticated business (via Supabase session cookie)
- `bgColor`: hex string (used when no `poster_bg_image_url`)
- `rewardText`: URL-encoded string
- Response headers:
  - PNG: `Content-Type: image/png`, `Content-Disposition: attachment; filename="cartel.png"`
  - PDF: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="cartel.pdf"`

Pipeline (`src/lib/poster/generate.ts`):
1. Generate QR as data URL using `qrcode` (already installed)
2. Render JSX template with satori → SVG string
3. Convert SVG → PNG with `@resvg/resvg-js`
4. If PDF: embed PNG into single A4 page with `pdf-lib`
5. Return buffer

---

## 9. Dashboard Editor (`poster-editor.tsx`)

Client Component props:
```typescript
{
  business: { id, name, poster_bg_color, poster_bg_image_url }
  cards: { id, slug, stamps_required, poster_reward_text }[]
  defaultCardId: string
}
```

UI elements:
- **Card selector** (hidden if only one card)
- **Orientation toggle**: "Vertical" | "Horizontal"
- **Reward text** textarea (auto-filled from `loyalty_cards.poster_reward_text`)
- **Background** radio: "Color" | "Foto"
  - Color: hex input (color picker + text field), default `#0B0B0B`
  - Foto: `<input type="file" accept="image/*">` — file converted to base64 and sent in request body as `bgImageBase64`
- **Save settings** button → calls `savePosterSettingsAction`
- **Download PNG** button → `fetch /api/poster/[cardId]?format=png&...` → triggers browser download
- **Download PDF** button → same with `format=pdf`

Download flow: fetch the API route, get the blob, create an object URL, click a hidden `<a>` tag, revoke the URL. No page navigation.

---

## 10. Server Action (`actions.ts`)

```typescript
export async function savePosterSettingsAction(formData: FormData): Promise<{ error?: string }>
```

- Validates `cardId` belongs to authenticated business
- Updates `loyalty_cards.poster_reward_text`
- Updates `businesses.poster_bg_color` and `businesses.poster_bg_image_url`
- For photo: uploads to Supabase Storage bucket `poster-backgrounds/{business_id}`, saves public URL

---

## 11. `/ayuda/wallet` Page

Public static page (no auth required). Content:

**Heading:** "¿Cómo agregar tu tarjeta de sellos al Wallet?"

**Apple Wallet section:**
1. Abre el email de bienvenida de FideliTap
2. Toca el botón "Agregar a Apple Wallet"
3. Confirma en la hoja que aparece
4. Tu tarjeta aparece en la app Wallet

**Google Wallet section:**
1. Abre el email de bienvenida de FideliTap
2. Toca "Agregar a Google Wallet"
3. Inicia sesión con tu cuenta Google si te lo pide
4. Tu tarjeta queda guardada en Google Wallet

Same visual shell as the rest of the app (`#0B0B0B` bg, `#00C896` accent).

---

## 12. Security

- API route authenticates the request: reads session cookie, verifies `cardId` → `loyalty_card.business_id` === `business.owner_id`
- `poster_bg_image_url` comes from Supabase Storage (internal URL), never from client-provided string
- Base64 image upload capped at 5MB in the action

---

## 13. Success Criteria

- Business opens `/poster`, configures the cartel, downloads PNG → file opens as a valid image
- Business downloads PDF → file opens as a valid single-page A4 PDF
- Vertical and horizontal orientations produce correct layouts
- Settings (reward text, bg color) persist across page reloads
- `/ayuda/wallet` is accessible without auth and renders the tutorial
- `npx tsc --noEmit` passes after all changes
