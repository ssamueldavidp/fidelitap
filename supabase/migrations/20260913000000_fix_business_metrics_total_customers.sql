-- get_business_metrics already computed v_total (distinct customers ever, the
-- correct number to compare against the plan's maxCustomers limit) but never
-- returned it — the "Uso" settings tab was substituting "activos" (customers
-- active in the last 30 days) instead, understating usage against the plan
-- limit for any business with customers who haven't stamped recently.
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
    'activos',        v_activos,
    'sellos_hoy',     v_hoy,
    'canjes_totales', v_canjes,
    'total_clientes', v_total,
    'retencion_pct',  CASE WHEN v_total > 0
                          THEN ROUND(v_activos::numeric / v_total * 100)
                          ELSE 0
                     END
  );
END;
$$;
