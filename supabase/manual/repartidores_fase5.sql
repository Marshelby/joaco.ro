-- Instalación manual única como postgres, después de Fases 2, 3 y 4.
-- No ejecutado. No cambia es_admin(), JWT, enum de perfiles ni RLS existente.
begin;
do $$ declare rol text; begin
 if current_user <> 'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
 raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
 if to_regprocedure('public.cerrar_ruta(date,bigint,uuid,text)') is null
 or to_regprocedure('public.revisar_cierre_ruta(date)') is null
 or to_regprocedure('public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)') is null
 or to_regprocedure('public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)') is null
 or to_regprocedure('public.leer_intentos_pedido_admin(uuid)') is null
 or to_regprocedure('public.leer_resolucion_no_entregado_admin(uuid)') is null
 or to_regclass('operativo_privado.permiso_reprogramacion') is null then raise exception 'DEPENDENCIAS_FASE5_INCOMPLETAS'; end if;
 -- No instalar capacidades sobre un esquema escribible o visible por API.
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_schema_privilege(rol,'operativo_privado','USAGE') or has_schema_privilege(rol,'operativo_privado','CREATE')
 or has_schema_privilege(rol,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',rol; end if;
 end loop;
end $$;
lock table public.pedidos,public.rutas,public.paradas_ruta,operativo_privado.cargas,operativo_privado.carga_pedidos in access exclusive mode nowait;
-- Rol operativo adicional: reutiliza auth.users; no convierte clientes en admins.
create table operativo_privado.repartidores (
 usuario_id uuid primary key references auth.users(id) on delete restrict,
 activo boolean not null, modificado_por uuid not null, modificado_en timestamptz not null default now()
);
-- Fase 2 cierra una jornada completa. Una sola asignación por fecha evita cerrar
-- pedidos de otros repartidores. La ruta principal existente identifica la jornada.
create table operativo_privado.reparto_asignaciones (
 fecha date primary key, ruta_id uuid not null unique references public.rutas(id),
 usuario_id uuid not null references operativo_privado.repartidores(usuario_id),
 version bigint not null default 1, modificado_por uuid not null, modificado_en timestamptz not null default now()
);
create table operativo_privado.reparto_auditoria (
 id bigint generated always as identity primary key, actor uuid not null,
 instante timestamptz not null default now(), accion text not null, anterior jsonb, nuevo jsonb
);
create table operativo_privado.reparto_capacidad (
 transaccion bigint primary key, actor uuid not null, pedido_id uuid, fecha date not null
);
do $$ declare t text; begin
 foreach t in array array['repartidores','reparto_asignaciones','reparto_auditoria','reparto_capacidad'] loop
 execute format('alter table operativo_privado.%I owner to postgres',t);
 execute format('alter table operativo_privado.%I enable row level security',t);
 execute format('alter table operativo_privado.%I force row level security',t);
 execute format('revoke all on operativo_privado.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
create trigger reparto_auditoria_inmutable before update or delete on operativo_privado.reparto_auditoria
 for each row execute function operativo_privado.impedir_mutacion_historial();
create trigger reparto_auditoria_no_truncable before truncate on operativo_privado.reparto_auditoria
 for each statement execute function operativo_privado.impedir_mutacion_historial();

create function operativo_privado.permiso_reparto(p_pedido uuid,p_fecha date) returns boolean
language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
 select exists(select 1 from operativo_privado.reparto_capacidad c
 join operativo_privado.repartidores r on r.usuario_id=c.actor and r.activo
 join operativo_privado.reparto_asignaciones a on a.fecha=c.fecha and a.usuario_id=c.actor
 where c.transaccion=txid_current() and c.actor=auth.uid()
 and (p_pedido is null or c.pedido_id=p_pedido)
 and (p_fecha is null or c.fecha=p_fecha));
$$;
-- Modifica sólo el guard de las implementaciones vigentes. Se conserva TODO el
-- cuerpo contable/de cierre y su OID. Sin copias ni suplantación de auth.uid().
-- Una capacidad privada existe sólo durante la llamada sincrónica del wrapper.
do $$ declare r record; d text; guard text; begin
 for r in select * from (values
 ('public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)','operativo_privado.permiso_reparto(p_pedido_id,null)'),
 ('public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)','operativo_privado.permiso_reparto(p_pedido_id,null)'),
 ('operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)','operativo_privado.permiso_reparto(p_pedido_id,null)'),
 ('public.revisar_cierre_ruta(date)','operativo_privado.permiso_reparto(null,p_fecha)'),
 ('public.cerrar_ruta(date,bigint,uuid,text)','operativo_privado.permiso_reparto(null,p_fecha)'),
 ('public.leer_carga_jornada(date)','operativo_privado.permiso_reparto(null,p_fecha)')
 ) v(firma,permiso) loop
 if not exists(select 1 from pg_proc where oid=to_regprocedure(r.firma) and proowner='postgres'::regrole) then raise exception 'PROPIETARIO_INVALIDO: %',r.firma; end if;
 d:=pg_get_functiondef(to_regprocedure(r.firma)); guard:='public.es_admin()';
 if (length(d)-length(replace(d,guard,'')))/length(guard)<>1 then raise exception 'GUARD_INESPERADO: %',r.firma; end if;
 execute replace(d,guard,'(public.es_admin() or '||r.permiso||')');
 end loop;
end $$;

create function public.acceso_repartidor() returns boolean language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
 select auth.uid() is not null and exists(select 1 from operativo_privado.repartidores where usuario_id=auth.uid() and activo)
 and not coalesce(public.es_admin(),false);
$$;

create function public.administrar_reparto(p_accion text default 'listar',p_usuario uuid default null,p_activo boolean default null,p_ruta uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare antes jsonb; despues jsonb; f date;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 perform pg_advisory_xact_lock(582051005);
 if p_accion='rol' then
 if p_usuario is null or p_activo is null or not exists(select 1 from public.perfiles where usuario_id=p_usuario and rol<>'admin') then raise exception 'USUARIO_INVALIDO'; end if;
 select to_jsonb(r) into antes from operativo_privado.repartidores r where usuario_id=p_usuario;
 insert into operativo_privado.repartidores(usuario_id,activo,modificado_por) values(p_usuario,p_activo,auth.uid())
 on conflict(usuario_id) do update set activo=excluded.activo,modificado_por=excluded.modificado_por,modificado_en=now();
 -- Revocar y volver a habilitar tampoco revive solicitudes de una sesión vieja.
 update operativo_privado.reparto_asignaciones set version=version+1 where usuario_id=p_usuario;
 select to_jsonb(r) into despues from operativo_privado.repartidores r where usuario_id=p_usuario;
 elsif p_accion='asignar' then
 -- Mismo orden global de locks que el wrapper; NOWAIT evita competir con planificación.
 lock table public.pedidos in exclusive mode nowait;
 select fecha_operativa into f from public.rutas where id=p_ruta and es_principal;
 if f is null or not exists(select 1 from operativo_privado.repartidores where usuario_id=p_usuario and activo)
 or exists(select 1 from public.perfiles where usuario_id=p_usuario and rol='admin')
 or exists(select 1 from operativo_privado.cargas where fecha=f and estado='cerrada') then raise exception 'ASIGNACION_INVALIDA'; end if;
 select to_jsonb(a) into antes from operativo_privado.reparto_asignaciones a where fecha=f;
 insert into operativo_privado.reparto_asignaciones(fecha,ruta_id,usuario_id,modificado_por) values(f,p_ruta,p_usuario,auth.uid())
 on conflict(fecha) do update set ruta_id=excluded.ruta_id,usuario_id=excluded.usuario_id,version=reparto_asignaciones.version+1,modificado_por=excluded.modificado_por,modificado_en=now();
 select to_jsonb(a) into despues from operativo_privado.reparto_asignaciones a where fecha=f;
 elsif p_accion<>'listar' then raise exception 'OPERACION_INVALIDA'; end if;
 if p_accion<>'listar' then insert into operativo_privado.reparto_auditoria(actor,accion,anterior,nuevo) values(auth.uid(),p_accion,antes,despues); end if;
 return jsonb_build_object('repartidores',coalesce((select jsonb_agg(to_jsonb(r)) from operativo_privado.repartidores r),'[]'::jsonb),
 'asignaciones',coalesce((select jsonb_agg(to_jsonb(a) order by fecha desc) from operativo_privado.reparto_asignaciones a),'[]'::jsonb),
 'rutas',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'fecha',r.fecha_operativa) order by r.fecha_operativa desc) from public.rutas r
 where r.es_principal and not exists(select 1 from operativo_privado.cargas c where c.fecha=r.fecha_operativa and c.estado='cerrada')),'[]'::jsonb));
end $$;

create function public.leer_mi_reparto() returns jsonb language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
 select coalesce(jsonb_agg(jsonb_build_object('fecha',a.fecha,'asignacion',a.version,'estado',c.estado,
 'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
 'direccion',concat_ws(', ',p.direccion_snapshot,p.comuna_snapshot,p.region_snapshot),'telefono',p.telefono_cliente_snapshot,'referencia',p.referencia_direccion_snapshot,
 'estado',p.estado,'version',coalesce(v.version,0),'posicion',pr.posicion,
 'productos',coalesce((select jsonb_agg(jsonb_build_object('nombre',i.nombre_producto_snapshot,'cantidad',pi.cantidad_preparada,'unidad',i.unidad_snapshot) order by i.id)
 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb)) order by pr.posicion nulls last,p.numero_pedido)
 from operativo_privado.carga_pedidos cp join public.pedidos p on p.id=cp.pedido_id and p.fecha_entrega=a.fecha
 left join operativo_privado.versiones_pedido v on v.pedido_id=p.id
 left join public.paradas_ruta pr on pr.ruta_id=a.ruta_id and pr.pedido_id=p.id
 where cp.fecha=a.fecha and cp.incluido),'[]'::jsonb)) order by a.fecha),'[]'::jsonb)
 from operativo_privado.reparto_asignaciones a join operativo_privado.cargas c on c.fecha=a.fecha
 where public.acceso_repartidor() and a.usuario_id=auth.uid() and c.estado='en_ruta'
 and exists(select 1 from public.rutas r where r.id=a.ruta_id and r.es_principal and r.fecha_operativa=a.fecha);
$$;

-- Interfaz cerrada: no recibe items, precios, cobros, pagos ni patches de pedidos.
create function public.operar_mi_reparto(p_fecha date,p_asignacion bigint,p_accion text,p_pedido uuid default null,
 p_version bigint default null,p_clave uuid default null,p_motivo text default null,p_observaciones text default null,p_huella text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
declare a operativo_privado.reparto_asignaciones%rowtype; items jsonb; resultado jsonb; h operativo_privado.historial_operativo%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 perform pg_advisory_xact_lock(582051005);
 if not public.acceso_repartidor() then raise exception 'NO_AUTORIZADO'; end if;
 -- Antes de leer asignación, selección, preparación o historial: serializa con
 -- salidas/reprogramaciones/cierres/entregas administrativos existentes.
 lock table public.pedidos in exclusive mode;
 select * into a from operativo_privado.reparto_asignaciones where fecha=p_fecha;
 if not found or a.usuario_id<>auth.uid() or a.version is distinct from p_asignacion
 or not exists(select 1 from public.rutas r where r.id=a.ruta_id and r.es_principal and r.fecha_operativa=a.fecha) then raise exception 'ASIGNACION_CAMBIO'; end if;
 if p_accion not in ('entregar','fallida','revisar_cierre','cerrar') or p_accion is null then raise exception 'OPERACION_INVALIDA'; end if;
 if p_accion in ('entregar','fallida') then
 if p_pedido is null or not exists(select 1 from operativo_privado.carga_pedidos cp join public.pedidos p on p.id=cp.pedido_id
 where cp.fecha=p_fecha and cp.incluido and cp.pedido_id=p_pedido and p.fecha_entrega=p_fecha) then raise exception 'NO_AUTORIZADO'; end if;
  -- La entrega vigente bloquea cliente antes de pedido. Si un administrador
 -- retuvo cliente antes de esperar nuestra barrera, abortar sin ciclo de locks.
 perform 1 from public.clientes c join public.pedidos p on p.cliente_id=c.id
 where p.id=p_pedido for update of c nowait;
 else
 if p_pedido is not null then raise exception 'OPERACION_INVALIDA'; end if;
 end if;
 insert into operativo_privado.reparto_capacidad values(txid_current(),auth.uid(),p_pedido,p_fecha);
 if p_accion='entregar' then
 -- Reintento usa el payload original, no la preparación actual.
 select * into h from operativo_privado.historial_operativo where pedido_id=p_pedido and clave_idempotencia=p_clave;
 if found then
 if h.actor_id<>auth.uid() or h.operacion<>'entrega_todo_correcto' then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
 items:=h.solicitud->'items';
 else
 select jsonb_agg(jsonb_build_object('item_pedido_id',i.id,'cantidad_entregada',pi.cantidad_preparada) order by i.id) into items
 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido;
 end if;
 resultado:=public.confirmar_entrega_todo_correcto(p_pedido,p_version,p_clave,items,
 '{"metodo":"por_pagar","efectivo":0,"transferencia":0,"confirmar_por_pagar":true}'::jsonb);
 elsif p_accion='fallida' then
 resultado:=public.registrar_entrega_fallida(p_pedido,p_version,p_clave,p_motivo,p_observaciones);
 elsif p_accion='revisar_cierre' then
 resultado:=public.revisar_cierre_ruta(p_fecha);
 else
 resultado:=public.cerrar_ruta(p_fecha,p_version,p_clave,p_huella);
 end if;
 delete from operativo_privado.reparto_capacidad where transaccion=txid_current();
 -- Nunca devolver snapshots contables, historial general ni evidencia del cierre.
 if p_accion in ('cerrar','revisar_cierre') then
 return jsonb_build_object('fecha',resultado->'fecha','estado',resultado->'estado','version',resultado->'version','huella',resultado->'huella');
 end if;
 return jsonb_build_object('ok',true);
end $$;

do $$ declare r record; begin
 for r in select p.oid::regprocedure firma,n.nspname espacio from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in ('acceso_repartidor','administrar_reparto','leer_mi_reparto','operar_mi_reparto'))
 or (n.nspname='operativo_privado' and p.proname='permiso_reparto') loop
 execute format('alter function %s owner to postgres',r.firma);
 execute format('revoke all on function %s from public,anon,authenticated,service_role',r.firma);
 if r.espacio='public' then execute format('grant execute on function %s to authenticated',r.firma); end if;
 end loop;
end $$;
commit;
