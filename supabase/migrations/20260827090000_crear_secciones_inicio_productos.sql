-- Configuración ordenada de las secciones fijas de productos del inicio.
-- Los títulos y descripciones siguen definidos por la aplicación.

begin;

create table public.secciones_inicio_productos (
  id uuid primary key default gen_random_uuid(),
  seccion_slug text not null check (seccion_slug in ('featured', 'best-sellers', 'opportunities', 'new-arrivals')),
  producto_id uuid not null references public.productos(id) on delete restrict,
  orden integer not null check (orden >= 1),
  fecha_creacion timestamptz not null default now(),
  constraint secciones_inicio_productos_seccion_producto_unico unique (seccion_slug, producto_id),
  constraint secciones_inicio_productos_seccion_orden_unico unique (seccion_slug, orden)
);

alter table public.secciones_inicio_productos enable row level security;

grant select on public.secciones_inicio_productos to anon, authenticated;
grant insert, update, delete on public.secciones_inicio_productos to authenticated;

create policy secciones_inicio_productos_lectura_publica
  on public.secciones_inicio_productos
  for select
  to anon, authenticated
  using (true);

create policy secciones_inicio_productos_administracion
  on public.secciones_inicio_productos
  for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create temporary table secciones_inicio_productos_seed (
  seccion_slug text not null,
  producto_slug text not null,
  orden integer not null
) on commit drop;

insert into secciones_inicio_productos_seed (seccion_slug, producto_slug, orden)
values
  ('featured', 'lechuga-hidroponica', 1),
  ('featured', 'flores-comestibles-50-und', 2),
  ('featured', 'microgreens-50-gr', 3),
  ('featured', 'albahaca-en-rama', 4),
  ('featured', 'ciboulette-75-gr', 5),
  ('featured', 'berro-hidroponico', 6),
  ('featured', 'rucula', 7),
  ('featured', 'tomate-cherry', 8),
  ('best-sellers', 'lechuga-hidroponica', 1),
  ('best-sellers', 'flores-comestibles-50-und', 2),
  ('best-sellers', 'microgreens-50-gr', 3),
  ('best-sellers', 'albahaca-en-rama', 4),
  ('best-sellers', 'berro-hidroponico', 5),
  ('best-sellers', 'rucula', 6),
  ('opportunities', 'brocoli', 1),
  ('opportunities', 'pimenton-rojo-primera', 2),
  ('opportunities', 'palta-peruana-1ra', 3),
  ('opportunities', 'naranja', 4),
  ('opportunities', 'tomate-primera', 5),
  ('opportunities', 'cilantro', 6),
  ('opportunities', 'saco-papa-lavada-25-kg', 7),
  ('new-arrivals', 'apio', 1),
  ('new-arrivals', 'tomate-primera', 2),
  ('new-arrivals', 'aji-amarillo', 3),
  ('new-arrivals', 'platano-macho', 4),
  ('new-arrivals', 'tomate-primera-caja-17-kg', 5);

do $$
declare
  v_faltantes text;
begin
  if exists (
    select 1
    from secciones_inicio_productos_seed
    group by seccion_slug, producto_slug
    having count(*) > 1
  ) then
    raise exception 'SEED_SECCION_INICIO_PRODUCTO_DUPLICADO';
  end if;

  if exists (
    select 1
    from secciones_inicio_productos_seed
    group by seccion_slug, orden
    having count(*) > 1
  ) then
    raise exception 'SEED_SECCION_INICIO_ORDEN_DUPLICADO';
  end if;

  select string_agg(seed.producto_slug, ', ' order by seed.producto_slug)
  into v_faltantes
  from secciones_inicio_productos_seed seed
  left join public.productos producto on producto.slug = seed.producto_slug
  where producto.id is null;

  if v_faltantes is not null then
    raise exception 'SEED_SECCION_INICIO_PRODUCTOS_INEXISTENTES: %', v_faltantes;
  end if;
end;
$$;

insert into public.secciones_inicio_productos (seccion_slug, producto_id, orden)
select seed.seccion_slug, producto.id, seed.orden
from secciones_inicio_productos_seed seed
join public.productos producto on producto.slug = seed.producto_slug
on conflict (seccion_slug, producto_id) do update
set orden = excluded.orden;

commit;
