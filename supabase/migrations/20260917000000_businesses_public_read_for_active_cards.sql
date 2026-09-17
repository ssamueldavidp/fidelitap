-- Mirrors the existing "loyalty_cards: public can read active cards" policy.
-- Without this, any query that joins loyalty_cards -> businesses under a
-- customer's own RLS-scoped client (e.g. GET /api/mobile/customer-cards)
-- gets `businesses: null` for the nested relation, since customers have no
-- SELECT grant on businesses — even though the business name is already
-- public-facing via /c/[slug] and the printed poster.
create policy "businesses: public can read if has active card"
  on public.businesses for select
  using (
    exists (
      select 1 from public.loyalty_cards lc
      where lc.business_id = businesses.id
        and lc.is_active = true
    )
  );
