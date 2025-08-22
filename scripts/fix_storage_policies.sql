-- Fix storage policies for file upload with signed URLs
-- Run this in Supabase SQL Editor

-- Remove old policies
drop policy if exists storage_event_banners_insert on storage.objects;
drop policy if exists storage_event_banners_update on storage.objects;
drop policy if exists storage_event_banners_delete on storage.objects;

-- Create new policies for regular uploads
create policy storage_event_banners_insert
  on storage.objects for insert
  with check (
    bucket_id = 'event-banners'
    and auth.role() = 'authenticated'
    and (
      (split_part(name, '/', 1) = 'avatars' and split_part(name, '/', 2) = auth.uid()::text)
      or
      (split_part(name, '/', 1) = 'events' and split_part(name, '/', 2) = auth.uid()::text)
    )
  );

create policy storage_event_banners_update
  on storage.objects for update
  using (
    bucket_id = 'event-banners'
    and auth.role() = 'authenticated'
    and (
      (split_part(name, '/', 1) = 'avatars' and split_part(name, '/', 2) = auth.uid()::text)
      or
      (split_part(name, '/', 1) = 'events' and split_part(name, '/', 2) = auth.uid()::text)
    )
  );

create policy storage_event_banners_delete
  on storage.objects for delete
  using (
    bucket_id = 'event-banners'
    and auth.role() = 'authenticated'
    and (
      (split_part(name, '/', 1) = 'avatars' and split_part(name, '/', 2) = auth.uid()::text)
      or
      (split_part(name, '/', 1) = 'events' and split_part(name, '/', 2) = auth.uid()::text)
    )
  );

-- Verify bucket exists and is public
insert into storage.buckets (id, name, public)
  values ('event-banners','event-banners', true)
  on conflict (id) do update set public = true;

-- Enable signed URLs for the bucket (this is crucial for mobile uploads)
update storage.buckets 
set 
  public = true,
  file_size_limit = 52428800, -- 50MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
where id = 'event-banners';
