-- Catalog photos are public assets. Course videos must use a different, private bucket.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('marilyn-catalog-images','marilyn-catalog-images',true,8388608,array['image/jpeg','image/png','image/webp']);
create policy marilyn_photo_insert on storage.objects for insert to authenticated with check(
  bucket_id='marilyn-catalog-images' and (select public.marilyn_staff_role()) is not null
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and name ~ '^[a-f0-9-]+/[a-f0-9-]+\.(webp|jpg|png)$'
  and (select (public.marilyn_staff_context()->>'writes_enabled')::boolean)
);
-- No update/delete policy: immutable photo names prevent overwriting another published photo.
commit;
