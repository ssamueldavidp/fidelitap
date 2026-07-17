# Fidelitap — Reinvención como App Móvil: Diseño

**Fecha:** 2026-06-22
**Estado:** Aprobado por usuario

---

## 1. Resumen

Fidelitap pasa de ser solo una plataforma web a tener una **app móvil nativa (iOS + Android)** como producto principal, manteniendo el panel web existente para quienes lo prefieran. El objetivo central es desbloquear **notificaciones push nativas reales** (incluyendo geo-proximidad) que el canal Web Push VAPID no puede ofrecer de forma confiable. La lógica de fidelización (sellos, premios, tarjetas, Wallet) se mantiene idéntica; cambia la capa de presentación y el canal de entrega de push.

El estilo visual y UX se inspira en [loyalzclub.com](https://loyalzclub.com): onboarding en pasos cortos, UI limpia, CTAs grandes, flujo claro de "únete → acumula → gana". La lógica de producto es propia de Fidelitap (no se adopta el modelo sin-app de Loyalz).

---

## 2. Decisiones clave

| Pregunta | Decisión |
|---|---|
| Tecnología | **Capacitor** (ya inicializado en el repo: `android/`, `ios/`, `capacitor.config.ts`) |
| Plataformas | iOS y Android en paralelo |
| Modelo UI | WebView que envuelve el Next.js existente — toda la UI del negocio es gratis |
| Audiencia | Una sola app, dos roles (Cliente y Negocio) — determinado por tipo de cuenta |
| Auth cliente | OTP por email vía Supabase Auth Magic Link (nuevo, web feature en Next.js) |
| Activación QR | Deep link a la app; fallback a web `/c/[slug]` si no está instalada |
| Wallet UX | Botón destacado post-activación, no automático (ya existe en web) |
| Push delivery | `@capacitor/push-notifications` (cliente) + Firebase Admin SDK (servidor) → APNs/FCM |
| Push gate | Exclusivo Plan Pro y Premium |
| Geo-push | Client-side geofencing via `@capacitor-community/background-geolocation` (sin tracking al servidor) |
| Panel web | Se mantiene — es el mismo código que usa la app (WebView) |
| Mecánicas | Solo sellos/estampas en esta versión |

---

## 3. Arquitectura general

```
┌─────────────────────────────────────┐
│   App Móvil (React Native + Expo)   │
│  ┌──────────────┬───────────────┐   │
│  │ Rol Cliente  │ Rol Negocio   │   │
│  │ (OTP email)  │ (cuenta web)  │   │
│  └──────────────┴───────────────┘   │
└────────────────┬────────────────────┘
                 │ HTTPS / Supabase JS client
        ┌────────┴────────┐
        │                 │
┌───────▼──────┐  ┌───────▼──────────────┐
│ Panel Web    │  │ Backend              │
│ Next.js      │  │ Next.js API Routes   │
│ (sin cambios)│  │ + Supabase (DB, Auth)│
└──────────────┘  └───────┬──────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
      ┌───────▼──┐ ┌──────▼──┐ ┌────▼──────┐
      │Expo Push │ │ Apple   │ │ Google    │
      │API       │ │ Wallet  │ │ Wallet    │
      │→APNs/FCM │ │(existente│ │(existente)│
      └──────────┘ └─────────┘ └───────────┘
```

### Lo que se reutiliza sin cambios
- Supabase (DB, Auth, Storage, RLS)
- `lib/wallet/apple.ts` y `google.ts`
- Lógica de sellos: `addStampAction`, cooldown, `plan-limits.ts`
- Emails transaccionales (Resend)
- API de póster: `/api/poster/[cardId]` (satori + resvg, server-side)
- MercadoPago webhook → activa plan
- Panel web del negocio (todas las rutas `(dashboard)/`)

### Lo nuevo a construir
- App React Native/Expo (una sola app, dos roles)
- Auth OTP para clientes (Supabase Magic Link)
- Registro de `ExpoPushToken` por dispositivo → tabla `device_tokens`
- Expo Push Service integration (server-side y client-side)
- Geofencing client-side con `expo-location`
- QR persistente del cliente (renderiza el `unique_code` existente como imagen QR)
- Deep links `fidelitap://` + Universal Links / App Links
- Todas las pantallas del negocio en React Native nativo
- Migración: deprecar `push_subscriptions` (Web Push VAPID), reemplazar por `device_tokens`; actualizar `lib/push/send.ts` + `lib/push/eligibility.ts` para Expo Push API; actualizar panel de campañas del dashboard web para enviar vía Expo Push (no VAPID)

---

## 4. Roles y navegación

### Cómo se determina el rol
Al iniciar sesión, el tipo de cuenta determina el rol:
- **Cuenta de negocio** (email + password, existente en Supabase Auth) → rol Negocio
- **Cuenta de cliente** (OTP por email, nueva) → rol Cliente

Una persona puede tener ambas cuentas con emails distintos; no hay switch de rol en-sesión.

### Tabs — Rol Cliente
| Tab | Contenido |
|---|---|
| Inicio | Tarjetas activas con progreso de sellos (card list) |
| Tarjetas | Vista de todas las tarjetas + historial |
| Avisos | Historial de notificaciones push recibidas |
| Perfil | Nombre, email, ajustes de notificaciones y ubicación |

### Tabs — Rol Negocio
| Tab | Contenido |
|---|---|
| Scanner | Cámara QR abierta por defecto — caso de uso principal |
| Tarjetas | Crear/editar tarjetas (paridad con dashboard web) |
| Clientes | Lista y búsqueda de clientes, historial de visitas |
| Póster | Editor y descarga de póster (PNG/PDF) |
| Más | Ajustes, Suscripción, Campañas push, Gerentes, Logout |

---

## 5. Flujo del cliente

1. **Escanea QR del local** (flyer físico en el negocio)
   - Si tiene la app → deep link `fidelitap://c/[slug]` abre la app directamente
   - Si no tiene la app → cae a `https://[dominio]/c/[slug]` (web actual) con banner de descarga

2. **Primera vez en la app: OTP**
   - Ingresa su email → Supabase envía código de 6 dígitos → cliente verifica → sesión activa
   - Sin password; la identidad queda vinculada al email

3. **Activación de tarjeta**
   - Mismo formulario actual: nombre, teléfono (opcional), consentimiento Ley 1581 (obligatorio), marketing (opcional)
   - Se crea `customer_cards` con `unique_code` (HMAC, ya existe)

4. **Pantalla de éxito (post-activación)**
   - Botón grande "Agregar a Apple Wallet" / "Agregar a Google Wallet"
   - Solicitud de permiso push (si Pro+): "¿Recibir notificaciones de [Negocio]?"
   - Solicitud de permiso de ubicación (si Pro+): "¿Avisarte cuando estés cerca del local?"

5. **Detalle de tarjeta (acceso recurrente)**
   - Progreso visual de sellos (ej. ●●●●●○○○○○ 5/10)
   - **QR persistente** que codifica el `unique_code` — el negocio lo escanea para sumar sellos
   - Botón "Ver en Wallet" (si ya fue agregada)
   - Historial de visitas

6. **Push recibido** (Pro+)
   - Geo, progreso, premio completo, re-engagement, campaña del negocio
   - Tap en push → deep link a `fidelitap://card/[customerCardId]`

---

## 6. Flujo del negocio (app móvil)

Misma cuenta que el panel web; login con email + password existente.

### Scanner (pantalla principal)
- Cámara nativa abierta al entrar al tab
- Lee QR del cliente (codifica `unique_code`)
- Llama `addStampAction` (misma lógica server-side existente)
- Dispara en paralelo: push al cliente, actualización Wallet, email si completa
- Feedback visual inmediato: sellos actuales del cliente, si completó tarjeta

### Tarjetas
- Crear nueva tarjeta: nombre, sellos requeridos, umbrales de push, logo, imagen de fondo, colores
- Editar tarjeta existente con preview en vivo
- Paridad total con `(dashboard)/cards`

### Clientes
- Lista con buscador (nombre, email, teléfono)
- Detalle: historial de visitas, sellos, estado (activo/completo/inactivo)
- Paridad total con `(dashboard)/customers`

### Póster
- Editor nativo (campos e imagen preview); el render PNG/PDF sigue vía `/api/poster/[cardId]`
- Descarga o comparte directamente desde el móvil

### Más
- **Ajustes:** nombre del negocio, logo, ubicación (lat/lng + radio para geo-push Pro+)
- **Suscripción:** planes y pago vía MercadoPago Checkout Pro (abre browser externo)
- **Campañas push** (Pro+): redactar + enviar inmediato o programado a toda la base o segmento
- **Gerentes:** crear cuentas secundarias para staff (paridad con `(dashboard)/settings`)

---

## 7. Notificaciones push — Arquitectura

### Stack
```
App (Expo) → registra ExpoPushToken al login
           → guarda en device_tokens (Supabase)

Trigger server-side → llama Expo Push API (único endpoint)
                    → Expo enruta a APNs (iOS) o FCM (Android)
```

### 5 Triggers (todos exclusivos Pro+)

| Trigger | Origen | Copy ejemplo |
|---|---|---|
| Geo-proximidad | Client-side (geofence OS) | "📍 Estás cerca de [Negocio]. Te falta X sello — ¡visítanos!" |
| Progreso de sellos | Server (post-addStamp, umbral configurable) | "¡Llevas 8/10 sellos en [Negocio]. ¡Ya casi!" |
| Premio completado | Server (post-addStamp, isComplete) | "¡Ganaste! Muestra tu tarjeta en caja para reclamar tu [premio]." |
| Re-engagement 14d | Cron server (existente, nueva entrega) | "¿Hace tiempo que no pasas? Te quedan X sellos para tu premio." |
| Campaña manual | Dashboard web o app del negocio | Texto libre del negocio |

### Geo-push en detalle (client-side, sin tracking)
1. Negocio Pro configura lat/lng + radio (default 200m) en Ajustes de la app
2. Al activar una tarjeta, la app descarga lat/lng del negocio y llama `expo-location → startGeofencingAsync`
3. El OS del dispositivo monitorea el geofence en background
4. Al entrar al radio → **notificación local** (no pasa por servidor) con sellos faltantes actuales
5. Privacidad: la ubicación del cliente nunca sale del dispositivo para este trigger

---

## 8. Cambios al modelo de datos

### Tabla nueva: `device_tokens`
```sql
CREATE TABLE device_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expo_token  text NOT NULL,
  platform    text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, expo_token)
);
```

### Tabla existente: `businesses` (columnas nuevas)
```sql
ALTER TABLE businesses
  ADD COLUMN lat            double precision,
  ADD COLUMN lng            double precision,
  ADD COLUMN geo_radius_m   integer NOT NULL DEFAULT 200;
```

### Tabla existente: `customers` (columna nueva)
```sql
ALTER TABLE customers
  ADD COLUMN auth_user_id uuid REFERENCES auth.users(id);
```
Vincula la sesión OTP móvil (Supabase Auth user) con la fila de cliente existente, buscada por email al primer login.

### Sin cambios
- `loyalty_cards` — `slug` ya sirve de target del deep link
- `customer_cards` — `unique_code` ya existe para el QR del cliente
- `push_subscriptions` — **se depreca**; reemplazada por `device_tokens`

### Deep links registrados
| Scheme | Destino |
|---|---|
| `fidelitap://c/[slug]` | Activar tarjeta (desde QR del local) |
| `fidelitap://card/[customerCardId]` | Abrir detalle de tarjeta (desde push) |
| `https://[dominio]/c/[slug]` | Universal Link / App Link — fallback web |

---

## 9. Referencia visual / estilo

Inspiración: **loyalzclub.com** (limpieza, pasos cortos, CTAs grandes) al estilo de marca **Fidelitap**.
- Onboarding del negocio: 4 pasos (Regístrate → Crea tu tarjeta → Lanza tu póster → Suma miembros)
- UI del cliente: card con progreso de sellos prominente, QR centrado, botón Wallet bien visible
- Colores y tipografía: los definidos en el `design_config` de la tarjeta + brand Fidelitap

---

## 10. Fuera de alcance (esta versión)

- Mecánicas adicionales: cashback, gift cards, membresías, descuentos, cupones (solo sellos)
- Analytics dashboard con métricas avanzadas (retención, ticket promedio, top clientes)
- Modo offline para el scanner del negocio
- Integraciones con POS/CRM
- Switch de rol dentro de la misma sesión

---

## 11. Sub-proyectos sugeridos para planificación

Dada la magnitud, se recomienda planificar e implementar en este orden:

1. **App móvil — estructura base** (Expo config, navegación por rol, auth OTP cliente + auth negocio)
2. **Flujo cliente** (activación, card list, QR persistente, Wallet add)
3. **Scanner nativo del negocio** (cámara, addStamp, feedback)
4. **Push nativo** (device_tokens, Expo Push API, 4 triggers server-side)
5. **Geo-push** (configuración de ubicación en ajustes, geofencing client-side)
6. **Paridad negocio** (Tarjetas, Clientes, Póster, Ajustes, Suscripción, Campañas en RN)
7. **Migración** (deprecar Web Push VAPID: actualizar `lib/push/send.ts` y `lib/push/eligibility.ts` para usar Expo Push API; actualizar panel de campañas web existente para que también envíe vía Expo Push; limpiar tabla `push_subscriptions` y VAPID keys)
