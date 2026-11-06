-- Bloque 1, microintegración 1/8: clasificación e infraestructura solamente.
-- No activa reconocimiento al entregar. Ver docs/16-BLOQUE1-MICROINTEGRACION1.md.
-- Requiere todas las migraciones anteriores, incluida 20261105030000.
begin;

-- DEFAULT constante: clasifica filas existentes sin UPDATE ni triggers de fila.
-- Se mantiene legado como fallback conservador para inserciones ajenas a las RPCs.
alter table public.pedidos
  add column regimen_contable text not null default 'legado',
  add constraint pedidos_regimen_contable_valido
    check (regimen_contable in ('legado', 'entrega_v1')),
  -- Alias persistido del importe operativo vigente, también antes de preparar.
  -- No se reescriben total, total_final, pagos ni aplicaciones.
  add column importe_operativo bigint generated always as (coalesce(total_final, total)) stored,
  add column venta_definitiva_snapshot jsonb,
  add column venta_reconocida_en timestamptz,
  -- Barrera explícita de esta fase. Una migración posterior deberá sustituirla
  -- por validación de snapshot completo y escritura transaccional e inmutable.
  add constraint pedidos_venta_definitiva_inactiva
    check (venta_definitiva_snapshot is null and venta_reconocida_en is null);

comment on column public.pedidos.regimen_contable is
  'Clasificación inmutable: legado para pedidos previos/fallback; entrega_v1 para nuevas creaciones oficiales. No activa por sí sola otra contabilidad.';
comment on column public.pedidos.importe_operativo is
  'CLP provisional: coalesce(total_final,total). Alias generado, no cargo adicional ni venta definitiva. Sigue preparación vigente sin cambiarla.';
comment on column public.pedidos.venta_definitiva_snapshot is
  'Reservado e inactivo en microintegración 1/8. Futuro snapshot versionado de líneas efectivamente entregadas, cantidades, precios, totales, despacho, descuento, moneda y actor; no inferir desde preparación.';
comment on column public.pedidos.venta_reconocida_en is
  'Instante real de reconocimiento al confirmar entrega; reservado NULL en fase 1. No es fecha_entrega programada ni fecha_creacion.';

create function public.proteger_regimen_contable_pedido()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.regimen_contable is distinct from old.regimen_contable then
    raise exception 'REGIMEN_CONTABLE_INMUTABLE';
  end if;
  return new;
end;
$$;
alter function public.proteger_regimen_contable_pedido() owner to postgres;
revoke all on function public.proteger_regimen_contable_pedido()
  from public, anon, authenticated, service_role;
create trigger proteger_regimen_contable_pedido_antes_de_actualizar
before update of regimen_contable on public.pedidos
for each row execute function public.proteger_regimen_contable_pedido();

-- Cuerpos vigentes copiados íntegros salvo columna/valor de régimen en INSERT.
-- CREATE OR REPLACE conserva firmas, owner y ACL existentes; no se conceden
-- permisos nuevos. Se conservan retornos tempranos y todos los locks/reintentos.
create or replace function public.crear_pedido_desde_carrito(
  p_cliente_id uuid,
  p_direccion_cliente_id uuid,
  p_items jsonb,
  p_observacion text,
  p_clave_idempotencia uuid,
  p_fecha_entrega date,
  p_metodos_pago_previstos text[]
)
returns table (
  pedido_id uuid,
  numero_pedido text,
  estado public.estado_pedido,
  subtotal bigint,
  costo_entrega bigint,
  descuento bigint,
  total bigint
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_es_admin boolean;
  v_cliente public.clientes%rowtype;
  v_direccion public.direcciones_cliente%rowtype;
  v_pedido public.pedidos%rowtype;
  v_pedido_existente public.pedidos%rowtype;
  v_presentacion record;
  v_item jsonb;
  v_presentacion_id uuid;
  v_cantidad numeric;
  v_texto_presentacion_id text;
  v_presentaciones uuid[] := array[]::uuid[];
  v_subtotal bigint;
  v_costo_entrega bigint;
  v_observacion_normalizada text;
  v_zona_entrega_snapshot text;
  v_hoy_local date;
  v_modo_cantidad_snapshot text;
  v_metodos_pago_previstos text[];
begin
  if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
  if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
  if p_metodos_pago_previstos is null or cardinality(p_metodos_pago_previstos) = 0 then
    raise exception 'METODOS_PAGO_PREVISTOS_REQUERIDOS';
  end if;
  if array_position(p_metodos_pago_previstos, null) is not null
    or not (p_metodos_pago_previstos <@ array['efectivo', 'transferencia', 'tarjeta']::text[])
    or cardinality(p_metodos_pago_previstos) <>
      (case when 'efectivo' = any(p_metodos_pago_previstos) then 1 else 0 end
      + case when 'transferencia' = any(p_metodos_pago_previstos) then 1 else 0 end
      + case when 'tarjeta' = any(p_metodos_pago_previstos) then 1 else 0 end) then
    raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
  end if;
  select array_agg(metodo order by posicion)
  into v_metodos_pago_previstos
  from unnest(array['efectivo', 'transferencia', 'tarjeta']::text[]) with ordinality as metodos(metodo, posicion)
  where metodo = any(p_metodos_pago_previstos);

  v_es_admin := coalesce(public.es_admin(), false);
  select * into v_cliente from public.clientes c where c.id = p_cliente_id and c.activo = true for share;
  if not found then raise exception 'CLIENTE_INVALIDO'; end if;
  if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
  if found then
    if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
    return;
  end if;

  if p_fecha_entrega is null then raise exception 'FECHA_ENTREGA_REQUERIDA'; end if;
  v_hoy_local := (now() at time zone 'America/Santiago')::date;
  if p_fecha_entrega < v_hoy_local or p_fecha_entrega > v_hoy_local + 14 then raise exception 'FECHA_ENTREGA_INVALIDA'; end if;
  if not public.fecha_entrega_disponible(p_fecha_entrega) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
  if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;

  select * into v_direccion from public.direcciones_cliente d where d.id = p_direccion_cliente_id and d.cliente_id = p_cliente_id and d.activa = true and d.ambito = 'personal' for share;
  if not found then raise exception 'DIRECCION_INVALIDA'; end if;
  if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
  select z.nombre into v_zona_entrega_snapshot from public.zonas_entrega z where z.id = v_direccion.zona_entrega_id and z.activa = true for share;
  if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;

  v_observacion_normalizada := nullif(btrim(coalesce(p_observacion, '')), '');
  insert into public.pedidos (
    regimen_contable, cliente_id, canal_origen, estado, nombre_cliente_snapshot, telefono_cliente_snapshot, email_cliente_snapshot,
    direccion_cliente_id, direccion_snapshot, comuna_snapshot, region_snapshot, referencia_direccion_snapshot,
    destinatario_entrega_snapshot, telefono_contacto_entrega_snapshot, zona_entrega_snapshot, latitud_entrega_snapshot, longitud_entrega_snapshot,
    subtotal, costo_entrega, descuento, total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos
  ) values (
    'entrega_v1', p_cliente_id, 'web', 'recibido', v_cliente.nombre, v_cliente.telefono, v_cliente.email,
    p_direccion_cliente_id, v_direccion.direccion, v_direccion.comuna, v_direccion.region, v_direccion.referencia,
    coalesce(v_direccion.destinatario, v_direccion.nombre), v_direccion.telefono_contacto, v_zona_entrega_snapshot, v_direccion.latitud, v_direccion.longitud,
    0, 0, 0, 0, v_observacion_normalizada, p_fecha_entrega, p_clave_idempotencia, v_metodos_pago_previstos
  ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;

  if v_pedido.id is null then
    select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
    if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
    v_texto_presentacion_id := nullif(btrim(v_item ->> 'presentacion_id'), '');
    if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
    if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
    v_presentacion_id := v_texto_presentacion_id::uuid;
    v_cantidad := (v_item ->> 'cantidad')::numeric;
    if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
    v_presentaciones := array_append(v_presentaciones, v_presentacion_id);
    select pp.id, pp.producto_id, pp.nombre as nombre_presentacion, pp.cantidad as cantidad_presentacion, pp.unidad, pp.precio_neto, pp.precio_final, pr.nombre as nombre_producto
    into v_presentacion from public.presentaciones_producto pp join public.productos pr on pr.id = pp.producto_id
    where pp.id = v_presentacion_id and pp.activa = true and pp.es_principal = true and pr.activo = true and pr.disponible = true for share of pp, pr;
    if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
    if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
    v_modo_cantidad_snapshot := case when public.es_presentacion_kg_fraccionable(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion) then 'kg_fraccionable' when lower(coalesce(v_presentacion.nombre_presentacion, '')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada' else 'unidad' end;
    insert into public.items_pedido (pedido_id,producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_neto_unitario_snapshot,precio_final_unitario_snapshot,total_linea,observacion_cliente,modo_cantidad_snapshot)
    values (v_pedido.id,v_presentacion.producto_id,v_presentacion.id,v_presentacion.nombre_producto,v_presentacion.nombre_presentacion,v_presentacion.unidad,v_cantidad,v_presentacion.precio_neto,v_presentacion.precio_final,round(v_cantidad * v_presentacion.precio_final)::bigint,null,v_modo_cantidad_snapshot);
  end loop;

  select coalesce(sum(i.total_linea), 0)::bigint into v_subtotal from public.items_pedido i where i.pedido_id = v_pedido.id;
  v_costo_entrega := case when v_subtotal < 25000 then 2000 else 0 end;
  update public.pedidos set subtotal = v_subtotal, costo_entrega = v_costo_entrega, descuento = 0, total = v_subtotal + v_costo_entrega where id = v_pedido.id returning * into v_pedido;
  return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;
end;
$$;

create or replace function public.convertir_posible_pedido_administrativo(
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
  insert into public.pedidos (regimen_contable, id, cliente_id, canal_origen, estado, nombre_cliente_snapshot,
    telefono_cliente_snapshot, email_cliente_snapshot, direccion_cliente_id,
    direccion_snapshot, comuna_snapshot, region_snapshot, referencia_direccion_snapshot,
    destinatario_entrega_snapshot, telefono_contacto_entrega_snapshot, zona_entrega_snapshot,
    latitud_entrega_snapshot, longitud_entrega_snapshot, subtotal, costo_entrega, descuento,
    total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos)
  values ('entrega_v1', v_pedido_id, v_cliente.id, 'whatsapp', 'recibido', v_cliente.nombre,
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

create or replace function public.crear_pedido_administrativo(
  p_clave_idempotencia uuid,
  p_pedido jsonb
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog set timezone = 'UTC' as $$
declare
  v_actor uuid := auth.uid();
  v_operacion public.creaciones_pedidos_administrativas%rowtype;
  v_cliente public.clientes%rowtype;
  v_direccion public.direcciones_cliente%rowtype;
  v_producto public.productos%rowtype;
  v_presentacion public.presentaciones_producto%rowtype;
  v_pedido public.pedidos%rowtype;
  v_linea jsonb; v_k text; v_tipo text;
  v_cliente_id uuid; v_ubicacion_id uuid; v_producto_id uuid; v_presentacion_id uuid;
  v_ids uuid[] := array[]::uuid[];
  v_fecha date; v_momento timestamptz; v_hoy date;
  v_cantidad numeric; v_referencia numeric; v_precio numeric; v_total_linea numeric; v_total_original numeric;
  v_subtotal numeric := 0; v_despacho bigint;
  v_motivo text; v_modo text; v_zona text; v_nombre_ubicacion text;
  v_item_id uuid; v_huella bytea; v_resultado jsonb;
  v_metodos text[];
  v_capturas jsonb := '[]'::jsonb;
begin
  if v_actor is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
  if jsonb_typeof(p_pedido) is distinct from 'object' then raise exception 'PEDIDO_INVALIDO'; end if;
  if octet_length(p_pedido::text) > 262144 then raise exception 'LIMITE_SOLICITUD'; end if;

  -- Huella SHA-256 más comparación del documento completo (sin depender de
  -- colisiones). jsonb ignora orden de claves; el orden de líneas forma parte
  -- del contrato. No normalizar motivos ni eliminar campos antes de comparar.
  v_huella := sha256(convert_to(p_pedido::text, 'UTF8'));
  perform pg_advisory_xact_lock(hashtextextended(
    'crear_pedido_administrativo:' || p_clave_idempotencia::text, 0));
  select o.* into v_operacion from public.creaciones_pedidos_administrativas o
    where o.clave_idempotencia = p_clave_idempotencia;
  if found then
    if v_operacion.administrador_id is distinct from v_actor
      or v_operacion.huella <> v_huella or v_operacion.solicitud is distinct from p_pedido then
      raise exception 'CLAVE_IDEMPOTENCIA_EN_USO' using errcode = '23505';
    end if;
    -- Comprobante original, aun después de cancelar/preparar o vencer la fecha.
    return v_operacion.resultado;
  end if;

  if (p_pedido - array['clienteId','ubicacionId','lineas','subtotal','fechaEntrega','metodosPagoPrevistos']) <> '{}'::jsonb
    or not (p_pedido ?& array['clienteId','ubicacionId','lineas','subtotal','fechaEntrega','metodosPagoPrevistos']) then
    raise exception 'CAMPOS_PEDIDO_INVALIDOS';
  end if;
  if jsonb_typeof(p_pedido -> 'clienteId') is distinct from 'string'
    or jsonb_typeof(p_pedido -> 'ubicacionId') is distinct from 'string'
    or jsonb_typeof(p_pedido -> 'fechaEntrega') is distinct from 'string'
    or jsonb_typeof(p_pedido -> 'subtotal') is distinct from 'number'
    or jsonb_typeof(p_pedido -> 'lineas') is distinct from 'array'
    or jsonb_typeof(p_pedido -> 'metodosPagoPrevistos') is distinct from 'array' then
    raise exception 'TIPOS_PEDIDO_INVALIDOS';
  end if;
  if (p_pedido ->> 'clienteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (p_pedido ->> 'ubicacionId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (p_pedido ->> 'fechaEntrega') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'REFERENCIAS_PEDIDO_INVALIDAS';
  end if;
  v_cliente_id := (p_pedido ->> 'clienteId')::uuid;
  v_ubicacion_id := (p_pedido ->> 'ubicacionId')::uuid;
  v_fecha := (p_pedido ->> 'fechaEntrega')::date;
  if jsonb_array_length(p_pedido -> 'lineas') not between 1 and 100 then raise exception 'LIMITE_LINEAS'; end if;
  if jsonb_array_length(p_pedido -> 'metodosPagoPrevistos') not between 1 and 3
    or exists (select 1 from jsonb_array_elements(p_pedido -> 'metodosPagoPrevistos') m
      where jsonb_typeof(m) <> 'string') then raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS'; end if;
  select array_agg(m order by m) into v_metodos
    from jsonb_array_elements_text(p_pedido -> 'metodosPagoPrevistos') m;
  if not (v_metodos <@ array['efectivo','transferencia','tarjeta']::text[])
    or (select count(distinct m) from unnest(v_metodos) m) <> cardinality(v_metodos) then
    raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
  end if;
  select array_agg(m order by n) into v_metodos from
    unnest(array['efectivo','transferencia','tarjeta']::text[]) with ordinality x(m,n)
    where m = any(v_metodos);

  -- Orden compatible con gestión comercial: cliente -> dirección -> zona.
  select c.* into v_cliente from public.clientes c where c.id = v_cliente_id for share;
  if not found or not v_cliente.activo then raise exception 'CLIENTE_INVALIDO'; end if;
  select d.* into v_direccion from public.direcciones_cliente d
    where d.id = v_ubicacion_id and d.cliente_id = v_cliente_id and d.ambito = 'comercial' for share;
  if not found or not v_direccion.activa then raise exception 'UBICACION_COMERCIAL_INVALIDA'; end if;
  if v_direccion.latitud is null or v_direccion.longitud is null
    or not (v_direccion.latitud between -90 and 90 and v_direccion.longitud between -180 and 180) then
    raise exception 'UBICACION_SIN_COORDENADAS';
  end if;
  -- También admite ubicaciones comerciales históricas sin nombre_ubicacion.
  v_nombre_ubicacion := coalesce(nullif(btrim(v_direccion.nombre_ubicacion), ''),
    nullif(btrim(v_direccion.nombre), ''), nullif(btrim(v_direccion.direccion), ''));
  if v_nombre_ubicacion is null then raise exception 'NOMBRE_UBICACION_REQUERIDO'; end if;
  if v_direccion.zona_entrega_id is not null then
    select z.nombre into v_zona from public.zonas_entrega z
      where z.id = v_direccion.zona_entrega_id and z.activa for share;
    if not found then raise exception 'ZONA_INVALIDA'; end if;
  end if;

  -- Orden determinista de productos antes de presentaciones, como el editor.
  -- Los UUID se validan/castean aquí y se vuelve a comprobar toda la relación
  -- bajo locks antes de capturar precios. No se exige es_principal en admin.
  perform pr.id from public.productos pr where pr.id in
    (select (l ->> 'productoId')::uuid from jsonb_array_elements(p_pedido -> 'lineas') l)
    order by pr.id for share;
  for v_linea in select value from jsonb_array_elements(p_pedido -> 'lineas')
    order by value ->> 'presentacionId' loop
    if jsonb_typeof(v_linea) is distinct from 'object'
      or (v_linea - array['productoId','presentacionId','cantidad','precioReferencia','totalFinal','motivoAjuste','totalOriginal']) <> '{}'::jsonb
      or not (v_linea ?& array['productoId','presentacionId','cantidad','precioReferencia','totalFinal','motivoAjuste','totalOriginal']) then
      raise exception 'CAMPOS_LINEA_INVALIDOS';
    end if;
    for v_k, v_tipo in select key, jsonb_typeof(value) from jsonb_each(v_linea) loop
      if (v_k in ('productoId','presentacionId') and v_tipo <> 'string')
        or (v_k in ('cantidad','precioReferencia','totalFinal','totalOriginal') and v_tipo <> 'number')
        or (v_k = 'motivoAjuste' and v_tipo not in ('string','null')) then
        raise exception 'TIPOS_LINEA_INVALIDOS';
      end if;
    end loop;
    v_producto_id := (v_linea ->> 'productoId')::uuid;
    v_presentacion_id := (v_linea ->> 'presentacionId')::uuid;
    if v_producto_id is null or v_presentacion_id is null then raise exception 'REFERENCIAS_LINEA_INVALIDAS'; end if;
    if v_presentacion_id = any(v_ids) then raise exception 'PRESENTACION_DUPLICADA'; end if;
    v_ids := array_append(v_ids, v_presentacion_id);
    v_cantidad := (v_linea ->> 'cantidad')::numeric;
    v_referencia := (v_linea ->> 'precioReferencia')::numeric;
    v_precio := (v_linea ->> 'totalFinal')::numeric;
    v_motivo := nullif(btrim(v_linea ->> 'motivoAjuste'), '');
    -- Barreras técnicas, no límites de stock. Inferiores a numeric(12,3),
    -- bigint y Number.MAX_SAFE_INTEGER; calcular en numeric antes de castear.
    if not (v_cantidad > 0 and v_cantidad <= 100000)
      or not (v_referencia > 0 and v_referencia <= 9000000000000 and v_referencia = trunc(v_referencia))
      or not (v_precio >= 0 and v_precio <= 9000000000000 and v_precio = trunc(v_precio))
      or length(coalesce(v_linea ->> 'motivoAjuste','')) > 1000 then raise exception 'CANTIDAD_O_PRECIO_INVALIDO'; end if;
    select pr.* into v_producto from public.productos pr where pr.id = v_producto_id for share;
    if not found or not v_producto.activo or not v_producto.disponible then raise exception 'PRODUCTO_NO_DISPONIBLE'; end if;
    select pp.* into v_presentacion from public.presentaciones_producto pp where pp.id = v_presentacion_id for share;
    if not found or not v_presentacion.activa or v_presentacion.producto_id <> v_producto.id then
      raise exception 'PRESENTACION_NO_DISPONIBLE';
    end if;
    perform 1 from public.categorias c where c.id = v_producto.categoria_id and c.activa for share;
    if not found then raise exception 'CATEGORIA_NO_DISPONIBLE'; end if;
    if v_presentacion.precio_final <> v_referencia then raise exception 'PRECIO_REFERENCIA_DESACTUALIZADO' using errcode = '40001'; end if;
    if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad,
      v_presentacion.nombre, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
    -- El único redondeo es el original de catálogo, igual al checkout.
    -- El total solicitado se conserva exactamente; nunca se divide por cantidad.
    v_total_original := round(v_cantidad * v_referencia);
    v_total_linea := v_precio;
    if v_total_original > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
    if (v_linea ->> 'totalOriginal')::numeric <> v_total_original then raise exception 'TOTAL_ORIGINAL_INCORRECTO'; end if;
    if v_total_linea <> v_total_original and v_motivo is null then raise exception 'MOTIVO_PRECIO_REQUERIDO'; end if;
    if v_total_linea = v_total_original and v_linea -> 'motivoAjuste' <> 'null'::jsonb then raise exception 'MOTIVO_SIN_AJUSTE'; end if;
    if v_total_linea > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
    v_subtotal := v_subtotal + v_total_linea;
    if v_subtotal > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
    v_modo := case when public.es_presentacion_kg_fraccionable(v_presentacion.unidad,
      v_presentacion.cantidad, v_presentacion.nombre) then 'kg_fraccionable'
      when lower(v_presentacion.nombre) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada' else 'unidad' end;
    v_capturas := v_capturas || jsonb_build_array(jsonb_build_object(
      'producto', v_producto.id, 'presentacion', v_presentacion.id,
      'nombre_producto', v_producto.nombre, 'nombre_presentacion', v_presentacion.nombre,
      'unidad', v_presentacion.unidad, 'cantidad', v_cantidad, 'modo', v_modo,
      -- Neto de catálogo como referencia histórica; no inventar una tasa fiscal
      -- ni neto autorizado que PedidoBorrador no contiene.
      'neto', v_presentacion.precio_neto, 'referencia', v_referencia,
      'original', v_total_original, 'total', v_total_linea, 'motivo', v_motivo));
  end loop;
  if (p_pedido ->> 'subtotal')::numeric <> v_subtotal then raise exception 'SUBTOTAL_INCORRECTO'; end if;
  v_despacho := case when v_subtotal < 25000 then 2000 else 0 end;

  -- Revalidar el corte DESPUÉS de las esperas por locks. Configuración bloqueada
  -- hasta el commit; fecha local, horizonte 14 días y corte exclusivo vigentes.
  perform d.id from public.dias_entrega d order by d.dia_semana for share;
  v_momento := clock_timestamp();
  v_hoy := (v_momento at time zone 'America/Santiago')::date;
  if not isfinite(v_fecha) or v_fecha < v_hoy or v_fecha > v_hoy + 14
    or not public.fecha_entrega_disponible(v_fecha, v_momento) then
    raise exception 'FECHA_ENTREGA_NO_DISPONIBLE';
  end if;

  insert into public.pedidos (regimen_contable, cliente_id, canal_origen, estado,
    nombre_cliente_snapshot, telefono_cliente_snapshot, email_cliente_snapshot,
    direccion_cliente_id, nombre_ubicacion_snapshot, direccion_snapshot, comuna_snapshot,
    region_snapshot, referencia_direccion_snapshot, destinatario_entrega_snapshot,
    telefono_contacto_entrega_snapshot, zona_entrega_snapshot, latitud_entrega_snapshot,
    longitud_entrega_snapshot, subtotal, costo_entrega, descuento, total,
    fecha_entrega, metodos_pago_previstos)
  values ('entrega_v1', v_cliente.id, 'manual', 'recibido', v_cliente.nombre, v_cliente.telefono, v_cliente.email,
    v_direccion.id, v_nombre_ubicacion, coalesce(v_direccion.direccion, v_nombre_ubicacion),
    v_direccion.comuna, v_direccion.region, v_direccion.referencia,
    coalesce(v_direccion.destinatario, v_direccion.nombre, v_cliente.nombre),
    coalesce(v_direccion.telefono_contacto, v_cliente.telefono), v_zona,
    v_direccion.latitud, v_direccion.longitud, v_subtotal::bigint, v_despacho, 0,
    v_subtotal::bigint + v_despacho, v_fecha, v_metodos) returning * into v_pedido;
  for v_linea in select value from jsonb_array_elements(v_capturas) loop
    insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id,
      nombre_producto_snapshot, nombre_presentacion_snapshot, unidad_snapshot, cantidad,
      precio_neto_unitario_snapshot, precio_final_unitario_snapshot, total_linea, modo_cantidad_snapshot, total_final_administrativo)
    values (v_pedido.id, (v_linea ->> 'producto')::uuid, (v_linea ->> 'presentacion')::uuid,
      v_linea ->> 'nombre_producto', v_linea ->> 'nombre_presentacion', v_linea ->> 'unidad',
      (v_linea ->> 'cantidad')::numeric, (v_linea ->> 'neto')::bigint,
      (v_linea ->> 'referencia')::bigint, (v_linea ->> 'total')::bigint, v_linea ->> 'modo',
      case when (v_linea ->> 'total')::bigint <> (v_linea ->> 'original')::bigint
        then (v_linea ->> 'total')::bigint end)
    returning id into v_item_id;
    if (v_linea ->> 'total')::bigint <> (v_linea ->> 'original')::bigint then
      insert into public.auditoria_precios_pedido_administrativo
        (item_pedido_id, precio_referencia, precio_aplicado, total_original, total_aplicado, motivo, administrador_id)
      values (v_item_id, (v_linea ->> 'referencia')::bigint,
        null, (v_linea ->> 'original')::bigint, (v_linea ->> 'total')::bigint, v_linea ->> 'motivo', v_actor);
    end if;
  end loop;
  -- Las vistas vigentes generan el único cargo desde pedidos; no insertar
  -- ajustes, pagos ni aplicaciones. Los triggers existentes generan historial.
  v_resultado := jsonb_build_object('pedido_id', v_pedido.id, 'numero_pedido', v_pedido.numero_pedido,
    'estado', v_pedido.estado, 'subtotal', v_pedido.subtotal, 'costo_entrega', v_pedido.costo_entrega,
    'descuento', v_pedido.descuento, 'total', v_pedido.total);
  insert into public.creaciones_pedidos_administrativas
    (clave_idempotencia, administrador_id, pedido_id, huella, solicitud, resultado)
  values (p_clave_idempotencia, v_actor, v_pedido.id, v_huella, p_pedido, v_resultado);
  return v_resultado;
end;
$$;

-- No se reemplazan vistas, preparación, despacho, entrega ni beneficios.
commit;
