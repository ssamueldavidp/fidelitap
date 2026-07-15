# Tarjetas Avanzadas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-level rewards, logo upload, advanced background/design options, card expiry, and live card preview to the card designer — both API and Flutter UI.

**Architecture:** New `card_rewards` table holds per-level reward definitions. `loyalty_cards` gets three new columns (`logo_url`, `expires_at`, `max_uses_per_customer`). `design_config` jsonb gains `bg_type/bg_value/font/multi_rewards` keys. The Flutter card form becomes a full-page sheet with a live `CardPreviewWidget`. All API routes for cards are extended to handle rewards in the same request.

**Tech Stack:** Next.js 14 API routes, Supabase (postgres + storage), Flutter 3.x / Dart 3.11, `image_picker` Flutter package.

**Spec:** `docs/superpowers/specs/2026-07-15-fidelitap-mobile-v2-design.md` — Sub-proyecto 1

---

## File Map

| Action | Path |
|---|---|
| Create | `supabase/migrations/20260715000001_card_rewards.sql` |
| Modify | `src/app/api/mobile/cards/route.ts` |
| Modify | `src/app/api/mobile/cards/[id]/route.ts` |
| Create | `src/app/api/mobile/upload/logo/route.ts` |
| Modify | `mobile/pubspec.yaml` |
| Modify | `mobile/lib/data/mobile_api_client.dart` |
| Create | `mobile/lib/owner/widgets/card_preview_widget.dart` |
| Modify | `mobile/lib/owner/card_form_sheet.dart` |
| Modify | `mobile/lib/customer/card_list_screen.dart` |
| Modify | `src/lib/wallet/apple.ts` |
| Modify | `src/lib/wallet/google.ts` |

---

## Task 1: DB migration — card_rewards + loyalty_cards columns

**Files:**
- Create: `supabase/migrations/20260715000001_card_rewards.sql`

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260715000001_card_rewards.sql

-- New columns on loyalty_cards
alter table public.loyalty_cards
  add column if not exists logo_url              text,
  add column if not exists expires_at            timestamptz,
  add column if not exists max_uses_per_customer int;

-- Multi-level rewards table
create table if not exists public.card_rewards (
  id              uuid primary key default gen_random_uuid(),
  loyalty_card_id uuid references public.loyalty_cards(id) on delete cascade not null,
  stamps_required int not null check (stamps_required > 0),
  reward_label    text not null,
  color           text not null default '#00C896',
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_card_rewards_loyalty_card
  on public.card_rewards(loyalty_card_id, sort_order);

alter table public.card_rewards enable row level security;

-- Only the business owner can read/write rewards
create policy "card_rewards: owner can read"
  on public.card_rewards for select
  using (
    exists (
      select 1 from public.loyalty_cards lc
      join public.businesses b on b.id = lc.business_id
      where lc.id = card_rewards.loyalty_card_id
        and b.owner_id = auth.uid()
    )
  );

create policy "card_rewards: owner can insert"
  on public.card_rewards for insert
  with check (
    exists (
      select 1 from public.loyalty_cards lc
      join public.businesses b on b.id = lc.business_id
      where lc.id = card_rewards.loyalty_card_id
        and b.owner_id = auth.uid()
    )
  );

create policy "card_rewards: owner can update"
  on public.card_rewards for update
  using (
    exists (
      select 1 from public.loyalty_cards lc
      join public.businesses b on b.id = lc.business_id
      where lc.id = card_rewards.loyalty_card_id
        and b.owner_id = auth.uid()
    )
  );

create policy "card_rewards: owner can delete"
  on public.card_rewards for delete
  using (
    exists (
      select 1 from public.loyalty_cards lc
      join public.businesses b on b.id = lc.business_id
      where lc.id = card_rewards.loyalty_card_id
        and b.owner_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration**

```bash
cd /Users/samuelrodriguez/development/fidelitap
npx supabase db push --local
```

Expected: `Applied 1 migration(s)` with no errors.

- [ ] **Step 3: Verify table exists**

```bash
npx supabase db diff --local 2>/dev/null | grep card_rewards || \
  npx supabase sql --local "select count(*) from public.card_rewards;"
```

Expected: `count = 0` (empty table, no error).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260715000001_card_rewards.sql
git commit -m "feat: add card_rewards table and loyalty_cards advanced columns"
```

---

## Task 2: API — GET /api/mobile/cards with rewards

**Files:**
- Modify: `src/app/api/mobile/cards/route.ts`

- [ ] **Step 1: Update GET to include card_rewards**

Replace the `select` call and the `cards` mapping in the GET handler with:

```typescript
  const { data, error } = await serviceClient
    .from('loyalty_cards')
    .select(`
      id, name, stamps_required, benefit_description,
      design_config, is_active, slug, logo_url, expires_at, max_uses_per_customer,
      card_rewards (
        id, stamps_required, reward_label, color, sort_order
      )
    `)
    .eq('business_id', business.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Error al cargar tarjetas' }, { status: 500 })

  type RawReward = { id: string; stamps_required: number; reward_label: string; color: string; sort_order: number }
  type RawCard = typeof data extends (infer T)[] ? T : never

  const cards = (data ?? []).map((c: RawCard) => {
    const cfg = (c.design_config as Record<string, string | boolean | null> | null) ?? {}
    const rewards = ((c.card_rewards as RawReward[] | null) ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
    return {
      id: c.id,
      name: c.name,
      stamps_required: c.stamps_required,
      benefit_description: c.benefit_description,
      is_active: c.is_active,
      slug: c.slug,
      logo_url: c.logo_url ?? null,
      expires_at: c.expires_at ?? null,
      max_uses_per_customer: c.max_uses_per_customer ?? null,
      stamp_icon: (cfg.stamp_icon as string) ?? '⭐',
      color: (cfg.color as string) ?? '#00C896',
      bg_type: (cfg.bg_type as string) ?? 'solid',
      bg_value: (cfg.bg_value as string) ?? '#0f172a',
      bg_image_url: (cfg.bg_image_url as string | null) ?? null,
      font: (cfg.font as string) ?? 'default',
      multi_rewards: (cfg.multi_rewards as boolean) ?? false,
      rewards,
    }
  })

  return NextResponse.json(cards)
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/samuelrodriguez/development/fidelitap
npx tsc --noEmit 2>&1 | grep -E "cards/route|error TS" | head -10
```

Expected: no output (no errors in that file).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mobile/cards/route.ts
git commit -m "feat: GET /api/mobile/cards includes card_rewards and new design fields"
```

---

## Task 3: API — POST /api/mobile/cards with rewards[]

**Files:**
- Modify: `src/app/api/mobile/cards/route.ts` (POST handler)

- [ ] **Step 1: Update POST to accept rewards[] and new design fields**

Replace the entire POST handler body (after the `export async function POST`) with:

```typescript
export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await req.json()
  const {
    name,
    stamps_required,
    benefit_description,
    stamp_icon = '⭐',
    color = '#00C896',
    bg_type = 'solid',
    bg_value = '#0f172a',
    bg_image_url = null,
    font = 'default',
    logo_url = null,
    expires_at = null,
    max_uses_per_customer = null,
    multi_rewards = false,
    rewards = [],
  } = body

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

  const { count } = await serviceClient
    .from('loyalty_cards')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', business.id)
    .is('deleted_at', null)

  const limits: Record<string, number | null> = { free: 1, basic: 3, pro: 10, premium: null }
  const maxCards = limits[business.plan] ?? null
  if (maxCards !== null && (count ?? 0) >= maxCards)
    return NextResponse.json(
      { error: `Tu plan ${business.plan} permite máximo ${maxCards} tarjeta(s)` },
      { status: 403 }
    )

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now().toString(36)}`

  const design_config = {
    color,
    bg_type,
    bg_value,
    bg_image_url,
    stamp_icon,
    font,
    multi_rewards,
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
      logo_url: logo_url ?? null,
      expires_at: expires_at ?? null,
      max_uses_per_customer: max_uses_per_customer ? Number(max_uses_per_customer) : null,
    })
    .select('id, name, stamps_required, benefit_description, is_active')
    .single()

  if (error) return NextResponse.json({ error: 'Error al crear tarjeta' }, { status: 500 })

  // Insert rewards if multi_rewards and rewards array provided
  if (multi_rewards && Array.isArray(rewards) && rewards.length > 0) {
    const rewardRows = rewards.map((r: { stamps_required: number; reward_label: string; color?: string }, i: number) => ({
      loyalty_card_id: data.id,
      stamps_required: Number(r.stamps_required),
      reward_label: String(r.reward_label),
      color: r.color ?? '#00C896',
      sort_order: i,
    }))
    await serviceClient.from('card_rewards').insert(rewardRows)
  }

  return NextResponse.json({ ...data, stamp_icon, color, rewards: rewards ?? [] }, { status: 201 })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "cards/route|error TS" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mobile/cards/route.ts
git commit -m "feat: POST /api/mobile/cards accepts rewards[], bg_type, logo_url, expires_at"
```

---

## Task 4: API — PATCH /api/mobile/cards/[id] with rewards[]

**Files:**
- Modify: `src/app/api/mobile/cards/[id]/route.ts`

- [ ] **Step 1: Update PATCH to handle new fields and rewards upsert**

Replace the entire PATCH handler with:

```typescript
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const owned = await getOwnedCard(user.id, params.id)
  if (!owned) return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 })

  const body = await req.json()
  const {
    name,
    stamps_required,
    benefit_description,
    stamp_icon,
    color,
    bg_type,
    bg_value,
    bg_image_url,
    font,
    logo_url,
    expires_at,
    max_uses_per_customer,
    multi_rewards,
    rewards,
  } = body

  const existingConfig = (owned.card.design_config as Record<string, unknown>) ?? {}
  const update: Record<string, unknown> = {}

  if (name?.trim()) update.name = name.trim()
  if (stamps_required && stamps_required >= 2 && stamps_required <= 50)
    update.stamps_required = Number(stamps_required)
  if (benefit_description?.trim()) update.benefit_description = benefit_description.trim()
  if (logo_url !== undefined) update.logo_url = logo_url
  if (expires_at !== undefined) update.expires_at = expires_at
  if (max_uses_per_customer !== undefined)
    update.max_uses_per_customer = max_uses_per_customer ? Number(max_uses_per_customer) : null

  const designUpdate: Record<string, unknown> = { ...existingConfig }
  if (stamp_icon) designUpdate.stamp_icon = stamp_icon
  if (color) designUpdate.color = color
  if (bg_type) designUpdate.bg_type = bg_type
  if (bg_value) designUpdate.bg_value = bg_value
  if (bg_image_url !== undefined) designUpdate.bg_image_url = bg_image_url
  if (font) designUpdate.font = font
  if (multi_rewards !== undefined) designUpdate.multi_rewards = multi_rewards
  update.design_config = designUpdate

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (owned.serviceClient.from('loyalty_cards') as any)
    .update(update)
    .eq('id', params.id)
    .select('id, name, stamps_required, benefit_description, is_active, design_config, logo_url, expires_at, max_uses_per_customer')
    .single()

  if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

  // Upsert rewards: delete all then re-insert (simpler than true upsert for ordered list)
  if (Array.isArray(rewards)) {
    await owned.serviceClient.from('card_rewards').delete().eq('loyalty_card_id', params.id)
    if (rewards.length > 0) {
      const rows = rewards.map((r: { stamps_required: number; reward_label: string; color?: string }, i: number) => ({
        loyalty_card_id: params.id,
        stamps_required: Number(r.stamps_required),
        reward_label: String(r.reward_label),
        color: r.color ?? '#00C896',
        sort_order: i,
      }))
      await owned.serviceClient.from('card_rewards').insert(rows)
    }
  }

  const cfg = data.design_config as Record<string, unknown> | null
  return NextResponse.json({
    ...data,
    stamp_icon: (cfg?.stamp_icon as string) ?? '⭐',
    color: (cfg?.color as string) ?? '#00C896',
  })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "cards/\[id\]|error TS" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/mobile/cards/[id]/route.ts"
git commit -m "feat: PATCH /api/mobile/cards/[id] handles rewards, bg_type, logo_url, expires_at"
```

---

## Task 5: API — POST /api/mobile/upload/logo

**Files:**
- Create: `src/app/api/mobile/upload/logo/route.ts`

The `card-logos` bucket already exists (migration `20260528000000_v2_card_logos_bucket.sql`).

- [ ] **Step 1: Create upload route**

```typescript
// src/app/api/mobile/upload/logo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile/auth'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const user = await getMobileUser(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const serviceClient = createServiceClient()
  const { data: business } = await serviceClient
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: 'Solo JPEG, PNG o WebP' }, { status: 400 })

  if (file.size > 2 * 1024 * 1024)
    return NextResponse.json({ error: 'Máximo 2 MB' }, { status: 400 })

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${business.id}/logo.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await serviceClient.storage
    .from('card-logos')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError)
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })

  const { data: urlData } = serviceClient.storage.from('card-logos').getPublicUrl(path)

  return NextResponse.json({ public_url: urlData.publicUrl }, { status: 201 })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "upload/logo|error TS" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mobile/upload/logo/route.ts
git commit -m "feat: POST /api/mobile/upload/logo — business logo to Supabase Storage"
```

---

## Task 6: Flutter — Add image_picker + update models

**Files:**
- Modify: `mobile/pubspec.yaml`
- Modify: `mobile/lib/data/mobile_api_client.dart`

- [ ] **Step 1: Add image_picker to pubspec.yaml**

In `mobile/pubspec.yaml`, under `dependencies:`, add after `url_launcher`:

```yaml
  image_picker: ^1.1.2
```

- [ ] **Step 2: Install**

```bash
cd /Users/samuelrodriguez/development/fidelitap/mobile
flutter pub get
```

Expected: `Got dependencies!`

- [ ] **Step 3: Add CardRewardModel to mobile_api_client.dart**

After the `LoyaltyCardModel` class, add:

```dart
class CardRewardModel {
  final String id;
  final int stampsRequired;
  final String rewardLabel;
  final String color;
  final int sortOrder;

  const CardRewardModel({
    required this.id,
    required this.stampsRequired,
    required this.rewardLabel,
    required this.color,
    required this.sortOrder,
  });

  factory CardRewardModel.fromJson(Map<String, dynamic> j) => CardRewardModel(
        id: j['id'] as String,
        stampsRequired: j['stamps_required'] as int,
        rewardLabel: j['reward_label'] as String,
        color: (j['color'] as String?) ?? '#00C896',
        sortOrder: (j['sort_order'] as int?) ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'stamps_required': stampsRequired,
        'reward_label': rewardLabel,
        'color': color,
        'sort_order': sortOrder,
      };
}
```

- [ ] **Step 4: Extend LoyaltyCardModel with new fields**

Replace the existing `LoyaltyCardModel` class with:

```dart
class LoyaltyCardModel {
  final String id;
  final String name;
  final int stampsRequired;
  final String benefitDescription;
  final String stampIcon;
  final String color;
  final String bgType;
  final String bgValue;
  final String? bgImageUrl;
  final String font;
  final String? logoUrl;
  final String? expiresAt;
  final int? maxUsesPerCustomer;
  final bool multiRewards;
  final bool isActive;
  final List<CardRewardModel> rewards;

  const LoyaltyCardModel({
    required this.id,
    required this.name,
    required this.stampsRequired,
    required this.benefitDescription,
    required this.stampIcon,
    required this.color,
    required this.bgType,
    required this.bgValue,
    this.bgImageUrl,
    required this.font,
    this.logoUrl,
    this.expiresAt,
    this.maxUsesPerCustomer,
    required this.multiRewards,
    required this.isActive,
    required this.rewards,
  });

  factory LoyaltyCardModel.fromJson(Map<String, dynamic> j) => LoyaltyCardModel(
        id: j['id'] as String,
        name: j['name'] as String,
        stampsRequired: j['stamps_required'] as int,
        benefitDescription: j['benefit_description'] as String,
        stampIcon: (j['stamp_icon'] as String?) ?? '⭐',
        color: (j['color'] as String?) ?? '#00C896',
        bgType: (j['bg_type'] as String?) ?? 'solid',
        bgValue: (j['bg_value'] as String?) ?? '#0f172a',
        bgImageUrl: j['bg_image_url'] as String?,
        font: (j['font'] as String?) ?? 'default',
        logoUrl: j['logo_url'] as String?,
        expiresAt: j['expires_at'] as String?,
        maxUsesPerCustomer: j['max_uses_per_customer'] as int?,
        multiRewards: (j['multi_rewards'] as bool?) ?? false,
        isActive: j['is_active'] as bool? ?? true,
        rewards: ((j['rewards'] as List<dynamic>?) ?? [])
            .map((e) => CardRewardModel.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
```

- [ ] **Step 5: Add uploadLogo method to MobileApiClient**

In `MobileApiClient`, add after the existing `postFunction` method:

```dart
Future<String> uploadLogo(List<int> bytes, String mimeType) async {
  final ext = mimeType.contains('png') ? 'png' : mimeType.contains('webp') ? 'webp' : 'jpg';
  final req = http.MultipartRequest(
    'POST',
    Uri.parse('$_base/api/mobile/upload/logo'),
  );
  req.headers['Authorization'] = 'Bearer ${supabase.auth.currentSession?.accessToken ?? ''}';
  req.files.add(http.MultipartFile.fromBytes('file', bytes,
      filename: 'logo.$ext',
      contentType: MediaType('image', ext)));
  final streamed = await req.send();
  final body = await streamed.stream.bytesToString();
  final json = jsonDecode(body) as Map<String, dynamic>;
  if (streamed.statusCode != 201) throw Exception(json['error'] ?? 'Upload failed');
  return json['public_url'] as String;
}
```

Add the `MediaType` import at the top of the file:

```dart
import 'package:http_parser/http_parser.dart';
```

Then add `http_parser` to pubspec.yaml dependencies (it ships with the `http` package, just needs the import):

```yaml
  http_parser: ^4.0.2
```

- [ ] **Step 6: Run flutter analyze**

```bash
cd /Users/samuelrodriguez/development/fidelitap/mobile
flutter analyze --no-pub 2>&1 | grep -E "error|warning" | grep -v "^Analyzing" | head -20
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/pubspec.yaml mobile/pubspec.lock mobile/lib/data/mobile_api_client.dart
git commit -m "feat: add CardRewardModel, extend LoyaltyCardModel, add uploadLogo method"
```

---

## Task 7: Flutter — CardPreviewWidget

**Files:**
- Create: `mobile/lib/owner/widgets/card_preview_widget.dart`

- [ ] **Step 1: Create the widget**

```dart
// mobile/lib/owner/widgets/card_preview_widget.dart
import 'package:flutter/material.dart';
import '../../data/mobile_api_client.dart';

Color _hexColor(String hex) {
  final h = hex.replaceAll('#', '');
  return Color(int.parse('FF$h', radix: 16));
}

class CardPreviewWidget extends StatelessWidget {
  final String name;
  final String stampIcon;
  final String color;
  final String bgType;
  final String bgValue;
  final String? bgImageUrl;
  final String? logoUrl;
  final bool multiRewards;
  final List<CardRewardModel> rewards;
  final int stampsRequired;
  final String benefitDescription;

  const CardPreviewWidget({
    super.key,
    required this.name,
    required this.stampIcon,
    required this.color,
    required this.bgType,
    required this.bgValue,
    this.bgImageUrl,
    this.logoUrl,
    required this.multiRewards,
    required this.rewards,
    required this.stampsRequired,
    required this.benefitDescription,
  });

  @override
  Widget build(BuildContext context) {
    final accentColor = _hexColor(color);
    final bgColor = _hexColor(bgValue);
    final sampleStamps = (stampsRequired * 0.6).ceil().clamp(1, stampsRequired);

    return Container(
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: 0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  name.isEmpty ? 'Nombre de tarjeta' : name,
                  style: TextStyle(
                    color: accentColor,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (logoUrl != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.network(logoUrl!, width: 36, height: 36, fit: BoxFit.cover),
                )
              else
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: accentColor.withValues(alpha: 0.3)),
                  ),
                  child: Center(child: Text(stampIcon, style: const TextStyle(fontSize: 18))),
                ),
            ],
          ),
          const SizedBox(height: 16),
          // Stamp grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: stampsRequired.clamp(3, 8),
              crossAxisSpacing: 6,
              mainAxisSpacing: 6,
            ),
            itemCount: stampsRequired,
            itemBuilder: (_, i) {
              final filled = i < sampleStamps;
              return Container(
                decoration: BoxDecoration(
                  color: filled
                      ? accentColor.withValues(alpha: 0.9)
                      : Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(8),
                  border: filled
                      ? null
                      : Border.all(
                          color: Colors.white.withValues(alpha: 0.1),
                          style: BorderStyle.solid,
                        ),
                ),
                child: Center(
                  child: Text(
                    stampIcon,
                    style: TextStyle(
                      fontSize: 14,
                      color: filled ? null : Colors.white.withValues(alpha: 0.2),
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          // Rewards section
          if (multiRewards && rewards.isNotEmpty)
            ...rewards.map((r) => _RewardBar(reward: r, sampleStamps: sampleStamps))
          else
            _RewardBar(
              reward: CardRewardModel(
                id: '',
                stampsRequired: stampsRequired,
                rewardLabel: benefitDescription.isEmpty ? 'Premio' : benefitDescription,
                color: color,
                sortOrder: 0,
              ),
              sampleStamps: sampleStamps,
            ),
        ],
      ),
    );
  }
}

class _RewardBar extends StatelessWidget {
  final CardRewardModel reward;
  final int sampleStamps;

  const _RewardBar({required this.reward, required this.sampleStamps});

  @override
  Widget build(BuildContext context) {
    final barColor = _hexColor(reward.color);
    final progress = (sampleStamps / reward.stampsRequired).clamp(0.0, 1.0);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.25),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '$sampleStamps/${reward.stampsRequired} sellos',
                  style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.5)),
                ),
                Text(
                  reward.rewardLabel,
                  style: TextStyle(fontSize: 11, color: barColor, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: Colors.white.withValues(alpha: 0.1),
                valueColor: AlwaysStoppedAnimation<Color>(barColor),
                minHeight: 4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Run flutter analyze**

```bash
cd /Users/samuelrodriguez/development/fidelitap/mobile
flutter analyze --no-pub 2>&1 | grep "error" | grep -v "^Analyzing" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/owner/widgets/card_preview_widget.dart
git commit -m "feat: add CardPreviewWidget — live card preview with multi-level rewards"
```

---

## Task 8: Flutter — card_form_sheet.dart redesign

**Files:**
- Modify: `mobile/lib/owner/card_form_sheet.dart`

- [ ] **Step 1: Rewrite card_form_sheet.dart**

Replace the entire file with:

```dart
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../data/mobile_api_client.dart';
import 'widgets/card_preview_widget.dart';

const _icons = ['⭐', '☕', '🍕', '🥖', '🍔', '🍦', '🎯', '💎', '🔥', '🌟', '🎁', '🏆',
                 '🎵', '🏋️', '🐾', '🌸', '🍣', '🍜', '🧁', '🎮'];

const _accentColors = [
  '#00C896', '#3B82F6', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#10B981', '#F97316',
];

class CardFormSheet extends StatefulWidget {
  final LoyaltyCardModel? existing;
  final VoidCallback onSaved;
  const CardFormSheet({super.key, this.existing, required this.onSaved});

  @override
  State<CardFormSheet> createState() => _CardFormSheetState();
}

class _CardFormSheetState extends State<CardFormSheet>
    with SingleTickerProviderStateMixin {
  // Controllers
  final _name = TextEditingController();
  final _benefit = TextEditingController();

  // State
  int _stamps = 8;
  String _icon = '⭐';
  String _color = '#00C896';
  String _bgType = 'solid';
  String _bgValue = '#0f172a';
  String? _logoUrl;
  bool _multiRewards = false;
  bool _hasExpiry = false;
  DateTime? _expiresAt;
  List<_RewardEntry> _rewards = [_RewardEntry(stamps: 5, label: '', color: '#00C896')];
  bool _saving = false;
  String? _error;

  late TabController _bgTabController;
  final _api = MobileApiClient();

  @override
  void initState() {
    super.initState();
    _bgTabController = TabController(length: 2, vsync: this);
    final c = widget.existing;
    if (c != null) {
      _name.text = c.name;
      _benefit.text = c.benefitDescription;
      _stamps = c.stampsRequired;
      _icon = c.stampIcon;
      _color = c.color;
      _bgType = c.bgType;
      _bgValue = c.bgValue;
      _logoUrl = c.logoUrl;
      _multiRewards = c.multiRewards;
      if (c.expiresAt != null) {
        _hasExpiry = true;
        _expiresAt = DateTime.tryParse(c.expiresAt!);
      }
      if (c.rewards.isNotEmpty) {
        _rewards = c.rewards
            .map((r) => _RewardEntry(stamps: r.stampsRequired, label: r.rewardLabel, color: r.color))
            .toList();
      }
      if (_bgType == 'image') _bgTabController.index = 1;
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _benefit.dispose();
    _bgTabController.dispose();
    super.dispose();
  }

  Future<void> _pickLogo() async {
    final picker = ImagePicker();
    final img = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (img == null) return;
    final bytes = await img.readAsBytes();
    final mimeType = img.mimeType ?? 'image/jpeg';
    try {
      final url = await _api.uploadLogo(bytes, mimeType);
      setState(() => _logoUrl = url);
    } catch (e) {
      setState(() => _error = 'Error al subir logo');
    }
  }

  List<Map<String, dynamic>> get _rewardsJson => _rewards
      .map((r) => {'stamps_required': r.stamps, 'reward_label': r.label, 'color': r.color})
      .toList();

  Future<void> _save() async {
    final name = _name.text.trim();
    final benefit = _benefit.text.trim();
    if (name.isEmpty) { setState(() => _error = 'Ingresa un nombre'); return; }
    if (benefit.isEmpty) { setState(() => _error = 'Ingresa el premio base'); return; }
    if (_multiRewards) {
      for (final r in _rewards) {
        if (r.label.isEmpty) { setState(() => _error = 'Todos los niveles necesitan descripción'); return; }
      }
    }

    setState(() { _saving = true; _error = null; });

    final body = {
      'name': name,
      'stamps_required': _stamps,
      'benefit_description': benefit,
      'stamp_icon': _icon,
      'color': _color,
      'bg_type': _bgType,
      'bg_value': _bgValue,
      'bg_image_url': null,
      'font': 'default',
      'logo_url': _logoUrl,
      'expires_at': _hasExpiry && _expiresAt != null ? _expiresAt!.toIso8601String() : null,
      'multi_rewards': _multiRewards,
      'rewards': _multiRewards ? _rewardsJson : [],
    };

    try {
      if (widget.existing != null) {
        await _api.patch('/api/mobile/cards/${widget.existing!.id}', body);
      } else {
        await _api.post('/api/mobile/cards', body);
      }
      if (mounted) { Navigator.pop(context); widget.onSaved(); }
    } catch (_) {
      setState(() { _error = 'Error al guardar'; _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.95,
      maxChildSize: 0.97,
      minChildSize: 0.5,
      expand: false,
      builder: (_, controller) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0F172A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Title bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.existing != null ? 'Editar tarjeta' : 'Nueva tarjeta',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18),
                  ),
                  TextButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Guardar', style: TextStyle(color: Color(0xFF00C896), fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12)),
              ),
            // Scrollable form + sticky preview
            Expanded(
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  // Live preview
                  CardPreviewWidget(
                    name: _name.text,
                    stampIcon: _icon,
                    color: _color,
                    bgType: _bgType,
                    bgValue: _bgValue,
                    bgImageUrl: null,
                    logoUrl: _logoUrl,
                    multiRewards: _multiRewards,
                    rewards: _rewards
                        .map((r) => CardRewardModel(id: '', stampsRequired: r.stamps, rewardLabel: r.label.isEmpty ? 'Premio' : r.label, color: r.color, sortOrder: 0))
                        .toList(),
                    stampsRequired: _stamps,
                    benefitDescription: _benefit.text,
                  ),
                  const SizedBox(height: 24),

                  // Name
                  _label('Nombre de la tarjeta'),
                  _field(_name, 'ej. Tarjeta Café'),
                  const SizedBox(height: 16),

                  // Stamp count
                  _label('Sellos para completar'),
                  Row(
                    children: [
                      _iconBtn(Icons.remove, () => setState(() => _stamps = (_stamps - 1).clamp(2, 50))),
                      const SizedBox(width: 16),
                      Text('$_stamps', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                      const SizedBox(width: 16),
                      _iconBtn(Icons.add, () => setState(() => _stamps = (_stamps + 1).clamp(2, 50))),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Stamp icon
                  _label('Ícono del sello'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _icons.map((ic) => GestureDetector(
                      onTap: () => setState(() => _icon = ic),
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: _icon == ic
                              ? const Color(0xFF00C896).withValues(alpha: 0.2)
                              : Colors.white.withValues(alpha: 0.04),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _icon == ic ? const Color(0xFF00C896) : Colors.transparent,
                            width: 1.5,
                          ),
                        ),
                        child: Center(child: Text(ic, style: const TextStyle(fontSize: 20))),
                      ),
                    )).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Accent color
                  _label('Color del acento'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _accentColors.map((hex) {
                      final selected = _color == hex;
                      return GestureDetector(
                        onTap: () => setState(() => _color = hex),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: Color(int.parse('FF${hex.replaceAll('#', '')}', radix: 16)),
                            shape: BoxShape.circle,
                            border: selected ? Border.all(color: Colors.white, width: 2.5) : null,
                            boxShadow: selected ? [BoxShadow(color: Colors.white.withValues(alpha: 0.3), blurRadius: 4)] : null,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Logo
                  _label('Logo del negocio (opcional)'),
                  GestureDetector(
                    onTap: _pickLogo,
                    child: Container(
                      height: 56,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: _logoUrl != null ? 0.2 : 0.08),
                          style: BorderStyle.solid,
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _logoUrl != null ? Icons.check_circle_outline : Icons.upload_outlined,
                            color: _logoUrl != null ? const Color(0xFF00C896) : Colors.white38,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _logoUrl != null ? 'Logo subido ✓ — toca para cambiar' : 'Subir logo (PNG, JPG, WebP)',
                            style: TextStyle(
                              color: _logoUrl != null ? const Color(0xFF00C896) : Colors.white38,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Benefit description (base prize)
                  _label('Premio (nivel base)'),
                  _field(_benefit, 'ej. Café gratis'),
                  const SizedBox(height: 20),

                  // Multi-rewards toggle
                  _toggleRow(
                    '🏆  Multi-nivel de premios',
                    'Recompensas en distintos puntos del camino',
                    _multiRewards,
                    (v) => setState(() => _multiRewards = v),
                  ),
                  if (_multiRewards) ...[
                    const SizedBox(height: 12),
                    ..._rewards.asMap().entries.map((e) => _RewardTile(
                          entry: e.value,
                          index: e.key,
                          onChanged: () => setState(() {}),
                          onRemove: _rewards.length > 1
                              ? () => setState(() => _rewards.removeAt(e.key))
                              : null,
                        )),
                    TextButton.icon(
                      onPressed: _rewards.length < 5
                          ? () => setState(() => _rewards.add(_RewardEntry(
                                stamps: (_rewards.last.stamps + 5).clamp(1, 100),
                                label: '',
                                color: _accentColors[_rewards.length % _accentColors.length],
                              )))
                          : null,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Agregar nivel'),
                      style: TextButton.styleFrom(foregroundColor: const Color(0xFF00C896)),
                    ),
                  ],
                  const SizedBox(height: 8),

                  // Expiry toggle
                  _toggleRow(
                    '📅  Vigencia',
                    _hasExpiry && _expiresAt != null
                        ? 'Vence el ${_expiresAt!.day}/${_expiresAt!.month}/${_expiresAt!.year}'
                        : 'Sin fecha de vencimiento',
                    _hasExpiry,
                    (v) async {
                      if (v) {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now().add(const Duration(days: 365)),
                          firstDate: DateTime.now().add(const Duration(days: 1)),
                          lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
                        );
                        if (picked != null) setState(() { _hasExpiry = true; _expiresAt = picked; });
                      } else {
                        setState(() { _hasExpiry = false; _expiresAt = null; });
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text,
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.5),
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.8)),
      );

  Widget _field(TextEditingController ctrl, String hint) => TextField(
        controller: ctrl,
        onChanged: (_) => setState(() {}),
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
          filled: true,
          fillColor: Colors.white.withValues(alpha: 0.04),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF00C896)),
          ),
        ),
      );

  Widget _iconBtn(IconData icon, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: Colors.white70, size: 18),
        ),
      );

  Widget _toggleRow(String title, String subtitle, bool value, void Function(bool) onChanged) =>
      Container(
        padding: const EdgeInsets.all(14),
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 2),
                Text(subtitle, style: TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 11)),
              ]),
            ),
            Switch(
              value: value,
              onChanged: onChanged,
              activeColor: const Color(0xFF00C896),
            ),
          ],
        ),
      );
}

class _RewardEntry {
  int stamps;
  String label;
  String color;
  _RewardEntry({required this.stamps, required this.label, required this.color});
}

class _RewardTile extends StatefulWidget {
  final _RewardEntry entry;
  final int index;
  final VoidCallback onChanged;
  final VoidCallback? onRemove;

  const _RewardTile({
    required this.entry,
    required this.index,
    required this.onChanged,
    this.onRemove,
  });

  @override
  State<_RewardTile> createState() => _RewardTileState();
}

class _RewardTileState extends State<_RewardTile> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.entry.label);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final barColor = Color(int.parse('FF${widget.entry.color.replaceAll('#', '')}', radix: 16));
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: barColor.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          // Stamps badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: barColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text('${widget.entry.stamps}✦',
                style: TextStyle(color: barColor, fontWeight: FontWeight.w700, fontSize: 12)),
          ),
          const SizedBox(width: 10),
          // Label
          Expanded(
            child: TextField(
              controller: _ctrl,
              onChanged: (v) { widget.entry.label = v; widget.onChanged(); },
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Premio nivel ${widget.index + 1}',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 13),
                isDense: true,
                border: InputBorder.none,
              ),
            ),
          ),
          // Stamps counter
          Row(
            children: [
              InkWell(
                onTap: () => setState(() { widget.entry.stamps = (widget.entry.stamps - 1).clamp(1, 200); widget.onChanged(); }),
                child: const Icon(Icons.remove_circle_outline, color: Colors.white38, size: 18),
              ),
              const SizedBox(width: 4),
              InkWell(
                onTap: () => setState(() { widget.entry.stamps = (widget.entry.stamps + 1).clamp(1, 200); widget.onChanged(); }),
                child: const Icon(Icons.add_circle_outline, color: Colors.white38, size: 18),
              ),
            ],
          ),
          if (widget.onRemove != null) ...[
            const SizedBox(width: 4),
            InkWell(
              onTap: widget.onRemove,
              child: const Icon(Icons.close, color: Colors.white24, size: 18),
            ),
          ],
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Run flutter analyze**

```bash
cd /Users/samuelrodriguez/development/fidelitap/mobile
flutter analyze --no-pub 2>&1 | grep "error" | grep -v "^Analyzing" | head -20
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/owner/card_form_sheet.dart
git commit -m "feat: redesign CardFormSheet with live preview, multi-rewards, logo upload, expiry"
```

---

## Task 9: Flutter — Multi-level progress bars (customer) + expiry badge (owner)

**Files:**
- Modify: `mobile/lib/customer/card_list_screen.dart`
- Modify: `mobile/lib/owner/cards_screen.dart`

- [ ] **Step 1: Add multi-level progress display**

In `card_list_screen.dart`, find the section where stamp progress is displayed for each card. After the existing stamp grid/counter, add the following helper function at the top of the widget file (outside the class):

```dart
Widget _buildRewardProgress(LoyaltyCardModel card, int currentStamps) {
  if (!card.multiRewards || card.rewards.isEmpty) return const SizedBox.shrink();
  return Column(
    children: card.rewards.map((r) {
      final barColor = Color(int.parse('FF${r.color.replaceAll('#', '')}', radix: 16));
      final progress = (currentStamps / r.stampsRequired).clamp(0.0, 1.0);
      final done = currentStamps >= r.stampsRequired;
      return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '$currentStamps/${r.stampsRequired} sellos',
                    style: TextStyle(
                      fontSize: 11,
                      color: Colors.white.withValues(alpha: 0.5),
                    ),
                  ),
                  Row(
                    children: [
                      if (done) const Text('✅ ', style: TextStyle(fontSize: 10)),
                      Text(
                        r.rewardLabel,
                        style: TextStyle(
                          fontSize: 11,
                          color: done ? const Color(0xFF00C896) : barColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: LinearProgressIndicator(
                  value: progress,
                  backgroundColor: Colors.white.withValues(alpha: 0.08),
                  valueColor: AlwaysStoppedAnimation<Color>(done ? const Color(0xFF00C896) : barColor),
                  minHeight: 4,
                ),
              ),
            ],
          ),
        ),
      );
    }).toList(),
  );
}
```

Then in the card item build, call `_buildRewardProgress(card, currentStamps)` below the stamp grid.

- [ ] **Step 2: Add expiry badge to owner's cards_screen.dart**

In `mobile/lib/owner/cards_screen.dart`, in the card list item builder, after the card name, add:

```dart
// Expiry badge — show if card expires within 7 days
if (card.expiresAt != null) ...[
  const SizedBox(height: 4),
  Builder(builder: (_) {
    final expires = DateTime.tryParse(card.expiresAt!);
    if (expires == null) return const SizedBox.shrink();
    final daysLeft = expires.difference(DateTime.now()).inDays;
    final isUrgent = daysLeft <= 7;
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: isUrgent
                ? const Color(0xFFEF4444).withValues(alpha: 0.15)
                : Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            isUrgent
                ? '⚠️ Vence en $daysLeft días'
                : '📅 Vence ${expires.day}/${expires.month}/${expires.year}',
            style: TextStyle(
              fontSize: 10,
              color: isUrgent ? const Color(0xFFEF4444) : Colors.white38,
              fontWeight: isUrgent ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }),
],
```

- [ ] **Step 3: Run flutter analyze**

```bash
cd /Users/samuelrodriguez/development/fidelitap/mobile
flutter analyze --no-pub 2>&1 | grep "error" | grep -v "^Analyzing" | head -10
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/lib/customer/card_list_screen.dart mobile/lib/owner/cards_screen.dart
git commit -m "feat: multi-level progress bars for customers + expiry badge for owner card list"
```

---

## Task 10: Wallet — Apple pass next reward in auxiliaryFields

**Files:**
- Modify: `src/lib/wallet/apple.ts`

- [ ] **Step 1: Add nextRewardLabel to ApplePassData interface**

In `src/lib/wallet/apple.ts`, extend the `ApplePassData` interface:

```typescript
interface ApplePassData {
  passTypeIdentifier: string
  teamIdentifier: string
  serialNumber: string
  authenticationToken: string
  organizationName: string
  description: string
  stampsCurrent: number
  stampsRequired: number
  benefitDescription: string
  uniqueCode: string
  appUrl: string
  color?: string | null
  logoUrl?: string | null
  nextRewardLabel?: string | null  // add this line
}
```

- [ ] **Step 2: Use nextRewardLabel in auxiliaryFields**

Find the `auxiliaryFields` section and replace it with:

```typescript
      auxiliaryFields: [
        {
          key: 'next_reward',
          label: 'Próximo premio',
          value: data.nextRewardLabel ?? data.benefitDescription,
        },
      ],
```

- [ ] **Step 3: Pass nextRewardLabel from the wallet API route**

In `src/app/api/wallet/apple/[id]/route.ts` (or wherever `generateApplePass` is called), fetch `card_rewards` and compute `nextRewardLabel`:

Find the call to `generateApplePass(...)` and before it, add:

```typescript
  // Compute next reward label (multi-level support)
  const { data: rewards } = await serviceClient
    .from('card_rewards')
    .select('stamps_required, reward_label')
    .eq('loyalty_card_id', loyaltyCard.id)
    .order('stamps_required', { ascending: true })

  const currentStamps = customerCard.current_stamps ?? 0
  const nextReward = (rewards ?? []).find((r) => r.stamps_required > currentStamps)
  const nextRewardLabel = nextReward?.reward_label ?? null
```

Then add `nextRewardLabel` to the `generateApplePass` call:

```typescript
  const passBuffer = await generateApplePass({
    // ... existing fields ...
    nextRewardLabel,
  })
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/samuelrodriguez/development/fidelitap
npx tsc --noEmit 2>&1 | grep -E "apple|error TS" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallet/apple.ts
git commit -m "feat: Apple Wallet pass shows next reward label from multi-level rewards"
```

---

## Task 11: Wallet — Google Wallet next reward label

**Files:**
- Modify: `src/lib/wallet/google.ts`
- Modify: `src/lib/scanner/add-stamp.ts`

- [ ] **Step 1: Add nextRewardLabel param to updateGoogleWalletStamps**

In `src/lib/wallet/google.ts`, update the function signature and body:

```typescript
export async function updateGoogleWalletStamps(
  customerCardId: string,
  _loyaltyCardId: string,
  newStampCount: number,
  nextRewardLabel?: string
): Promise<void> {
  if (!process.env.GOOGLE_WALLET_ISSUER_ID) return

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
  const sa = getServiceAccount()
  const accessToken = await getAccessToken(sa)
  const objectId = `${issuerId}.lo-${customerCardId}`

  const res = await fetch(`${GOOGLE_WALLET_BASE_URL}/loyaltyObject/${objectId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      loyaltyPoints: {
        label: nextRewardLabel ?? 'Sellos',
        balance: { int: newStampCount },
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Wallet PATCH error: ${res.status} ${text}`)
  }
}
```

- [ ] **Step 2: Pass nextRewardLabel from add-stamp.ts**

In `src/lib/scanner/add-stamp.ts`, after computing `currentStamps`, fetch rewards and pass the next label:

```typescript
  // Fetch next reward label for Wallet update
  const { data: rewards } = await serviceClient
    .from('card_rewards')
    .select('stamps_required, reward_label')
    .eq('loyalty_card_id', card.id)
    .order('stamps_required', { ascending: true })

  const nextReward = (rewards ?? []).find((r) => r.stamps_required > currentStamps)
  const nextRewardLabel = nextReward?.reward_label

  await Promise.all([
    pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve(),
    updateGoogleWalletStamps(cc.id, card.id, currentStamps, nextRewardLabel),
  ])
```

- [ ] **Step 3: Add plan gate for free plan**

Wrap the wallet update calls with a plan check. Before the `Promise.all`, add:

```typescript
  const skipWalletUpdate = card.loyalty_cards?.businesses?.plan === 'free'
  if (!skipWalletUpdate) {
    await Promise.all([
      pushTokens.length > 0 ? sendApnsPush(pushTokens) : Promise.resolve(),
      updateGoogleWalletStamps(cc.id, card.id, currentStamps, nextRewardLabel),
    ])
  }
```

Note: the exact path to `plan` depends on the join in `add-stamp.ts`. Check the select query and adjust accordingly — if `businesses` isn't joined, fetch it separately with `serviceClient.from('businesses').select('plan').eq('id', card.loyalty_cards.business_id).single()`.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "google|add-stamp|error TS" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallet/google.ts src/lib/scanner/add-stamp.ts
git commit -m "feat: Google Wallet shows next reward label; add free-plan gate for wallet updates"
```

---

## Verification

After all tasks are done:

- [ ] **Start local dev environment**

```bash
cd /Users/samuelrodriguez/development/fidelitap
npx supabase start  # if not running
pnpm dev
```

- [ ] **Start Flutter app**

```bash
cd mobile
flutter run
```

- [ ] **Manual test — create a card with multi-level rewards**

1. Log in as a business owner in the Flutter app
2. Go to Cards tab → tap "+" → new card sheet opens
3. Enter name, set stamps to 10
4. Enable "Multi-nivel de premios"
5. Add two levels: 5 sellos → "Café gratis", 10 sellos → "Postre gratis"
6. Tap Guardar
7. Verify card appears in the list

- [ ] **Manual test — edit card**

1. Long-press or tap menu on the card → Edit
2. Sheet opens pre-filled with existing values and rewards
3. Change one reward label → Save
4. Verify updated values in list

- [ ] **Manual test — customer view multi-level progress bars**

1. Log in as a customer
2. View a card with multi-level rewards
3. Progress bars show for each level with correct colors

- [ ] **Verify Apple Wallet pass shows next reward**

1. Customer adds a multi-level card to Apple Wallet
2. Open Wallet — auxiliaryFields shows "Próximo premio: Café gratis" (or whichever is next)
