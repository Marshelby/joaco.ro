-- Versiones intencionales: reutiliza cabeceras, líneas, historial y conversión existentes.
-- No ejecutar sobre remoto sin revisión y aprobación de despliegue.
begin;
alter table public.posibles_pedidos add column numero_version integer not null default 1;
-- El trigger de cabecera no permite UPDATE de registros cerrados. Backfill mediante
-- DEFAULT temporal: la función se aplica por fila, sin desactivar protecciones.
alter table public.posibles_pedidos add column solicitud_id uuid not null default gen_random_uuid();
-- Cada registro previo es una solicitud independiente. La identidad estable es este UUID,
-- y la fila raíz se identifica por numero_version=1, sin depender de que id=solicitud_id.
alter table public.posibles_pedidos alter column solicitud_id drop default;
alter table public.posibles_pedidos add constraint pp_numero_version check (numero_version between 1 and 5),
  add constraint pp_solicitud_version_unica unique(solicitud_id,numero_version);
create unique index pp_una_conversion_por_solicitud on public.posibles_pedidos(solicitud_id) where estado = 'convertido';
create function public.pp_proteger_identidad_version() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
  if row(new.solicitud_id,new.numero_version) is distinct from row(old.solicitud_id,old.numero_version) then
    raise exception 'SOLICITUD_ORIGINAL_INMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function public.pp_proteger_identidad_version() from public,anon,authenticated,service_role;
create trigger pp_proteger_identidad_version before update on public.posibles_pedidos
for each row execute function public.pp_proteger_identidad_version();
drop function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text);
create or replace function public.registrar_posible_pedido_whatsapp(
  p_nombre text, p_telefono text, p_fecha date, p_observaciones text,
  p_items jsonb, p_clave_idempotencia uuid, p_secreto_reintento text,
  p_solicitud_clave uuid default null, p_solicitud_secreto text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_nombre text := btrim(p_nombre); v_telefono text; v_obs text := nullif(btrim(p_observaciones), '');
  v_items jsonb; v_item jsonb; v_linea jsonb; v_lineas jsonb := '[]'::jsonb;
  v_huella bytea; v_secreto bytea; v_p public.posibles_pedidos%rowtype;
  v_subtotal numeric := 0; v_despacho bigint; v_id uuid := gen_random_uuid(); v_orden integer := 0;
  v_respuesta jsonb; v_momento timestamptz; v_raiz public.posibles_pedidos%rowtype;
  v_solicitud uuid; v_numero integer := 1;
begin
  -- La ACL permite registro público; no expone helpers ni operaciones administrativas.
  if v_nombre is null or char_length(v_nombre) not between 1 and 160
    or char_length(coalesce(v_obs, '')) > 2000 or p_fecha is null or not isfinite(p_fecha)
    or p_clave_idempotencia is null or p_secreto_reintento is null
    or p_secreto_reintento !~ '^[0-9a-f]{64}$' then raise exception 'SOLICITUD_INVALIDA'; end if;
  if p_telefono is null or char_length(p_telefono) > 40 or p_telefono !~ '^\+?[0-9 ()-]+$' then raise exception 'TELEFONO_INVALIDO'; end if;
  v_telefono := regexp_replace(p_telefono, '[^0-9]', '', 'g');
  if v_telefono ~ '^9[0-9]{8}$' then v_telefono := '56' || v_telefono; end if;
  if v_telefono !~ '^569[0-9]{8}$' then raise exception 'TELEFONO_INVALIDO'; end if;
  v_items := public.pp_normalizar_items(p_items);
  v_huella := public.pp_huella(jsonb_build_object('nombre', v_nombre, 'telefono', v_telefono,
    'fecha', p_fecha, 'observaciones', v_obs, 'items', v_items));
  v_secreto := sha256(convert_to(p_secreto_reintento, 'UTF8'));
  if (p_solicitud_clave is null) <> (p_solicitud_secreto is null) then raise exception 'REINTENTO_INVALIDO'; end if;
  if p_solicitud_secreto is not null and p_solicitud_secreto !~ '^[0-9a-f]{64}$' then raise exception 'REINTENTO_INVALIDO'; end if;
  -- Puerta común con cuotas y administración: siempre ANTES de advisory de
  -- idempotencia y de filas. Evita ciclos incluso con claves cruzadas de reintento.
  perform pg_advisory_xact_lock(hashtextextended('posibles-pedidos:cuotas', 0));
  -- Orden común para registro, nueva versión y reintento: advisory de
  -- idempotencia ANTES de cualquier bloqueo de fila (raíz y luego versión).
  -- Serializa incluso sin fila; una colisión de hash solo añade espera.
  perform pg_advisory_xact_lock(hashtextextended('posible-pedido:' || p_clave_idempotencia::text, 0));
  if p_solicitud_clave is not null then
    select p.* into v_raiz from public.posibles_pedidos p
      where p.clave_idempotencia = p_solicitud_clave and p.numero_version = 1 for update;
    if not found or v_raiz.secreto_reintento_hash <> sha256(convert_to(p_solicitud_secreto, 'UTF8')) then
      raise exception 'REINTENTO_INVALIDO';
    end if;
    v_solicitud := v_raiz.solicitud_id;
  else
    v_solicitud := v_id;
  end if;
  select p.* into v_p from public.posibles_pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
  if found then
    if v_p.secreto_reintento_hash <> v_secreto or v_p.huella_solicitud <> v_huella
      or (p_solicitud_clave is not null and v_p.solicitud_id <> v_solicitud) then
      raise exception 'REINTENTO_INVALIDO';
    end if;
    select h.cambios -> 'respuesta_original' into v_respuesta from public.historial_posibles_pedidos h
      where h.posible_pedido_id = v_p.id and h.evento = 'registro' and h.version_resultante = 1;
    if v_respuesta is null then raise exception 'REGISTRO_INCONSISTENTE'; end if;
    return v_respuesta;
  end if;
  if p_solicitud_clave is not null then
    if exists (select 1 from public.posibles_pedidos where solicitud_id = v_solicitud and estado in ('convertido','descartado')) then
      raise exception 'POSIBLE_PEDIDO_CERRADO';
    end if;
    select count(*) + 1 into v_numero from public.posibles_pedidos where solicitud_id = v_solicitud;
    if v_numero > 5 then raise exception 'LIMITE_VERSIONES'; end if;
  end if;
  -- Cuotas persistentes dentro de la misma transacción, antes de consultar catálogo.
  -- 300 altas/h globales y 5/h por teléfono normalizado. La ventana de
  -- 10/10 minutos se agrupa por teléfono, nunca por una clave común a clientes.
  -- No depende de IP/headers manipulables ni persiste teléfonos en las cuotas.
  -- Los reintentos autenticados por secreto no consumen otra alta.
  if not public.consumir_limite_posibles_pedidos(
    encode(sha256(convert_to(v_telefono, 'UTF8')), 'hex'),
    encode(sha256(convert_to(v_telefono, 'UTF8')), 'hex')) then
    raise exception 'LIMITE_SOLICITUDES';
  end if;
  -- Hora real después de esperar el bloqueo, no inicio de la transacción.
  perform 1 from public.dias_entrega d order by d.dia_semana for share;
  v_momento := clock_timestamp();
  if not exists (select 1 from public.pp_fechas_validas(v_momento) f where f.fecha = p_fecha)
    then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_linea := public.pp_capturar_presentacion((v_item ->> 'presentacion_id')::uuid, (v_item ->> 'cantidad')::numeric);
    v_lineas := v_lineas || jsonb_build_array(v_linea);
    v_subtotal := v_subtotal + (v_linea ->> 'subtotal')::numeric;
  end loop;
  v_despacho := case when v_subtotal < 25000 then 2000 else 0 end;
  if v_subtotal + v_despacho > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
  if not exists (select 1 from public.pp_fechas_validas(clock_timestamp()) f where f.fecha = p_fecha)
    then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
  -- Misma regla vigente del checkout, capturada explícitamente, no entrada pública.
  insert into public.posibles_pedidos (solicitud_id, numero_version, id, nombre_solicitante, telefono_contacto, fecha_entrega_solicitada,
    observaciones, subtotal_estimado, costo_entrega_estimado, total_estimado,
    umbral_despacho_gratis_snapshot, tarifa_despacho_snapshot, clave_idempotencia, huella_solicitud, secreto_reintento_hash)
  values (v_solicitud, v_numero, v_id, v_nombre, v_telefono, p_fecha, v_obs, v_subtotal::bigint, v_despacho,
    (v_subtotal + v_despacho)::bigint, 25000, 2000, p_clave_idempotencia, v_huella, v_secreto)
  returning * into v_p;
  for v_linea in select value from jsonb_array_elements(v_lineas) loop
    v_orden := v_orden + 1;
    perform public.pp_insertar_linea(v_id, v_linea, v_orden);
  end loop;
  v_respuesta := jsonb_build_object('version_solicitud', v_numero, 'codigo_solicitud', coalesce(v_raiz.codigo_publico, v_p.codigo_publico), 'codigo', v_p.codigo_publico, 'fecha_solicitada', p_fecha,
    'subtotal', v_subtotal, 'despacho', v_despacho, 'total', v_subtotal + v_despacho,
    'moneda', 'CLP', 'estado', 'registrado', 'items', (
      select jsonb_agg(jsonb_build_object('producto', e.value ->> 'nombre_producto',
        'presentacion', e.value ->> 'nombre_presentacion', 'unidad', e.value ->> 'unidad',
        'cantidad', e.value -> 'cantidad', 'precio_unitario', e.value -> 'precio_venta',
        'subtotal', e.value -> 'subtotal') order by e.orden)
      from jsonb_array_elements(v_lineas) with ordinality e(value, orden)));
  insert into public.historial_posibles_pedidos (posible_pedido_id, clave_operacion, evento, version_resultante, cambios)
  values (v_id, p_clave_idempotencia, 'registro', 1, jsonb_build_object('respuesta_original', v_respuesta));
  return v_respuesta;
end;
$$;

create or replace function public.pp_bloquear_admin(p_id uuid, p_version bigint, p_operacion uuid)
returns public.posibles_pedidos language plpgsql set search_path = pg_catalog as $$
declare v_p public.posibles_pedidos%rowtype;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  if p_id is null or p_version is null or p_version < 1 or p_operacion is null then raise exception 'OPERACION_INVALIDA'; end if;
  -- Mismo orden que el flujo público: puerta global, raíz y versión.
  -- Debe preceder a cualquier bloqueo de fila tomado por las RPCs administrativas.
  perform pg_advisory_xact_lock(hashtextextended('posibles-pedidos:cuotas', 0));
  perform 1 from public.posibles_pedidos r where r.numero_version = 1 and r.solicitud_id =
    (select solicitud_id from public.posibles_pedidos where id = p_id) for update;
  select p.* into v_p from public.posibles_pedidos p where p.id = p_id for update;
  if not found then raise exception 'POSIBLE_PEDIDO_NO_ENCONTRADO'; end if;
  return v_p;
end;
$$;

alter function public.pp_bloquear_admin(uuid,bigint,uuid) owner to postgres;
revoke all on function public.pp_bloquear_admin(uuid,bigint,uuid) from public,anon,authenticated,service_role;

create or replace function public.pp_exigir_abierto(p public.posibles_pedidos, p_version bigint)
returns void language plpgsql set search_path = pg_catalog as $$
begin
  if exists (select 1 from public.posibles_pedidos v where v.solicitud_id = p.solicitud_id and v.estado in ('convertido','descartado')) then raise exception 'POSIBLE_PEDIDO_CERRADO'; end if;
  if p.version <> p_version then raise exception 'POSIBLE_PEDIDO_DESACTUALIZADO'; end if;
end;
$$;


alter function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text,uuid,text) owner to postgres;
revoke all on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text,uuid,text) to anon,authenticated;
-- RLS de la tabla se aplica también a la vista; solo lectura administrativa.
create view public.solicitudes_posibles_pedidos with (security_invoker=true) as
select elegida.*, raiz.codigo_publico as codigo_solicitud from public.posibles_pedidos raiz
cross join lateral (
  select v.* from public.posibles_pedidos v where v.solicitud_id = raiz.solicitud_id
  order by (v.estado in ('convertido','descartado')) desc, v.numero_version desc limit 1
) elegida where raiz.numero_version = 1;
revoke all on public.solicitudes_posibles_pedidos from public,anon,authenticated,service_role;
grant select on public.solicitudes_posibles_pedidos to authenticated;
commit;
