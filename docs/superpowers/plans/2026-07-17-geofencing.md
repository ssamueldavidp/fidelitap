# FideliTap — Sub-proyecto 2: Push Geofencing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un cliente con la app pasa cerca de un negocio Pro+, recibe una notificación push FCM que lo lleva directo a esa tarjeta. El dueño configura radio, mensaje y horario silencioso desde la app.

**Architecture:** DB migration agrega columnas de geofencing a `businesses`. El backend expone `POST /api/mobile/geofence/notify` que valida plan + geofence_enabled + quiet hours + cooldown y envía FCM via `firebase-admin`. La Flutter app usa el `GeofenceManager` existente (corregido) para detectar entrada a zonas y llamar el endpoint.

**Tech Stack:** Next.js 14 Route Handlers, Supabase (local Docker), firebase-admin npm, Flutter 3.x / Dart, geofence_service Flutter package (ya instalado).

---

## Lo que ya existe — NO re-implementar

- `device_tokens` y `geofence_notifications` tablas con RLS ✅
- `POST /api/mobile/device-token` y `DELETE /api/mobile/device-token` ✅
- `mobile/lib/geofence/geofence_repository.dart` — lee tarjetas del cliente ✅
- `mobile/lib/push/push_service.dart` — registra FCM token con shim (sin Firebase real) ✅
- `mobile/lib/core/notification_service.dart` — flutter_local_notifications inicializado ✅
- `geofence_service` en pubspec.yaml ✅
- `flutter_local_notifications` en pubspec.yaml ✅

---

## File Map

### Backend — nuevos archivos
| Archivo | Responsabilidad |
|---------|-----------------|
| `supabase/migrations/20260717000001_businesses_geofence_config.sql` | Columnas geofence en businesses |
| `src/app/api/mobile/geofence/notify/route.ts` | Verifica condiciones y envía FCM |
| `src/lib/push/fcm.ts` | Wrapper firebase-admin para envío FCM |

### Backend — archivos modificados
| Archivo | Cambio |
|---------|--------|
| `src/app/api/mobile/settings/route.ts` | GET + PATCH incluyen campos geofence |

### Flutter — archivos modificados
| Archivo | Cambio |
|---------|--------|
| `mobile/lib/geofence/geofence_manager.dart` | Endpoint correcto + radio dinámico |
| `mobile/lib/geofence/geofence_repository.dart` | BusinessGeoInfo incluye geofenceEnabled + geofenceRadiusM |
| `mobile/lib/owner/owner_settings_screen.dart` | Sección "Notificaciones de proximidad" |

---

## Task 1 — DB migration: columnas geofence en businesses

**Archivos:**
- Crear: `supabase/migrations/20260717000001_businesses_geofence_config.sql`

- [ ] **Paso 1: Crear archivo de migración**

```sql
-- supabase/migrations/20260717000001_businesses_geofence_config.sql

alter table public.businesses
  add column if not exists timezone              text not null default 'America/Bogota',
  add column if not exists geofence_enabled      boolean not null default false,
  add column if not exists geofence_radius_m     int not null default 300
                              check (geofence_radius_m in (100, 300, 500)),
  add column if not exists geofence_message      text,
  add column if not exists geofence_cooldown_h   int not null default 24,
  add column if not exists quiet_hours_start     int not null default 22
                              check (quiet_hours_start between 0 and 23),
  add column if not exists quiet_hours_end       int not null default 6
                              check (quiet_hours_end between 0 and 23);
```

- [ ] **Paso 2: Aplicar migración local**

```bash
cd /Users/samuelrodriguez/development/fidelitap
pnpm supabase db push --local
```

Resultado esperado: `Applied migration 20260717000001_businesses_geofence_config` sin errores.

- [ ] **Paso 3: Regenerar types**

```bash
pnpm supabase gen types typescript --local > src/types/database.ts
```

Luego re-agregar los custom types al final del archivo (están en git — se recuperan de `git show HEAD:src/types/database.ts | tail -50`):

```typescript
// Helpers para tablas individuales
export type Business = Database['public']['Tables']['businesses']['Row']
export type BusinessInsert = Database['public']['Tables']['businesses']['Insert']
export type BusinessUpdate = Database['public']['Tables']['businesses']['Update']

export type LoyaltyCard = Database['public']['Tables']['loyalty_cards']['Row']
export type LoyaltyCardInsert = Database['public']['Tables']['loyalty_cards']['Insert']

export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']

export type CustomerCard = Database['public']['Tables']['customer_cards']['Row']
export type CustomerCardInsert = Database['public']['Tables']['customer_cards']['Insert']

export type StampEvent = Database['public']['Tables']['stamp_events']['Row']
export type StampEventInsert = Database['public']['Tables']['stamp_events']['Insert']

export type DeviceRegistration = Database['public']['Tables']['device_registrations']['Row']

export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

export type PushSubscription = Database['public']['Tables']['push_subscriptions']['Row']
export type PushSubscriptionInsert = Database['public']['Tables']['push_subscriptions']['Insert']

export type PushCampaign = Database['public']['Tables']['push_campaigns']['Row']
export type PushCampaignInsert = Database['public']['Tables']['push_campaigns']['Insert']

export interface CardDesignConfig {
  color: string
  bg_type: 'solid' | 'gradient' | 'image'
  bg_value: string
  bg_image_url: string | null
  stamp_icon: string
  font: 'default' | 'rounded' | 'mono'
  style: 'clean' | 'modern' | 'luxury' | 'editorial' | 'minimal'
  bg_mode: 'light' | 'dark'
  logo_url: string | null
}

export type CardStyle = CardDesignConfig['style']

export type PlanSlug = 'free' | 'basic' | 'pro' | 'premium'
```

- [ ] **Paso 4: Commit**

```bash
git add supabase/migrations/20260717000001_businesses_geofence_config.sql src/types/database.ts
git commit -m "feat: add geofence config columns to businesses"
```

---

## Task 2 — Backend: FCM wrapper + POST /api/mobile/geofence/notify

**Archivos:**
- Crear: `src/lib/push/fcm.ts`
- Crear: `src/app/api/mobile/geofence/notify/route.ts`

**Dependencia:** agregar `firebase-admin` a package.json.

- [ ] **Paso 1: Instalar firebase-admin**

```bash
cd /Users/samuelrodriguez/development/fidelitap
pnpm add firebase-admin
```

- [ ] **Paso 2: Crear `src/lib/push/fcm.ts`**

```typescript
import 'server-only'

// firebase-admin se inicializa solo si las credenciales están presentes en env.
// Sin FIREBASE_SERVICE_ACCOUNT_JSON, todas las llamadas son no-op.

let _app: import('firebase-admin/app').App | null = null

function getApp() {
  if (_app) return _app
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!json) return null
  try {
    const { initializeApp, cert } = require('firebase-admin/app')
    _app = initializeApp({ credential: cert(JSON.parse(json)) }, 'fidelitap')
    return _app
  } catch {
    return null
  }
}

export async function sendFcmNotification({
  tokens,
  title,
  body,
  data,
}: {
  tokens: string[]
  title: string
  body: string
  data?: Record<string, string>
}): Promise<void> {
  const app = getApp()
  if (!app || tokens.length === 0) return

  const { getMessaging } = require('firebase-admin/messaging')
  const messaging = getMessaging(app)

  await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: data ?? {},
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  })
}
```

- [ ] **Paso 3: Crear `src/app/api/mobile/geofence/notify/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { sendFcmNotification } from '@/lib/push/fcm'

function isQuietHours(business: {
  timezone: string
  quiet_hours_start: number
  quiet_hours_end: number
}): boolean {
  const now = new Date()
  const localHour = parseInt(
    new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      hour12: false,
      timeZone: business.timezone,
    }).format(now)
  )
  const { quiet_hours_start: start, quiet_hours_end: end } = business
  if (start > end) return localHour >= start || localHour < end
  return localHour >= start && localHour < end
}

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { business_id } = await req.json()
  if (!business_id) return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })

  const db = createServiceClient()

  // 1. Verify business plan + geofence config
  const { data: biz, error: bizErr } = await db
    .from('businesses')
    .select('plan, geofence_enabled, geofence_message, geofence_cooldown_h, timezone, quiet_hours_start, quiet_hours_end')
    .eq('id', business_id)
    .single()

  if (bizErr || !biz) return NextResponse.json({ skipped: 'not_found' })
  if (!['pro', 'premium'].includes(biz.plan)) return NextResponse.json({ skipped: 'plan' })
  if (!biz.geofence_enabled) return NextResponse.json({ skipped: 'disabled' })
  if (isQuietHours(biz as { timezone: string; quiet_hours_start: number; quiet_hours_end: number })) {
    return NextResponse.json({ skipped: 'quiet_hours' })
  }

  // 2. Find customer_card for this user + business
  const { data: cc } = await db
    .from('customer_cards')
    .select('id, loyalty_cards(businesses(id))')
    .eq('linked_auth_user_id', user.id)
    .eq('loyalty_cards.businesses.id', business_id)
    .maybeSingle()

  if (!cc) return NextResponse.json({ skipped: 'no_card' })

  // 3. Check cooldown
  const cooldownMs = (biz.geofence_cooldown_h ?? 24) * 3600 * 1000
  const since = new Date(Date.now() - cooldownMs).toISOString()
  const { count } = await db
    .from('geofence_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('customer_card_id', cc.id)
    .eq('business_id', business_id)
    .gte('sent_at', since)

  if ((count ?? 0) > 0) return NextResponse.json({ skipped: 'cooldown' })

  // 4. Get FCM tokens for this user
  const { data: tokens } = await db
    .from('device_tokens')
    .select('fcm_token')
    .eq('user_id', user.id)

  const fcmTokens = (tokens ?? []).map((t) => t.fcm_token)

  // 5. Send notification
  const notifBody = biz.geofence_message ?? '¡Tienes una tarjeta activa aquí! Acumula sellos.'
  await sendFcmNotification({
    tokens: fcmTokens,
    title: '¡Estás cerca! 📍',
    body: notifBody,
    data: { business_id },
  })

  // 6. Record notification
  await db
    .from('geofence_notifications')
    .insert({ customer_card_id: cc.id, business_id })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Paso 4: Verificar lint**

```bash
cd /Users/samuelrodriguez/development/fidelitap
pnpm lint 2>&1 | grep -E "error|Error" | head -20
```

Sin errores nuevos.

- [ ] **Paso 5: Commit**

```bash
git add src/lib/push/fcm.ts src/app/api/mobile/geofence/ package.json pnpm-lock.yaml
git commit -m "feat: FCM wrapper + geofence/notify API route"
```

---

## Task 3 — API: extender GET+PATCH /api/mobile/settings con campos geofence

**Archivos:**
- Modificar: `src/app/api/mobile/settings/route.ts`

El archivo actual existe. Reemplazar con versión extendida:

- [ ] **Paso 1: Reemplazar `src/app/api/mobile/settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

const VALID_COOLDOWNS = [0, 60, 300, 900, 3600, 86400]
const VALID_RADII = [100, 300, 500]

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('businesses')
    .select(`
      name, address, latitude, longitude, stamp_cooldown_seconds, plan, email,
      timezone, geofence_enabled, geofence_radius_m, geofence_message,
      geofence_cooldown_h, quiet_hours_start, quiet_hours_end
    `)
    .eq('owner_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const {
    name, address, latitude, longitude, stamp_cooldown_seconds,
    timezone, geofence_enabled, geofence_radius_m, geofence_message,
    geofence_cooldown_h, quiet_hours_start, quiet_hours_end,
  } = body

  const db = createServiceClient()

  // Verify plan for geofence fields
  const { data: biz } = await db
    .from('businesses')
    .select('plan')
    .eq('owner_id', user.id)
    .single()

  const isPro = ['pro', 'premium'].includes(biz?.plan ?? '')

  const update: Record<string, unknown> = {}
  if (name?.trim()) update.name = name.trim()
  if (address !== undefined) update.address = address || null
  if (latitude !== undefined) update.latitude = latitude ? Number(latitude) : null
  if (longitude !== undefined) update.longitude = longitude ? Number(longitude) : null
  if (stamp_cooldown_seconds !== undefined && VALID_COOLDOWNS.includes(Number(stamp_cooldown_seconds))) {
    update.stamp_cooldown_seconds = Number(stamp_cooldown_seconds)
  }

  // Geofence fields — only for Pro/Premium
  if (isPro) {
    if (timezone !== undefined) update.timezone = String(timezone)
    if (geofence_enabled !== undefined) update.geofence_enabled = Boolean(geofence_enabled)
    if (geofence_radius_m !== undefined && VALID_RADII.includes(Number(geofence_radius_m))) {
      update.geofence_radius_m = Number(geofence_radius_m)
    }
    if (geofence_message !== undefined) update.geofence_message = geofence_message || null
    if (geofence_cooldown_h !== undefined && Number(geofence_cooldown_h) > 0) {
      update.geofence_cooldown_h = Number(geofence_cooldown_h)
    }
    if (quiet_hours_start !== undefined) {
      const h = Number(quiet_hours_start)
      if (h >= 0 && h <= 23) update.quiet_hours_start = h
    }
    if (quiet_hours_end !== undefined) {
      const h = Number(quiet_hours_end)
      if (h >= 0 && h <= 23) update.quiet_hours_end = h
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from('businesses') as any)
    .update(update)
    .eq('owner_id', user.id)
    .select(`
      name, address, latitude, longitude, stamp_cooldown_seconds,
      timezone, geofence_enabled, geofence_radius_m, geofence_message,
      geofence_cooldown_h, quiet_hours_start, quiet_hours_end
    `)
    .single()

  if (error) return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Paso 2: Verificar lint**

```bash
pnpm lint 2>&1 | grep -E "error|Error" | head -20
```

- [ ] **Paso 3: Commit**

```bash
git add src/app/api/mobile/settings/route.ts
git commit -m "feat: extend settings API with geofence fields (Pro+ gated)"
```

---

## Task 4 — Flutter: corregir GeofenceManager + GeofenceRepository

**Problema actual:**
- `geofence_manager.dart` llama `postFunction('geofence-checkin', ...)` — endpoint incorrecto. Debe llamar `post('/api/mobile/geofence/notify', { 'business_id': ... })`.
- El radio de geofence está hardcodeado a 300m. Debe usar `b.geofenceRadiusM` del `BusinessGeoInfo`.
- `geofence_repository.dart` no expone `geofenceEnabled` ni `geofenceRadiusM` en `BusinessGeoInfo`, y no filtra por `geofence_enabled`.

**Archivos:**
- Modificar: `mobile/lib/geofence/geofence_manager.dart`
- Modificar: `mobile/lib/geofence/geofence_repository.dart`

- [ ] **Paso 1: Reemplazar `mobile/lib/geofence/geofence_repository.dart`**

```dart
import 'package:shared_preferences/shared_preferences.dart';
import '../data/mobile_api_client.dart';

class BusinessGeoInfo {
  final String businessId;
  final String businessName;
  final String customerCardId;
  final double latitude;
  final double longitude;
  final int currentStamps;
  final int stampsRequired;
  final int geofenceRadiusM;

  const BusinessGeoInfo({
    required this.businessId,
    required this.businessName,
    required this.customerCardId,
    required this.latitude,
    required this.longitude,
    required this.currentStamps,
    required this.stampsRequired,
    required this.geofenceRadiusM,
  });
}

class GeofenceRepository {
  Future<List<BusinessGeoInfo>> fetchEligibleBusinesses() async {
    final prefs = await SharedPreferences.getInstance();
    final disabled = (prefs.getStringList('disabled_geofences') ?? []).toSet();

    final res = await MobileApiClient().get('/api/mobile/customer-cards');
    final cards = res['cards'] as List<dynamic>? ?? [];

    final result = <BusinessGeoInfo>[];
    for (final card in cards) {
      final c = card as Map<String, dynamic>;
      final lc = c['loyalty_cards'] as Map<String, dynamic>? ?? {};
      final biz = lc['businesses'] as Map<String, dynamic>? ?? {};

      final plan = biz['plan'] as String? ?? 'free';
      if (plan != 'pro' && plan != 'premium') continue;

      final geofenceEnabled = biz['geofence_enabled'] as bool? ?? false;
      if (!geofenceEnabled) continue;

      final lat = biz['latitude'];
      final lng = biz['longitude'];
      if (lat == null || lng == null) continue;

      final bizId = biz['id'] as String? ?? '';
      if (disabled.contains(bizId) || bizId.isEmpty) continue;

      result.add(BusinessGeoInfo(
        businessId: bizId,
        businessName: biz['name'] as String? ?? '',
        customerCardId: c['id'] as String? ?? '',
        latitude: (lat as num).toDouble(),
        longitude: (lng as num).toDouble(),
        currentStamps: c['current_stamps'] as int? ?? 0,
        stampsRequired: lc['stamps_required'] as int? ?? 1,
        geofenceRadiusM: biz['geofence_radius_m'] as int? ?? 300,
      ));
    }
    return result;
  }
}
```

Note: the method was renamed from `fetchProPlusBusinessesWithLocation` to `fetchEligibleBusinesses` — update the call site in `geofence_manager.dart` too.

- [ ] **Paso 2: Reemplazar `mobile/lib/geofence/geofence_manager.dart`**

```dart
import 'package:flutter/foundation.dart';
import 'package:geofence_service/geofence_service.dart';
import '../data/mobile_api_client.dart';
import 'geofence_repository.dart';

class GeofenceManager {
  final _service = GeofenceService.instance.setup(
    interval: 5000,
    accuracy: 100,
    loiteringDelayMs: 60000,
    statusChangeDelayMs: 10000,
    geofenceRadiusSortType: GeofenceRadiusSortType.DESC,
  );

  List<BusinessGeoInfo> _businesses = [];
  bool _running = false;

  Future<void> startIfEligible() async {
    try {
      final businesses = await GeofenceRepository().fetchEligibleBusinesses();
      if (businesses.isEmpty) return;
      _businesses = businesses;

      final geofences = businesses.map((b) => Geofence(
            id: b.businessId,
            latitude: b.latitude,
            longitude: b.longitude,
            radius: [GeofenceRadius(id: 'r${b.geofenceRadiusM}', length: b.geofenceRadiusM.toDouble())],
          )).toList();

      _service.addGeofenceStatusChangeListener(_onStatusChange);
      await _service.start(geofences);
      _running = true;
    } catch (e) {
      debugPrint('[GeofenceManager] start failed: $e');
    }
  }

  Future<void> stop() async {
    if (!_running) return;
    try {
      await _service.stop();
      _running = false;
    } catch (_) {}
  }

  Future<void> _onStatusChange(
    Geofence geofence,
    GeofenceRadius radius,
    GeofenceStatus status,
    Location location,
  ) async {
    if (status != GeofenceStatus.ENTER) return;
    try {
      await MobileApiClient().post('/api/mobile/geofence/notify', {
        'business_id': geofence.id,
      });
    } catch (e) {
      debugPrint('[GeofenceManager] notify failed: $e');
    }
  }
}
```

- [ ] **Paso 3: Verificar que el código compila (análisis estático)**

```bash
cd /Users/samuelrodriguez/development/fidelitap/mobile
flutter analyze lib/geofence/ 2>&1 | head -30
```

Sin errores en los archivos editados.

- [ ] **Paso 4: Commit**

```bash
git add mobile/lib/geofence/
git commit -m "fix: GeofenceManager uses correct endpoint + dynamic radius; filter geofence_enabled"
```

---

## Task 5 — Flutter: sección geofence en owner_settings_screen.dart

**Archivo:**
- Modificar: `mobile/lib/owner/owner_settings_screen.dart`

La pantalla actual tiene: nombre, dirección, cooldown de sellos. Agregar nueva sección "Notificaciones de proximidad" al final, antes del botón Guardar.

**Campos a agregar al state:**
```dart
bool _geofenceEnabled = false;
int _geofenceRadiusM = 300;
String _geofenceMessage = '';
int _geofenceCooldownH = 24;
int _quietHoursStart = 22;
int _quietHoursEnd = 6;
String _plan = 'free';
```

**Carga (`_load`):** extraer los nuevos campos del response de `getSettings()`. Actualizar `BusinessSettings` model si es necesario, o acceder via `MobileApiClient().get('/api/mobile/settings')` directamente.

**Guardado (`_save`):** incluir los nuevos campos en el body del PATCH.

**UI de la sección geofence** (solo visible si `_plan in ['pro', 'premium']`; si no, mostrar badge "Solo Plan Pro"):

```
Notificaciones de proximidad
[Switch: Activar notificaciones al acercarse]  // _geofenceEnabled

Radio de detección:
[Chip 100m] [Chip 300m ✓] [Chip 500m]        // _geofenceRadiusM

Mensaje personalizado (opcional):
[TextField: _geofenceMessage]

Sin notificaciones de noche:
  Desde [22:00 ▼]  Hasta [06:00 ▼]            // time pickers

Tiempo entre notificaciones:
[Dropdown: 1h / 6h / 12h / 24h]               // _geofenceCooldownH
```

- [ ] **Paso 1: Leer el archivo actual completo**

```bash
cat mobile/lib/owner/owner_settings_screen.dart
```

- [ ] **Paso 2: Actualizar `BusinessSettings` en `mobile_api_client.dart` para incluir campos geofence**

Agregar a `BusinessSettings`:

```dart
class BusinessSettings {
  final String name;
  final String? address;
  final double? latitude;
  final double? longitude;
  final int stampCooldownSeconds;
  final String plan;
  final bool geofenceEnabled;
  final int geofenceRadiusM;
  final String geofenceMessage;
  final int geofenceCooldownH;
  final int quietHoursStart;
  final int quietHoursEnd;

  const BusinessSettings({
    required this.name,
    this.address,
    this.latitude,
    this.longitude,
    required this.stampCooldownSeconds,
    required this.plan,
    required this.geofenceEnabled,
    required this.geofenceRadiusM,
    required this.geofenceMessage,
    required this.geofenceCooldownH,
    required this.quietHoursStart,
    required this.quietHoursEnd,
  });

  factory BusinessSettings.fromJson(Map<String, dynamic> j) => BusinessSettings(
        name: j['name'] as String,
        address: j['address'] as String?,
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
        stampCooldownSeconds: j['stamp_cooldown_seconds'] as int? ?? 0,
        plan: j['plan'] as String? ?? 'free',
        geofenceEnabled: j['geofence_enabled'] as bool? ?? false,
        geofenceRadiusM: j['geofence_radius_m'] as int? ?? 300,
        geofenceMessage: j['geofence_message'] as String? ?? '',
        geofenceCooldownH: j['geofence_cooldown_h'] as int? ?? 24,
        quietHoursStart: j['quiet_hours_start'] as int? ?? 22,
        quietHoursEnd: j['quiet_hours_end'] as int? ?? 6,
      );
}
```

- [ ] **Paso 3: Reescribir `mobile/lib/owner/owner_settings_screen.dart`**

Contenido completo del archivo:

```dart
import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';

class OwnerSettingsScreen extends StatefulWidget {
  const OwnerSettingsScreen({super.key});
  @override
  State<OwnerSettingsScreen> createState() => _OwnerSettingsScreenState();
}

class _OwnerSettingsScreenState extends State<OwnerSettingsScreen> {
  final _name = TextEditingController();
  final _address = TextEditingController();
  final _geofenceMessageCtrl = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;
  int _cooldown = 0;
  String _plan = 'free';

  // Geofence state
  bool _geofenceEnabled = false;
  int _geofenceRadiusM = 300;
  int _geofenceCooldownH = 24;
  int _quietHoursStart = 22;
  int _quietHoursEnd = 6;

  static const _cooldownOptions = [
    (label: 'Sin cooldown', value: 0),
    (label: '1 minuto', value: 60),
    (label: '5 minutos', value: 300),
    (label: '15 minutos', value: 900),
    (label: '1 hora', value: 3600),
    (label: '1 día', value: 86400),
  ];

  static const _geoCooldownOptions = [
    (label: '1 hora', value: 1),
    (label: '6 horas', value: 6),
    (label: '12 horas', value: 12),
    (label: '24 horas', value: 24),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _address.dispose();
    _geofenceMessageCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final s = await MobileApiClient().getSettings();
      setState(() {
        _name.text = s.name;
        _address.text = s.address ?? '';
        _cooldown = s.stampCooldownSeconds;
        _plan = s.plan;
        _geofenceEnabled = s.geofenceEnabled;
        _geofenceRadiusM = s.geofenceRadiusM;
        _geofenceMessageCtrl.text = s.geofenceMessage;
        _geofenceCooldownH = s.geofenceCooldownH;
        _quietHoursStart = s.quietHoursStart;
        _quietHoursEnd = s.quietHoursEnd;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = 'Error al cargar ajustes'; _loading = false; });
    }
  }

  Future<void> _save() async {
    setState(() { _saving = true; _error = null; _success = null; });
    try {
      final body = <String, dynamic>{
        'name': _name.text.trim(),
        'address': _address.text.trim().isEmpty ? null : _address.text.trim(),
        'stamp_cooldown_seconds': _cooldown,
      };
      if (['pro', 'premium'].contains(_plan)) {
        body['geofence_enabled'] = _geofenceEnabled;
        body['geofence_radius_m'] = _geofenceRadiusM;
        body['geofence_message'] = _geofenceMessageCtrl.text.trim().isEmpty
            ? null
            : _geofenceMessageCtrl.text.trim();
        body['geofence_cooldown_h'] = _geofenceCooldownH;
        body['quiet_hours_start'] = _quietHoursStart;
        body['quiet_hours_end'] = _quietHoursEnd;
      }
      final res = await MobileApiClient().patch('/api/mobile/settings', body);
      if (res.containsKey('error')) {
        setState(() { _error = res['error'] as String? ?? 'Error al guardar'; _saving = false; });
        return;
      }
      setState(() { _success = 'Ajustes guardados'; _saving = false; });
    } catch (e) {
      setState(() { _error = 'Error de conexión'; _saving = false; });
    }
  }

  String _fmt(int h) => '${h.toString().padLeft(2, '0')}:00';

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: isStart ? _quietHoursStart : _quietHoursEnd,
        minute: 0,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isStart) _quietHoursStart = picked.hour;
        else _quietHoursEnd = picked.hour;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final isPro = ['pro', 'premium'].contains(_plan);

    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Datos del negocio ──────────────────────────────────────────
            _sectionHeader('Datos del negocio'),
            _field('Nombre del negocio', _name),
            const SizedBox(height: 12),
            _field('Dirección', _address),
            const SizedBox(height: 24),

            // ── Cooldown de sellos ─────────────────────────────────────────
            _sectionHeader('Cooldown de sellos'),
            DropdownButtonFormField<int>(
              value: _cooldown,
              decoration: _inputDeco('Tiempo entre sellos'),
              items: _cooldownOptions
                  .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label)))
                  .toList(),
              onChanged: (v) => setState(() => _cooldown = v ?? 0),
            ),
            const SizedBox(height: 24),

            // ── Notificaciones de proximidad ───────────────────────────────
            _sectionHeader('Notificaciones de proximidad'),
            if (!isPro) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white12),
                ),
                child: Row(children: [
                  const Icon(Icons.lock_outline, size: 16, color: Colors.white38),
                  const SizedBox(width: 8),
                  const Text('Solo disponible en Plan Pro',
                      style: TextStyle(color: Colors.white54, fontSize: 13)),
                  const Spacer(),
                  TextButton(
                    onPressed: () {},
                    child: const Text('Actualizar →', style: TextStyle(fontSize: 12)),
                  ),
                ]),
              ),
            ] else ...[
              SwitchListTile(
                value: _geofenceEnabled,
                onChanged: (v) => setState(() => _geofenceEnabled = v),
                title: const Text('Activar notificaciones al acercarse'),
                subtitle: const Text('El cliente recibe un push al entrar al radio'),
                contentPadding: EdgeInsets.zero,
              ),
              if (_geofenceEnabled) ...[
                const SizedBox(height: 16),
                const Text('Radio de detección',
                    style: TextStyle(fontSize: 13, color: Colors.white70)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [100, 300, 500].map((r) => ChoiceChip(
                    label: Text('${r}m'),
                    selected: _geofenceRadiusM == r,
                    onSelected: (_) => setState(() => _geofenceRadiusM = r),
                  )).toList(),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _geofenceMessageCtrl,
                  decoration: _inputDeco('Mensaje personalizado (opcional)'),
                  maxLength: 120,
                ),
                const SizedBox(height: 16),
                const Text('Sin notificaciones de noche',
                    style: TextStyle(fontSize: 13, color: Colors.white70)),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickTime(true),
                      child: Text('Desde ${_fmt(_quietHoursStart)}'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickTime(false),
                      child: Text('Hasta ${_fmt(_quietHoursEnd)}'),
                    ),
                  ),
                ]),
                const SizedBox(height: 16),
                DropdownButtonFormField<int>(
                  value: _geoCooldownOptions.any((o) => o.value == _geofenceCooldownH)
                      ? _geofenceCooldownH
                      : 24,
                  decoration: _inputDeco('Tiempo entre notificaciones'),
                  items: _geoCooldownOptions
                      .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label)))
                      .toList(),
                  onChanged: (v) => setState(() => _geofenceCooldownH = v ?? 24),
                ),
              ],
            ],
            const SizedBox(height: 32),

            // ── Feedback ───────────────────────────────────────────────────
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
              ),
            if (_success != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_success!, style: const TextStyle(color: Color(0xFF7CFF3A))),
              ),

            // ── Guardar ────────────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(width: 18, height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Guardar'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(text.toUpperCase(),
            style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: Colors.white38, letterSpacing: 1.2)),
      );

  Widget _field(String label, TextEditingController ctrl) => TextField(
        controller: ctrl,
        decoration: _inputDeco(label),
      );

  InputDecoration _inputDeco(String label) => InputDecoration(
        labelText: label,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      );
}
```

- [ ] **Paso 4: Analizar código Flutter**

```bash
cd mobile && flutter analyze lib/owner/owner_settings_screen.dart lib/data/mobile_api_client.dart 2>&1 | head -30
```

Sin errores.

- [ ] **Paso 5: Commit**

```bash
git add mobile/lib/owner/owner_settings_screen.dart mobile/lib/data/mobile_api_client.dart
git commit -m "feat: geofence settings section in owner settings screen"
```
