-- MANUAL: no ejecutado. Requiere contrato 2, consultar_resultado_entrega,
-- infraestructura operativa y rutas múltiples fase 3. No reemplaza RPC contables.
-- Revisar contra el esquema remoto antes de aplicar; ejecutar como postgres.
-- Instalación inicial del complemento, sobre las dependencias ya instaladas.
-- No es reinstalable: CREATE sin IF NOT EXISTS/OR REPLACE rechaza objetos
-- existentes y BEGIN/COMMIT evita una instalación parcial. No borrar historial
-- ni sustituir funciones para eludir esa protección ante una segunda instalación.
begin;
create table operativo_privado.observaciones_entrega (
 pedido_id uuid primary key references public.pedidos(id) on delete restrict,
 clave uuid not null,
 actor_id uuid not null,
 fecha timestamptz not null default clock_timestamp(),
 observacion text not null check (length(observacion) between 1 and 2000
  and observacion = regexp_replace(observacion,'^[[:space:]]+|[[:space:]]+$','','g'))
);
alter table operativo_privado.observaciones_entrega owner to postgres;
alter table operativo_privado.observaciones_entrega enable row level security;
alter table operativo_privado.observaciones_entrega force row level security;
revoke all on operativo_privado.observaciones_entrega from public,anon,authenticated,service_role;
create trigger observaciones_entrega_inmutables before update or delete on operativo_privado.observaciones_entrega
 for each row execute function operativo_privado.impedir_mutacion_historial();
create trigger observaciones_entrega_no_truncables before truncate on operativo_privado.observaciones_entrega
 for each statement execute function operativo_privado.impedir_mutacion_historial();

create function public.resolver_entrega_con_observacion(
 p_pedido_id uuid,p_version_esperada bigint,p_clave uuid,p_items jsonb,p_cobro jsonb,
 p_diferencias boolean,p_observacion text,p_solo_consultar boolean
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 r jsonb; o operativo_privado.observaciones_entrega%rowtype; cliente uuid;
 -- NULL/vacío/blancos equivalen a ausencia. El límite cuenta caracteres del
 -- texto normalizado; se conservan espacios y saltos de línea interiores.
 observacion_normalizada text := regexp_replace(coalesce(p_observacion,''),'^[[:space:]]+|[[:space:]]+$','','g');
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if length(observacion_normalizada)>2000 or p_diferencias is null or p_solo_consultar is null then raise exception 'OBSERVACION_INVALIDA'; end if;
 -- Consultar nunca toma locks de escritura ni agrega comentarios retroactivos.
 -- Serializar por cliente, como las RPC existentes; no anticipar locks de
 -- pedido/versiones que invertirían su orden frente a la preparación.
 if not p_solo_consultar then
  select cliente_id into cliente from public.pedidos where id=p_pedido_id;
  perform 1 from public.clientes where id=cliente for update;
 end if;
 r:=public.consultar_resultado_entrega(p_pedido_id,p_version_esperada,p_clave,p_items,p_cobro,p_diferencias);
 if (r->>'confirmada')::boolean then
  if (r->>'misma_solicitud')::boolean then
   select * into o from operativo_privado.observaciones_entrega where pedido_id=p_pedido_id;
   if coalesce(o.observacion,'') is distinct from observacion_normalizada
    or (o.pedido_id is not null and (o.clave is distinct from p_clave or o.actor_id is distinct from auth.uid())) then
    raise exception 'OBSERVACION_NO_COINCIDE_CON_SOLICITUD_CONFIRMADA';
   end if;
  end if;
  return r||jsonb_build_object('reintento',true);
 end if;
 if p_solo_consultar then return r; end if;
 if p_diferencias then
  r:=public.confirmar_entrega_hubo_diferencias(p_pedido_id,p_version_esperada,p_clave,p_items,p_cobro);
 else
  r:=public.confirmar_entrega_todo_correcto(p_pedido_id,p_version_esperada,p_clave,p_items,p_cobro);
 end if;
 if r->'resultado'->>'pedido_id' is distinct from p_pedido_id::text
  or r->'resultado'->>'estado' is distinct from 'entregado' then raise exception 'COMPROBANTE_ENTREGA_INVALIDO'; end if;
 if observacion_normalizada<>'' then
  insert into operativo_privado.observaciones_entrega(pedido_id,clave,actor_id,observacion)
  values(p_pedido_id,p_clave,auth.uid(),observacion_normalizada);
 end if;
 return r||jsonb_build_object('confirmada',true,'misma_solicitud',true);
end; $$;

-- Solo evidencia persistida: salida tomada del snapshot inmutable del evento
-- salir, no de la preparación actual. Las salidas antiguas sin evidencia compatible
-- se devuelven como null. Entregado procede del snapshot definitivo vigente.
-- Validar la forma sin recalcular cantidades/importes ni deducir precios.
-- Un evento localizado pero incompatible conserva su lugar cronológico: null,
-- no los productos de una salida anterior que sí tenga un formato compatible.
create function public.leer_contexto_entrega_admin(p_pedido_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare salida jsonb; venta jsonb; observacion jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 select p.venta_definitiva_snapshot into venta from public.pedidos p where p.id=p_pedido_id;
 select jsonb_build_object('texto',o.observacion,'actor_id',o.actor_id,'fecha',o.fecha) into observacion
 from operativo_privado.observaciones_entrega o where o.pedido_id=p_pedido_id;
 select evidencia.productos into salida from (
  select e.instante,e.clave,
   case when jsonb_typeof(x.value->'preparacion')='array' and not exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(x.value->'preparacion')='array'
     then x.value->'preparacion' else '[]'::jsonb end) i
    where jsonb_typeof(i->'item_pedido_id') is distinct from 'string'
     or jsonb_typeof(i->'cantidad_preparada') is distinct from 'number'
     or jsonb_typeof(i->'importe_linea_operativo') is distinct from 'number'
   ) then x.value->'preparacion' end as productos
  from operativo_privado.ruta_multi_eventos e
  cross join lateral jsonb_array_elements(case when jsonb_typeof(e.resultado->'snapshot'->'pedidos')='array'
   then e.resultado->'snapshot'->'pedidos' else '[]'::jsonb end) x
  where e.solicitud->>'accion'='salir' and x.value->'pedido'->>'id'=p_pedido_id::text
  union all
  select h.instante,h.clave,
   case when jsonb_typeof(x.value->'productos')='array' and not exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(x.value->'productos')='array'
     then x.value->'productos' else '[]'::jsonb end) i
    where jsonb_typeof(i->'id') is distinct from 'string'
     or jsonb_typeof(i->'cantidad') is distinct from 'number'
     or jsonb_typeof(i->'importe') is distinct from 'number'
   ) then (select coalesce(jsonb_agg(jsonb_build_object('item_pedido_id',i->'id',
     'cantidad_preparada',i->'cantidad','importe_linea_operativo',i->'importe') order by posicion),'[]'::jsonb)
    from jsonb_array_elements(x.value->'productos') with ordinality as producto(i,posicion)) end
  from operativo_privado.historial_cargas h
  cross join lateral jsonb_array_elements(case
   when jsonb_typeof(h.resultado->'snapshot'->'pedidos')='array' then h.resultado->'snapshot'->'pedidos'
   when jsonb_typeof(h.resultado->'pedidos')='array' then h.resultado->'pedidos'
   else '[]'::jsonb end) x
  where h.solicitud->>'accion'='salir' and x.value->>'id'=p_pedido_id::text
    and x.value->>'incluido'='true'
 ) evidencia order by evidencia.instante desc,evidencia.clave desc limit 1;
 return jsonb_build_object('observacion',observacion,'salida',salida,'venta',venta);
end; $$;

alter function public.resolver_entrega_con_observacion(uuid,bigint,uuid,jsonb,jsonb,boolean,text,boolean) owner to postgres;
alter function public.leer_contexto_entrega_admin(uuid) owner to postgres;
revoke all on function public.resolver_entrega_con_observacion(uuid,bigint,uuid,jsonb,jsonb,boolean,text,boolean),public.leer_contexto_entrega_admin(uuid) from public,anon,authenticated,service_role;
grant execute on function public.resolver_entrega_con_observacion(uuid,bigint,uuid,jsonb,jsonb,boolean,text,boolean),public.leer_contexto_entrega_admin(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
