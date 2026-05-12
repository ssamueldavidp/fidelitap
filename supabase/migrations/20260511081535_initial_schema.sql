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
