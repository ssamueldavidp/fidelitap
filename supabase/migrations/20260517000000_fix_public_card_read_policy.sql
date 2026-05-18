-- Fix: exclude soft-deleted cards from public read
DROP POLICY IF EXISTS "loyalty_cards: public can read active cards" ON public.loyalty_cards;

CREATE POLICY "loyalty_cards: public can read active cards"
  ON public.loyalty_cards FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);
