# Poster/Cartel del Negocio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow businesses to generate and download a printable loyalty-program poster (PNG + PDF) in vertical or horizontal orientation, with customizable reward text and background.

**Architecture:** A dashboard editor page lets the business configure and save poster settings (reward text, background color or photo). A Next.js API route reads those saved settings, generates the poster using Satori (JSX → SVG) + @resvg/resvg-js (SVG → PNG) + pdf-lib (PNG → PDF), and streams the file back for download. A public `/ayuda/wallet` page is referenced on the poster as a wallet tutorial.

**Tech Stack:** Next.js 14 App Router, Supabase (createClient + createServiceClient), satori, @resvg/resvg-js, pdf-lib, qrcode (already installed), Supabase Storage for background photos.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260519000000_poster_settings.sql` | Create | Add poster columns to DB + storage bucket |
| `src/types/database.ts` | Modify | Add new columns to Business and LoyaltyCard types |
| `src/lib/poster/fonts/Inter-Regular.ttf` | Download | Font file for satori |
| `src/lib/poster/fonts/Inter-Bold.ttf` | Download | Font file for satori |
| `src/lib/poster/template.tsx` | Create | JSX template for satori (vertical + horizontal) |
| `src/lib/poster/generate.ts` | Create | Satori → SVG → PNG → PDF pipeline |
| `src/app/api/poster/[cardId]/route.ts` | Create | GET handler: auth + generate + stream response |
| `src/app/(dashboard)/poster/actions.ts` | Create | `savePosterSettingsAction` Server Action |
| `src/app/(dashboard)/poster/poster-editor.tsx` | Create | Client Component: form + download buttons |
| `src/app/(dashboard)/poster/page.tsx` | Create | Server Component: load data, render editor |
| `src/app/ayuda/wallet/page.tsx` | Create | Public static wallet tutorial page |

---

## Task 1: DB Migration + TypeScript Types

**Files:**
- Create: `supabase/migrations/20260519000000_poster_settings.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/20260519000000_poster_settings.sql`:

```sql
-- Poster settings on businesses
ALTER TABLE businesses
  ADD COLUMN poster_bg_color TEXT NOT NULL DEFAULT '#0B0B0B',
  ADD COLUMN poster_bg_image_url TEXT;

-- Editable reward text per loyalty card
ALTER TABLE loyalty_cards
  ADD COLUMN poster_reward_text TEXT;

-- Storage bucket for poster background photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('poster-backgrounds', 'poster-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "business owners can upload poster bg"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'poster-backgrounds'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM businesses WHERE owner_id = auth.uid() LIMIT 1
  )
);

-- Allow public read of poster backgrounds
CREATE POLICY "public can read poster bg"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'poster-backgrounds');
```

- [ ] **Step 2: Apply migration**

```bash
cd /Users/samuelrodriguez/development/fidelitap
npx supabase db push
```

Expected: migration applied successfully, no errors.

- [ ] **Step 3: Update `src/types/database.ts` — businesses type**

In `src/types/database.ts`, add `poster_bg_color` and `poster_bg_image_url` to the `businesses` table Row, Insert, and Update types:

```typescript
// businesses Row (line ~14) — add after stamp_cooldown_seconds:
poster_bg_color: string
poster_bg_image_url: string | null

// businesses Insert (line ~27) — add:
poster_bg_color?: string
poster_bg_image_url?: string | null

// businesses Update (line ~40) — add:
poster_bg_color?: string
poster_bg_image_url?: string | null
```

- [ ] **Step 4: Update `src/types/database.ts` — loyalty_cards type**

In `src/types/database.ts`, add `poster_reward_text` to the `loyalty_cards` table Row, Insert, and Update types:

```typescript
// loyalty_cards Row (line ~60) — add after slug:
poster_reward_text: string | null

// loyalty_cards Insert (line ~73) — add:
poster_reward_text?: string | null

// loyalty_cards Update (line ~85) — add:
poster_reward_text?: string | null
```

- [ ] **Step 5: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260519000000_poster_settings.sql src/types/database.ts
git commit -m "feat: add poster settings columns and storage bucket"
```

---

## Task 2: Poster Generation Library

**Files:**
- Download: `src/lib/poster/fonts/Inter-Regular.ttf`
- Download: `src/lib/poster/fonts/Inter-Bold.ttf`
- Create: `src/lib/poster/template.tsx`
- Create: `src/lib/poster/generate.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install satori @resvg/resvg-js pdf-lib
```

Expected: packages added to `node_modules`, no peer dependency errors.

- [ ] **Step 2: Download Inter font files**

```bash
mkdir -p src/lib/poster/fonts
curl -L -o src/lib/poster/fonts/Inter-Regular.ttf \
  "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf"
curl -L -o src/lib/poster/fonts/Inter-Bold.ttf \
  "https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf"
```

Expected: two .ttf files appear in `src/lib/poster/fonts/`.

- [ ] **Step 3: Create `src/lib/poster/template.tsx`**

This file exports a single function that returns the JSX satori will render. Satori supports a subset of flexbox CSS via inline styles — no Tailwind, no CSS classes, no `rem` units.

```tsx
import React from 'react'

export interface PosterData {
  businessName: string
  rewardText: string
  stampsRequired: number
  qrDataUrl: string      // base64 PNG data URL from qrcode package
  bgColor: string        // hex e.g. '#0B0B0B'
  bgImageUrl: string | null
  orientation: 'vertical' | 'horizontal'
}

// Vertical: 794 × 1123px  (A4 portrait at 96dpi)
// Horizontal: 1123 × 794px (A4 landscape at 96dpi)

const ACCENT = '#00C896'
const WHITE = '#FFFFFF'
const GREY = '#6B7280'
const DARK = '#0B0B0B'

function StampDots({ total }: { total: number }) {
  const dots = Array.from({ length: Math.min(total, 10) })
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
      {dots.map((_, i) => (
        <div
          key={i}
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            background: '#222',
            border: `2px solid ${GREY}`,
          }}
        />
      ))}
    </div>
  )
}

function WalletSection({ horizontal }: { horizontal: boolean }) {
  const containerStyle: React.CSSProperties = horizontal
    ? { display: 'flex', flexDirection: 'row', gap: 24, width: '100%', alignItems: 'flex-start' }
    : { display: 'flex', flexDirection: 'row', gap: 16, width: '100%', alignItems: 'flex-start' }

  return (
    <div style={containerStyle}>
      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 6 }}>
        <div style={{ color: WHITE, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          ¿Cómo guardar tu tarjeta?
        </div>
        <div style={{ color: GREY, fontSize: 11 }}>① Escanea el QR de arriba y regístrate</div>
        <div style={{ color: GREY, fontSize: 11 }}>② Toca "Agregar a Apple Wallet" o "Google Wallet"</div>
        <div style={{ color: GREY, fontSize: 11 }}>③ ¡Listo! Tu tarjeta queda en tu teléfono</div>
        <div style={{ color: ACCENT, fontSize: 11, marginTop: 4 }}>fidelitap.co/ayuda/wallet</div>
      </div>
    </div>
  )
}

export function VerticalPosterTemplate(data: PosterData) {
  const bg = data.bgImageUrl
    ? { backgroundImage: `url(${data.bgImageUrl})`, backgroundSize: 'cover' }
    : { background: data.bgColor }

  return (
    <div
      style={{
        width: 794,
        height: 1123,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '64px 80px',
        fontFamily: '"Inter", sans-serif',
        ...bg,
      }}
    >
      {/* Top */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ color: ACCENT, fontSize: 14, fontWeight: 700, letterSpacing: 4 }}>
          FIDELITAP
        </div>
        <div style={{ color: WHITE, fontSize: 44, fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>
          {data.businessName}
        </div>
        <div style={{ color: GREY, fontSize: 18, textAlign: 'center' }}>
          {data.rewardText}
        </div>
      </div>

      {/* QR */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            background: WHITE,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qrDataUrl} width={220} height={220} alt="QR" />
        </div>
        <div style={{ color: GREY, fontSize: 14 }}>Escanea para unirte</div>
        <StampDots total={data.stampsRequired} />
      </div>

      {/* Bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 24 }}>
        <div style={{ height: 1, background: '#222', width: '100%' }} />
        <WalletSection horizontal={false} />
        <div style={{ color: '#333', fontSize: 12, textAlign: 'center' }}>
          powered by FideliTap
        </div>
      </div>
    </div>
  )
}

export function HorizontalPosterTemplate(data: PosterData) {
  const bg = data.bgImageUrl
    ? { backgroundImage: `url(${data.bgImageUrl})`, backgroundSize: 'cover' }
    : { background: data.bgColor }

  return (
    <div
      style={{
        width: 1123,
        height: 794,
        display: 'flex',
        flexDirection: 'row',
        fontFamily: '"Inter", sans-serif',
        ...bg,
      }}
    >
      {/* Left column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px 64px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: ACCENT, fontSize: 13, fontWeight: 700, letterSpacing: 4 }}>
            FIDELITAP
          </div>
          <div style={{ color: WHITE, fontSize: 40, fontWeight: 700, lineHeight: 1.1 }}>
            {data.businessName}
          </div>
          <div style={{ color: GREY, fontSize: 16 }}>{data.rewardText}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {Array.from({ length: Math.min(data.stampsRequired, 10) }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: '#222',
                  border: `2px solid ${GREY}`,
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ height: 1, background: '#222', width: '100%' }} />
          <WalletSection horizontal={true} />
          <div style={{ color: '#333', fontSize: 11 }}>powered by FideliTap</div>
        </div>
      </div>

      {/* Right column — QR */}
      <div
        style={{
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: '56px 48px',
          borderLeft: '1px solid #1a1a1a',
        }}
      >
        <div
          style={{
            background: WHITE,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.qrDataUrl} width={200} height={200} alt="QR" />
        </div>
        <div style={{ color: GREY, fontSize: 14, textAlign: 'center' }}>Escanea para unirte</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `src/lib/poster/generate.ts`**

```typescript
import path from 'path'
import fs from 'fs'
import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import { PDFDocument } from 'pdf-lib'
import QRCode from 'qrcode'
import { VerticalPosterTemplate, HorizontalPosterTemplate, PosterData } from './template'

// Font buffers — read once at module load
const interRegular = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/poster/fonts/Inter-Regular.ttf')
)
const interBold = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/poster/fonts/Inter-Bold.ttf')
)

const FONTS = [
  { name: 'Inter', data: interRegular.buffer as ArrayBuffer, weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: interBold.buffer as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
]

async function buildPng(data: PosterData): Promise<Buffer> {
  const isVertical = data.orientation === 'vertical'
  const width = isVertical ? 794 : 1123
  const height = isVertical ? 1123 : 794

  const element = isVertical
    ? VerticalPosterTemplate(data)
    : HorizontalPosterTemplate(data)

  const svg = await satori(element, { width, height, fonts: FONTS })

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } })
  return Buffer.from(resvg.render().asPng())
}

export async function generatePosterPng(data: PosterData): Promise<Buffer> {
  return buildPng(data)
}

export async function generatePosterPdf(data: PosterData): Promise<Buffer> {
  const pngBuffer = await buildPng(data)

  const pdfDoc = await PDFDocument.create()
  const pngImage = await pdfDoc.embedPng(pngBuffer)

  // A4 in PDF points: portrait 595×842, landscape 842×595
  const isVertical = data.orientation === 'vertical'
  const pageWidth = isVertical ? 595.28 : 841.89
  const pageHeight = isVertical ? 841.89 : 595.28
  const page = pdfDoc.addPage([pageWidth, pageHeight])
  page.drawImage(pngImage, { x: 0, y: 0, width: pageWidth, height: pageHeight })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export async function buildQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
}
```

- [ ] **Step 5: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors. If satori types are missing, run `npm install --save-dev @types/satori` (though satori ships its own types).

- [ ] **Step 6: Commit**

```bash
git add src/lib/poster/ package.json package-lock.json
git commit -m "feat: add poster generation library (satori + resvg + pdf-lib)"
```

---

## Task 3: Poster API Route

**Files:**
- Create: `src/app/api/poster/[cardId]/route.ts`

- [ ] **Step 1: Create route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generatePosterPng, generatePosterPdf, buildQrDataUrl } from '@/lib/poster/generate'

export async function GET(
  request: NextRequest,
  { params }: { params: { cardId: string } }
) {
  // Auth: must be a logged-in business owner
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const format = request.nextUrl.searchParams.get('format') ?? 'png'
  const orientation = request.nextUrl.searchParams.get('orientation') ?? 'vertical'

  if (!['png', 'pdf'].includes(format)) {
    return NextResponse.json({ error: 'Formato inválido' }, { status: 400 })
  }
  if (!['vertical', 'horizontal'].includes(orientation)) {
    return NextResponse.json({ error: 'Orientación inválida' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Load card + business, verify ownership
  const { data: cardRaw } = await serviceClient
    .from('loyalty_cards')
    .select(`
      id,
      slug,
      stamps_required,
      poster_reward_text,
      businesses ( id, owner_id, name, poster_bg_color, poster_bg_image_url )
    `)
    .eq('id', params.cardId)
    .maybeSingle()

  if (!cardRaw) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const card = cardRaw as unknown as {
    id: string
    slug: string
    stamps_required: number
    poster_reward_text: string | null
    businesses: {
      id: string
      owner_id: string
      name: string
      poster_bg_color: string
      poster_bg_image_url: string | null
    } | null
  }

  if (!card.businesses || card.businesses.owner_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const biz = card.businesses
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.co'
  const joinUrl = `${appUrl}/c/${card.slug}`

  try {
    const qrDataUrl = await buildQrDataUrl(joinUrl)

    const posterData = {
      businessName: biz.name,
      rewardText: card.poster_reward_text ?? '',
      stampsRequired: card.stamps_required,
      qrDataUrl,
      bgColor: biz.poster_bg_color,
      bgImageUrl: biz.poster_bg_image_url,
      orientation: orientation as 'vertical' | 'horizontal',
    }

    if (format === 'pdf') {
      const pdf = await generatePosterPdf(posterData)
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="cartel.pdf"',
        },
      })
    }

    const png = await generatePosterPng(posterData)
    return new NextResponse(png, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="cartel.png"',
      },
    })
  } catch (err) {
    console.error('[poster] generation error:', err)
    return NextResponse.json({ error: 'Error generando el cartel' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and smoke-test the route**

```bash
npm run dev
```

In another terminal (replace `CARD_ID` with a real loyalty card ID from your DB):
```bash
curl -c cookies.txt -b cookies.txt \
  "http://localhost:3000/api/poster/CARD_ID?format=png&orientation=vertical" \
  -o /tmp/test.png && open /tmp/test.png
```

Expected: a PNG file opens showing the poster layout.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/poster/
git commit -m "feat: add poster API route (PNG + PDF download)"
```

---

## Task 4: Dashboard Editor Page

**Files:**
- Create: `src/app/(dashboard)/poster/actions.ts`
- Create: `src/app/(dashboard)/poster/poster-editor.tsx`
- Create: `src/app/(dashboard)/poster/page.tsx`

- [ ] **Step 1: Create `src/app/(dashboard)/poster/actions.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type SavePosterResult = { error?: string }

export async function savePosterSettingsAction(
  formData: FormData
): Promise<SavePosterResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const cardId = formData.get('cardId') as string
  const rewardText = (formData.get('rewardText') as string | null) ?? ''
  const bgType = formData.get('bgType') as 'color' | 'photo'
  const bgColor = (formData.get('bgColor') as string | null) ?? '#0B0B0B'
  const bgImage = formData.get('bgImage') as File | null

  if (!cardId) return { error: 'Tarjeta requerida' }

  const serviceClient = createServiceClient()

  // Verify ownership
  const { data: card } = await serviceClient
    .from('loyalty_cards')
    .select('id, businesses ( id, owner_id )')
    .eq('id', cardId)
    .maybeSingle()

  const cardTyped = card as unknown as {
    id: string
    businesses: { id: string; owner_id: string } | null
  } | null

  if (!cardTyped?.businesses || cardTyped.businesses.owner_id !== user.id) {
    return { error: 'No autorizado' }
  }

  const businessId = cardTyped.businesses.id

  // Save reward text on loyalty_cards
  const { error: cardErr } = await serviceClient
    .from('loyalty_cards')
    .update({ poster_reward_text: rewardText.trim() || null })
    .eq('id', cardId)

  if (cardErr) return { error: 'Error al guardar texto de recompensa' }

  // Save background
  if (bgType === 'photo' && bgImage && bgImage.size > 0) {
    if (bgImage.size > 5 * 1024 * 1024) return { error: 'La imagen no debe superar 5MB' }

    const arrayBuffer = await bgImage.arrayBuffer()
    const ext = bgImage.type === 'image/png' ? 'png' : 'jpg'
    const filePath = `${businessId}/bg.${ext}`

    const { error: uploadErr } = await serviceClient.storage
      .from('poster-backgrounds')
      .upload(filePath, arrayBuffer, { contentType: bgImage.type, upsert: true })

    if (uploadErr) return { error: 'Error al subir la imagen' }

    const { data: { publicUrl } } = serviceClient.storage
      .from('poster-backgrounds')
      .getPublicUrl(filePath)

    const { error: bizErr } = await serviceClient
      .from('businesses')
      .update({ poster_bg_color: '#0B0B0B', poster_bg_image_url: publicUrl })
      .eq('id', businessId)

    if (bizErr) return { error: 'Error al guardar fondo' }
  } else {
    // Color mode — validate hex
    if (!/^#[0-9A-Fa-f]{6}$/.test(bgColor)) return { error: 'Color inválido' }

    const { error: bizErr } = await serviceClient
      .from('businesses')
      .update({ poster_bg_color: bgColor, poster_bg_image_url: null })
      .eq('id', businessId)

    if (bizErr) return { error: 'Error al guardar color' }
  }

  return {}
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/poster/poster-editor.tsx`**

```tsx
'use client'

import { useState, useTransition, useRef } from 'react'
import { savePosterSettingsAction } from './actions'

interface Card {
  id: string
  slug: string
  stamps_required: number
  poster_reward_text: string | null
}

interface Business {
  poster_bg_color: string
  poster_bg_image_url: string | null
}

interface PosterEditorProps {
  cards: Card[]
  business: Business
  defaultCardId: string
}

export function PosterEditor({ cards, business, defaultCardId }: PosterEditorProps) {
  const [cardId, setCardId] = useState(defaultCardId)
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical')
  const [bgType, setBgType] = useState<'color' | 'photo'>(
    business.poster_bg_image_url ? 'photo' : 'color'
  )
  const [bgColor, setBgColor] = useState(business.poster_bg_color)
  const [rewardText, setRewardText] = useState(
    cards.find((c) => c.id === defaultCardId)?.poster_reward_text ?? ''
  )
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [downloadError, setDownloadError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isDownloading, setIsDownloading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleCardChange(id: string) {
    setCardId(id)
    const card = cards.find((c) => c.id === id)
    setRewardText(card?.poster_reward_text ?? '')
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false)
    setSaveError('')
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('cardId', cardId)
    formData.set('bgType', bgType)
    formData.set('bgColor', bgColor)
    formData.set('rewardText', rewardText)

    startTransition(async () => {
      const res = await savePosterSettingsAction(formData)
      if (res.error) {
        setSaveError(res.error)
      } else {
        setSaved(true)
      }
    })
  }

  async function handleDownload(format: 'png' | 'pdf') {
    setDownloadError('')
    setIsDownloading(true)
    try {
      const url = `/api/poster/${cardId}?format=${format}&orientation=${orientation}`
      const res = await fetch(url)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setDownloadError(json.error ?? 'Error al descargar')
        return
      }
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `cartel.${format}`
      a.click()
      URL.revokeObjectURL(objectUrl)
    } catch {
      setDownloadError('Error al descargar')
    } finally {
      setIsDownloading(false)
    }
  }

  const inputClass =
    'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00C896]'
  const btnClass =
    'bg-[#00C896] text-slate-900 font-bold text-sm rounded-lg px-4 py-2.5 hover:bg-[#00b386] disabled:opacity-40 transition-colors'

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 max-w-lg">
      {/* Card selector */}
      {cards.length > 1 && (
        <div>
          <label className="text-xs text-slate-400 mb-2 block">Tarjeta</label>
          <select
            value={cardId}
            onChange={(e) => handleCardChange(e.target.value)}
            className={inputClass}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.slug} ({c.stamps_required} sellos)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Orientation */}
      <div>
        <label className="text-xs text-slate-400 mb-2 block">Orientación</label>
        <div className="flex gap-2">
          {(['vertical', 'horizontal'] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrientation(o)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                orientation === o
                  ? 'bg-[#00C896] text-slate-900 border-[#00C896]'
                  : 'text-slate-400 border-slate-700 hover:border-slate-500'
              }`}
            >
              {o === 'vertical' ? 'Vertical' : 'Horizontal'}
            </button>
          ))}
        </div>
      </div>

      {/* Reward text */}
      <div>
        <label className="text-xs text-slate-400 mb-2 block">Texto de recompensa</label>
        <textarea
          value={rewardText}
          onChange={(e) => setRewardText(e.target.value)}
          rows={2}
          placeholder="Ej: Café gratis al completar tus 10 sellos"
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Background */}
      <div>
        <label className="text-xs text-slate-400 mb-2 block">Fondo</label>
        <div className="flex gap-2 mb-3">
          {(['color', 'photo'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setBgType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                bgType === t
                  ? 'bg-[#00C896] text-slate-900 border-[#00C896]'
                  : 'text-slate-400 border-slate-700 hover:border-slate-500'
              }`}
            >
              {t === 'color' ? 'Color' : 'Foto'}
            </button>
          ))}
        </div>

        {bgType === 'color' ? (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-slate-700 bg-transparent"
            />
            <input
              type="text"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              placeholder="#0B0B0B"
              className={`${inputClass} w-36`}
            />
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              name="bgImage"
              accept="image/png,image/jpeg,image/webp"
              className="text-sm text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
            />
            {business.poster_bg_image_url && (
              <p className="text-xs text-slate-500 mt-1">Ya tienes una foto guardada. Sube una nueva para reemplazarla.</p>
            )}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex flex-col gap-2">
        <button type="submit" disabled={isPending} className={`${btnClass} self-start`}>
          {isPending ? 'Guardando...' : 'Guardar ajustes'}
        </button>
        {saved && <p className="text-[#00C896] text-sm">✓ Ajustes guardados</p>}
        {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
      </div>

      {/* Download */}
      <div>
        <p className="text-xs text-slate-400 mb-3">
          Guarda los ajustes antes de descargar. El cartel usa los datos guardados.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => handleDownload('png')}
            className="border border-[#00C896] text-[#00C896] font-bold text-sm rounded-lg px-4 py-2.5 hover:bg-[#00C896] hover:text-slate-900 disabled:opacity-40 transition-colors"
          >
            {isDownloading ? 'Descargando...' : 'Descargar PNG'}
          </button>
          <button
            type="button"
            disabled={isDownloading}
            onClick={() => handleDownload('pdf')}
            className="border border-slate-600 text-slate-300 font-bold text-sm rounded-lg px-4 py-2.5 hover:border-slate-400 disabled:opacity-40 transition-colors"
          >
            Descargar PDF
          </button>
        </div>
        {downloadError && <p className="text-red-400 text-sm mt-2">{downloadError}</p>}
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/poster/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PosterEditor } from './poster-editor'

export default async function PosterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, poster_bg_color, poster_bg_image_url')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  const serviceClient = createServiceClient()
  const { data: cards } = await serviceClient
    .from('loyalty_cards')
    .select('id, slug, stamps_required, poster_reward_text')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (!cards || cards.length === 0) {
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-2xl font-black text-white mb-1">Plantilla / Cartel</h1>
        <p className="text-slate-500 text-sm">
          Primero crea una tarjeta de sellos para poder generar tu cartel.
        </p>
      </div>
    )
  }

  const businessTyped = business as {
    id: string
    poster_bg_color: string
    poster_bg_image_url: string | null
  }

  const cardsTyped = cards as {
    id: string
    slug: string
    stamps_required: number
    poster_reward_text: string | null
  }[]

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-black text-white mb-1">Plantilla / Cartel</h1>
      <p className="text-slate-500 text-sm mb-8">
        Personaliza y descarga el cartel para imprimir en tu negocio.
      </p>

      <PosterEditor
        cards={cardsTyped}
        business={businessTyped}
        defaultCardId={cardsTyped[0].id}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Test in browser**

Open `http://localhost:3000/poster` (dev server must be running).

Verify:
- Page loads with the editor form
- Orientation toggle switches between Vertical / Horizontal
- Reward text field is editable
- Background toggle switches between Color and Foto
- Color picker changes the hex value
- "Guardar ajustes" button shows "✓ Ajustes guardados" on success
- "Descargar PNG" triggers a file download
- Downloaded PNG opens and shows the correct poster layout

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/poster/
git commit -m "feat: add poster dashboard editor with save + download"
```

---

## Task 5: /ayuda/wallet Public Page

**Files:**
- Create: `src/app/ayuda/wallet/page.tsx`

- [ ] **Step 1: Create `src/app/ayuda/wallet/page.tsx`**

This is a public page — no auth check, no redirect. Uses the same dark color scheme as the rest of the app.

```tsx
import Link from 'next/link'

export const metadata = {
  title: 'Cómo agregar tu tarjeta al Wallet — FideliTap',
  description: 'Tutorial paso a paso para agregar tu tarjeta de sellos a Apple Wallet y Google Wallet.',
}

export default function WalletTutorialPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-16 px-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <Link href="/" className="text-xl font-black tracking-tight block mb-12">
          fideli<span className="text-[#00C896]">tap</span>
        </Link>

        <h1 className="text-3xl font-black mb-2">
          ¿Cómo agregar tu tarjeta al Wallet?
        </h1>
        <p className="text-slate-500 text-sm mb-12">
          Guarda tu tarjeta de sellos en tu teléfono para tenerla siempre a mano.
        </p>

        {/* Apple Wallet */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">🍎</span> Apple Wallet (iPhone)
          </h2>
          <ol className="flex flex-col gap-4">
            {[
              'Abre el email de bienvenida de FideliTap en tu iPhone.',
              'Toca el botón verde "Agregar a Apple Wallet".',
              'En la hoja que aparece, toca "Agregar" para confirmar.',
              'Tu tarjeta de sellos aparece en la app Wallet. Ábrela para mostrarla en el negocio.',
            ].map((step, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="w-7 h-7 rounded-full bg-slate-800 text-[#00C896] flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </span>
                <p className="text-slate-300 text-sm pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Google Wallet */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-xl">🤖</span> Google Wallet (Android)
          </h2>
          <ol className="flex flex-col gap-4">
            {[
              'Abre el email de bienvenida de FideliTap en tu Android.',
              'Toca el botón "Agregar a Google Wallet".',
              'Si te lo pide, inicia sesión con tu cuenta de Google.',
              'Toca "Guardar en Google Wallet" para confirmar.',
              'Tu tarjeta queda guardada. Ábrela desde la app Google Wallet para mostrarla.',
            ].map((step, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="w-7 h-7 rounded-full bg-slate-800 text-[#00C896] flex items-center justify-center text-sm font-bold shrink-0">
                  {i + 1}
                </span>
                <p className="text-slate-300 text-sm pt-1">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <div className="border border-slate-800 rounded-xl p-6 text-center">
          <p className="text-slate-400 text-sm mb-4">
            ¿Todavía no tienes tu tarjeta? Pídele al negocio el cartel con el QR o visita su página de FideliTap.
          </p>
          <p className="text-xs text-slate-600">© 2026 FideliTap · fidelitap.co</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Test in browser**

Open `http://localhost:3000/ayuda/wallet` (no login required).

Verify:
- Page loads without auth
- Apple Wallet section shows 4 steps
- Google Wallet section shows 5 steps
- Logo links to home
- Dark background, green accent

- [ ] **Step 4: Commit**

```bash
git add src/app/ayuda/
git commit -m "feat: add /ayuda/wallet public tutorial page"
```

---

## Final Verification

- [ ] Run `npx tsc --noEmit` — expect zero errors
- [ ] Open `/poster` logged in as a business — save settings, download PNG and PDF, verify both files open correctly
- [ ] Open `/ayuda/wallet` without logging in — verify page loads
- [ ] Verify the poster URL on the cartel (`fidelitap.co/ayuda/wallet`) matches the actual page route
