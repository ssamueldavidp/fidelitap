-- Poster settings on businesses
ALTER TABLE businesses
  ADD COLUMN poster_bg_color TEXT NOT NULL DEFAULT '#0B0B0B',
  ADD COLUMN poster_bg_image_url TEXT;

-- Editable reward text per loyalty card
ALTER TABLE loyalty_cards
  ADD COLUMN poster_reward_text TEXT;

-- Storage bucket for poster background photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('poster-backgrounds', 'poster-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "business owners can upload poster bg"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'poster-backgrounds'
  AND (storage.foldername(name))[1] = (
    SELECT id::text FROM businesses WHERE owner_id = auth.uid() LIMIT 1
  )
);

-- Allow public read of poster backgrounds
CREATE POLICY "public can read poster bg"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'poster-backgrounds');
