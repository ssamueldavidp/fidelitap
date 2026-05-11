-- Habilitar RLS en todas las tablas
alter table public.businesses enable row level security;
alter table public.loyalty_cards enable row level security;
alter table public.customers enable row level security;
alter table public.customer_cards enable row level security;
alter table public.stamp_events enable row level security;
alter table public.subscription_plans enable row level security;

-- ============================================================
-- BUSINESSES: solo el dueño puede ver y modificar su negocio
-- ============================================================
create policy "businesses: owner can read own"
  on public.businesses for select
  using (owner_id = auth.uid());

create policy "businesses: owner can insert own"
  on public.businesses for insert
  with check (owner_id = auth.uid());

create policy "businesses: owner can update own"
  on public.businesses for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================
-- LOYALTY_CARDS: el negocio gestiona sus tarjetas
-- ============================================================
create policy "loyalty_cards: owner can read own"
  on public.loyalty_cards for select
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "loyalty_cards: owner can insert"
  on public.loyalty_cards for insert
  with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "loyalty_cards: owner can update"
  on public.loyalty_cards for update
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Lectura pública para activación de tarjeta (clientes que escanean el cartel)
create policy "loyalty_cards: public can read active cards"
  on public.loyalty_cards for select
  using (is_active = true);

-- ============================================================
-- CUSTOMERS: el cliente ve solo su propio registro
-- ============================================================
create policy "customers: read own"
  on public.customers for select
  using (id = auth.uid()::uuid or email = auth.email());

create policy "customers: insert own"
  on public.customers for insert
  with check (true); -- Permitido en registro

create policy "customers: update own"
  on public.customers for update
  using (email = auth.email());

-- ============================================================
-- CUSTOMER_CARDS: cliente ve las suyas, negocio ve las de sus tarjetas
-- ============================================================
create policy "customer_cards: customer reads own"
  on public.customer_cards for select
  using (
    customer_id in (
      select id from public.customers where email = auth.email()
    )
  );

create policy "customer_cards: business reads its cards"
  on public.customer_cards for select
  using (
    loyalty_card_id in (
      select lc.id from public.loyalty_cards lc
      join public.businesses b on b.id = lc.business_id
      where b.owner_id = auth.uid()
    )
  );

create policy "customer_cards: insert on activation"
  on public.customer_cards for insert
  with check (true); -- Controlado en API route

-- ============================================================
-- STAMP_EVENTS: negocio puede insertar, todos pueden leer los suyos
-- INMUTABLE: sin UPDATE ni DELETE para ningún rol
-- ============================================================
create policy "stamp_events: business can insert"
  on public.stamp_events for insert
  with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

create policy "stamp_events: business reads its events"
  on public.stamp_events for select
  using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- BLOQUEAR UPDATE y DELETE en stamp_events — tabla de auditoría inmutable
create policy "stamp_events: no updates allowed"
  on public.stamp_events for update
  using (false);

create policy "stamp_events: no deletes allowed"
  on public.stamp_events for delete
  using (false);

-- ============================================================
-- SUBSCRIPTION_PLANS: lectura pública (para mostrar precios)
-- ============================================================
create policy "subscription_plans: public read"
  on public.subscription_plans for select
  using (is_active = true);
