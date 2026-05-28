-- Create card-logos storage bucket for business logo uploads
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'card-logos',
  'card-logos',
  true,
  2097152, -- 2MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Authenticated users can upload to their own business folder
create policy "authenticated users upload card logos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'card-logos');

-- Public read access (logos are public by design)
create policy "public read card logos"
  on storage.objects for select
  to public
  using (bucket_id = 'card-logos');

-- Users can update/delete their own logos
create policy "authenticated users manage card logos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'card-logos');
