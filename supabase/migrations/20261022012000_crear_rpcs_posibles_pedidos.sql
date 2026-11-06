-- RPCs completas; aplicar únicamente después de validar en PostgreSQL aislado.
-- No configura días/cortes. No reemplaza crear_pedido_desde_carrito.
-- Límites técnicos: 100 líneas, JSON 32 KiB, cantidad <= 100000,
-- importes <= 9e12 CLP. Son barreras de recursos, no cupos de stock.
-- Helpers sin EXECUTE para roles de aplicación; RPCs con propietario explícito.

create function public.pp_fechas_validas(p_momento timestamptz)
returns table (fecha date)
language sql stable set search_path = pg_catalog as $$
  select (p_momento at time zone 'America/Santiago')::date + s.n
  from generate_series(0, 14) as s(n)
  where public.fecha_entrega_disponible(
    (p_momento at time zone 'America/Santiago')::date + s.n, p_momento)
  order by 1 limit 3;
$$;

create function public.obtener_fechas_posibles_pedidos()
returns table (fecha date)
language sql volatile security definer set search_path = pg_catalog as $$
  select * from public.pp_fechas_validas(clock_timestamp());
$$;

create function public.pp_huella(p_datos jsonb)
returns bytea language sql immutable set search_path = pg_catalog as $$
  select sha256(convert_to(p_datos::text, 'UTF8'));
$$;

create function public.pp_normalizar_items(p_items jsonb)
returns jsonb language plpgsql immutable set search_path = pg_catalog as $$
declare
  v_item jsonb; v_id uuid; v_cantidad numeric;
  v_ids uuid[] := array[]::uuid[]; v_resultado jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'ITEMS_INVALIDOS'; end if;
  if jsonb_array_length(p_items) not between 1 and 100
    or octet_length(p_items::text) > 32768 then raise exception 'LIMITE_SOLICITUD'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or (v_item - array['presentacion_id', 'cantidad']) <> '{}'::jsonb
      or jsonb_typeof(v_item -> 'presentacion_id') is distinct from 'string'
      or coalesce(v_item ->> 'presentacion_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(v_item -> 'cantidad') is distinct from 'number' then raise exception 'ITEM_INVALIDO'; end if;
    v_id := (v_item ->> 'presentacion_id')::uuid;
    v_cantidad := (v_item ->> 'cantidad')::numeric;
    if not (v_cantidad > 0 and v_cantidad <= 100000) then raise exception 'CANTIDAD_INVALIDA'; end if;
    if v_id = any(v_ids) then raise exception 'PRESENTACION_DUPLICADA'; end if;
    v_ids := array_append(v_ids, v_id);
    v_resultado := v_resultado || jsonb_build_array(jsonb_build_object(
      'presentacion_id', v_id, 'cantidad', trim_scale(v_cantidad)));
  end loop;
  return v_resultado;
end;
$$;

-- Bloquea producto ANTES que presentación (como el editor del catálogo).
-- Relee la relación después del bloqueo; categorías activas también se validan.
create function public.pp_capturar_presentacion(p_presentacion_id uuid, p_cantidad numeric, p_validar_precio boolean default true)
returns jsonb language plpgsql set search_path = pg_catalog as $$
declare
  v_producto_id uuid; v_producto public.productos%rowtype;
  v_presentacion public.presentaciones_producto%rowtype; v_activa boolean; v_modo text;
begin
  select pp.producto_id into v_producto_id from public.presentaciones_producto pp where pp.id = p_presentacion_id;
  select pr.* into v_producto from public.productos pr where pr.id = v_producto_id for share;
  if not found or not v_producto.activo or not v_producto.disponible then raise exception 'PRODUCTO_NO_DISPONIBLE'; end if;
  select pp.* into v_presentacion from public.presentaciones_producto pp where pp.id = p_presentacion_id for share;
  if not found or v_presentacion.producto_id <> v_producto.id or not v_presentacion.activa
    or not v_presentacion.es_principal then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
  select c.activa into v_activa from public.categorias c where c.id = v_producto.categoria_id for share;
  if v_activa is distinct from true then raise exception 'CATEGORIA_NO_DISPONIBLE'; end if;
  if p_cantidad is null or not (p_cantidad > 0 and p_cantidad <= 100000)
    or not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad,
      v_presentacion.nombre, p_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
  if p_validar_precio and (v_presentacion.precio_neto < 0 or v_presentacion.precio_final < v_presentacion.precio_neto
    or v_presentacion.precio_final::numeric * p_cantidad > 9000000000000) then raise exception 'PRECIO_INVALIDO'; end if;
  v_modo := case when public.es_presentacion_kg_fraccionable(v_presentacion.unidad,
      v_presentacion.cantidad, v_presentacion.nombre) then 'kg_fraccionable'
    when lower(v_presentacion.nombre) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada' else 'unidad' end;
  return jsonb_build_object('producto_id', v_producto.id, 'presentacion_id', v_presentacion.id,
    'nombre_producto', v_producto.nombre, 'nombre_presentacion', v_presentacion.nombre,
    'unidad', v_presentacion.unidad, 'cantidad_presentacion', v_presentacion.cantidad,
    'modo', v_modo, 'cantidad', p_cantidad,
    'precio_neto', v_presentacion.precio_neto, 'precio_venta', v_presentacion.precio_final,
    'subtotal', case when p_validar_precio then round(p_cantidad * v_presentacion.precio_final)::bigint else null end);
end;
$$;

create function public.pp_insertar_linea(p_id uuid, p_linea jsonb, p_orden integer)
returns uuid language plpgsql set search_path = pg_catalog as $$
declare v_id uuid;
begin
  insert into public.items_posible_pedido (posible_pedido_id, producto_id, presentacion_producto_id,
    nombre_producto_snapshot, nombre_presentacion_snapshot, unidad_snapshot, cantidad_presentacion_snapshot,
    modo_cantidad_snapshot, cantidad_original, cantidad, precio_neto_original_snapshot,
    precio_venta_original_snapshot, orden)
  values (p_id, (p_linea ->> 'producto_id')::uuid, (p_linea ->> 'presentacion_id')::uuid,
    p_linea ->> 'nombre_producto', p_linea ->> 'nombre_presentacion', p_linea ->> 'unidad',
    (p_linea ->> 'cantidad_presentacion')::numeric, p_linea ->> 'modo',
    (p_linea ->> 'cantidad')::numeric, (p_linea ->> 'cantidad')::numeric,
    (p_linea ->> 'precio_neto')::bigint, (p_linea ->> 'precio_venta')::bigint, p_orden)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.pp_resultado_admin(p_id uuid)
returns jsonb language sql stable set search_path = pg_catalog as $$
  select jsonb_build_object('posible_pedido_id', p.id, 'codigo', p.codigo_publico,
    'estado', p.estado, 'version', p.version, 'subtotal', p.subtotal_estimado,
    'despacho', p.costo_entrega_estimado, 'total', p.total_estimado,
    'pedido_id', p.pedido_oficial_id, 'numero_pedido', o.numero_pedido)
  from public.posibles_pedidos p left join public.pedidos o on o.id = p.pedido_oficial_id where p.id = p_id;
$$;

create function public.pp_bloquear_admin(p_id uuid, p_version bigint, p_operacion uuid)
returns public.posibles_pedidos language plpgsql set search_path = pg_catalog as $$
declare v_p public.posibles_pedidos%rowtype;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
  if p_id is null or p_version is null or p_version < 1 or p_operacion is null then raise exception 'OPERACION_INVALIDA'; end if;
  select p.* into v_p from public.posibles_pedidos p where p.id = p_id for update;
  if not found then raise exception 'POSIBLE_PEDIDO_NO_ENCONTRADO'; end if;
  return v_p;
end;
$$;

create function public.pp_reintento_admin(p_id uuid, p_operacion uuid, p_evento text, p_huella bytea)
returns jsonb language plpgsql set search_path = pg_catalog as $$
declare v_h public.historial_posibles_pedidos%rowtype;
begin
  select h.* into v_h from public.historial_posibles_pedidos h
    where h.posible_pedido_id = p_id and h.clave_operacion = p_operacion;
  if not found then return null; end if;
  if v_h.evento <> p_evento or v_h.administrador_id is distinct from auth.uid()
    or (v_h.cambios ->> 'huella_operacion') is distinct from encode(p_huella, 'hex') then
    raise exception 'CLAVE_OPERACION_EN_USO';
  end if;
  return v_h.cambios -> 'resultado';
end;
$$;

create function public.pp_exigir_abierto(p public.posibles_pedidos, p_version bigint)
returns void language plpgsql set search_path = pg_catalog as $$
begin
  if p.estado in ('convertido', 'descartado') then raise exception 'POSIBLE_PEDIDO_CERRADO'; end if;
  if p.version <> p_version then raise exception 'POSIBLE_PEDIDO_DESACTUALIZADO'; end if;
end;
$$;

create function public.pp_totales(p_id uuid)
returns table (subtotal bigint, despacho bigint, total bigint)
language plpgsql set search_path = pg_catalog as $$
declare v_s numeric; v_c integer; v_p public.posibles_pedidos%rowtype; v_d bigint;
begin
  select p.* into v_p from public.posibles_pedidos p where p.id = p_id;
  select sum(i.subtotal::numeric), count(*) into v_s, v_c
    from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo;
  if v_c not between 1 and 100 or v_s is null or v_s > 9000000000000 then raise exception 'LIMITE_SOLICITUD'; end if;
  v_d := case when v_s < v_p.umbral_despacho_gratis_snapshot then v_p.tarifa_despacho_snapshot else 0 end;
  if v_s + v_d > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
  return query select v_s::bigint, v_d, (v_s + v_d)::bigint;
end;
$$;

create function public.pp_evento(p_id uuid, p_operacion uuid, p_evento text, p_huella bytea, p_motivo text, p_cambios jsonb)
returns jsonb language plpgsql set search_path = pg_catalog as $$
declare v_resultado jsonb; v_version bigint;
begin
  v_resultado := public.pp_resultado_admin(p_id);
  select p.version into v_version from public.posibles_pedidos p where p.id = p_id;
  insert into public.historial_posibles_pedidos (posible_pedido_id, clave_operacion, evento,
    administrador_id, version_resultante, motivo, cambios)
  values (p_id, p_operacion, p_evento, auth.uid(), v_version, p_motivo,
    p_cambios || jsonb_build_object('huella_operacion', encode(p_huella, 'hex'), 'resultado', v_resultado));
  return v_resultado;
end;
$$;

create function public.registrar_posible_pedido_whatsapp(
  p_nombre text, p_telefono text, p_fecha date, p_observaciones text,
  p_items jsonb, p_clave_idempotencia uuid, p_secreto_reintento text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_nombre text := btrim(p_nombre); v_telefono text; v_obs text := nullif(btrim(p_observaciones), '');
  v_items jsonb; v_item jsonb; v_linea jsonb; v_lineas jsonb := '[]'::jsonb;
  v_huella bytea; v_secreto bytea; v_p public.posibles_pedidos%rowtype;
  v_subtotal numeric := 0; v_despacho bigint; v_id uuid := gen_random_uuid(); v_orden integer := 0;
  v_respuesta jsonb; v_momento timestamptz;
begin
  -- ACL exclusiva a service_role; nunca confiar en el rol de un parámetro.
  if auth.role() is distinct from 'service_role' then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
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
  -- Serializa incluso cuando todavía no existe la fila. Una colisión de hash
  -- solo serializa solicitudes distintas; la unicidad sigue siendo del UUID.
  perform pg_advisory_xact_lock(hashtextextended('posible-pedido:' || p_clave_idempotencia::text, 0));
  select p.* into v_p from public.posibles_pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
  if found then
    if v_p.secreto_reintento_hash <> v_secreto or v_p.huella_solicitud <> v_huella then
      raise exception 'REINTENTO_INVALIDO';
    end if;
    select h.cambios -> 'respuesta_original' into v_respuesta from public.historial_posibles_pedidos h
      where h.posible_pedido_id = v_p.id and h.evento = 'registro' and h.version_resultante = 1;
    if v_respuesta is null then raise exception 'REGISTRO_INCONSISTENTE'; end if;
    return v_respuesta;
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
  insert into public.posibles_pedidos (id, nombre_solicitante, telefono_contacto, fecha_entrega_solicitada,
    observaciones, subtotal_estimado, costo_entrega_estimado, total_estimado,
    umbral_despacho_gratis_snapshot, tarifa_despacho_snapshot, clave_idempotencia, huella_solicitud, secreto_reintento_hash)
  values (v_id, v_nombre, v_telefono, p_fecha, v_obs, v_subtotal::bigint, v_despacho,
    (v_subtotal + v_despacho)::bigint, 25000, 2000, p_clave_idempotencia, v_huella, v_secreto)
  returning * into v_p;
  for v_linea in select value from jsonb_array_elements(v_lineas) loop
    v_orden := v_orden + 1;
    perform public.pp_insertar_linea(v_id, v_linea, v_orden);
  end loop;
  v_respuesta := jsonb_build_object('codigo', v_p.codigo_publico, 'fecha_solicitada', p_fecha,
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

-- Lista final ordenada: {item_id,cantidad} para conservar/reactivar una línea,
-- o {presentacion_id,cantidad} para incorporar una nueva. Omitidas = retiradas.
create function public.editar_posible_pedido_administrativo(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid, p_lineas jsonb
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_p public.posibles_pedidos%rowtype; v_reintento jsonb; v_huella bytea;
  v_linea jsonb; v_i public.items_posible_pedido%rowtype; v_captura jsonb; v_t record;
  v_ids uuid[]; v_usados uuid[] := array[]::uuid[]; v_id uuid; v_cantidad numeric; v_orden integer := 0;
  v_antes jsonb; v_despues jsonb;
begin
  v_p := public.pp_bloquear_admin(p_id, p_version_esperada, p_clave_operacion);
  if jsonb_typeof(p_lineas) is distinct from 'array' then raise exception 'LINEAS_INVALIDAS'; end if;
  if jsonb_array_length(p_lineas) not between 1 and 100 or octet_length(p_lineas::text) > 32768 then raise exception 'LIMITE_SOLICITUD'; end if;
  v_huella := public.pp_huella(jsonb_build_object('version', p_version_esperada, 'lineas', p_lineas));
  v_reintento := public.pp_reintento_admin(p_id, p_clave_operacion, 'edicion', v_huella);
  if v_reintento is not null then return v_reintento; end if;
  perform public.pp_exigir_abierto(v_p, p_version_esperada);
  select array_agg(i.id) into v_ids from public.items_posible_pedido i where i.posible_pedido_id = p_id;
  select jsonb_agg(jsonb_build_object('item_id', i.id, 'cantidad', i.cantidad, 'orden', i.orden) order by i.orden)
    into v_antes from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo;
  -- Libera ambos índices parciales antes de reordenar/reemplazar.
  update public.items_posible_pedido set activo = false where posible_pedido_id = p_id and activo;
  for v_linea in select value from jsonb_array_elements(p_lineas) loop
    if jsonb_typeof(v_linea) is distinct from 'object'
      or (v_linea - array['item_id','presentacion_id','cantidad']) <> '{}'::jsonb
      or jsonb_typeof(v_linea -> 'cantidad') is distinct from 'number'
      or ((v_linea ? 'item_id') = (v_linea ? 'presentacion_id')) then raise exception 'LINEA_INVALIDA'; end if;
    v_cantidad := (v_linea ->> 'cantidad')::numeric;
    if not (v_cantidad > 0 and v_cantidad <= 100000) then raise exception 'CANTIDAD_INVALIDA'; end if;
    v_orden := v_orden + 1;
    if v_linea ? 'item_id' then
      if coalesce(v_linea ->> 'item_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'ITEM_INVALIDO'; end if;
      v_id := (v_linea ->> 'item_id')::uuid;
      if not coalesce(v_id = any(v_ids), false) or v_id = any(v_usados) then raise exception 'ITEM_INVALIDO'; end if;
      v_usados := array_append(v_usados, v_id);
      select i.* into v_i from public.items_posible_pedido i where i.id = v_id;
      if v_cantidad * coalesce(v_i.precio_venta_autorizado, v_i.precio_venta_original_snapshot)::numeric > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
      update public.items_posible_pedido set cantidad = v_cantidad, orden = v_orden, activo = true where id = v_id;
    else
      if coalesce(v_linea ->> 'presentacion_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
      -- No permitir recotizar una presentación histórica retirándola y agregándola
      -- de nuevo. Para reactivarla se debe enviar su item_id y conservar precios.
      if exists (select 1 from public.items_posible_pedido i where i.posible_pedido_id = p_id
        and i.presentacion_producto_id = (v_linea ->> 'presentacion_id')::uuid) then
        raise exception 'PRESENTACION_EXISTENTE_USAR_ITEM_ID';
      end if;
      v_captura := public.pp_capturar_presentacion((v_linea ->> 'presentacion_id')::uuid, v_cantidad);
      perform public.pp_insertar_linea(p_id, v_captura, v_orden);
    end if;
  end loop;
  select * into v_t from public.pp_totales(p_id);
  update public.posibles_pedidos set subtotal_estimado = v_t.subtotal, costo_entrega_estimado = v_t.despacho,
    total_estimado = v_t.total, estado = 'en_gestion', version = version + 1 where id = p_id;
  select jsonb_agg(jsonb_build_object('item_id', i.id, 'cantidad', i.cantidad, 'orden', i.orden) order by i.orden)
    into v_despues from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo;
  return public.pp_evento(p_id, p_clave_operacion, 'edicion', v_huella, null,
    jsonb_build_object('antes', v_antes, 'despues', v_despues));
end;
$$;

create function public.autorizar_precio_posible_pedido(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid, p_item_id uuid,
  p_precio_neto bigint, p_precio_venta bigint, p_motivo text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_p public.posibles_pedidos%rowtype; v_i public.items_posible_pedido%rowtype;
  v_reintento jsonb; v_huella bytea; v_t record; v_fecha timestamptz; v_motivo text := btrim(p_motivo);
begin
  v_p := public.pp_bloquear_admin(p_id, p_version_esperada, p_clave_operacion);
  if v_motivo is null or char_length(v_motivo) not between 1 and 1000
    or p_precio_neto is null or p_precio_venta is null or p_precio_neto < 0
    or p_precio_venta < p_precio_neto or p_precio_venta > 9000000000000 then raise exception 'PRECIO_O_MOTIVO_INVALIDO'; end if;
  -- Coherencia real del catálogo: final >= neto >= 0. No inventar tasa de IVA.
  v_huella := public.pp_huella(jsonb_build_object('version', p_version_esperada, 'item_id', p_item_id,
    'neto', p_precio_neto, 'venta', p_precio_venta, 'motivo', v_motivo));
  v_reintento := public.pp_reintento_admin(p_id, p_clave_operacion, 'autorizacion_precio', v_huella);
  if v_reintento is not null then return v_reintento; end if;
  perform public.pp_exigir_abierto(v_p, p_version_esperada);
  select i.* into v_i from public.items_posible_pedido i where i.id = p_item_id and i.posible_pedido_id = p_id and i.activo for update;
  if not found then raise exception 'ITEM_INVALIDO'; end if;
  if v_i.cantidad * p_precio_venta::numeric > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
  update public.items_posible_pedido set precio_neto_autorizado = p_precio_neto,
    precio_venta_autorizado = p_precio_venta, precio_autorizado_por = auth.uid(),
    fecha_autorizacion_precio = clock_timestamp(), motivo_autorizacion_precio = v_motivo
    where id = p_item_id returning fecha_autorizacion_precio into v_fecha;
  select * into v_t from public.pp_totales(p_id);
  update public.posibles_pedidos set subtotal_estimado = v_t.subtotal, costo_entrega_estimado = v_t.despacho,
    total_estimado = v_t.total, estado = 'en_gestion', version = version + 1 where id = p_id;
  return public.pp_evento(p_id, p_clave_operacion, 'autorizacion_precio', v_huella, v_motivo,
    jsonb_build_object('item_id', p_item_id, 'precio_neto_anterior', coalesce(v_i.precio_neto_autorizado, v_i.precio_neto_original_snapshot),
      'precio_venta_anterior', coalesce(v_i.precio_venta_autorizado, v_i.precio_venta_original_snapshot),
      'precio_neto_autorizado', p_precio_neto, 'precio_venta_autorizado', p_precio_venta, 'fecha_autorizacion_precio', v_fecha));
end;
$$;

create function public.asociar_cliente_posible_pedido(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid, p_cliente_id uuid
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_p public.posibles_pedidos%rowtype; v_reintento jsonb; v_huella bytea;
begin
  v_p := public.pp_bloquear_admin(p_id, p_version_esperada, p_clave_operacion);
  v_huella := public.pp_huella(jsonb_build_object('version', p_version_esperada, 'cliente_id', p_cliente_id));
  v_reintento := public.pp_reintento_admin(p_id, p_clave_operacion, 'asociacion_cliente', v_huella);
  if v_reintento is not null then return v_reintento; end if;
  perform public.pp_exigir_abierto(v_p, p_version_esperada);
  perform 1 from public.clientes c where c.id = p_cliente_id and c.activo for share;
  if not found then raise exception 'CLIENTE_INVALIDO'; end if;
  update public.posibles_pedidos set cliente_id = p_cliente_id, estado = 'en_gestion', version = version + 1 where id = p_id;
  return public.pp_evento(p_id, p_clave_operacion, 'asociacion_cliente', v_huella, null,
    jsonb_build_object('cliente_anterior_id', v_p.cliente_id, 'cliente_id', p_cliente_id));
end;
$$;

create function public.descartar_posible_pedido(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid, p_motivo text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v_p public.posibles_pedidos%rowtype; v_reintento jsonb; v_huella bytea; v_motivo text := btrim(p_motivo);
begin
  v_p := public.pp_bloquear_admin(p_id, p_version_esperada, p_clave_operacion);
  if v_motivo is null or char_length(v_motivo) not between 1 and 1000 then raise exception 'MOTIVO_REQUERIDO'; end if;
  v_huella := public.pp_huella(jsonb_build_object('version', p_version_esperada, 'motivo', v_motivo));
  v_reintento := public.pp_reintento_admin(p_id, p_clave_operacion, 'descarte', v_huella);
  if v_reintento is not null then return v_reintento; end if;
  perform public.pp_exigir_abierto(v_p, p_version_esperada);
  update public.posibles_pedidos set estado = 'descartado', fecha_cierre = clock_timestamp(), version = version + 1 where id = p_id;
  return public.pp_evento(p_id, p_clave_operacion, 'descarte', v_huella, v_motivo, '{}'::jsonb);
end;
$$;

create function public.convertir_posible_pedido_administrativo(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid,
  p_direccion_id uuid, p_fecha_efectiva date, p_metodos_pago text[]
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_p public.posibles_pedidos%rowtype; v_cliente public.clientes%rowtype;
  v_direccion public.direcciones_cliente%rowtype; v_zona public.zonas_entrega%rowtype;
  v_i public.items_posible_pedido%rowtype; v_actual jsonb; v_t record;
  v_huella bytea; v_reintento jsonb; v_metodos text[]; v_pedido_id uuid := gen_random_uuid();
  v_item_id uuid; v_cierre timestamptz;
begin
  v_p := public.pp_bloquear_admin(p_id, p_version_esperada, p_clave_operacion);
  -- Recuperación segura incluso con otra clave/versión: no hay segundo pedido.
  if v_p.estado = 'convertido' then return public.pp_resultado_admin(p_id); end if;
  if p_metodos_pago is null or cardinality(p_metodos_pago) not between 1 and 3
    or array_ndims(p_metodos_pago) <> 1 or array_position(p_metodos_pago, null) is not null
    or not (p_metodos_pago <@ array['efectivo','transferencia','tarjeta']::text[])
    or (select count(distinct m) from unnest(p_metodos_pago) m) <> cardinality(p_metodos_pago) then
    raise exception 'METODOS_PAGO_INVALIDOS';
  end if;
  select array_agg(m order by n) into v_metodos
    from unnest(array['efectivo','transferencia','tarjeta']::text[]) with ordinality x(m,n) where m = any(p_metodos_pago);
  v_huella := public.pp_huella(jsonb_build_object('version', p_version_esperada, 'direccion_id', p_direccion_id,
    'fecha', p_fecha_efectiva, 'metodos', v_metodos));
  v_reintento := public.pp_reintento_admin(p_id, p_clave_operacion, 'conversion', v_huella);
  if v_reintento is not null then return v_reintento; end if;
  perform public.pp_exigir_abierto(v_p, p_version_esperada);
  select c.* into v_cliente from public.clientes c where c.id = v_p.cliente_id and c.activo for share;
  if not found then raise exception 'CLIENTE_INVALIDO'; end if;
  select d.* into v_direccion from public.direcciones_cliente d where d.id = p_direccion_id
    and d.cliente_id = v_cliente.id and d.activa for share;
  if not found then raise exception 'DIRECCION_INVALIDA'; end if;
  if v_direccion.latitud is null or v_direccion.longitud is null
    or not (v_direccion.latitud between -90 and 90 and v_direccion.longitud between -180 and 180) then
    raise exception 'DIRECCION_SIN_UBICACION'; end if;
  select z.* into v_zona from public.zonas_entrega z where z.id = v_direccion.zona_entrega_id and z.activa for share;
  if not found then raise exception 'ZONA_INVALIDA'; end if;
  select * into v_t from public.pp_totales(p_id);
  -- Se valida con catálogo, pero NO se usan sus precios para el pedido.
  for v_i in select i.* from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo order by i.id for update loop
    v_actual := public.pp_capturar_presentacion(v_i.presentacion_producto_id, v_i.cantidad, false);
    if row((v_actual ->> 'producto_id')::uuid, v_actual ->> 'nombre_producto',
        v_actual ->> 'nombre_presentacion', v_actual ->> 'unidad', (v_actual ->> 'cantidad_presentacion')::numeric, v_actual ->> 'modo')
      is distinct from row(v_i.producto_id, v_i.nombre_producto_snapshot, v_i.nombre_presentacion_snapshot,
        v_i.unidad_snapshot, v_i.cantidad_presentacion_snapshot, v_i.modo_cantidad_snapshot) then
      raise exception 'PRESENTACION_MODIFICADA_REQUIERE_REVISION';
    end if;
  end loop;
  -- Evaluar después de esperas por locks; nunca permitir fecha vencida.
  perform 1 from public.dias_entrega d order by d.dia_semana for share;
  if p_fecha_efectiva is null or not isfinite(p_fecha_efectiva)
    or not public.fecha_entrega_disponible(p_fecha_efectiva, clock_timestamp()) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
  insert into public.pedidos (id, cliente_id, canal_origen, estado, nombre_cliente_snapshot,
    telefono_cliente_snapshot, email_cliente_snapshot, direccion_cliente_id,
    direccion_snapshot, comuna_snapshot, region_snapshot, referencia_direccion_snapshot,
    destinatario_entrega_snapshot, telefono_contacto_entrega_snapshot, zona_entrega_snapshot,
    latitud_entrega_snapshot, longitud_entrega_snapshot, subtotal, costo_entrega, descuento,
    total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos)
  values (v_pedido_id, v_cliente.id, 'whatsapp', 'recibido', v_cliente.nombre,
    v_cliente.telefono, v_cliente.email, v_direccion.id,
    v_direccion.direccion, v_direccion.comuna, v_direccion.region, v_direccion.referencia,
    coalesce(v_direccion.destinatario, v_direccion.nombre), v_direccion.telefono_contacto, v_zona.nombre,
    v_direccion.latitud, v_direccion.longitud, v_t.subtotal, v_t.despacho, 0,
    v_t.total, v_p.observaciones, p_fecha_efectiva, gen_random_uuid(), v_metodos);
  -- La cabecera debe estar convertida antes de crear los vínculos (trigger).
  v_cierre := clock_timestamp();
  update public.posibles_pedidos set estado = 'convertido', pedido_oficial_id = v_pedido_id,
    fecha_conversion = v_cierre, fecha_cierre = v_cierre, version = version + 1,
    subtotal_estimado = v_t.subtotal, costo_entrega_estimado = v_t.despacho, total_estimado = v_t.total where id = p_id;
  for v_i in select i.* from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo order by i.orden loop
    insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id,
      nombre_producto_snapshot, nombre_presentacion_snapshot, unidad_snapshot, cantidad,
      precio_neto_unitario_snapshot, precio_final_unitario_snapshot, total_linea, modo_cantidad_snapshot)
    values (v_pedido_id, v_i.producto_id, v_i.presentacion_producto_id,
      v_i.nombre_producto_snapshot, v_i.nombre_presentacion_snapshot, v_i.unidad_snapshot, v_i.cantidad,
      coalesce(v_i.precio_neto_autorizado, v_i.precio_neto_original_snapshot),
      coalesce(v_i.precio_venta_autorizado, v_i.precio_venta_original_snapshot), v_i.subtotal, v_i.modo_cantidad_snapshot)
    returning id into v_item_id;
    insert into public.vinculos_items_posible_pedido values (v_i.id, v_item_id);
  end loop;
  return public.pp_evento(p_id, p_clave_operacion, 'conversion', v_huella, null,
    jsonb_build_object('pedido_id', v_pedido_id, 'direccion_id', p_direccion_id,
      'fecha_efectiva', p_fecha_efectiva, 'metodos_pago', v_metodos));
end;
$$;

-- Propietario y ACL explícitos para TODAS las funciones nuevas, sin tocar tablas.
alter function public.obtener_fechas_posibles_pedidos() owner to postgres;
alter function public.pp_fechas_validas(timestamptz) owner to postgres;
alter function public.pp_huella(jsonb) owner to postgres;
alter function public.pp_normalizar_items(jsonb) owner to postgres;
alter function public.pp_capturar_presentacion(uuid,numeric,boolean) owner to postgres;
alter function public.pp_insertar_linea(uuid,jsonb,integer) owner to postgres;
alter function public.pp_resultado_admin(uuid) owner to postgres;
alter function public.pp_bloquear_admin(uuid,bigint,uuid) owner to postgres;
alter function public.pp_reintento_admin(uuid,uuid,text,bytea) owner to postgres;
alter function public.pp_exigir_abierto(public.posibles_pedidos,bigint) owner to postgres;
alter function public.pp_totales(uuid) owner to postgres;
alter function public.pp_evento(uuid,uuid,text,bytea,text,jsonb) owner to postgres;
alter function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) owner to postgres;
alter function public.editar_posible_pedido_administrativo(uuid,bigint,uuid,jsonb) owner to postgres;
alter function public.autorizar_precio_posible_pedido(uuid,bigint,uuid,uuid,bigint,bigint,text) owner to postgres;
alter function public.asociar_cliente_posible_pedido(uuid,bigint,uuid,uuid) owner to postgres;
alter function public.descartar_posible_pedido(uuid,bigint,uuid,text) owner to postgres;
alter function public.convertir_posible_pedido_administrativo(uuid,bigint,uuid,uuid,date,text[]) owner to postgres;

revoke all on function public.obtener_fechas_posibles_pedidos(), public.pp_fechas_validas(timestamptz), public.pp_huella(jsonb),
  public.pp_normalizar_items(jsonb), public.pp_capturar_presentacion(uuid,numeric,boolean),
  public.pp_insertar_linea(uuid,jsonb,integer), public.pp_resultado_admin(uuid),
  public.pp_bloquear_admin(uuid,bigint,uuid), public.pp_reintento_admin(uuid,uuid,text,bytea),
  public.pp_exigir_abierto(public.posibles_pedidos,bigint), public.pp_totales(uuid),
  public.pp_evento(uuid,uuid,text,bytea,text,jsonb),
  public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text),
  public.editar_posible_pedido_administrativo(uuid,bigint,uuid,jsonb),
  public.autorizar_precio_posible_pedido(uuid,bigint,uuid,uuid,bigint,bigint,text),
  public.asociar_cliente_posible_pedido(uuid,bigint,uuid,uuid), public.descartar_posible_pedido(uuid,bigint,uuid,text),
  public.convertir_posible_pedido_administrativo(uuid,bigint,uuid,uuid,date,text[])
  from public, anon, authenticated, service_role;

grant execute on function public.obtener_fechas_posibles_pedidos() to anon, authenticated, service_role;
grant execute on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) to service_role;
grant execute on function public.editar_posible_pedido_administrativo(uuid,bigint,uuid,jsonb),
  public.autorizar_precio_posible_pedido(uuid,bigint,uuid,uuid,bigint,bigint,text),
  public.asociar_cliente_posible_pedido(uuid,bigint,uuid,uuid), public.descartar_posible_pedido(uuid,bigint,uuid,text),
  public.convertir_posible_pedido_administrativo(uuid,bigint,uuid,uuid,date,text[]) to authenticated;
