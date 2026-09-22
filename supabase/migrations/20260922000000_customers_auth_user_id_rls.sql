-- customers.auth_user_id (added in 20260702000000_mobile_foundation.sql) had no
-- SELECT policy letting a customer read their own row through it — the app's
-- own resolveRole() queries this table directly with the customer's
-- RLS-scoped client, so a card-less registered customer (linked only via
-- auth_user_id, no customer_cards row yet) could never be recognized as a
-- customer and would bounce back to the role chooser in a loop.
create policy "customers: auth_user_id can read own"
  on public.customers for select
  using (auth_user_id = auth.uid());
