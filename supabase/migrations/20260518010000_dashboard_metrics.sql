-- Add stamp cooldown configuration to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS stamp_cooldown_seconds INT NOT NULL DEFAULT 0;

-- get_business_metrics: returns 4 dashboard metrics for a business in one call
CREATE OR REPLACE FUNCTION public.get_business_metrics(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activos   INT := 0;
  v_hoy       INT := 0;
  v_canjes    BIGINT := 0;
  v_total     INT := 0;
BEGIN
  -- Sellos hoy
  SELECT COUNT(*) INTO v_hoy
  FROM stamp_events
  WHERE business_id = p_business_id
    AND created_at >= current_date;

  -- Clientes activos (últimos 30 días)
  SELECT COUNT(DISTINCT cc.customer_id) INTO v_activos
  FROM customer_cards cc
  JOIN stamp_events se ON se.customer_card_id = cc.id
  WHERE se.business_id = p_business_id
    AND se.created_at >= now() - interval '30 days';

  -- Canjes totales
  SELECT COALESCE(SUM(cc.times_completed), 0) INTO v_canjes
  FROM customer_cards cc
  JOIN loyalty_cards lc ON cc.loyalty_card_id = lc.id
  WHERE lc.business_id = p_business_id;

  -- Total clientes únicos
  SELECT COUNT(DISTINCT cc.customer_id) INTO v_total
  FROM customer_cards cc
  JOIN loyalty_cards lc ON cc.loyalty_card_id = lc.id
  WHERE lc.business_id = p_business_id;

  RETURN jsonb_build_object(
    'activos',       v_activos,
    'sellos_hoy',    v_hoy,
    'canjes_totales', v_canjes,
    'retencion_pct', CASE WHEN v_total > 0
                          THEN ROUND(v_activos::numeric / v_total * 100)
                          ELSE 0
                     END
  );
END;
$$;

-- get_customers_list: customers with search, card filter, and last visit
CREATE OR REPLACE FUNCTION public.get_customers_list(
  p_business_id UUID,
  p_q          TEXT DEFAULT NULL,
  p_card_id    UUID DEFAULT NULL
)
RETURNS TABLE (
  customer_id    UUID,
  customer_name  TEXT,
  card_name      TEXT,
  loyalty_card_id UUID,
  current_stamps  INT,
  stamps_required INT,
  times_completed INT,
  last_visit      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    lc.name,
    lc.id,
    cc.current_stamps,
    lc.stamps_required,
    cc.times_completed,
    MAX(se.created_at)
  FROM customers c
  JOIN customer_cards cc ON cc.customer_id = c.id
  JOIN loyalty_cards lc  ON cc.loyalty_card_id = lc.id
  LEFT JOIN stamp_events se ON se.customer_card_id = cc.id
  WHERE lc.business_id = p_business_id
    AND lc.deleted_at IS NULL
    AND (p_q IS NULL OR c.name ILIKE '%' || p_q || '%')
    AND (p_card_id IS NULL OR lc.id = p_card_id)
  GROUP BY c.id, c.name, lc.name, lc.id, cc.current_stamps, lc.stamps_required, cc.times_completed
  ORDER BY MAX(se.created_at) DESC NULLS LAST;
END;
$$;
