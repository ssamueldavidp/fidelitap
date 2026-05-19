-- device_registrations: stores Apple Wallet push tokens per device/pass pair
CREATE TABLE public.device_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_library_identifier TEXT NOT NULL,
  push_token TEXT NOT NULL,
  pass_type_identifier TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (device_library_identifier, pass_type_identifier, serial_number)
);

ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;
-- No RLS policies: only service role can access

-- add_stamp: atomically increments current_stamps and handles card completion
CREATE OR REPLACE FUNCTION public.add_stamp(p_card_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stamps_required INT;
  v_new_stamps INT;
  v_times_completed INT;
  v_is_complete BOOLEAN := FALSE;
BEGIN
  SELECT lc.stamps_required INTO v_stamps_required
  FROM customer_cards cc
  JOIN loyalty_cards lc ON cc.loyalty_card_id = lc.id
  WHERE cc.id = p_card_id;

  IF v_stamps_required IS NULL THEN
    RAISE EXCEPTION 'loyalty_card not found for customer_card: %', p_card_id;
  END IF;

  -- Lock the row to prevent concurrent double-completion
  PERFORM id FROM customer_cards WHERE id = p_card_id FOR UPDATE;

  UPDATE customer_cards
  SET current_stamps = current_stamps + 1,
      updated_at = NOW()
  WHERE id = p_card_id
  RETURNING current_stamps INTO v_new_stamps;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_card not found: %', p_card_id;
  END IF;

  IF v_new_stamps >= v_stamps_required THEN
    v_is_complete := TRUE;
    UPDATE customer_cards
    SET current_stamps = 0,
        is_complete = FALSE,
        times_completed = times_completed + 1,
        updated_at = NOW()
    WHERE id = p_card_id
    RETURNING times_completed INTO v_times_completed;
    v_new_stamps := 0;
  ELSE
    SELECT times_completed INTO v_times_completed
    FROM customer_cards WHERE id = p_card_id;
  END IF;

  RETURN jsonb_build_object(
    'current_stamps', v_new_stamps,
    'is_complete', v_is_complete,
    'times_completed', v_times_completed
  );
END;
$$;
