-- Add slug and soft-delete to loyalty_cards
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.loyalty_cards
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Backfill slugs for any existing rows
UPDATE public.loyalty_cards
SET slug = trim(both '-' from regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', '-', 'g'))
           || '-' || substr(gen_random_uuid()::text, 1, 4)
WHERE slug IS NULL;

ALTER TABLE public.loyalty_cards ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_cards_slug
  ON public.loyalty_cards(slug);

CREATE INDEX IF NOT EXISTS idx_loyalty_cards_not_deleted
  ON public.loyalty_cards(business_id)
  WHERE deleted_at IS NULL;

-- RLS: owner can delete own cards
CREATE POLICY "loyalty_cards: owner can delete"
  ON public.loyalty_cards FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Supabase Storage bucket for card background images
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-backgrounds', 'card-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "card-backgrounds: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'card-backgrounds');

CREATE POLICY "card-backgrounds: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'card-backgrounds'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "card-backgrounds: owner delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'card-backgrounds' AND owner = auth.uid());
