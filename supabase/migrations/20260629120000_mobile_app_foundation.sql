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
