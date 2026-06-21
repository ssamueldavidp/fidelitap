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
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | (pendiente) Web Push |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── (auth)/           # login, register
│   ├── (dashboard)/      # cards, customers, poster, scanner, settings
│   ├── api/              # poster, subscriptions, wallet, webhooks
│   ├── c/[slug]/         # página pública de activación de tarjeta
│   └── wallet/           # landing wallet del cliente
├── components/
│   ├── cards/            # card-editor, card-widget, wallet-preview
│   ├── dashboard/        # sidebar, logout-button
│   └── push/             # (pendiente) push permission UI
├── lib/
│   ├── supabase/         # server.ts, admin.ts, service.ts (todos server-only)
│   ├── mercadopago.ts    # server-only; mpPreference, isSandbox(), getCheckoutUrl()
│   ├── storage-url.ts    # resolveStorageUrl() — reescribe localhost:54321 → ngrok
│   ├── wallet/           # apple.ts, google.ts, apns.ts, hmac.ts
│   ├── email/            # send-business-welcome, send-customer-welcome, send-card-complete
│   ├── poster/           # template.tsx (satori JSX)
│   ├── plan-limits.ts    # límites por plan
│   └── push/             # (pendiente) vapid.ts, send.ts
└── types/
    └── database.ts       # generado con `pnpm supabase gen types typescript --local`
                          # NUNCA editar a mano — regenerar tras cada migración
```

---

## Planes y límites

| Plan | Precio COP | maxCustomers | maxCards |
|---|---|---|---|
| free | 0 | 100 | 1 |
| basic | 29.900 | 500 | 3 |
| pro | 59.900 | 2.000 | 10 |
| premium | 99.900 | ilimitado | ilimitado |

El plan se activa vía webhook de MercadoPago tras pago exitoso. `external_reference` format: `${businessId}:${planSlug}`.

**Funciones exclusivas Pro/Premium:** notificaciones Web Push (pendiente de implementar).

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
4. (Pendiente) Web Push notification al cliente

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

## Pendiente de implementar

- [ ] **Web Push Notifications** (Pro/Premium)
  - Trigger por sello: "¡Te faltan X sellos para tu premio!"
  - Re-engagement: si no visita en N días
  - Campañas del negocio: el negocio envía push manual (descuentos, mensajes personalizados)
  - UI: suscripción en success-screen de activación + panel de campañas en dashboard
  - Requiere: VAPID keys en .env.local, Service Worker en public/sw.js, tabla push_subscriptions en DB

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

---

## Seguridad

- **Ninguna API key, token o credencial puede quedar expuesta en el frontend.**
- `server-only` en todas las libs con credenciales.
- CSP configurado en `next.config.mjs`.
- `.env.local` en `.gitignore` — nunca commitear.
- Credenciales de MercadoPago: solo en variables de entorno, nunca hardcodeadas.
