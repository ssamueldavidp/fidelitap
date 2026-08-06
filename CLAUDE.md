# Fidelitap — Contexto del Proyecto para Claude Code

## Qué es este proyecto

Fidelitap es una plataforma SaaS de tarjetas de fidelización digitales para negocios pequeños en Colombia. Los negocios crean tarjetas de sellos digitales; los clientes las activan escaneando un QR, acumulan sellos cada visita, y reclaman premios al completarlos. Las tarjetas se guardan en Apple Wallet y Google Wallet.

**Stack:** Next.js 14 App Router · Supabase (local Docker en 54321) · TypeScript · Tailwind · pnpm · satori + @resvg/resvg-js (poster PNG) · passkit-generator (Apple Wallet) · mercadopago SDK (pagos)

---

## Cómo correr el proyecto

```bash
# 1. Supabase local
pnpm supabase start

# 2. Next.js dev server
pnpm dev

# 3. ngrok (para probar en iPhone / webhooks de MercadoPago)
ngrok http 3000
```

El ngrok URL debe coincidir con `NEXT_PUBLIC_APP_URL` en `.env.local`.

### Smoke test end-to-end

```bash
pnpm test:e2e
```

Recorre con Playwright (Chromium headless) las páginas principales autenticado + público, y falla si hay errores de consola/página o si alguna ruta no carga. Requiere Supabase y `pnpm dev` corriendo, y una cuenta de prueba con plan Pro/Premium (`pagopro@correo.com` por defecto — configurable con `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`/`E2E_TEST_CARD_SLUG`/`E2E_BASE_URL`). Capturas en `e2e/screenshots/` (no se commitean).

---

## Variables de entorno requeridas (.env.local)

Todas las credenciales están en `.env.local` y NUNCA se commitean. Variables clave:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL local Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (solo server) |
| `NEXT_PUBLIC_APP_URL` | URL pública (ngrok o producción) |
| `MP_ACCESS_TOKEN` | MercadoPago access token (TEST-... para sandbox) |
| `MP_PUBLIC_KEY` | MercadoPago public key |
| `RESEND_API_KEY` | Resend para emails |
| `APPLE_PASS_*` | Certificados Apple Wallet |
| `GOOGLE_SERVICE_ACCOUNT_*` | Credenciales Google Wallet |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account Firebase Admin para envío FCM (geofencing + push móvil) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push (suscripciones, campañas, recordatorios) |
| `CRON_SECRET` | Autoriza los endpoints de cron de push (`/api/push/campaigns/dispatch`, `/api/push/jobs/reengagement`) |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/           # login, register
│   ├── (dashboard)/      # cards, customers, poster, scanner, settings
│   ├── api/              # poster, subscriptions, wallet, webhooks, push
│   ├── c/[slug]/         # página pública de activación de tarjeta
│   └── wallet/           # landing wallet del cliente
├── components/
│   ├── cards/            # card-editor, card-widget, wallet-preview
│   ├── dashboard/        # sidebar, logout-button
│   └── push/             # push-opt-in.tsx — UI de suscripción Web Push
├── lib/
│   ├── supabase/         # server.ts, admin.ts, service.ts (todos server-only)
│   ├── mercadopago.ts    # server-only; mpPreference, isSandbox(), getCheckoutUrl()
│   ├── storage-url.ts    # resolveStorageUrl() — reescribe localhost:54321 → ngrok
│   ├── wallet/           # apple.ts, google.ts, apns.ts, hmac.ts
│   ├── email/            # send-business-welcome, send-customer-welcome, send-card-complete
│   ├── poster/           # template.tsx (satori JSX) + fonts/*.woff (Inter)
│   ├── plan-limits.ts    # límites por plan
│   └── push/             # eligibility.ts, send.ts — envío Web Push server-only
└── types/
    └── database.ts       # generado con `pnpm supabase gen types typescript --local`
                          # NUNCA editar a mano — regenerar tras cada migración
```

---

## Planes y límites

| Plan | Precio COP | maxCustomers | maxCards |
|---|---|---|---|
| free | 0 | 20 | 1 |
| basic | 49.900 | 500 | 3 |
| pro | 99.900 | 2.000 | 10 |
| premium | 179.900 | ilimitado | ilimitado |

Fuente de verdad: `src/lib/plan-limits.ts` (límites) y `src/lib/mercadopago.ts` (precios). El plan se activa vía webhook de MercadoPago tras pago exitoso. `external_reference` format: `${businessId}:${planSlug}`.

**Funciones exclusivas Pro/Premium:** notificaciones Web Push (campañas, recordatorio de re-engagement a 14 días, aviso de progreso de sellos).

---

## Flujo de pagos (MercadoPago)

- SDK: `mercadopago` npm package
- API usada: **Checkout Pro** (Preferences), NO PreApproval
- Sandbox: usar `sandbox_init_point`, no `init_point`. Helper `isSandbox()` detecta si `MP_ACCESS_TOKEN` empieza con `TEST-`
- `getCheckoutUrl(response)` selecciona automáticamente el URL correcto
- Credenciales: app **Fidelitap** (no "Nuestra misión"). Si `MP_ACCESS_TOKEN` empieza con `TEST-`, es sandbox
- Para probar pagos: login como test buyer en MP antes de ingresar datos de tarjeta

---

## Patrones críticos — leer antes de tocar código

### `resolveStorageUrl(url)`
Todas las imágenes de Supabase Storage se pasan por `resolveStorageUrl()` antes de renderizar. Esto reescribe `http://127.0.0.1:54321` → `NEXT_PUBLIC_APP_URL` para que funcionen en iPhone vía ngrok.

```ts
import { resolveStorageUrl } from '@/lib/storage-url'
const src = resolveStorageUrl(design.logo_url)
```

### `server-only` en libs sensibles
Los siguientes archivos tienen `import 'server-only'` — NUNCA importarlos en Client Components:
- `src/lib/mercadopago.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/supabase/service.ts`
- `src/lib/supabase/server.ts`
- `src/lib/wallet/google.ts`
- `src/lib/wallet/apple.ts`

### Soft-delete en loyalty_cards
Toda query a `loyalty_cards` debe incluir `.is('deleted_at', null)`. El proyecto usa soft-delete.

### `customer_cards` — anti-fraude
Un email = una tarjeta por negocio. Si el cliente ya tiene tarjeta, `activateCardAction` devuelve la existente (`alreadyHadCard: true`). La recuperación de tarjeta usa solo el email.

### `addStampAction` (scanner/actions.ts)
Punto de entrada cuando el negocio sella una tarjeta. Al terminar dispara en paralelo:
1. APNS push (actualización Apple Wallet pass)
2. Google Wallet stamp update
3. Email de completado (si `isComplete`)
4. Web Push notification al cliente si está cerca de su premio (umbral configurable por tarjeta, Pro/Premium)

### Tipos de base de datos
**NUNCA** escribir `src/types/database.ts` a mano. Regenerar siempre con:
```bash
pnpm supabase gen types typescript --local > src/types/database.ts
```
Luego restaurar los tipos custom al final del archivo: `CardDesignConfig`, `LoyaltyCard`, `PlanSlug`, etc.

---

## Funcionalidades implementadas

- [x] Auth (registro + login + logout)
- [x] Selección de plan en registro + redirect a MercadoPago
- [x] Webhook MercadoPago → activa plan en DB
- [x] Dashboard: crear/editar tarjetas con logo e imagen de fondo
- [x] Card editor con preview en vivo
- [x] Página pública `/c/[slug]` — activación de tarjeta
  - Campos: nombre, email, teléfono (opcional)
  - Consentimiento datos (Ley 1581 de 2012) — obligatorio
  - Consentimiento marketing — opcional
  - Aviso anti-fraude
  - Recuperación de tarjeta por email
- [x] Apple Wallet (PKPass) y Google Wallet integration
- [x] Scanner QR — agrega sellos, cooldown configurable
- [x] Emails transaccionales (bienvenida negocio, bienvenida cliente, premio completado)
- [x] Poster/plantilla editable — PNG y PDF descargable con satori
- [x] Sección de suscripción en settings
- [x] Web Push Notifications (Pro/Premium): opt-in en success-screen de activación, aviso de progreso de sellos, recordatorio de re-engagement a 14 días (cron), panel de campañas manuales en dashboard (envío inmediato/programado/cancelable)
- [x] Páginas legales `/privacy` y `/terms` (borrador — requieren revisión legal antes de producción)
- [x] **App móvil Flutter** — dueño y cliente en una sola app
  - Auth Supabase anónimo (cliente) + email/password (dueño)
  - Dueño: dashboard, crear/editar tarjetas con logo upload, multi-nivel de premios, scanner QR
  - Cliente: lista de tarjetas con progreso de sellos (multi-nivel), botón Agregar a Wallet
  - Tarjetas avanzadas: `card_rewards` (multi-nivel), `logo_url`, `expires_at`, `max_uses_per_customer`, preview en vivo
  - Push FCM (Firebase): registro de token, notificaciones locales
  - Geofencing (Pro+): notificación FCM cuando el cliente entra al radio del negocio; dueño configura radio, mensaje y horario silencioso desde la app
  - Wallet live updates (Basic+): APNs push silencioso + Google Wallet PATCH en cada sello; gate de plan (free no recibe updates)
  - APK debug disponible: `mobile/build/app/outputs/flutter-apk/app-debug.apk`

---

## Learnings críticos (no romper)

- `@resvg/resvg-js` requiere `experimental.serverComponentsExternalPackages: ['@resvg/resvg-js']` en `next.config.mjs`. Sin esto webpack no puede bundlear el binario nativo y falla en producción silenciosamente.
- Todas las queries de `loyalty_cards` deben incluir `.is('deleted_at', null)`. El proyecto usa soft-delete.
- `wallet-preview.tsx` es Client Component (`'use client'`) — CRÍTICO. Si se quita, los `onError` de imágenes fallan con "Event handlers cannot be passed to Client Component props".
- `publicaciones` / fotos en DB son `TEXT[]`, no `foto_url` string.
- `documentos.categoria` usa title-case exacto: `'Reglamento'`, `'Actas'`, `'Finanzas'`.
- Flutter `FileOptions` requiere import explícito — no se resuelve transitivamente.
- MercadoPago: NO pasar `payer_email` en Preference — causa "Both payer and collector must be real or test users" en sandbox.
- MercadoPago sandbox: botón de pagar solo se habilita si el comprador está logueado como test user en MP.
- `satori` (poster) exige `display: 'flex' | 'contents' | 'none'` explícito en cualquier `<div>` con más de un nodo hijo — incluido texto mixto con interpolación tipo `ACUMULA {n} SELLOS` (son 3 nodos de texto, no uno). Si falta, lanza "Expected `<div>` to have explicit display..." sin indicar cuál div. Usar un solo string interpolado (`` {`ACUMULA ${n} SELLOS`} ``) o declarar `display` explícito.
- `<img>` con `onLoad`/`onError` en un componente SSR puede quedarse en estado "cargando" para siempre: el navegador puede terminar de cargar la imagen (parseando el HTML inicial) antes de que React hidrate y adjunte el listener, y el evento `load` no se reemite. Mitigación: usar `ref={(el) => el?.complete && setLoading(false)}` además de `onLoad`/`onError` (ver `poster-editor.tsx`).

---

## Seguridad

- **Ninguna API key, token o credencial puede quedar expuesta en el frontend.**
- `server-only` en todas las libs con credenciales.
- CSP configurado en `next.config.mjs`.
- `.env.local` en `.gitignore` — nunca commitear.
- Credenciales de MercadoPago: solo en variables de entorno, nunca hardcodeadas.
