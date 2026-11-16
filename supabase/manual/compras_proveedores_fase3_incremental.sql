-- PENDIENTE: instalación manual única como postgres. Fases 2 y proveedores instaladas.
-- No ejecutado. CLP contable redondeado al peso; costo operativo conserva decimales.
begin;
set transaction isolation level read committed;
set local lock_timeout = '5s';
do $$ begin
 if current_user <> 'postgres' then raise exception 'INSTALAR_COMO_POSTGRES'; end if;
 if to_regclass('compras_dia_privado.compras') is null
 or to_regclass('public.movimientos_proveedores') is null
 or to_regclass('public.v_saldos_proveedores') is null
 or to_regprocedure('public.guardar_compra_producto_dia_v2(date,text,text,integer,numeric,numeric,uuid)') is null
 or to_regprocedure('public.leer_compras_productos_dia_v2(date)') is null
 or to_regprocedure('public.obtener_proveedor_administrativo(uuid)') is null then raise exception 'FALTAN_DEPENDENCIAS'; end if;
 if to_regclass('compras_dia_privado.finanzas') is not null
 or to_regclass('compras_dia_privado.asientos') is not null
 or to_regprocedure('public.guardar_compra_producto_dia_v3(date,text,text,integer,numeric,numeric,uuid,uuid,text,numeric)') is not null then
  raise exception 'FASE3_YA_EXISTE_NO_REINSTALAR';
 end if;
end; $$;
lock table compras_dia_privado.compras in access exclusive mode;
create table compras_dia_privado.finanzas (
 compra_id uuid primary key references compras_dia_privado.compras(id),
 proveedor_id uuid references public.proveedores(id),
 total numeric not null check(total between 0 and 9007199254740991 and total=trunc(total)),
 pagado numeric not null check(pagado>=0 and pagado<=total and pagado=trunc(pagado)),
 estado text not null check(estado in ('por_pagar','pagado','parcial')),
 check(proveedor_id is not null or (estado='por_pagar' and pagado=0)),
 check((estado='por_pagar' and pagado=0) or (estado='pagado' and pagado=total)
       or (estado='parcial' and pagado>0 and pagado<total))
);
create table compras_dia_privado.asientos (
 id uuid primary key default gen_random_uuid(), compra_id uuid not null references compras_dia_privado.compras(id),
 proveedor_id uuid not null references public.proveedores(id), version integer not null check(version>0),
 concepto text not null check(concepto in ('obligacion','pago')), importe numeric not null
 check(importe between -9007199254740991 and 9007199254740991 and importe<>0 and importe=trunc(importe)),
 check(concepto<>'pago' or importe<0),
 actor uuid not null, fecha timestamptz not null default clock_timestamp(),
 unique(compra_id,version,proveedor_id,concepto)
);
alter table compras_dia_privado.finanzas enable row level security;
alter table compras_dia_privado.asientos enable row level security;
revoke all on compras_dia_privado.finanzas,compras_dia_privado.asientos from public,anon,authenticated,service_role;
-- Retirar la entrada antigua: ningún cliente puede eludir la integración.
alter function public.guardar_compra_producto_dia_v2(date,text,text,integer,numeric,numeric,uuid) set schema compras_dia_privado;
revoke all on function compras_dia_privado.guardar_compra_producto_dia_v2(date,text,text,integer,numeric,numeric,uuid) from public,anon,authenticated,service_role;
create function public.guardar_compra_producto_dia_v3(
 p_fecha date,p_clave text,p_revision text,p_version integer,p_cantidad numeric,p_precio numeric,p_id uuid,
 p_proveedor uuid,p_estado text,p_abonado numeric
) returns void language plpgsql security definer set search_path='' as $$
declare f compras_dia_privado.finanzas%rowtype; c compras_dia_privado.compras%rowtype;
 t numeric; pag numeric; ver integer; anterior jsonb; obligacion_anterior numeric; pago_anterior numeric;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
 if p_fecha is null or not isfinite(p_fecha) or p_clave is null or p_clave !~ '^[a-f0-9]{32}$'
 or p_revision is null or p_revision !~ '^[a-f0-9]{32}$'
 or p_version is null or p_version<0 or p_version>=2147483647 then raise exception 'DATOS_INVALIDOS'; end if;
 if p_id is null or p_estado is null or p_estado not in ('por_pagar','pagado','parcial')
 or p_abonado is null or p_abonado::text in ('NaN','Infinity','-Infinity') or p_abonado<0 or p_abonado<>trunc(p_abonado) then raise exception 'DATOS_INVALIDOS'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('compra-id:'||p_id::text,0)) then raise exception 'COMPRA_OCUPADA'; end if;
 select * into f from compras_dia_privado.finanzas where compra_id=p_id for update;
 anterior:=case when f.compra_id is null then null else to_jsonb(f) end;
 -- Una compra sin vínculo financiero no aporta obligación ni pagos al proveedor nuevo.
 obligacion_anterior:=case when f.proveedor_id is not distinct from p_proveedor then coalesce(f.total,0) else 0 end;
 pago_anterior:=case when f.proveedor_id is not distinct from p_proveedor then coalesce(f.pagado,0) else 0 end;
 if p_cantidad is null or p_precio is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_precio::text in ('NaN','Infinity','-Infinity')
 or p_cantidad<0 or p_precio<0 or p_cantidad>=1000000000 or p_precio>=1000000000
 or p_cantidad<>round(p_cantidad,3) or p_precio<>round(p_precio,3) then raise exception 'DATOS_INVALIDOS'; end if;
 t:=round(p_cantidad*p_precio,0);
 if t>9007199254740991 then raise exception 'DATOS_INVALIDOS'; end if;
 pag:=case when p_proveedor is null or p_estado='por_pagar' then 0 when p_estado='pagado' then t else p_abonado end;
 if p_proveedor is null and (p_estado<>'por_pagar' or p_abonado<>0) then raise exception 'DATOS_INVALIDOS'; end if;
 if p_estado='parcial' and (p_abonado<=0 or p_abonado>=t) then raise exception 'ABONO_INVALIDO'; end if;
 if p_estado<>'parcial' and p_abonado<>0 then raise exception 'DATOS_INVALIDOS'; end if;
 if f.pagado>0 and (f.proveedor_id is distinct from p_proveedor or pag<f.pagado or t<f.pagado) then raise exception 'COMPRA_CON_PAGOS'; end if;
 -- Mismo lock de proveedor que los movimientos manuales; orden estable en cambios.
 perform 1 from public.proveedores where id in (f.proveedor_id,p_proveedor) order by id for update nowait;
 if p_proveedor is not null and not exists(select 1 from public.proveedores where id=p_proveedor) then raise exception 'PROVEEDOR_NO_ENCONTRADO'; end if;
 select * into c from compras_dia_privado.compras where id=p_id;
 if c.version=p_version+1 and c.actor=auth.uid() and c.fecha=p_fecha and c.clave=p_clave
 and c.revision_demanda=p_revision and c.cantidad_asignada=p_cantidad and c.precio_compra=p_precio
 and f.proveedor_id is not distinct from p_proveedor and f.estado=p_estado and f.pagado=pag then return; end if;
 if coalesce(c.version,0)<>p_version then raise exception 'VERSION_CONFLICTO'; end if;
 perform compras_dia_privado.guardar_compra_producto_dia_v2(p_fecha,p_clave,p_revision,p_version,p_cantidad,p_precio,p_id);
 select version into ver from compras_dia_privado.compras where id=p_id;
 if f.proveedor_id is not null and f.proveedor_id is distinct from p_proveedor and f.total<>0 then
  insert into compras_dia_privado.asientos(compra_id,proveedor_id,version,concepto,importe,actor) values(p_id,f.proveedor_id,ver,'obligacion',-f.total,auth.uid());
 end if;
 if p_proveedor is not null then
  if t-obligacion_anterior <> 0 then
   insert into compras_dia_privado.asientos(compra_id,proveedor_id,version,concepto,importe,actor)
   values(p_id,p_proveedor,ver,'obligacion',t-obligacion_anterior,auth.uid());
  end if;
  if pag-pago_anterior>0 then
   insert into compras_dia_privado.asientos(compra_id,proveedor_id,version,concepto,importe,actor) values(p_id,p_proveedor,ver,'pago',-(pag-pago_anterior),auth.uid());
  end if;
 end if;
 insert into compras_dia_privado.finanzas(compra_id,proveedor_id,total,pagado,estado) values(p_id,p_proveedor,t,pag,p_estado)
 on conflict(compra_id) do update set proveedor_id=excluded.proveedor_id,total=excluded.total,pagado=excluded.pagado,estado=excluded.estado;
 insert into compras_dia_privado.auditoria(fecha,clave,actor,anterior,nuevo)
 values(p_fecha,p_clave,auth.uid(),jsonb_build_object('finanzas',anterior),jsonb_build_object('compra_id',p_id,'finanzas',jsonb_build_object('proveedor_id',p_proveedor,'total',t,'pagado',pag,'estado',p_estado)));
exception when lock_not_available or deadlock_detected then raise exception 'COMPRA_OCUPADA';
end; $$;
-- Formularios abiertos con el contrato anterior deben recargar antes de guardar.
create function public.guardar_compra_producto_dia_v2(p_fecha date,p_clave text,p_revision text,p_version integer,p_cantidad numeric,p_precio numeric,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin raise exception 'ACTUALIZAR_COMPRAS_V3'; end; $$;
revoke all on function public.guardar_compra_producto_dia_v2(date,text,text,integer,numeric,numeric,uuid) from public,anon,authenticated,service_role;
grant execute on function public.guardar_compra_producto_dia_v2(date,text,text,integer,numeric,numeric,uuid) to authenticated;
-- El lector original no escribe: STABLE comparte snapshot con la extensión financiera.
alter function public.leer_compras_productos_dia_v2(date) stable;
create function public.leer_compras_productos_dia_v3(p_fecha date) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 select jsonb_build_object('contrato',3,'proveedores',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre) order by nombre,id),'[]') from public.proveedores),
 'productos',coalesce((select jsonb_agg(p || jsonb_build_object('compras',
 (select coalesce(jsonb_agg(c || jsonb_build_object('proveedor_id',f.proveedor_id,'estado',coalesce(f.estado,'por_pagar'),'pagado',coalesce(f.pagado,0),'total_contable',coalesce(f.total,round((c->>'cantidad_asignada')::numeric*(c->>'precio_compra')::numeric)))),'[]')
 from jsonb_array_elements(p->'compras') c left join compras_dia_privado.finanzas f on f.compra_id=(c->>'id')::uuid)))
 from jsonb_array_elements(public.leer_compras_productos_dia_v2(p_fecha)->'productos') p),'[]')) into r;
 return r;
end; $$;
create function public.saldo_compras_proveedor(p_id uuid) returns numeric
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 return coalesce((select sum(importe) from compras_dia_privado.asientos where proveedor_id=p_id),0);
end; $$;
create or replace view public.v_saldos_proveedores with (security_invoker=true) as
select p.id,p.nombre,p.descripcion,p.telefono,p.direccion,
 coalesce((select sum(case when m.tipo='deuda' then m.monto else -m.monto end) from public.movimientos_proveedores m where m.proveedor_id=p.id),0)
 + public.saldo_compras_proveedor(p.id) as saldo_actual from public.proveedores p;
create or replace function public.obtener_proveedor_administrativo(p_proveedor_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 select to_jsonb(p) || jsonb_build_object('saldo_actual', public.saldo_compras_proveedor(p.id)+
 coalesce((select sum(case when m.tipo='deuda' then m.monto else -m.monto end) from public.movimientos_proveedores m where m.proveedor_id=p.id),0),
 'compras',coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object(
 'producto_snapshot',coalesce(c.producto_snapshot,
   case when c.identidad->0->>0 like 'snapshot-producto:%'
        then substr(c.identidad->0->>0,length('snapshot-producto:')+1) end),
 'presentacion_snapshot',coalesce(c.presentacion_snapshot,
   case when c.identidad->0->>1 like 'snapshot-presentacion:%'
        then substr(c.identidad->0->>1,length('snapshot-presentacion:')+1) end),
 'unidad',c.identidad->0->>2,'total',f.total,'pagado',f.pagado,'saldo',f.total-f.pagado) order by c.fecha,c.id) from compras_dia_privado.compras c join compras_dia_privado.finanzas f on f.compra_id=c.id where f.proveedor_id=p.id),'[]'::jsonb),
 'asientos_compras',coalesce((select jsonb_agg(to_jsonb(a) order by a.fecha,a.id) from compras_dia_privado.asientos a where a.proveedor_id=p.id),'[]'::jsonb),
 'movimientos',coalesce((select jsonb_agg(to_jsonb(m) order by m.fecha,m.id) from public.movimientos_proveedores m where m.proveedor_id=p.id),'[]'::jsonb))
 into v from public.proveedores p where p.id=p_proveedor_id;
 return v;
end; $$;
revoke all on function public.guardar_compra_producto_dia_v3(date,text,text,integer,numeric,numeric,uuid,uuid,text,numeric) from public,anon,authenticated,service_role;
grant execute on function public.guardar_compra_producto_dia_v3(date,text,text,integer,numeric,numeric,uuid,uuid,text,numeric) to authenticated;
revoke all on function public.leer_compras_productos_dia_v3(date) from public,anon,authenticated,service_role;
grant execute on function public.leer_compras_productos_dia_v3(date) to authenticated;
revoke all on function public.saldo_compras_proveedor(uuid) from public,anon,authenticated,service_role;
grant execute on function public.saldo_compras_proveedor(uuid) to authenticated;
commit;
