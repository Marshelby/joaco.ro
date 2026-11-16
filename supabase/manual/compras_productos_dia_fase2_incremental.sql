-- INCREMENTAL sobre fase 1 instalada. SOLO revisión y ejecución manual como postgres.
-- No ejecutar fase 1 nuevamente. Instalación única, transaccional; conserva originales y auditoría.
begin;
set transaction isolation level read committed;
set local lock_timeout = '5s';
do $$ begin
 if current_user<>'postgres' then raise exception 'INSTALAR_COMO_POSTGRES'; end if;
 if to_regprocedure('public.leer_costos_productos_dia(date)') is null
 or to_regclass('compras_dia_privado.costos') is null then raise exception 'FALTA_FASE1'; end if;
 if to_regclass('compras_dia_privado.compras') is not null
 or to_regprocedure('public.leer_compras_productos_dia_v2(date)') is not null then
  raise exception 'FASE2_YA_EXISTE_NO_REINSTALAR';
 end if;
 if to_regclass('compras_dia_privado.auditoria') is null
 or to_regclass('compras_dia_privado.requerimientos') is null
 or to_regclass('public.correcciones_venta_entregada') is null
 or to_regprocedure('public.guardar_costo_producto_dia(date,text,text,integer,numeric,numeric)') is null then
  raise exception 'FALTAN_DEPENDENCIAS';
 end if;
end $$;
-- Impide escrituras de clientes antiguos durante la transición.
lock table compras_dia_privado.costos in access exclusive mode;
-- LIKE no copia índices, PK ni referencias: fecha/clave deja de ser única.
-- Las referencias históricas de auditoría siguen resolviéndose contra costos.
create table compras_dia_privado.compras (like compras_dia_privado.costos including defaults including constraints);
alter table compras_dia_privado.compras add column id uuid not null default gen_random_uuid() primary key;
alter table compras_dia_privado.compras add column producto_snapshot text,
 add column presentacion_snapshot text;
create index compras_fecha_clave on compras_dia_privado.compras(fecha,clave);
alter table compras_dia_privado.compras enable row level security;
revoke all on compras_dia_privado.compras from public,anon,authenticated,service_role;
insert into compras_dia_privado.compras
(id,fecha,clave,cantidad_asignada,precio_compra,requerida_al_guardar,identidad,revision_demanda,version,actor,actualizado_en,producto_snapshot,presentacion_snapshot)
-- UUID reproducible para vincular la compra importada al registro/auditoría original.
select md5('fase1:'||(c.fecha-date '2000-01-01')::text||':'||c.clave)::uuid,c.fecha,c.clave,c.cantidad_asignada,c.precio_compra,c.requerida_al_guardar,c.identidad,c.revision_demanda,c.version,c.actor,c.actualizado_en,r.producto,r.presentacion
from compras_dia_privado.costos c left join compras_dia_privado.requerimientos r on r.fecha=c.fecha and r.clave=c.clave;
-- Rechaza también escrituras de llamadas fase 1 que estuvieran en vuelo al instalar.
create function compras_dia_privado.bloquear_escritura_fase1() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'ACTUALIZAR_COMPRAS_V2'; end $$;
revoke all on function compras_dia_privado.bloquear_escritura_fase1() from public,anon,authenticated,service_role;
create trigger archivo_fase1 before insert or update or delete on compras_dia_privado.costos
for each row execute function compras_dia_privado.bloquear_escritura_fase1();
-- Cerrar también grants directos heredados/default del esquema privado.
revoke all on schema compras_dia_privado from public,anon,authenticated,service_role;
revoke all on all tables in schema compras_dia_privado from public,anon,authenticated,service_role;
revoke all on all sequences in schema compras_dia_privado from public,anon,authenticated,service_role;
-- El archivo original permanece intacto. Ningún cliente puede seguir sobrescribiéndolo.
create or replace function public.guardar_costo_producto_dia(
 p_fecha date,p_clave text,p_revision text,p_version integer,p_cantidad numeric,p_precio numeric)
returns void language plpgsql security definer set search_path='' as $$
begin raise exception 'ACTUALIZAR_COMPRAS_V2'; end $$;
create function public.guardar_compra_producto_dia_v2(
 p_fecha date, p_clave text, p_revision text, p_version integer,
 p_cantidad numeric, p_precio numeric, p_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_linea record; v_revision_bloqueada text; v_firmas text[] := array[]::text[]; v_r record; v_anterior compras_dia_privado.compras%rowtype; v_nuevo compras_dia_privado.compras%rowtype; v_total numeric;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_id is null then raise exception 'DATOS_INVALIDOS'; end if;
 if p_fecha is null or not isfinite(p_fecha) or p_clave is null or p_clave !~ '^[a-f0-9]{32}$' or p_revision is null or p_revision !~ '^[a-f0-9]{32}$' or p_version is null or p_version<0 or p_version>=2147483647 then raise exception 'DATOS_INVALIDOS'; end if;
 if p_cantidad is null or p_precio is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_precio::text in ('NaN','Infinity','-Infinity')
 or p_cantidad<0 or p_cantidad>=1000000000 or p_precio<0 or p_precio>=1000000000
 or p_cantidad<>round(p_cantidad,3) or p_precio<>round(p_precio,3) then raise exception 'DATOS_INVALIDOS'; end if;
 -- Las lecturas sucesivas requieren snapshots nuevos después de adquirir locks.
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 -- No esperar por otras compras ni por operaciones de pedidos.
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_fecha::text || ':' || p_clave,0)) then
  raise exception 'COMPRA_OCUPADA';
 end if;
 -- Bloquear únicamente contribuyentes de esta identidad, padres e ítems juntos.
 -- NOWAIT evita ciclos con funciones existentes que adquieren locks en otro orden.
 for v_linea in
  select l.* from compras_dia_privado.lineas l
  join public.pedidos p on p.id=l.pedido_id
  join public.items_pedido i on i.id=l.id
  where l.fecha=p_fecha and md5(l.grupo::text)=p_clave
  order by l.id for share of p,i nowait
 loop
  v_firmas := array_append(v_firmas,jsonb_build_array(v_linea.id,v_linea.pedido_id,v_linea.cantidad,v_linea.snapshot,v_linea.modo)::text);
 end loop;
 v_revision_bloqueada := md5(array_to_string(v_firmas,','));
 select * into v_r from compras_dia_privado.requerimientos where fecha=p_fecha and clave=p_clave;
 if not found or v_r.revision is distinct from p_revision
  or v_r.revision is distinct from v_revision_bloqueada then raise exception 'DEMANDA_CAMBIO'; end if;
 -- Toda contribución de este snapshot está bloqueada. Una entrada posterior sólo
 -- aumenta demanda: nunca reduce la base validada ni invalida cantidad <= requerida.
 if v_r.requerida::text in ('NaN','Infinity','-Infinity') or v_r.requerida<=0 then raise exception 'DATOS_INVALIDOS'; end if;
 if v_r.modo not in ('kg_fraccionable','unidad','presentacion_cerrada') then raise exception 'UNIDAD_NO_VERIFICADA'; end if;
 if v_r.modo <> 'kg_fraccionable' and p_cantidad<>trunc(p_cantidad) then raise exception 'CANTIDAD_ENTERA_REQUERIDA'; end if;
 -- Un UUID no puede reutilizarse concurrentemente en otra fecha/producto.
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('compra-id:'||p_id::text,0)) then
 raise exception 'COMPRA_OCUPADA'; end if;
 select * into v_anterior from compras_dia_privado.compras where id=p_id for update;
 if found and (v_anterior.fecha<>p_fecha or v_anterior.clave<>p_clave) then raise exception 'DATOS_INVALIDOS'; end if;
 if v_anterior.version=p_version+1 and v_anterior.actor=auth.uid()
 and v_anterior.revision_demanda=p_revision and v_anterior.cantidad_asignada=p_cantidad
 and v_anterior.precio_compra=p_precio then return; end if;
 if coalesce(v_anterior.version,0)<>p_version then raise exception 'VERSION_CONFLICTO'; end if;
 -- Neutralizar conserva la identidad histórica; una fila en cero no aporta costo.
 if p_cantidad<>0 and v_anterior.version is not null and v_anterior.identidad is distinct from jsonb_build_array(v_r.identidad,v_r.modo)
 then raise exception 'UNIDAD_NO_VERIFICADA'; end if;
 select coalesce(sum(cantidad_asignada),0) into v_total from compras_dia_privado.compras
 where fecha=p_fecha and clave=p_clave and id<>p_id;
 if v_total+p_cantidad>v_r.requerida and not (v_anterior.version is not null and p_cantidad=0) then raise exception 'CANTIDAD_EXCEDE_DEMANDA'; end if;
 if p_version=0 and p_cantidad=0 then raise exception 'DATOS_INVALIDOS'; end if;
 insert into compras_dia_privado.compras as c
 (id,fecha,clave,cantidad_asignada,precio_compra,requerida_al_guardar,identidad,revision_demanda,version,actor,producto_snapshot,presentacion_snapshot)
 values(p_id,p_fecha,p_clave,p_cantidad,p_precio,v_r.requerida,jsonb_build_array(v_r.identidad,v_r.modo),v_r.revision,1,auth.uid(),v_r.producto,v_r.presentacion)
 on conflict(id) do update set cantidad_asignada=excluded.cantidad_asignada,precio_compra=excluded.precio_compra,
 requerida_al_guardar=excluded.requerida_al_guardar,revision_demanda=excluded.revision_demanda,
 version=c.version+1,actor=auth.uid(),actualizado_en=clock_timestamp()
 returning * into v_nuevo;
 insert into compras_dia_privado.auditoria(fecha,clave,actor,anterior,nuevo)
 values(p_fecha,p_clave,auth.uid(),case when v_anterior.version is null then null else to_jsonb(v_anterior) end,to_jsonb(v_nuevo));

exception when lock_not_available or deadlock_detected then
 raise exception 'DEMANDA_OCUPADA';
end $$;

create function public.leer_compras_productos_dia_v2(p_fecha date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare resultado jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_fecha is null or not isfinite(p_fecha) then raise exception 'FECHA_INVALIDA'; end if;
 -- Una sentencia: demanda, compras, ventas y correcciones comparten snapshot.
 with demanda as (
 select r.*, jsonb_build_array(r.identidad,r.modo) as firma
 from compras_dia_privado.requerimientos r where fecha=p_fecha
 ), claves as (
 select clave from demanda union select clave from compras_dia_privado.compras where fecha=p_fecha
 ), ventas as (
 select md5(l.grupo::text) as clave,sum(i.total_linea) as proyectada,
 sum(case when p.venta_reconocida_en is not null then (x.linea->>'importe_definitivo')::numeric end) as reconocida,
 count(*) filter(where p.venta_reconocida_en is not null and x.linea is null) as sin_desglose
 from compras_dia_privado.lineas l join public.items_pedido i on i.id=l.id
 join public.pedidos p on p.id=l.pedido_id
 left join lateral (
 select z as linea from jsonb_array_elements(coalesce(
 (select c.nuevos from public.correcciones_venta_entregada c where c.pedido_id=p.id order by c.version desc limit 1),
 p.venta_definitiva_snapshot)->'productos') z where z->>'item_pedido_id'=i.id::text
 ) x on true where l.fecha=p_fecha group by md5(l.grupo::text)
 ), filas as (
 select k.clave,r.identidad,r.producto,r.presentacion,r.unidad,coalesce(r.modo,'sin_verificar') as modo,
 coalesce(r.requerida,0) as requerida,r.revision,
 coalesce(c.compras,'[]'::jsonb) as compras,coalesce(c.total,0) as comprada,
 coalesce(c.valida,0) as valida,c.costo,c.promedio,
 coalesce(c.ajuste,false) or r.clave is null or coalesce(c.total,0)>coalesce(r.requerida,0) as requiere_ajuste,
 coalesce(v.proyectada,0) as venta, v.reconocida,coalesce(v.sin_desglose,0) as sin_desglose
 from claves k left join demanda r using(clave) left join ventas v using(clave)
 left join lateral (
 select jsonb_agg(to_jsonb(c) order by c.actualizado_en,c.id) as compras,
 sum(c.cantidad_asignada) as total,
 sum(case when c.identidad=r.firma and r.modo<>'sin_verificar' then c.cantidad_asignada else 0 end) as valida,
 sum(c.cantidad_asignada*c.precio_compra) as costo,
 sum(c.cantidad_asignada*c.precio_compra)/nullif(sum(c.cantidad_asignada),0) as promedio,
 bool_or(c.cantidad_asignada>0 and (c.revision_demanda is distinct from r.revision or c.identidad is distinct from r.firma)) as ajuste
 from compras_dia_privado.compras c where c.fecha=p_fecha and c.clave=k.clave
 ) c on true
 ) select coalesce(jsonb_agg(jsonb_build_object(
 'clave',clave,'clave_operativa',(identidad->>0)||'|'||(identidad->>1)||'|'||(identidad->>2),
 'producto',coalesce(producto,compras->0->>'producto_snapshot','Compra histórica sin demanda actual'),
 'presentacion',coalesce(presentacion,compras->0->>'presentacion_snapshot'),'unidad',coalesce(unidad,compras->0->'identidad'->0->>2,''),'modo',modo,'requerida',requerida,
 'revision',coalesce(revision,md5('sin demanda')),'asignada',case when valida=comprada then least(valida,requerida) else 0 end,
 'precio',case when valida=comprada then promedio end,'version',1,'actualizado',null,
 'requiere_ajuste',requiere_ajuste,'compras',compras,'comprada',comprada,'costo_total',costo,
 'venta',venta,'venta_reconocida',reconocida,'sin_desglose',sin_desglose
 ) order by producto,presentacion,clave),'[]'::jsonb) into resultado from filas;
 return jsonb_build_object('contrato',2,'productos',resultado);
end $$;
-- Clientes que aún lean el nombre anterior reciben datos actuales y contrato 2,
-- nunca el archivo congelado. Antes de instalar, fase 1 sigue intacta.
create or replace function public.leer_costos_productos_dia(p_fecha date) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 return public.leer_compras_productos_dia_v2(p_fecha);
end $$;
alter function public.leer_costos_productos_dia(date) owner to postgres;
alter function public.guardar_costo_producto_dia(date,text,text,integer,numeric,numeric) owner to postgres;
revoke all on function public.leer_costos_productos_dia(date),
 public.guardar_costo_producto_dia(date,text,text,integer,numeric,numeric)
 from public,anon,authenticated,service_role;
grant execute on function public.leer_costos_productos_dia(date),
 public.guardar_costo_producto_dia(date,text,text,integer,numeric,numeric) to authenticated;
alter function public.guardar_compra_producto_dia_v2(date,text,text,integer,numeric,numeric,uuid) owner to postgres;
revoke all on function public.guardar_compra_producto_dia_v2(date,text,text,integer,numeric,numeric,uuid) from public,anon,authenticated,service_role;
grant execute on function public.guardar_compra_producto_dia_v2(date,text,text,integer,numeric,numeric,uuid) to authenticated;
alter function public.leer_compras_productos_dia_v2(date) owner to postgres;
revoke all on function public.leer_compras_productos_dia_v2(date) from public,anon,authenticated,service_role;
grant execute on function public.leer_compras_productos_dia_v2(date) to authenticated;
commit;
