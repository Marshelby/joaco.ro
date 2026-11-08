-- Integración local pendiente de aplicación explícita. No ejecutar automáticamente.
-- Requiere las RPC contables existentes, incluida 20261108200000.
begin;

-- La RPC de escritura verifica auth.uid() y es_admin() antes de operar.
revoke all on function public.corregir_pago_administrativo(uuid,uuid,jsonb,jsonb,jsonb,text) from public,anon,service_role;
grant execute on function public.corregir_pago_administrativo(uuid,uuid,jsonb,jsonb,jsonb,text) to authenticated;
comment on function public.corregir_pago_administrativo(uuid,uuid,jsonb,jsonb,jsonb,text) is
 'API administrativa: control es_admin interno; reverso y reemplazos auditados, sin DML API.';

-- Lectura mínima del agregado privado. No expone tablas ni auxiliares privados.
create function public.leer_correccion_pago_administrativo(p_pago_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if not exists(select 1 from public.pagos where id=p_pago_id) then raise exception 'PAGO_NO_ENCONTRADO'; end if;
 return jsonb_build_object(
  'snapshot',operativo_privado.snapshot_pago(p_pago_id),
  'versiones',coalesce((select jsonb_object_agg(a.pedido_id::text,coalesce(v.version,0))
   from (select distinct pedido_id from public.aplicaciones_pago where pago_id=p_pago_id) a
   left join operativo_privado.versiones_pedido v on v.pedido_id=a.pedido_id),'{}'::jsonb),
  'historial',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'fecha',c.fecha,
   'actor_id',c.actor_id,'motivo',c.motivo,'anteriores',c.anteriores,'nuevos',c.nuevos,'resultado',c.resultado) order by c.fecha,c.id)
   from operativo_privado.correcciones_pago c where c.pago_original_id=p_pago_id
    or exists(select 1 from jsonb_array_elements(c.nuevos->'reemplazos') r where r->'pago'->>'id'=p_pago_id::text)), '[]'::jsonb));
end; $$;
alter function public.leer_correccion_pago_administrativo(uuid) owner to postgres;
revoke all on function public.leer_correccion_pago_administrativo(uuid) from public,anon,authenticated,service_role;
grant execute on function public.leer_correccion_pago_administrativo(uuid) to authenticated;
commit;
