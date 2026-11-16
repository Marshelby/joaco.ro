-- MANUAL, NO EJECUTADO. Instalación única como postgres, transaccional.
-- Requiere reparto fase 5, rutas múltiples fase 3, entrega contrato 2,
-- corregir_flujo_entrega_cobro y entrega_observaciones_y_detalle_historico.
-- Revisar los cuerpos instalados antes de aplicar. No cambia RLS, es_admin,
-- grants de tablas, asignaciones, preparación ni fórmulas financieras.
begin;
set local lock_timeout='5s';
do $$ declare f text; rol text; begin
 if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_schema_privilege(rol,'operativo_privado','USAGE') or has_schema_privilege(rol,'operativo_privado','CREATE') or has_schema_privilege(rol,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO'; end if;
 end loop;
 foreach f in array array['public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)',
 'public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)',
 'operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)'] loop
 if not exists(select 1 from pg_proc where oid=to_regprocedure(f) and proowner='postgres'::regrole and position('operativo_privado.permiso_reparto' in prosrc)>0) then raise exception 'REQUIERE_CAPACIDAD_REPARTO: %',f; end if;
 end loop;
end $$;

-- Sólo capacidades privadas emitidas por wrappers con pertenencia comprobada.
-- Permite consultar comprobantes tras cerrar, sin permitir nuevas escrituras.
create function operativo_privado.permiso_comprobante_reparto(p_pedido uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
 select p_pedido is not null and public.acceso_repartidor() and (
 exists(select 1 from operativo_privado.reparto_capacidad c
 join operativo_privado.reparto_asignaciones a on a.fecha=c.fecha and a.usuario_id=c.actor
 join operativo_privado.carga_pedidos cp on cp.fecha=a.fecha and cp.pedido_id=c.pedido_id and cp.incluido
 where c.transaccion=txid_current() and c.actor=auth.uid() and c.pedido_id=p_pedido)
 or exists(select 1 from operativo_privado.ruta_multi_capacidad c
 join operativo_privado.ruta_multi_repartidores a on a.ruta_id=c.ruta_id and a.usuario_id=c.actor
 join operativo_privado.ruta_multi_pedidos m on m.ruta_id=c.ruta_id and m.pedido_id=c.pedido_id
 where c.transaccion=txid_current() and c.actor=auth.uid() and c.pedido_id=p_pedido and c.accion in ('entregar','fallida')));
$$;
alter function operativo_privado.permiso_comprobante_reparto(uuid) owner to postgres;
revoke all on function operativo_privado.permiso_comprobante_reparto(uuid) from public,anon,authenticated,service_role;

-- Modificar exclusivamente la expresión de autorización; conservar cuerpo,
-- OID, ACL y configuración instalados, incluidas correcciones 42702.
-- Una segunda instalación falla en CREATE y revierte: no acumula permisos.
do $$ declare f text; d text; antes pg_proc%rowtype; despues pg_proc%rowtype; begin
 foreach f in array array[
 'public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)',
 'public.consultar_resultado_entrega(uuid,bigint,uuid,jsonb,jsonb,boolean)',
 'public.resolver_entrega_con_observacion(uuid,bigint,uuid,jsonb,jsonb,boolean,text,boolean)'] loop
 select * into antes from pg_proc where oid=to_regprocedure(f);
 if not found or antes.proowner<>'postgres'::regrole or not antes.prosecdef or antes.prorettype<>'jsonb'::regtype then raise exception 'CONTRATO_INCOMPATIBLE: %',f; end if;
 d:=pg_get_functiondef(antes.oid);
 if (length(d)-length(replace(d,'public.es_admin()','')))/length('public.es_admin()')<>1 then raise exception 'GUARD_INESPERADO: %',f; end if;
 execute replace(d,'public.es_admin()','(public.es_admin() or operativo_privado.permiso_comprobante_reparto(p_pedido_id))');
 select * into despues from pg_proc where oid=antes.oid;
 if (to_jsonb(antes)-'prosrc') is distinct from (to_jsonb(despues)-'prosrc') then raise exception 'ATRIBUTOS_MODIFICADOS: %',f; end if;
 end loop;
end $$;

create function public.operar_entrega_asignada(p_ambito jsonb,p_accion text,p_solicitud jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare
 rid uuid:=(p_ambito->>'ruta')::uuid; v_fecha date:=(p_ambito->>'fecha')::date;
 ver bigint:=(p_ambito->>'asignacion')::bigint; pid uuid:=(p_solicitud->>'p_pedido_id')::uuid;
 pv bigint:=(p_solicitud->>'p_version_esperada')::bigint; v_clave uuid:=(p_solicitud->>'p_clave')::uuid;
 rm operativo_privado.rutas_multi%rowtype; a operativo_privado.reparto_asignaciones%rowtype;
 p public.pedidos%rowtype; estado_ruta text; version_ruta bigint;
 productos jsonb; reglas jsonb; items jsonb; subtotal numeric; abonos numeric; total numeric;
 r jsonb; consulta jsonb; anterior jsonb; intento operativo_privado.historial_operativo%rowtype; h operativo_privado.ruta_multi_eventos%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if not coalesce(public.acceso_repartidor(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if pid is null or v_fecha is null or not isfinite(v_fecha) or ver is null or ver<0 or pv is null or pv<0
 or p_accion is null or p_accion not in ('vista','consultar','confirmar','fallida') then raise exception 'OPERACION_INVALIDA'; end if;
 -- Mismas barreras que rutas múltiples. NOWAIT evita invertir cliente -> pedido.
 lock table public.pedidos in exclusive mode nowait;
 perform pg_advisory_xact_lock(582051005);
 if rid is not null then
  select * into rm from operativo_privado.rutas_multi where id=rid for update;
  if not found or rm.fecha<>v_fecha or not exists(select 1 from operativo_privado.ruta_multi_repartidores where ruta_id=rid and usuario_id=auth.uid())
   or not exists(select 1 from operativo_privado.ruta_multi_pedidos where ruta_id=rid and pedido_id=pid) then raise exception 'NO_AUTORIZADO'; end if;
  estado_ruta:=rm.estado; version_ruta:=rm.version;
  insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,pid,case when p_accion='fallida' then 'fallida' else 'entregar' end);
 else
  -- Variables locales con nombre propio; la etiqueta implícita de la función
  -- sólo califica parámetros, no las variables declaradas en este bloque.
  select asignacion.* into a from operativo_privado.reparto_asignaciones asignacion
   where asignacion.fecha=v_fecha and asignacion.usuario_id=auth.uid();
  if not found or a.usuario_id<>auth.uid() or not exists(select 1 from operativo_privado.carga_pedidos cp where cp.fecha=a.fecha and cp.pedido_id=pid and cp.incluido)
   or not exists(select 1 from public.rutas where id=a.ruta_id and es_principal and fecha_operativa=a.fecha) then raise exception 'NO_AUTORIZADO'; end if;
  select c.estado into estado_ruta from operativo_privado.cargas c where c.fecha=a.fecha;
  version_ruta:=a.version;
  insert into operativo_privado.reparto_capacidad values(txid_current(),auth.uid(),pid,v_fecha);
 end if;
 select * into p from public.pedidos where id=pid;
 if not found or p.fecha_entrega is distinct from v_fecha then raise exception 'NO_AUTORIZADO'; end if;
 -- Sólo el comprobante propio, con idéntico payload/actor, precede versiones.
 -- Un cambio de asignación nunca concede acceso a rutas/pedidos ajenos.
 if p_accion in ('consultar','confirmar') then
  if v_clave is null or jsonb_typeof(p_solicitud->'p_diferencias') is distinct from 'boolean' then raise exception 'OPERACION_INVALIDA'; end if;
  consulta:=public.resolver_entrega_con_observacion(pid,pv,v_clave,p_solicitud->'p_items',p_solicitud->'p_cobro',
    (p_solicitud->>'p_diferencias')::boolean,p_solicitud->>'p_observacion',true);
  if p_accion='consultar' or (consulta->>'confirmada')::boolean then r:=consulta; end if;
 elsif p_accion='fallida' and v_clave is not null then
  -- La RPC de fallo compara motivo, observaciones, versión y actor en historial.
  select * into intento from operativo_privado.historial_operativo where pedido_id=pid and clave_idempotencia=v_clave;
  if found then
   if intento.actor_id is distinct from auth.uid() or intento.operacion<>'entrega_fallida' or intento.version_esperada is distinct from pv
    or intento.solicitud is distinct from jsonb_build_object('contrato',1,'motivo',p_solicitud->>'p_motivo','observaciones',p_solicitud->>'p_observaciones') then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
   r:=jsonb_build_object('reintento',true,'resultado',intento.resultado);
  end if;
 end if;
 if r is null then
  if version_ruta is distinct from ver then raise exception 'ASIGNACION_CAMBIO'; end if;
  if estado_ruta not in ('en_ruta','en_reparto') or estado_ruta is null then raise exception 'RUTA_NO_EDITABLE'; end if;
  if p_accion='vista' then
   if p.estado<>'en_reparto' or p.regimen_contable<>'entrega_v1' or p.preparacion_finalizada_en is null or p.venta_definitiva_snapshot is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
   if coalesce((select v.version from operativo_privado.versiones_pedido v where v.pedido_id=pid),0)<>pv then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
   if not exists(select 1 from public.items_pedido where pedido_id=pid) or exists(
    select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id and pi.pedido_id=pid
    where i.pedido_id=pid and (not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.cantidad_preparada<0 or pi.importe_linea_operativo is null or pi.importe_linea_operativo<0)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
   select sum(pi.importe_linea_operativo), jsonb_agg(jsonb_build_object('id',i.id,'nombre',i.nombre_producto_snapshot,'presentacion',i.nombre_presentacion_snapshot,
    'unidad',i.unidad_snapshot,'cantidad',pi.cantidad_preparada,'importe',pi.importe_linea_operativo) order by i.id),
    jsonb_agg(jsonb_build_object('item_pedido_id',i.id,'cantidad_entregada',pi.cantidad_preparada) order by i.id),
    jsonb_agg(jsonb_build_object('id',i.id,'cantidad',i.cantidad,'total_linea',i.total_linea,'total_final_administrativo',i.total_final_administrativo,
     'precio_final_unitario_snapshot',i.precio_final_unitario_snapshot,'modo_cantidad_snapshot',i.modo_cantidad_snapshot,
     'nombre_presentacion_snapshot',i.nombre_presentacion_snapshot,'unidad_snapshot',i.unidad_snapshot) order by i.id)
   into subtotal,productos,items,reglas from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=pid;
   total:=subtotal+p.costo_entrega-p.descuento;
   select coalesce(sum(ap.monto_aplicado),0) into abonos from public.aplicaciones_pago ap join public.pagos pa on pa.id=ap.pago_id
    where ap.pedido_id=pid and ap.activa and pa.estado='confirmado';
   if total is null or total not between 0 and 9007199254740991 or total is distinct from p.total_operativo_preparacion::numeric
    or abonos not between 0 and total then raise exception 'TOTAL_ENTREGA_INVALIDO'; end if;
   r:=jsonb_build_object('resumen',jsonb_build_object('solicitud',jsonb_build_object('p_pedido_id',pid,'p_version_esperada',pv,'p_clave',gen_random_uuid(),'p_items',items),
    'productos',productos,'subtotal',subtotal,'costoEntrega',p.costo_entrega,'descuento',p.descuento,'total',total),'reglas',reglas,'aplicadoPrevio',abonos);
  else
   if v_clave is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
   perform 1 from public.clientes where id=p.cliente_id for update nowait;
   if rid is not null then
    select evento.* into h from operativo_privado.ruta_multi_eventos evento where evento.clave=v_clave;
    if found then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    anterior:=operativo_privado.snapshot_ruta_multi(rid);
   end if;
   if p_accion='fallida' then
    r:=public.registrar_entrega_fallida(pid,pv,v_clave,p_solicitud->>'p_motivo',p_solicitud->>'p_observaciones');
   else
    r:=public.resolver_entrega_con_observacion(pid,pv,v_clave,p_solicitud->'p_items',p_solicitud->'p_cobro',
     (p_solicitud->>'p_diferencias')::boolean,p_solicitud->>'p_observacion',false);
   end if;
   if rid is not null then
    update operativo_privado.rutas_multi set version=version+1 where id=rid;
    insert into operativo_privado.ruta_multi_eventos(clave,ruta_id,actor,solicitud,anterior,resultado)
     values(v_clave,rid,auth.uid(),jsonb_build_object('accion',p_accion,'ambito',p_ambito,'solicitud',p_solicitud),anterior,
      jsonb_build_object('ok',true,'snapshot',operativo_privado.snapshot_ruta_multi(rid)));
   end if;
  end if;
 end if;
 delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
 delete from operativo_privado.reparto_capacidad where transaccion=txid_current();
 -- Nunca exponer snapshots, pagos de otros pedidos ni historial general.
 if p_accion='vista' then return r; end if;
 if p_accion='fallida' then return jsonb_build_object('resultado',jsonb_build_object('pedido_id',r->'resultado'->'pedido_id','estado',r->'resultado'->'estado')); end if;
 return jsonb_build_object('confirmada',r->'confirmada','misma_solicitud',r->'misma_solicitud','reintento',r->'reintento',
  'resultado',case when r->'resultado' is null then null else jsonb_build_object('pedido_id',r->'resultado'->'pedido_id','estado',r->'resultado'->'estado',
   'deuda_pendiente',r->'resultado'->'deuda_pendiente','saldo_a_favor_generado',r->'resultado'->'saldo_a_favor_generado') end);
end $$;
alter function public.operar_entrega_asignada(jsonb,text,jsonb) owner to postgres;
revoke all on function public.operar_entrega_asignada(jsonb,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.operar_entrega_asignada(jsonb,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
