-- Fix: scope card-backgrounds upload policy to business owner's folder
DROP POLICY IF EXISTS "card-backgrounds: authenticated upload" ON storage.objects;

CREATE POLICY "card-backgrounds: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'card-backgrounds'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.businesses WHERE owner_id = auth.uid()
    )
  );
