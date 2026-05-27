-- supabase/migrations/20260527000001_v2_customer_cards_status.sql
-- Adds status column to customer_cards for reward claim flow.
-- States: active (stamping) → ready_to_claim (card full, prize not yet given)
--       → claimed (merchant confirmed prize, stamps reset)

ALTER TABLE public.customer_cards
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ready_to_claim', 'claimed'));
