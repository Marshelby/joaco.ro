-- LOCAL, no ejecutado. Aplicar una vez después de la base de Producción.
-- Compatible con el complemento de precios de Fase 3. No modifica originales.
begin;
create table public.produccion_entidad_revisiones (
 id uuid primary key default gen_random_uuid(),
 lugar_id uuid references public.produccion_lugares(id) on delete restrict,
 unidad_id uuid references public.produccion_unidades(id) on delete restrict,
 version integer not null check(version>0),
 nombre text not null check(length(btrim(nombre)) between 1 and 160),
 observaciones text check(length(observaciones)<=2000),
 activo boolean not null,
 autor_id uuid not null,
 fecha_registro timestamptz not null default clock_timestamp(),
 clave_idempotencia uuid not null unique,
 check(num_nonnulls(lugar_id,unidad_id)=1),
 unique(lugar_id,version), unique(unidad_id,version)
);
alter table public.produccion_entidad_revisiones owner to postgres;
alter table public.produccion_entidad_revisiones enable row level security;
alter table public.produccion_entidad_revisiones force row level security;
revoke all on public.produccion_entidad_revisiones from public,anon,authenticated,service_role;
grant select on public.produccion_entidad_revisiones to authenticated;
create policy produccion_lectura_administrador on public.produccion_entidad_revisiones for select to authenticated
 using ((select auth.uid()) is not null and (select public.es_admin()));
create trigger produccion_revision_inmutable before update or delete on public.produccion_entidad_revisiones
 for each row execute function produccion_privado.impedir_mutacion();
create trigger produccion_revision_no_truncable before truncate on public.produccion_entidad_revisiones
 for each statement execute function produccion_privado.impedir_mutacion();

create view public.produccion_lugares_actuales with (security_invoker=true) as
 select l.id,l.tipo,coalesce(r.nombre,l.nombre) nombre,
 case when r.id is null then l.observaciones else r.observaciones end observaciones,
 coalesce(r.activo,true) activo,coalesce(r.version,0) version
 from public.produccion_lugares l left join lateral
 (select * from public.produccion_entidad_revisiones where lugar_id=l.id order by version desc limit 1) r on true;
create view public.produccion_unidades_actuales with (security_invoker=true) as
 select u.id,u.lugar_id,u.tipo,coalesce(r.nombre,u.nombre) nombre,
 case when r.id is null then u.observaciones else r.observaciones end observaciones,
 coalesce(r.activo,true) activo,coalesce(r.version,0) version
 from public.produccion_unidades u left join lateral
 (select * from public.produccion_entidad_revisiones where unidad_id=u.id order by version desc limit 1) r on true;
revoke all on public.produccion_lugares_actuales,public.produccion_unidades_actuales from public,anon,authenticated,service_role;
grant select on public.produccion_lugares_actuales,public.produccion_unidades_actuales to authenticated;

-- Conserva el motor y sus solicitudes/idempotencia. Orden común con editar y
-- validar_alta_activa: configuración -> clave de idempotencia -> filas/FK.
-- Configuración va primero incluso en reintentos: los bloqueos duran toda la
-- transacción y otra llamada en ella puede necesitar una segunda clave.
-- Tomar esa clave antes de configuración permitiría un ciclo entre sesiones.
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
 fecha date; tipo text; cantidad numeric; medida text; observaciones text;
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
  insert into public.produccion_unidades(lugar_id,tipo_lugar,tipo,nombre,observaciones,creado_por)
  values(lugar.id,lugar.tipo,p_solicitud->>'tipo',p_solicitud->>'nombre',p_solicitud->>'observaciones',actor)
  returning id into identificador;
  resultado:=jsonb_build_object('unidad_id',identificador);
 elsif operacion='configurar_unidad' then
  select * into unidad from public.produccion_unidades where id=(p_solicitud->>'unidad_id')::uuid for update;
  if not found then raise exception 'UNIDAD_NO_ENCONTRADA'; end if;
  insert into public.produccion_configuraciones_unidad(unidad_id,tipo_unidad,vigente_desde,capacidad_lechugas,cantidad_gallinas,observaciones,creado_por)
  values(unidad.id,unidad.tipo,(p_solicitud->>'vigente_desde')::date,(p_solicitud->>'capacidad_lechugas')::integer,
   (p_solicitud->>'cantidad_gallinas')::integer,p_solicitud->>'observaciones',actor) returning id into identificador;
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
  insert into public.produccion_actividad_versiones(actividad_id,tipo_unidad,numero_version,evento,fecha_operativa,
   tipo_actividad,cantidad,unidad_medida,observaciones,motivo,autor_id,clave_idempotencia)
  values(actividad.id,actividad.tipo_unidad,coalesce(anterior.numero_version,0)+1,
   case operacion when 'registrar_actividad' then 'registro' when 'corregir_actividad' then 'correccion' else 'anulacion' end,
   fecha,tipo,cantidad,medida,observaciones,p_solicitud->>'motivo',actor,p_clave) returning * into nueva;
  resultado:=jsonb_build_object('actividad_id',actividad.id,'version',nueva.numero_version,'version_id',nueva.id,'evento',nueva.evento);
 else raise exception 'OPERACION_PRODUCCION_INVALIDA';
 end if;
 insert into produccion_privado.operaciones(clave,actor_id,solicitud,resultado) values(p_clave,actor,p_solicitud,resultado);
 return resultado;
end; $$;


-- Serializa estados, altas y nuevos registros. No toca versiones de actividades:
-- corregir/anular históricos sigue permitido aunque el lugar esté inactivo.
create function produccion_privado.validar_alta_activa() returns trigger
language plpgsql set search_path=pg_catalog as $$
declare padre uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('produccion:configuracion',0));
 if tg_table_name='produccion_lugares' then
  if exists(select 1 from public.produccion_lugares_actuales where lower(btrim(nombre))=lower(btrim(new.nombre))) then
   raise exception 'NOMBRE_PRODUCCION_DUPLICADO' using errcode='23505'; end if;
 elsif tg_table_name='produccion_unidades' then
  if not exists(select 1 from public.produccion_lugares_actuales where id=new.lugar_id and activo) then
   raise exception 'LUGAR_PRODUCCION_INACTIVO'; end if;
  if exists(select 1 from public.produccion_unidades_actuales where lugar_id=new.lugar_id and lower(btrim(nombre))=lower(btrim(new.nombre))) then
   raise exception 'NOMBRE_PRODUCCION_DUPLICADO' using errcode='23505'; end if;
 else
  select lugar_id into padre from public.produccion_unidades_actuales where id=new.unidad_id and activo;
  if padre is null or not exists(select 1 from public.produccion_lugares_actuales where id=padre and activo) then
   raise exception 'UNIDAD_PRODUCCION_INACTIVA'; end if;
 end if;
 return new;
end; $$;
create trigger produccion_alta_activa before insert on public.produccion_lugares for each row execute function produccion_privado.validar_alta_activa();
create trigger produccion_alta_activa before insert on public.produccion_unidades for each row execute function produccion_privado.validar_alta_activa();
create trigger produccion_alta_activa before insert on public.produccion_actividades for each row execute function produccion_privado.validar_alta_activa();
create trigger produccion_alta_activa before insert on public.produccion_configuraciones_unidad for each row execute function produccion_privado.validar_alta_activa();

create function public.editar_entidad_produccion(p_clave_idempotencia uuid,p_entidad text,p_id uuid,p_version_esperada integer,p_nombre text,p_observaciones text,p_activo boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare solicitud jsonb; previa produccion_privado.operaciones%rowtype; actual record; resultado jsonb;
begin
 perform produccion_privado.exigir_administrador();
 if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
 solicitud:=jsonb_build_object('operacion','editar_entidad','entidad',p_entidad,'id',p_id,'version',p_version_esperada,'nombre',p_nombre,'observaciones',p_observaciones,'activo',p_activo);
 -- Mismo orden que escribir, también cuando se devuelve un resultado previo.
 perform pg_advisory_xact_lock(hashtextextended('produccion:configuracion',0));
 perform pg_advisory_xact_lock(hashtextextended('produccion:'||p_clave_idempotencia::text,0));
 select * into previa from produccion_privado.operaciones where clave=p_clave_idempotencia;
 if found then
  if previa.actor_id is distinct from auth.uid() or previa.solicitud is distinct from solicitud then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
  return previa.resultado;
 end if;
 if p_entidad='lugar' then
  select * into actual from public.produccion_lugares_actuales where id=p_id;
 elsif p_entidad='unidad' then
  select * into actual from public.produccion_unidades_actuales where id=p_id;
 else raise exception 'ENTIDAD_PRODUCCION_INVALIDA'; end if;
 if not found then raise exception 'ENTIDAD_PRODUCCION_NO_ENCONTRADA'; end if;
 if actual.version is distinct from p_version_esperada then raise exception 'VERSION_PRODUCCION_CONFLICTO'; end if;
 if p_entidad='lugar' then
  if exists(select 1 from public.produccion_lugares_actuales where id<>p_id and lower(btrim(nombre))=lower(btrim(p_nombre)))
   or exists(select 1 from public.produccion_lugares where id<>p_id and lower(btrim(nombre))=lower(btrim(p_nombre))) then
   raise exception 'NOMBRE_PRODUCCION_DUPLICADO' using errcode='23505'; end if;
 else
  if p_activo and not actual.activo and not exists(select 1 from public.produccion_lugares_actuales where id=actual.lugar_id and activo) then
   raise exception 'LUGAR_PRODUCCION_INACTIVO'; end if;
  if exists(select 1 from public.produccion_unidades_actuales where id<>p_id and lugar_id=actual.lugar_id and lower(btrim(nombre))=lower(btrim(p_nombre)))
   or exists(select 1 from public.produccion_unidades where id<>p_id and lugar_id=actual.lugar_id and lower(btrim(nombre))=lower(btrim(p_nombre))) then
   raise exception 'NOMBRE_PRODUCCION_DUPLICADO' using errcode='23505'; end if;
 end if;
 insert into public.produccion_entidad_revisiones(lugar_id,unidad_id,version,nombre,observaciones,activo,autor_id,clave_idempotencia)
 values(case when p_entidad='lugar' then p_id end,case when p_entidad='unidad' then p_id end,actual.version+1,btrim(p_nombre),nullif(btrim(p_observaciones),''),p_activo,auth.uid(),p_clave_idempotencia);
 resultado:=jsonb_build_object('id',p_id,'version',actual.version+1);
 insert into produccion_privado.operaciones(clave,actor_id,solicitud,resultado) values(p_clave_idempotencia,auth.uid(),solicitud,resultado);
 return resultado;
end; $$;
alter function produccion_privado.validar_alta_activa() owner to postgres;
revoke all on function produccion_privado.validar_alta_activa() from public,anon,authenticated,service_role;
alter function public.editar_entidad_produccion(uuid,text,uuid,integer,text,text,boolean) owner to postgres;
revoke all on function public.editar_entidad_produccion(uuid,text,uuid,integer,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.editar_entidad_produccion(uuid,text,uuid,integer,text,text,boolean) to authenticated;
-- La unicidad original permanece: un nombre original queda reservado aun tras renombrarlo.
notify pgrst,'reload schema';
commit;
