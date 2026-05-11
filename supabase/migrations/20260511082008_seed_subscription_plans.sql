insert into public.subscription_plans
  (name, slug, price_cop, max_loyalty_cards, max_customers, features)
values
(
  'Freemium', 'free', 0, 1, 20,
  '["Apple & Google Wallet", "QR anti-fraude", "Editor de tarjeta", "1 formato de cartel (A4)", "Dashboard básico"]'::jsonb
),
(
  'Basic', 'basic', 49900, 3, 500,
  '["Todo lo de Freemium", "3 tarjetas de fidelización", "500 clientes", "4 formatos de cartel", "Soporte email 48h"]'::jsonb
),
(
  'Pro', 'pro', 99900, 10, 2000,
  '["Todo lo de Basic", "10 tarjetas", "2000 clientes", "Métricas avanzadas", "Exportar CSV", "2FA", "Notificaciones hitos", "Soporte prioritario 24h"]'::jsonb
),
(
  'Premium', 'premium', 179900, null, null,
  '["Todo lo de Pro", "Tarjetas ilimitadas", "Clientes ilimitados", "Multi-sede", "White-label", "Dominio propio", "Soporte prioritario 12h"]'::jsonb
);
