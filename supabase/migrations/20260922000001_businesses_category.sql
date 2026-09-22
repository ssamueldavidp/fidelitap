-- Lets an owner tag their business with a category, used to filter the
-- Tiendas cercanas directory (Pro+). Validated app-side against a fixed
-- list, matching how other enum-ish fields (card style, bg_mode) already
-- work in this codebase without a DB CHECK constraint.
alter table public.businesses
  add column if not exists category text;
