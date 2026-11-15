-- Fase 1. SOLO revisión y ejecución manual. No modifica pedidos ni catálogo.
-- Requiere public.es_admin(), pedidos, items_pedido y modo_cantidad_snapshot.
begin;
-- Ejecutar como postgres. La fecha debe usar el contrato date del resumen actual.
do $$
begin
 if current_user <> 'postgres' then raise exception 'INSTALAR_COMO_POSTGRES'; end if;
 if not exists (
  select 1 from pg_catalog.pg_attribute
  where attrelid='public.pedidos'::regclass and attname='fecha_entrega'
   and atttypid='date'::regtype and not attisdropped
 ) then raise exception 'FECHA_ENTREGA_DEBE_SER_DATE'; end if;
 if to_regprocedure('public.es_admin()') is null then raise exception 'FALTA_ES_ADMIN'; end if;
end $$;
-- Instalación única: fallar si ya existe, sin reutilizar objetos de otro propietario.
create schema compras_dia_privado authorization postgres;
revoke all on schema compras_dia_privado from public, anon, authenticated;

create table compras_dia_privado.costos (
 fecha date not null check (isfinite(fecha)),
 clave text not null check (clave ~ '^[a-f0-9]{32}$'),
 cantidad_asignada numeric(12,3) not null check (cantidad_asignada >= 0 and cantidad_asignada < 1000000000),
 precio_compra numeric(12,3) not null check (precio_compra >= 0 and precio_compra < 1000000000),
 requerida_al_guardar numeric not null check (requerida_al_guardar >= cantidad_asignada and requerida_al_guardar::text not in ('NaN','Infinity','-Infinity')),
 identidad jsonb not null,
 revision_demanda text not null check (revision_demanda ~ '^[a-f0-9]{32}$'),
 version integer not null check (version > 0),
 actor uuid not null,
 actualizado_en timestamptz not null default clock_timestamp(),
 primary key (fecha, clave)
);
create table compras_dia_privado.auditoria (
 id bigint generated always as identity primary key,
 fecha date not null, clave text not null, actor uuid not null,
 modificado_en timestamptz not null default clock_timestamp(),
 anterior jsonb, nuevo jsonb not null
);
alter table compras_dia_privado.costos enable row level security;
alter table compras_dia_privado.auditoria enable row level security;
revoke all on all tables in schema compras_dia_privado from public, anon, authenticated;
revoke all on all sequences in schema compras_dia_privado from public, anon, authenticated;

-- Misma agrupación que consolidarItemsEntrega: referencia o fallback histórico,
-- presentación o fallback histórico y unidad exacta. JSON evita delimitadores ambiguos.
create view compras_dia_privado.lineas as
select p.fecha_entrega as fecha, p.id as pedido_id, i.id, i.cantidad, i.fecha_creacion,
 jsonb_build_array(
  coalesce(i.producto_id::text, 'snapshot-producto:' || i.nombre_producto_snapshot),
  coalesce(i.presentacion_producto_id::text, 'snapshot-presentacion:' || coalesce(i.nombre_presentacion_snapshot,'')),
  i.unidad_snapshot) as grupo,
 jsonb_build_array(i.nombre_producto_snapshot, i.nombre_presentacion_snapshot,
  i.unidad_snapshot, i.modo_cantidad_snapshot) as snapshot,
 i.nombre_producto_snapshot as producto, i.nombre_presentacion_snapshot as presentacion,
 i.unidad_snapshot as unidad,
 case
  when upper(btrim(i.unidad_snapshot)) not in ('KG','UND') then 'sin_verificar'
  when i.modo_cantidad_snapshot = 'kg_fraccionable' and upper(btrim(i.unidad_snapshot)) = 'KG' then 'kg_fraccionable'
  when i.modo_cantidad_snapshot = 'unidad' and upper(btrim(i.unidad_snapshot)) = 'UND' then 'unidad'
  when i.modo_cantidad_snapshot = 'presentacion_cerrada' and nullif(btrim(i.nombre_presentacion_snapshot),'') is not null then 'presentacion_cerrada'
  when i.modo_cantidad_snapshot is not null then 'sin_verificar'
  when lower(coalesce(i.nombre_presentacion_snapshot,'')) ~ '\m(saco|malla|caja|paquete|docena)\M' then 'presentacion_cerrada'
  when upper(btrim(i.unidad_snapshot)) = 'KG' and lower(btrim(coalesce(i.nombre_presentacion_snapshot,''))) in ('1 kg','kg') then 'kg_fraccionable'
  when upper(btrim(i.unidad_snapshot)) = 'UND' and lower(btrim(coalesce(i.nombre_presentacion_snapshot,''))) in ('1 unidad','unidad') then 'unidad'
  else 'sin_verificar'
 end as modo
from public.pedidos p join public.items_pedido i on i.pedido_id=p.id
where p.estado <> 'cancelado' and p.fecha_entrega is not null;

create view compras_dia_privado.requerimientos as
select fecha, md5(grupo::text) as clave, grupo as identidad,
 (array_agg(producto order by fecha_creacion,id))[1] as producto,
 (array_agg(presentacion order by fecha_creacion,id))[1] as presentacion,
 grupo->>2 as unidad,
 case when count(distinct snapshot)=1 and count(distinct modo)=1
   and bool_and(cantidad > 0 and cantidad::text not in ('NaN','Infinity','-Infinity'))
   and (min(modo)='kg_fraccionable' or bool_and(cantidad=trunc(cantidad)))
  then min(modo) else 'sin_verificar' end as modo,
 sum(cantidad) as requerida,
 md5(string_agg(jsonb_build_array(id,pedido_id,cantidad,snapshot,modo)::text, ',' order by id)) as revision
from compras_dia_privado.lineas group by fecha,grupo;
revoke all on compras_dia_privado.lineas, compras_dia_privado.requerimientos from public, anon, authenticated;

create function public.leer_costos_productos_dia(p_fecha date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_resultado jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_fecha is null or not isfinite(p_fecha) then raise exception 'FECHA_INVALIDA'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'clave',r.clave,'clave_operativa',(r.identidad->>0)||'|'||(r.identidad->>1)||'|'||(r.identidad->>2),'producto',r.producto,'presentacion',r.presentacion,
  'unidad',r.unidad,'modo',r.modo,'requerida',r.requerida,
  'revision',r.revision,'asignada',case when c.version is null then null
   when c.identidad is distinct from jsonb_build_array(r.identidad,r.modo) or r.modo='sin_verificar' then 0
   else least(c.cantidad_asignada,r.requerida) end,
  'precio',case when c.identidad=jsonb_build_array(r.identidad,r.modo) and r.modo<>'sin_verificar' then c.precio_compra else null end,
  'requiere_ajuste',coalesce(c.version is not null and (c.cantidad_asignada>r.requerida or c.revision_demanda<>r.revision or c.identidad is distinct from jsonb_build_array(r.identidad,r.modo)),false),
  'version',coalesce(c.version,0), 'actualizado',c.actualizado_en
 ) order by r.producto,r.presentacion,r.clave),'[]'::jsonb)
 into v_resultado from compras_dia_privado.requerimientos r
 left join compras_dia_privado.costos c on c.fecha=r.fecha and c.clave=r.clave
 where r.fecha=p_fecha;
 return jsonb_build_object('contrato',1,'productos',v_resultado);
end $$;

create function public.guardar_costo_producto_dia(
 p_fecha date, p_clave text, p_revision text, p_version integer,
 p_cantidad numeric, p_precio numeric
) returns void language plpgsql security definer set search_path = '' as $$
declare v_linea record; v_revision_bloqueada text; v_firmas text[] := array[]::text[]; v_r record; v_anterior compras_dia_privado.costos%rowtype; v_nuevo compras_dia_privado.costos%rowtype;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
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
 select * into v_anterior from compras_dia_privado.costos where fecha=p_fecha and clave=p_clave for update;
 -- Reintento idéntico de la última escritura: no incrementa versión ni auditoría.
 if v_anterior.version=p_version+1 and v_anterior.actor=auth.uid()
  and v_anterior.revision_demanda=p_revision
  and v_anterior.cantidad_asignada=least(p_cantidad,v_r.requerida)
  and v_anterior.precio_compra=p_precio then return; end if;
 if coalesce(v_anterior.version,0)<>p_version then raise exception 'VERSION_CONFLICTO'; end if;
 insert into compras_dia_privado.costos as c
 (fecha,clave,cantidad_asignada,precio_compra,requerida_al_guardar,identidad,revision_demanda,version,actor)
 values (p_fecha,p_clave,least(p_cantidad,v_r.requerida),p_precio,v_r.requerida,jsonb_build_array(v_r.identidad,v_r.modo),v_r.revision,1,auth.uid())
 on conflict (fecha,clave) do update set cantidad_asignada=excluded.cantidad_asignada,
 precio_compra=excluded.precio_compra,requerida_al_guardar=excluded.requerida_al_guardar,
 identidad=excluded.identidad,revision_demanda=excluded.revision_demanda,version=c.version+1,actor=auth.uid(),actualizado_en=clock_timestamp()
 returning * into v_nuevo;
 insert into compras_dia_privado.auditoria(fecha,clave,actor,anterior,nuevo)
 values(p_fecha,p_clave,auth.uid(),case when v_anterior.version is null then null else to_jsonb(v_anterior) end,to_jsonb(v_nuevo));
exception when lock_not_available or deadlock_detected then
 raise exception 'DEMANDA_OCUPADA';
end $$;
alter function public.leer_costos_productos_dia(date) owner to postgres;
alter function public.guardar_costo_producto_dia(date,text,text,integer,numeric,numeric) owner to postgres;
revoke all on function public.leer_costos_productos_dia(date) from public, anon, authenticated;
revoke all on function public.guardar_costo_producto_dia(date,text,text,integer,numeric,numeric) from public, anon, authenticated;
grant execute on function public.leer_costos_productos_dia(date) to authenticated;
grant execute on function public.guardar_costo_producto_dia(date,text,text,integer,numeric,numeric) to authenticated;
commit;
