begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('constancias-fotograficas', 'constancias-fotograficas', false, 2097152, array['image/webp', 'image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- El bloqueo coordina el alta con el borrado definitivo de un pedido.
create function public.constancia_pedido_vigente(ruta text)
returns boolean
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if not public.es_admin() or ruta !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/foto$' then
    return false;
  end if;
  perform 1 from public.pedidos where id = split_part(ruta, '/', 1)::uuid for key share;
  return found;
end;
$$;
revoke all on function public.constancia_pedido_vigente(text) from public, anon, authenticated;
grant execute on function public.constancia_pedido_vigente(text) to authenticated;

create function public.proteger_pedido_con_constancia()
returns trigger
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'constancias-fotograficas' and name = old.id::text || '/foto') then
    raise exception 'Elimina la constancia fotográfica antes de borrar el pedido.';
  end if;
  return old;
end;
$$;
revoke all on function public.proteger_pedido_con_constancia() from public, anon, authenticated;
create trigger proteger_pedido_con_constancia
  before delete on public.pedidos for each row execute function public.proteger_pedido_con_constancia();

create policy constancias_barrera_anon
  on storage.objects as restrictive for all to anon
  using (bucket_id <> 'constancias-fotograficas')
  with check (bucket_id <> 'constancias-fotograficas');

create policy constancias_barrera_autenticada
  on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'constancias-fotograficas' or (select public.es_admin()))
  with check (
    bucket_id <> 'constancias-fotograficas' or (
      (select public.es_admin())
      and public.constancia_pedido_vigente(name)
    )
  );

create policy constancias_acceso_admin
  on storage.objects for all to authenticated
  using (bucket_id = 'constancias-fotograficas' and (select public.es_admin()))
  with check (bucket_id = 'constancias-fotograficas' and (select public.es_admin()));

-- El objeto es la asociación. El índice único de Storage sobre bucket y nombre
-- garantiza una foto por pedido y la API de Storage realiza el reemplazo y borrado.
create view public.constancias_fotograficas
with (security_invoker = true) as
select p.id as pedido_id,
       p.numero_pedido,
       p.nombre_cliente_snapshot,
       entrega.fecha_entrega,
       coalesce(entrega.fecha_entrega, (o.created_at at time zone 'America/Santiago')::date) as dia_constancia,
       o.updated_at as actualizada_en
from storage.objects o
join public.pedidos p on o.name = p.id::text || '/foto'
cross join lateral (
  select coalesce(
    case when p.estado = 'entregado' then (p.venta_reconocida_en at time zone 'America/Santiago')::date end,
    p.fecha_entrega
  ) as fecha_entrega
) entrega
where o.bucket_id = 'constancias-fotograficas' and (select public.es_admin());

create view public.fechas_constancias_fotograficas
with (security_invoker = true) as
select distinct dia_constancia
from public.constancias_fotograficas;

revoke all on public.constancias_fotograficas, public.fechas_constancias_fotograficas from public, anon, authenticated;
grant select on public.constancias_fotograficas, public.fechas_constancias_fotograficas to authenticated;

commit;
