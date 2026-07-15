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
