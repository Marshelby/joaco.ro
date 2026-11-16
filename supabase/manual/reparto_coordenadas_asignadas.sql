-- PROPUESTA incremental. NO ejecutada. Revisar antes de instalar.
-- No reemplaza preparación ni leer_mi_reparto y no acepta IDs del cliente.
-- La visibilidad se deriva exclusivamente del contrato autorizado existente.
begin;
create function public.leer_coordenadas_mi_reparto() returns jsonb
language sql stable security definer
set search_path = pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'latitude', p.latitud_entrega_snapshot,
    'longitude', p.longitud_entrega_snapshot
  )), '[]'::jsonb)
  from public.pedidos p
  where auth.uid() is not null and public.acceso_repartidor()
    and p.id in (
      select (pedido->>'id')::uuid
      from jsonb_array_elements(public.leer_mi_reparto()) jornada
      cross join lateral jsonb_array_elements(jornada->'pedidos') pedido
    );
$$;
revoke all on function public.leer_coordenadas_mi_reparto() from public, anon, authenticated, service_role;
grant execute on function public.leer_coordenadas_mi_reparto() to authenticated;
commit;
