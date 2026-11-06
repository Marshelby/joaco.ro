-- Microintegración 5/6. Incremental sobre 20261105020000 YA ejecutada.
-- Los snapshots unitarios siguen representando catálogo. NULL conserva la regla
-- histórica; un total administrativo explícito autoriza el importe exacto.
begin;
set local lock_timeout = '5s';
set local search_path = pg_catalog;

alter table public.items_pedido add column total_final_administrativo bigint
  check (total_final_administrativo is null or
    (total_final_administrativo >= 0 and total_final_administrativo = total_linea));
comment on column public.items_pedido.total_final_administrativo is
  'Total exacto autorizado por línea; no es precio unitario. NULL mantiene contrato histórico.';

create or replace function public.validar_total_linea_pedido()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if new.total_linea <> coalesce(new.total_final_administrativo,
    round(new.cantidad * new.precio_final_unitario_snapshot)::bigint) then
    raise exception 'TOTAL_LINEA_INCORRECTO';
  end if;
  return new;
end;
$$;
-- Incluir la nueva columna en la validación de actualizaciones.
drop trigger validar_total_linea_pedido_antes_de_guardar on public.items_pedido;
create trigger validar_total_linea_pedido_antes_de_guardar
before insert or update of cantidad, precio_final_unitario_snapshot, total_linea, total_final_administrativo
on public.items_pedido for each row execute function public.validar_total_linea_pedido();

-- No reescribir filas históricas ni su auditoría inmutable. Los importes
-- unitarios históricos conservan significado; nuevos ajustes usan totales.
alter table public.auditoria_precios_pedido_administrativo
  alter column precio_aplicado drop not null,
  add column total_original bigint,
  add column total_aplicado bigint,
  add constraint auditoria_precio_formato check (
    (precio_aplicado is not null and total_original is null and total_aplicado is null)
    or (precio_aplicado is null and total_original is not null and total_aplicado is not null
      and total_original >= 0 and total_aplicado >= 0 and total_original <> total_aplicado)
  );
-- El CHECK histórico precio_referencia <> precio_aplicado sigue validando
-- filas unitarias; NULL habilita el formato total sujeto al CHECK anterior.

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

  insert into public.pedidos (cliente_id, canal_origen, estado,
    nombre_cliente_snapshot, telefono_cliente_snapshot, email_cliente_snapshot,
    direccion_cliente_id, nombre_ubicacion_snapshot, direccion_snapshot, comuna_snapshot,
    region_snapshot, referencia_direccion_snapshot, destinatario_entrega_snapshot,
    telefono_contacto_entrega_snapshot, zona_entrega_snapshot, latitud_entrega_snapshot,
    longitud_entrega_snapshot, subtotal, costo_entrega, descuento, total,
    fecha_entrega, metodos_pago_previstos)
  values (v_cliente.id, 'manual', 'recibido', v_cliente.nombre, v_cliente.telefono, v_cliente.email,
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
alter function public.crear_pedido_administrativo(uuid,jsonb) owner to postgres;
revoke all on function public.crear_pedido_administrativo(uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.crear_pedido_administrativo(uuid,jsonb) to authenticated;


-- Compatibilidad contable al finalizar preparación: conservar total autorizado.
create or replace function public.finalizar_preparacion_pedido_administrativo(p_pedido_id uuid)
returns table (
  pedido_id uuid,
  estado public.estado_pedido,
  preparacion_estado text,
  subtotal_final bigint,
  total_final bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_item public.items_pedido%rowtype;
  v_preparada numeric;
  v_modo text;
  v_subtotal bigint := 0;
  v_total bigint;
  v_completa boolean := true;
  v_aplicado bigint := 0;
  v_exceso bigint := 0;
  v_aplicacion public.aplicaciones_pago%rowtype;
  v_conservar bigint;
  v_lineas_faltantes integer := 0;
  v_observacion text;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;

  if v_pedido.estado = 'listo_despacho'
    and v_pedido.preparacion_estado in ('completa', 'incompleta')
    and v_pedido.preparacion_finalizada_en is not null
    and v_pedido.subtotal_final is not null
    and v_pedido.total_final is not null then
    return query select v_pedido.id, v_pedido.estado, v_pedido.preparacion_estado, v_pedido.subtotal_final, v_pedido.total_final;
    return;
  end if;
  if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  perform 1 from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id for update;
  perform 1 from public.preparacion_items_pedido pi where pi.pedido_id = v_pedido.id order by pi.item_pedido_id for update;

  for v_item in select * from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id loop
    select pi.cantidad_preparada into v_preparada from public.preparacion_items_pedido pi where pi.item_pedido_id = v_item.id;
    v_preparada := coalesce(v_preparada, v_item.cantidad);
    if v_preparada < 0 or v_preparada > v_item.cantidad then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
    v_modo := coalesce(v_item.modo_cantidad_snapshot, case
      when upper(btrim(v_item.unidad_snapshot)) = 'KG' and lower(coalesce(v_item.nombre_presentacion_snapshot, '')) !~ '(saco|malla|caja|paquete|docena)' then 'kg_fraccionable'
      when lower(coalesce(v_item.nombre_presentacion_snapshot, '')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
      else 'unidad' end);
    if v_modo in ('presentacion_cerrada', 'unidad') and v_preparada <> trunc(v_preparada) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
    if v_item.total_final_administrativo is not null then
      -- No existe política autorizada para prorratear un total arbitrario.
      -- Fallar antes de modificar totales o aplicaciones de pago.
      if v_preparada <> v_item.cantidad then
        raise exception 'TOTAL_ADMINISTRATIVO_REQUIERE_PREPARACION_COMPLETA';
      end if;
      v_subtotal := v_subtotal + v_item.total_linea;
    else
      v_subtotal := v_subtotal + round(v_preparada * v_item.precio_final_unitario_snapshot)::bigint;
    end if;
    if v_preparada < v_item.cantidad then v_completa := false; v_lineas_faltantes := v_lineas_faltantes + 1; end if;
  end loop;

  v_total := v_subtotal + v_pedido.costo_entrega - v_pedido.descuento;
  if v_total < 0 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
  if v_completa and (v_subtotal <> v_pedido.subtotal or v_total <> v_pedido.total) then raise exception 'PREPARACION_COMPLETA_INCONSISTENTE'; end if;

  -- El nuevo límite debe estar visible para el trigger al recrear aplicaciones activas.
  update public.pedidos set subtotal_final = v_subtotal, total_final = v_total where id = v_pedido.id;

  perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc for update;
  perform 1 from public.pagos p where p.id in (select a.pago_id from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa) order by p.id for update;
  select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
  v_exceso := greatest(v_aplicado - v_total, 0);

  for v_aplicacion in select * from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc loop
    exit when v_exceso = 0;
    v_conservar := greatest(v_aplicacion.monto_aplicado - v_exceso, 0);
    update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = 'Reajuste por preparación incompleta' where id = v_aplicacion.id;
    if v_conservar > 0 then
      insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_aplicacion.pago_id, v_pedido.id, v_conservar);
    end if;
    v_exceso := greatest(v_exceso - v_aplicacion.monto_aplicado, 0);
  end loop;

  select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
  if v_aplicado > v_total then raise exception 'APLICACIONES_SUPERAN_TOTAL_FINAL'; end if;

  update public.pedidos
  set preparacion_estado = case when v_completa then 'completa' else 'incompleta' end,
      preparacion_finalizada_en = now(), preparacion_finalizada_por = auth.uid(), estado = 'listo_despacho'
  where id = v_pedido.id;
  v_observacion := case when v_completa then 'Preparación finalizada completa' else format('Preparación finalizada incompleta: %s líneas con faltantes', v_lineas_faltantes) end;
  update public.historial_estados_pedido set observacion = v_observacion
  where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'listo_despacho' order by h.fecha_creacion desc, h.id desc limit 1);
  return query select v_pedido.id, 'listo_despacho'::public.estado_pedido, case when v_completa then 'completa' else 'incompleta' end, v_subtotal, v_total;
end;
$$;

alter function public.finalizar_preparacion_pedido_administrativo(uuid) owner to postgres;
revoke all on function public.finalizar_preparacion_pedido_administrativo(uuid) from public, anon, authenticated;
grant execute on function public.finalizar_preparacion_pedido_administrativo(uuid) to authenticated;


commit;
