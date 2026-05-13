-- Fix: Basic plan should have max_loyalty_cards = 1 (was 3)
update public.subscription_plans
set max_loyalty_cards = 1
where slug = 'basic';
