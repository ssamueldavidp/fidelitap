-- Fix: Basic plan should have max_loyalty_cards = 1 (was 3)
BEGIN;
UPDATE public.subscription_plans
SET max_loyalty_cards = 1
WHERE slug = 'basic';
COMMIT;
