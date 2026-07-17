# FideliTap Mobile v2 — Design Spec

## Scope

Three independent sub-projects, built in order. Each is shippable on its own.

| # | Sub-proyecto | Plan | Depende de |
|---|---|---|---|
| 1 | Tarjetas avanzadas | Todos | — |
| 2 | Push geofencing | Pro+ | Sub-proyecto 1 (timezone en businesses) |
| 3 | Wallet live updates | Basic+ | — (paralelo a 1) |

---

## Sub-proyecto 1 — Tarjetas avanzadas

### Qué construye

El dueño puede diseñar tarjetas con: logo propio, fondo (color/gradiente/imagen), tipografía, multi-nivel de premios (toggle), vigencia (toggle), y ve el resultado en un preview en vivo mientras edita.

### DB changes

**Nueva tabla `card_rewards`** (para multi-nivel):

```sql
create table public.card_rewards (
  id              uuid primary key default gen_random_uuid(),
  loyalty_card_id uuid references public.loyalty_cards(id) on delete cascade not null,
  stamps_required int not null check (stamps_required > 0),
  reward_label    text not null,
  color           text not null default '#00C896',
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
```

RLS: solo el dueño del negocio puede leer/escribir sus propios rewards (join a `loyalty_cards → businesses → owner_id`).

**Nuevas columnas en `loyalty_cards`**:

```sql
alter table public.loyalty_cards
  add column if not exists logo_url              text,
  add column if not exists expires_at            timestamptz,
  add column if not exists max_uses_per_customer int;
```

**Extensión del `design_config` jsonb** (no requiere migración — es jsonb):

```jsonc
{
  "color":         "#00C896",    // color acento del texto/sellos
  "bg_type":       "solid|gradient|image",
  "bg_value":      "#0f172a",    // color hex si bg_type=solid, o "from,to" si gradient
  "bg_image_url":  null,         // URL Supabase Storage si bg_type=image
  "stamp_icon":    "☕",
  "font":          "default|rounded|mono|serif",
  "multi_rewards": true          // si false → se usa solo la config base (stamps_required en loyalty_cards)
}
```

### API changes

**`GET /api/mobile/cards`** — incluir `card_rewards` en el select cuando existan:

```typescript
.select('*, card_rewards(id, stamps_required, reward_label, color, sort_order)')
.order('sort_order', { referencedTable: 'card_rewards', ascending: true })
```

**`POST /api/mobile/cards`** — aceptar `rewards[]` en el body; insertarlos en `card_rewards` tras crear la tarjeta.

**`PATCH /api/mobile/cards/[id]`** — aceptar `rewards[]`; hacer upsert en `card_rewards` (delete-then-insert dentro de una transacción de servicio).

**`POST /api/mobile/upload/logo`** — nuevo endpoint:
- Recibe multipart `file` (PNG/JPG, max 2 MB)
- Sube a Supabase Storage bucket `card-logos/{business_id}/{card_id}.{ext}`
- Devuelve `{ public_url: string }`
- Bucket policy: public read, auth write (solo el dueño del negocio)

### Flutter changes

**`card_form_sheet.dart`** — rediseño completo del bottom sheet:

1. **Sección fondo**: tres tabs (Color / Gradiente / Imagen). Color muestra paleta de 8 swatches + picker personalizado. Imagen permite elegir de galería o cámara → llama `/api/mobile/upload/logo`.
2. **Logo**: widget `ImagePicker` → upload → preview circular en la tarjeta.
3. **Ícono del sello**: grid de emojis existente (sin cambios).
4. **Toggle multi-nivel**: cuando activo, muestra lista de niveles (`stamps_required` + `reward_label` + color). Botón "+ Agregar nivel". Mínimo 1 nivel, máximo 5.
5. **Toggle vigencia**: cuando activo, muestra `DatePicker` para `expires_at`.
6. **Preview en vivo**: `CardPreviewWidget` sticky en la parte inferior del sheet que reacciona a cada cambio de estado.

**Nuevo widget `CardPreviewWidget`**:
- Acepta todos los parámetros del form como props
- Renderiza la tarjeta idéntica a como la ve el cliente
- Muestra barras de progreso de multi-nivel si está activo
- Se actualiza instantáneamente con `StatefulWidget` + `setState`

**`card_list_screen.dart`** — mostrar badge de vigencia si `expires_at` está próximo (< 7 días).

**`card_list_screen.dart` (cliente)** — si multi-nivel activo, mostrar barras de progreso por nivel con colores configurados.

### Wallet pass changes

El `.pkpass` (Apple) y el loyalty object (Google) deben reflejar multi-nivel:

- Apple: usar el campo `auxiliaryFields` para mostrar el próximo premio. Si multi-nivel: "Próximo: [reward_label] en [N] sellos más".
- Google: actualizar `loyaltyPoints.label` al reward del nivel actual.

---

## Sub-proyecto 2 — Push geofencing

### Qué construye

Cuando un cliente con la app pasa cerca de un negocio Pro+, recibe una notificación push que lo lleva directo a esa tarjeta. El dueño configura radio y horario silencioso. No se envían notificaciones entre las 10 PM y las 6 AM (hora local del negocio).

### DB changes

**Nuevas columnas en `businesses`**:

```sql
alter table public.businesses
  add column if not exists timezone               text not null default 'America/Bogota',
  add column if not exists geofence_enabled       boolean not null default false,
  add column if not exists geofence_radius_m      int not null default 300
                             check (geofence_radius_m in (100, 300, 500)),
  add column if not exists geofence_message       text,
  add column if not exists geofence_cooldown_h    int not null default 24,
  add column if not exists quiet_hours_start      int not null default 22
                             check (quiet_hours_start between 0 and 23),
  add column if not exists quiet_hours_end        int not null default 6
                             check (quiet_hours_end between 0 and 23);
```

`geofence_cooldown_h`: horas mínimas entre notificaciones al mismo cliente del mismo negocio. La tabla `geofence_notifications` ya existe y registra `sent_at` — usarla para el check.

`quiet_hours_start` / `quiet_hours_end`: hora entera en zona `timezone` del negocio. El intervalo puede cruzar medianoche (ej. 22 → 6).

### Firebase setup

- Proyecto Firebase nuevo: `fidelitap-prod`
- `google-services.json` → `mobile/android/app/`
- `GoogleService-Info.plist` → `mobile/ios/Runner/`
- `firebase_messaging` añadir a `mobile/pubspec.yaml`
- `firebase_core` añadir a `mobile/pubspec.yaml`
- `FirebaseMessaging.instance.getToken()` en `main.dart` → POST a `/api/mobile/device-token` para guardar en `device_tokens`

### API changes

**`POST /api/mobile/device-token`** — nuevo:
- Guarda o actualiza el FCM token del usuario autenticado en `device_tokens`
- Upsert por `(user_id, platform)`

**`POST /api/mobile/geofence/notify`** — nuevo:
```typescript
// Body: { business_id: string }
// Verifica (en orden):
// 1. business.plan in ['pro','premium']
// 2. business.geofence_enabled === true
// 3. Hora local actual NOT dentro de quiet_hours_start..quiet_hours_end (usando business.timezone)
// 4. No hay geofence_notification donde business_id = X AND customer_card_id IN
//    (SELECT id FROM customer_cards WHERE linked_auth_user_id = user.id)
//    en las últimas geofence_cooldown_h horas
//    (cooldown es por usuario por negocio, no por tarjeta individual)
// 5. Envía FCM via firebase-admin a todos los device_tokens del user
// 6. Inserta en geofence_notifications (usar la customer_card más reciente del usuario para ese negocio)
```

Dependencia: `firebase-admin` en `package.json`.

**`PATCH /api/mobile/settings`** — extender para incluir los nuevos campos de geofence + timezone.

### Flutter changes

**`geofence_manager.dart`** — implementar con el paquete `geofencer_flutter` (o `flutter_background_geolocation` si se prefiere más control):

```dart
// Al login del dueño: registrar geofences de sus negocios
// Al login del cliente: registrar geofences de los negocios donde tiene tarjetas activas
// On enter: POST /api/mobile/geofence/notify con business_id
```

**`owner_settings_screen.dart`** — nueva sección "Notificaciones de proximidad":
- Toggle `geofence_enabled` (solo visible si plan Pro+, sino muestra badge "Plan Pro")
- Selector de radio: 3 chips (100m / 300m / 500m), default 300m
- Campo texto opcional para mensaje personalizado
- Sección "🌙 Sin notificaciones de noche": dos `TimePickerDialog` tap-to-edit (Desde / Hasta), default 10 PM → 6 AM. Sin selector de días — aplica todos los días.
- Selector de cooldown: dropdown (1h / 6h / 12h / 24h)

**Deep link**: el payload FCM incluye `{ card_id: string }`. En `main.dart`, `FirebaseMessaging.onMessageOpenedApp` navega a `CardDetailScreen(cardId: payload['card_id'])`.

### Quiet hours — lógica exacta

```typescript
function isQuietHours(business: Business): boolean {
  const now = new Date()
  const localHour = parseInt(
    new Intl.DateTimeFormat('en', {
      hour: 'numeric', hour12: false,
      timeZone: business.timezone
    }).format(now)
  )
  const { quiet_hours_start: start, quiet_hours_end: end } = business
  // Intervalo cruza medianoche: e.g. start=22, end=6 → quiet si hour >= 22 OR hour < 6
  if (start > end) return localHour >= start || localHour < end
  // Intervalo normal: start=8, end=18 → quiet si hour >= 8 AND hour < 18
  return localHour >= start && localHour < end
}
```

---

## Sub-proyecto 3 — Wallet live updates

### Qué construye

Cuando se agrega un sello, el pase en Apple Wallet y Google Wallet se actualiza automáticamente sin que el cliente abra la app.

### Estado actual — ya implementado en su mayoría

`src/lib/scanner/add-stamp.ts` ya llama en `Promise.all`:
- `sendApnsPush(pushTokens)` — push silencioso a Apple Wallet via APNs (`src/lib/wallet/apns.ts`)
- `updateGoogleWalletStamps(cc.id, card.id, currentStamps)` — PATCH al loyalty object (`src/lib/wallet/google.ts`)

**El trabajo restante en este sub-proyecto es:**

1. **Gate de plan** — `add-stamp.ts` actualmente llama los updates sin verificar el plan. Añadir:

```typescript
// En add-stamp.ts, antes del Promise.all de wallet updates:
const skipWalletUpdate = card.business.plan === 'free'
await Promise.all([
  skipWalletUpdate ? Promise.resolve() : (pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve()),
  skipWalletUpdate ? Promise.resolve() : updateGoogleWalletStamps(cc.id, card.id, currentStamps),
])
```

2. **Multi-nivel label** — cuando Sub-proyecto 1 esté completo, `updateGoogleWalletStamps` debe recibir el `nextRewardLabel` del nivel siguiente y usarlo como `loyaltyPoints.label` en lugar de `"${n} sellos"`. La firma cambiará a:

```typescript
updateGoogleWalletStamps(customerCardId, loyaltyCardId, currentStamps, nextRewardLabel?: string)
```

3. **Apple pass multi-nivel** — `generateApplePass` en `src/lib/wallet/apple.ts` debe incluir el próximo premio en `auxiliaryFields` cuando `card_rewards` existan (ver Sub-proyecto 1 Wallet pass changes).

### Condición de plan

Plan `free`: no live updates — el cliente debe re-abrir la app para ver los sellos.
Plan `basic`+: APNs + Google Wallet PATCH en cada sello.

---

## Orden de implementación recomendado

```
Sub-proyecto 1 (Tarjetas avanzadas)
  → Migración DB (card_rewards + columnas loyalty_cards)
  → API: upload logo, cards CRUD con rewards
  → Flutter: CardPreviewWidget + card_form_sheet rediseño
  → Wallet pass multi-nivel

Sub-proyecto 3 (Wallet live) ← puede arrancar en paralelo con Sub-proyecto 1
  → patchGoogleWalletObject
  → Conectar trigger en add-stamp
  → Gate de plan

Sub-proyecto 2 (Geofencing) ← después de 1 (necesita timezone en businesses)
  → Firebase project setup
  → Migración DB (columnas businesses)
  → API: device-token, geofence/notify
  → Flutter: geofence_manager real + settings UI
```

---

## Lo que ya existe (no re-implementar)

- `device_tokens` table con RLS
- `geofence_notifications` table + índice de cooldown
- `lat`/`lng`/`address` en `businesses`
- `stamp_cooldown_seconds` en `businesses`
- `design_config` jsonb en `loyalty_cards` (extender, no reemplazar)
- APNs infrastructure para Apple Wallet push updates
- `wallet_auth_token` en `customer_cards`
- `/api/wallet/apple/[id]` y `/api/wallet/google/[id]`
