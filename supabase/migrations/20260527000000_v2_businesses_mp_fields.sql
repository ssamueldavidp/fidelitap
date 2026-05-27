-- supabase/migrations/20260527000000_v2_businesses_mp_fields.sql
-- Adds MercadoPago recurring subscription fields to businesses

ALTER TABLE public.businesses
  ADD COLUMN mp_preapproval_id     TEXT,
  ADD COLUMN mp_payer_email        TEXT,
  ADD COLUMN subscription_end_date TIMESTAMPTZ;

-- Expand subscription_status check to include pending_cancel and trialing
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_subscription_status_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_subscription_status_check
  CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'pending_cancel', 'trialing'));
