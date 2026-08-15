alter table public.pedidos
  add column destinatario_entrega_snapshot text,
  add column telefono_contacto_entrega_snapshot text,
  add column zona_entrega_snapshot text,
  add column latitud_entrega_snapshot numeric(9,6),
  add column longitud_entrega_snapshot numeric(9,6),
  add constraint pedidos_latitud_entrega_snapshot_valida check (latitud_entrega_snapshot is null or latitud_entrega_snapshot between -90 and 90),
  add constraint pedidos_longitud_entrega_snapshot_valida check (longitud_entrega_snapshot is null or longitud_entrega_snapshot between -180 and 180);

create or replace function public.crear_pedido_desde_carrito(
  p_cliente_id uuid,
  p_direccion_cliente_id uuid,
  p_items jsonb,
  p_observacion text,
  p_clave_idempotencia uuid
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
set search_path = public
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
  v_observacion_normalizada text;
  v_zona_entrega_snapshot text;
begin
  if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
  if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;

  v_es_admin := public.es_admin();
  select * into v_cliente from public.clientes c where c.id = p_cliente_id and c.activo = true;
  if not found then raise exception 'CLIENTE_INVALIDO'; end if;
  if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
  if found then
    if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
    return;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
  if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;

  select * into v_direccion from public.direcciones_cliente d
  where d.id = p_direccion_cliente_id and d.cliente_id = p_cliente_id and d.activa = true;
  if not found then raise exception 'DIRECCION_INVALIDA'; end if;
  if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;

  select z.nombre into v_zona_entrega_snapshot from public.zonas_entrega z
  where z.id = v_direccion.zona_entrega_id and z.activa = true;
  if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;

  v_observacion_normalizada := nullif(btrim(coalesce(p_observacion, '')), '');
  insert into public.pedidos (
    cliente_id, canal_origen, estado, nombre_cliente_snapshot, telefono_cliente_snapshot, email_cliente_snapshot,
    direccion_cliente_id, direccion_snapshot, comuna_snapshot, region_snapshot, referencia_direccion_snapshot,
    destinatario_entrega_snapshot, telefono_contacto_entrega_snapshot, zona_entrega_snapshot, latitud_entrega_snapshot, longitud_entrega_snapshot,
    subtotal, costo_entrega, descuento, total, observacion_general, fecha_entrega, clave_idempotencia
  ) values (
    p_cliente_id, 'web', 'recibido', v_cliente.nombre, v_cliente.telefono, v_cliente.email,
    p_direccion_cliente_id, v_direccion.direccion, v_direccion.comuna, v_direccion.region, v_direccion.referencia,
    coalesce(v_direccion.destinatario, v_direccion.nombre), v_direccion.telefono_contacto, v_zona_entrega_snapshot, v_direccion.latitud, v_direccion.longitud,
    0, 0, 0, 0, v_observacion_normalizada, null, p_clave_idempotencia
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
    where pp.id = v_presentacion_id and pp.activa = true and pp.es_principal = true and pr.activo = true and pr.disponible = true
    for share of pp, pr;
    if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
    if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;

    insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id, nombre_producto_snapshot, nombre_presentacion_snapshot, unidad_snapshot, cantidad, precio_neto_unitario_snapshot, precio_final_unitario_snapshot, total_linea, observacion_cliente)
    values (v_pedido.id, v_presentacion.producto_id, v_presentacion.id, v_presentacion.nombre_producto, v_presentacion.nombre_presentacion, v_presentacion.unidad, v_cantidad, v_presentacion.precio_neto, v_presentacion.precio_final, round(v_cantidad * v_presentacion.precio_final)::bigint, null);
  end loop;

  select coalesce(sum(i.total_linea), 0)::bigint into v_subtotal from public.items_pedido i where i.pedido_id = v_pedido.id;
  update public.pedidos set subtotal = v_subtotal, costo_entrega = 0, descuento = 0, total = v_subtotal where id = v_pedido.id returning * into v_pedido;
  return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;
end;
$$;

revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) to authenticated;
