-- Instalación MANUAL única como postgres. No ejecutado por el agente.
-- Posterior a terminar_ruta_fase2, fases de entrega/cobro y repartidores_gestion_fase1.
-- No convierte cargas históricas. Una fecha con carga persistida sigue en legado.
-- No cambia importes, pagos, ventas ni las implementaciones contables de entrega.
begin;
set local lock_timeout = '5s';
do $$ declare f text; r text; begin
 if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
 if to_regclass('operativo_privado.rutas_multi') is not null then raise exception 'FASE_YA_INSTALADA'; end if;
 foreach f in array array['public.leer_gestion_repartidores_admin(text)',
 'public.cerrar_ruta(date,bigint,uuid,text)','public.revisar_cierre_ruta(date)',
 'public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)','public.orden_ruta_dia(date,uuid[],bigint)',
 'public.obtener_o_crear_ruta_administrativa(date)','public.sincronizar_paradas_ruta_administrativa(uuid)',
 'public.administrar_reparto(text,uuid,boolean,uuid)','public.operar_mi_reparto(date,bigint,text,uuid,bigint,uuid,text,text,text)',
 'public.leer_mi_reparto()','public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)',
 'public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)',
 'operativo_privado.permiso_reparto(uuid,date)','public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid)',
 'public.cerrar_preparacion_explicita(uuid,bigint,uuid)',
 'public.guardar_orden_ruta_administrativo(uuid,uuid[],bigint)',
 'public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text)'] loop
 if to_regprocedure(f) is null or not exists(select 1 from pg_proc where oid=to_regprocedure(f) and proowner='postgres'::regrole) then raise exception 'DEPENDENCIA_INCOMPATIBLE: %',f; end if;
 end loop;
 foreach r in array array['anon','authenticated','service_role'] loop
 if has_schema_privilege(r,'operativo_privado','USAGE') or has_schema_privilege(r,'operativo_privado','CREATE') or has_schema_privilege(r,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',r; end if;
 end loop;
end $$;
lock table public.pedidos, public.items_pedido, public.preparacion_items_pedido,
 public.rutas, public.paradas_ruta, operativo_privado.cargas, operativo_privado.carga_pedidos,
 operativo_privado.reparto_asignaciones, operativo_privado.repartidores in access exclusive mode nowait;

create table operativo_privado.rutas_multi (
 id uuid primary key references public.rutas(id), fecha date not null check(isfinite(fecha)),
 nombre text not null check(length(btrim(nombre)) between 1 and 100),
 estado text not null default 'planificacion' check(estado in ('planificacion','preparacion','en_reparto','cerrada')),
 version bigint not null default 0 check(version>=0), salida_en timestamptz, cierre jsonb,
 unique(fecha,nombre), check((estado='cerrada')=(cierre is not null)),
 check((estado in ('en_reparto','cerrada'))=(salida_en is not null))
);
-- Una pertenencia vigente por pedido, incluso tras cierre hasta la futura fase
-- de reprogramación. La evidencia de selecciones anteriores permanece en eventos.
create table operativo_privado.ruta_multi_pedidos (
 pedido_id uuid primary key references public.pedidos(id),
 ruta_id uuid not null references operativo_privado.rutas_multi(id), posicion integer not null check(posicion>0)
);
create index ruta_multi_pedidos_ruta on operativo_privado.ruta_multi_pedidos(ruta_id,posicion);
create table operativo_privado.ruta_multi_repartidores (
 ruta_id uuid not null references operativo_privado.rutas_multi(id),
 usuario_id uuid not null references operativo_privado.repartidores(usuario_id), primary key(ruta_id,usuario_id)
);
create table operativo_privado.ruta_multi_autorizaciones (
 ruta_id uuid not null references operativo_privado.rutas_multi(id), pedido_id uuid not null references public.pedidos(id),
 version bigint not null, cantidades jsonb not null, motivo text not null, actor uuid not null, instante timestamptz not null default clock_timestamp(),
 primary key(ruta_id,pedido_id)
);
create table operativo_privado.ruta_multi_eventos (
 clave uuid primary key, ruta_id uuid not null references operativo_privado.rutas_multi(id),
 actor uuid not null, instante timestamptz not null default clock_timestamp(), solicitud jsonb not null,
 anterior jsonb not null, resultado jsonb not null
);
create trigger ruta_multi_eventos_inmutables before update or delete on operativo_privado.ruta_multi_eventos for each row execute function operativo_privado.impedir_mutacion_historial();
create trigger ruta_multi_eventos_no_truncables before truncate on operativo_privado.ruta_multi_eventos for each statement execute function operativo_privado.impedir_mutacion_historial();
-- Capacidad privada exacta para salida y entregas; jamás una GUC falsificable.
create table operativo_privado.ruta_multi_capacidad (
 transaccion bigint primary key, actor uuid not null, ruta_id uuid not null, pedido_id uuid, accion text not null
);
do $$ declare t text; begin
 foreach t in array array['rutas_multi','ruta_multi_pedidos','ruta_multi_repartidores','ruta_multi_autorizaciones','ruta_multi_eventos','ruta_multi_capacidad'] loop
 execute format('alter table operativo_privado.%I owner to postgres',t);
 execute format('alter table operativo_privado.%I enable row level security',t);
 execute format('alter table operativo_privado.%I force row level security',t);
 execute format('revoke all on operativo_privado.%I from public,anon,authenticated,service_role',t);
 execute format('create trigger multi_no_truncable before truncate on operativo_privado.%I for each statement execute function operativo_privado.impedir_mutacion_historial()',t);
 end loop;
end $$;

create function operativo_privado.cantidades_ruta_multi(p_pedido uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(jsonb_build_object('item',i.id,'solicitada',i.cantidad,'preparada',coalesce(pi.cantidad_preparada,0),
 'diferencia',i.cantidad-coalesce(pi.cantidad_preparada,0)) order by i.id),'[]'::jsonb)
 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido;
$$;
create function operativo_privado.estado_preparacion_multi(p_pedido uuid) returns text
language sql stable security definer set search_path=pg_catalog as $$
 select case when count(*)=0 or coalesce(bool_and(coalesce(pi.cantidad_preparada,0)=0),true) then 'sin_preparar'
 when bool_and(coalesce(pi.cantidad_preparada,0)>=i.cantidad) then 'listo' else 'parcial' end
 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido;
$$;
create function operativo_privado.snapshot_ruta_multi(p_ruta uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
 select jsonb_build_object('ruta',to_jsonb(r),
 'pedidos',coalesce((select jsonb_agg(jsonb_build_object('pedido',to_jsonb(p),'posicion',m.posicion,
 'version',coalesce(v.version,0),'cantidades',operativo_privado.cantidades_ruta_multi(p.id),
 'preparacion',coalesce((select jsonb_agg(to_jsonb(pi) order by item_pedido_id) from public.preparacion_items_pedido pi where pi.pedido_id=p.id),'[]'::jsonb),
 'historial',coalesce((select jsonb_agg(to_jsonb(h) order by version) from operativo_privado.historial_operativo h where h.pedido_id=p.id),'[]'::jsonb)) order by m.posicion,p.id)
 from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id left join operativo_privado.versiones_pedido v on v.pedido_id=p.id where m.ruta_id=r.id),'[]'::jsonb),
 'repartidores',coalesce((select jsonb_agg(usuario_id order by usuario_id) from operativo_privado.ruta_multi_repartidores where ruta_id=r.id),'[]'::jsonb),
 'autorizaciones',coalesce((select jsonb_agg(to_jsonb(a) order by pedido_id) from operativo_privado.ruta_multi_autorizaciones a where ruta_id=r.id),'[]'::jsonb))
 from operativo_privado.rutas_multi r where r.id=p_ruta;
$$;

create function public.leer_rutas_multiples(p_fecha date) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_fecha is null or not isfinite(p_fecha) then raise exception 'FECHA_INVALIDA'; end if;
 return jsonb_build_object('contrato',2,'legado',exists(select 1 from operativo_privado.cargas where fecha=p_fecha),
 'rutas',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.nombre,'estado',r.estado,'version',r.version,
 'pedidos',coalesce((select jsonb_agg(pedido_id order by posicion,pedido_id) from operativo_privado.ruta_multi_pedidos where ruta_id=r.id),'[]'::jsonb),
 'repartidores',coalesce((select jsonb_agg(usuario_id order by usuario_id) from operativo_privado.ruta_multi_repartidores where ruta_id=r.id),'[]'::jsonb),
 'autorizaciones',coalesce((select jsonb_agg(jsonb_build_object('pedido',pedido_id,'version',version,'motivo',motivo,'actor',actor,'cantidades',cantidades) order by pedido_id) from operativo_privado.ruta_multi_autorizaciones where ruta_id=r.id),'[]'::jsonb),
 'contadores',(select jsonb_build_object('preparados',count(*) filter(where operativo_privado.estado_preparacion_multi(p.id)='listo'),
 'en_reparto',count(*) filter(where p.estado='en_reparto'),'entregados',count(*) filter(where p.estado='entregado'),
 'no_entregados',count(*) filter(where p.estado='entrega_fallida'),'pendientes',count(*) filter(where p.estado not in ('entregado','entrega_fallida')))
 from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id where m.ruta_id=r.id)) order by r.nombre,r.id)
 from operativo_privado.rutas_multi r where r.fecha=p_fecha),'[]'::jsonb),
 'repartidores',coalesce((select jsonb_agg(jsonb_build_object('usuario_id',rp.usuario_id,'nombre',coalesce(p.nombre,'Repartidor')) order by p.nombre,rp.usuario_id)
 from operativo_privado.repartidores rp join public.perfiles p on p.usuario_id=rp.usuario_id where rp.activo and p.rol<>'admin'),'[]'::jsonb));
end $$;

-- Barrera en BD: congela preparación/fecha/líneas al salir y todo al cerrar.
-- Los contratos contables vigentes conservan sus propias barreras para ventas,
-- fallos y correcciones; sólo ellos admiten esos campos durante el reparto.
create function operativo_privado.proteger_ruta_multi() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare pid uuid; r operativo_privado.rutas_multi%rowtype; omitidas text[];
begin
 if TG_TABLE_NAME<>'pedidos' and TG_OP='UPDATE' then
 if old.pedido_id is distinct from new.pedido_id and exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id in (old.pedido_id,new.pedido_id)) then raise exception 'PERTENENCIA_INMUTABLE'; end if;
 end if;
 if TG_TABLE_NAME='pedidos' then pid:=old.id;
 elsif TG_OP='DELETE' then pid:=old.pedido_id;
 else pid:=new.pedido_id; end if;
 -- Lock común del pedido también para INSERT/DELETE de líneas, sin invertir
 -- el orden de RPC legacy: abortar ante contención y reintentar la operación.
 perform 1 from public.pedidos where id=pid for update nowait;
 select rm.* into r from operativo_privado.ruta_multi_pedidos m join operativo_privado.rutas_multi rm on rm.id=m.ruta_id where m.pedido_id=pid;
 if not found then
 if TG_OP='DELETE' then return old; else return new; end if;
 end if;
 if TG_TABLE_NAME<>'pedidos' then
 if TG_OP='UPDATE' and old.pedido_id is distinct from new.pedido_id then raise exception 'PERTENENCIA_INMUTABLE'; end if;
 if r.estado in ('en_reparto','cerrada') or (TG_TABLE_NAME='preparacion_items_pedido' and r.estado<>'preparacion') then raise exception 'RUTA_NO_EDITABLE'; end if;
 elsif TG_OP='DELETE' then raise exception 'PEDIDO_ASIGNADO_A_RUTA';
 else
 if r.estado='planificacion' and new.estado='preparando' and old.estado is distinct from new.estado then raise exception 'RUTA_NO_EDITABLE'; end if;
 if new.fecha_entrega is distinct from old.fecha_entrega then raise exception 'PEDIDO_ASIGNADO_A_RUTA'; end if;
 if r.estado='cerrada' and to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'RUTA_NO_EDITABLE'; end if;
 if new.estado='en_reparto' and old.estado is distinct from new.estado and not exists(
 select 1 from operativo_privado.ruta_multi_capacidad c where c.transaccion=txid_current() and c.actor=auth.uid() and c.ruta_id=r.id and c.pedido_id=pid and c.accion='salir') then raise exception 'SALIDA_REQUIERE_RUTA'; end if;
 if r.estado='en_reparto' then
 select array['estado','fecha_actualizacion','venta_definitiva_snapshot','venta_reconocida_en']::text[] || coalesce(array_agg(attname::text),array[]::text[]) into omitidas
 from pg_attribute where attrelid=TG_RELID and attnum>0 and not attisdropped and attgenerated<>'';
 if (to_jsonb(new)-omitidas) is distinct from (to_jsonb(old)-omitidas) or new.estado not in ('en_reparto','entregado','entrega_fallida') then raise exception 'RUTA_NO_EDITABLE'; end if;
 end if;
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
create trigger multi_proteger_pedido before update or delete on public.pedidos for each row execute function operativo_privado.proteger_ruta_multi();
create trigger multi_proteger_items before insert or update or delete on public.items_pedido for each row execute function operativo_privado.proteger_ruta_multi();
create trigger multi_proteger_preparacion before insert or update or delete on public.preparacion_items_pedido for each row execute function operativo_privado.proteger_ruta_multi();

create function public.operar_ruta_multiple(p_solicitud jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare s jsonb:=p_solicitud; accion text:=s->>'accion'; rid uuid:=(s->>'ruta')::uuid;
 f date:=(s->>'fecha')::date; clave uuid:=(s->>'clave')::uuid; ver bigint:=(s->>'version')::bigint;
 r operativo_privado.rutas_multi%rowtype; h operativo_privado.ruta_multi_eventos%rowtype;
 p public.pedidos%rowtype; pv bigint; antes jsonb; resultado jsonb; cantidades jsonb; prep text; ids uuid[]; us uuid[];
 esadmin boolean; it jsonb; hist operativo_privado.historial_operativo%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 esadmin:=auth.uid() is not null and coalesce(public.es_admin(),false);
 if auth.uid() is null or (not esadmin and not public.acceso_repartidor()) then raise exception 'NO_AUTORIZADO'; end if;
 if s is null or jsonb_typeof(s)<>'object' or rid is null or f is null or not isfinite(f) or clave is null or ver is null or ver<0
 or accion is null or accion not in ('crear','seleccionar','asignar','preparar','autorizar_parcial','salir','cerrar','ordenar','entregar','fallida') then raise exception 'OPERACION_INVALIDA'; end if;
 -- Serializa con RPC anteriores y preparación. NOWAIT evita ciclos cliente ->
 -- pedido de las RPC contables: un conflicto revierte sin efectos parciales.
 lock table public.pedidos in exclusive mode nowait;
 perform pg_advisory_xact_lock(582051005);
 if not esadmin and (accion not in ('entregar','fallida','cerrar') or not exists(
 select 1 from operativo_privado.ruta_multi_repartidores a join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo
 join operativo_privado.rutas_multi rm on rm.id=a.ruta_id where a.ruta_id=rid and a.usuario_id=auth.uid() and rm.fecha=f)) then raise exception 'NO_AUTORIZADO'; end if;
 select e.* into h from operativo_privado.ruta_multi_eventos e where e.clave=(s->>'clave')::uuid;
 if found then
 if h.actor<>auth.uid() or h.solicitud<>s then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
 return h.resultado - 'snapshot';
 end if;
 if exists(select 1 from operativo_privado.cargas where fecha=f) then raise exception 'JORNADA_LEGACY'; end if;
 if accion='crear' then
 if ver<>0 or nullif(btrim(s->>'nombre'),'') is null or length(btrim(s->>'nombre'))>100 then raise exception 'NOMBRE_INVALIDO'; end if;
 insert into public.rutas(id,fecha_operativa,nombre,creada_por) values(rid,f,btrim(s->>'nombre'),auth.uid());
 insert into operativo_privado.rutas_multi(id,fecha,nombre) values(rid,f,btrim(s->>'nombre'));
 end if;
 select * into r from operativo_privado.rutas_multi where id=rid for update;
 if not found or r.fecha<>f then raise exception 'RUTA_NO_ENCONTRADA'; end if;
 -- También consumir versión de ruta para invalidar asignaciones revocadas.
 if r.version<>ver then raise exception 'VERSION_RUTA_CONFLICTO'; end if;
 if r.estado='cerrada' or (r.estado='en_reparto' and accion not in ('cerrar','entregar','fallida')) then raise exception 'RUTA_NO_EDITABLE'; end if;
 antes:=operativo_privado.snapshot_ruta_multi(rid);
 if accion in ('seleccionar','ordenar') then
 if jsonb_typeof(s->'pedidos') is distinct from 'array' then raise exception 'SELECCION_INVALIDA'; end if;
 select coalesce(array_agg(value::uuid),array[]::uuid[]) into ids from jsonb_array_elements_text(s->'pedidos');
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
 if accion='ordenar' and (select coalesce(array_agg(pedido_id order by pedido_id),array[]::uuid[]) from operativo_privado.ruta_multi_pedidos where ruta_id=rid)
 is distinct from (select coalesce(array_agg(x order by x),array[]::uuid[]) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
 if exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=any(ids) and ruta_id<>rid) then raise exception 'PEDIDO_YA_ASIGNADO'; end if;
 if (select count(*) from public.pedidos where id=any(ids) and fecha_entrega=f and estado in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho'))<>cardinality(ids)
 or exists(select 1 from operativo_privado.carga_pedidos where pedido_id=any(ids)) then raise exception 'SELECCION_INVALIDA'; end if;
 delete from operativo_privado.ruta_multi_autorizaciones where ruta_id=rid and not(pedido_id=any(ids));
 delete from operativo_privado.ruta_multi_pedidos where ruta_id=rid;
 insert into operativo_privado.ruta_multi_pedidos(pedido_id,ruta_id,posicion) select x,rid,n::integer from unnest(ids) with ordinality u(x,n);
 elsif accion='asignar' then
 if jsonb_typeof(s->'repartidores') is distinct from 'array' then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
 select coalesce(array_agg(value::uuid),array[]::uuid[]) into us from jsonb_array_elements_text(s->'repartidores');
 if cardinality(us)<>(select count(*) from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=any(us) and rp.activo and pf.rol<>'admin') then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
 delete from operativo_privado.ruta_multi_repartidores where ruta_id=rid;
 insert into operativo_privado.ruta_multi_repartidores select rid,x from unnest(us) x;
 elsif accion='preparar' then
 if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 if r.estado<>'planificacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
 update operativo_privado.rutas_multi set estado='preparacion' where id=rid;
 elsif accion='autorizar_parcial' then
 if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
 select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid for update of pe;
 if not found or operativo_privado.estado_preparacion_multi(p.id)<>'parcial' then raise exception 'AUTORIZACION_INVALIDA'; end if;
 select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
 if pv is distinct from (s->>'version_pedido')::bigint then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
 if nullif(btrim(s->>'motivo'),'') is null or length(s->>'motivo')>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
 cantidades:=operativo_privado.cantidades_ruta_multi(p.id);
 insert into operativo_privado.ruta_multi_autorizaciones(ruta_id,pedido_id,version,cantidades,motivo,actor)
 values(rid,p.id,pv,cantidades,btrim(s->>'motivo'),auth.uid()) on conflict(ruta_id,pedido_id) do update set
 version=excluded.version,cantidades=excluded.cantidades,motivo=excluded.motivo,actor=excluded.actor,instante=clock_timestamp();
 elsif accion='salir' then
 if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
 if not exists(select 1 from operativo_privado.ruta_multi_pedidos where ruta_id=rid) then raise exception 'RUTA_VACIA'; end if;
 if not exists(select 1 from operativo_privado.ruta_multi_repartidores where ruta_id=rid) then raise exception 'REPARTIDORES_REQUERIDOS'; end if;
 if exists(select 1 from operativo_privado.ruta_multi_repartidores a where a.ruta_id=rid and not exists(select 1 from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=a.usuario_id and rp.activo and pf.rol<>'admin')) then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
 for p in select pe.* from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid order by pe.id for update of pe loop
 if p.fecha_entrega<>f or p.estado<>'listo_despacho' or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_LISTO'; end if;
 perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
 perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
 if not exists(select 1 from public.items_pedido where pedido_id=p.id) or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
 prep:=operativo_privado.estado_preparacion_multi(p.id);
 if prep='sin_preparar' then raise exception 'SIN_PREPARAR'; end if;
 select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
 if prep='parcial' and not exists(select 1 from operativo_privado.ruta_multi_autorizaciones a where a.ruta_id=rid and a.pedido_id=p.id and a.version=pv and a.cantidades=operativo_privado.cantidades_ruta_multi(p.id)) then raise exception 'PARCIAL_NO_AUTORIZADO'; end if;
 perform operativo_privado.iniciar_operacion(p.id,pv,clave,'ruta_multiple_salir',s);
 insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,'salir');
 update public.pedidos set estado='en_reparto' where id=p.id;
 delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
 perform operativo_privado.completar_operacion(p.id,pv,clave,'ruta_multiple_salir',s,null,'Salida explícita por ruta',to_jsonb(p),
 jsonb_build_object('estado','en_reparto','preparacion',prep,'cantidades',operativo_privado.cantidades_ruta_multi(p.id)),jsonb_build_object('ruta',rid,'estado','en_reparto'));
 end loop;
 if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 update operativo_privado.rutas_multi set estado='en_reparto',salida_en=clock_timestamp() where id=rid;
 elsif accion in ('entregar','fallida') then
 if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
 select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid;
 if not found then raise exception 'NO_AUTORIZADO'; end if;
 perform 1 from public.clientes where id=p.cliente_id for update nowait;
 insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,accion);
 if accion='entregar' then
 select * into hist from operativo_privado.historial_operativo where pedido_id=p.id and clave_idempotencia=clave;
 if found then it:=hist.solicitud->'items';
 else select jsonb_agg(jsonb_build_object('item_pedido_id',i.id,'cantidad_entregada',pi.cantidad_preparada) order by i.id) into it
 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id; end if;
 perform public.confirmar_entrega_todo_correcto(p.id,(s->>'version_pedido')::bigint,clave,it,
 '{"metodo":"por_pagar","efectivo":0,"transferencia":0,"confirmar_por_pagar":true}'::jsonb);
 else perform public.registrar_entrega_fallida(p.id,(s->>'version_pedido')::bigint,clave,s->>'motivo',s->>'observaciones'); end if;
 delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
 elsif accion='cerrar' then
 if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
 if exists(select 1 from operativo_privado.ruta_multi_pedidos m join public.pedidos pe on pe.id=m.pedido_id where m.ruta_id=rid and pe.estado not in ('entregado','entrega_fallida')) then raise exception 'PEDIDOS_PENDIENTES'; end if;
 -- La evidencia de cada fallo/venta fue validada por sus barreras actuales.
 -- Congela sólo los pedidos, cantidades, actores y eventos de ESTA ruta.
 update operativo_privado.rutas_multi set estado='cerrada',cierre=antes||jsonb_build_object('cerrada_en',clock_timestamp(),'cerrada_por',auth.uid()) where id=rid;
 end if;
 update operativo_privado.rutas_multi set version=version+1 where id=rid;
 resultado:=jsonb_build_object('ok',true,'ruta',rid,'version',r.version+1);
 insert into operativo_privado.ruta_multi_eventos(clave,ruta_id,actor,solicitud,anterior,resultado)
 values(clave,rid,auth.uid(),s,antes,resultado||jsonb_build_object('snapshot',operativo_privado.snapshot_ruta_multi(rid)));
 return resultado;
end $$;

create or replace function operativo_privado.permiso_reparto(p_pedido uuid,p_fecha date) returns boolean
language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
 select exists(select 1 from operativo_privado.reparto_capacidad c
 join operativo_privado.repartidores r on r.usuario_id=c.actor and r.activo
 join operativo_privado.reparto_asignaciones a on a.fecha=c.fecha and a.usuario_id=c.actor
 where c.transaccion=txid_current() and c.actor=auth.uid() and (p_pedido is null or c.pedido_id=p_pedido) and (p_fecha is null or c.fecha=p_fecha))
 or (p_pedido is not null and p_fecha is null and exists(
 select 1 from operativo_privado.ruta_multi_capacidad c
 join operativo_privado.ruta_multi_repartidores a on a.ruta_id=c.ruta_id and a.usuario_id=c.actor
 join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo
 join operativo_privado.ruta_multi_pedidos m on m.ruta_id=a.ruta_id and m.pedido_id=c.pedido_id
 join operativo_privado.rutas_multi r on r.id=a.ruta_id and r.estado='en_reparto'
 where c.transaccion=txid_current() and c.actor=auth.uid() and c.pedido_id=p_pedido and c.accion in ('entregar','fallida')));
$$;

create function operativo_privado.exigir_fecha_legacy(p_fecha date) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 lock table public.pedidos in exclusive mode nowait;
 if exists(select 1 from operativo_privado.rutas_multi where fecha=p_fecha) then raise exception 'REQUIERE_RUTA_INDIVIDUAL'; end if;
end $$;
-- Cambios puntuales del cuerpo vigente, conserva OID y contratos históricos.
-- Abortan si no se reconoce la firma/propietario/cuerpo. No copias contables.
do $$ declare r record; d text; cuerpo text; nuevo text; begin
 for r in select * from (values
 ('public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)','p_fecha'),
 ('public.cerrar_ruta(date,bigint,uuid,text)','p_fecha'),
 ('public.revisar_cierre_ruta(date)','p_fecha'),
 ('public.orden_ruta_dia(date,uuid[],bigint)','p_fecha'),
 ('public.obtener_o_crear_ruta_administrativa(date)','p_fecha_operativa'),
 ('public.sincronizar_paradas_ruta_administrativa(uuid)','(select fecha_operativa from public.rutas where id=p_ruta_id)'),
 ('public.guardar_orden_ruta_administrativo(uuid,uuid[],bigint)','(select fecha_operativa from public.rutas where id=p_ruta_id)'),
 ('public.operar_mi_reparto(date,bigint,text,uuid,bigint,uuid,text,text,text)','p_fecha'),
 ('public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text)','p_fecha')
 ) v(firma,fecha) loop
 select prosrc into cuerpo from pg_proc where oid=to_regprocedure(r.firma) and proowner='postgres'::regrole and prolang=(select oid from pg_language where lanname='plpgsql');
 if cuerpo is null or cuerpo !~* '(?m)^[[:space:]]*begin\M' or strpos(cuerpo,'exigir_fecha_legacy')>0 then raise exception 'CUERPO_INCOMPATIBLE: %',r.firma; end if;
 nuevo:=regexp_replace(cuerpo,'(?m)^[[:space:]]*begin\M','begin perform operativo_privado.exigir_fecha_legacy('||r.fecha||');','i');
 d:=pg_get_functiondef(to_regprocedure(r.firma));
 if strpos(d,cuerpo)=0 then raise exception 'DEFINICION_INCOMPATIBLE'; end if;
 execute replace(d,cuerpo,nuevo);
 end loop;
end $$;

create function operativo_privado.proteger_contratos_multi() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
declare j jsonb; viejo jsonb;
begin
 if TG_OP<>'DELETE' then j:=to_jsonb(new); end if;
 if TG_OP<>'INSERT' then viejo:=to_jsonb(old); end if;
 if TG_TABLE_NAME in ('cargas','carga_pedidos') then
 perform operativo_privado.exigir_fecha_legacy((coalesce(j,viejo)->>'fecha')::date);
 if viejo is not null then perform operativo_privado.exigir_fecha_legacy((viejo->>'fecha')::date); end if;
 elsif TG_TABLE_NAME='rutas' then
 if exists(select 1 from operativo_privado.rutas_multi where id in ((j->>'id')::uuid,(viejo->>'id')::uuid)) then raise exception 'REQUIERE_RUTA_INDIVIDUAL'; end if;
 elsif TG_TABLE_NAME='paradas_ruta' then
 if exists(select 1 from operativo_privado.rutas_multi where id in ((j->>'ruta_id')::uuid,(viejo->>'ruta_id')::uuid))
 or exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id in ((j->>'pedido_id')::uuid,(viejo->>'pedido_id')::uuid)) then raise exception 'REQUIERE_RUTA_INDIVIDUAL'; end if;
 elsif TG_TABLE_NAME='reparto_asignaciones' then
 perform operativo_privado.exigir_fecha_legacy((coalesce(j,viejo)->>'fecha')::date);
 end if;
 if TG_OP='DELETE' then return old; else return new; end if;
end $$;
create trigger multi_barrera_cargas before insert or update or delete on operativo_privado.cargas for each row execute function operativo_privado.proteger_contratos_multi();
create trigger multi_barrera_seleccion before insert or update or delete on operativo_privado.carga_pedidos for each row execute function operativo_privado.proteger_contratos_multi();
create trigger multi_barrera_rutas before update or delete on public.rutas for each row execute function operativo_privado.proteger_contratos_multi();
create trigger multi_barrera_paradas before insert or update or delete on public.paradas_ruta for each row execute function operativo_privado.proteger_contratos_multi();
create trigger multi_barrera_asignaciones before insert or update or delete on operativo_privado.reparto_asignaciones for each row execute function operativo_privado.proteger_contratos_multi();


-- Revocar y rehabilitar no revive comandos capturados antes del cambio.
create function operativo_privado.invalidar_asignaciones_multi() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 update operativo_privado.rutas_multi r set version=version+1
 where r.estado<>'cerrada' and exists(select 1 from operativo_privado.ruta_multi_repartidores a where a.ruta_id=r.id and a.usuario_id=new.usuario_id);
 return new;
end $$;
create trigger multi_invalidar_permiso after update of activo on operativo_privado.repartidores for each row execute function operativo_privado.invalidar_asignaciones_multi();

-- Conserva lectura de jornadas anteriores y añade rutas nuevas acotadas por
-- usuario habilitado, con nombre, identificador y versión independientes.
alter function public.leer_mi_reparto() set schema operativo_privado;
revoke all on function operativo_privado.leer_mi_reparto() from public,anon,authenticated,service_role;
create function public.leer_mi_reparto() returns jsonb
language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
 select case when public.acceso_repartidor() then operativo_privado.leer_mi_reparto() || coalesce((
 select jsonb_agg(jsonb_build_object('ruta',r.id,'nombre',r.nombre,'fecha',r.fecha,'asignacion',r.version,'estado','en_ruta',
 'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
 'direccion',concat_ws(', ',p.direccion_snapshot,p.comuna_snapshot,p.region_snapshot),'telefono',p.telefono_cliente_snapshot,'referencia',p.referencia_direccion_snapshot,
 'estado',p.estado,'version',coalesce(v.version,0),'posicion',m.posicion,
 'productos',coalesce((select jsonb_agg(jsonb_build_object('nombre',i.nombre_producto_snapshot,'cantidad',pi.cantidad_preparada,'unidad',i.unidad_snapshot) order by i.id)
 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb)) order by m.posicion,p.id)
 from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id left join operativo_privado.versiones_pedido v on v.pedido_id=p.id where m.ruta_id=r.id),'[]'::jsonb)) order by r.fecha,r.nombre,r.id)
 from operativo_privado.rutas_multi r join operativo_privado.ruta_multi_repartidores a on a.ruta_id=r.id
 join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo
 where a.usuario_id=auth.uid() and r.estado='en_reparto'),'[]'::jsonb) else '[]'::jsonb end;
$$;

do $$ declare r record; begin
 for r in select p.oid::regprocedure firma,n.nspname espacio from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='operativo_privado' and p.proname in ('cantidades_ruta_multi','estado_preparacion_multi','snapshot_ruta_multi','proteger_ruta_multi','exigir_fecha_legacy','proteger_contratos_multi','permiso_reparto','invalidar_asignaciones_multi'))
 or (n.nspname='public' and p.proname in ('leer_rutas_multiples','operar_ruta_multiple','leer_mi_reparto')) loop
 execute format('alter function %s owner to postgres',r.firma);
 execute format('revoke all on function %s from public,anon,authenticated,service_role',r.firma);
 if r.espacio='public' then execute format('grant execute on function %s to authenticated',r.firma); end if;
 end loop;
end $$;
notify pgrst, 'reload schema';
commit;
