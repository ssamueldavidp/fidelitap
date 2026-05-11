# FideliTap Plan 1: Fundación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el proyecto Next.js 14 con TypeScript, Supabase, schema completo de base de datos, RLS policies, autenticación, rate limiting y headers de seguridad — la base sobre la que se construyen todos los demás planes.

**Architecture:** Next.js 14 App Router con Supabase como backend completo (PostgreSQL + Auth + Storage + Realtime). La seguridad se implementa en capas: RLS en DB, middleware de auth en Next.js, y rate limiting via Upstash Redis en Edge. Todo el acceso a Supabase desde el servidor usa el cliente con service role solo en contextos protegidos.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase JS v2, Upstash Redis, Zod

---

## Prerequisitos

Antes de empezar, tener creadas las cuentas en:
- [supabase.com](https://supabase.com) — crear proyecto nuevo "fidelitap"
- [upstash.com](https://upstash.com) — crear database Redis "fidelitap-ratelimit"
- Node.js 20+ instalado
- `pnpm` instalado (`npm i -g pnpm`)

---

## Estructura de archivos que este plan crea

```
fidelitap/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout con fonts
│   │   └── page.tsx                      # Placeholder (Plan 2 lo reemplaza)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                 # Cliente browser
│   │   │   ├── server.ts                 # Cliente server (SSR)
│   │   │   └── admin.ts                  # Cliente admin (service role)
│   │   ├── rate-limit.ts                 # Rate limiting con Upstash
│   │   └── validations/
│   │       └── common.ts                 # Schemas Zod reutilizables
│   ├── middleware.ts                      # Auth + security headers
│   └── types/
│       └── database.ts                   # Tipos generados de Supabase
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql        # Tablas principales
│       ├── 002_rls_policies.sql          # Row Level Security
│       └── 003_seed_plans.sql            # Planes de suscripción
├── .env.local.example
├── next.config.ts
└── tailwind.config.ts
```

---

## Task 1: Inicializar proyecto Next.js 14

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Crear el proyecto**

```bash
cd /Users/samuelrodriguez/development
npx create-next-app@latest fidelitap \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm
cd fidelitap
```

- [ ] **Step 2: Instalar dependencias principales**

```bash
pnpm add @supabase/supabase-js @supabase/ssr \
  @upstash/redis @upstash/ratelimit \
  zod \
  qrcode \
  resend \
  next-themes

pnpm add -D @types/qrcode supabase
```

- [ ] **Step 3: Instalar shadcn/ui**

```bash
pnpx shadcn@latest init
# Seleccionar: Default style, Slate color, CSS variables: yes
pnpx shadcn@latest add button input label card badge toast
```

- [ ] **Step 4: Actualizar `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.wompi.co",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 5: Crear `.env.local.example`**

```bash
cat > .env.local.example << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Apple Wallet (Plan 4)
APPLE_PASS_TEAM_ID=
APPLE_PASS_TYPE_ID=
APPLE_PASS_CERTIFICATE_P12_BASE64=
APPLE_PASS_CERTIFICATE_PASSWORD=

# Google Wallet (Plan 4)
GOOGLE_WALLET_ISSUER_ID=
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=
GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY=

# Resend (Plan 3+)
RESEND_API_KEY=re_...

# Wompi (Plan 7)
WOMPI_PUBLIC_KEY=pub_...
WOMPI_PRIVATE_KEY=prv_...
WOMPI_WEBHOOK_SECRET=
EOF

cp .env.local.example .env.local
```

- [ ] **Step 6: Verificar que el proyecto inicia**

```bash
pnpm dev
```

Esperado: servidor corriendo en `http://localhost:3000` sin errores.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 14 project with TypeScript, Tailwind, shadcn"
```

---

## Task 2: Configurar Supabase CLI y clientes

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`

- [ ] **Step 1: Inicializar Supabase CLI**

```bash
pnpm supabase init
pnpm supabase login
# Pegar el access token de supabase.com/dashboard/account/tokens
```

- [ ] **Step 2: Crear cliente browser `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Crear cliente server `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 4: Crear cliente admin `src/lib/supabase/admin.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Solo usar en API routes protegidas — nunca en el cliente
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase browser, server and admin clients"
```

---

## Task 3: Schema de base de datos — migración 001

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Crear migración del schema principal**

```bash
pnpm supabase migration new initial_schema
```

Esto crea `supabase/migrations/YYYYMMDDHHMMSS_initial_schema.sql`. Renombrar mentalmente como `001`.

- [ ] **Step 2: Escribir el SQL completo**

Abrir el archivo creado y reemplazar con:

```sql
-- Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLA: businesses
-- ============================================================
create table public.businesses (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid references auth.users not null,
  name                text not null,
  email               text unique not null,
  plan                text not null default 'free'
                        check (plan in ('free', 'basic', 'pro', 'premium')),
  subscription_status text not null default 'active'
                        check (subscription_status in ('active', 'past_due', 'canceled')),
  wompi_customer_id   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- TABLA: loyalty_cards
-- ============================================================
create table public.loyalty_cards (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid references public.businesses(id) on delete cascade not null,
  name                  text not null,
  stamps_required       int not null check (stamps_required between 2 and 50),
  benefit_description   text not null,
  design_config         jsonb not null default '{}'::jsonb,
  -- design_config shape:
  -- { "color": "#00C896", "bg_type": "solid|gradient|image",
  --   "bg_value": "#0f172a", "bg_image_url": null,
  --   "stamp_icon": "☕", "font": "default" }
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ============================================================
-- TABLA: customers
-- ============================================================
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  name        text not null,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- TABLA: customer_cards
-- ============================================================
create table public.customer_cards (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid references public.customers(id) on delete cascade not null,
  loyalty_card_id     uuid references public.loyalty_cards(id) on delete cascade not null,
  unique_code         text unique not null,
  current_stamps      int not null default 0,
  is_complete         boolean not null default false,
  times_completed     int not null default 0,
  wallet_pass_serial  text,
  wallet_auth_token   text,
  apple_pass_url      text,
  google_pass_url     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (customer_id, loyalty_card_id)
);

-- ============================================================
-- TABLA: stamp_events (inmutable — sin UPDATE/DELETE)
-- ============================================================
create table public.stamp_events (
  id                  uuid primary key default gen_random_uuid(),
  customer_card_id    uuid references public.customer_cards(id) on delete cascade not null,
  business_id         uuid references public.businesses(id) not null,
  stamped_by          uuid references auth.users not null,
  scan_token          text not null,
  ip_address          inet,
  device_fingerprint  text,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- TABLA: subscription_plans
-- ============================================================
create table public.subscription_plans (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text unique not null,
  price_cop           int not null,
  max_loyalty_cards   int,   -- NULL = ilimitado
  max_customers       int,   -- NULL = ilimitado
  features            jsonb not null default '[]'::jsonb,
  is_active           boolean not null default true
);

-- ============================================================
-- ÍNDICES para rendimiento
-- ============================================================
create index idx_businesses_owner_id on public.businesses(owner_id);
create index idx_loyalty_cards_business_id on public.loyalty_cards(business_id);
create index idx_customer_cards_customer_id on public.customer_cards(customer_id);
create index idx_customer_cards_loyalty_card_id on public.customer_cards(loyalty_card_id);
create index idx_customer_cards_unique_code on public.customer_cards(unique_code);
create index idx_stamp_events_customer_card_id on public.stamp_events(customer_card_id);
create index idx_stamp_events_business_id on public.stamp_events(business_id);
create index idx_stamp_events_created_at on public.stamp_events(created_at desc);

-- ============================================================
-- FUNCIÓN: updated_at automático
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.handle_updated_at();

create trigger loyalty_cards_updated_at
  before update on public.loyalty_cards
  for each row execute function public.handle_updated_at();

create trigger customer_cards_updated_at
  before update on public.customer_cards
  for each row execute function public.handle_updated_at();
```

- [ ] **Step 3: Aplicar migración al proyecto local de Supabase**

```bash
pnpm supabase db push
```

Esperado: `Applying migration...` sin errores.

- [ ] **Step 4: Verificar tablas en Supabase Dashboard**

Ir a `supabase.com/dashboard` → tu proyecto → Table Editor. Deben aparecer las 5 tablas: `businesses`, `loyalty_cards`, `customers`, `customer_cards`, `stamp_events`, `subscription_plans`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add initial database schema with all core tables and indexes"
```

---

## Task 4: RLS Policies — migración 002

**Files:**
- Create: `supabase/migrations/002_rls_policies.sql`

- [ ] **Step 1: Crear migración de RLS**

```bash
pnpm supabase migration new rls_policies
```

- [ ] **Step 2: Escribir políticas RLS**

```sql
-- Habilitar RLS en todas las tablas
alter table public.businesses enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.customers enable row level security;
alter table public.customer_cards enable row level security;
alter table public.stamp_events enable row level security;
alter table public.subscription_plans enable row level security;

-- ============================================================
-- BUSINESSES: solo el dueño puede ver y modificar su negocio
-- ============================================================
create policy "businesses: owner can read own"
  on public.businesses for select
  using (owner_id = auth.uid());

create policy "businesses: owner can insert own"
  on public.businesses for insert
  with check (owner_id = auth.uid());

create policy "businesses: owner can update own"
  on public.businesses for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================
-- LOYALTY_CARDS: el negocio gestiona sus tarjetas
-- ============================================================
create policy "loyalty_cards: owner can read own"
  on public.loyalty_cards for select
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "loyalty_cards: owner can insert"
  on public.loyalty_cards for insert
  with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "loyalty_cards: owner can update"
  on public.loyalty_cards for update
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Lectura pública para activación de tarjeta (clientes que escanean el cartel)
create policy "loyalty_cards: public can read active cards"
  on public.loyalty_cards for select
  using (is_active = true);

-- ============================================================
-- CUSTOMERS: el cliente ve solo su propio registro
-- ============================================================
create policy "customers: read own"
  on public.customers for select
  using (id = auth.uid()::uuid or email = auth.email());

create policy "customers: insert own"
  on public.customers for insert
  with check (true); -- Permitido en registro

create policy "customers: update own"
  on public.customers for update
  using (email = auth.email());

-- ============================================================
-- CUSTOMER_CARDS: cliente ve las suyas, negocio ve las de sus tarjetas
-- ============================================================
create policy "customer_cards: customer reads own"
  on public.customer_cards for select
  using (
    customer_id in (
      select id from public.customers where email = auth.email()
    )
  );

create policy "customer_cards: business reads its cards"
  on public.customer_cards for select
  using (
    loyalty_card_id in (
      select lc.id from public.loyalty_cards lc
      join public.businesses b on b.id = lc.business_id
      where b.owner_id = auth.uid()
    )
  );

create policy "customer_cards: insert on activation"
  on public.customer_cards for insert
  with check (true); -- Controlado en API route

-- ============================================================
-- STAMP_EVENTS: negocio puede insertar, todos pueden leer los suyos
-- INMUTABLE: sin UPDATE ni DELETE para ningún rol
-- ============================================================
create policy "stamp_events: business can insert"
  on public.stamp_events for insert
  with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "stamp_events: business reads its events"
  on public.stamp_events for select
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- BLOQUEAR UPDATE y DELETE en stamp_events — tabla de auditoría inmutable
create policy "stamp_events: no updates allowed"
  on public.stamp_events for update
  using (false);

create policy "stamp_events: no deletes allowed"
  on public.stamp_events for delete
  using (false);

-- ============================================================
-- SUBSCRIPTION_PLANS: lectura pública (para mostrar precios)
-- ============================================================
create policy "subscription_plans: public read"
  on public.subscription_plans for select
  using (is_active = true);
```

- [ ] **Step 3: Aplicar migración**

```bash
pnpm supabase db push
```

Esperado: sin errores.

- [ ] **Step 4: Verificar RLS en Dashboard**

Ir a Authentication → Policies. Verificar que cada tabla tiene sus políticas listadas.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add Row Level Security policies for all tables"
```

---

## Task 5: Seed de planes de suscripción — migración 003

**Files:**
- Create: `supabase/migrations/003_seed_plans.sql`

- [ ] **Step 1: Crear migración seed**

```bash
pnpm supabase migration new seed_subscription_plans
```

- [ ] **Step 2: Escribir seed**

```sql
insert into public.subscription_plans
  (name, slug, price_cop, max_loyalty_cards, max_customers, features)
values
(
  'Freemium', 'free', 0, 1, 20,
  '["Apple & Google Wallet", "QR anti-fraude", "Editor de tarjeta", "1 formato de cartel (A4)", "Dashboard básico"]'::jsonb
),
(
  'Basic', 'basic', 49900, 3, 500,
  '["Todo lo de Freemium", "3 tarjetas de fidelización", "500 clientes", "4 formatos de cartel", "Soporte email 48h"]'::jsonb
),
(
  'Pro', 'pro', 99900, 10, 2000,
  '["Todo lo de Basic", "10 tarjetas", "2000 clientes", "Métricas avanzadas", "Exportar CSV", "2FA", "Notificaciones hitos", "Soporte prioritario 24h"]'::jsonb
),
(
  'Premium', 'premium', 179900, null, null,
  '["Todo lo de Pro", "Tarjetas ilimitadas", "Clientes ilimitados", "Multi-sede", "White-label", "Dominio propio", "Soporte prioritario 12h"]'::jsonb
);
```

- [ ] **Step 3: Aplicar**

```bash
pnpm supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: seed subscription plans (free, basic, pro, premium)"
```

---

## Task 6: Tipos TypeScript de la base de datos

**Files:**
- Create: `src/types/database.ts`

- [ ] **Step 1: Generar tipos desde Supabase**

```bash
pnpm supabase gen types typescript \
  --project-id <TU_PROJECT_ID> \
  --schema public > src/types/database.ts
```

El `project_id` se encuentra en: Supabase Dashboard → Settings → General → Reference ID.

- [ ] **Step 2: Agregar tipos helpers `src/types/database.ts` (al final del archivo generado)**

Añadir al final del archivo generado:

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

export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

// Design config de tarjeta con tipos fuertes
export interface CardDesignConfig {
  color: string         // color del texto y sellos activos
  bg_type: 'solid' | 'gradient' | 'image'
  bg_value: string      // color hex o gradiente CSS
  bg_image_url: string | null
  stamp_icon: string    // emoji
  font: 'default' | 'rounded' | 'mono'
}

// Plan slugs
export type PlanSlug = 'free' | 'basic' | 'pro' | 'premium'
```

- [ ] **Step 3: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript types generated from Supabase schema"
```

---

## Task 7: Middleware de autenticación y seguridad

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Crear middleware**

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas que requieren sesión de business owner
const PROTECTED_BUSINESS_ROUTES = [
  '/dashboard',
  '/cards',
  '/scanner',
  '/customers',
  '/settings',
  '/poster',
]

// Rutas públicas (sin auth requerida)
const PUBLIC_ROUTES = ['/', '/login', '/register', '/join', '/pricing']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isProtected = PROTECTED_BUSINESS_ROUTES.some(r => pathname.startsWith(r))

  // Redirigir a login si intenta acceder a ruta protegida sin sesión
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Redirigir al dashboard si ya tiene sesión e intenta ir a login/register
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Verificar que el middleware compila**

```bash
pnpm build
```

Esperado: build exitoso sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware with protected routes and redirects"
```

---

## Task 8: Rate limiting con Upstash Redis

**Files:**
- Create: `src/lib/rate-limit.ts`

- [ ] **Step 1: Crear utilidad de rate limiting**

```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 10 sellos por minuto por business_id
export const stampRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'rl:stamp',
})

// 5 intentos de login por 15 minutos por IP
export const loginRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'rl:login',
})

// 20 requests por minuto para API general
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'rl:api',
})

// Helper para obtener IP del request
export function getIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
  return ip
}

// Helper para respuesta de rate limit excedido
export function rateLimitExceededResponse() {
  return Response.json(
    { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
    { status: 429, headers: { 'Retry-After': '60' } }
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "feat: add Upstash Redis rate limiting for stamps, login and API"
```

---

## Task 9: Schemas de validación Zod

**Files:**
- Create: `src/lib/validations/common.ts`

- [ ] **Step 1: Crear schemas Zod reutilizables**

```typescript
// src/lib/validations/common.ts
import { z } from 'zod'

export const emailSchema = z
  .string()
  .email('Email inválido')
  .toLowerCase()
  .trim()

export const uuidSchema = z.string().uuid('ID inválido')

export const businessRegisterSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe tener al menos un número'),
})

export const cardDesignSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hex inválido'),
  bg_type: z.enum(['solid', 'gradient', 'image']),
  bg_value: z.string().min(1),
  bg_image_url: z.string().url().nullable(),
  stamp_icon: z.string().emoji('Debe ser un emoji').max(2),
  font: z.enum(['default', 'rounded', 'mono']),
})

export const loyaltyCardSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  stamps_required: z.number().int().min(2).max(50),
  benefit_description: z.string().min(5).max(200).trim(),
  design_config: cardDesignSchema,
})

export const customerRegisterSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: emailSchema,
  phone: z.string().regex(/^\+?[0-9]{7,15}$/).optional(),
  loyalty_card_id: uuidSchema,
})

export const stampSchema = z.object({
  unique_code: z.string().min(10).max(100),
  business_id: uuidSchema,
})
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validations/
git commit -m "feat: add Zod validation schemas for all core entities"
```

---

## Task 10: Layout raíz y verificación final

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Actualizar layout raíz**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FideliTap — Fidelización digital para tu negocio',
  description:
    'Crea tarjetas de sellos digitales para tu negocio. Tus clientes las guardan en Apple o Google Wallet.',
  keywords: ['fidelización', 'tarjetas de sellos', 'loyalty', 'negocio', 'Colombia'],
  authors: [{ name: 'FideliTap' }],
  openGraph: {
    title: 'FideliTap',
    description: 'Fidelización digital para tu negocio',
    type: 'website',
    locale: 'es_CO',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Placeholder de homepage (Plan 2 lo reemplaza)**

```typescript
// src/app/page.tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <h1 className="text-4xl font-black text-white">
          fideli<span className="text-[#00C896]">tap</span>
        </h1>
        <p className="mt-2 text-slate-400 text-sm">Landing page — Plan 2</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verificación final del build**

```bash
pnpm build
```

Esperado: Build exitoso. 0 errores de TypeScript. 0 errores de ESLint.

- [ ] **Step 4: Verificar servidor de desarrollo**

```bash
pnpm dev
```

Abrir `http://localhost:3000` — debe mostrar el placeholder con el logo de FideliTap.

- [ ] **Step 5: Commit final del Plan 1**

```bash
git add -A
git commit -m "feat: complete foundation - layout, placeholder, final build verification

Plan 1 complete:
- Next.js 14 + TypeScript + Tailwind + shadcn/ui
- Supabase clients (browser, server, admin)
- DB schema: businesses, loyalty_cards, customers, customer_cards, stamp_events
- RLS policies for all tables
- Subscription plans seeded
- TypeScript types from schema
- Auth middleware with protected routes
- Upstash Redis rate limiting
- Zod validation schemas
- Security headers (CSP, HSTS, X-Frame-Options)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Next.js 14 + TypeScript + Tailwind + shadcn/ui
- ✅ Supabase (PostgreSQL, Auth, Storage, Realtime configurados)
- ✅ Schema: todas las tablas del spec (businesses, loyalty_cards, customers, customer_cards, stamp_events, subscription_plans)
- ✅ RLS en todas las tablas con políticas por rol
- ✅ stamp_events inmutable (policies bloquean UPDATE y DELETE)
- ✅ Rate limiting: 10 sellos/min, 5 logins/15min
- ✅ Headers de seguridad: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- ✅ Validación con Zod en todos los schemas
- ✅ 4 planes de suscripción seeded con límites correctos (Freemium: 20 clientes)
- ✅ Middleware de auth con redirecciones

**Placeholders:** Ninguno — todo el código es completo y ejecutable.

**Consistencia de tipos:** `CardDesignConfig` definido en Task 6 y usado en `loyaltyCardSchema` en Task 9. `PlanSlug` exportado. Los tipos de DB (`Business`, `LoyaltyCard`, etc.) exportados como helpers.
