# FideliTap Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline execution chosen — tasks share state across one Flutter app + one Supabase schema, not independent enough for parallel subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working Flutter app (`mobile/`) inside the FideliTap repo with two modes (business owner / customer), backed by new Supabase tables/RPCs/Edge Functions and new Next.js REST routes, covering auth, owner QR scanner + basic dashboard, customer card view, FCM push, and Pro+-gated geofencing reminders.

**Architecture:** Flutter app talks to Supabase directly for auth/data (via `supabase_flutter`), and to new `/api/mobile/*` REST routes on the existing Next.js backend for anything that needs server-side business logic shared with the web (stamping, dashboard aggregation). Two new Supabase Edge Functions handle push sending (`geofence-checkin`, `send-owner-push`) using the Firebase Admin HTTP v1 API.

**Tech Stack:** Flutter 3.41 (already installed at `~/development/flutter`), `supabase_flutter`, `mobile_scanner`, `geolocator` + `geofence_service`, `firebase_core`/`firebase_messaging`, Next.js 14 API routes, Supabase Postgres/RLS/Edge Functions (Deno).

**Environment constraints (checked 2026-06-29):** Android toolchain is NOT configured on this machine (`flutter doctor` shows missing cmdline-tools/ANDROID_HOME) — no Android emulator available. iOS Simulator (iPhone 17, iOS 26.5) and Xcode are available and working. Code will be written platform-agnostic (both `android/` and `ios/` project folders generated and configured), but **live testing in this plan only covers iOS Simulator**. The QR camera does not work in the iOS Simulator (no camera hardware) — the scanner screen ships a manual code-entry fallback so the flow is testable end-to-end without a physical device.

---

## Phase 1 — Backend: database + REST + Edge Functions

### Task 1.1: Migration — foundation tables

**Files:**
- Create: `supabase/migrations/20260629120000_mobile_app_foundation.sql`

```sql
-- businesses: geofencing needs a location
alter table public.businesses
  add column latitude  double precision,
  add column longitude double precision;

-- link a customer_card to the auth.users identity controlling it in the app
-- (customers have no login today; the app uses Supabase anonymous auth,
-- and "claiming" a card via its unique_code links that anon identity here)
alter table public.customer_cards
  add column linked_auth_user_id uuid references auth.users(id) on delete set null;

create index idx_customer_cards_linked_auth_user_id
  on public.customer_cards(linked_auth_user_id);

-- push device tokens (owners and customers both have an auth.users row)
create table public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  fcm_token   text not null,
  platform    text not null check (platform in ('android','ios')),
  created_at  timestamptz not null default now(),
  unique (user_id, fcm_token)
);

alter table public.device_tokens enable row level security;

create policy "device_tokens_select_own" on public.device_tokens
  for select using (auth.uid() = user_id);
create policy "device_tokens_insert_own" on public.device_tokens
  for insert with check (auth.uid() = user_id);
create policy "device_tokens_delete_own" on public.device_tokens
  for delete using (auth.uid() = user_id);

-- cooldown ledger for geofence reminders (max 1 / day / customer / business)
create table public.geofence_notifications (
  id            uuid primary key default gen_random_uuid(),
  customer_card_id uuid references public.customer_cards(id) on delete cascade not null,
  business_id   uuid references public.businesses(id) on delete cascade not null,
  sent_at       timestamptz not null default now()
);

create index idx_geofence_notifications_lookup
  on public.geofence_notifications(customer_card_id, business_id, sent_at desc);

alter table public.geofence_notifications enable row level security;
-- only the service role (Edge Function) writes/reads this table directly;
-- no policies needed beyond RLS-enabled-with-no-policy (= deny all to anon/authenticated)

-- RLS: let a customer read/update their own claimed cards via the app
create policy "customer_cards_select_own_claimed" on public.customer_cards
  for select using (auth.uid() = linked_auth_user_id);
```

- [ ] **Step 1: Verify local Supabase is running**

Run: `supabase status`
Expected: shows running services (API URL, DB URL). If not running, run `supabase start` first.

- [ ] **Step 2: Apply the migration locally**

Run: `supabase db reset` (applies all migrations including the new one against local DB)
Expected: ends with "Finished supabase db reset" and no SQL errors.

- [ ] **Step 3: Regenerate TypeScript types** (per project lesson: never hand-write `database.types.ts`)

Run: `supabase gen types typescript --local > src/types/database.types.ts` (use whatever exact path the project already uses — check existing `src/types/database*.ts` import path before running)
Expected: file updates with `businesses.latitude/longitude`, `device_tokens`, `geofence_notifications`, `customer_cards.linked_auth_user_id`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260629120000_mobile_app_foundation.sql src/types/database.types.ts
git commit -m "feat(mobile): add device_tokens, geofence_notifications, business geo, card linking"
```

### Task 1.2: RPC — claim a card from the app (anonymous auth linking)

**Files:**
- Create: `supabase/migrations/20260629120100_claim_card_rpc.sql`

```sql
create or replace function public.claim_customer_card(p_unique_code text)
returns table (
  customer_card_id uuid,
  business_name    text,
  card_name        text,
  stamps_required  int,
  current_stamps   int,
  status           text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  update public.customer_cards cc
    set linked_auth_user_id = v_uid
    where cc.unique_code = p_unique_code
      and (cc.linked_auth_user_id is null or cc.linked_auth_user_id = v_uid);

  return query
    select cc.id, b.name, lc.name, lc.stamps_required, cc.current_stamps, cc.status
    from public.customer_cards cc
    join public.loyalty_cards lc on lc.id = cc.loyalty_card_id
    join public.businesses b on b.id = lc.business_id
    where cc.unique_code = p_unique_code
      and cc.linked_auth_user_id = v_uid;
end;
$$;

grant execute on function public.claim_customer_card(text) to authenticated, anon;
```

- [ ] **Step 1: Apply migration**

Run: `supabase db reset`
Expected: no errors.

- [ ] **Step 2: Manual smoke test via SQL**

Run: `supabase db psql -c "select * from public.claim_customer_card('nonexistent-code');"` while authenticated as anon (this will raise "No autenticado" since there's no `auth.uid()` in a raw psql session — that's expected; real verification happens from the Flutter app in Phase 2).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260629120100_claim_card_rpc.sql
git commit -m "feat(mobile): add claim_customer_card RPC for app card linking"
```

### Task 1.3: Extract shared stamp logic + new mobile REST routes

**Files:**
- Create: `src/lib/scanner/add-stamp.ts` (pure function extracted from `src/app/(dashboard)/scanner/actions.ts`)
- Modify: `src/app/(dashboard)/scanner/actions.ts` (call the extracted function instead of duplicating logic)
- Create: `src/app/api/mobile/add-stamp/route.ts`
- Create: `src/app/api/mobile/claim-card/route.ts`
- Create: `src/app/api/mobile/customer-cards/route.ts`
- Create: `src/app/api/mobile/dashboard-summary/route.ts`
- Create: `src/app/api/mobile/device-token/route.ts`

`src/lib/scanner/add-stamp.ts` exports:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'

export type CardStatus = 'active' | 'ready_to_claim' | 'claimed'

export type StampResult =
  | { error: string }
  | {
      customerCardId: string
      customerName: string
      currentStamps: number
      stampsRequired: number
      isComplete: boolean
      timesCompleted: number
      status: CardStatus
    }

export async function addStampForBusiness(
  serviceClient: SupabaseClient,
  businessId: string,
  stampCooldownSeconds: number,
  uniqueCode: string
): Promise<StampResult> {
  // body = the existing logic currently in scanner/actions.ts addStampAction,
  // starting from the `serviceClient.from('customer_cards')...` lookup
  // through the `add_stamp` RPC call and push/email side effects, unmodified.
}
```

Move the existing logic verbatim out of `addStampAction` in `src/app/(dashboard)/scanner/actions.ts` into this function (same SQL, same RPC call, same push/email triggers); `addStampAction` becomes:

```typescript
export async function addStampAction(uniqueCode: string): Promise<StampResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()
  if (!business) return { error: 'Negocio no encontrado' }

  return addStampForBusiness(createServiceClient(), business.id, business.stamp_cooldown_seconds, uniqueCode)
}
```

`src/app/api/mobile/add-stamp/route.ts` (Bearer JWT auth — the Flutter app sends the Supabase access token):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { addStampForBusiness } from '@/lib/scanner/add-stamp'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { uniqueCode } = await req.json()
  if (!uniqueCode) return NextResponse.json({ error: 'uniqueCode requerido' }, { status: 400 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id, stamp_cooldown_seconds')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const result = await addStampForBusiness(
    createServiceClient(),
    business.id,
    business.stamp_cooldown_seconds,
    uniqueCode
  )
  if ('error' in result) return NextResponse.json(result, { status: 400 })
  return NextResponse.json(result)
}
```

`src/app/api/mobile/claim-card/route.ts` — same Bearer-token pattern, calls `supabase.rpc('claim_customer_card', { p_unique_code: uniqueCode })` and returns the row.

`src/app/api/mobile/customer-cards/route.ts` — same Bearer-token pattern, `GET`, queries:
```typescript
const { data } = await supabase
  .from('customer_cards')
  .select(`id, current_stamps, status, times_completed,
    loyalty_cards ( name, benefit_description, stamps_required, design_config,
      businesses ( name, latitude, longitude ) )`)
  .eq('linked_auth_user_id', user.id)
```

`src/app/api/mobile/dashboard-summary/route.ts` — `GET`, owner-only (same pattern as add-stamp's business lookup), returns counts: total customers, cards issued today, cards completed this month — query `customer_cards`/`customers` filtered by the owner's `business_id`, mirroring whatever aggregate queries `src/app/(dashboard)/dashboard/page.tsx` already uses (read that file first and reuse the same Supabase queries, don't invent new metrics).

`src/app/api/mobile/device-token/route.ts` — `POST { fcmToken, platform }` upserts into `device_tokens` for `auth.getUser()`'s id; `DELETE { fcmToken }` removes it (call on logout).

- [ ] **Step 1: Write the extracted function and update the server action**

Apply the changes above to `src/lib/scanner/add-stamp.ts` and `src/app/(dashboard)/scanner/actions.ts`.

- [ ] **Step 2: Verify web scanner still works (regression check)**

Run: `npm run dev`, open `/scanner` in the dashboard while logged in as a business owner, scan/enter a known `unique_code`, confirm a stamp is still added (no behavior change from a user's perspective).

- [ ] **Step 3: Create the four mobile API routes** per the code above.

- [ ] **Step 4: Smoke test with curl** (replace `$TOKEN` with a real access token from a logged-in Supabase session, grab it from browser devtools → Application → local storage `sb-*-auth-token`)

```bash
curl -X POST http://localhost:3000/api/mobile/add-stamp \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"uniqueCode":"<a real unique_code from customer_cards>"}'
```
Expected: JSON with `currentStamps` incremented, matching what the web scanner would have returned.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scanner/add-stamp.ts src/app/\(dashboard\)/scanner/actions.ts src/app/api/mobile
git commit -m "feat(mobile): add /api/mobile REST routes for the Flutter app"
```

### Task 1.4: Edge Functions for push (FCM)

**Files:**
- Create: `supabase/functions/_shared/fcm.ts`
- Create: `supabase/functions/geofence-checkin/index.ts`
- Create: `supabase/functions/send-owner-push/index.ts`
- Modify: `src/app/api/webhooks/mercadopago/route.ts` (call `send-owner-push` on payment-failed event — read the file first to find the exact spot where the failure is currently handled and add an Edge Function invocation there, don't restructure the rest of the webhook)

`supabase/functions/_shared/fcm.ts` — wraps Firebase HTTP v1 send using a service account JSON stored in the `FCM_SERVICE_ACCOUNT_JSON` Supabase secret (Deno env var), exports `sendFcmPush(tokens: string[], title: string, body: string, data?: Record<string,string>)`.

`supabase/functions/geofence-checkin/index.ts` — `POST { customer_card_id, business_id, latitude, longitude }`:
1. Verify the caller's JWT (Supabase Edge Functions get this automatically via `Authorization` header + `supabase.auth.getUser()` using the anon client built from the request's auth header).
2. Look up the business's plan (`businesses.plan`) — if not `pro` or higher, return `{ skipped: 'not_pro' }` with 200.
3. Check `geofence_notifications` for a row with this `customer_card_id`+`business_id` where `sent_at > now() - interval '1 day'` — if found, return `{ skipped: 'cooldown' }`.
4. Compute stamps remaining (`stamps_required - current_stamps` from `customer_cards`/`loyalty_cards`).
5. Look up `device_tokens` for the linked `auth.users.id`, call `sendFcmPush(...)` with title `"¡Estás cerca de {business_name}!"` and body `"Te faltan {n} sellos para tu premio"`.
6. Insert a row into `geofence_notifications`.

`supabase/functions/send-owner-push/index.ts` — `POST { business_id, event: 'new_customer'|'card_completed'|'payment_failed', payload }`: looks up `businesses.plan`, skips if not Pro+, looks up `device_tokens` for `businesses.owner_id`, sends an FCM push with event-specific copy.

- [ ] **Step 1: Write `_shared/fcm.ts`** with the HTTP v1 API call (`POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`, OAuth2 token minted from the service account JSON using `google-auth-library`-equivalent JWT signing available in Deno — use the `djwt` Deno module already idiomatic for Supabase Edge Functions).

- [ ] **Step 2: Write `geofence-checkin/index.ts` and `send-owner-push/index.ts`** per the contracts above.

- [ ] **Step 3: Deploy locally and test**

Run: `supabase functions serve geofence-checkin --no-verify-jwt` then `curl -X POST http://localhost:54321/functions/v1/geofence-checkin -H "Authorization: Bearer $TOKEN" -d '{"customer_card_id":"...","business_id":"...","latitude":0,"longitude":0}'`
Expected: `{ "skipped": "not_pro" }` for a non-Pro test business, or a real send for a Pro one (check Supabase function logs for the FCM response).

- [ ] **Step 4: Wire `send-owner-push` into the MercadoPago webhook's payment-failed branch.**

- [ ] **Step 5: Commit**

```bash
git add supabase/functions src/app/api/webhooks/mercadopago/route.ts
git commit -m "feat(mobile): add FCM push Edge Functions for geofence and owner events"
```

---

## Phase 2 — Flutter app scaffold + auth

### Task 2.1: Create the Flutter project

- [ ] **Step 1: Scaffold**

Run (from repo root `/Users/samuelrodriguez/development/fidelitap`):
```bash
~/development/flutter/bin/flutter create --org co.fidelitap --project-name fidelitap_mobile -i swift -a kotlin mobile
```
Expected: `mobile/` directory created with `lib/`, `android/`, `ios/`, `pubspec.yaml`.

- [ ] **Step 2: Add dependencies**

**Files:**
- Modify: `mobile/pubspec.yaml`

Add under `dependencies:`
```yaml
  supabase_flutter: ^2.8.0
  mobile_scanner: ^5.2.3
  geolocator: ^13.0.1
  geofence_service: ^5.1.0
  firebase_core: ^3.8.0
  firebase_messaging: ^15.1.6
  flutter_local_notifications: ^18.0.1
  go_router: ^14.6.2
  flutter_riverpod: ^2.6.1
```

Run: `cd mobile && flutter pub get`
Expected: resolves with no version conflicts.

- [ ] **Step 3: Commit**

```bash
git add mobile/pubspec.yaml mobile/pubspec.lock
git commit -m "feat(mobile): scaffold Flutter app with core dependencies"
```

### Task 2.2: Supabase client + env config

**Files:**
- Create: `mobile/lib/core/env.dart`
- Create: `mobile/lib/core/supabase_client.dart`
- Modify: `mobile/lib/main.dart`

`mobile/lib/core/env.dart`:
```dart
class Env {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
}
```

`mobile/lib/core/supabase_client.dart`:
```dart
import 'package:supabase_flutter/supabase_flutter.dart';
import 'env.dart';

Future<void> initSupabase() async {
  await Supabase.initialize(url: Env.supabaseUrl, anonKey: Env.supabaseAnonKey);
}

SupabaseClient get supabase => Supabase.instance.client;
```

`mobile/lib/main.dart`:
```dart
import 'package:flutter/material.dart';
import 'core/supabase_client.dart';
import 'app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initSupabase();
  runApp(const FideliTapApp());
}
```

- [ ] **Step 1: Get the local Supabase anon key and URL**

Run: `cd /Users/samuelrodriguez/development/fidelitap && supabase status` and copy `API URL` and `anon key`.

- [ ] **Step 2: Write the three files above.**

- [ ] **Step 3: Run on iOS Simulator to verify Supabase initializes without throwing**

Run:
```bash
cd mobile && flutter run -d "iPhone 17" \
  --dart-define=SUPABASE_URL=<API URL from step 1> \
  --dart-define=SUPABASE_ANON_KEY=<anon key from step 1>
```
Expected: app launches showing the default placeholder screen with no red error screen about Supabase init.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/core mobile/lib/main.dart
git commit -m "feat(mobile): initialize Supabase client from --dart-define env"
```

### Task 2.3: Routing shell + role detection

**Files:**
- Create: `mobile/lib/app.dart`
- Create: `mobile/lib/core/session_role.dart`
- Create: `mobile/lib/auth/login_screen.dart` (owner email/password login)
- Create: `mobile/lib/auth/claim_card_screen.dart` (customer: anonymous sign-in + claim by code)
- Create: `mobile/lib/auth/role_gate_screen.dart` (splash that decides where to route)

`mobile/lib/core/session_role.dart`:
```dart
import 'supabase_client.dart';

enum AppRole { owner, customer, none }

Future<AppRole> resolveRole() async {
  final user = supabase.auth.currentUser;
  if (user == null) return AppRole.none;

  final business = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();
  if (business != null) return AppRole.owner;

  final card = await supabase
      .from('customer_cards')
      .select('id')
      .eq('linked_auth_user_id', user.id)
      .limit(1)
      .maybeSingle();
  if (card != null) return AppRole.customer;

  return AppRole.none;
}
```

`mobile/lib/auth/role_gate_screen.dart` — `StatefulWidget` that calls `resolveRole()` in `initState`, shows a spinner, then `go_router` redirects to `/owner` or `/customer/cards`, or `/auth/choose` (a screen with two buttons: "Soy negocio" → `login_screen.dart`, "Soy cliente" → `claim_card_screen.dart`) when `AppRole.none`.

`mobile/lib/auth/login_screen.dart` — standard email/password form calling `supabase.auth.signInWithPassword(email: ..., password: ...)`, on success navigates to role gate again.

`mobile/lib/auth/claim_card_screen.dart`:
```dart
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/supabase_client.dart';

class ClaimCardScreen extends StatefulWidget {
  const ClaimCardScreen({super.key});
  @override
  State<ClaimCardScreen> createState() => _ClaimCardScreenState();
}

class _ClaimCardScreenState extends State<ClaimCardScreen> {
  final _codeController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _claim(String code) async {
    setState(() { _loading = true; _error = null; });
    try {
      if (supabase.auth.currentUser == null) {
        await supabase.auth.signInAnonymously();
      }
      final result = await supabase.rpc('claim_customer_card', params: {'p_unique_code': code});
      if (result == null || (result as List).isEmpty) {
        setState(() => _error = 'Código no encontrado');
        return;
      }
      if (mounted) Navigator.of(context).pushReplacementNamed('/customer/cards');
    } catch (e) {
      setState(() => _error = 'No se pudo vincular la tarjeta');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Agregar tarjeta')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            SizedBox(
              height: 250,
              child: MobileScanner(
                onDetect: (capture) {
                  final code = capture.barcodes.first.rawValue;
                  if (code != null && !_loading) _claim(code);
                },
              ),
            ),
            const SizedBox(height: 16),
            const Text('o ingresa el código manualmente'),
            TextField(controller: _codeController),
            const SizedBox(height: 8),
            if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
            ElevatedButton(
              onPressed: _loading ? null : () => _claim(_codeController.text.trim()),
              child: _loading ? const CircularProgressIndicator() : const Text('Vincular'),
            ),
          ],
        ),
      ),
    );
  }
}
```

`mobile/lib/app.dart` — `go_router` config with routes: `/` → `RoleGateScreen`, `/auth/choose`, `/auth/login` → `LoginScreen`, `/auth/claim` → `ClaimCardScreen`, `/owner` → `OwnerHomeShell` (Task 3.x), `/customer/cards` → `CustomerHomeShell` (Task 4.x).

- [ ] **Step 1: Write all five files above.**

- [ ] **Step 2: Manual test — owner login path**

Create a test business owner via the existing web `/register` flow (or Supabase Studio) if one doesn't already exist locally. Run the app (Task 2.2 step 3 command), tap "Soy negocio", log in with that owner's credentials.
Expected: routes to `/owner` (placeholder screen is fine for now — built in Phase 3).

- [ ] **Step 3: Manual test — customer claim path**

In Supabase Studio, find a real `customer_cards.unique_code` from local seed data (or create one via the web activation flow at `/c/<slug>`). In the app, tap "Soy cliente", type that code into the manual field (camera doesn't work in Simulator), tap "Vincular".
Expected: routes to `/customer/cards` (placeholder screen is fine for now — built in Phase 4); re-running `resolveRole()` from a fresh app launch with the same (now persisted) anonymous session returns `AppRole.customer`.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/app.dart mobile/lib/core/session_role.dart mobile/lib/auth
git commit -m "feat(mobile): add routing shell, owner login, customer card claim"
```

---

## Phase 3 — Owner mode: dashboard + scanner

### Task 3.1: Owner shell + dashboard screen

**Files:**
- Create: `mobile/lib/owner/owner_home_shell.dart` (bottom nav: Dashboard, Scanner)
- Create: `mobile/lib/owner/dashboard_screen.dart`
- Create: `mobile/lib/data/mobile_api_client.dart` (shared HTTP client for `/api/mobile/*` routes, attaches `Authorization: Bearer <supabase.auth.currentSession.accessToken>`)

`mobile/lib/data/mobile_api_client.dart`:
```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../core/supabase_client.dart';
import '../core/env.dart';

class MobileApiClient {
  Future<Map<String, dynamic>> get(String path) async {
    final token = supabase.auth.currentSession?.accessToken;
    final res = await http.get(
      Uri.parse('${Env.apiBaseUrl}$path'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final token = supabase.auth.currentSession?.accessToken;
    final res = await http.post(
      Uri.parse('${Env.apiBaseUrl}$path'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
```

Add `apiBaseUrl` to `mobile/lib/core/env.dart` (`String.fromEnvironment('API_BASE_URL')`, e.g. `http://localhost:3000` when running against the local Next.js dev server — on iOS Simulator `localhost` resolves to the Mac host directly, no special IP needed).

`dashboard_screen.dart` — calls `MobileApiClient().get('/api/mobile/dashboard-summary')` in `initState`, renders the returned metrics in cards (same numbers as the web dashboard, read `src/app/(dashboard)/dashboard/page.tsx` first to match field names exactly).

- [ ] **Step 1: Add `http: ^1.2.2` to `mobile/pubspec.yaml`, run `flutter pub get`.**

- [ ] **Step 2: Write the three files above.**

- [ ] **Step 3: Manual test**

Run the app with `--dart-define=API_BASE_URL=http://localhost:3000` added to the run command from Task 2.2, with `npm run dev` running in another terminal in the fidelitap repo. Log in as owner.
Expected: dashboard screen shows real numbers matching the web dashboard for the same business.

- [ ] **Step 4: Commit**

```bash
git add mobile/pubspec.yaml mobile/pubspec.lock mobile/lib/owner mobile/lib/data mobile/lib/core/env.dart
git commit -m "feat(mobile): owner dashboard screen backed by /api/mobile/dashboard-summary"
```

### Task 3.2: Scanner screen

**Files:**
- Create: `mobile/lib/owner/scanner_screen.dart`

Same structure as `claim_card_screen.dart`'s scanner+manual-entry pattern, but on detect/submit calls `MobileApiClient().post('/api/mobile/add-stamp', {'uniqueCode': code})` and shows a result card (customer name, current/required stamps, a green checkmark if `isComplete`).

- [ ] **Step 1: Write the file.**

- [ ] **Step 2: Manual test**

With the owner logged in and `npm run dev` running, use the manual code field with a real `unique_code` belonging to that owner's business.
Expected: stamp count increments, matches what Supabase Studio shows for that `customer_cards` row afterward.

- [ ] **Step 3: Test the cross-business rejection case**

Use a `unique_code` belonging to a *different* business's card.
Expected: `{"error": "Esta tarjeta pertenece a otro negocio"}` shown in the UI, no stamp added.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/owner/scanner_screen.dart
git commit -m "feat(mobile): owner QR scanner with manual fallback, wired to add-stamp API"
```

---

## Phase 4 — Customer mode: card view

### Task 4.1: Card list + detail

**Files:**
- Create: `mobile/lib/customer/customer_home_shell.dart` (bottom nav: Tarjetas, Ajustes)
- Create: `mobile/lib/customer/card_list_screen.dart`
- Create: `mobile/lib/customer/widgets/loyalty_card_widget.dart`

`card_list_screen.dart` calls `MobileApiClient().get('/api/mobile/customer-cards')`, renders one `LoyaltyCardWidget` per card.

`loyalty_card_widget.dart` — visual stamp-grid card (filled circles for `current_stamps`, empty for the remainder up to `stamps_required`), using `design_config.color` and `design_config.stamp_icon` from the API response so it visually matches the web/wallet card design (read `src/components/cards/wallet-preview.tsx` first and mirror its visual language — colors, stamp icon rendering — don't invent a new visual style).

- [ ] **Step 1: Write the three files.**

- [ ] **Step 2: Manual test**

Log in as the customer claimed in Task 2.3 Step 3.
Expected: card list shows the claimed card with the correct stamp count and business name, visually consistent with the web wallet preview.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/customer
git commit -m "feat(mobile): customer card list view matching web wallet design"
```

---

## Phase 5 — Push notifications (FCM)

### Task 5.1: Firebase project wiring (manual, user-owned step)

- [ ] **Step 1: User creates a Firebase project** at https://console.firebase.google.com, adds an Android app (package `co.fidelitap.fidelitap_mobile`) and an iOS app (bundle id `co.fidelitap.fidelitapMobile`), downloads `google-services.json` → `mobile/android/app/google-services.json` and `GoogleService-Info.plist` → `mobile/ios/Runner/GoogleService-Info.plist`.
- [ ] **Step 2: User generates a service account key** (Project Settings → Service Accounts → Generate new private key), sets it as a Supabase secret: `supabase secrets set FCM_SERVICE_ACCOUNT_JSON='<contents>'`.
- [ ] **Step 3: User enables Apple Push Notifications** in the Apple Developer portal for the iOS bundle id and uploads the APNs key/cert into the Firebase Cloud Messaging project settings (Firebase bridges APNs automatically once this is configured).

*(This task has no code — it's the credential setup only the account owner can do. Everything below assumes these files/secrets exist.)*

### Task 5.2: FCM integration in the app

**Files:**
- Modify: `mobile/android/app/build.gradle.kts` (apply `com.google.gms.google-services` plugin)
- Modify: `mobile/ios/Runner/AppDelegate.swift` (Firebase configure call — follow `firebase_core`'s standard iOS setup, no custom logic)
- Create: `mobile/lib/push/push_service.dart`
- Modify: `mobile/lib/main.dart` (call `initPush()` after a user is authenticated, not at cold start)

`mobile/lib/push/push_service.dart`:
```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import '../core/supabase_client.dart';
import '../data/mobile_api_client.dart';
import 'dart:io';

Future<void> initPush() async {
  final messaging = FirebaseMessaging.instance;
  await messaging.requestPermission(alert: true, badge: true, sound: true);
  final token = await messaging.getToken();
  if (token == null) return;
  await MobileApiClient().post('/api/mobile/device-token', {
    'fcmToken': token,
    'platform': Platform.isIOS ? 'ios' : 'android',
  });
  FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
    MobileApiClient().post('/api/mobile/device-token', {
      'fcmToken': newToken,
      'platform': Platform.isIOS ? 'ios' : 'android',
    });
  });
}
```

- [ ] **Step 1: Add `firebase_core`/`firebase_messaging` platform config** per the standard FlutterFire setup (`flutterfire configure` if the user has the FlutterFire CLI, otherwise manual file placement from Task 5.1).

- [ ] **Step 2: Write `push_service.dart`, call `initPush()` from both the owner and customer post-login flows** (after `role_gate_screen.dart` resolves a role, not before — `device_tokens` requires an authenticated `user_id`).

- [ ] **Step 3: Manual test on a physical device** (push tokens are unreliable/absent on iOS Simulator) — requires Task 5.1 complete and a device connected. Log in, confirm a row appears in `device_tokens` in Supabase Studio.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/push mobile/lib/main.dart mobile/android/app/build.gradle.kts mobile/ios/Runner/AppDelegate.swift
git commit -m "feat(mobile): register FCM device tokens after login"
```

---

## Phase 6 — Geofencing (Pro+ only)

### Task 6.1: Geofence registration + check-in

**Files:**
- Create: `mobile/lib/geofence/geofence_repository.dart` (fetches the customer's Pro+ businesses with lat/lng via `/api/mobile/customer-cards`, which already returns `businesses.latitude/longitude` per Task 1.3)
- Create: `mobile/lib/geofence/geofence_manager.dart`
- Modify: `mobile/ios/Runner/Info.plist` (add `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationWhenInUseUsageDescription`, background modes `location`)
- Modify: `mobile/android/app/src/main/AndroidManifest.xml` (add `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` permissions)

`geofence_manager.dart`:
```dart
import 'package:geofence_service/geofence_service.dart';
import 'package:geolocator/geolocator.dart';
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

  Future<void> start() async {
    final permission = await Geolocator.requestPermission();
    if (permission != LocationPermission.always) return; // user declined "Always" — skip silently, feature stays off

    final businesses = await GeofenceRepository().fetchProPlusBusinessesWithLocation();
    final geofences = businesses.map((b) => Geofence(
      id: b.businessId,
      latitude: b.latitude,
      longitude: b.longitude,
      radius: [GeofenceRadius(id: 'radius_300m', length: 300)],
    )).toList();

    _service.addGeofenceStatusChangeListener((geofence, radius, status, location) async {
      if (status == GeofenceStatus.ENTER) {
        await MobileApiClient().post('/functions/v1/geofence-checkin', {
          'customer_card_id': businesses.firstWhere((b) => b.businessId == geofence.id).customerCardId,
          'business_id': geofence.id,
          'latitude': location.latitude,
          'longitude': location.longitude,
        });
      }
    });

    await _service.start(geofences);
  }

  Future<void> stop() => _service.stop();
}
```

(`MobileApiClient` needs a small extension to call the Supabase Functions URL directly instead of the Next.js API base — add a `postFunction(String functionName, Map body)` method using `Env.supabaseUrl` + `/functions/v1/$functionName` with the same Bearer token.)

- [ ] **Step 1: Add `geofence_service`/`geolocator` permission entries to `Info.plist` and `AndroidManifest.xml`.**

- [ ] **Step 2: Write `geofence_repository.dart` and `geofence_manager.dart`.**

- [ ] **Step 3: Call `GeofenceManager().start()` from `customer_home_shell.dart`'s `initState`**, guarded so it only runs if the customer has at least one Pro+ business card (check `geofence_repository`'s fetch result isn't empty before calling `start()`).

- [ ] **Step 4: Manual test using iOS Simulator's simulated location** (Simulator menu → Features → Location → Custom Location, set coordinates within 300m of a test business's `latitude`/`longitude`)

Set a test business's lat/lng directly in Supabase Studio to match a known Simulator location, mark its plan as `pro`, run the app logged in as a customer with a card for that business, set the simulated location.
Expected: `geofence-checkin` Edge Function logs show an ENTER event handled (check `supabase functions logs geofence-checkin`), a row appears in `geofence_notifications`.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/geofence mobile/ios/Runner/Info.plist mobile/android/app/src/main/AndroidManifest.xml mobile/lib/customer/customer_home_shell.dart mobile/lib/data/mobile_api_client.dart
git commit -m "feat(mobile): geofence registration and check-in for Pro+ businesses"
```

### Task 6.2: Settings — per-business geofence toggle

**Files:**
- Create: `mobile/lib/customer/settings_screen.dart`

Lists the customer's Pro+ businesses with a `Switch` per business; off removes that single geofence id via `GeofenceManager` (re-fetch+restart with the filtered list) without touching the others, and persists the choice in a local `shared_preferences` set of disabled business ids consulted by `geofence_repository.dart`'s fetch before building the geofence list.

- [ ] **Step 1: Add `shared_preferences: ^2.3.3` to `pubspec.yaml`, `flutter pub get`.**

- [ ] **Step 2: Write `settings_screen.dart` and the `geofence_repository.dart` filter.**

- [ ] **Step 3: Manual test** — toggle a business off, confirm (via Simulator location re-entry) no new `geofence_notifications` row is created for that business; toggle back on, confirm it resumes.

- [ ] **Step 4: Commit**

```bash
git add mobile/pubspec.yaml mobile/pubspec.lock mobile/lib/customer/settings_screen.dart mobile/lib/geofence/geofence_repository.dart
git commit -m "feat(mobile): per-business geofence opt-out in customer settings"
```

---

## Phase 7 — Final verification pass

- [ ] **Step 1: Full regression on iOS Simulator** — run through both flows end-to-end in one session: owner login → dashboard → scanner → stamp a real card; customer claim → card view → (simulated) geofence entry → push received (if Phase 5 credentials are set up) or check-in logged (if not).
- [ ] **Step 2: `flutter analyze` in `mobile/`** — fix any warnings before calling this done.
- [ ] **Step 3: Confirm the web app still works unmodified** — `npm run dev`, click through `/scanner`, `/dashboard`, `/c/[slug]` once more (Task 1.3 touched shared logic).
- [ ] **Step 4: Final commit / summary** of what's demo-ready vs. what needs the user's Firebase/Apple credentials (Phase 5 Task 5.1) before it's fully live.
