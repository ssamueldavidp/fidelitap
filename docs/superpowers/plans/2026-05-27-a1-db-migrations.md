# FideliTap v2 — A1: Database Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all database columns and tables required by FideliTap v2 features (MP subscriptions, reward states, customer marketing fields, payment events, avatar URL, stamp event types).

**Architecture:** 5 sequential Supabase migrations applied with `supabase db reset` (local) or `supabase migration up` (remote). Each migration is a separate file with a timestamp prefix. The `add_stamp` stored function is updated in a separate migration to support the new `status` column.

**Tech Stack:** PostgreSQL, Supabase CLI, SQL

---

## File Map

- Create: `supabase/migrations/20260527000000_v2_businesses_mp_fields.sql`
- Create: `supabase/migrations/20260527000001_v2_customer_cards_status.sql`
- Create: `supabase/migrations/20260527000002_v2_customers_marketing.sql`
- Create: `supabase/migrations/20260527000003_v2_payment_events.sql`
- Create: `supabase/migrations/20260527000004_v2_businesses_avatar_stamp_type.sql`
- Create: `supabase/migrations/20260527000005_v2_update_add_stamp_fn.sql`

---

### Task 1: Migration — businesses v2 MP fields

**Files:**
- Create: `supabase/migrations/20260527000000_v2_businesses_mp_fields.sql`

- [ ] **Step 1: Create the migration file**

```sql
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
```

- [ ] **Step 2: Verify the file was created**

```bash
cat supabase/migrations/20260527000000_v2_businesses_mp_fields.sql
```

Expected: prints the SQL above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527000000_v2_businesses_mp_fields.sql
git commit -m "feat(db): add MP subscription fields to businesses"
```

---

### Task 2: Migration — customer_cards status column

**Files:**
- Create: `supabase/migrations/20260527000001_v2_customer_cards_status.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260527000001_v2_customer_cards_status.sql
-- Adds status column to customer_cards for reward claim flow.
-- States: active (stamping) → ready_to_claim (card full, prize not yet given)
--       → claimed (merchant confirmed prize, stamps reset)

ALTER TABLE public.customer_cards
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ready_to_claim', 'claimed'));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260527000001_v2_customer_cards_status.sql
git commit -m "feat(db): add status column to customer_cards"
```

---

### Task 3: Migration — customers marketing fields

**Files:**
- Create: `supabase/migrations/20260527000002_v2_customers_marketing.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260527000002_v2_customers_marketing.sql
-- Adds optional marketing/demographic fields to customers table.
-- Used in extended card activation form (plan-gated: basic+, pro+).

ALTER TABLE public.customers
  ADD COLUMN birthday          DATE,
  ADD COLUMN gender            TEXT CHECK (gender IN ('M', 'F', 'other', 'prefer_not')),
  ADD COLUMN city              TEXT,
  ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260527000002_v2_customers_marketing.sql
git commit -m "feat(db): add marketing fields to customers"
```

---

### Task 4: Migration — payment_events table

**Files:**
- Create: `supabase/migrations/20260527000003_v2_payment_events.sql`

- [ ] **Step 1: Create the migration file**

```sql
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
-- INSERT/UPDATE/DELETE: service role only (no authenticated policy)
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260527000003_v2_payment_events.sql
git commit -m "feat(db): create payment_events table with RLS"
```

---

### Task 5: Migration — businesses avatar_url + stamp_events type

**Files:**
- Create: `supabase/migrations/20260527000004_v2_businesses_avatar_stamp_type.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260527000004_v2_businesses_avatar_stamp_type.sql
-- avatar_url for profile photo; type column on stamp_events for reward_claimed

ALTER TABLE public.businesses
  ADD COLUMN avatar_url TEXT;

-- stamp_events gets a type column for distinguishing regular stamps from reward claims
ALTER TABLE public.stamp_events
  ADD COLUMN type TEXT NOT NULL DEFAULT 'stamp'
    CHECK (type IN ('stamp', 'reward_claimed'));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260527000004_v2_businesses_avatar_stamp_type.sql
git commit -m "feat(db): add avatar_url to businesses and type to stamp_events"
```

---

### Task 6: Migration — update add_stamp function for status column

**Files:**
- Create: `supabase/migrations/20260527000005_v2_update_add_stamp_fn.sql`

The current `add_stamp` function resets stamps immediately on completion. The new version sets `status = 'ready_to_claim'` instead and does NOT reset stamps. A separate `claim_reward` function (used in Plan B) handles the reset.

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260527000005_v2_update_add_stamp_fn.sql
-- Updates add_stamp to set status='ready_to_claim' instead of resetting on completion.
-- The merchant confirms the prize via claim_reward (see Plan B migration).

CREATE OR REPLACE FUNCTION public.add_stamp(p_card_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stamps_required INT;
  v_new_stamps      INT;
  v_times_completed INT;
  v_is_complete     BOOLEAN := FALSE;
  v_status          TEXT;
BEGIN
  SELECT lc.stamps_required INTO v_stamps_required
  FROM customer_cards cc
  JOIN loyalty_cards lc ON cc.loyalty_card_id = lc.id
  WHERE cc.id = p_card_id;

  IF v_stamps_required IS NULL THEN
    RAISE EXCEPTION 'loyalty_card not found for customer_card: %', p_card_id;
  END IF;

  -- Lock row to prevent concurrent double-completion
  PERFORM id FROM customer_cards WHERE id = p_card_id FOR UPDATE;

  -- Check if already in ready_to_claim state — do not add more stamps
  SELECT status, current_stamps, times_completed
    INTO v_status, v_new_stamps, v_times_completed
  FROM customer_cards WHERE id = p_card_id;

  IF v_status = 'ready_to_claim' THEN
    RETURN jsonb_build_object(
      'current_stamps', v_new_stamps,
      'is_complete',    TRUE,
      'times_completed', v_times_completed,
      'status',         'ready_to_claim'
    );
  END IF;

  UPDATE customer_cards
  SET current_stamps = current_stamps + 1,
      updated_at     = NOW()
  WHERE id = p_card_id
  RETURNING current_stamps, times_completed INTO v_new_stamps, v_times_completed;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_card not found: %', p_card_id;
  END IF;

  IF v_new_stamps >= v_stamps_required THEN
    v_is_complete := TRUE;
    v_status := 'ready_to_claim';
    UPDATE customer_cards
    SET status     = 'ready_to_claim',
        updated_at = NOW()
    WHERE id = p_card_id;
  ELSE
    v_status := 'active';
  END IF;

  RETURN jsonb_build_object(
    'current_stamps',  v_new_stamps,
    'is_complete',     v_is_complete,
    'times_completed', v_times_completed,
    'status',          v_status
  );
END;
$$;

-- claim_reward: merchant confirms prize was given; resets stamps to 0
CREATE OR REPLACE FUNCTION public.claim_reward(p_card_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_times_completed INT;
  v_status          TEXT;
BEGIN
  SELECT status INTO v_status FROM customer_cards WHERE id = p_card_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'customer_card not found: %', p_card_id;
  END IF;

  IF v_status != 'ready_to_claim' THEN
    RAISE EXCEPTION 'Card is not ready to claim. Current status: %', v_status;
  END IF;

  UPDATE customer_cards
  SET current_stamps = 0,
      status         = 'active',
      times_completed = times_completed + 1,
      updated_at     = NOW()
  WHERE id = p_card_id
  RETURNING times_completed INTO v_times_completed;

  RETURN jsonb_build_object(
    'times_completed', v_times_completed,
    'status',          'active'
  );
END;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260527000005_v2_update_add_stamp_fn.sql
git commit -m "feat(db): update add_stamp for ready_to_claim; add claim_reward fn"
```

---

### Task 7: Apply all migrations locally and verify

- [ ] **Step 1: Reset local DB to apply all migrations**

From the project root (`/Users/samuelrodriguez/development/fidelitap`):

```bash
npx supabase db reset
```

Expected output: lines showing each migration applied without errors. Final line shows "Finished supabase db reset".

- [ ] **Step 2: Verify businesses new columns exist**

```bash
npx supabase db execute --sql "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'businesses' ORDER BY ordinal_position;" 2>/dev/null || \
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d public.businesses"
```

Expected: columns `mp_preapproval_id`, `mp_payer_email`, `subscription_end_date`, `avatar_url` appear in the output.

- [ ] **Step 3: Verify customer_cards.status column**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d public.customer_cards"
```

Expected: `status` column with `text` type and a CHECK constraint.

- [ ] **Step 4: Verify customers marketing columns**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d public.customers"
```

Expected: `birthday`, `gender`, `city`, `marketing_consent` columns present.

- [ ] **Step 5: Verify payment_events table**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\d public.payment_events"
```

Expected: table with `id, business_id, mp_payment_id, mp_preapproval_id, event_type, plan_slug, amount_cop, status, raw_payload, created_at`.

- [ ] **Step 6: Verify add_stamp and claim_reward functions exist**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT proname FROM pg_proc WHERE proname IN ('add_stamp', 'claim_reward');"
```

Expected: two rows — `add_stamp` and `claim_reward`.

- [ ] **Step 7: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "feat(db): all v2 migrations applied and verified"
```
