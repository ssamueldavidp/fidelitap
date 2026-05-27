# FideliTap v2 — C: User Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full `/settings` profile page with three tabs — Cuenta (display name, email, change password, avatar), Suscripción (already built in Plan A-MP), and Consumo (usage bars for clients and cards).

**Architecture:** The settings page (already extended in Plan A-MP) gets the Cuenta and Consumo tabs completed. Cuenta tab uses Server Actions for name update and password change. Avatar upload uses Supabase Storage. Consumo tab reads counts from the database. All components are small and focused.

**Tech Stack:** Next.js 14 Server Actions, Supabase Storage, Tailwind CSS, Supabase client

**Prerequisite:** Plan A1 migrations applied (needs `businesses.avatar_url`). Plan A-MP completed (settings page tab structure already exists).

---

## File Map

- Create: `src/app/(dashboard)/settings/account-tab.tsx`
- Create: `src/app/(dashboard)/settings/usage-tab.tsx`
- Modify: `src/app/(dashboard)/settings/actions.ts`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx` (pass avatar_url)

---

### Task 1: Update settings actions for profile and password

**Files:**
- Modify: `src/app/(dashboard)/settings/actions.ts`

Read the current file first. It likely only has scanner cooldown action. Add `updateProfileAction` and `changePasswordAction`.

- [ ] **Step 1: Read current actions.ts**

```bash
cat src/app/(dashboard)/settings/actions.ts
```

- [ ] **Step 2: Append new actions to the file**

Add the following to the existing `actions.ts` (after any existing code):

```typescript
// ---- Profile actions ----

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

export type ProfileUpdateResult = { error: string } | { success: true }

export async function updateProfileAction(formData: FormData): Promise<ProfileUpdateResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const name = (formData.get('name') as string | null)?.trim()
  if (!name || name.length < 2) return { error: 'El nombre debe tener al menos 2 caracteres' }
  if (name.length > 80) return { error: 'El nombre no puede superar 80 caracteres' }

  const { error } = await supabase
    .from('businesses')
    .update({ name })
    .eq('owner_id', user.id)

  if (error) return { error: 'Error al actualizar el perfil' }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

export type PasswordChangeResult = { error: string } | { success: true }

export async function changePasswordAction(formData: FormData): Promise<PasswordChangeResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const password    = formData.get('password') as string | null
  const confirmPass = formData.get('confirm_password') as string | null

  if (!password || password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }
  if (password !== confirmPass) return { error: 'Las contraseñas no coinciden' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  return { success: true }
}

export type AvatarUploadResult = { error: string } | { avatarUrl: string }

export async function uploadAvatarAction(formData: FormData): Promise<AvatarUploadResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const file = formData.get('avatar') as File | null
  if (!file) return { error: 'No se seleccionó archivo' }
  if (file.size > 2 * 1024 * 1024) return { error: 'El archivo no puede superar 2 MB' }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { error: 'Solo se aceptan imágenes JPG, PNG o WebP' }
  }

  const ext  = file.type.split('/')[1]
  const path = `avatars/${user.id}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadError) return { error: 'Error al subir la imagen' }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
  const avatarUrl = urlData.publicUrl

  await supabase
    .from('businesses')
    .update({ avatar_url: avatarUrl })
    .eq('owner_id', user.id)

  revalidatePath('/settings')
  return { avatarUrl }
}
```

**Important:** If `'use server'` is not already at the top of the file, it must be there. Make sure the file starts with `'use server'`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/actions.ts
git commit -m "feat(settings): add updateProfileAction, changePasswordAction, uploadAvatarAction"
```

---

### Task 2: Create Supabase Storage bucket for avatars

Supabase Storage needs an `avatars` bucket with public access. Add this as a migration.

**Files:**
- Create: `supabase/migrations/20260527000006_v2_avatars_bucket.sql`

- [ ] **Step 1: Create the migration**

```sql
-- supabase/migrations/20260527000006_v2_avatars_bucket.sql
-- Creates the avatars storage bucket for business profile photos.
-- Bucket is public (URLs are served without auth).

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "auth users upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND name = 'avatars/' || auth.uid() || '.' || split_part(name, '.', -1));

-- Allow authenticated users to update their own avatar (upsert)
CREATE POLICY "auth users update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND name LIKE 'avatars/' || auth.uid()::text || '%');

-- Public read for avatar URLs
CREATE POLICY "public read avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db reset
```

Or if you want to apply just this migration without resetting:

```bash
npx supabase migration up
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527000006_v2_avatars_bucket.sql
git commit -m "feat(db): create avatars storage bucket with RLS policies"
```

---

### Task 3: Create AccountTab component

**Files:**
- Create: `src/app/(dashboard)/settings/account-tab.tsx`

- [ ] **Step 1: Create the component**

```typescript
// src/app/(dashboard)/settings/account-tab.tsx
'use client'

import { useState, useTransition, useRef } from 'react'
import { updateProfileAction, changePasswordAction, uploadAvatarAction } from './actions'
import { Camera, CheckCircle2 } from 'lucide-react'

interface AccountTabProps {
  businessName: string
  email: string
  avatarUrl: string | null
}

export function AccountTab({ businessName, email, avatarUrl }: AccountTabProps) {
  const [nameSuccess,     setNameSuccess]     = useState(false)
  const [nameError,       setNameError]       = useState<string | null>(null)
  const [passSuccess,     setPassSuccess]     = useState(false)
  const [passError,       setPassError]       = useState<string | null>(null)
  const [avatarPreview,   setAvatarPreview]   = useState<string | null>(avatarUrl)
  const [avatarError,     setAvatarError]     = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isUpdatingName,  startNameTransition]   = useTransition()
  const [isChangingPass,  startPassTransition]   = useTransition()
  const [isUploadingAvatar, startAvatarTransition] = useTransition()

  const handleNameSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setNameError(null)
    setNameSuccess(false)
    const fd = new FormData(e.currentTarget)
    startNameTransition(async () => {
      const res = await updateProfileAction(fd)
      if ('error' in res) setNameError(res.error)
      else setNameSuccess(true)
    })
  }

  const handlePassSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPassError(null)
    setPassSuccess(false)
    const fd = new FormData(e.currentTarget)
    startPassTransition(async () => {
      const res = await changePasswordAction(fd)
      if ('error' in res) setPassError(res.error)
      else { setPassSuccess(true); (e.target as HTMLFormElement).reset() }
    })
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError(null)

    // Preview
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload
    const fd = new FormData()
    fd.append('avatar', file)
    startAvatarTransition(async () => {
      const res = await uploadAvatarAction(fd)
      if ('error' in res) {
        setAvatarError(res.error)
        setAvatarPreview(avatarUrl)
      } else {
        setAvatarPreview(res.avatarUrl)
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Avatar */}
      <section>
        <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
          Foto de perfil
        </h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden group border border-border"
            disabled={isUploadingAvatar}
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-primary">
                {businessName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={16} className="text-white" />
            </div>
          </button>
          <div>
            <p className="text-sm text-foreground font-medium">
              {isUploadingAvatar ? 'Subiendo...' : 'Haz clic para cambiar la foto'}
            </p>
            <p className="text-xs text-muted-foreground">JPG, PNG o WebP. Máx. 2 MB</p>
            {avatarError && <p className="text-xs text-red-400 mt-1">{avatarError}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </section>

      {/* Business name */}
      <section>
        <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
          Nombre del negocio
        </h2>
        <form onSubmit={handleNameSubmit} className="flex flex-col gap-3 max-w-sm">
          <input
            name="name"
            defaultValue={businessName}
            required
            minLength={2}
            maxLength={80}
            className="bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          {nameError   && <p className="text-xs text-red-400">{nameError}</p>}
          {nameSuccess && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Nombre actualizado
            </p>
          )}
          <button
            type="submit"
            disabled={isUpdatingName}
            className="self-start bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isUpdatingName ? 'Guardando...' : 'Guardar'}
          </button>
        </form>
      </section>

      {/* Email (read-only) */}
      <section>
        <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
          Email
        </h2>
        <div className="bg-muted border border-border rounded-xl px-4 py-2.5 max-w-sm">
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          El email no se puede cambiar desde aquí.
        </p>
      </section>

      {/* Change password */}
      <section>
        <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
          Cambiar contraseña
        </h2>
        <form onSubmit={handlePassSubmit} className="flex flex-col gap-3 max-w-sm">
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Nueva contraseña"
            className="bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <input
            name="confirm_password"
            type="password"
            required
            minLength={8}
            placeholder="Confirmar contraseña"
            className="bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          {passError   && <p className="text-xs text-red-400">{passError}</p>}
          {passSuccess && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 size={12} /> Contraseña actualizada
            </p>
          )}
          <button
            type="submit"
            disabled={isChangingPass}
            className="self-start bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isChangingPass ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/settings/account-tab.tsx
git commit -m "feat(settings): AccountTab — name, email, password, avatar"
```

---

### Task 4: Create UsageTab component

**Files:**
- Create: `src/app/(dashboard)/settings/usage-tab.tsx`

This is a Server Component (no 'use client') that fetches counts directly from Supabase.

- [ ] **Step 1: Create the component**

```typescript
// src/app/(dashboard)/settings/usage-tab.tsx
import { createClient } from '@/lib/supabase/server'
import { getPlanLimits, getUsageState } from '@/lib/plan-limits'

interface UsageTabProps {
  businessId: string
  plan: string
}

function UsageBar({ current, limit, label }: { current: number; limit: number | null; label: string }) {
  const pct    = limit === null ? 0 : Math.min(100, Math.round((current / limit) * 100))
  const state  = limit === null ? 'ok' : getUsageState(current, limit)
  const barColor =
    state === 'full'    ? 'bg-red-500'
    : state === 'warning' ? 'bg-amber-400'
    : 'bg-primary'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">{label}</span>
        <span className="text-muted-foreground">
          {current} / {limit === null ? '∞' : limit}
        </span>
      </div>
      {limit !== null && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {limit === null && (
        <div className="h-2 bg-primary/20 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full w-full opacity-40" />
        </div>
      )}
      {state === 'full' && (
        <p className="text-xs text-red-400">Límite alcanzado. Actualiza tu plan para continuar.</p>
      )}
      {state === 'warning' && (
        <p className="text-xs text-amber-400">Cerca del límite. Considera actualizar tu plan.</p>
      )}
    </div>
  )
}

export async function UsageTab({ businessId, plan }: UsageTabProps) {
  const supabase = await createClient()
  const limits   = getPlanLimits(plan)

  // Count active customers for this business
  const { count: customerCount } = await supabase
    .from('customer_cards')
    .select('customer_id', { count: 'exact', head: true })
    .eq('loyalty_cards.business_id', businessId)

  // Count active (non-deleted) loyalty cards
  const { count: cardCount } = await supabase
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .is('deleted_at', null)

  const customers = customerCount ?? 0
  const cards     = cardCount ?? 0

  return (
    <div className="flex flex-col gap-6 max-w-sm">
      <UsageBar
        current={customers}
        limit={limits.maxCustomers}
        label="Clientes"
      />
      <UsageBar
        current={cards}
        limit={limits.maxCards}
        label="Tarjetas de fidelización"
      />

      {(limits.maxCustomers !== null || limits.maxCards !== null) && (
        <a
          href="/settings?tab=suscripcion"
          className="self-start text-sm text-primary hover:underline"
        >
          Actualizar plan →
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/settings/usage-tab.tsx
git commit -m "feat(settings): UsageTab — customer and card usage bars"
```

---

### Task 5: Wire AccountTab and UsageTab into settings page

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

The settings page was updated in Plan A-MP to have tab structure. Now add Cuenta and Consumo tabs with their components.

- [ ] **Step 1: Replace the full settings page with all 3 tabs wired up**

```typescript
// src/app/(dashboard)/settings/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from './settings-form'
import { SubscriptionTab } from '@/components/dashboard/subscription-tab'
import { AccountTab } from './account-tab'
import { UsageTab } from './usage-tab'
import { Suspense } from 'react'

type Tab = 'cuenta' | 'suscripcion' | 'consumo' | 'scanner'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, email, plan, stamp_cooldown_seconds, avatar_url')
    .eq('owner_id', user.id)
    .single()

  const activeTab: Tab =
    searchParams.tab === 'suscripcion' ? 'suscripcion'
    : searchParams.tab === 'consumo'   ? 'consumo'
    : searchParams.tab === 'scanner'   ? 'scanner'
    : 'cuenta'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'cuenta',      label: 'Cuenta' },
    { key: 'suscripcion', label: 'Suscripción' },
    { key: 'consumo',     label: 'Consumo' },
    { key: 'scanner',     label: 'Scanner' },
  ]

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-black text-foreground mb-1">Ajustes</h1>
      <p className="text-muted-foreground text-sm mb-6">Configuración de tu cuenta y negocio.</p>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-8 flex-wrap">
        {tabs.map((tab) => (
          <a
            key={tab.key}
            href={`/settings?tab=${tab.key}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Cuenta tab */}
      {activeTab === 'cuenta' && (
        <AccountTab
          businessName={business?.name ?? ''}
          email={business?.email ?? user.email ?? ''}
          avatarUrl={business?.avatar_url ?? null}
        />
      )}

      {/* Suscripción tab */}
      {activeTab === 'suscripcion' && (
        <SubscriptionTab />
      )}

      {/* Consumo tab */}
      {activeTab === 'consumo' && business && (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando consumo...</p>}>
          <UsageTab businessId={business.id} plan={business.plan} />
        </Suspense>
      )}

      {/* Scanner tab */}
      {activeTab === 'scanner' && (
        <section>
          <h2 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
            Scanner
          </h2>
          <SettingsForm cooldownSeconds={business?.stamp_cooldown_seconds ?? 0} />
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Test all tabs render**

```bash
npm run dev
```

Navigate to:
- `http://localhost:3000/settings` → Cuenta tab renders with name, email, password form
- `http://localhost:3000/settings?tab=suscripcion` → Suscripción tab (plan info or loading)
- `http://localhost:3000/settings?tab=consumo` → Consumo tab with usage bars
- `http://localhost:3000/settings?tab=scanner` → Scanner settings

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx
git commit -m "feat(settings): wire AccountTab, UsageTab into full settings page"
```
