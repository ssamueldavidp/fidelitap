-- The previous migration's policy on `businesses` queried `loyalty_cards`
-- directly, but loyalty_cards' own RLS policies query back into
-- `businesses` (e.g. "loyalty_cards: owner can read own"), so evaluating
-- one policy re-triggers the other: "infinite recursion detected in policy
-- for relation businesses" (42P17), a hard 500 on every businesses query.
--
-- Standard Supabase fix: move the cross-table check into a SECURITY DEFINER
-- function. It runs as the migration owner (which has BYPASSRLS), so its
-- internal query on loyalty_cards skips RLS entirely instead of re-entering
-- the policy chain.
create or replace function public.business_has_active_card(biz_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.loyalty_cards
    where business_id = biz_id and is_active = true
  );
$$;

drop policy if exists "businesses: public can read if has active card" on public.businesses;

create policy "businesses: public can read if has active card"
  on public.businesses for select
  using (public.business_has_active_card(businesses.id));
