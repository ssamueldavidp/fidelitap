-- Endurecimiento 2: privilegios mínimos en tablas y políticas de Storage.

-- ============================================================
-- 1. Privilegios de tabla (defensa en profundidad sobre RLS)
-- ============================================================
-- Supabase concede por defecto ALL (incluido TRUNCATE, que RLS no filtra) a anon y authenticated
-- en todas las tablas. La clave pública no necesita casi nada: solo leer tarjetas activas,
-- los planes y (columnas seguras de) negocios.
revoke all on all tables in schema public from anon;
grant select on public.loyalty_cards, public.subscription_plans to anon;

-- authenticated conserva SELECT/INSERT/UPDATE/DELETE (siempre filtrados por RLS), pero sin
-- TRUNCATE / REFERENCES / TRIGGER.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- Las tablas nuevas no heredan permisos para anon.
alter default privileges in schema public revoke all on tables from anon;

-- revoke all borró también los permisos por columna de businesses: se vuelven a conceder.
do $$
declare cols_anon text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols_anon
    from information_schema.columns
   where table_schema = 'public' and table_name = 'businesses'
     and column_name not in (
       'email', 'mp_payer_email', 'mp_preapproval_id', 'wompi_customer_id',
       'subscription_end_date', 'quiet_hours_start', 'quiet_hours_end',
       'geofence_cooldown_h', 'geofence_message', 'stamp_cooldown_seconds'
     );
  execute format('grant select (%s) on public.businesses to anon', cols_anon);
end $$;

-- ============================================================
-- 2. Storage: cada dueño solo escribe en la carpeta de su negocio
-- ============================================================
-- Antes cualquier usuario autenticado (incluidos los clientes anónimos de la app) podía subir
-- a cualquier ruta de card-logos y BORRAR logos de cualquier negocio.
drop policy if exists "authenticated users upload card logos" on storage.objects;
drop policy if exists "authenticated users manage card logos" on storage.objects;
drop policy if exists "authenticated users update card logos" on storage.objects;

create policy "card-logos: owner upload own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'card-logos'
    and (storage.foldername(name))[1] in (select id::text from public.businesses where owner_id = auth.uid())
  );

create policy "card-logos: owner delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'card-logos'
    and (storage.foldername(name))[1] in (select id::text from public.businesses where owner_id = auth.uid())
  );

-- card-backgrounds: el borrado dependía de "owner = auth.uid()"; ahora también por carpeta.
drop policy if exists "card-backgrounds: owner delete" on storage.objects;
create policy "card-backgrounds: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'card-backgrounds'
    and (storage.foldername(name))[1] in (select id::text from public.businesses where owner_id = auth.uid())
  );

-- Límites de tamaño y tipo en los tres buckets públicos.
update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id in ('card-logos', 'card-backgrounds', 'poster-backgrounds');

-- ============================================================
-- 3. Campañas push: el plan y la tarjeta se validan también en la base de datos
-- ============================================================
-- Un dueño en plan Free podía insertar una campaña programada directamente por la API pública
-- (saltándose el requisito Pro/Premium) o apuntarla a la tarjeta de otro negocio.
drop policy if exists "push_campaigns: owner can insert" on public.push_campaigns;
create policy "push_campaigns: owner can insert"
  on public.push_campaigns for insert to authenticated
  with check (
    business_id in (
      select id from public.businesses
       where owner_id = auth.uid() and plan in ('pro', 'premium') and subscription_status = 'active'
    )
    and (
      loyalty_card_id is null
      or loyalty_card_id in (
        select lc.id from public.loyalty_cards lc
          join public.businesses b on b.id = lc.business_id
         where b.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "push_campaigns: owner can update own" on public.push_campaigns;
create policy "push_campaigns: owner can update own"
  on public.push_campaigns for update to authenticated
  using (business_id in (select id from public.businesses where owner_id = auth.uid()))
  with check (
    business_id in (select id from public.businesses where owner_id = auth.uid())
    and (
      loyalty_card_id is null
      or loyalty_card_id in (
        select lc.id from public.loyalty_cards lc
          join public.businesses b on b.id = lc.business_id
         where b.owner_id = auth.uid()
      )
    )
  );
