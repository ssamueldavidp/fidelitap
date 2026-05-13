# Cards Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete `/cards` section: grid view with stats drawer, dedicated editor with live Wallet preview, and full CRUD via Server Actions.

**Architecture:** Server Components fetch data and pass it down; Client Components manage UI state (drawer, form, live preview). Server Actions handle all mutations. Image uploads go to Supabase Storage via Server Actions receiving FormData.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase SSR, Zod v4, `qrcode` npm package (already installed)

---

## File Map

**Create:**
- `supabase/migrations/20260513000000_cards_slug_softdelete.sql`
- `src/lib/slug.ts`
- `src/app/(dashboard)/cards/page.tsx`
- `src/app/(dashboard)/cards/actions.ts`
- `src/app/(dashboard)/cards/nueva/page.tsx`
- `src/app/(dashboard)/cards/[id]/editar/page.tsx`
- `src/components/cards/wallet-preview.tsx`
- `src/components/cards/card-widget.tsx`
- `src/components/cards/card-drawer.tsx`
- `src/components/cards/card-editor.tsx`
- `src/components/cards/cards-grid.tsx`

**Modify:**
- `src/types/database.ts` — add `slug` and `deleted_at` to `loyalty_cards` types
- `src/components/dashboard/plan-usage.tsx` — filter card count by `deleted_at IS NULL`

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260513000000_cards_slug_softdelete.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add slug and soft-delete to loyalty_cards
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.loyalty_cards
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Backfill slugs for any existing rows
UPDATE public.loyalty_cards
SET slug = regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', '-', 'g')
           || '-' || substr(gen_random_uuid()::text, 1, 4)
WHERE slug IS NULL;

ALTER TABLE public.loyalty_cards ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_cards_slug
  ON public.loyalty_cards(slug);

CREATE INDEX IF NOT EXISTS idx_loyalty_cards_not_deleted
  ON public.loyalty_cards(business_id)
  WHERE deleted_at IS NULL;

-- RLS: owner can delete own cards (needed for hard delete path)
CREATE POLICY "loyalty_cards: owner can delete"
  ON public.loyalty_cards FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Supabase Storage bucket for card background images
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-backgrounds', 'card-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "card-backgrounds: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'card-backgrounds');

CREATE POLICY "card-backgrounds: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'card-backgrounds' AND auth.uid() IS NOT NULL);

CREATE POLICY "card-backgrounds: owner delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'card-backgrounds' AND owner = auth.uid());
```

- [ ] **Step 2: Apply migration**

```bash
cd /path/to/fidelitap && npx supabase db push
```

Expected: no errors

- [ ] **Step 3: Verify**

```bash
npx supabase db shell --command "SELECT column_name FROM information_schema.columns WHERE table_name='loyalty_cards' AND column_name IN ('slug','deleted_at');"
```

Expected: 2 rows returned

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260513000000_cards_slug_softdelete.sql
git commit -m "feat: add slug and deleted_at to loyalty_cards, storage bucket"
```

---

### Task 2: Update TypeScript Types + Fix PlanUsage

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/components/dashboard/plan-usage.tsx`

- [ ] **Step 1: Update `loyalty_cards` types in `src/types/database.ts`**

Replace the `loyalty_cards` section (lines 48–83) with:

```typescript
loyalty_cards: {
  Row: {
    id: string
    business_id: string
    name: string
    stamps_required: number
    benefit_description: string
    design_config: Json
    is_active: boolean
    slug: string
    deleted_at: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    business_id: string
    name: string
    stamps_required: number
    benefit_description: string
    design_config?: Json
    is_active?: boolean
    slug?: string
    deleted_at?: string | null
    created_at?: string
    updated_at?: string
  }
  Update: {
    id?: string
    business_id?: string
    name?: string
    stamps_required?: number
    benefit_description?: string
    design_config?: Json
    is_active?: boolean
    slug?: string
    deleted_at?: string | null
    created_at?: string
    updated_at?: string
  }
  Relationships: []
}
```

Also update the `LoyaltyCard` helper at the bottom — it's a re-export so no change needed there (it picks up Row automatically).

- [ ] **Step 2: Fix card count query in `src/components/dashboard/plan-usage.tsx`**

Find the card count query (around line 33) and replace:

```typescript
// BEFORE
const { count: cardCount } = await supabase
  .from('loyalty_cards')
  .select('id', { count: 'exact', head: true })
  .eq('business_id', businessId)
  .eq('is_active', true)

// AFTER
const { count: cardCount } = await supabase
  .from('loyalty_cards')
  .select('id', { count: 'exact', head: true })
  .eq('business_id', businessId)
  .is('deleted_at', null)
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts src/components/dashboard/plan-usage.tsx
git commit -m "feat: add slug/deleted_at types, fix plan usage card count"
```

---

### Task 3: Slug Utility

**Files:**
- Create: `src/lib/slug.ts`

- [ ] **Step 1: Write `src/lib/slug.ts`**

```typescript
export function generateSlug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 55)

  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 4)
  return `${base}-${suffix}`
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/slug.ts
git commit -m "feat: slug generation utility"
```

---

### Task 4: Card Server Actions

**Files:**
- Create: `src/app/(dashboard)/cards/actions.ts`

- [ ] **Step 1: Write `src/app/(dashboard)/cards/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPlanLimits, isAtLimit } from '@/lib/plan-limits'
import { generateSlug } from '@/lib/slug'
import { z } from 'zod'

const cardFormSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(50, 'Máximo 50 caracteres').trim(),
  benefit_description: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres').trim(),
  stamps_required: z.coerce.number().int().min(2, 'Mínimo 2 sellos').max(20, 'Máximo 20 sellos'),
  stamp_icon: z.string().min(1, 'Selecciona un ícono'),
  bg_type: z.enum(['solid', 'image']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido'),
})

async function uploadImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  file: File
): Promise<string | { error: string }> {
  if (file.size > 2 * 1024 * 1024) return { error: 'La imagen no puede superar 2MB' }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()
  const { error } = await supabase.storage
    .from('card-backgrounds')
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (error) return { error: 'Error subiendo imagen. Intenta de nuevo.' }
  const { data: { publicUrl } } = supabase.storage
    .from('card-backgrounds')
    .getPublicUrl(path)
  return publicUrl
}

export async function createCardAction(
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  const { count: cardCount } = await supabase
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .is('deleted_at', null)

  const limits = getPlanLimits(business.plan)
  if (isAtLimit(cardCount ?? 0, limits.maxCards)) {
    return { error: 'Límite de tarjetas alcanzado. Actualiza tu plan para agregar más.' }
  }

  const parsed = cardFormSchema.safeParse({
    name: formData.get('name'),
    benefit_description: formData.get('benefit_description'),
    stamps_required: formData.get('stamps_required'),
    stamp_icon: formData.get('stamp_icon'),
    bg_type: formData.get('bg_type'),
    color: formData.get('color'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, benefit_description, stamps_required, stamp_icon, bg_type, color } = parsed.data

  let bgImageUrl: string | null = null
  if (bg_type === 'image') {
    const file = formData.get('bg_image') as File | null
    if (file && file.size > 0) {
      const result = await uploadImage(supabase, business.id, file)
      if (typeof result !== 'string') return result
      bgImageUrl = result
    }
  }

  const design_config = {
    color,
    bg_type: bgImageUrl ? 'image' : 'solid',
    bg_value: color,
    bg_image_url: bgImageUrl,
    stamp_icon,
    font: 'default',
  }

  const { error } = await supabase.from('loyalty_cards').insert({
    business_id: business.id,
    name,
    benefit_description,
    stamps_required,
    design_config,
    slug: generateSlug(name),
    is_active: true,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Nombre duplicado. Elige otro nombre.' }
    return { error: 'Error creando tarjeta. Intenta de nuevo.' }
  }

  revalidatePath('/cards')
  redirect('/cards')
}

export async function updateCardAction(
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const cardId = formData.get('id') as string
  if (!cardId) return { error: 'ID inválido' }

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('id, business_id, design_config')
    .eq('id', cardId)
    .single()
  if (!card) return { error: 'Tarjeta no encontrada' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .eq('id', card.business_id)
    .single()
  if (!business) return { error: 'No autorizado' }

  const parsed = cardFormSchema.safeParse({
    name: formData.get('name'),
    benefit_description: formData.get('benefit_description'),
    stamps_required: formData.get('stamps_required'),
    stamp_icon: formData.get('stamp_icon'),
    bg_type: formData.get('bg_type'),
    color: formData.get('color'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { name, benefit_description, stamps_required, stamp_icon, bg_type, color } = parsed.data
  const existingConfig = card.design_config as Record<string, unknown>

  let bgImageUrl = bg_type === 'image'
    ? (existingConfig.bg_image_url as string | null) ?? null
    : null

  if (bg_type === 'image') {
    const file = formData.get('bg_image') as File | null
    if (file && file.size > 0) {
      const result = await uploadImage(supabase, business.id, file)
      if (typeof result !== 'string') return result
      bgImageUrl = result
    }
  }

  const design_config = {
    color,
    bg_type: bgImageUrl ? 'image' : 'solid',
    bg_value: color,
    bg_image_url: bgImageUrl,
    stamp_icon,
    font: 'default',
  }

  const { error } = await supabase
    .from('loyalty_cards')
    .update({ name, benefit_description, stamps_required, design_config })
    .eq('id', cardId)

  if (error) return { error: 'Error actualizando tarjeta.' }
  revalidatePath('/cards')
  redirect('/cards')
}

export async function toggleCardAction(
  cardId: string,
  isActive: boolean
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('id, business_id')
    .eq('id', cardId)
    .single()
  if (!card) return { error: 'Tarjeta no encontrada' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .eq('id', card.business_id)
    .single()
  if (!business) return { error: 'No autorizado' }

  const { error } = await supabase
    .from('loyalty_cards')
    .update({ is_active: isActive })
    .eq('id', cardId)

  if (error) return { error: 'Error actualizando estado.' }
  revalidatePath('/cards')
  return null
}

export async function deleteCardAction(
  cardId: string
): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('id, business_id')
    .eq('id', cardId)
    .single()
  if (!card) return { error: 'Tarjeta no encontrada' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .eq('id', card.business_id)
    .single()
  if (!business) return { error: 'No autorizado' }

  const { count: customerCount } = await supabase
    .from('customer_cards')
    .select('id', { count: 'exact', head: true })
    .eq('loyalty_card_id', cardId)

  let dbError
  if ((customerCount ?? 0) > 0) {
    const result = await supabase
      .from('loyalty_cards')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', cardId)
    dbError = result.error
  } else {
    const result = await supabase
      .from('loyalty_cards')
      .delete()
      .eq('id', cardId)
    dbError = result.error
  }

  if (dbError) return { error: 'Error eliminando tarjeta.' }
  revalidatePath('/cards')
  return null
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/cards/actions.ts
git commit -m "feat: card server actions (create, update, toggle, delete)"
```

---

### Task 5: WalletPreview Component

**Files:**
- Create: `src/components/cards/wallet-preview.tsx`

- [ ] **Step 1: Write `src/components/cards/wallet-preview.tsx`**

```typescript
interface WalletPreviewProps {
  businessName: string
  name: string
  benefitDescription: string
  stampsRequired: number
  stampIcon: string
  color: string
  bgType: 'solid' | 'image'
  bgImageUrl?: string | null
  filledStamps?: number
  size?: 'sm' | 'md'
}

const CARD_COLORS: Record<string, { border: string; glow: string }> = {
  '#00C896': { border: 'border-[#00C896]', glow: 'shadow-[#00C896]/20' },
  '#6366f1': { border: 'border-[#6366f1]', glow: 'shadow-[#6366f1]/20' },
  '#f59e0b': { border: 'border-[#f59e0b]', glow: 'shadow-[#f59e0b]/20' },
  '#ef4444': { border: 'border-[#ef4444]', glow: 'shadow-[#ef4444]/20' },
  '#ec4899': { border: 'border-[#ec4899]', glow: 'shadow-[#ec4899]/20' },
  '#0ea5e9': { border: 'border-[#0ea5e9]', glow: 'shadow-[#0ea5e9]/20' },
}

export function WalletPreview({
  businessName,
  name,
  benefitDescription,
  stampsRequired,
  stampIcon,
  color,
  bgType,
  bgImageUrl,
  filledStamps = 3,
  size = 'md',
}: WalletPreviewProps) {
  const colorClasses = CARD_COLORS[color] ?? CARD_COLORS['#00C896']
  const isSm = size === 'sm'

  const cardStyle: React.CSSProperties = bgType === 'image' && bgImageUrl
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0.5)), url(${bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {}

  return (
    <div
      className={`rounded-xl border ${colorClasses.border} shadow-lg ${colorClasses.glow} ${isSm ? 'p-3' : 'p-5'} ${bgType !== 'image' ? 'bg-slate-900' : ''}`}
      style={cardStyle}
    >
      <p className={`text-slate-400 ${isSm ? 'text-[9px]' : 'text-xs'} mb-0.5`}>{businessName}</p>
      <p className={`font-black text-white ${isSm ? 'text-sm' : 'text-lg'} mb-3`}>
        {stampIcon} {name || 'Nombre de la tarjeta'}
      </p>
      <div className={`flex flex-wrap ${isSm ? 'gap-1 mb-2' : 'gap-1.5 mb-4'}`}>
        {Array.from({ length: stampsRequired }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full ${isSm ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`}
            style={{ background: i < filledStamps ? color : '#1e293b', border: i < filledStamps ? 'none' : '1px solid #334155' }}
          />
        ))}
      </div>
      <p className={`text-slate-400 ${isSm ? 'text-[9px]' : 'text-xs'}`}>
        Premio: {benefitDescription || 'Premio al completar'}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/wallet-preview.tsx
git commit -m "feat: WalletPreview component"
```

---

### Task 6: CardEditor Form + Editor Pages

**Files:**
- Create: `src/components/cards/card-editor.tsx`
- Create: `src/app/(dashboard)/cards/nueva/page.tsx`
- Create: `src/app/(dashboard)/cards/[id]/editar/page.tsx`

- [ ] **Step 1: Write `src/components/cards/card-editor.tsx`**

```typescript
'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { createCardAction, updateCardAction } from '@/app/(dashboard)/cards/actions'
import type { LoyaltyCard } from '@/types/database'
import type { CardDesignConfig } from '@/types/database'

const CARD_COLORS = ['#00C896', '#6366f1', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9']
const CARD_EMOJIS = ['☕', '🍕', '🌮', '🍔', '🎂', '✂️', '🛍️', '💈', '🍦', '🥐', '🍣', '🎯', '💪', '📚', '🌸', '🎵', '🍷', '🧁', '🏋️', '🎨', '🐾', '🧘', '🚀', '⭐']

interface CardEditorProps {
  card?: LoyaltyCard
  businessName: string
}

export function CardEditor({ card, businessName }: CardEditorProps) {
  const isEdit = !!card
  const existingDesign = card?.design_config as CardDesignConfig | undefined

  const [name, setName] = useState(card?.name ?? '')
  const [benefitDescription, setBenefitDescription] = useState(card?.benefit_description ?? '')
  const [stampsRequired, setStampsRequired] = useState(card?.stamps_required ?? 8)
  const [stampIcon, setStampIcon] = useState(existingDesign?.stamp_icon ?? '☕')
  const [color, setColor] = useState(existingDesign?.color ?? '#00C896')
  const [bgType, setBgType] = useState<'solid' | 'image'>(
    existingDesign?.bg_type === 'image' ? 'image' : 'solid'
  )
  const [bgImageFile, setBgImageFile] = useState<File | null>(null)
  const [bgImagePreview, setBgImagePreview] = useState<string | null>(
    existingDesign?.bg_image_url ?? null
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBgImageFile(file)
    setBgImagePreview(URL.createObjectURL(file))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    if (isEdit) fd.append('id', card.id)
    fd.append('name', name)
    fd.append('benefit_description', benefitDescription)
    fd.append('stamps_required', String(stampsRequired))
    fd.append('stamp_icon', stampIcon)
    fd.append('bg_type', bgType)
    fd.append('color', color)
    if (bgImageFile) fd.append('bg_image', bgImageFile)

    startTransition(async () => {
      const result = isEdit
        ? await updateCardAction(fd)
        : await createCardAction(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="px-8 py-6 border-b border-slate-800 flex items-center gap-4">
        <Link href="/cards" className="text-slate-400 hover:text-white text-sm transition-colors">
          ← Mis tarjetas
        </Link>
        <span className="text-slate-700">·</span>
        <h1 className="text-lg font-black">{isEdit ? 'Editar tarjeta' : 'Nueva tarjeta'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-10 p-8 max-w-4xl">
        {/* Form column */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Información */}
          <section>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Información</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Nombre de la tarjeta</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej: Café mensual"
                  maxLength={50}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00C896]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Premio al completar</label>
                <input
                  value={benefitDescription}
                  onChange={e => setBenefitDescription(e.target.value)}
                  placeholder="Ej: 1 café gratis"
                  maxLength={100}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00C896]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  Sellos requeridos: <span className="text-white font-bold">{stampsRequired}</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={stampsRequired}
                  onChange={e => setStampsRequired(Number(e.target.value))}
                  className="w-full accent-[#00C896]"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>2</span><span>20</span>
                </div>
              </div>
            </div>
          </section>

          {/* Diseño */}
          <section>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Diseño</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Ícono</label>
                <div className="flex flex-wrap gap-2">
                  {CARD_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setStampIcon(emoji)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-colors ${
                        stampIcon === emoji
                          ? 'border-[#00C896] bg-slate-800'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-2">Fondo</label>
                <div className="flex gap-2 mb-3">
                  {(['solid', 'image'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setBgType(type)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        bgType === type
                          ? 'border-[#00C896] text-[#00C896] bg-slate-900'
                          : 'border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {type === 'solid' ? 'Color' : 'Foto'}
                    </button>
                  ))}
                </div>

                {bgType === 'solid' && (
                  <div className="flex gap-3">
                    {CARD_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className="w-8 h-8 rounded-full transition-transform hover:scale-110"
                        style={{
                          background: c,
                          outline: color === c ? `3px solid white` : 'none',
                          outlineOffset: '2px',
                        }}
                      />
                    ))}
                  </div>
                )}

                {bgType === 'image' && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    {bgImagePreview ? (
                      <div className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-700 group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={bgImagePreview} alt="preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity"
                        >
                          Cambiar foto
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-24 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-slate-500 hover:text-slate-400 transition-colors"
                      >
                        <span className="text-2xl">📷</span>
                        <span className="text-xs">Subir foto (max 2MB)</span>
                      </button>
                    )}
                    <p className="text-xs text-slate-600 mt-1">JPG, PNG o WebP</p>
                  </div>
                )}
              </div>
            </div>
          </section>

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
            {isPending ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear tarjeta'}
          </button>
        </div>

        {/* Preview column */}
        <div className="w-64 shrink-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Preview Wallet</p>
          <WalletPreview
            businessName={businessName}
            name={name}
            benefitDescription={benefitDescription}
            stampsRequired={stampsRequired}
            stampIcon={stampIcon}
            color={color}
            bgType={bgType}
            bgImageUrl={bgImagePreview}
            filledStamps={3}
          />
          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            Así verán la tarjeta tus clientes en Apple Wallet y Google Wallet.
          </p>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/app/(dashboard)/cards/nueva/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CardEditor } from '@/components/cards/card-editor'
import { getPlanLimits, isAtLimit } from '@/lib/plan-limits'

export default async function NuevaCardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const { count: cardCount } = await supabase
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .is('deleted_at', null)

  const limits = getPlanLimits(business.plan)
  if (isAtLimit(cardCount ?? 0, limits.maxCards)) redirect('/cards')

  return <CardEditor businessName={business.name} />
}
```

- [ ] **Step 3: Write `src/app/(dashboard)/cards/[id]/editar/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { CardEditor } from '@/components/cards/card-editor'

export default async function EditarCardPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  const { data: card } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('id', params.id)
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .single()

  if (!card) notFound()

  return <CardEditor card={card} businessName={business.name} />
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/cards/card-editor.tsx src/app/\(dashboard\)/cards/nueva/page.tsx src/app/\(dashboard\)/cards/\[id\]/editar/page.tsx
git commit -m "feat: CardEditor form component with live WalletPreview, editor pages"
```

---

### Task 7: CardDrawer Component

**Files:**
- Create: `src/components/cards/card-drawer.tsx`

- [ ] **Step 1: Write `src/components/cards/card-drawer.tsx`**

```typescript
'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { WalletPreview } from '@/components/cards/wallet-preview'
import { toggleCardAction, deleteCardAction } from '@/app/(dashboard)/cards/actions'
import type { LoyaltyCard } from '@/types/database'
import type { CardDesignConfig } from '@/types/database'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fidelitap.app'

interface CardDrawerProps {
  card: LoyaltyCard
  businessName: string
  customerCount: number
  redemptionCount: number
  onClose: () => void
}

export function CardDrawer({
  card,
  businessName,
  customerCount,
  redemptionCount,
  onClose,
}: CardDrawerProps) {
  const design = card.design_config as CardDesignConfig
  const shareUrl = `${APP_URL}/c/${card.slug}`

  const [isActive, setIsActive] = useState(card.is_active)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(shareUrl, { width: 120, margin: 1 }).then(setQrDataUrl)
  }, [shareUrl])

  function handleToggle() {
    const newValue = !isActive
    setIsActive(newValue)
    startTransition(async () => {
      const result = await toggleCardAction(card.id, newValue)
      if (result?.error) {
        setIsActive(!newValue)
        setActionError(result.error)
      }
    })
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCardAction(card.id)
      if (result?.error) {
        setActionError(result.error)
        setShowDeleteConfirm(false)
      } else {
        onClose()
      }
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-black text-white text-sm truncate">{card.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 flex flex-col gap-4 p-5">
          {/* Mini wallet preview */}
          <WalletPreview
            businessName={businessName}
            name={card.name}
            benefitDescription={card.benefit_description}
            stampsRequired={card.stamps_required}
            stampIcon={design.stamp_icon}
            color={design.color}
            bgType={design.bg_type === 'image' ? 'image' : 'solid'}
            bgImageUrl={design.bg_image_url}
            filledStamps={3}
            size="sm"
          />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-2xl font-black text-white">{customerCount}</p>
              <p className="text-xs text-slate-400">Clientes</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3">
              <p className="text-2xl font-black text-white">{redemptionCount}</p>
              <p className="text-xs text-slate-400">Canjes</p>
            </div>
          </div>

          {actionError && (
            <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              {actionError}
            </p>
          )}

          {/* Edit button */}
          <Link
            href={`/cards/${card.id}/editar`}
            className="flex items-center justify-center gap-2 bg-[#00C896] text-slate-900 font-bold text-sm rounded-xl py-2.5 hover:bg-[#00b386] transition-colors"
          >
            ✏️ Editar tarjeta
          </Link>

          {/* Toggle active */}
          <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
            <span className="text-sm text-slate-300">Tarjeta activa</span>
            <button
              onClick={handleToggle}
              disabled={isPending}
              className={`relative w-10 h-6 rounded-full transition-colors disabled:opacity-50 ${isActive ? 'bg-[#00C896]' : 'bg-slate-600'}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </button>
          </div>

          {/* QR + Share link */}
          <div className="bg-slate-800 rounded-xl p-4 flex flex-col items-center gap-3">
            <p className="text-xs text-slate-400 self-start">Enlace para clientes</p>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR" className="w-24 h-24 rounded-lg" />
            )}
            <p className="text-xs text-[#00C896] break-all text-center">{shareUrl}</p>
            <button
              onClick={handleCopyLink}
              className="w-full text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg py-1.5 transition-colors"
            >
              {copied ? '✓ Copiado' : 'Copiar enlace'}
            </button>
          </div>

          {/* Delete */}
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors py-2 border-t border-slate-800"
            >
              🗑 Eliminar tarjeta
            </button>
          ) : (
            <div className="border border-red-900 bg-red-950/30 rounded-xl p-4">
              <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                {customerCount > 0
                  ? `Esta tarjeta tiene ${customerCount} clientes con sellos. Sus datos se conservarán. ¿Confirmar?`
                  : '¿Eliminar esta tarjeta? Esta acción no se puede deshacer.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 text-xs border border-slate-700 rounded-lg py-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg py-1.5 font-semibold disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cards/card-drawer.tsx
git commit -m "feat: CardDrawer with stats, toggle, QR, delete"
```

---

### Task 8: CardsGrid + /cards Page

**Files:**
- Create: `src/components/cards/card-widget.tsx`
- Create: `src/components/cards/cards-grid.tsx`
- Create: `src/app/(dashboard)/cards/page.tsx`

- [ ] **Step 1: Write `src/components/cards/card-widget.tsx`**

```typescript
import type { LoyaltyCard } from '@/types/database'
import type { CardDesignConfig } from '@/types/database'

interface CardWidgetProps {
  card: LoyaltyCard
  customerCount: number
  redemptionCount: number
  onClick: () => void
  dimmed?: boolean
}

export function CardWidget({ card, customerCount, redemptionCount, onClick, dimmed }: CardWidgetProps) {
  const design = card.design_config as CardDesignConfig

  const cardStyle: React.CSSProperties = design.bg_type === 'image' && design.bg_image_url
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.7), rgba(0,0,0,0.4)), url(${design.bg_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {}

  return (
    <div
      onClick={onClick}
      className={`relative rounded-2xl p-5 border cursor-pointer transition-all hover:-translate-y-1 ${dimmed ? 'opacity-40' : ''}`}
      style={{
        borderColor: design.color,
        backgroundColor: design.bg_type !== 'image' ? '#0f172a' : undefined,
        ...cardStyle,
      }}
    >
      {/* Active badge */}
      <div
        className="absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full border"
        style={{
          color: design.color,
          background: `${design.color}15`,
          borderColor: `${design.color}40`,
        }}
      >
        ● {card.is_active ? 'Activa' : 'Inactiva'}
      </div>

      <p className="text-3xl mb-2">{design.stamp_icon}</p>
      <p className="font-black text-white text-sm mb-0.5">{card.name}</p>
      <p className="text-xs text-slate-400 mb-3">{card.benefit_description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {Array.from({ length: card.stamps_required }).map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full"
            style={{
              background: i < 3 ? design.color : '#1e293b',
              border: i < 3 ? 'none' : '1px solid #334155',
            }}
          />
        ))}
      </div>

      <div className="flex gap-4">
        <div>
          <p className="text-sm font-bold text-slate-300">{customerCount}</p>
          <p className="text-[10px] text-slate-500">clientes</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-300">{card.stamps_required}</p>
          <p className="text-[10px] text-slate-500">sellos</p>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-300">{redemptionCount}</p>
          <p className="text-[10px] text-slate-500">canjes</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/cards/cards-grid.tsx`**

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CardWidget } from '@/components/cards/card-widget'
import { CardDrawer } from '@/components/cards/card-drawer'
import type { LoyaltyCard } from '@/types/database'

interface CardWithStats {
  card: LoyaltyCard
  customerCount: number
  redemptionCount: number
}

interface CardsGridProps {
  cards: CardWithStats[]
  businessName: string
  atCardLimit: boolean
}

type Tab = 'active' | 'inactive'

export function CardsGrid({ cards, businessName, atCardLimit }: CardsGridProps) {
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  const filtered = cards.filter(({ card }) =>
    activeTab === 'active' ? card.is_active : !card.is_active
  )
  const activeCount = cards.filter(({ card }) => card.is_active).length
  const inactiveCount = cards.filter(({ card }) => !card.is_active).length

  const selectedCardData = selectedCardId
    ? cards.find(({ card }) => card.id === selectedCardId)
    : null

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black">Mis tarjetas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestiona tus programas de fidelización</p>
        </div>
        {atCardLimit ? (
          <Link
            href="/settings#plan"
            className="bg-slate-800 border border-slate-700 text-slate-300 text-sm font-semibold rounded-xl px-4 py-2.5 hover:border-slate-500 transition-colors"
          >
            Límite alcanzado — Actualizar plan
          </Link>
        ) : (
          <Link
            href="/cards/nueva"
            className="bg-[#00C896] text-slate-900 text-sm font-bold rounded-xl px-4 py-2.5 hover:bg-[#00b386] transition-colors"
          >
            + Nueva tarjeta
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6">
        {([['active', `Activas (${activeCount})`], ['inactive', `Inactivas (${inactiveCount})`]] as const).map(
          ([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-[#00C896] text-[#00C896]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* Grid */}
      <div className={`grid grid-cols-3 gap-4 ${selectedCardId ? 'mr-80' : ''} transition-all`}>
        {filtered.map(({ card, customerCount, redemptionCount }) => (
          <CardWidget
            key={card.id}
            card={card}
            customerCount={customerCount}
            redemptionCount={redemptionCount}
            onClick={() => setSelectedCardId(card.id)}
            dimmed={!!selectedCardId && selectedCardId !== card.id}
          />
        ))}

        {!atCardLimit && (
          <Link
            href="/cards/nueva"
            className="rounded-2xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center gap-2 min-h-[200px] text-slate-600 hover:border-[#00C896] hover:text-[#00C896] transition-colors"
          >
            <span className="text-4xl font-light">+</span>
            <span className="text-sm font-semibold">Nueva tarjeta</span>
          </Link>
        )}

        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-16 text-slate-500">
            <p className="text-4xl mb-3">◉</p>
            <p className="font-semibold">
              {activeTab === 'active' ? 'No tienes tarjetas activas' : 'No tienes tarjetas inactivas'}
            </p>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedCardId && selectedCardData && (
        <CardDrawer
          card={selectedCardData.card}
          businessName={businessName}
          customerCount={selectedCardData.customerCount}
          redemptionCount={selectedCardData.redemptionCount}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Write `src/app/(dashboard)/cards/page.tsx`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CardsGrid } from '@/components/cards/cards-grid'
import { getPlanLimits, isAtLimit } from '@/lib/plan-limits'

export default async function CardsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) redirect('/onboarding')

  // Fetch all non-deleted cards
  const { data: cards } = await supabase
    .from('loyalty_cards')
    .select('*')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const cardList = cards ?? []

  // Fetch customer stats for all cards in one query
  const cardIds = cardList.map(c => c.id)
  const { data: customerCardRows } = cardIds.length > 0
    ? await supabase
        .from('customer_cards')
        .select('loyalty_card_id, customer_id, times_completed')
        .in('loyalty_card_id', cardIds)
    : { data: [] }

  const rows = customerCardRows ?? []

  // Aggregate per card
  const statsMap = new Map<string, { customerCount: number; redemptionCount: number }>()
  for (const cardId of cardIds) {
    const cardRows = rows.filter(r => r.loyalty_card_id === cardId)
    const customerCount = new Set(cardRows.map(r => r.customer_id)).size
    const redemptionCount = cardRows.reduce((sum, r) => sum + (r.times_completed ?? 0), 0)
    statsMap.set(cardId, { customerCount, redemptionCount })
  }

  const cardsWithStats = cardList.map(card => ({
    card,
    customerCount: statsMap.get(card.id)?.customerCount ?? 0,
    redemptionCount: statsMap.get(card.id)?.redemptionCount ?? 0,
  }))

  const limits = getPlanLimits(business.plan)
  const atLimit = isAtLimit(cardList.length, limits.maxCards)

  return (
    <div className="p-8">
      <CardsGrid
        cards={cardsWithStats}
        businessName={business.name}
        atCardLimit={atLimit}
      />
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Open http://localhost:3000/cards — verify:
- Cards grid renders with tabs Activas / Inactivas
- Clicking a card opens the drawer with stats, toggle, QR, delete button
- "Nueva tarjeta" button navigates to `/cards/nueva`
- Editor page shows form + live wallet preview on the right
- Saving redirects back to `/cards`

- [ ] **Step 6: Build check**

```bash
npm run build
```

Expected: build succeeds with no TypeScript or compilation errors

- [ ] **Step 7: Commit**

```bash
git add src/components/cards/card-widget.tsx src/components/cards/cards-grid.tsx src/app/\(dashboard\)/cards/page.tsx
git commit -m "feat: cards grid page with drawer, complete /cards section"
```

---

## Summary

8 tasks, ~11 files created, 2 modified. Each task is independently testable via `npx tsc --noEmit`. Full smoke-test in Task 8 Step 5.
