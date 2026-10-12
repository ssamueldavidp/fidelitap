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
| `MP_ACCESS_TOKEN` | MercadoPago access token |
| `MP_SANDBOX_PAYER_EMAIL` | Solo pruebas: correo del comprador de prueba para el PreApproval |
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
│   ├── mercadopago.ts    # server-only; createSubscriptionLink(), cancelMpSubscription(), verifyMpSignature()
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

Fuente de verdad: `src/lib/plan-limits.ts` (límites), `src/lib/plan-features.ts` (qué incluye cada plan — lo usan el registro web, la pestaña de suscripción y `/api/mobile/settings`) y `src/lib/mercadopago.ts` (precios). El plan se activa vía webhook de MercadoPago cuando la suscripción queda autorizada y se renueva con cada cobro mensual aprobado. `external_reference` format: `${businessId}:${planSlug}`.

**Funciones exclusivas Pro/Premium:** notificaciones Web Push (campañas, recordatorio de re-engagement a 14 días, aviso de progreso de sellos); geofencing de proximidad (app móvil); aparecer en el directorio "Tiendas cercanas" (app móvil y página pública `/tiendas` en la web; misma consulta en `src/lib/directory.ts`).

---

## Flujo de pagos (MercadoPago)

- SDK: `mercadopago` npm package
- API usada: **Suscripciones (PreApproval)**: cobro mensual **automático** hasta que el cliente cancele. Ya NO se usa Checkout Pro (pago único): el cobro único obligaba a pagar a mano cada mes.
- Crear: `createSubscriptionLink()` en `src/lib/mercadopago.ts` crea el PreApproval en estado `pending` y devuelve el `init_point` donde el negocio autoriza el cobro. Lo usan el registro web y `POST /api/subscriptions/create`.
- Webhook (`/api/webhooks/mercadopago`): `subscription_preapproval` (autorizada → activa plan; cancelada → `pending_cancel`; pausada → `past_due`), `subscription_authorized_payment` (cada cobro mensual: aprobado extiende `subscription_end_date` = fecha de corte; rechazado → `past_due`) y `payment` (pagos sueltos / respaldo). La lógica de estados vive en `src/lib/subscriptions/apply.ts` y se prueba con `pnpm test:subscriptions`.
- En el panel de MercadoPago → Webhooks hay que marcar **Pagos** y **Planes y suscripciones**.
- Cancelar (`POST /api/subscriptions/cancel`): primero cancela el PreApproval en MercadoPago (deja de cobrar), luego marca `pending_cancel`; el plan sigue hasta `subscription_end_date` y el cron `/api/subscriptions/jobs/downgrade-expired` (header `x-cron-secret`) lo pasa a Free. Si no se cancela antes de la fecha de corte, se renueva. Cobros fallidos (`past_due`): 3 días de gracia antes de bajar a Free.
- Cambio de plan = nueva suscripción; al autorizarse, la anterior se cancela sola.
- Política visible al usuario: `/terms#suscripciones` (borrador, requiere revisión legal) y avisos en el registro y en Ajustes → Suscripción.
- Sandbox: las credenciales `APP_USR-` de esta app pertenecen a un **usuario de prueba** (vendedor); MercadoPago exige que el pagador también lo sea. Usa `MP_SANDBOX_PAYER_EMAIL` (correo `test_user_...@testuser.com` del comprador de prueba) para sobrescribir el correo del pagador solo en pruebas. En el checkout hay que entrar con el **comprador** de prueba, no con el vendedor ni con tu cuenta real. Tarjetas de prueba: panel → Tarjetas de prueba.
- Credenciales: app **Fidelitap** (no "Nuestra misión").

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
Un email = una tarjeta por negocio. Si el cliente ya tiene tarjeta, `activateCardAction` devuelve la existente (`alreadyHadCard: true`). Activar y recuperar tarjeta exigen un código de 6 dígitos enviado al correo (`src/lib/email-otp.ts`, OTP de Supabase Auth), tanto en la web como en la app — antes la recuperación entregaba el token del Wallet a cualquiera que supiera el email.

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
  - Auth Supabase anónimo (cliente) + email/password (dueño). Dueño solo puede iniciar sesión desde la app (el registro es web-only); un cliente puede registrarse en la app con o sin tener ya un código de tarjeta (`/auth/customer` → escanear QR o crear cuenta y agregar una tarjeta después)
  - Validación de correos temporales/desechables en todo registro (web negocio, activación pública, y ambos flujos de registro de cliente en la app) — ver `src/lib/validations/disposable-email-domains.ts`
  - Dueño: dashboard, crear/editar tarjetas con logo upload, multi-nivel de premios, scanner QR, categoría del negocio
  - Dueño Pro+: campañas push desde la app (`/api/mobile/campaigns`, misma lógica que la web en `src/lib/push/campaigns.ts`); fijar ubicación GPS del negocio desde Ajustes
  - Cliente: el registro (con o sin tarjeta) verifica el correo con un código (`ensureVerifiedEmail`); `/api/mobile/customer/register` y `/api/mobile/activate` exigen que el correo de la sesión esté confirmado y coincida con el del formulario
  - Cliente: recuperar cuenta en dispositivo nuevo con código OTP por correo (`/auth/customer` → recuperar; `POST /api/mobile/customer/claim` exige correo verificado — a diferencia de la recuperación web, que solo pide el email)
  - Cliente: lista de tarjetas con progreso de sellos (multi-nivel), botón Agregar a Wallet, pestaña **Tiendas cercanas** (directorio Pro+, filtro por categoría, ubicación actual o búsqueda por ciudad)
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
- MercadoPago: el PreApproval exige `payer_email`; en sandbox debe ser el de un usuario de prueba (si no: "Both payer and collector must be real or test users"). Ver `MP_SANDBOX_PAYER_EMAIL`.
- MercadoPago sandbox: hay que pagar logueado como el comprador de prueba; con el vendedor de prueba o tu cuenta real sale "Una de las partes con la que intentas hacer el pago es de prueba".
- `satori` (poster) exige `display: 'flex' | 'contents' | 'none'` explícito en cualquier `<div>` con más de un nodo hijo — incluido texto mixto con interpolación tipo `ACUMULA {n} SELLOS` (son 3 nodos de texto, no uno). Si falta, lanza "Expected `<div>` to have explicit display..." sin indicar cuál div. Usar un solo string interpolado (`` {`ACUMULA ${n} SELLOS`} ``) o declarar `display` explícito.
- `<img>` con `onLoad`/`onError` en un componente SSR puede quedarse en estado "cargando" para siempre: el navegador puede terminar de cargar la imagen (parseando el HTML inicial) antes de que React hidrate y adjunte el listener, y el evento `load` no se reemite. Mitigación: usar `ref={(el) => el?.complete && setLoading(false)}` además de `onLoad`/`onError` (ver `poster-editor.tsx`).

---

## Seguridad

- **Ninguna API key, token o credencial puede quedar expuesta en el frontend.**
- `server-only` en todas las libs con credenciales.
- CSP configurado en `next.config.mjs`.
- `.env.local` en `.gitignore` — nunca commitear.
- Credenciales de MercadoPago: solo en variables de entorno, nunca hardcodeadas.
