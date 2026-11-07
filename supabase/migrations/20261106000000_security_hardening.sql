-- Endurecimiento de seguridad (auditoría previa a producción).
-- Todo lo que escribe datos sensibles pasa por el servidor con la service role; la clave
-- pública (anon) y las sesiones de usuario ya no pueden tocarlo directamente.

-- ============================================================
-- 1. Políticas de INSERT abiertas (with check true) y escrituras de más
-- ============================================================
-- Cualquiera con la anon key podía insertar clientes y tarjetas falsas.
-- Las altas legítimas usan siempre createServiceClient (activar tarjeta web/app, registro de cliente).
drop policy if exists "customers: insert own" on public.customers;
drop policy if exists "customer_cards: insert on activation" on public.customer_cards;
-- Un dueño podía fabricar sellos en stamp_events; los sellos solo los escribe add-stamp.ts (service role).
drop policy if exists "stamp_events: business can insert" on public.stamp_events;

-- ============================================================
-- 2. Funciones SECURITY DEFINER: solo el servidor
-- ============================================================
-- add_stamp / claim_reward se podían llamar directo desde la API pública saltándose
-- cooldown y comprobación de dueño; las métricas y la lista de clientes se podían pedir
-- con cualquier business_id.
alter function public.add_stamp(uuid)    set search_path = public;
alter function public.claim_reward(uuid) set search_path = public;

revoke execute on function public.add_stamp(uuid)                      from public, anon, authenticated;
revoke execute on function public.claim_reward(uuid)                   from public, anon, authenticated;
revoke execute on function public.get_business_metrics(uuid)           from public, anon, authenticated;
revoke execute on function public.get_customers_list(uuid, text, uuid) from public, anon, authenticated;
-- La app llama a claim_customer_card con la sesión del cliente (ya exige auth.uid()).
revoke execute on function public.claim_customer_card(text) from public, anon;
grant  execute on function public.claim_customer_card(text) to authenticated;

-- ============================================================
-- 3. businesses: columnas protegidas (mass assignment + filtración)
-- ============================================================
-- 3a. Escritura: antes el dueño podía hacer UPDATE de cualquier columna de su fila
--     (p. ej. plan = 'premium' o subscription_status) y crear su negocio con el plan que quisiera.
--     Ahora solo puede editar los campos de perfil/configuración; el plan y la suscripción
--     solo los cambia el webhook de pago (service role). El negocio se crea desde el servidor.
revoke insert, update on public.businesses from anon, authenticated;
grant update (
  name, address, category, latitude, longitude, lat, lng, geo_radius_m,
  geofence_enabled, geofence_radius_m, geofence_message, geofence_cooldown_h,
  timezone, quiet_hours_start, quiet_hours_end, stamp_cooldown_seconds
)
-- (poster_bg_*/avatar_url no se conceden: se escriben desde el servidor tras validar la imagen;
--  una URL arbitraria ahí haría que el servidor la descargue al generar el póster.) on public.businesses to authenticated;

-- (owner_id se deja legible: las políticas RLS de loyalty_cards lo consultan con los permisos de quien lee.)
-- 3b. Lectura: la política pública (negocios con tarjeta activa) dejaba leer TODAS las columnas
--     con la anon key: correo, id de suscripción de MercadoPago, correo del pagador...
--     Se retiran esas columnas a anon y authenticated; el servidor las lee con la service role.
--     Las columnas nuevas hay que concederlas explícitamente.
revoke select on public.businesses from anon, authenticated;

do $$
declare
  cols_auth text;
  cols_anon text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols_auth
    from information_schema.columns
   where table_schema = 'public' and table_name = 'businesses'
     and column_name not in ('email', 'mp_payer_email', 'mp_preapproval_id', 'wompi_customer_id');

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols_anon
    from information_schema.columns
   where table_schema = 'public' and table_name = 'businesses'
     and column_name not in (
       'email', 'mp_payer_email', 'mp_preapproval_id', 'wompi_customer_id',
       'subscription_end_date', 'quiet_hours_start', 'quiet_hours_end',
       'geofence_cooldown_h', 'geofence_message', 'stamp_cooldown_seconds'
     );

  execute format('grant select (%s) on public.businesses to authenticated', cols_auth);
  execute format('grant select (%s) on public.businesses to anon', cols_anon);
end $$;
