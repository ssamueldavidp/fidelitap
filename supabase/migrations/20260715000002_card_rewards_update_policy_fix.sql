-- Fix: add explicit WITH CHECK to the card_rewards update policy.
-- The original migration relied on PG's fallback (USING doubles as WITH CHECK),
-- which is not exploitable but diverges from the codebase's own pattern.
drop policy if exists "card_rewards: owner can update" on public.card_rewards;

create policy "card_rewards: owner can update"
  on public.card_rewards for update
  using (
    exists (
      select 1 from public.loyalty_cards lc
      join public.businesses b on b.id = lc.business_id
      where lc.id = card_rewards.loyalty_card_id
        and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.loyalty_cards lc
      join public.businesses b on b.id = lc.business_id
      where lc.id = card_rewards.loyalty_card_id
        and b.owner_id = auth.uid()
    )
  );
