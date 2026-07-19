-- Fix device_tokens: switch from customer_id+expo_token to user_id (auth UUID) + fcm_token
drop table if exists public.device_tokens;

create table public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  fcm_token   text not null check (char_length(fcm_token) <= 1000),
  platform    text not null check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, fcm_token)
);

alter table public.device_tokens enable row level security;

create policy "users manage own device tokens"
  on public.device_tokens
  for all
  using (user_id = auth.uid());

-- Add mobile-link columns to customer_cards
alter table public.customer_cards
  add column if not exists linked_auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists wallet_auth_token    uuid;

create index if not exists customer_cards_linked_auth_user_id_idx
  on public.customer_cards(linked_auth_user_id)
  where linked_auth_user_id is not null;

-- Geofence notification log (for cooldown checks)
create table if not exists public.geofence_notifications (
  id               uuid primary key default gen_random_uuid(),
  customer_card_id uuid not null references public.customer_cards(id) on delete cascade,
  business_id      uuid not null references public.businesses(id) on delete cascade,
  sent_at          timestamptz not null default now()
);

create index if not exists geofence_notifications_lookup_idx
  on public.geofence_notifications(customer_card_id, business_id, sent_at desc);

alter table public.geofence_notifications enable row level security;

create policy "service role only"
  on public.geofence_notifications
  for all
  using (false);
