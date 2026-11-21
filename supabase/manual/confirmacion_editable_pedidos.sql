-- Hidro Leufú. Fase 1. Pendiente de revisión humana del archivo completo.
-- Instalación única, transaccional, como postgres. Requiere las migraciones
-- operativas locales vigentes. La pertenencia multi se comprueba si existe.
-- El comprobante contiene datos comerciales históricos y sobrevive a la baja
-- del pedido. Revisar la política de conservación antes de cualquier limpieza.
begin;
set local lock_timeout = '5s';
set local search_path = pg_catalog;

do $pre$
declare
  v_rpc regprocedure;
  v_tabla regclass;
  v_rol text;
  v_columna name;
begin
  if current_user <> 'postgres'
    or not exists (select 1 from pg_roles where rolname = current_user and (rolsuper or rolbypassrls))
    or current_setting('session_replication_role') <> 'origin' then
    raise exception 'REQUIERE_POSTGRES_BYPASSRLS_Y_TRIGGERS_ORIGIN';
  end if;
  lock table public.pedidos, public.items_pedido, public.preparacion_items_pedido,
    public.historial_estados_pedido in share row exclusive mode;

  -- 20260811130000. Una variante instalada exige reconciliación previa.
  v_rpc := to_regprocedure('public.aceptar_pedido_administrativo(uuid)');
  if not exists (
    select 1 from pg_proc p join pg_language l on l.oid = p.prolang
    where p.oid = v_rpc and p.prosecdef and p.proowner = 'postgres'::regrole
      and p.prokind = 'f' and l.lanname = 'plpgsql' and p.provolatile = 'v'
      and not p.proisstrict and p.pronargdefaults = 0 and p.provariadic = 0
      and p.proconfig = array['search_path=public']
      and p.proargnames = array['p_pedido_id', 'pedido_id', 'numero_pedido', 'estado', 'fecha_actualizacion']
      and p.proretset and p.prorettype = 'record'::regtype
      and p.proargmodes = array['i', 't', 't', 't', 't']::"char"[]
      and p.proallargtypes = array['uuid'::regtype::oid, 'uuid'::regtype::oid,
        'text'::regtype::oid, 'public.estado_pedido'::regtype::oid, 'timestamptz'::regtype::oid]
      and md5(replace(p.prosrc, chr(13) || chr(10), chr(10))) = 'c2bfce4c786c39bc6f840d0d4fa6936c'
  ) or exists (
    select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
      and (p.proname in ('leer_confirmacion_pedido', 'confirmar_pedido_administrativo')
        or (p.proname = 'aceptar_pedido_administrativo' and p.oid <> v_rpc))
  ) then
    raise exception 'CONTRATO_RPC_CONFIRMACION_INCOMPATIBLE';
  end if;

  -- El historial existente debe ejecutarse primero, como trigger AFTER
  -- ordinario. Su sello proviene del DEFAULT de inicio de transacción.
  if not exists (
    select 1 from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_attribute a on a.attrelid = t.tgrelid and a.attname = 'estado'
    where t.tgrelid = 'public.pedidos'::regclass
      and t.tgname = 'registrar_historial_estado_pedido_despues_de_guardar'
      and t.tgfoid = to_regprocedure('public.registrar_historial_estado_pedido()')
      and t.tgtype = 21 and t.tgattr::text = a.attnum::text
      and t.tgenabled in ('O', 'A') and t.tgqual is null
      and t.tgconstraint = 0 and not t.tgisinternal and t.tgnargs = 0
      and p.prosecdef and p.proowner = 'postgres'::regrole
      and p.prorettype = 'trigger'::regtype
      and p.proconfig = array['search_path=public']
      and md5(replace(p.prosrc, chr(13) || chr(10), chr(10))) = 'feec715e19212ed0cd3892565e31643a'
  ) or not exists (
    select 1 from pg_attribute a join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where a.attrelid = 'public.historial_estados_pedido'::regclass
      and a.attname = 'fecha_creacion' and a.atttypid = 'timestamptz'::regtype
      and pg_get_expr(d.adbin, d.adrelid) in ('now()', 'transaction_timestamp()')
  ) then
    raise exception 'CONTRATO_TRIGGER_HISTORIAL_INCOMPATIBLE';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure('operativo_privado.impedir_mutacion_historial()')
      and md5(replace(p.prosrc, chr(13) || chr(10), chr(10))) = '219d77453ae71adab3b352be0dd8ff65'
  ) then
    raise exception 'CONTRATO_INMUTABILIDAD_INCOMPATIBLE';
  end if;

  -- Los grants del núcleo incluyen DML de pedidos, ítems e historial.
  -- Checkout, creación, preparación y cancelaciones escriben por RPC o trigger.
  foreach v_tabla in array array['public.pedidos'::regclass,
    'public.items_pedido'::regclass, 'public.preparacion_items_pedido'::regclass,
    'public.historial_estados_pedido'::regclass] loop
    execute format('revoke insert, update, delete, truncate, trigger on table %s
      from public, anon, authenticated, service_role', v_tabla);
    for v_columna in select a.attname from pg_attribute a
      where a.attrelid = v_tabla and a.attnum > 0 and not a.attisdropped loop
      execute format('revoke insert (%I), update (%I) on table %s
        from public, anon, authenticated, service_role', v_columna, v_columna, v_tabla);
    end loop;
  end loop;

  foreach v_rol in array array['anon', 'authenticated', 'service_role'] loop
    if has_schema_privilege(v_rol, 'operativo_privado', 'USAGE,CREATE')
      or has_schema_privilege(v_rol, 'public', 'CREATE') then
      raise exception 'ESQUEMA_NO_AISLADO: %', v_rol;
    end if;
    foreach v_tabla in array array['public.pedidos'::regclass,
      'public.items_pedido'::regclass, 'public.preparacion_items_pedido'::regclass,
      'public.historial_estados_pedido'::regclass] loop
      if has_any_column_privilege(v_rol, v_tabla, 'INSERT,UPDATE')
        or has_table_privilege(v_rol, v_tabla, 'DELETE,TRUNCATE,TRIGGER')
        or exists (select 1 from pg_class c where c.oid = v_tabla
          and pg_has_role(v_rol, c.relowner::regrole::text, 'MEMBER')) then
        raise exception 'DML_DIRECTO_INCOMPATIBLE: % %', v_rol, v_tabla;
      end if;
    end loop;
  end loop;
end;
$pre$;

create table operativo_privado.confirmaciones_pedido (
  pedido_id uuid primary key,
  cliente_id uuid,
  clave_idempotencia uuid not null unique,
  actor_id uuid not null,
  instante timestamptz not null,
  transaccion xid8 not null,
  revision_esperada text not null check (revision_esperada ~ '^[0-9a-f]{64}$'),
  documento jsonb not null check (jsonb_typeof(documento) = 'object'),
  solicitado jsonb not null check (jsonb_typeof(solicitado) = 'object'),
  confirmado jsonb not null check (jsonb_typeof(confirmado) = 'object'),
  diferencias jsonb not null check (jsonb_typeof(diferencias) = 'object'),
  autorizaciones_importe jsonb not null check (jsonb_typeof(autorizaciones_importe) = 'array')
);
-- Identificadores históricos sin FK para conservar la evidencia tras una baja.
alter table operativo_privado.confirmaciones_pedido enable row level security;
alter table operativo_privado.confirmaciones_pedido force row level security;
revoke all on operativo_privado.confirmaciones_pedido from public, anon, authenticated, service_role;
create trigger confirmaciones_pedido_inmutables
before update or delete on operativo_privado.confirmaciones_pedido
for each row execute function operativo_privado.impedir_mutacion_historial();
create trigger confirmaciones_pedido_no_truncables
before truncate on operativo_privado.confirmaciones_pedido
for each statement execute function operativo_privado.impedir_mutacion_historial();

-- UTC y DateStyle fijo para que la revisión y los snapshots sean reproducibles.
create function operativo_privado.snapshot_confirmacion_pedido(p_pedido_id uuid)
returns jsonb language sql stable set search_path = pg_catalog, pg_temp
set timezone = 'UTC' set datestyle = 'ISO, YMD' as $$
  select jsonb_build_object('pedido', to_jsonb(p), 'lineas',
    coalesce((select jsonb_agg(to_jsonb(i) order by i.id)
      from public.items_pedido i where i.pedido_id = p.id), '[]'::jsonb))
  from public.pedidos p where p.id = p_pedido_id
$$;

create function operativo_privado.revision_confirmacion_pedido(p_snapshot jsonb)
returns text language sql immutable strict set search_path = pg_catalog, pg_temp as $$
  select encode(sha256(convert_to(p_snapshot::text, 'UTF8')), 'hex')
$$;

-- Proyección explícita para ambos lectores. Los motivos internos, el actor,
-- el documento de escritura y los snapshots completos sólo se ofrecen a admin.
create function operativo_privado.diferencias_confirmacion_pedido(
  p_antes jsonb, p_despues jsonb, p_incluir_detalle_interno boolean
)
returns jsonb language sql immutable set search_path = pg_catalog, pg_temp as $$
  with pedido as (
    select coalesce(jsonb_object_agg(a.key,
      jsonb_build_object('solicitado', a.value, 'confirmado', d.value)), '{}'::jsonb) as cambios
    from jsonb_each(p_antes -> 'pedido') a join jsonb_each(p_despues -> 'pedido') d using (key)
    where a.value is distinct from d.value
      and ((p_incluir_detalle_interno and a.key = 'direccion_cliente_id') or a.key in (
      'nombre_ubicacion_snapshot', 'direccion_snapshot', 'comuna_snapshot',
      'region_snapshot', 'referencia_direccion_snapshot', 'destinatario_entrega_snapshot',
      'telefono_contacto_entrega_snapshot', 'zona_entrega_snapshot', 'latitud_entrega_snapshot',
      'longitud_entrega_snapshot', 'fecha_entrega', 'metodos_pago_previstos',
      'subtotal', 'costo_entrega', 'descuento', 'total'))
  ), lineas as (
    select fase, x ->> 'id' as id, jsonb_build_object(
      'producto', x -> 'nombre_producto_snapshot', 'presentacion', x -> 'nombre_presentacion_snapshot',
      'unidad', x -> 'unidad_snapshot', 'cantidad', x -> 'cantidad',
      'precio_unitario_referencia', x -> 'precio_final_unitario_snapshot',
      'total_linea', x -> 'total_linea'
    ) || case when p_incluir_detalle_interno then jsonb_build_object(
      'producto_id', x -> 'producto_id', 'presentacion_id', x -> 'presentacion_producto_id',
      'total_final_administrativo', x -> 'total_final_administrativo'
    ) else '{}'::jsonb end as datos
    from (values (1, p_antes), (2, p_despues)) s(fase, snapshot)
    cross join lateral jsonb_array_elements(s.snapshot -> 'lineas') l(x)
  ), cambios_lineas as (
    select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(a.id, d.id),
      'solicitado', a.datos, 'confirmado', d.datos) order by coalesce(a.id, d.id)),
      '[]'::jsonb) as cambios
    from (select * from lineas where fase = 1) a
    full join (select * from lineas where fase = 2) d using (id)
    where a.datos is distinct from d.datos
  )
  select jsonb_build_object('pedido', pedido.cambios, 'lineas', cambios_lineas.cambios)
  from pedido cross join cambios_lineas
$$;

-- Contexto privado de un único UPDATE. El trigger lo consume al generar
-- el comprobante definitivo. Una excepción revierte contexto, ítems e historial.
create table operativo_privado.confirmaciones_pedido_en_curso (
  pedido_id uuid primary key,
  clave_idempotencia uuid not null,
  actor_id uuid not null,
  transaccion xid8 not null,
  revision_esperada text not null,
  documento jsonb not null,
  solicitado jsonb not null,
  autorizaciones_importe jsonb not null
);
alter table operativo_privado.confirmaciones_pedido_en_curso enable row level security;
alter table operativo_privado.confirmaciones_pedido_en_curso force row level security;
revoke all on operativo_privado.confirmaciones_pedido_en_curso from public, anon, authenticated, service_role;

-- AFTER ordinario, posterior a registrar_historial... por orden alfabético.
-- Completa la evidencia dentro de la sentencia incluso con restricciones
-- en modo IMMEDIATE. OLD y NEW son las filas efectivas de la transición.
create function operativo_privado.exigir_evidencia_confirmacion_pedido()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp
set timezone = 'UTC' set datestyle = 'ISO, YMD' as $$
declare
  v_contexto operativo_privado.confirmaciones_pedido_en_curso%rowtype;
  v_confirmado jsonb;
begin
  if tg_op = 'INSERT' then
    raise exception 'CONFIRMACION_REQUIERE_PEDIDO_RECIBIDO';
  end if;
  if old.estado = 'confirmado' then return null; end if;
  if old.estado <> 'recibido' or old.id is distinct from new.id
    or old.cliente_id is distinct from new.cliente_id then
    raise exception 'CONFIRMACION_REQUIERE_PEDIDO_RECIBIDO';
  end if;

  delete from operativo_privado.confirmaciones_pedido_en_curso c
    where c.pedido_id = new.id and c.transaccion = pg_current_xact_id() and c.actor_id = auth.uid()
    returning c.* into v_contexto;
  if not found or (v_contexto.solicitado -> 'pedido') is distinct from to_jsonb(old)
    or not exists (
      select 1 from public.historial_estados_pedido h
      where h.pedido_id = new.id and h.estado_anterior = old.estado
        and h.estado_nuevo = new.estado and h.cambiado_por = v_contexto.actor_id
        and h.fecha_creacion = transaction_timestamp()
    ) then
    raise exception 'CONFIRMACION_SIN_EVIDENCIA';
  end if;

  v_confirmado := operativo_privado.snapshot_confirmacion_pedido(new.id);
  if (v_confirmado -> 'pedido') is distinct from to_jsonb(new) then
    raise exception 'TRANSICION_CONFIRMACION_INCOMPLETA';
  end if;
  insert into operativo_privado.confirmaciones_pedido (pedido_id, cliente_id, clave_idempotencia,
    actor_id, instante, transaccion, revision_esperada, documento, solicitado, confirmado,
    diferencias, autorizaciones_importe)
  values (new.id, new.cliente_id, v_contexto.clave_idempotencia, v_contexto.actor_id,
    clock_timestamp(), v_contexto.transaccion, v_contexto.revision_esperada, v_contexto.documento,
    v_contexto.solicitado, v_confirmado,
    operativo_privado.diferencias_confirmacion_pedido(v_contexto.solicitado, v_confirmado, true),
    v_contexto.autorizaciones_importe)
  on conflict (clave_idempotencia) do nothing;
  if not found then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO' using errcode = '23505'; end if;
  return null;
end;
$$;
create trigger validar_evidencia_confirmacion_pedido
after insert or update on public.pedidos for each row
when (new.estado = 'confirmado')
execute function operativo_privado.exigir_evidencia_confirmacion_pedido();

-- La revisión de lectura permite abrir un borrador consistente en una sola
-- sentencia. Identificadores ajenos o sin evidencia devuelven SQL NULL a cliente.
create function public.leer_confirmacion_pedido(p_pedido_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, pg_temp
set timezone = 'UTC' set datestyle = 'ISO, YMD' as $$
declare
  v_actor uuid := auth.uid();
  v_admin boolean := coalesce(public.es_admin(), false);
  v_confirmacion operativo_privado.confirmaciones_pedido%rowtype;
  v_snapshot jsonb;
begin
  if v_actor is null then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  select c.* into v_confirmacion
  from operativo_privado.confirmaciones_pedido c
  where c.pedido_id = p_pedido_id and (v_admin or exists (
    select 1 from public.pedidos p join public.clientes cl on cl.id = p.cliente_id
    where p.id = c.pedido_id and cl.id = c.cliente_id and cl.usuario_id = v_actor
  ));
  if found then
    if v_admin then
      return to_jsonb(v_confirmacion) - 'transaccion';
    end if;
    return jsonb_build_object('pedido_id', v_confirmacion.pedido_id,
      'instante', v_confirmacion.instante, 'diferencias',
      operativo_privado.diferencias_confirmacion_pedido(
        v_confirmacion.solicitado, v_confirmacion.confirmado, false));
  end if;
  if v_admin then
    v_snapshot := operativo_privado.snapshot_confirmacion_pedido(p_pedido_id);
    if v_snapshot -> 'pedido' ->> 'estado' = 'recibido' then
      return jsonb_build_object('revision', operativo_privado.revision_confirmacion_pedido(v_snapshot),
        'borrador', v_snapshot);
    end if;
  end if;
  return null;
end;
$$;

-- Cambios parciales. Ausencia de campo conserva el valor previo.
-- lineas: [{id, cantidad?, total_linea?, motivo?}, {id, eliminar:true},
--          {presentacion_id, cantidad, precio_referencia, total_linea?, motivo?}].
-- Un cambio de producto/presentación se expresa como baja y alta.
create function operativo_privado.confirmar_pedido(
  p_pedido_id uuid, p_revision_esperada text, p_clave_idempotencia uuid,
  p_documento jsonb, p_compatibilidad boolean
)
returns jsonb language plpgsql set search_path = pg_catalog, pg_temp
set timezone = 'UTC' set datestyle = 'ISO, YMD' as $$
declare
  v_actor uuid := auth.uid();
  v_pedido public.pedidos%rowtype;
  v_confirmacion operativo_privado.confirmaciones_pedido%rowtype;
  v_cliente public.clientes%rowtype;
  v_direccion public.direcciones_cliente%rowtype;
  v_presentacion public.presentaciones_producto%rowtype;
  v_producto public.productos%rowtype;
  v_item public.items_pedido%rowtype;
  v_antes jsonb;
  v_despues jsonb;
  v_revision text;
  v_linea jsonb;
  v_importes jsonb := '[]'::jsonb;
  v_altas public.items_pedido[] := '{}';
  v_ediciones public.items_pedido[] := '{}';
  v_bajas uuid[] := '{}';
  v_vistos uuid[] := '{}';
  v_presentaciones uuid[] := '{}';
  v_id uuid;
  v_presentacion_id uuid;
  v_direccion_id uuid;
  v_fecha date;
  v_metodos text[];
  v_zona text;
  v_nombre_ubicacion text;
  v_ambito text;
  v_motivo text;
  v_cantidad numeric;
  v_referencia numeric;
  v_base numeric;
  v_importe numeric;
  v_total_anterior bigint;
  v_subtotal_anterior numeric;
  v_subtotal numeric;
  v_despacho bigint;
  v_total bigint;
  v_cambia_direccion boolean;
  v_cambia_fecha boolean;
  v_cambia_metodos boolean;
  v_cambia_lineas boolean;
  v_asignado_multi boolean := false;
begin
  if v_actor is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if not p_compatibilidad and current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'AISLAMIENTO_NO_COMPATIBLE';
  end if;
  if (not p_compatibilidad and (
    p_pedido_id is null or p_clave_idempotencia is null or p_revision_esperada is null
    or p_revision_esperada !~ '^[0-9a-f]{64}$'))
    or jsonb_typeof(p_documento) is distinct from 'object'
    or octet_length(p_documento::text) > 262144 then
    raise exception 'DOCUMENTO_CONFIRMACION_INVALIDO';
  end if;
  if p_documento - array['direccion_cliente_id', 'fecha_entrega', 'metodos_pago_previstos', 'lineas'] <> '{}'::jsonb then
    raise exception 'DOCUMENTO_CONFIRMACION_INVALIDO';
  end if;

  -- Tomar desde el inicio el modo que requiere el UPDATE, antes de competir
  -- con los escritores que bloquean la tabla en EXCLUSIVE.
  lock table public.pedidos in row exclusive mode;
  select p.* into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if p_compatibilidad and v_pedido.estado = 'confirmado' then
    -- La aceptación anterior ya era idempotente en este estado, también para
    -- históricos cuyo solicitado no puede ser reconstruido.
    return null;
  end if;

  p_clave_idempotencia := coalesce(p_clave_idempotencia, gen_random_uuid());
  select c.* into v_confirmacion from operativo_privado.confirmaciones_pedido c
    where c.clave_idempotencia = p_clave_idempotencia;
  if found then
    if v_confirmacion.pedido_id is distinct from p_pedido_id
      or v_confirmacion.actor_id is distinct from v_actor
      or v_confirmacion.revision_esperada is distinct from p_revision_esperada
      or v_confirmacion.documento is distinct from p_documento then
      raise exception 'CLAVE_IDEMPOTENCIA_EN_USO' using errcode = '23505';
    end if;
    return to_jsonb(v_confirmacion) - 'transaccion';
  end if;

  -- El comprobante explícito sigue siendo recuperable tras la baja del pedido.
  if v_pedido.id is null then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.estado <> 'recibido' or exists (
    select 1 from operativo_privado.confirmaciones_pedido c where c.pedido_id = p_pedido_id
  ) then
    raise exception 'ESTADO_PEDIDO_INVALIDO';
  end if;
  perform 1 from public.items_pedido i where i.pedido_id = p_pedido_id order by i.id for update;
  v_antes := operativo_privado.snapshot_confirmacion_pedido(p_pedido_id);
  v_revision := operativo_privado.revision_confirmacion_pedido(v_antes);
  if not p_compatibilidad and v_revision is distinct from p_revision_esperada then
    raise exception 'REVISION_PEDIDO_CONFLICTO' using errcode = '40001';
  end if;

  v_direccion_id := v_pedido.direccion_cliente_id;
  if p_documento ? 'direccion_cliente_id' then
    if jsonb_typeof(p_documento -> 'direccion_cliente_id') not in ('string', 'null')
      or (p_documento ->> 'direccion_cliente_id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
      raise exception 'DIRECCION_INVALIDA';
    end if;
    v_direccion_id := (p_documento ->> 'direccion_cliente_id')::uuid;
  end if;
  v_cambia_direccion := v_direccion_id is distinct from v_pedido.direccion_cliente_id;

  v_fecha := v_pedido.fecha_entrega;
  if p_documento ? 'fecha_entrega' then
    if jsonb_typeof(p_documento -> 'fecha_entrega') not in ('string', 'null')
      or (p_documento ->> 'fecha_entrega') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'FECHA_ENTREGA_INVALIDA';
    end if;
    begin
      v_fecha := (p_documento ->> 'fecha_entrega')::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'FECHA_ENTREGA_INVALIDA';
    end;
  end if;
  v_cambia_fecha := v_fecha is distinct from v_pedido.fecha_entrega;

  v_metodos := v_pedido.metodos_pago_previstos;
  if p_documento ? 'metodos_pago_previstos' then
    if p_documento -> 'metodos_pago_previstos' = 'null'::jsonb then
      if v_metodos is not null then raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS'; end if;
    else
      if jsonb_typeof(p_documento -> 'metodos_pago_previstos') <> 'array' then
        raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
      end if;
      if jsonb_array_length(p_documento -> 'metodos_pago_previstos') not between 1 and 3
        or exists (select 1 from jsonb_array_elements(p_documento -> 'metodos_pago_previstos') x(m)
          where jsonb_typeof(m) <> 'string') then
        raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
      end if;
      select array(select m from jsonb_array_elements_text(p_documento -> 'metodos_pago_previstos') x(m))
        into v_metodos;
      if not (v_metodos <@ array['efectivo', 'transferencia', 'tarjeta']::text[])
        or (select count(distinct m) from unnest(v_metodos) x(m)) <> cardinality(v_metodos) then
        raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
      end if;
      if v_metodos is distinct from v_pedido.metodos_pago_previstos then
        if cardinality(v_metodos) = cardinality(v_pedido.metodos_pago_previstos)
          and v_metodos <@ v_pedido.metodos_pago_previstos and v_metodos @> v_pedido.metodos_pago_previstos then
          v_metodos := v_pedido.metodos_pago_previstos;
        else
          select array_agg(m order by n) into v_metodos
            from unnest(array['efectivo', 'transferencia', 'tarjeta']::text[]) with ordinality x(m, n)
            where m = any(v_metodos);
        end if;
      end if;
    end if;
  end if;
  v_cambia_metodos := v_metodos is distinct from v_pedido.metodos_pago_previstos;

  if p_documento ? 'lineas' then
    if jsonb_typeof(p_documento -> 'lineas') <> 'array' then
      raise exception 'LINEAS_INVALIDAS';
    end if;
    if jsonb_array_length(p_documento -> 'lineas') > 200 then raise exception 'LIMITE_LINEAS'; end if;
    for v_linea in select value from jsonb_array_elements(p_documento -> 'lineas')
      order by value ->> 'presentacion_id', value ->> 'id' loop
      if jsonb_typeof(v_linea) <> 'object' then
        raise exception 'LINEA_CONFIRMACION_INVALIDA';
      end if;
      if (v_linea ? 'id') = (v_linea ? 'presentacion_id')
        or (v_linea ? 'id' and (jsonb_typeof(v_linea -> 'id') <> 'string'
          or (v_linea ->> 'id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
        or (v_linea ? 'presentacion_id' and (jsonb_typeof(v_linea -> 'presentacion_id') <> 'string'
          or (v_linea ->> 'presentacion_id') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))
        or (v_linea ? 'cantidad' and jsonb_typeof(v_linea -> 'cantidad') <> 'number')
        or (v_linea ? 'precio_referencia' and jsonb_typeof(v_linea -> 'precio_referencia') <> 'number')
        or (v_linea ? 'total_linea' and jsonb_typeof(v_linea -> 'total_linea') <> 'number')
        or (v_linea ? 'motivo' and (jsonb_typeof(v_linea -> 'motivo') not in ('string', 'null')
          or length(v_linea ->> 'motivo') > 1000)) then
        raise exception 'LINEA_CONFIRMACION_INVALIDA';
      end if;
      v_id := (v_linea ->> 'id')::uuid;
      v_motivo := nullif(regexp_replace(v_linea ->> 'motivo',
        '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
      v_cantidad := (v_linea ->> 'cantidad')::numeric;
      v_importe := (v_linea ->> 'total_linea')::numeric;
      if v_importe is not null and (v_importe < 0
        or v_importe > 9000000000000 or v_importe <> trunc(v_importe)) then
        raise exception 'CANTIDAD_O_IMPORTE_INVALIDO';
      end if;
      v_total_anterior := null;

      if v_id is not null then
        if v_id = any(v_vistos) then raise exception 'LINEA_DUPLICADA'; end if;
        v_vistos := array_append(v_vistos, v_id);
        select i.* into v_item from public.items_pedido i where i.id = v_id and i.pedido_id = p_pedido_id;
        if not found then raise exception 'LINEA_NO_PERTENECE_AL_PEDIDO'; end if;
        if v_linea ? 'eliminar' then
          if v_linea -> 'eliminar' <> 'true'::jsonb or v_linea - array['id', 'eliminar'] <> '{}'::jsonb then
            raise exception 'BAJA_LINEA_INVALIDA';
          end if;
          v_bajas := array_append(v_bajas, v_id);
          continue;
        end if;
        if v_linea - array['id', 'cantidad', 'total_linea', 'motivo'] <> '{}'::jsonb then
          raise exception 'CAMPOS_LINEA_INVALIDOS';
        end if;
        v_cantidad := coalesce(v_cantidad, v_item.cantidad);
        if v_cantidad = v_item.cantidad and coalesce(v_importe, v_item.total_linea) = v_item.total_linea then
          if v_motivo is not null then raise exception 'MOTIVO_SIN_AJUSTE'; end if;
          continue;
        end if;
        v_total_anterior := v_item.total_linea;
        v_referencia := v_item.precio_final_unitario_snapshot;
        if v_cantidad <> v_item.cantidad and v_item.total_final_administrativo is not null
          and (v_importe is null or v_motivo is null) then
          raise exception 'LINEA_AJUSTADA_REQUIERE_IMPORTE_Y_MOTIVO';
        end if;
        v_presentacion_id := v_item.presentacion_producto_id;
      else
        if v_linea - array['presentacion_id', 'cantidad', 'precio_referencia', 'total_linea', 'motivo'] <> '{}'::jsonb
          or not (v_linea ?& array['cantidad', 'precio_referencia']) then
          raise exception 'ALTA_LINEA_INVALIDA';
        end if;
        v_presentacion_id := (v_linea ->> 'presentacion_id')::uuid;
        if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
        v_presentaciones := array_append(v_presentaciones, v_presentacion_id);
        v_referencia := (v_linea ->> 'precio_referencia')::numeric;
        v_item := null;
        v_item.id := gen_random_uuid();
        v_item.pedido_id := p_pedido_id;
      end if;

      if v_cantidad <= 0 or (v_cantidad is distinct from v_item.cantidad and v_cantidad > 100000)
        or v_referencia < 0 or (v_id is null and (v_referencia = 0
          or v_referencia > 9000000000000 or v_referencia <> trunc(v_referencia))) then
        raise exception 'CANTIDAD_O_IMPORTE_INVALIDO';
      end if;

      -- Precio histórico en ediciones. Sólo altas y cambios de cantidad
      -- consultan disponibilidad. El alta comprueba la referencia enviada.
      if v_cantidad is distinct from v_item.cantidad then
        select pr.* into v_producto from public.productos pr
        join public.presentaciones_producto pp on pp.producto_id = pr.id
        where pp.id = v_presentacion_id and pr.activo and pr.disponible for share of pr nowait;
        if not found then raise exception 'PRODUCTO_NO_DISPONIBLE'; end if;
        select pp.* into v_presentacion from public.presentaciones_producto pp
        where pp.id = v_presentacion_id and pp.producto_id = v_producto.id and pp.activa for share nowait;
        if not found or (v_id is not null and v_item.producto_id is distinct from v_producto.id) then
          raise exception 'PRESENTACION_NO_DISPONIBLE';
        end if;
        perform 1 from public.categorias c where c.id = v_producto.categoria_id and c.activa for share nowait;
        if not found then raise exception 'CATEGORIA_NO_DISPONIBLE'; end if;
        if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad,
          v_presentacion.nombre, v_cantidad) then
          raise exception 'CANTIDAD_INVALIDA';
        end if;
        if v_id is not null and not public.es_cantidad_pedido_valida(v_item.unidad_snapshot,
          case when coalesce(v_item.modo_cantidad_snapshot, case
            when upper(btrim(v_item.unidad_snapshot)) = 'KG'
              and lower(coalesce(v_item.nombre_presentacion_snapshot, '')) !~ '(saco|malla|caja|paquete|docena)'
              then 'kg_fraccionable' else 'unidad' end) = 'kg_fraccionable' then 1 else 2 end,
          v_item.nombre_presentacion_snapshot, v_cantidad) then
          raise exception 'CANTIDAD_INCOMPATIBLE_CON_LINEA_HISTORICA';
        end if;
        if v_id is null then
          if v_referencia <> v_presentacion.precio_final then
            raise exception 'PRECIO_REFERENCIA_DESACTUALIZADO' using errcode = '40001';
          end if;
          v_item.producto_id := v_producto.id;
          v_item.presentacion_producto_id := v_presentacion.id;
          v_item.nombre_producto_snapshot := v_producto.nombre;
          v_item.nombre_presentacion_snapshot := v_presentacion.nombre;
          v_item.unidad_snapshot := v_presentacion.unidad;
          v_item.precio_neto_unitario_snapshot := v_presentacion.precio_neto;
          v_item.precio_final_unitario_snapshot := v_presentacion.precio_final;
          v_item.modo_cantidad_snapshot := case
            when public.es_presentacion_kg_fraccionable(v_presentacion.unidad, v_presentacion.cantidad,
              v_presentacion.nombre) then 'kg_fraccionable'
            when lower(v_presentacion.nombre) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
            else 'unidad' end;
        end if;
      end if;

      v_base := round(v_cantidad * v_referencia);
      v_importe := coalesce(v_importe, v_base);
      if v_base > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
      if v_importe <> v_base or (v_id is not null and (
        v_cantidad = v_item.cantidad or v_item.total_final_administrativo is not null)) then
        if v_motivo is null then raise exception 'MOTIVO_PRECIO_REQUERIDO'; end if;
        v_importes := v_importes || jsonb_build_array(jsonb_build_object(
          'item_pedido_id', v_item.id, 'precio_unitario_referencia', v_referencia,
          'total_base', v_base, 'total_anterior', v_total_anterior,
          'total_autorizado', v_importe, 'motivo', v_motivo));
      elsif v_motivo is not null then
        raise exception 'MOTIVO_SIN_AJUSTE';
      end if;
      v_item.cantidad := v_cantidad;
      v_item.total_linea := v_importe::bigint;
      v_item.total_final_administrativo := case when v_importe <> v_base then v_importe::bigint end;
      if v_id is null then
        v_altas := array_append(v_altas, v_item);
      else
        v_ediciones := array_append(v_ediciones, v_item);
      end if;
    end loop;
  end if;

  v_cambia_lineas := cardinality(v_altas) + cardinality(v_ediciones) + cardinality(v_bajas) > 0;
  if v_cambia_lineas or v_cambia_direccion or v_cambia_fecha or v_cambia_metodos then
    -- Los escritores operativos locales bloquean el pedido antes de asociarlo
    -- o usan EXCLUSIVE en pedidos. Las FK también protegen las altas de vínculo.
    if to_regclass('operativo_privado.ruta_multi_pedidos') is not null then
      execute 'select exists (select 1 from operativo_privado.ruta_multi_pedidos where pedido_id = $1)'
        into v_asignado_multi using p_pedido_id;
    end if;
    if v_asignado_multi
      or exists (select 1 from public.paradas_ruta r where r.pedido_id = p_pedido_id)
      or exists (select 1 from operativo_privado.carga_pedidos c where c.pedido_id = p_pedido_id)
      or (v_cambia_fecha and exists (select 1 from operativo_privado.cargas c
        where c.fecha in (v_pedido.fecha_entrega, v_fecha) and c.estado <> 'preparacion')) then
      raise exception 'PEDIDO_CON_RUTA_O_CARGA';
    end if;
    if v_pedido.preparacion_estado is not null or v_pedido.preparacion_finalizada_en is not null
      or v_pedido.preparacion_finalizada_por is not null or v_pedido.subtotal_final is not null
      or v_pedido.total_final is not null or v_pedido.total_operativo_preparacion is not null
      or exists (select 1 from public.preparacion_items_pedido pi
        where pi.pedido_id = p_pedido_id or exists (select 1 from public.items_pedido i
          where i.pedido_id = p_pedido_id and i.id = pi.item_pedido_id)) then
      raise exception 'PEDIDO_CON_PREPARACION';
    end if;
    if v_pedido.venta_reconocida_en is not null or v_pedido.venta_definitiva_snapshot is not null
      or exists (select 1 from operativo_privado.entregas_definitivas e where e.pedido_id = p_pedido_id)
      or exists (select 1 from public.aplicaciones_pago a where a.pedido_id = p_pedido_id) then
      raise exception 'PEDIDO_CON_ENTREGA_O_APLICACIONES';
    end if;
  end if;

  if v_cambia_direccion then
    if v_direccion_id is null then raise exception 'DIRECCION_INVALIDA'; end if;
    -- Pagos y gestión de clientes pueden tomar cliente antes que pedido.
    -- NOWAIT evita esperar por ese lock en el orden inverso.
    select c.* into v_cliente from public.clientes c
      where c.id = v_pedido.cliente_id and c.activo for share nowait;
    if not found then raise exception 'CLIENTE_INVALIDO'; end if;
    v_ambito := case v_pedido.canal_origen
      when 'web' then 'personal' when 'manual' then 'comercial' end;
    if v_ambito is null then raise exception 'CANAL_SIN_REGLA_DE_DIRECCION'; end if;
    select d.* into v_direccion from public.direcciones_cliente d
      where d.id = v_direccion_id and d.cliente_id = v_pedido.cliente_id and d.activa
        and d.ambito = v_ambito for share nowait;
    if not found then raise exception 'DIRECCION_INVALIDA'; end if;
    if v_direccion.latitud is null or v_direccion.longitud is null
      or not (v_direccion.latitud between -90 and 90 and v_direccion.longitud between -180 and 180) then
      raise exception 'DIRECCION_SIN_UBICACION';
    end if;
    if v_direccion.zona_entrega_id is not null or v_pedido.canal_origen <> 'manual' then
      select z.nombre into v_zona from public.zonas_entrega z
        where z.id = v_direccion.zona_entrega_id and z.activa for share nowait;
      if not found then raise exception 'ZONA_INVALIDA'; end if;
    end if;
    if v_direccion.ambito = 'comercial' then
      v_nombre_ubicacion := coalesce(nullif(btrim(v_direccion.nombre_ubicacion), ''),
        nullif(btrim(v_direccion.nombre), ''), nullif(btrim(v_direccion.direccion), ''));
      if v_nombre_ubicacion is null then raise exception 'NOMBRE_UBICACION_REQUERIDO'; end if;
    end if;
  end if;

  v_subtotal := v_pedido.subtotal;
  v_despacho := v_pedido.costo_entrega;
  v_total := v_pedido.total;
  if v_cambia_lineas then
    if exists (select 1 from public.auditoria_precios_pedido_administrativo a
      where a.item_pedido_id = any(v_bajas)) then
      raise exception 'BAJA_LINEA_CON_AUDITORIA_DE_PRECIO';
    end if;
    if exists (select 1 from public.items_pedido i where i.pedido_id = p_pedido_id
      and i.presentacion_producto_id = any(v_presentaciones)) then
      -- La presentación existente se edita por id. Una baja y alta de la
      -- misma presentación crearía un cambio ficticio de identidad.
      raise exception 'PRESENTACION_DUPLICADA';
    end if;
    if cardinality(v_altas) = 0 and not exists (select 1 from public.items_pedido i
      where i.pedido_id = p_pedido_id and not (i.id = any(v_bajas))) then
      raise exception 'PEDIDO_SIN_LINEAS';
    end if;

    select coalesce(sum(i.total_linea), 0) into v_subtotal_anterior
      from public.items_pedido i where i.pedido_id = p_pedido_id;
    select coalesce(sum(x.total_linea), 0) into v_subtotal from (
      select coalesce(e.total_linea, i.total_linea) as total_linea
      from public.items_pedido i left join unnest(v_ediciones) e on e.id = i.id
      where i.pedido_id = p_pedido_id and not (i.id = any(v_bajas))
      union all
      select a.total_linea from unnest(v_altas) a
    ) x;
    if v_subtotal_anterior <> v_pedido.subtotal then raise exception 'SUBTOTAL_HISTORICO_INCOHERENTE'; end if;
    if v_subtotal > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
    if v_subtotal <> v_subtotal_anterior then
      v_despacho := case when v_subtotal < 25000 then 2000 else 0 end;
      if v_pedido.descuento > v_subtotal + v_despacho then
        raise exception 'DESCUENTO_INCOMPATIBLE_CON_EDICION';
      end if;
      v_total := (v_subtotal + v_despacho - v_pedido.descuento)::bigint;
    end if;

    if cardinality(v_bajas) > 0 then
      begin
        delete from public.items_pedido i where i.pedido_id = p_pedido_id and i.id = any(v_bajas);
      exception when foreign_key_violation then
        raise exception 'BAJA_LINEA_CON_REFERENCIA_HISTORICA';
      end;
    end if;
    foreach v_item in array v_ediciones loop
      update public.items_pedido i set cantidad = v_item.cantidad, total_linea = v_item.total_linea,
        total_final_administrativo = v_item.total_final_administrativo
      where i.id = v_item.id and i.pedido_id = p_pedido_id;
    end loop;
    foreach v_item in array v_altas loop
      insert into public.items_pedido (id, pedido_id, producto_id, presentacion_producto_id,
        nombre_producto_snapshot, nombre_presentacion_snapshot, unidad_snapshot, cantidad,
        precio_neto_unitario_snapshot, precio_final_unitario_snapshot, total_linea,
        modo_cantidad_snapshot, total_final_administrativo)
      values (v_item.id, p_pedido_id, v_item.producto_id, v_item.presentacion_producto_id,
        v_item.nombre_producto_snapshot, v_item.nombre_presentacion_snapshot, v_item.unidad_snapshot, v_item.cantidad,
        v_item.precio_neto_unitario_snapshot, v_item.precio_final_unitario_snapshot, v_item.total_linea,
        v_item.modo_cantidad_snapshot, v_item.total_final_administrativo);
    end loop;
  end if;

  if v_cambia_fecha then
    perform 1 from public.dias_entrega d order by d.dia_semana for share;
    if not coalesce(public.fecha_entrega_disponible(v_fecha, clock_timestamp()), false) then
      raise exception 'FECHA_ENTREGA_NO_DISPONIBLE';
    end if;
  end if;

  insert into operativo_privado.confirmaciones_pedido_en_curso (pedido_id, clave_idempotencia,
    actor_id, transaccion, revision_esperada, documento, solicitado, autorizaciones_importe)
  values (p_pedido_id, p_clave_idempotencia, v_actor, pg_current_xact_id(), v_revision,
    p_documento, v_antes, v_importes);

  -- Mantener un único UPDATE de cabecera para el historial de estados.
  if v_cambia_lineas or v_cambia_direccion or v_cambia_fecha or v_cambia_metodos then
    update public.pedidos p set
      estado = 'confirmado', fecha_entrega = v_fecha, metodos_pago_previstos = v_metodos,
      subtotal = v_subtotal::bigint, costo_entrega = v_despacho, total = v_total,
      direccion_cliente_id = v_direccion_id,
      nombre_ubicacion_snapshot = case when v_cambia_direccion then v_nombre_ubicacion else p.nombre_ubicacion_snapshot end,
      direccion_snapshot = case when v_cambia_direccion then coalesce(v_direccion.direccion, v_nombre_ubicacion) else p.direccion_snapshot end,
      comuna_snapshot = case when v_cambia_direccion then v_direccion.comuna else p.comuna_snapshot end,
      region_snapshot = case when v_cambia_direccion then v_direccion.region else p.region_snapshot end,
      referencia_direccion_snapshot = case when v_cambia_direccion then v_direccion.referencia else p.referencia_direccion_snapshot end,
      destinatario_entrega_snapshot = case when v_cambia_direccion then coalesce(v_direccion.destinatario,
        v_direccion.nombre, case when p.canal_origen = 'manual' then v_cliente.nombre end) else p.destinatario_entrega_snapshot end,
      telefono_contacto_entrega_snapshot = case when v_cambia_direccion then coalesce(v_direccion.telefono_contacto,
        case when p.canal_origen = 'manual' then v_cliente.telefono end) else p.telefono_contacto_entrega_snapshot end,
      zona_entrega_snapshot = case when v_cambia_direccion then v_zona else p.zona_entrega_snapshot end,
      latitud_entrega_snapshot = case when v_cambia_direccion then v_direccion.latitud else p.latitud_entrega_snapshot end,
      longitud_entrega_snapshot = case when v_cambia_direccion then v_direccion.longitud else p.longitud_entrega_snapshot end
    where p.id = p_pedido_id;
  else
    update public.pedidos p set estado = 'confirmado' where p.id = p_pedido_id;
  end if;

  select c.* into v_confirmacion from operativo_privado.confirmaciones_pedido c
    where c.pedido_id = p_pedido_id and c.transaccion = pg_current_xact_id()
      and c.clave_idempotencia = p_clave_idempotencia;
  v_despues := operativo_privado.snapshot_confirmacion_pedido(p_pedido_id);
  if v_confirmacion.pedido_id is null or v_despues is distinct from v_confirmacion.confirmado then
    raise exception 'TRANSICION_CONFIRMACION_INCOMPLETA';
  end if;
  if not (v_cambia_lineas or v_cambia_direccion or v_cambia_fecha or v_cambia_metodos)
    and (v_antes -> 'lineas' is distinct from v_despues -> 'lineas'
      or (v_antes -> 'pedido') - array['estado', 'fecha_actualizacion']
        is distinct from (v_despues -> 'pedido') - array['estado', 'fecha_actualizacion']) then
    raise exception 'CONFIRMACION_SIN_CAMBIOS_ALTERO_SOLICITUD';
  end if;
  return to_jsonb(v_confirmacion) - 'transaccion';
end;
$$;

create function public.confirmar_pedido_administrativo(
  p_pedido_id uuid, p_revision_esperada text, p_clave_idempotencia uuid, p_documento jsonb
)
returns jsonb language sql security definer set search_path = pg_catalog, pg_temp as $$
  select operativo_privado.confirmar_pedido(
    p_pedido_id, p_revision_esperada, p_clave_idempotencia, p_documento, false)
$$;

create or replace function public.aceptar_pedido_administrativo(p_pedido_id uuid)
returns table (
  pedido_id uuid, numero_pedido text, estado public.estado_pedido, fecha_actualizacion timestamptz
)
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  perform operativo_privado.confirmar_pedido(p_pedido_id, null, null, '{}'::jsonb, true);
  return query select p.id, p.numero_pedido, p.estado, p.fecha_actualizacion
    from public.pedidos p where p.id = p_pedido_id;
end;
$$;

revoke all on function
  operativo_privado.snapshot_confirmacion_pedido(uuid),
  operativo_privado.revision_confirmacion_pedido(jsonb),
  operativo_privado.diferencias_confirmacion_pedido(jsonb,jsonb,boolean),
  operativo_privado.exigir_evidencia_confirmacion_pedido(),
  operativo_privado.confirmar_pedido(uuid,text,uuid,jsonb,boolean),
  public.leer_confirmacion_pedido(uuid),
  public.confirmar_pedido_administrativo(uuid,text,uuid,jsonb),
  public.aceptar_pedido_administrativo(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.leer_confirmacion_pedido(uuid),
  public.confirmar_pedido_administrativo(uuid,text,uuid,jsonb),
  public.aceptar_pedido_administrativo(uuid) to authenticated;

commit;
