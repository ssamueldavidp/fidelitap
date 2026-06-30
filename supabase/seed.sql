-- FideliTap seed data for local development
-- Run: supabase db reset (applies migrations + this seed)
-- Credentials: owner-free@demo.co / Demo1234! (same password for all 4)

do $$
declare
  biz_free     uuid := gen_random_uuid();
  biz_basic    uuid := gen_random_uuid();
  biz_pro      uuid := gen_random_uuid();
  biz_premium  uuid := gen_random_uuid();
  card_free    uuid := gen_random_uuid();
  card_basic   uuid := gen_random_uuid();
  card_pro     uuid := gen_random_uuid();
  card_premium uuid := gen_random_uuid();
  cust1        uuid := gen_random_uuid();
  cust2        uuid := gen_random_uuid();
  cust3        uuid := gen_random_uuid();
begin

  -- ── Auth users (password: Demo1234!) ─────────────────────────────────────
  -- GoTrue scans all token/change fields as string (not *string) — must be '' not NULL
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    aud, role,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token,
    is_super_admin, is_sso_user, is_anonymous
  ) values
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
     'owner-free@demo.co',    crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     'authenticated', 'authenticated', '', '', '', '', '', '', '', '', false, false, false),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
     'owner-basic@demo.co',   crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     'authenticated', 'authenticated', '', '', '', '', '', '', '', '', false, false, false),
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
     'owner-pro@demo.co',     crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     'authenticated', 'authenticated', '', '', '', '', '', '', '', '', false, false, false),
    ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
     'owner-premium@demo.co', crypt('Demo1234!', gen_salt('bf')), now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     'authenticated', 'authenticated', '', '', '', '', '', '', '', '', false, false, false)
  on conflict (id) do nothing;

  -- Also insert into auth.identities so GoTrue recognises the email/password pair
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, created_at, updated_at, last_sign_in_at
  ) values
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000001',
     '{"sub":"00000000-0000-0000-0000-000000000001","email":"owner-free@demo.co"}',
     'email', 'owner-free@demo.co', now(), now(), now()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000002',
     '{"sub":"00000000-0000-0000-0000-000000000002","email":"owner-basic@demo.co"}',
     'email', 'owner-basic@demo.co', now(), now(), now()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000003',
     '{"sub":"00000000-0000-0000-0000-000000000003","email":"owner-pro@demo.co"}',
     'email', 'owner-pro@demo.co', now(), now(), now()),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000004',
     '{"sub":"00000000-0000-0000-0000-000000000004","email":"owner-premium@demo.co"}',
     'email', 'owner-premium@demo.co', now(), now(), now())
  on conflict (provider, provider_id) do nothing;

  -- ── Plan: FREE ───────────────────────────────────────────────────────────

  insert into public.businesses (id, owner_id, name, email, plan, subscription_status,
    stamp_cooldown_seconds, poster_bg_color)
  values
    (biz_free, '00000000-0000-0000-0000-000000000001', 'Cafetería Libre', 'owner-free@demo.co',
     'free', 'active', 300, '#0f172a'),
    (biz_basic, '00000000-0000-0000-0000-000000000002', 'Panadería Básica', 'owner-basic@demo.co',
     'basic', 'active', 180, '#1e1b4b'),
    (biz_pro, '00000000-0000-0000-0000-000000000003', 'Café Demo Pro', 'owner-pro@demo.co',
     'pro', 'active', 0, '#042f2e'),
    (biz_premium, '00000000-0000-0000-0000-000000000004', 'Restaurante Premium', 'owner-premium@demo.co',
     'premium', 'active', 0, '#1c0533')
  on conflict (id) do nothing;

  -- Update lat/lng if column exists (added by mobile app migration)
  update public.businesses set
    latitude  = 4.710989,
    longitude = -74.072092
  where id = biz_pro
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'businesses'
        and column_name  = 'latitude'
    );

  -- ── Loyalty cards ────────────────────────────────────────────────────────
  insert into public.loyalty_cards
    (id, business_id, name, stamps_required, benefit_description, design_config, slug)
  values
    (card_free, biz_free, 'Café del Día', 8, '1 café gratis',
     '{"color":"#22d3ee","bg_type":"solid","bg_value":"#0c4a6e","stamp_icon":"☕","font":"default","style":"clean","bg_mode":"dark","logo_url":null}',
     'cafe-libre'),
    (card_basic, biz_basic, 'Pan Artesanal', 10, 'Docena gratis',
     '{"color":"#fb923c","bg_type":"solid","bg_value":"#431407","stamp_icon":"🥖","font":"rounded","style":"modern","bg_mode":"dark","logo_url":null}',
     'panaderia-basica'),
    (card_pro, biz_pro, 'Tarjeta Café', 8, 'Café gratis al completar',
     '{"color":"#00C896","bg_type":"solid","bg_value":"#0f172a","stamp_icon":"☕","font":"default","style":"clean","bg_mode":"dark","logo_url":null}',
     'cafe-demo-pro'),
    (card_premium, biz_premium, 'Menú Fidelidad', 12, 'Almuerzo ejecutivo gratis',
     '{"color":"#a855f7","bg_type":"solid","bg_value":"#1c0533","stamp_icon":"🍽️","font":"default","style":"luxury","bg_mode":"dark","logo_url":null}',
     'restaurante-premium')
  on conflict (id) do nothing;

  -- ── Demo customers ────────────────────────────────────────────────────────
  insert into public.customers (id, email, name, phone, marketing_consent)
  values
    (cust1, 'ana@cliente.co',    'Ana García',    '3001234567', true),
    (cust2, 'carlos@cliente.co', 'Carlos López',  '3109876543', false),
    (cust3, 'maria@cliente.co',  'María Torres',  '3207778899', true)
  on conflict (email) do nothing;

  -- ── Customer cards (linked to Pro business for demo) ─────────────────────
  insert into public.customer_cards
    (customer_id, loyalty_card_id, unique_code, current_stamps, status)
  values
    (cust1, card_pro, 'DEMO-ANA-001',    5, 'active'),
    (cust2, card_pro, 'DEMO-CARLOS-002', 8, 'ready_to_claim'),
    (cust3, card_pro, 'DEMO-MARIA-003',  3, 'active'),
    (cust1, card_free, 'DEMO-ANA-FREE',  2, 'active'),
    (cust1, card_premium, 'DEMO-ANA-PREM', 11, 'ready_to_claim')
  on conflict (customer_id, loyalty_card_id) do nothing;

end $$;

-- Auth users are created directly in the seed above.
-- Login: owner-free@demo.co / Demo1234! (same password for all 4 plans)
