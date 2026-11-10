-- Fase 1 local. Módulo independiente; no aplicar sin validación autorizada.
begin;
create schema produccion_privado authorization postgres;
revoke all on schema produccion_privado from public, anon, authenticated, service_role;

create table public.produccion_lugares (
 id uuid primary key default gen_random_uuid(),
 tipo text not null check (tipo in ('nave','gallinero')),
 nombre text not null check (length(btrim(nombre)) between 1 and 160),
 observaciones text check (length(observaciones)<=2000),
 creado_por uuid not null,
 fecha_creacion timestamptz not null default clock_timestamp(),
 unique(id,tipo)
);
create unique index produccion_lugares_nombre on public.produccion_lugares(lower(btrim(nombre)));
create table public.produccion_unidades (
 id uuid primary key default gen_random_uuid(),
 lugar_id uuid not null,
 tipo_lugar text not null,
 tipo text not null check (tipo in ('meson','flores','suelo','avicola')),
 nombre text not null check (length(btrim(nombre)) between 1 and 160),
 observaciones text check (length(observaciones)<=2000),
 creado_por uuid not null,
 fecha_creacion timestamptz not null default clock_timestamp(),
 foreign key(lugar_id,tipo_lugar) references public.produccion_lugares(id,tipo) on delete restrict,
 check ((tipo_lugar='gallinero' and tipo='avicola') or
        (tipo_lugar='nave' and tipo in ('meson','flores','suelo'))),
 unique(id,tipo)
);
create unique index produccion_gallinero_unidad_unica on public.produccion_unidades(lugar_id) where tipo='avicola';
create unique index produccion_unidades_nombre on public.produccion_unidades(lugar_id,lower(btrim(nombre)));
create table public.produccion_configuraciones_unidad (
 id uuid primary key default gen_random_uuid(),
 unidad_id uuid not null,
 tipo_unidad text not null check (tipo_unidad in ('meson','avicola')),
 vigente_desde date not null check (isfinite(vigente_desde)),
 capacidad_lechugas integer,
 cantidad_gallinas integer,
 observaciones text check (length(observaciones)<=2000),
 creado_por uuid not null,
 fecha_creacion timestamptz not null default clock_timestamp(),
 foreign key(unidad_id,tipo_unidad) references public.produccion_unidades(id,tipo) on delete restrict,
 check ((tipo_unidad='meson' and capacidad_lechugas is not null and capacidad_lechugas>0 and cantidad_gallinas is null)
 or (tipo_unidad='avicola' and cantidad_gallinas is not null and cantidad_gallinas>=0 and capacidad_lechugas is null)),
 unique(unidad_id,vigente_desde)
);
-- Vigencia [vigente_desde, siguiente vigente_desde), sin actualizar ni cerrar filas.
create table public.produccion_actividades (
 id uuid primary key default gen_random_uuid(),
 unidad_id uuid not null,
 tipo_unidad text not null,
 creado_por uuid not null,
 fecha_creacion timestamptz not null default clock_timestamp(),
 foreign key(unidad_id,tipo_unidad) references public.produccion_unidades(id,tipo) on delete restrict,
 unique(id,tipo_unidad)
);
create index produccion_actividades_unidad on public.produccion_actividades(unidad_id,id);
create table public.produccion_actividad_versiones (
 id uuid primary key default gen_random_uuid(),
 actividad_id uuid not null,
 tipo_unidad text not null,
 numero_version bigint not null check (numero_version>0),
 evento text not null check (evento in ('registro','correccion','anulacion')),
 fecha_operativa date not null check (isfinite(fecha_operativa)),
 tipo_actividad text not null,
 cantidad numeric,
 unidad_medida text,
 observaciones text check (length(observaciones)<=2000),
 motivo text,
 autor_id uuid not null,
 fecha_registro timestamptz not null default clock_timestamp(),
 clave_idempotencia uuid not null unique,
 foreign key(actividad_id,tipo_unidad) references public.produccion_actividades(id,tipo_unidad) on delete restrict,
 unique(actividad_id,numero_version),
 check ((numero_version=1 and evento='registro' and motivo is null)
 or (numero_version>1 and evento in ('correccion','anulacion') and motivo is not null and length(btrim(motivo)) between 1 and 2000)),
 check ((tipo_unidad='avicola' and tipo_actividad in ('colecta_huevos','alimentacion','compra_alimento','libre'))
 or (tipo_unidad='meson' and tipo_actividad in ('plantacion','cosecha','perdidas','fertilizacion','riego','libre'))
 or (tipo_unidad='flores' and tipo_actividad in ('cosecha','riego','tratamiento','libre'))),
 check ((cantidad is null and unidad_medida is null) or
 (cantidad is not null and cantidad>0 and cantidad<1000000000000 and unidad_medida is not null
 and unidad_medida in ('unidad','kg','g','litro','ml','ramo'))),
 check (case
 when tipo_actividad='colecta_huevos' or (tipo_unidad='meson' and tipo_actividad in ('plantacion','cosecha','perdidas'))
 then cantidad is not null and unidad_medida='unidad' and cantidad=trunc(cantidad)
 when tipo_actividad in ('alimentacion','compra_alimento') then cantidad is not null and unidad_medida in ('kg','g')
 when tipo_unidad='flores' and tipo_actividad='cosecha' then cantidad is not null and unidad_medida in ('unidad','ramo') and cantidad=trunc(cantidad)
 when tipo_actividad='libre' then observaciones is not null and length(btrim(observaciones))>0
 else true end)
);
create index produccion_versiones_fecha on public.produccion_actividad_versiones(fecha_operativa,tipo_actividad,actividad_id);
-- Sin FK a perfiles/auth: la identidad histórica sobrevive a la baja de usuarios.
create table produccion_privado.operaciones (
 clave uuid primary key,
 actor_id uuid not null,
 solicitud jsonb not null,
 resultado jsonb not null,
 fecha_registro timestamptz not null default clock_timestamp()
);

create function produccion_privado.impedir_mutacion() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception 'PRODUCCION_REGISTRO_INMUTABLE'; end; $$;
create function produccion_privado.exigir_unidad_gallinero() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if new.tipo='gallinero' and not exists(select 1 from public.produccion_unidades where lugar_id=new.id and tipo='avicola') then
 raise exception 'GALLINERO_REQUIERE_UNIDAD_AVICOLA'; end if;
 return null;
end; $$;
create constraint trigger produccion_gallinero_completo after insert on public.produccion_lugares
 deferrable initially deferred for each row execute function produccion_privado.exigir_unidad_gallinero();

create function produccion_privado.validar_version() returns trigger
language plpgsql set search_path=pg_catalog as $$
declare anterior public.produccion_actividad_versiones%rowtype;
begin
 perform 1 from public.produccion_actividades where id=new.actividad_id for update;
 select * into anterior from public.produccion_actividad_versiones
 where actividad_id=new.actividad_id order by numero_version desc limit 1;
 if new.numero_version<>coalesce(anterior.numero_version,0)+1
 or anterior.evento='anulacion' then raise exception 'SECUENCIA_VERSION_INVALIDA'; end if;
 if new.evento='anulacion' and row(new.fecha_operativa,new.tipo_actividad,new.cantidad,new.unidad_medida,new.observaciones)
 is distinct from row(anterior.fecha_operativa,anterior.tipo_actividad,anterior.cantidad,anterior.unidad_medida,anterior.observaciones)
 then raise exception 'ANULACION_DEBE_CONSERVAR_DATOS'; end if;
 return new;
end; $$;
create trigger produccion_validar_version before insert on public.produccion_actividad_versiones
 for each row execute function produccion_privado.validar_version();

create function produccion_privado.exigir_version_original() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if not exists(select 1 from public.produccion_actividad_versiones where actividad_id=new.id and numero_version=1) then
 raise exception 'ACTIVIDAD_REQUIERE_VERSION_ORIGINAL'; end if;
 return null;
end; $$;
create constraint trigger produccion_actividad_completa after insert on public.produccion_actividades
 deferrable initially deferred for each row execute function produccion_privado.exigir_version_original();

-- Punto de autorización reemplazable en una fase futura. No crea roles nuevos.
create function produccion_privado.exigir_administrador() returns void
language plpgsql set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then
 raise exception 'NO_AUTORIZADO' using errcode='42501'; end if;
end; $$;

-- Motor privado: las RPC tipadas construyen solicitudes completas, sin campos ignorados.
-- Orden: clave de idempotencia -> unidad o actividad. Sin bloqueos entre módulos.
create function produccion_privado.escribir(p_clave uuid,p_solicitud jsonb) returns jsonb
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

create function public.crear_lugar_produccion(p_clave_idempotencia uuid, p_tipo text, p_nombre text, p_observaciones text)
returns jsonb language sql security definer set search_path=pg_catalog as $$
 select produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object('operacion','crear_lugar', 'tipo',p_tipo, 'nombre',p_nombre, 'observaciones',p_observaciones));
$$;
alter function public.crear_lugar_produccion(uuid,text,text,text) owner to postgres;
revoke all on function public.crear_lugar_produccion(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crear_lugar_produccion(uuid,text,text,text) to authenticated;

create function public.crear_unidad_produccion(p_clave_idempotencia uuid, p_lugar_id uuid, p_tipo text, p_nombre text, p_observaciones text)
returns jsonb language sql security definer set search_path=pg_catalog as $$
 select produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object('operacion','crear_unidad', 'lugar_id',p_lugar_id, 'tipo',p_tipo, 'nombre',p_nombre, 'observaciones',p_observaciones));
$$;
alter function public.crear_unidad_produccion(uuid,uuid,text,text,text) owner to postgres;
revoke all on function public.crear_unidad_produccion(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crear_unidad_produccion(uuid,uuid,text,text,text) to authenticated;

create function public.configurar_unidad_produccion(p_clave_idempotencia uuid, p_unidad_id uuid, p_vigente_desde date, p_capacidad_lechugas integer, p_cantidad_gallinas integer, p_observaciones text)
returns jsonb language sql security definer set search_path=pg_catalog as $$
 select produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object('operacion','configurar_unidad', 'unidad_id',p_unidad_id, 'vigente_desde',p_vigente_desde, 'capacidad_lechugas',p_capacidad_lechugas, 'cantidad_gallinas',p_cantidad_gallinas, 'observaciones',p_observaciones));
$$;
alter function public.configurar_unidad_produccion(uuid,uuid,date,integer,integer,text) owner to postgres;
revoke all on function public.configurar_unidad_produccion(uuid,uuid,date,integer,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.configurar_unidad_produccion(uuid,uuid,date,integer,integer,text) to authenticated;

create function public.registrar_actividad_produccion(p_clave_idempotencia uuid, p_unidad_id uuid, p_fecha_operativa date, p_tipo_actividad text, p_cantidad numeric, p_unidad_medida text, p_observaciones text)
returns jsonb language sql security definer set search_path=pg_catalog as $$
 select produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object('operacion','registrar_actividad', 'unidad_id',p_unidad_id, 'fecha_operativa',p_fecha_operativa, 'tipo_actividad',p_tipo_actividad, 'cantidad',p_cantidad, 'unidad_medida',p_unidad_medida, 'observaciones',p_observaciones));
$$;
alter function public.registrar_actividad_produccion(uuid,uuid,date,text,numeric,text,text) owner to postgres;
revoke all on function public.registrar_actividad_produccion(uuid,uuid,date,text,numeric,text,text) from public,anon,authenticated,service_role;
grant execute on function public.registrar_actividad_produccion(uuid,uuid,date,text,numeric,text,text) to authenticated;

create function public.corregir_actividad_produccion(p_clave_idempotencia uuid, p_actividad_id uuid, p_version_esperada bigint, p_fecha_operativa date, p_tipo_actividad text, p_cantidad numeric, p_unidad_medida text, p_observaciones text, p_motivo text)
returns jsonb language sql security definer set search_path=pg_catalog as $$
 select produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object('operacion','corregir_actividad', 'actividad_id',p_actividad_id, 'version_esperada',p_version_esperada, 'fecha_operativa',p_fecha_operativa, 'tipo_actividad',p_tipo_actividad, 'cantidad',p_cantidad, 'unidad_medida',p_unidad_medida, 'observaciones',p_observaciones, 'motivo',p_motivo));
$$;
alter function public.corregir_actividad_produccion(uuid,uuid,bigint,date,text,numeric,text,text,text) owner to postgres;
revoke all on function public.corregir_actividad_produccion(uuid,uuid,bigint,date,text,numeric,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.corregir_actividad_produccion(uuid,uuid,bigint,date,text,numeric,text,text,text) to authenticated;

create function public.anular_actividad_produccion(p_clave_idempotencia uuid, p_actividad_id uuid, p_version_esperada bigint, p_motivo text)
returns jsonb language sql security definer set search_path=pg_catalog as $$
 select produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object('operacion','anular_actividad', 'actividad_id',p_actividad_id, 'version_esperada',p_version_esperada, 'motivo',p_motivo));
$$;
alter function public.anular_actividad_produccion(uuid,uuid,bigint,text) owner to postgres;
revoke all on function public.anular_actividad_produccion(uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.anular_actividad_produccion(uuid,uuid,bigint,text) to authenticated;

-- Los datos originales e históricos son append-only, incluso ante DML accidental
-- del propietario. La clave idempotente cubre TODAS las RPC y devuelve el resultado original.
do $$
declare tabla text;
begin
 foreach tabla in array array['produccion_lugares','produccion_unidades','produccion_configuraciones_unidad','produccion_actividades','produccion_actividad_versiones'] loop
  execute format('alter table public.%I owner to postgres',tabla);
  execute format('alter table public.%I enable row level security',tabla);
  execute format('alter table public.%I force row level security',tabla);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',tabla);
  execute format('grant select on public.%I to authenticated',tabla);
  execute format('create policy produccion_lectura_administrador on public.%I for select to authenticated using ((select auth.uid()) is not null and (select public.es_admin()))',tabla);
  execute format('create trigger produccion_inmutable before update or delete on public.%I for each row execute function produccion_privado.impedir_mutacion()',tabla);
  execute format('create trigger produccion_no_truncable before truncate on public.%I for each statement execute function produccion_privado.impedir_mutacion()',tabla);
 end loop;
end; $$;
alter table produccion_privado.operaciones owner to postgres;
alter table produccion_privado.operaciones enable row level security;
alter table produccion_privado.operaciones force row level security;
revoke all on produccion_privado.operaciones from public,anon,authenticated,service_role;
create trigger produccion_operaciones_inmutables before update or delete on produccion_privado.operaciones
 for each row execute function produccion_privado.impedir_mutacion();
create trigger produccion_operaciones_no_truncables before truncate on produccion_privado.operaciones
 for each statement execute function produccion_privado.impedir_mutacion();
alter function produccion_privado.impedir_mutacion() owner to postgres;
alter function produccion_privado.exigir_unidad_gallinero() owner to postgres;
alter function produccion_privado.validar_version() owner to postgres;
alter function produccion_privado.exigir_version_original() owner to postgres;
alter function produccion_privado.exigir_administrador() owner to postgres;
alter function produccion_privado.escribir(uuid,jsonb) owner to postgres;
revoke all on all functions in schema produccion_privado from public,anon,authenticated,service_role;
comment on table public.produccion_actividad_versiones is
 'Historial inmutable: versión 1 original, última versión estado actual. Anulación terminal; no sumar versiones históricas.';
comment on table public.produccion_configuraciones_unidad is
 'Configuración vigente en D: mayor vigente_desde <= D. Hasta el siguiente inicio (exclusivo); antes del primero, sin configuración. No es inventario.';
commit;
