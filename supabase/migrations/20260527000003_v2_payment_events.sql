-- supabase/migrations/20260527000003_v2_payment_events.sql
-- Audit log for all MercadoPago webhook events.
-- event_type values: 'subscription_created' | 'payment_success' | 'payment_failed' | 'subscription_cancelled'

CREATE TABLE public.payment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  mp_payment_id     TEXT,
  mp_preapproval_id TEXT,
  event_type        TEXT NOT NULL,
  plan_slug         TEXT,
  amount_cop        INT,
  status            TEXT,
  raw_payload       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_events_business_id ON public.payment_events(business_id);
CREATE INDEX idx_payment_events_created_at  ON public.payment_events(created_at DESC);

-- RLS: only service role can insert; business owner can select their own
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business owner reads own payment events"
  ON public.payment_events
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );
