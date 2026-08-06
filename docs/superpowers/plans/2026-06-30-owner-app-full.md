# FideliTap — Owner Mobile App Full Functionality

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner can create/edit/delete loyalty cards, view customers, and edit business settings entirely from the Flutter mobile app — same capabilities as the web dashboard.

**Architecture:** New Next.js API routes at `/api/mobile/*` handle CRUD using the existing `getMobileUser` + `createServiceClient` pattern. Flutter consumes them via `MobileApiClient`. Owner shell gets 5 tabs: Dashboard, Tarjetas, Clientes, Scanner, Ajustes.

**Tech Stack:** Flutter 3.x / Dart, Next.js 14 App Router Route Handlers, Supabase (RLS + RPCs), `MobileApiClient` (http package wrapper).

---

## File Map

### Backend — new files
| File | Responsibility |
|------|---------------|
| `src/app/api/mobile/cards/route.ts` | GET list + POST create |
| `src/app/api/mobile/cards/[id]/route.ts` | PATCH update + DELETE soft-delete |
| `src/app/api/mobile/customers/route.ts` | GET customer list via `get_customers_list` RPC |
| `src/app/api/mobile/settings/route.ts` | GET + PATCH business settings |

### Backend — modified files
| File | Change |
|------|--------|
| `src/types/database.ts` | none needed (already has all columns) |

### Flutter — new files
| File | Responsibility |
|------|---------------|
| `mobile/lib/owner/cards_screen.dart` | Card list with FAB, edit/delete |
| `mobile/lib/owner/card_form_sheet.dart` | Create/edit bottom sheet |
| `mobile/lib/owner/customers_screen.dart` | Customer list with stamp counts |
| `mobile/lib/owner/owner_settings_screen.dart` | Business settings form |

### Flutter — modified files
| File | Change |
|------|--------|
| `mobile/lib/data/mobile_api_client.dart` | Add `patch()`, typed model classes, new API methods |
| `mobile/lib/owner/owner_home_shell.dart` | 5-tab navigation |

---

## Task 1 — Add `patch()` to MobileApiClient + data models

**Files:**
- Modify: `mobile/lib/data/mobile_api_client.dart`

- [ ] **Replace the full file with this:**

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../core/supabase_client.dart';
import '../core/env.dart';

// ── Models ────────────────────────────────────────────────────────────────

class LoyaltyCardModel {
  final String id;
  final String name;
  final int stampsRequired;
  final String benefitDescription;
  final String stampIcon;
  final bool isActive;

  const LoyaltyCardModel({
    required this.id,
    required this.name,
    required this.stampsRequired,
    required this.benefitDescription,
    required this.stampIcon,
    required this.isActive,
  });

  factory LoyaltyCardModel.fromJson(Map<String, dynamic> j) => LoyaltyCardModel(
        id: j['id'] as String,
        name: j['name'] as String,
        stampsRequired: j['stamps_required'] as int,
        benefitDescription: j['benefit_description'] as String,
        stampIcon: (j['stamp_icon'] as String?) ?? '⭐',
        isActive: j['is_active'] as bool? ?? true,
      );
}

class CustomerModel {
  final String customerId;
  final String customerName;
  final String cardName;
  final String loyaltyCardId;
  final int currentStamps;
  final int stampsRequired;
  final int timesCompleted;
  final String? lastVisit;

  const CustomerModel({
    required this.customerId,
    required this.customerName,
    required this.cardName,
    required this.loyaltyCardId,
    required this.currentStamps,
    required this.stampsRequired,
    required this.timesCompleted,
    this.lastVisit,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> j) => CustomerModel(
        customerId: j['customer_id'] as String,
        customerName: j['customer_name'] as String,
        cardName: j['card_name'] as String,
        loyaltyCardId: j['loyalty_card_id'] as String,
        currentStamps: j['current_stamps'] as int,
        stampsRequired: j['stamps_required'] as int,
        timesCompleted: j['times_completed'] as int,
        lastVisit: j['last_visit'] as String?,
      );
}

class BusinessSettings {
  final String name;
  final String? address;
  final double? latitude;
  final double? longitude;
  final int stampCooldownSeconds;

  const BusinessSettings({
    required this.name,
    this.address,
    this.latitude,
    this.longitude,
    required this.stampCooldownSeconds,
  });

  factory BusinessSettings.fromJson(Map<String, dynamic> j) => BusinessSettings(
        name: j['name'] as String,
        address: j['address'] as String?,
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
        stampCooldownSeconds: j['stamp_cooldown_seconds'] as int? ?? 0,
      );
}

// ── HTTP Client ───────────────────────────────────────────────────────────

class MobileApiClient {
  String get _base => Env.apiBaseUrl;
  String get _supabaseBase => Env.supabaseUrl;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization':
            'Bearer ${supabase.auth.currentSession?.accessToken ?? ''}',
      };

  Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$_base$path'), headers: _headers);
    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$_base$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('$_base$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> delete(String path, [Map<String, dynamic>? body]) async {
    final req = http.Request('DELETE', Uri.parse('$_base$path'));
    _headers.forEach((k, v) => req.headers[k] = v);
    if (body != null) req.body = jsonEncode(body);
    final streamed = await req.send();
    final bytes = await streamed.stream.toBytes();
    final text = utf8.decode(bytes);
    if (text.isEmpty) return {};
    return jsonDecode(text) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> postFunction(
      String functionName, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$_supabaseBase/functions/v1/$functionName'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  // ── Typed API methods ─────────────────────────────────────────────────

  Future<List<LoyaltyCardModel>> getCards() async {
    final data = await get('/api/mobile/cards') as List<dynamic>;
    return data.map((e) => LoyaltyCardModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> createCard(Map<String, dynamic> body) =>
      post('/api/mobile/cards', body);

  Future<Map<String, dynamic>> updateCard(String id, Map<String, dynamic> body) =>
      patch('/api/mobile/cards/$id', body);

  Future<void> deleteCard(String id) => delete('/api/mobile/cards/$id');

  Future<List<CustomerModel>> getCustomers({String? cardId}) async {
    final path = cardId != null
        ? '/api/mobile/customers?card_id=$cardId'
        : '/api/mobile/customers';
    final data = await get(path) as List<dynamic>;
    return data.map((e) => CustomerModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<BusinessSettings> getSettings() async {
    final data = await get('/api/mobile/settings') as Map<String, dynamic>;
    return BusinessSettings.fromJson(data);
  }

  Future<Map<String, dynamic>> saveSettings(Map<String, dynamic> body) =>
      patch('/api/mobile/settings', body);
}
```

- [ ] **Commit**
```bash
git add mobile/lib/data/mobile_api_client.dart
git commit -m "feat(mobile): add patch(), typed models for cards/customers/settings"
```

---

## Task 2 — Backend: Cards CRUD routes

**Files:**
- Create: `src/app/api/mobile/cards/route.ts`
- Create: `src/app/api/mobile/cards/[id]/route.ts`

- [ ] **Create `src/app/api/mobile/cards/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const { data, error } = await serviceClient
    .from('loyalty_cards')
    .select('id, name, stamps_required, benefit_description, design_config, is_active, slug')
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Error al cargar tarjetas' }, { status: 500 })

  const cards = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    stamps_required: c.stamps_required,
    benefit_description: c.benefit_description,
    is_active: c.is_active,
    slug: c.slug,
    stamp_icon: (c.design_config as Record<string, string> | null)?.stamp_icon ?? '⭐',
    color: (c.design_config as Record<string, string> | null)?.color ?? '#00C896',
  }))

  return NextResponse.json(cards)
}

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { name, stamps_required, benefit_description, stamp_icon = '⭐', color = '#00C896' } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  if (!stamps_required || stamps_required < 2 || stamps_required > 50)
    return NextResponse.json({ error: 'Sellos: entre 2 y 50' }, { status: 400 })
  if (!benefit_description?.trim())
    return NextResponse.json({ error: 'Premio requerido' }, { status: 400 })

  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  // Plan limits check
  const { count } = await serviceClient
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .is('deleted_at', null)

  const limits: Record<string, number | null> = { free: 1, basic: 3, pro: 10, premium: null }
  const maxCards = limits[business.plan] ?? null
  if (maxCards !== null && (count ?? 0) >= maxCards)
    return NextResponse.json({ error: `Tu plan ${business.plan} permite máximo ${maxCards} tarjeta(s)` }, { status: 403 })

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`

  const design_config = {
    color,
    bg_type: 'solid',
    bg_value: '#0f172a',
    bg_image_url: null,
    stamp_icon,
    font: 'default',
    style: 'clean',
    bg_mode: 'dark',
    logo_url: null,
  }

  const { data, error } = await serviceClient
    .from('loyalty_cards')
    .insert({
      business_id: business.id,
      name: name.trim(),
      stamps_required: Number(stamps_required),
      benefit_description: benefit_description.trim(),
      design_config,
      slug,
    })
    .select('id, name, stamps_required, benefit_description, is_active')
    .single()

  if (error) return NextResponse.json({ error: 'Error al crear tarjeta' }, { status: 500 })
  return NextResponse.json({ ...data, stamp_icon, color }, { status: 201 })
}
```

- [ ] **Create `src/app/api/mobile/cards/[id]/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

async function getOwnedCard(userId: string, cardId: string) {
  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .single()
  if (!business) return null

  const { data: card } = await serviceClient
    .from('loyalty_cards')
    .select('id, business_id, name, stamps_required, benefit_description, design_config, is_active')
    .eq('id', cardId)
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .single()

  return card ? { card, serviceClient } : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const owned = await getOwnedCard(user.id, params.id)
  if (!owned) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const body = await req.json()
  const { name, stamps_required, benefit_description, stamp_icon, color } = body

  const existingConfig = owned.card.design_config as Record<string, unknown> ?? {}
  const update: Record<string, unknown> = {}
  if (name?.trim()) update.name = name.trim()
  if (stamps_required && stamps_required >= 2 && stamps_required <= 50)
    update.stamps_required = Number(stamps_required)
  if (benefit_description?.trim()) update.benefit_description = benefit_description.trim()
  if (stamp_icon || color) {
    update.design_config = {
      ...existingConfig,
      ...(stamp_icon ? { stamp_icon } : {}),
      ...(color ? { color } : {}),
    }
  }

  const { data, error } = await owned.serviceClient
    .from('loyalty_cards')
    .update(update)
    .eq('id', params.id)
    .select('id, name, stamps_required, benefit_description, is_active, design_config')
    .single()

  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

  const cfg = data.design_config as Record<string, string> | null
  return NextResponse.json({ ...data, stamp_icon: cfg?.stamp_icon ?? '⭐', color: cfg?.color ?? '#00C896' })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const owned = await getOwnedCard(user.id, params.id)
  if (!owned) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const { error } = await owned.serviceClient
    .from('loyalty_cards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Commit**
```bash
git add src/app/api/mobile/cards/
git commit -m "feat(api): mobile cards CRUD — GET list, POST create, PATCH update, DELETE soft-delete"
```

---

## Task 3 — Backend: Customers + Settings routes

**Files:**
- Create: `src/app/api/mobile/customers/route.ts`
- Create: `src/app/api/mobile/settings/route.ts`

- [ ] **Create `src/app/api/mobile/customers/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const cardId = req.nextUrl.searchParams.get('card_id') ?? undefined

  const { data, error } = await serviceClient.rpc('get_customers_list', {
    p_business_id: business.id,
    ...(cardId ? { p_card_id: cardId } : {}),
  })

  if (error) return NextResponse.json({ error: 'Error al cargar clientes' }, { status: 500 })
  return NextResponse.json(data ?? [])
}
```

- [ ] **Create `src/app/api/mobile/settings/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('businesses')
    .select('name, address, latitude, longitude, stamp_cooldown_seconds, plan, email')
    .eq('owner_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const { name, address, latitude, longitude, stamp_cooldown_seconds } = body

  const update: Record<string, unknown> = {}
  if (name?.trim()) update.name = name.trim()
  if (address !== undefined) update.address = address || null
  if (latitude !== undefined) update.latitude = latitude ? Number(latitude) : null
  if (longitude !== undefined) update.longitude = longitude ? Number(longitude) : null
  if (stamp_cooldown_seconds !== undefined) {
    const allowed = [0, 60, 300, 900, 3600, 86400]
    if (allowed.includes(Number(stamp_cooldown_seconds)))
      update.stamp_cooldown_seconds = Number(stamp_cooldown_seconds)
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 })

  const serviceClient = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (serviceClient.from('businesses') as any)
    .update(update)
    .eq('owner_id', user.id)
    .select('name, address, latitude, longitude, stamp_cooldown_seconds')
    .single()

  if (error) return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Commit**
```bash
git add src/app/api/mobile/customers/route.ts src/app/api/mobile/settings/route.ts
git commit -m "feat(api): mobile customers list + business settings GET/PATCH"
```

---

## Task 4 — Flutter: Cards Screen + Card Form Sheet

**Files:**
- Create: `mobile/lib/owner/cards_screen.dart`
- Create: `mobile/lib/owner/card_form_sheet.dart`

- [ ] **Create `mobile/lib/owner/card_form_sheet.dart`:**

```dart
import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';

const _icons = ['⭐', '☕', '🍕', '🥖', '🍔', '🍦', '🎯', '💎', '🔥', '🌟', '🎁', '🏆'];
const _colors = ['#00C896', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

class CardFormSheet extends StatefulWidget {
  final LoyaltyCardModel? existing;
  final VoidCallback onSaved;
  const CardFormSheet({super.key, this.existing, required this.onSaved});

  @override
  State<CardFormSheet> createState() => _CardFormSheetState();
}

class _CardFormSheetState extends State<CardFormSheet> {
  final _name = TextEditingController();
  final _benefit = TextEditingController();
  int _stamps = 8;
  String _icon = '⭐';
  String _color = '#00C896';
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.existing != null) {
      final c = widget.existing!;
      _name.text = c.name;
      _benefit.text = c.benefitDescription;
      _stamps = c.stampsRequired;
      _icon = c.stampIcon;
      _color = _colors.contains(c.stampIcon) ? c.stampIcon : '#00C896';
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _benefit.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final benefit = _benefit.text.trim();
    if (name.isEmpty) { setState(() => _error = 'Ingresa un nombre'); return; }
    if (benefit.isEmpty) { setState(() => _error = 'Ingresa el premio'); return; }

    setState(() { _saving = true; _error = null; });
    try {
      final body = {
        'name': name,
        'stamps_required': _stamps,
        'benefit_description': benefit,
        'stamp_icon': _icon,
        'color': _color,
      };
      Map<String, dynamic> res;
      if (widget.existing != null) {
        res = await MobileApiClient().updateCard(widget.existing!.id, body);
      } else {
        res = await MobileApiClient().createCard(body);
      }
      if (res.containsKey('error')) {
        setState(() { _error = res['error'] as String; _saving = false; });
        return;
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (e) {
      setState(() { _error = e.toString(); _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existing != null;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(isEdit ? 'Editar tarjeta' : 'Nueva tarjeta',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
          const SizedBox(height: 20),
          TextField(
            controller: _name,
            style: const TextStyle(color: Colors.white),
            decoration: _inputDec('Nombre de la tarjeta'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _benefit,
            style: const TextStyle(color: Colors.white),
            decoration: _inputDec('Premio (ej: Café gratis)'),
          ),
          const SizedBox(height: 16),
          Row(children: [
            const Text('Sellos requeridos:', style: TextStyle(color: Color(0xFF94A3B8))),
            const Spacer(),
            IconButton(
              onPressed: _stamps > 2 ? () => setState(() => _stamps--) : null,
              icon: const Icon(Icons.remove_circle_outline, color: Color(0xFF00C896)),
            ),
            Text('$_stamps', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
            IconButton(
              onPressed: _stamps < 50 ? () => setState(() => _stamps++) : null,
              icon: const Icon(Icons.add_circle_outline, color: Color(0xFF00C896)),
            ),
          ]),
          const SizedBox(height: 12),
          const Text('Ícono del sello', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: _icons.map((ic) => GestureDetector(
              onTap: () => setState(() => _icon = ic),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: _icon == ic ? const Color(0xFF00C896).withOpacity(0.2) : const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _icon == ic ? const Color(0xFF00C896) : Colors.transparent),
                ),
                child: Text(ic, style: const TextStyle(fontSize: 20)),
              ),
            )).toList(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13)),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF00C896)),
              child: _saving
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                  : Text(isEdit ? 'Guardar cambios' : 'Crear tarjeta',
                      style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDec(String hint) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF64748B)),
        filled: true,
        fillColor: const Color(0xFF1E293B),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      );
}
```

- [ ] **Create `mobile/lib/owner/cards_screen.dart`:**

```dart
import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';
import 'card_form_sheet.dart';

class CardsScreen extends StatefulWidget {
  const CardsScreen({super.key});
  @override
  State<CardsScreen> createState() => _CardsScreenState();
}

class _CardsScreenState extends State<CardsScreen> {
  List<LoyaltyCardModel> _cards = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final cards = await MobileApiClient().getCards();
      setState(() { _cards = cards; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _openForm([LoyaltyCardModel? card]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => CardFormSheet(existing: card, onSaved: _load),
    );
  }

  Future<void> _delete(LoyaltyCardModel card) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text('¿Eliminar tarjeta?', style: TextStyle(color: Colors.white)),
        content: Text('Se eliminará "${card.name}". Los clientes existentes conservarán su historial.',
            style: const TextStyle(color: Color(0xFF94A3B8))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Eliminar', style: TextStyle(color: Color(0xFFEF4444))),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await MobileApiClient().deleteCard(card.id);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis tarjetas'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(),
        backgroundColor: const Color(0xFF00C896),
        foregroundColor: Colors.black,
        icon: const Icon(Icons.add),
        label: const Text('Nueva tarjeta', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
          : _error != null
              ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('Error: $_error', style: const TextStyle(color: Color(0xFF94A3B8))),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: _load, child: const Text('Reintentar')),
                ]))
              : _cards.isEmpty
                  ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Text('🎴', style: TextStyle(fontSize: 48)),
                      const SizedBox(height: 12),
                      const Text('Aún no tienes tarjetas', style: TextStyle(color: Colors.white, fontSize: 16)),
                      const SizedBox(height: 8),
                      const Text('Crea tu primera tarjeta de fidelidad', style: TextStyle(color: Color(0xFF94A3B8))),
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        onPressed: () => _openForm(),
                        icon: const Icon(Icons.add),
                        label: const Text('Crear tarjeta'),
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFF00C896), foregroundColor: Colors.black),
                      ),
                    ]))
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: const Color(0xFF00C896),
                      child: ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                        itemCount: _cards.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => _CardTile(
                          card: _cards[i],
                          onEdit: () => _openForm(_cards[i]),
                          onDelete: () => _delete(_cards[i]),
                        ),
                      ),
                    ),
    );
  }
}

class _CardTile extends StatelessWidget {
  final LoyaltyCardModel card;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _CardTile({required this.card, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(children: [
        Text(card.stampIcon, style: const TextStyle(fontSize: 32)),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(card.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 4),
          Text('${card.stampsRequired} sellos · ${card.benefitDescription}',
              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
        ])),
        PopupMenuButton<String>(
          color: const Color(0xFF1E293B),
          onSelected: (v) => v == 'edit' ? onEdit() : onDelete(),
          itemBuilder: (_) => [
            const PopupMenuItem(value: 'edit', child: Row(children: [
              Icon(Icons.edit_outlined, size: 18, color: Colors.white), SizedBox(width: 8),
              Text('Editar', style: TextStyle(color: Colors.white)),
            ])),
            const PopupMenuItem(value: 'delete', child: Row(children: [
              Icon(Icons.delete_outline, size: 18, color: Color(0xFFEF4444)), SizedBox(width: 8),
              Text('Eliminar', style: TextStyle(color: Color(0xFFEF4444))),
            ])),
          ],
          icon: const Icon(Icons.more_vert, color: Color(0xFF64748B)),
        ),
      ]),
    );
  }
}
```

- [ ] **Commit**
```bash
git add mobile/lib/owner/cards_screen.dart mobile/lib/owner/card_form_sheet.dart
git commit -m "feat(mobile): cards screen — list, create, edit, delete loyalty cards"
```

---

## Task 5 — Flutter: Customers Screen

**Files:**
- Create: `mobile/lib/owner/customers_screen.dart`

- [ ] **Create `mobile/lib/owner/customers_screen.dart`:**

```dart
import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});
  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  List<CustomerModel> _all = [];
  List<CustomerModel> _filtered = [];
  List<LoyaltyCardModel> _cards = [];
  String? _selectedCardId;
  bool _loading = true;
  String? _error;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _search.addListener(_filter);
  }

  @override
  void dispose() { _search.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        MobileApiClient().getCustomers(cardId: _selectedCardId),
        MobileApiClient().getCards(),
      ]);
      final customers = results[0] as List<CustomerModel>;
      final cards = results[1] as List<LoyaltyCardModel>;
      setState(() {
        _all = customers;
        _cards = cards;
        _loading = false;
      });
      _filter();
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _filter() {
    final q = _search.text.toLowerCase();
    setState(() {
      _filtered = q.isEmpty
          ? List.of(_all)
          : _all.where((c) => c.customerName.toLowerCase().contains(q)).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Clientes'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            controller: _search,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Buscar cliente...',
              hintStyle: const TextStyle(color: Color(0xFF64748B)),
              prefixIcon: const Icon(Icons.search, color: Color(0xFF64748B)),
              filled: true,
              fillColor: const Color(0xFF1E293B),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            ),
          ),
        ),
        if (_cards.length > 1)
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              children: [
                _FilterChip(label: 'Todas', selected: _selectedCardId == null,
                    onTap: () { setState(() => _selectedCardId = null); _load(); }),
                ..._cards.map((c) => _FilterChip(
                  label: c.name,
                  selected: _selectedCardId == c.id,
                  onTap: () { setState(() => _selectedCardId = c.id); _load(); },
                )),
              ],
            ),
          ),
        const SizedBox(height: 8),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
              : _error != null
                  ? Center(child: Text('Error: $_error', style: const TextStyle(color: Color(0xFF94A3B8))))
                  : _filtered.isEmpty
                      ? const Center(child: Text('Sin clientes', style: TextStyle(color: Color(0xFF94A3B8))))
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: const Color(0xFF00C896),
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                            itemCount: _filtered.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (_, i) => _CustomerTile(customer: _filtered[i]),
                          ),
                        ),
        ),
      ]),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF00C896) : const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label,
            style: TextStyle(
              color: selected ? Colors.black : const Color(0xFF94A3B8),
              fontWeight: selected ? FontWeight.bold : FontWeight.normal,
              fontSize: 13,
            )),
      ),
    );
  }
}

class _CustomerTile extends StatelessWidget {
  final CustomerModel customer;
  const _CustomerTile({required this.customer});

  @override
  Widget build(BuildContext context) {
    final pct = customer.stampsRequired > 0
        ? customer.currentStamps / customer.stampsRequired
        : 0.0;
    final isReady = customer.currentStamps >= customer.stampsRequired;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(14),
        border: isReady ? Border.all(color: const Color(0xFFF59E0B), width: 1.5) : null,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFF0F172A),
            child: Text(customer.customerName[0].toUpperCase(),
                style: const TextStyle(color: Color(0xFF00C896), fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(customer.customerName,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            Text(customer.cardName, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
          ])),
          if (isReady)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text('🏆 Premio', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 11, fontWeight: FontWeight.bold)),
            )
          else
            Text('${customer.currentStamps}/${customer.stampsRequired}',
                style: const TextStyle(color: Color(0xFF00C896), fontWeight: FontWeight.bold)),
        ]),
        const SizedBox(height: 10),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct.clamp(0.0, 1.0),
            backgroundColor: const Color(0xFF0F172A),
            valueColor: AlwaysStoppedAnimation(isReady ? const Color(0xFFF59E0B) : const Color(0xFF00C896)),
            minHeight: 6,
          ),
        ),
        if (customer.timesCompleted > 0) ...[
          const SizedBox(height: 6),
          Text('${customer.timesCompleted} canje${customer.timesCompleted != 1 ? 's' : ''} completados',
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
        ],
      ]),
    );
  }
}
```

- [ ] **Commit**
```bash
git add mobile/lib/owner/customers_screen.dart
git commit -m "feat(mobile): customers screen with search, card filter, stamp progress"
```

---

## Task 6 — Flutter: Owner Settings Screen

**Files:**
- Create: `mobile/lib/owner/owner_settings_screen.dart`

- [ ] **Create `mobile/lib/owner/owner_settings_screen.dart`:**

```dart
import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';
import '../core/supabase_client.dart';

class OwnerSettingsScreen extends StatefulWidget {
  const OwnerSettingsScreen({super.key});
  @override
  State<OwnerSettingsScreen> createState() => _OwnerSettingsScreenState();
}

class _OwnerSettingsScreenState extends State<OwnerSettingsScreen> {
  final _name = TextEditingController();
  final _address = TextEditingController();
  BusinessSettings? _settings;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;
  int _cooldown = 0;

  static const _cooldownOptions = [
    (label: 'Sin cooldown', value: 0),
    (label: '1 minuto', value: 60),
    (label: '5 minutos', value: 300),
    (label: '15 minutos', value: 900),
    (label: '1 hora', value: 3600),
    (label: '1 día', value: 86400),
  ];

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _name.dispose(); _address.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final s = await MobileApiClient().getSettings();
      setState(() {
        _settings = s;
        _name.text = s.name;
        _address.text = s.address ?? '';
        _cooldown = s.stampCooldownSeconds;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'El nombre no puede estar vacío');
      return;
    }
    setState(() { _saving = true; _error = null; _success = null; });
    try {
      final res = await MobileApiClient().saveSettings({
        'name': _name.text.trim(),
        'address': _address.text.trim().isEmpty ? null : _address.text.trim(),
        'stamp_cooldown_seconds': _cooldown,
      });
      if (res.containsKey('error')) {
        setState(() { _error = res['error'] as String; _saving = false; });
      } else {
        setState(() { _success = 'Guardado correctamente'; _saving = false; });
      }
    } catch (e) {
      setState(() { _error = e.toString(); _saving = false; });
    }
  }

  Future<void> _logout() async {
    await supabase.auth.signOut();
    if (mounted) Navigator.of(context).pushReplacementNamed('/');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ajustes'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF00C896)))
                : const Text('Guardar', style: TextStyle(color: Color(0xFF00C896), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _section('Datos del negocio'),
                const SizedBox(height: 12),
                TextField(
                  controller: _name,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDec('Nombre del negocio', Icons.store_outlined),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _address,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDec('Dirección (opcional)', Icons.location_on_outlined),
                ),
                const SizedBox(height: 24),
                _section('Scanner'),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<int>(
                      value: _cooldown,
                      dropdownColor: const Color(0xFF1E293B),
                      style: const TextStyle(color: Colors.white),
                      items: _cooldownOptions.map((o) => DropdownMenuItem(
                        value: o.value,
                        child: Text(o.label),
                      )).toList(),
                      onChanged: (v) => setState(() => _cooldown = v ?? 0),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Text('Tiempo mínimo entre sellos para el mismo cliente',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
                  ),
                ],
                if (_success != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF00C896).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(_success!, style: const TextStyle(color: Color(0xFF00C896))),
                  ),
                ],
                const SizedBox(height: 40),
                _section('Plan'),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFF1E293B), borderRadius: BorderRadius.circular(12)),
                  child: Row(children: [
                    const Icon(Icons.workspace_premium_outlined, color: Color(0xFF00C896)),
                    const SizedBox(width: 12),
                    Text(
                      (_settings?.name != null ? '' : '') + 'Plan activo',
                      style: const TextStyle(color: Colors.white),
                    ),
                  ]),
                ),
                const SizedBox(height: 40),
                OutlinedButton.icon(
                  onPressed: _logout,
                  icon: const Icon(Icons.logout, color: Color(0xFFEF4444)),
                  label: const Text('Cerrar sesión', style: TextStyle(color: Color(0xFFEF4444))),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFEF4444)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _section(String title) => Text(title,
      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.8));

  InputDecoration _inputDec(String hint, IconData icon) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF64748B)),
        prefixIcon: Icon(icon, color: const Color(0xFF64748B), size: 20),
        filled: true,
        fillColor: const Color(0xFF1E293B),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      );
}
```

- [ ] **Commit**
```bash
git add mobile/lib/owner/owner_settings_screen.dart
git commit -m "feat(mobile): owner settings screen — name, address, cooldown, logout"
```

---

## Task 7 — Flutter: Wire up 5-tab Owner Shell

**Files:**
- Modify: `mobile/lib/owner/owner_home_shell.dart`

- [ ] **Replace the full file:**

```dart
import 'package:flutter/material.dart';
import 'dashboard_screen.dart';
import 'scanner_screen.dart';
import 'cards_screen.dart';
import 'customers_screen.dart';
import 'owner_settings_screen.dart';

class OwnerHomeShell extends StatefulWidget {
  const OwnerHomeShell({super.key});
  @override
  State<OwnerHomeShell> createState() => _OwnerHomeShellState();
}

class _OwnerHomeShellState extends State<OwnerHomeShell> {
  int _tab = 0;

  final _screens = const [
    DashboardScreen(),
    CardsScreen(),
    ScannerScreen(),
    CustomersScreen(),
    OwnerSettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _tab, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: const Color(0xFF1E293B),
        indicatorColor: const Color(0xFF00C896).withOpacity(0.15),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart, color: Color(0xFF00C896)),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.credit_card_outlined),
            selectedIcon: Icon(Icons.credit_card, color: Color(0xFF00C896)),
            label: 'Tarjetas',
          ),
          NavigationDestination(
            icon: Icon(Icons.qr_code_scanner_outlined),
            selectedIcon: Icon(Icons.qr_code_scanner, color: Color(0xFF00C896)),
            label: 'Scanner',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline),
            selectedIcon: Icon(Icons.people, color: Color(0xFF00C896)),
            label: 'Clientes',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings, color: Color(0xFF00C896)),
            label: 'Ajustes',
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Move logout out of DashboardScreen AppBar** — edit `mobile/lib/owner/dashboard_screen.dart`, remove the logout IconButton from its AppBar (logout now lives in OwnerSettingsScreen):

```dart
// In dashboard_screen.dart — replace AppBar actions list:
actions: [
  IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
],
```

- [ ] **Hot restart Flutter** (`R` in the terminal running flutter run) to pick up new files.

- [ ] **Commit**
```bash
git add mobile/lib/owner/owner_home_shell.dart mobile/lib/owner/dashboard_screen.dart
git commit -m "feat(mobile): 5-tab owner shell — Dashboard, Tarjetas, Scanner, Clientes, Ajustes"
```

---

## Task 8 — Verify end-to-end

- [ ] **Test: Create a card**
  - Tap "Tarjetas" tab → FAB "Nueva tarjeta"
  - Fill: name "Café test", stamps 6, benefit "Café gratis", icon ☕ → "Crear tarjeta"
  - Card appears in list

- [ ] **Test: Edit a card**
  - Tap `⋮` on the card → "Editar" → change name → "Guardar cambios"
  - List refreshes with new name

- [ ] **Test: Delete a card**
  - Tap `⋮` → "Eliminar" → confirm
  - Card disappears from list

- [ ] **Test: View customers**
  - Tab "Clientes" → should show Ana, Carlos (0 stamps after claim), María
  - Progress bars visible, Carlos shows 0/8, Ana shows 5/8

- [ ] **Test: Settings**
  - Tab "Ajustes" → business name shown → change it → "Guardar"
  - See "Guardado correctamente" banner

- [ ] **Test: Scanner**
  - Scan or type `DEMO-ANA-001` → should add stamp (now 6/8)
  - Type `DEMO-CARLOS-002` after a db reset → claim button appears

- [ ] **Final commit with test results note**
```bash
git add -A
git commit -m "test: verify owner app full flow — cards CRUD, customers, settings, scanner all working"
```
