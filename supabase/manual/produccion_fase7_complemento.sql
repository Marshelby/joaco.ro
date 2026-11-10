-- LOCAL PENDIENTE: no ejecutado. Aplicar después de la base y complementos Fases 3 y 5.
-- No actualiza originales: NULL histórico en mesones significa lechuga.
-- La configuración determina el cultivo en la fecha operativa de nuevos registros.
-- Correcciones/anulaciones conservan el cultivo histórico, aunque cambie la fecha.
-- Extensión: incorporar el nuevo código en este catálogo y en src/lib/produccion/cultivos.ts.
begin;
create table public.produccion_cultivos (
 codigo text primary key check(codigo ~ '^[a-z][a-z0-9_]*$'),
 nombre text not null,
 unidad_medida text not null check(unidad_medida in ('unidad','kg')),
 entero boolean not null,
 check(unidad_medida <> 'unidad' or entero)
);
insert into public.produccion_cultivos values ('lechuga','Lechuga','unidad',true),('berro','Berro','kg',false);
alter table public.produccion_cultivos owner to postgres;
alter table public.produccion_cultivos enable row level security;
alter table public.produccion_cultivos force row level security;
revoke all on public.produccion_cultivos from public,anon,authenticated,service_role;
grant select on public.produccion_cultivos to authenticated;
create policy produccion_lectura_administrador on public.produccion_cultivos for select to authenticated
 using ((select auth.uid()) is not null and (select public.es_admin()));
create trigger produccion_catalogo_inmutable before update or delete on public.produccion_cultivos
 for each row execute function produccion_privado.impedir_mutacion();
create trigger produccion_catalogo_no_truncable before truncate on public.produccion_cultivos
 for each statement execute function produccion_privado.impedir_mutacion();
alter table public.produccion_unidades add column cultivo text references public.produccion_cultivos(codigo),
 add check(tipo='meson' or cultivo is null);
alter table public.produccion_configuraciones_unidad add column cultivo text references public.produccion_cultivos(codigo),
 add column capacidad numeric;
alter table public.produccion_actividad_versiones add column cultivo text references public.produccion_cultivos(codigo),
 add check(tipo_unidad='meson' or cultivo is null);
-- Localizar únicamente los CHECK que codificaban capacidad de lechugas y
-- cantidades enteras para TODOS los mesones; conservar los demás controles.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.produccion_configuraciones_unidad'::regclass
 and contype='c' and pg_get_constraintdef(oid) like '%capacidad_lechugas IS NOT NULL%' loop
 execute format('alter table public.produccion_configuraciones_unidad drop constraint %I',c.conname);
 end loop;
 for c in select conname from pg_constraint where conrelid='public.produccion_actividad_versiones'::regclass
 and contype='c' and pg_get_constraintdef(oid) like '%trunc(cantidad)%' loop
 execute format('alter table public.produccion_actividad_versiones drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.produccion_configuraciones_unidad add constraint produccion_capacidad_cultivo check (
 (tipo_unidad='meson' and cantidad_gallinas is null and
   ((cultivo is null and capacidad is null and capacidad_lechugas is not null and capacidad_lechugas>0)
    or (cultivo is not null and capacidad is not null and capacidad>0 and capacidad<=2147483647 and capacidad_lechugas is null)))
 or (tipo_unidad='avicola' and cultivo is null and capacidad is null and capacidad_lechugas is null and cantidad_gallinas is not null and cantidad_gallinas>=0));
alter table public.produccion_actividad_versiones add constraint produccion_medidas_actividad check (case
 when tipo_actividad='colecta_huevos'
 then cantidad is not null and unidad_medida='unidad' and cantidad=trunc(cantidad)
 when tipo_actividad in ('alimentacion','compra_alimento') then cantidad is not null and unidad_medida in ('kg','g')
 when tipo_unidad='flores' and tipo_actividad='cosecha' then cantidad is not null and unidad_medida in ('unidad','ramo') and cantidad=trunc(cantidad)
 when tipo_actividad='libre' then observaciones is not null and length(btrim(observaciones))>0
 else true end);
create function produccion_privado.validar_cultivo() returns trigger
language plpgsql set search_path=pg_catalog as $$
declare c public.produccion_cultivos%rowtype; anterior public.produccion_actividad_versiones%rowtype;
begin
 if new.tipo_unidad <> 'meson' then return new; end if;
 select * into c from public.produccion_cultivos where codigo=coalesce(new.cultivo,'lechuga');
 if not found then raise exception 'CULTIVO_INVALIDO' using errcode='23514'; end if;
 if tg_table_name='produccion_configuraciones_unidad' then
  if c.entero and coalesce(new.capacidad,new.capacidad_lechugas)<>trunc(coalesce(new.capacidad,new.capacidad_lechugas)) then
   raise exception 'CAPACIDAD_CULTIVO_ENTERA' using errcode='23514'; end if;
 else
  if new.numero_version>1 then
   select * into anterior from public.produccion_actividad_versiones where actividad_id=new.actividad_id order by numero_version desc limit 1;
   if coalesce(new.cultivo,'lechuga') is distinct from coalesce(anterior.cultivo,'lechuga') then
    raise exception 'CULTIVO_HISTORICO_INMUTABLE' using errcode='23514'; end if;
  end if;
  if new.tipo_actividad in ('plantacion','cosecha','perdidas') and
   (new.cantidad is null or new.unidad_medida is distinct from c.unidad_medida or (c.entero and new.cantidad<>trunc(new.cantidad))) then
   raise exception 'CANTIDAD_CULTIVO_INVALIDA' using errcode='23514'; end if;
 end if;
 return new;
end; $$;
alter function produccion_privado.validar_cultivo() owner to postgres;
revoke all on function produccion_privado.validar_cultivo() from public,anon,authenticated,service_role;
create trigger produccion_validar_cultivo before insert on public.produccion_configuraciones_unidad
 for each row execute function produccion_privado.validar_cultivo();
create trigger produccion_validar_cultivo before insert on public.produccion_actividad_versiones
 for each row execute function produccion_privado.validar_cultivo();
create or replace view public.produccion_unidades_actuales with (security_invoker=true) as
 select u.id,u.lugar_id,u.tipo,coalesce(r.nombre,u.nombre) nombre,
 case when r.id is null then u.observaciones else r.observaciones end observaciones,
 coalesce(r.activo,true) activo,coalesce(r.version,0) version,u.cultivo
 from public.produccion_unidades u left join lateral
 (select * from public.produccion_entidad_revisiones where unidad_id=u.id order by version desc limit 1) r on true;
create or replace function produccion_privado.escribir(p_clave uuid,p_solicitud jsonb) returns jsonb
language plpgsql set search_path=pg_catalog as $$
declare
 actor uuid := auth.uid(); operacion text := p_solicitud->>'operacion';
 previa produccion_privado.operaciones%rowtype;
 lugar public.produccion_lugares%rowtype;
 unidad public.produccion_unidades%rowtype;
 actividad public.produccion_actividades%rowtype;
 anterior public.produccion_actividad_versiones%rowtype;
 nueva public.produccion_actividad_versiones%rowtype;
 identificador uuid; unidad_nueva uuid; resultado jsonb;
 cultivo text; fecha date; tipo text; cantidad numeric; medida text; observaciones text;
begin
 perform produccion_privado.exigir_administrador();
 if p_clave is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
 perform pg_advisory_xact_lock(hashtextextended('produccion:configuracion',0));
 perform pg_advisory_xact_lock(hashtextextended('produccion:'||p_clave::text,0));
 select * into previa from produccion_privado.operaciones where clave=p_clave;
 if found then
  if previa.actor_id is distinct from actor or previa.solicitud is distinct from p_solicitud then
   raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
  return previa.resultado;
 end if;
 if operacion='crear_lugar' then
  insert into public.produccion_lugares(tipo,nombre,observaciones,creado_por)
  values(p_solicitud->>'tipo',p_solicitud->>'nombre',p_solicitud->>'observaciones',actor) returning * into lugar;
  if lugar.tipo='gallinero' then
   insert into public.produccion_unidades(lugar_id,tipo_lugar,tipo,nombre,creado_por)
   values(lugar.id,'gallinero','avicola',lugar.nombre,actor) returning id into unidad_nueva;
  end if;
  resultado:=jsonb_build_object('lugar_id',lugar.id,'unidad_id',unidad_nueva);
 elsif operacion='crear_unidad' then
  select * into lugar from public.produccion_lugares where id=(p_solicitud->>'lugar_id')::uuid;
  if not found then raise exception 'LUGAR_NO_ENCONTRADO'; end if;
  insert into public.produccion_unidades(lugar_id,tipo_lugar,tipo,nombre,observaciones,creado_por,cultivo)
  values(lugar.id,lugar.tipo,p_solicitud->>'tipo',p_solicitud->>'nombre',p_solicitud->>'observaciones',actor,case when p_solicitud->>'tipo'='meson' then coalesce(p_solicitud->>'cultivo','lechuga') end)
  returning id into identificador;
  resultado:=jsonb_build_object('unidad_id',identificador);
 elsif operacion='configurar_unidad' then
  select * into unidad from public.produccion_unidades where id=(p_solicitud->>'unidad_id')::uuid for update;
  if not found then raise exception 'UNIDAD_NO_ENCONTRADA'; end if;
  insert into public.produccion_configuraciones_unidad(unidad_id,tipo_unidad,vigente_desde,capacidad_lechugas,cantidad_gallinas,observaciones,creado_por,cultivo,capacidad)
  values(unidad.id,unidad.tipo,(p_solicitud->>'vigente_desde')::date,(p_solicitud->>'capacidad_lechugas')::integer,
   (p_solicitud->>'cantidad_gallinas')::integer,p_solicitud->>'observaciones',actor,p_solicitud->>'cultivo',(p_solicitud->>'capacidad')::numeric) returning id into identificador;
  resultado:=jsonb_build_object('configuracion_id',identificador);
 elsif operacion in ('registrar_actividad','corregir_actividad','anular_actividad') then
  if operacion='registrar_actividad' then
   select * into unidad from public.produccion_unidades where id=(p_solicitud->>'unidad_id')::uuid;
   if not found then raise exception 'UNIDAD_NO_ENCONTRADA'; end if;
   insert into public.produccion_actividades(unidad_id,tipo_unidad,creado_por)
   values(unidad.id,unidad.tipo,actor) returning * into actividad;
  else
   select * into actividad from public.produccion_actividades where id=(p_solicitud->>'actividad_id')::uuid for update;
   if not found then raise exception 'ACTIVIDAD_NO_ENCONTRADA'; end if;
   select * into anterior from public.produccion_actividad_versiones where actividad_id=actividad.id order by numero_version desc limit 1;
   if (p_solicitud->>'version_esperada')::bigint is distinct from anterior.numero_version then
    raise exception 'VERSION_PRODUCCION_CONFLICTO'; end if;
   if anterior.evento='anulacion' then raise exception 'ACTIVIDAD_ANULADA'; end if;
  end if;
  if operacion='anular_actividad' then
   fecha:=anterior.fecha_operativa; tipo:=anterior.tipo_actividad; cantidad:=anterior.cantidad;
   medida:=anterior.unidad_medida; observaciones:=anterior.observaciones;
  else
   fecha:=(p_solicitud->>'fecha_operativa')::date; tipo:=p_solicitud->>'tipo_actividad';
   cantidad:=(p_solicitud->>'cantidad')::numeric; medida:=p_solicitud->>'unidad_medida';
   observaciones:=p_solicitud->>'observaciones';
  end if;
  if actividad.tipo_unidad='meson' then
   if operacion='registrar_actividad' then
    select c.cultivo into cultivo from public.produccion_configuraciones_unidad c
     where c.unidad_id=actividad.unidad_id and c.vigente_desde<=fecha order by c.vigente_desde desc limit 1;
    if found then cultivo:=coalesce(cultivo,'lechuga');
    else cultivo:=coalesce(unidad.cultivo,'lechuga'); end if;
   else cultivo:=coalesce(anterior.cultivo,'lechuga'); end if;
  end if;
  if operacion='registrar_actividad' and p_solicitud ? 'cultivo' and
   (actividad.tipo_unidad<>'meson' or p_solicitud->>'cultivo' is distinct from cultivo) then
   raise exception 'CULTIVO_PRODUCCION_CONFLICTO' using errcode='23514'; end if;
  insert into public.produccion_actividad_versiones(actividad_id,tipo_unidad,numero_version,evento,fecha_operativa,
   tipo_actividad,cantidad,unidad_medida,observaciones,motivo,autor_id,clave_idempotencia,cultivo)
  values(actividad.id,actividad.tipo_unidad,coalesce(anterior.numero_version,0)+1,
   case operacion when 'registrar_actividad' then 'registro' when 'corregir_actividad' then 'correccion' else 'anulacion' end,
   fecha,tipo,cantidad,medida,observaciones,p_solicitud->>'motivo',actor,p_clave,cultivo) returning * into nueva;
  resultado:=jsonb_build_object('actividad_id',actividad.id,'version',nueva.numero_version,'version_id',nueva.id,'evento',nueva.evento);
 else raise exception 'OPERACION_PRODUCCION_INVALIDA';
 end if;
 insert into produccion_privado.operaciones(clave,actor_id,solicitud,resultado) values(p_clave,actor,p_solicitud,resultado);
 return resultado;
end; $$;
create function public.crear_unidad_cultivo_produccion(p_clave_idempotencia uuid,p_lugar_id uuid,p_tipo text,p_nombre text,p_observaciones text,p_cultivo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform produccion_privado.exigir_administrador();
 if p_cultivo is null or not exists(select 1 from public.produccion_cultivos where codigo=p_cultivo) then
  raise exception 'CULTIVO_INVALIDO' using errcode='23514'; end if;
 if p_tipo is distinct from 'meson' then raise exception 'TIPO_CULTIVO_INVALIDO' using errcode='23514'; end if;
 return produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object('operacion','crear_unidad','lugar_id',p_lugar_id,'tipo',p_tipo,'nombre',p_nombre,'observaciones',p_observaciones,'cultivo',p_cultivo));
end; $$;
alter function public.crear_unidad_cultivo_produccion(uuid,uuid,text,text,text,text) owner to postgres;
revoke all on function public.crear_unidad_cultivo_produccion(uuid,uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crear_unidad_cultivo_produccion(uuid,uuid,text,text,text,text) to authenticated;
create function public.configurar_cultivo_produccion(p_clave_idempotencia uuid,p_unidad_id uuid,p_vigente_desde date,p_cultivo text,p_capacidad numeric,p_observaciones text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform produccion_privado.exigir_administrador();
 if p_cultivo is null or not exists(select 1 from public.produccion_cultivos where codigo=p_cultivo) then
  raise exception 'CULTIVO_INVALIDO' using errcode='23514'; end if;
 return produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object('operacion','configurar_unidad','unidad_id',p_unidad_id,'vigente_desde',p_vigente_desde,'cultivo',p_cultivo,'capacidad',p_capacidad,'observaciones',p_observaciones));
end; $$;
alter function public.configurar_cultivo_produccion(uuid,uuid,date,text,numeric,text) owner to postgres;
revoke all on function public.configurar_cultivo_produccion(uuid,uuid,date,text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.configurar_cultivo_produccion(uuid,uuid,date,text,numeric,text) to authenticated;
-- La solicitud incluye el cultivo mostrado. El motor valida su vigencia bajo el
-- mismo bloqueo, después de resolver reintentos; cambios concurrentes no alteran
-- la identidad ni impiden recuperar un resultado idempotente ya confirmado.
create function public.registrar_actividad_cultivo_produccion(
 p_clave_idempotencia uuid,p_unidad_id uuid,p_fecha_operativa date,p_tipo_actividad text,
 p_cantidad numeric,p_unidad_medida text,p_observaciones text,p_cultivo text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform produccion_privado.exigir_administrador();
 if p_cultivo is null or not exists(select 1 from public.produccion_cultivos where codigo=p_cultivo) then
  raise exception 'CULTIVO_INVALIDO' using errcode='23514'; end if;
 return produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object(
  'operacion','registrar_actividad','unidad_id',p_unidad_id,'fecha_operativa',p_fecha_operativa,
  'tipo_actividad',p_tipo_actividad,'cantidad',p_cantidad,'unidad_medida',p_unidad_medida,
  'observaciones',p_observaciones,'cultivo',p_cultivo));
end; $$;
alter function public.registrar_actividad_cultivo_produccion(uuid,uuid,date,text,numeric,text,text,text) owner to postgres;
revoke all on function public.registrar_actividad_cultivo_produccion(uuid,uuid,date,text,numeric,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.registrar_actividad_cultivo_produccion(uuid,uuid,date,text,numeric,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
