# FideliTap Mobile App (Android + iOS) — Diseño

**Fecha:** 2026-06-29
**Estado:** Aprobado

---

## 1. Visión General

App móvil nativa (Flutter, un solo codebase para Android e iOS) que complementa la web de FideliTap. Una sola app con dos modos según el rol del usuario autenticado (mismo Supabase Auth que la web):

- **Cliente**: ve su tarjeta de fidelización y sellos acumulados, recibe notificaciones push y recordatorios por geolocalización.
- **Dueño de negocio**: escanea QR de clientes con la cámara nativa, ve un dashboard básico, recibe notificaciones push de eventos del negocio.

**Disponibilidad por plan:**
- App básica (ver tarjeta, scanner, dashboard) → todos los planes.
- Push notifications, geofencing y recordatorios → exclusivos plan **Pro y superior**.

---

## 2. Sub-proyectos

### A — Fundación de la app móvil
Scaffold Flutter, auth contra Supabase, detección de rol, pantallas base (cliente: tarjeta/sellos; dueño: dashboard + lista clientes read-only).

### B — Scanner del dueño + push del dueño
Cámara nativa para escanear QR (suma sello / reclama premio). Push para el dueño: nuevo cliente activado, tarjeta completada, pago de suscripción fallido. El scanner es para todos los planes; las push de este bloque son Pro+.

### C — Geofencing + recordatorio al cliente
Requiere agregar lat/lng a `businesses`. Geofence nativo (Android Geofencing API / iOS CLRegion) por cada negocio del cliente, radio fijo 300m, cooldown de 1 aviso/día/negocio, mensaje "te faltan X sellos". Exclusivo Pro+.

---

## 3. Stack

| Capa | Tecnología |
|------|------------|
| Framework móvil | Flutter (consistente con el stack móvil ya usado en otros proyectos) |
| Auth | Supabase Auth (mismo backend que la web, `supabase_flutter`) |
| Push | Firebase Cloud Messaging (FCM) — unifica Android + iOS (APNs vía Firebase) |
| Geofencing | `geofence_service` (wrapper sobre Android Geofencing API / iOS region monitoring) + `geolocator` para permisos |
| QR Scanner | `mobile_scanner` (cámara nativa, sin dependencias de Google Play Services obligatorias) |
| Backend nuevo | Supabase Edge Function `geofence-checkin` (valida plan + cooldown + envía push), extensión de Edge Functions existentes para eventos del dueño |

---

## 4. Modelo de Datos (migraciones nuevas)

```sql
-- lat/lng del negocio, requerido para geofencing
alter table public.businesses
  add column latitude  double precision,
  add column longitude double precision;

-- tokens de dispositivo para push (un usuario puede tener varios dispositivos)
create table public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  fcm_token   text not null,
  platform    text check (platform in ('android','ios')) not null,
  created_at  timestamptz default now(),
  unique (user_id, fcm_token)
);

-- cooldown de recordatorios por geofence (1 por día por negocio/cliente)
create table public.geofence_notifications (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references public.customers(id) on delete cascade not null,
  business_id   uuid references public.businesses(id) on delete cascade not null,
  sent_at       timestamptz default now(),
  unique (customer_id, business_id, sent_at)
);
-- consulta de elegibilidad: max(sent_at) < now() - interval '1 day'
```

RLS: `device_tokens` solo accesible por su propio `user_id`. `geofence_notifications` solo escribible desde la Edge Function (service role).

---

## 5. Flujos clave

**Cliente ve tarjeta:** login → Supabase detecta rol `customer` → fetch `customer_cards` + `loyalty_cards` del negocio → UI de tarjeta con sellos (reusa diseño visual del card-widget web).

**Dueño escanea:** login → rol `business_owner` → tab Scanner → `mobile_scanner` lee QR del cliente → llama mismo endpoint que el scanner web (`/api/...`) vía Supabase client → suma sello o marca reclamo.

**Push del dueño (Pro+):** evento backend (nuevo cliente, tarjeta completa, pago fallido) → Edge Function existente verifica `subscription_status` y `plan in ('pro','...')` → envía FCM a los `device_tokens` del owner.

**Geofence + recordatorio (Pro+):** app registra geofences (lat/lng + radio 300m) de los negocios con tarjetas activas del cliente, solo si ese negocio es Pro+ → al entrar al radio, el OS despierta la app en background → llama Edge Function `geofence-checkin(customer_id, business_id)` → la función valida Pro+, revisa cooldown en `geofence_notifications`, si es elegible calcula sellos faltantes y envía push FCM "te faltan N sellos para tu premio en {negocio}" → inserta registro de cooldown.

---

## 6. Permisos y privacidad

- Ubicación: se solicita permiso "Always"/"siempre" solo si el cliente tiene al menos una tarjeta de un negocio Pro+. Si no, no se pide.
- Notificaciones: permiso estándar push al primer login.
- El cliente puede desactivar el geofencing por negocio individual desde ajustes de la app (toggle), sin perder la tarjeta.

---

## 7. Fuera de alcance (no en esta entrega)

- Publicación en App Store / Play Store (requiere cuenta Apple Developer + Firebase project del usuario).
- Radio de geofence configurable por negocio (fijo en 300m).
- Gestión de tarjetas/poster/settings desde la app del dueño (sigue siendo solo web).
