-- Tabla para tokens de dispositivo (reemplaza push_subscriptions VAPID)
create table public.device_tokens (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  expo_token   text not null check (char_length(expo_token) <= 1000),
  platform     text not null,
  constraint device_tokens_platform_check check (platform in ('ios', 'android')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (customer_id, expo_token)
);

-- Vincular sesión OTP móvil con fila de cliente
alter table public.customers
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists customers_auth_user_id_key
  on public.customers(auth_user_id)
  where auth_user_id is not null;

-- RLS: device_tokens — solo el propio cliente puede leer/borrar sus tokens
alter table public.device_tokens enable row level security;

create policy "customers manage own device tokens"
  on public.device_tokens
  for all
  using (
    customer_id = (
      select id from public.customers where auth_user_id = auth.uid()
    )
  );
