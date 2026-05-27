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
      status         = CASE WHEN current_stamps + 1 >= v_stamps_required
                            THEN 'ready_to_claim' ELSE status END,
      updated_at     = NOW()
  WHERE id = p_card_id
  RETURNING current_stamps, times_completed, status
    INTO v_new_stamps, v_times_completed, v_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_card not found: %', p_card_id;
  END IF;

  v_is_complete := (v_status = 'ready_to_claim');

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
