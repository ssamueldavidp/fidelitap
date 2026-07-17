-- supabase/migrations/20260625000000_push_subscriptions_and_campaigns.sql
-- Web Push subscriptions + business marketing campaigns (Pro/Premium only)

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_card_id uuid not null references public.customer_cards(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create unique index push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
create index push_subscriptions_customer_card_id_idx on public.push_subscriptions (customer_card_id);
create index push_subscriptions_business_active_idx on public.push_subscriptions (business_id) where active;

alter table public.push_subscriptions enable row level security;

-- Inserts/updates happen only via the service role (API routes use createServiceClient()
-- after validating wallet_auth_token), so only a read policy is needed for the dashboard.
create policy "push_subscriptions: owner can read own business subscriptions"
  on public.push_subscriptions for select
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create table public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  loyalty_card_id uuid references public.loyalty_cards(id) on delete cascade, -- null = todas las tarjetas
  title text not null,
  body text not null,
  scheduled_at timestamptz, -- null = enviar inmediatamente al crear
  sent_at timestamptz,
  status text not null default 'draft' check (status in ('draft','scheduled','sent','failed')),
  recipients_count int,
  created_at timestamptz not null default now()
);

create index push_campaigns_business_id_idx on public.push_campaigns (business_id);
create index push_campaigns_pending_idx on public.push_campaigns (status, scheduled_at) where status = 'scheduled';

alter table public.push_campaigns enable row level security;

create policy "push_campaigns: owner can read own"
  on public.push_campaigns for select
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "push_campaigns: owner can insert"
  on public.push_campaigns for insert
  with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "push_campaigns: owner can update own"
  on public.push_campaigns for update
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

alter table public.loyalty_cards
  add column push_notify_threshold int not null default 1;

alter table public.customer_cards
  add column near_completion_notified_at timestamptz,
  add column last_stamp_at timestamptz,
  add column reengagement_sent_at timestamptz;
