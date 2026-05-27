-- supabase/migrations/20260527000002_v2_customers_marketing.sql
-- Adds optional marketing/demographic fields to customers table.
-- Used in extended card activation form (plan-gated: basic+, pro+).

ALTER TABLE public.customers
  ADD COLUMN birthday          DATE,
  ADD COLUMN gender            TEXT CHECK (gender IN ('M', 'F', 'other', 'prefer_not')),
  ADD COLUMN city              TEXT,
  ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT false;
