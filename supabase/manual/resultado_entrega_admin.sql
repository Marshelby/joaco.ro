-- MANUAL, NO EJECUTADO. Requiere esquema contable hasta 20261108200000.
-- Lectura administrativa por lote. Revisar dependencias y contratos en destino.
begin;
create or replace function public.leer_resultados_entrega_admin(p_pedidos uuid[])
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog set timezone='UTC' as $$
declare
 resultado jsonb;
 evidencias jsonb := '{}'::jsonb;
 roles_admin jsonb := '{}'::jsonb;
 roles_reparto jsonb := '{}'::jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_pedidos is null or cardinality(p_pedidos)>100 then raise exception 'SOLICITUD_INVALIDA'; end if;

 -- El wrapper exclusivo del repartidor deja evidencia directa en rutas múltiples.
 if to_regclass('operativo_privado.ruta_multi_eventos') is not null then
  execute $q$
   select coalesce(jsonb_object_agg(e.pedido_id,true),'{}'::jsonb)
   from operativo_privado.entregas_definitivas e
   join operativo_privado.ruta_multi_eventos r on r.clave=e.clave and r.actor=e.actor
   where e.pedido_id=any($1)
    and r.solicitud->>'accion'='confirmar'
    and r.solicitud->'solicitud'->>'p_pedido_id'=e.pedido_id::text
  $q$ into evidencias using p_pedidos;
 end if;

 if to_regclass('administracion_privada.historial_administradores') is not null then
  execute $q$
   select coalesce(jsonb_object_agg(e.pedido_id, h.rol_solicitado::text),'{}'::jsonb)
   from operativo_privado.entregas_definitivas e
   cross join lateral (
    select a.rol_solicitado from administracion_privada.historial_administradores a
    where a.usuario_id=e.actor and a.registrado_en<=e.instante
    order by a.registrado_en desc,a.clave desc limit 1
   ) h where e.pedido_id=any($1)
  $q$ into roles_admin using p_pedidos;
 end if;

 if to_regclass('operativo_privado.reparto_auditoria') is not null then
  execute $q$
   select coalesce(jsonb_object_agg(e.pedido_id, h.activo),'{}'::jsonb)
   from operativo_privado.entregas_definitivas e
   cross join lateral (
    select a.nuevo->'activo' as activo from operativo_privado.reparto_auditoria a
    where a.accion='rol' and a.nuevo->>'usuario_id'=e.actor::text and a.instante<=e.instante
    order by a.instante desc,a.id desc limit 1
   ) h where e.pedido_id=any($1)
  $q$ into roles_reparto using p_pedidos;
 end if;

 select coalesce(jsonb_object_agg(p.id,jsonb_build_object(
  'definitivo',v.snapshot->'total',
  -- Todo correcto omite importe_original, incluso tras una corrección.
  -- Recuperar sólo el total de la línea original identificada por el snapshot.
  'productos',coalesce((
   select jsonb_agg(case when prod.linea ? 'importe_original' then prod.linea
    else prod.linea || jsonb_build_object('importe_original',i.total_linea)
   end order by prod.posicion)
   from jsonb_array_elements(case when jsonb_typeof(v.snapshot->'productos')='array'
    then v.snapshot->'productos' end) with ordinality as prod(linea,posicion)
   left join public.items_pedido i on i.pedido_id=p.id
    and to_jsonb(i.id)=prod.linea->'item_pedido_id'
    and to_jsonb(i.cantidad)=prod.linea->'cantidad_pedida'
   where jsonb_typeof(prod.linea)='object'
  ),'[]'::jsonb),
  'actor',case when e.actor is not null then jsonb_build_object('id',e.actor,'nombre',nullif(btrim(f.nombre),'')) end,
  'rol_actor',case
   when e.actor is null then null
   when evidencias ? (p.id::text) then 'repartidor'
   when roles_admin->>(p.id::text)='admin' then 'admin'
   when roles_admin->>(p.id::text)='cliente' and roles_reparto->(p.id::text)='true'::jsonb then 'repartidor'
  end,
  'total_cobrado',case when exists(select 1 from operativo_privado.cobros_entrega c where c.pedido_id=p.id)
   then (select coalesce(sum(pa.monto),0) from operativo_privado.pagos_entrega pe
    join public.pagos pa on pa.id=pe.pago_id and pa.estado='confirmado' where pe.pedido_id=p.id)
  end
 )),'{}'::jsonb) into resultado
 from public.pedidos p
 left join operativo_privado.entregas_definitivas e on e.pedido_id=p.id
  and e.snapshot=p.venta_definitiva_snapshot and e.snapshot->>'actor_id'=e.actor::text
 left join public.perfiles f on f.usuario_id=e.actor
 left join lateral (
  select c.nuevos from public.correcciones_venta_entregada c
  where c.pedido_id=p.id and c.operacion_original=e.clave and c.version_original=e.version
  order by c.version desc limit 1
 ) correccion on true
 cross join lateral (select coalesce(correccion.nuevos,p.venta_definitiva_snapshot) as snapshot) v
 where p.id=any(p_pedidos) and p.estado='entregado';
 return resultado;
end $$;
alter function public.leer_resultados_entrega_admin(uuid[]) owner to postgres;
revoke all on function public.leer_resultados_entrega_admin(uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.leer_resultados_entrega_admin(uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
