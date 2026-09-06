create table public.novedades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  contenido text not null,
  estado text not null default 'borrador',
  categoria text null,
  imagen_ruta text null,
  youtube_video_id text null,
  autor_usuario_id uuid not null references auth.users(id) on delete restrict,
  actualizado_por_usuario_id uuid not null references auth.users(id) on delete restrict,
  fecha_publicacion timestamptz null,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint novedades_titulo_valido check (
    btrim(titulo) <> '' and char_length(btrim(titulo)) <= 120
  ),
  constraint novedades_contenido_valido check (
    btrim(contenido) <> '' and char_length(btrim(contenido)) <= 5000
  ),
  constraint novedades_estado_valido check (estado in ('borrador', 'publicado')),
  constraint novedades_categoria_valida check (
    categoria is null or categoria in ('novedad', 'promocion', 'producto', 'sorteo', 'ganador')
  ),
  constraint novedades_una_media check (
    not (imagen_ruta is not null and youtube_video_id is not null)
  ),
  constraint novedades_youtube_video_id_valido check (
    youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
  ),
  constraint novedades_publicacion_con_fecha check (
    estado <> 'publicado' or fecha_publicacion is not null
  )
);

create index novedades_feed_publicado_fecha_idx
  on public.novedades (fecha_publicacion desc, id desc)
  where estado = 'publicado';

create index novedades_admin_actualizacion_idx
  on public.novedades (fecha_actualizacion desc, id desc);

create function public.proteger_autoria_novedades()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NO_AUTORIZADO';
  end if;

  if tg_op = 'INSERT' then
    if new.autor_usuario_id is distinct from auth.uid()
      or new.actualizado_por_usuario_id is distinct from auth.uid() then
      raise exception 'AUTORIA_NOVEDAD_INVALIDA';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.autor_usuario_id is distinct from old.autor_usuario_id then
      raise exception 'AUTOR_NOVEDAD_INMUTABLE';
    end if;

    if new.actualizado_por_usuario_id is distinct from auth.uid() then
      raise exception 'ACTUALIZADOR_NOVEDAD_INVALIDO';
    end if;
  end if;

  return new;
end;
$$;

create trigger proteger_autoria_novedades
before insert or update on public.novedades
for each row execute function public.proteger_autoria_novedades();

create trigger actualizar_novedades_fecha_actualizacion
before update on public.novedades
for each row execute function public.actualizar_fecha_actualizacion();

alter table public.novedades enable row level security;

grant select on table public.novedades to anon, authenticated;
grant insert, update on table public.novedades to authenticated;

create policy novedades_lectura_anonima_publicada
  on public.novedades
  for select
  to anon
  using (estado = 'publicado');

create policy novedades_lectura_autenticada
  on public.novedades
  for select
  to authenticated
  using (estado = 'publicado' or public.es_admin());

create policy novedades_insercion_administrativa
  on public.novedades
  for insert
  to authenticated
  with check (public.es_admin());

create policy novedades_actualizacion_administrativa
  on public.novedades
  for update
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

revoke all on function public.proteger_autoria_novedades() from public, anon, authenticated;
