insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'novedades',
  'novedades',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy novedades_storage_insercion_administrativa
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'novedades'
    and public.es_admin()
  );

create policy novedades_storage_actualizacion_administrativa
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'novedades'
    and public.es_admin()
  )
  with check (
    bucket_id = 'novedades'
    and public.es_admin()
  );

create policy novedades_storage_eliminacion_administrativa
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'novedades'
    and public.es_admin()
  );
