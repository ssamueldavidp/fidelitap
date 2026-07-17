# Fidelitap Mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir Fidelitap en una app nativa iOS/Android usando Capacitor (ya inicializado), añadiendo auth OTP para clientes, vista "Mis Tarjetas" con QR persistente, notificaciones push nativas (Pro+) vía Firebase/APNs, y geo-push por proximidad al negocio (Pro+).

**Architecture:** Capacitor envuelve el Next.js existente en una WebView nativa. El UI del negocio (dashboard) es gratis — ya existe. El trabajo nuevo es: (A) auth OTP + rutas móvil-first para clientes, (B) plugins Capacitor para push nativo y (C) geofencing client-side para geo-push. El backend server-side reutiliza la lógica existente de sellos y plan-limits.ts; solo cambia el canal de entrega de push (VAPID → Firebase Admin SDK).

**Tech Stack:** Next.js 14 App Router · Supabase · Capacitor 7 · `@capacitor/push-notifications` · `firebase-admin` · `@capacitor-community/background-geolocation` · TypeScript · Playwright (e2e)

**Spec:** `docs/superpowers/specs/2026-06-22-fidelitap-mobile-redesign-design.md`

---

## Mapa de archivos

### Fase A — Fundación (DB + Capacitor config)
| Acción | Archivo |
|---|---|
| Create | `supabase/migrations/20260702000000_mobile_foundation.sql` |
| Modify | `src/types/database.ts` (regenerar) |
| Modify | `capacitor.config.ts` |

### Fase B — Experiencia cliente móvil
| Acción | Archivo |
|---|---|
| Create | `src/app/(mobile)/layout.tsx` |
| Create | `src/app/(mobile)/login/page.tsx` |
| Create | `src/app/(mobile)/login/actions.ts` |
| Create | `src/app/(mobile)/cards/page.tsx` |
| Create | `src/app/(mobile)/cards/[id]/page.tsx` |
| Modify | `src/app/c/[slug]/success-screen.tsx` |

### Fase C — Push nativo (Pro+)
| Acción | Archivo |
|---|---|
| Create | `src/app/api/push/device-token/route.ts` |
| Create | `src/lib/push/firebase.ts` |
| Modify | `src/lib/push/send.ts` |
| Modify | `src/lib/push/eligibility.ts` |
| Modify | `src/app/(dashboard)/scanner/actions.ts` |
| Modify | `src/app/api/push/campaigns/dispatch/route.ts` |
| Modify | `src/app/api/push/jobs/reengagement/route.ts` |
| Modify | `src/app/(mobile)/layout.tsx` (agregar push listener) |

### Fase D — Geo-push (Pro+)
| Acción | Archivo |
|---|---|
| Create | `src/app/api/businesses/location/route.ts` |
| Modify | `src/app/(dashboard)/settings/page.tsx` |
| Create | `src/lib/capacitor/geofence.ts` |
| Modify | `src/app/(mobile)/layout.tsx` (registrar geofences) |
| Create | `supabase/migrations/20260702000001_businesses_location.sql` |

---

## FASE A — Fundación

### Task A1: Migración DB — device_tokens + columnas nuevas

**Files:**
- Create: `supabase/migrations/20260702000000_mobile_foundation.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260702000000_mobile_foundation.sql

-- Tabla para tokens de dispositivo (reemplaza push_subscriptions VAPID)
create table public.device_tokens (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  expo_token   text not null,
  platform     text not null check (platform in ('ios', 'android')),
  created_at   timestamptz not null default now(),
  unique (customer_id, expo_token)
);

-- Vincular sesión OTP móvil con fila de cliente
alter table public.customers
  add column if not exists auth_user_id uuid references auth.users(id);

create unique index if not exists customers_auth_user_id_key
  on public.customers(auth_user_id)
  where auth_user_id is not null;

-- RLS: device_tokens — solo el propio cliente puede leer/borrar sus tokens
alter table public.device_tokens enable row level security;

create policy "customers manage own device tokens"
  on public.device_tokens
  for all
  using (
    customer_id = (
      select id from public.customers where auth_user_id = auth.uid()
    )
  );

-- RLS: service role puede insertar tokens (desde la API /api/push/device-token)
create policy "service role insert device tokens"
  on public.device_tokens
  for insert
  with check (true);
```

- [ ] **Step 2: Aplicar migración**

```bash
pnpm supabase db push
```

Esperado: `Applied 1 migration` sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260702000000_mobile_foundation.sql
git commit -m "feat(db): add device_tokens table and customers.auth_user_id"
```

---

### Task A2: Regenerar tipos de Supabase

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Regenerar**

```bash
pnpm supabase gen types typescript --local > src/types/database.ts
```

- [ ] **Step 2: Restaurar tipos custom al final del archivo**

Abre `src/types/database.ts` y confirma que los tipos custom al final (`CardDesignConfig`, `LoyaltyCard`, `PlanSlug`, etc.) siguen presentes. Si `gen types` los borró, restáuralos desde `git diff`.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "chore: regenerate supabase types after mobile_foundation migration"
```

---

### Task A3: Capacitor config — estrategia dev vs producción

**Files:**
- Modify: `capacitor.config.ts`

- [ ] **Step 1: Actualizar config con estrategia clara**

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

// DEV: usa NEXT_PUBLIC_APP_URL (ngrok). Requiere `pnpm dev` + `ngrok http 3000`.
// PROD: cambia server.url al dominio de producción antes de cualquier build de store.
const isProd = process.env.CAPACITOR_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'co.fidelitap.app',
  appName: 'FideliTap',
  webDir: 'public',
  server: {
    url: isProd
      ? 'https://TU_DOMINIO_PRODUCCION.com'  // reemplazar antes del build
      : (process.env.NEXT_PUBLIC_APP_URL ?? 'https://frail-enunciate-eatery.ngrok-free.dev'),
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
```

- [ ] **Step 2: Sync Capacitor**

```bash
pnpm dlx cap sync
```

Esperado: `Sync finished` para android e ios.

- [ ] **Step 3: Commit**

```bash
git add capacitor.config.ts
git commit -m "chore(capacitor): add dev/prod URL strategy and push plugin config"
```

---

## FASE B — Experiencia cliente móvil

### Task B1: Layout móvil para clientes

**Files:**
- Create: `src/app/(mobile)/layout.tsx`

- [ ] **Step 1: Crear layout mínimo sin sidebar**

```tsx
// src/app/(mobile)/layout.tsx
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {children}
    </main>
  );
}
```

---

### Task B2: Página de login OTP para clientes

**Files:**
- Create: `src/app/(mobile)/login/page.tsx`
- Create: `src/app/(mobile)/login/actions.ts`

- [ ] **Step 1: Server actions de OTP**

```typescript
// src/app/(mobile)/login/actions.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function sendOtpAction(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function verifyOtpAction(email: string, token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) return { error: error.message };

  // Vincular auth.user → customers.auth_user_id si no está vinculado
  const userId = data.user?.id;
  if (userId) {
    await supabase
      .from('customers')
      .update({ auth_user_id: userId })
      .eq('email', email)
      .is('auth_user_id', null);
  }

  redirect('/app/cards');
}
```

- [ ] **Step 2: Página de login**

```tsx
// src/app/(mobile)/login/page.tsx
'use client';

import { useState } from 'react';
import { sendOtpAction, verifyOtpAction } from './actions';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    setError('');
    const result = await sendOtpAction(email);
    if (result?.error) { setError(result.error); } else { setStep('code'); }
    setLoading(false);
  }

  async function handleVerify() {
    setLoading(true);
    setError('');
    const result = await verifyOtpAction(email, code);
    if (result?.error) { setError(result.error); }
    setLoading(false);
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 gap-6">
      <h1 className="text-2xl font-bold text-center">Tus tarjetas de fidelización</h1>

      {step === 'email' ? (
        <>
          <p className="text-gray-500 text-center text-sm">
            Ingresa tu email para ver tus tarjetas activas.
          </p>
          <input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full max-w-sm border rounded-xl px-4 py-3 text-base"
          />
          <button
            onClick={handleSend}
            disabled={loading || !email}
            className="w-full max-w-sm bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </>
      ) : (
        <>
          <p className="text-gray-500 text-center text-sm">
            Te enviamos un código de 6 dígitos a <strong>{email}</strong>
          </p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={e => setCode(e.target.value)}
            maxLength={6}
            className="w-full max-w-sm border rounded-xl px-4 py-3 text-base text-center text-2xl tracking-widest"
          />
          <button
            onClick={handleVerify}
            disabled={loading || code.length < 6}
            className="w-full max-w-sm bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
          <button onClick={() => setStep('email')} className="text-sm text-gray-400 underline">
            Cambiar email
          </button>
        </>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Verificar manualmente**

Con Supabase y `pnpm dev` corriendo, abre `http://localhost:3000/app/login`. Ingresa un email → verifica que llega el código → ingresa el código → confirma que redirige a `/app/cards`.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(mobile\)/
git commit -m "feat(mobile): customer OTP login page"
```

---

### Task B3: Lista de tarjetas del cliente

**Files:**
- Create: `src/app/(mobile)/cards/page.tsx`

- [ ] **Step 1: Crear la página**

```tsx
// src/app/(mobile)/cards/page.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function CardsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/app/login');

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('auth_user_id', user.id)
    .single();

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 gap-4">
        <p className="text-gray-500 text-center">
          No tienes tarjetas activadas aún. Escanea el QR de un negocio para empezar.
        </p>
      </div>
    );
  }

  const { data: cards } = await supabase
    .from('customer_cards')
    .select(`
      id,
      current_stamps,
      is_complete,
      times_completed,
      loyalty_cards (
        id, name, stamps_required, benefit_description,
        businesses ( name )
      )
    `)
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col px-4 py-8 gap-4">
      <h1 className="text-xl font-bold px-2">Hola, {customer.name.split(' ')[0]} 👋</h1>
      <h2 className="text-sm text-gray-500 px-2">Tus tarjetas de fidelización</h2>

      {(cards ?? []).map(card => {
        const lc = card.loyalty_cards as any;
        const business = lc?.businesses as any;
        const pct = Math.round((card.current_stamps / lc.stamps_required) * 100);

        return (
          <Link key={card.id} href={`/app/cards/${card.id}`}>
            <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3 active:scale-95 transition-transform">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-gray-900">{business?.name}</p>
                  <p className="text-xs text-gray-400">{lc.name}</p>
                </div>
                {card.is_complete && (
                  <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">
                    Premio listo 🎉
                  </span>
                )}
              </div>

              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>

              <p className="text-xs text-gray-500">
                {card.current_stamps} / {lc.stamps_required} sellos
                {!card.is_complete && ` — te faltan ${lc.stamps_required - card.current_stamps} para: ${lc.benefit_description}`}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verificar en browser**

Activa una tarjeta con un email de prueba, luego abre `/app/login` con ese email → `/app/cards` debe mostrar la tarjeta con barra de progreso.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(mobile\)/cards/page.tsx
git commit -m "feat(mobile): customer cards list with stamp progress"
```

---

### Task B4: Detalle de tarjeta con QR persistente

**Files:**
- Create: `src/app/(mobile)/cards/[id]/page.tsx`

- [ ] **Step 1: Instalar qrcode si no está como dep de producción**

```bash
pnpm list qrcode
```

Si solo está en devDependencies, moverlo:

```bash
pnpm add qrcode
```

- [ ] **Step 2: Crear la página de detalle**

```tsx
// src/app/(mobile)/cards/[id]/page.tsx
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import Image from 'next/image';

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/app/login');

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();
  if (!customer) redirect('/app/login');

  const { data: card } = await supabase
    .from('customer_cards')
    .select(`
      id, unique_code, current_stamps, is_complete,
      apple_pass_url, google_pass_url,
      loyalty_cards (
        name, stamps_required, benefit_description,
        businesses ( name )
      )
    `)
    .eq('id', id)
    .eq('customer_id', customer.id)
    .single();

  if (!card) notFound();

  const lc = card.loyalty_cards as any;
  const business = lc?.businesses as any;
  const qrDataUrl = await QRCode.toDataURL(card.unique_code, { width: 240, margin: 2 });

  const stamps = Array.from({ length: lc.stamps_required }, (_, i) => i < card.current_stamps);

  return (
    <div className="flex flex-col px-4 py-8 gap-6 items-center">
      <div className="w-full bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4">
        <p className="text-sm text-gray-400 uppercase tracking-wide">{business?.name}</p>
        <h1 className="text-lg font-bold text-center">{lc.name}</h1>

        {/* Progreso de sellos */}
        <div className="flex flex-wrap gap-2 justify-center">
          {stamps.map((filled, i) => (
            <span
              key={i}
              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-lg
                ${filled ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300 text-gray-300'}`}
            >
              {filled ? '★' : '☆'}
            </span>
          ))}
        </div>

        <p className="text-sm text-gray-500 text-center">
          {card.is_complete
            ? `¡Premio listo! Muestra este QR en caja para reclamar: ${lc.benefit_description}`
            : `Te faltan ${lc.stamps_required - card.current_stamps} sellos para: ${lc.benefit_description}`}
        </p>
      </div>

      {/* QR del cliente — el negocio lo escanea para agregar sellos */}
      <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-3">
        <p className="text-sm text-gray-500 font-medium">
          Muestra este código al cajero
        </p>
        <Image src={qrDataUrl} alt="Tu código QR" width={200} height={200} className="rounded-xl" />
        <p className="text-xs text-gray-400">El negocio lo escanea para sumar tu sello</p>
      </div>

      {/* Botones de Wallet */}
      {(card.apple_pass_url || card.google_pass_url) && (
        <div className="w-full flex flex-col gap-3">
          {card.apple_pass_url && (
            <a
              href={card.apple_pass_url}
              className="w-full bg-black text-white py-3 rounded-xl font-semibold text-center"
            >
              🎫 Agregar a Apple Wallet
            </a>
          )}
          {card.google_pass_url && (
            <a
              href={card.google_pass_url}
              className="w-full bg-[#1a73e8] text-white py-3 rounded-xl font-semibold text-center"
            >
              🎫 Agregar a Google Wallet
            </a>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar**

Con una tarjeta activa, abre `/app/cards/[id]`. Confirma: sellos visuales, QR renderizado, botones de wallet.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(mobile\)/cards/
git commit -m "feat(mobile): card detail with persistent QR and wallet buttons"
```

---

### Task B5: Redirigir a /app/cards desde success-screen cuando viene del app

**Files:**
- Modify: `src/app/c/[slug]/success-screen.tsx`

- [ ] **Step 1: Añadir detección de entorno Capacitor + link a /app/cards**

Localiza en `success-screen.tsx` la sección donde se muestran los botones post-activación. Agrega un link "Ver mis tarjetas" que funciona tanto en web como en app:

```tsx
// Añadir importación al inicio del archivo:
// import { useEffect, useState } from 'react'

// Dentro del componente, añadir estado:
const [isNative, setIsNative] = useState(false);

useEffect(() => {
  // Detecta si corre dentro de Capacitor
  import('@capacitor/core').then(({ Capacitor }) => {
    setIsNative(Capacitor.isNativePlatform());
  }).catch(() => {});
}, []);

// En el JSX, añadir botón que lleva a /app/cards:
{isNative && (
  <a
    href="/app/cards"
    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-center block mt-2"
  >
    Ver mis tarjetas →
  </a>
)}
```

- [ ] **Step 2: Instalar @capacitor/core como dep de producción si falta**

```bash
pnpm list @capacitor/core
```

Si solo está en devDependencies, moverlo:

```bash
pnpm add @capacitor/core
```

- [ ] **Step 3: Verificar en browser**

En `/c/[slug]` web: el botón "Ver mis tarjetas" NO aparece (no es plataforma nativa). En la app Capacitor (via ngrok): aparece.

- [ ] **Step 4: Commit**

```bash
git add src/app/c/
git commit -m "feat(mobile): add native-only 'Ver mis tarjetas' link on success screen"
```

---

## FASE C — Push Nativo (Pro+)

### Task C1: Instalar y configurar @capacitor/push-notifications

**Files:**
- Modify: `package.json`, `capacitor.config.ts` (ya actualizado en A3)

- [ ] **Step 1: Instalar el plugin**

```bash
pnpm add @capacitor/push-notifications
pnpm dlx cap sync
```

- [ ] **Step 2: Configurar permisos Android**

En `android/app/src/main/AndroidManifest.xml`, confirma que existen (Capacitor los agrega automáticamente, solo verificar):

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
<uses-permission android:name="android.permission.VIBRATE"/>
```

- [ ] **Step 3: Configurar APNs en iOS**

En Xcode (abrir con `pnpm dlx cap open ios`):
1. Selecciona el target `App` → `Signing & Capabilities`
2. Agrega capability: `Push Notifications`
3. Agrega capability: `Background Modes` → marca `Remote notifications`

Para Android necesitas `google-services.json` del proyecto Firebase (ver Task C2).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(mobile): install @capacitor/push-notifications"
```

---

### Task C2: Firebase Admin SDK — envío server-side

**Files:**
- Create: `src/lib/push/firebase.ts`
- Modify: `.env.local` (nueva variable)

- [ ] **Step 1: Instalar firebase-admin**

```bash
pnpm add firebase-admin
```

- [ ] **Step 2: Crear helper de envío**

```typescript
// src/lib/push/firebase.ts
import 'server-only';
import admin from 'firebase-admin';

function getApp() {
  if (admin.apps.length) return admin.apps[0]!;

  const credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);
  return admin.initializeApp({
    credential: admin.credential.cert(credential),
  });
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Envía push a uno o más tokens FCM/APNs.
 * Para iOS funciona vía APNs bridge de Firebase (no requiere cert APNs separado).
 */
export async function sendPushToTokens(tokens: string[], payload: PushPayload) {
  if (!tokens.length) return;
  const app = getApp();
  const messaging = admin.messaging(app);

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data ?? {},
    apns: { payload: { aps: { sound: 'default' } } },
    android: { priority: 'high', notification: { sound: 'default' } },
  };

  const response = await messaging.sendEachForMulticast(message);
  return response;
}
```

- [ ] **Step 3: Agregar variable de entorno**

En `.env.local`:

```bash
# JSON completo del service account de Firebase (proyecto FideliTap)
FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
```

Obtenerlo en Firebase Console → Project Settings → Service Accounts → Generate new private key.

- [ ] **Step 4: Agregar a next.config.mjs como external**

```js
// next.config.mjs — dentro de experimental.serverComponentsExternalPackages:
serverComponentsExternalPackages: ['@resvg/resvg-js', 'firebase-admin'],
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/push/firebase.ts next.config.mjs package.json pnpm-lock.yaml
git commit -m "feat(push): add firebase-admin server-side push helper"
```

---

### Task C3: API endpoint para registrar device tokens

**Files:**
- Create: `src/app/api/push/device-token/route.ts`

- [ ] **Step 1: Crear endpoint**

```typescript
// src/app/api/push/device-token/route.ts
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token, platform } = await req.json() as { token: string; platform: 'ios' | 'android' };
  if (!token || !platform) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  await admin
    .from('device_tokens')
    .upsert({ customer_id: customer.id, expo_token: token, platform }, { onConflict: 'customer_id,expo_token' });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { token } = await req.json() as { token: string };
  const admin = createAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (customer) {
    await admin.from('device_tokens').delete()
      .eq('customer_id', customer.id)
      .eq('expo_token', token);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/push/device-token/
git commit -m "feat(push): device-token registration API endpoint"
```

---

### Task C4: Listener de push en el layout móvil (bridge Capacitor → web)

**Files:**
- Modify: `src/app/(mobile)/layout.tsx`

- [ ] **Step 1: Actualizar layout con push listener**

```tsx
// src/app/(mobile)/layout.tsx
'use client';

import { useEffect } from 'react';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function setupPush() {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;

      const { PushNotifications } = await import('@capacitor/push-notifications');

      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;

      await PushNotifications.register();

      PushNotifications.addListener('registration', async ({ value: token }) => {
        const platform = Capacitor.getPlatform() as 'ios' | 'android';
        await fetch('/api/push/device-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, platform }),
        });
      });

      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('Push received (foreground):', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', action => {
        const deepLink = action.notification.data?.deepLink as string | undefined;
        if (deepLink) window.location.href = deepLink;
      });
    }

    setupPush();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {children}
    </main>
  );
}
```

- [ ] **Step 2: Verificar**

En la app Capacitor (Android emulator o dispositivo real), abre `/app/cards`. Confirma en los logs de Android Studio / Xcode que el token FCM/APNs se registra y aparece en la tabla `device_tokens` de Supabase.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(mobile\)/layout.tsx
git commit -m "feat(push): Capacitor push listener registers device token on mount"
```

---

### Task C5: Actualizar lib/push/send.ts para usar Firebase

**Files:**
- Modify: `src/lib/push/send.ts`

- [ ] **Step 1: Reescribir send.ts para Firebase**

El archivo actual usa VAPID Web Push. Reemplazarlo completamente:

```typescript
// src/lib/push/send.ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToTokens } from './firebase';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Envía push a todos los dispositivos registrados de un cliente.
 * No lanza si no hay tokens — el cliente puede no tener la app instalada.
 */
export async function sendPushToCustomer(customerId: string, message: PushMessage) {
  const admin = createAdminClient();
  const { data: tokens } = await admin
    .from('device_tokens')
    .select('expo_token')
    .eq('customer_id', customerId);

  if (!tokens?.length) return;

  await sendPushToTokens(tokens.map(t => t.expo_token), message);
}

/**
 * Envía push a todos los clientes de un negocio que tengan la app instalada.
 * Usado por campañas manuales y re-engagement.
 */
export async function sendPushToBusinessCustomers(
  businessId: string,
  message: PushMessage,
  options: { loyaltyCardId?: string } = {}
) {
  const admin = createAdminClient();

  // 1. Encontrar todos los customer_ids con tarjeta de este negocio
  let ccQuery = admin
    .from('customer_cards')
    .select('customer_id, loyalty_cards!inner(business_id)')
    .eq('loyalty_cards.business_id', businessId);

  if (options.loyaltyCardId) {
    ccQuery = ccQuery.eq('loyalty_card_id', options.loyaltyCardId);
  }

  const { data: customerCards } = await ccQuery;
  if (!customerCards?.length) return;

  const customerIds = [...new Set((customerCards as any[]).map(c => c.customer_id))];

  // 2. Obtener tokens de esos clientes
  const { data: tokens } = await admin
    .from('device_tokens')
    .select('expo_token')
    .in('customer_id', customerIds);

  if (!tokens?.length) return;
  const uniqueTokens = [...new Set(tokens.map(t => t.expo_token))];
  await sendPushToTokens(uniqueTokens, message);
}
```

- [ ] **Step 2: Actualizar eligibility.ts**

```typescript
// src/lib/push/eligibility.ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlanLimits } from '@/lib/plan-limits';

/**
 * Devuelve true si el negocio está en plan Pro o Premium
 * y el cliente tiene al menos un device token registrado.
 */
export async function canSendPush(businessId: string, customerId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: business } = await admin
    .from('businesses')
    .select('plan')
    .eq('id', businessId)
    .single();

  if (!business) return false;
  const limits = getPlanLimits(business.plan);
  if (!limits.pushNotifications) return false;

  const { count } = await admin
    .from('device_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId);

  return (count ?? 0) > 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/push/
git commit -m "feat(push): replace VAPID web push with Firebase Admin SDK delivery"
```

---

### Task C6: Trigger de push en addStampAction

**Files:**
- Modify: `src/app/(dashboard)/scanner/actions.ts`

- [ ] **Step 1: Añadir push al flujo de sellos**

En `actions.ts`, dentro de `addStampAction`, ya existe una zona donde se disparan los side-effects paralelos (APNS wallet update, Google Wallet, email). Añadir el push de progreso:

```typescript
// En addStampAction, dentro del bloque de efectos paralelos,
// junto a los otros await Promise.all([...]):

import { canSendPush } from '@/lib/push/eligibility';
import { sendPushToCustomer } from '@/lib/push/send';

// Dentro del bloque paralelo existente, añadir:
const eligibleForPush = await canSendPush(businessId, customerCard.customer_id);

if (eligibleForPush) {
  const remaining = loyaltyCard.stamps_required - newStamps;

  if (isComplete) {
    await sendPushToCustomer(customerCard.customer_id, {
      title: '🎉 ¡Premio completado!',
      body: `Muestra tu tarjeta de ${businessName} en caja para reclamar: ${loyaltyCard.benefit_description}`,
      data: { deepLink: `/app/cards/${customerCard.id}` },
    });
  } else if (remaining <= (loyaltyCard.stamp_push_threshold ?? 3)) {
    await sendPushToCustomer(customerCard.customer_id, {
      title: `⭐ ¡Ya casi! — ${businessName}`,
      body: `Te ${remaining === 1 ? 'falta 1 sello' : `faltan ${remaining} sellos`} para: ${loyaltyCard.benefit_description}`,
      data: { deepLink: `/app/cards/${customerCard.id}` },
    });
  }
}
```

> **Nota:** `stamp_push_threshold` ya existe en el schema de `loyalty_cards` (configurable por tarjeta, valor por defecto 3). Si no existe, agrégalo en la migración de la Fase A o una nueva migración.

- [ ] **Step 2: Verificar**

Desde el scanner del dashboard (web o app), sella una tarjeta de un cliente que tenga la app instalada y un device token registrado. Confirma en Firebase Console → Cloud Messaging que el mensaje fue enviado, y que el dispositivo lo recibe.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/scanner/actions.ts
git commit -m "feat(push): trigger Firebase push on stamp via addStampAction"
```

---

### Task C7: Actualizar cron de re-engagement

**Files:**
- Modify: `src/app/api/push/jobs/reengagement/route.ts`

- [ ] **Step 1: Reemplazar envío VAPID por Firebase**

```typescript
// Dentro del loop de clientes inactivos, reemplazar la llamada a webpush/VAPID:
// ANTES: await sendWebPush(subscription, { ... })
// DESPUÉS:
import { sendPushToCustomer } from '@/lib/push/send';
import { canSendPush } from '@/lib/push/eligibility';

// Por cada cliente inactivo:
if (await canSendPush(businessId, customer.id)) {
  await sendPushToCustomer(customer.id, {
    title: `¿Cuánto tiempo sin visitarnos? — ${businessName}`,
    body: `Te ${remaining === 1 ? 'falta 1 sello' : `faltan ${remaining} sellos`} para tu premio. ¡Te esperamos!`,
    data: { deepLink: `/app/cards/${customerCardId}` },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/push/jobs/
git commit -m "feat(push): re-engagement cron uses Firebase instead of VAPID"
```

---

### Task C8: Actualizar dispatch de campañas

**Files:**
- Modify: `src/app/api/push/campaigns/dispatch/route.ts`

- [ ] **Step 1: Reemplazar envío VAPID**

```typescript
// Reemplazar llamada VAPID por:
import { sendPushToBusinessCustomers } from '@/lib/push/send';

await sendPushToBusinessCustomers(businessId, {
  title: campaign.title,
  body: campaign.body,
  data: { deepLink: `/app/cards` },
}, { loyaltyCardId: campaign.loyalty_card_id ?? undefined });
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/push/campaigns/
git commit -m "feat(push): campaign dispatch uses Firebase instead of VAPID"
```

---

### Task C9: Deprecar Web Push VAPID

**Files:**
- Modify: `.env.local`, `src/components/push/push-opt-in.tsx` (si aplica)

- [ ] **Step 1: Marcar VAPID keys como deprecadas en .env.local**

```bash
# DEPRECADO — reemplazado por Firebase push para la app móvil.
# Mantener mientras haya usuarios con suscripciones web activas.
# VAPID_PUBLIC_KEY=...
# VAPID_PRIVATE_KEY=...
```

- [ ] **Step 2: Desactivar push-opt-in.tsx en la UI**

El componente `push-opt-in.tsx` (suscripción Web Push en la success-screen) puede quedar inactivo o reemplazarse por el flujo de push nativo de Capacitor. Comentar o eliminar su uso en las páginas que lo incluían.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(push): deprecate VAPID web push, Capacitor+Firebase is the channel"
```

---

## FASE D — Geo-Push (Pro+)

### Task D1: Migración DB — ubicación del negocio

**Files:**
- Create: `supabase/migrations/20260702000001_businesses_location.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260702000001_businesses_location.sql
alter table public.businesses
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geo_radius_m integer not null default 200;
```

- [ ] **Step 2: Aplicar**

```bash
pnpm supabase db push
pnpm supabase gen types typescript --local > src/types/database.ts
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260702000001_businesses_location.sql src/types/database.ts
git commit -m "feat(geo): add lat/lng/geo_radius_m to businesses table"
```

---

### Task D2: UI de ubicación en settings del negocio

**Files:**
- Create: `src/app/api/businesses/location/route.ts`
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Endpoint PATCH para guardar ubicación**

```typescript
// src/app/api/businesses/location/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lat, lng, geo_radius_m } = await req.json() as {
    lat: number; lng: number; geo_radius_m?: number;
  };

  const { error } = await supabase
    .from('businesses')
    .update({ lat, lng, geo_radius_m: geo_radius_m ?? 200 })
    .eq('owner_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Añadir sección de ubicación en settings**

En `src/app/(dashboard)/settings/page.tsx`, añadir una sección "Ubicación para geo-notificaciones (Pro+)":

```tsx
// Componente client-side para el formulario de ubicación
'use client';

function LocationSettings({ lat, lng, radius }: { lat?: number; lng?: number; radius: number }) {
  const [form, setForm] = useState({ lat: lat ?? '', lng: lng ?? '', radius });
  const [status, setStatus] = useState('');

  async function save() {
    const res = await fetch('/api/businesses/location', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: Number(form.lat), lng: Number(form.lng), geo_radius_m: form.radius }),
    });
    setStatus(res.ok ? 'Guardado ✓' : 'Error al guardar');
  }

  return (
    <div className="border rounded-xl p-4 flex flex-col gap-3">
      <h3 className="font-semibold">📍 Ubicación (geo-notificaciones Pro+)</h3>
      <p className="text-sm text-gray-500">
        Cuando tus clientes estén cerca, recibirán una notificación recordándoles cuántos sellos les faltan.
      </p>
      <div className="flex gap-2">
        <input
          type="number" placeholder="Latitud" step="0.0001"
          value={form.lat} onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <input
          type="number" placeholder="Longitud" step="0.0001"
          value={form.lng} onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Radio (m):</label>
        <input
          type="number" min={50} max={2000}
          value={form.radius} onChange={e => setForm(f => ({ ...f, radius: Number(e.target.value) }))}
          className="w-24 border rounded px-3 py-2 text-sm"
        />
      </div>
      <button onClick={save} className="bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium">
        Guardar ubicación
      </button>
      {status && <p className="text-sm text-green-600">{status}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/businesses/location/ src/app/\(dashboard\)/settings/
git commit -m "feat(geo): business location settings UI and API endpoint"
```

---

### Task D3: Geofencing client-side en la app

**Files:**
- Create: `src/lib/capacitor/geofence.ts`
- Modify: `src/app/(mobile)/layout.tsx`

- [ ] **Step 1: Instalar plugin**

```bash
pnpm add @capacitor-community/background-geolocation
pnpm dlx cap sync
```

- [ ] **Step 2: Crear helper de geofencing**

```typescript
// src/lib/capacitor/geofence.ts

/**
 * Registra un geofence por cada tarjeta activa del cliente.
 * Cuando el cliente entra al radio → notificación local con sellos faltantes.
 * La ubicación nunca se envía al servidor.
 */
export async function registerGeofencesForCards(
  cards: Array<{
    customerCardId: string;
    businessName: string;
    lat: number;
    lng: number;
    radiusM: number;
    stampsRemaining: number;
    benefitDescription: string;
  }>
) {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return;

  const { BackgroundGeolocation } = await import('@capacitor-community/background-geolocation');

  await BackgroundGeolocation.requestPermissions();

  for (const card of cards) {
    if (card.stampsRemaining <= 0) continue; // tarjeta completa, no hacer push

    BackgroundGeolocation.addGeofence({
      identifier: `card-${card.customerCardId}`,
      latitude: card.lat,
      longitude: card.lng,
      radius: card.radiusM,
      notifyOnEntry: true,
      notifyOnExit: false,
      extras: {
        customerCardId: card.customerCardId,
        businessName: card.businessName,
        stampsRemaining: String(card.stampsRemaining),
        benefitDescription: card.benefitDescription,
      },
    });
  }

  await BackgroundGeolocation.startGeofences();

  BackgroundGeolocation.addListener('onGeofence', async event => {
    if (event.action !== 'ENTER') return;

    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const extras = event.extras as Record<string, string>;

    await LocalNotifications.schedule({
      notifications: [{
        id: Date.now(),
        title: `📍 Estás cerca de ${extras.businessName}`,
        body: `Te ${extras.stampsRemaining === '1' ? 'falta 1 sello' : `faltan ${extras.stampsRemaining} sellos`} para: ${extras.benefitDescription}. ¡Visítanos!`,
        extra: { deepLink: `/app/cards/${extras.customerCardId}` },
      }],
    });
  });
}
```

- [ ] **Step 3: Instalar local-notifications**

```bash
pnpm add @capacitor/local-notifications
pnpm dlx cap sync
```

- [ ] **Step 4: Activar geofences en el layout móvil**

En `src/app/(mobile)/layout.tsx`, dentro del `useEffect` de setup, añadir después del setup de push:

```typescript
// Después de setupPush(), añadir:
async function setupGeofences() {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) return;

  // Fetch de las tarjetas del cliente con la ubicación del negocio
  const res = await fetch('/api/mobile/cards-with-location');
  if (!res.ok) return;
  const cards = await res.json();

  const { registerGeofencesForCards } = await import('@/lib/capacitor/geofence');
  await registerGeofencesForCards(cards);
}

setupGeofences();
```

- [ ] **Step 5: Crear endpoint /api/mobile/cards-with-location**

```typescript
// src/app/api/mobile/cards-with-location/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 200 });

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  if (!customer) return NextResponse.json([]);

  const { data: cards } = await supabase
    .from('customer_cards')
    .select(`
      id, current_stamps,
      loyalty_cards (
        stamps_required, benefit_description,
        businesses ( name, lat, lng, geo_radius_m, plan )
      )
    `)
    .eq('customer_id', customer.id)
    .eq('is_complete', false);

  const result = (cards ?? [])
    .map(c => {
      const lc = c.loyalty_cards as any;
      const b = lc?.businesses as any;
      if (!b?.lat || !b?.lng) return null;
      // Solo negocios Pro/Premium pueden tener geo-push
      if (!['pro', 'premium'].includes(b.plan)) return null;
      return {
        customerCardId: c.id,
        businessName: b.name,
        lat: b.lat,
        lng: b.lng,
        radiusM: b.geo_radius_m ?? 200,
        stampsRemaining: lc.stamps_required - c.current_stamps,
        benefitDescription: lc.benefit_description,
      };
    })
    .filter(Boolean);

  return NextResponse.json(result);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/capacitor/ src/app/api/mobile/ src/app/\(mobile\)/layout.tsx package.json pnpm-lock.yaml
git commit -m "feat(geo): client-side geofencing for proximity push notifications"
```

---

### Task D3b: Configurar deep links (URL scheme fidelitap://)

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `ios/App/App/Info.plist`
- Modify: `src/app/(mobile)/layout.tsx`

- [ ] **Step 1: Instalar @capacitor/app**

```bash
pnpm add @capacitor/app
pnpm dlx cap sync
```

- [ ] **Step 2: Registrar URL scheme en Android**

En `android/app/src/main/AndroidManifest.xml`, dentro del `<activity>` principal, añadir:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="fidelitap" />
</intent-filter>
```

- [ ] **Step 3: Registrar URL scheme en iOS**

En `ios/App/App/Info.plist`, añadir:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>fidelitap</string>
    </array>
  </dict>
</array>
```

- [ ] **Step 4: Manejar deep links en el layout**

En `src/app/(mobile)/layout.tsx`, dentro del `useEffect`, añadir:

```typescript
const { App } = await import('@capacitor/app');
App.addListener('appUrlOpen', (event) => {
  // Convierte fidelitap://c/mi-negocio → /c/mi-negocio
  const url = new URL(event.url);
  const path = url.pathname || url.hostname + (url.pathname || '');
  if (path) window.location.href = path;
});
```

- [ ] **Step 5: Sync y verificar**

```bash
pnpm dlx cap sync
```

Prueba: en un dispositivo Android, abre `adb shell am start -W -a android.intent.action.VIEW -d "fidelitap://c/[slug]" co.fidelitap.app` — la app debe abrir y navegar a `/c/[slug]`.

- [ ] **Step 6: Commit**

```bash
git add android/ ios/ src/app/\(mobile\)/layout.tsx package.json pnpm-lock.yaml
git commit -m "feat(deeplink): register fidelitap:// URL scheme for Android and iOS"
```

---

### Task D4: Sync final Capacitor y smoke test

- [ ] **Step 1: Sync**

```bash
pnpm dlx cap sync
```

- [ ] **Step 2: Smoke test e2e**

```bash
pnpm test:e2e
```

Esperado: todas las rutas del dashboard y públicas siguen funcionando sin errores de consola.

- [ ] **Step 3: Test en dispositivo real**

1. Build Android: `pnpm dlx cap run android`
2. Abre la app → `/app/login` → OTP → `/app/cards`
3. Agrega un sello desde el dashboard web → confirma push en el dispositivo
4. Acércate a la ubicación configurada → confirma notificación local de geo-push

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: Fidelitap mobile app complete — push, geo-push, customer cards"
```

---

## Checklist de variables de entorno requeridas (nuevas)

Agregar a `.env.local` antes de ejecutar las Fases C y D:

```bash
FIREBASE_SERVICE_ACCOUNT_JSON='{ ... }'   # JSON del service account de Firebase
```

Y en Firebase Console:
- Android: descargar `google-services.json` → colocar en `android/app/`
- iOS: descargar `GoogleService-Info.plist` → colocar en `ios/App/App/`
