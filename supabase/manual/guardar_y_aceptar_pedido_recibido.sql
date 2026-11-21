-- Aplicación manual. Requiere el contrato vigente de totales administrativos
-- por línea (20261105030000) y las tablas operativas y contables vigentes.
begin;

create or replace function public.guardar_y_aceptar_pedido_recibido(
  p_pedido_id uuid, p_version timestamptz, p_pedido jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor uuid := auth.uid();
  pedido public.pedidos%rowtype;
  cliente public.clientes%rowtype;
  direccion public.direcciones_cliente%rowtype;
  item public.items_pedido%rowtype;
  linea record;
  catalogo record;
  item_id uuid;
  ids_conservados uuid[];
  cantidad_lineas integer;
  cliente_id_original uuid;
  cliente_id_nuevo uuid;
  direccion_id_nueva uuid;
  cambiar_cliente boolean;
  cambiar_ubicacion boolean;
  cambiar_lineas boolean := false;
  fecha date;
  metodos text[];
  momento timestamptz;
  hoy date;
  nombre_ubicacion text;
  zona text;
  modo text;
  referencia bigint;
  total_original numeric;
  motivo text;
  subtotal_nuevo numeric;
  despacho bigint;
  total_nuevo numeric;
  limite constant bigint := 9000000000000;
begin
  if actor is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if jsonb_typeof(p_pedido) is distinct from 'object'
    or octet_length(p_pedido::text) > 262144
    or not (p_pedido ?& array['clienteId', 'ubicacionId', 'fechaEntrega', 'metodosPagoPrevistos', 'lineas',
      'subtotal', 'costoEntrega', 'total'])
    or jsonb_typeof(p_pedido -> 'clienteId') not in ('string', 'null')
    or jsonb_typeof(p_pedido -> 'ubicacionId') not in ('string', 'null')
    or jsonb_typeof(p_pedido -> 'fechaEntrega') not in ('string', 'null')
    or jsonb_typeof(p_pedido -> 'subtotal') is distinct from 'number'
    or jsonb_typeof(p_pedido -> 'costoEntrega') is distinct from 'number'
    or jsonb_typeof(p_pedido -> 'total') is distinct from 'number'
    or jsonb_typeof(p_pedido -> 'lineas') is distinct from 'array'
    or jsonb_typeof(p_pedido -> 'metodosPagoPrevistos') is distinct from 'array' then
    raise exception 'ENTREGA_INVALIDA';
  end if;

  if (p_pedido ->> 'fechaEntrega') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or exists (select 1 from jsonb_array_elements(p_pedido -> 'metodosPagoPrevistos') m
      where jsonb_typeof(m) is distinct from 'string') then
    raise exception 'ENTREGA_INVALIDA';
  end if;

  cliente_id_nuevo := (p_pedido ->> 'clienteId')::uuid;
  direccion_id_nueva := (p_pedido ->> 'ubicacionId')::uuid;
  fecha := (p_pedido ->> 'fechaEntrega')::date;

  -- Pagos y entrega toman primero el cliente. Si cambia el titular,
  -- proteger ambos clientes en el mismo orden antes de bloquear el pedido.
  select p.cliente_id into cliente_id_original from public.pedidos p where p.id = p_pedido_id;
  perform c.id from public.clientes c
    where c.id in (cliente_id_original, cliente_id_nuevo) order by c.id for share;
  select p.* into pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found or pedido.estado <> 'recibido' or pedido.fecha_actualizacion is distinct from p_version
    or pedido.cliente_id is distinct from cliente_id_original then
    raise exception 'PEDIDO_MODIFICADO';
  end if;

  cambiar_cliente := cliente_id_nuevo is distinct from pedido.cliente_id;
  cambiar_ubicacion := cambiar_cliente or direccion_id_nueva is distinct from pedido.direccion_cliente_id;
  select array_agg(m.valor order by m.orden) into metodos
    from jsonb_array_elements_text(p_pedido -> 'metodosPagoPrevistos') with ordinality m(valor, orden);
  if metodos is distinct from pedido.metodos_pago_previstos then
    if metodos @> pedido.metodos_pago_previstos and metodos <@ pedido.metodos_pago_previstos
      and cardinality(metodos) = cardinality(pedido.metodos_pago_previstos) then
      metodos := pedido.metodos_pago_previstos;
    elsif metodos is null or cardinality(metodos) not between 1 and 3
      or array_position(metodos, null) is not null
      or not (metodos <@ array['efectivo', 'transferencia', 'tarjeta']::text[])
      or cardinality(metodos) <> (select count(distinct m) from unnest(metodos) m) then
      raise exception 'ENTREGA_INVALIDA';
    end if;
  end if;

  perform i.id from public.items_pedido i where i.pedido_id = pedido.id order by i.id for update;
  cantidad_lineas := jsonb_array_length(p_pedido -> 'lineas');
  if cantidad_lineas not between 1 and 100 or exists (
    select 1 from jsonb_array_elements(p_pedido -> 'lineas') l
    where jsonb_typeof(l) is distinct from 'object'
      or not (l ? 'itemId')
      or jsonb_typeof(l -> 'itemId') not in ('string', 'null')
  ) then raise exception 'LINEAS_INVALIDAS'; end if;
  select coalesce(array_agg((l ->> 'itemId')::uuid), array[]::uuid[]) into ids_conservados
    from jsonb_array_elements(p_pedido -> 'lineas') l where l ->> 'itemId' is not null;
  if (select count(*) from public.items_pedido i where i.pedido_id = pedido.id and i.id = any(ids_conservados))
     <> cardinality(ids_conservados) then
    raise exception 'LINEAS_INVALIDAS';
  end if;

  if not cambiar_ubicacion and fecha is not distinct from pedido.fecha_entrega
    and metodos is not distinct from pedido.metodos_pago_previstos
    and cantidad_lineas = (select count(*) from public.items_pedido i where i.pedido_id = pedido.id)
    and not exists (
      select 1 from jsonb_array_elements(p_pedido -> 'lineas') l
      where l ->> 'itemId' is null or l <> jsonb_build_object('itemId', l ->> 'itemId')
    ) then
    if pedido.subtotal is distinct from (p_pedido ->> 'subtotal')::numeric
      or pedido.costo_entrega is distinct from (p_pedido ->> 'costoEntrega')::numeric
      or pedido.total is distinct from (p_pedido ->> 'total')::numeric then
      raise exception 'TOTALES_INVALIDOS';
    end if;
    perform public.aceptar_pedido_administrativo(pedido.id);
    return;
  end if;

  if pedido.venta_reconocida_en is not null or pedido.total_final is not null
    or pedido.preparacion_finalizada_en is not null or pedido.total_operativo_preparacion is not null
    or exists (select 1 from public.aplicaciones_pago a where a.pedido_id = pedido.id)
    or exists (select 1 from public.preparacion_items_pedido i where i.pedido_id = pedido.id)
    or exists (select 1 from public.paradas_ruta r where r.pedido_id = pedido.id)
    or exists (select 1 from operativo_privado.carga_pedidos c where c.pedido_id = pedido.id)
    or exists (select 1 from operativo_privado.entregas_definitivas e where e.pedido_id = pedido.id)
    or (cambiar_cliente and (
      exists (select 1 from public.mensajes_conversacion m where m.pedido_id = pedido.id)
      or exists (select 1 from public.posibles_pedidos p where p.pedido_oficial_id = pedido.id)
      or exists (select 1 from public.cupones_cliente c where c.pedido_usado_id = pedido.id)
      or exists (select 1 from public.beneficios_stacks b where b.pedido_id = pedido.id)
    )) then
    raise exception 'PEDIDO_CON_REFERENCIAS';
  end if;

  -- Rutas múltiples se instala por separado del esquema base.
  if to_regclass('operativo_privado.ruta_multi_pedidos') is not null then
    if exists (select 1 from operativo_privado.ruta_multi_pedidos m where m.pedido_id = pedido.id) then
      raise exception 'PEDIDO_CON_REFERENCIAS';
    end if;
  end if;

  if cambiar_ubicacion then
    select c.* into cliente from public.clientes c where c.id = cliente_id_nuevo and c.activo;
    if not found then raise exception 'CLIENTE_INVALIDO'; end if;
    select d.* into direccion from public.direcciones_cliente d
      where d.id = direccion_id_nueva and d.cliente_id = cliente.id and d.activa
        and d.ambito = 'comercial' for share;
    if not found or direccion.latitud is null or direccion.longitud is null
      or not (direccion.latitud between -90 and 90 and direccion.longitud between -180 and 180) then
      raise exception 'UBICACION_COMERCIAL_INVALIDA';
    end if;
    nombre_ubicacion := coalesce(nullif(btrim(direccion.nombre_ubicacion), ''),
      nullif(btrim(direccion.nombre), ''), nullif(btrim(direccion.direccion), ''));
    if nombre_ubicacion is null then raise exception 'UBICACION_COMERCIAL_INVALIDA'; end if;
    if (cambiar_cliente and cliente.nombre is distinct from (p_pedido ->> 'clienteNombre'))
      or concat_ws(' · ', nombre_ubicacion, nullif(coalesce(direccion.direccion, nombre_ubicacion), ''),
        nullif(direccion.comuna, ''), nullif(direccion.region, ''))
        is distinct from (p_pedido ->> 'ubicacionResumen') then
      raise exception 'DATOS_ENTREGA_MODIFICADOS';
    end if;
    if direccion.zona_entrega_id is not null then
      select z.nombre into zona from public.zonas_entrega z
        where z.id = direccion.zona_entrega_id and z.activa for share;
      if not found then raise exception 'UBICACION_COMERCIAL_INVALIDA'; end if;
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_pedido -> 'lineas') l
    where (l ->> 'itemId' is null or l is distinct from jsonb_build_object('itemId', l ->> 'itemId'))
        and (not (l ?& array['productoId', 'presentacionId', 'cantidad', 'precioReferencia', 'totalOriginal', 'totalFinal', 'motivoAjuste'])
          or jsonb_typeof(l -> 'productoId') not in ('string', 'null')
          or jsonb_typeof(l -> 'presentacionId') not in ('string', 'null')
          or jsonb_typeof(l -> 'cantidad') is distinct from 'number'
          or jsonb_typeof(l -> 'precioReferencia') is distinct from 'number'
          or jsonb_typeof(l -> 'totalOriginal') is distinct from 'number'
          or jsonb_typeof(l -> 'totalFinal') is distinct from 'number'
          or jsonb_typeof(l -> 'motivoAjuste') not in ('null', 'string'))
  ) then raise exception 'LINEAS_INVALIDAS'; end if;
  if exists (
    select 1 from public.items_pedido i
    where i.pedido_id = pedido.id
      and (not (i.id = any(ids_conservados)) or exists (
        select 1 from jsonb_array_elements(p_pedido -> 'lineas') l
        where (l ->> 'itemId')::uuid = i.id and l ? 'cantidad'
      ))
      and (exists (select 1 from public.auditoria_precios_pedido_administrativo a where a.item_pedido_id = i.id)
        or exists (select 1 from public.vinculos_items_posible_pedido v where v.item_pedido_id = i.id))
  ) then raise exception 'LINEA_CON_HISTORIAL'; end if;

  -- Igual que el creador: bloquear los productos antes de las presentaciones.
  perform pr.id from public.productos pr where pr.id in (
    select (l ->> 'productoId')::uuid from jsonb_array_elements(p_pedido -> 'lineas') l
      where l ->> 'itemId' is null
  ) order by pr.id for share;

  delete from public.items_pedido i where i.pedido_id = pedido.id and not (i.id = any(ids_conservados));
  cambiar_lineas := found;
  for linea in
    select l.* from jsonb_to_recordset(p_pedido -> 'lineas') as l(
      "itemId" uuid, "productoId" uuid, "presentacionId" uuid, cantidad numeric,
      "precioReferencia" numeric, "totalOriginal" numeric, "totalFinal" numeric, "motivoAjuste" text
    )
    order by l."presentacionId", l."itemId"
  loop
    if linea."itemId" is not null then
      if linea.cantidad is null then continue; end if;
      select i.* into strict item from public.items_pedido i where i.id = linea."itemId";
      if linea."productoId" is distinct from item.producto_id
        or linea."presentacionId" is distinct from item.presentacion_producto_id then
        raise exception 'LINEAS_INVALIDAS';
      end if;
      referencia := item.precio_final_unitario_snapshot;
      modo := coalesce(item.modo_cantidad_snapshot, case
        when lower(coalesce(item.nombre_presentacion_snapshot, '')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
        when upper(btrim(item.unidad_snapshot)) = 'KG' then 'kg_fraccionable'
        else 'unidad' end);
      if linea.cantidad is distinct from item.cantidad
        and not public.es_cantidad_pedido_valida(
          case when modo = 'kg_fraccionable' then 'KG' else 'UN' end, 1, '', linea.cantidad
        ) then raise exception 'LINEAS_INVALIDAS'; end if;
    else
      select pr.nombre as producto, pp.nombre as presentacion, pp.unidad, pp.cantidad,
        pp.precio_neto, pp.precio_final into catalogo
      from public.productos pr
      join public.categorias c on c.id = pr.categoria_id and c.activa
      join public.presentaciones_producto pp on pp.producto_id = pr.id and pp.activa
      where pr.id = linea."productoId" and pr.activo and pr.disponible and pp.id = linea."presentacionId"
      for share of pr, c, pp;
      if not found or catalogo.precio_final <= 0
        or not public.es_cantidad_pedido_valida(catalogo.unidad, catalogo.cantidad, catalogo.presentacion, linea.cantidad)
        or exists (select 1 from public.items_pedido i where i.pedido_id = pedido.id
          and i.presentacion_producto_id = linea."presentacionId") then
        raise exception 'LINEAS_INVALIDAS';
      end if;
      referencia := catalogo.precio_final;
      if linea."precioReferencia" is distinct from referencia then
        raise exception 'PRECIO_REFERENCIA_DESACTUALIZADO';
      end if;
      modo := case
        when public.es_presentacion_kg_fraccionable(catalogo.unidad, catalogo.cantidad, catalogo.presentacion) then 'kg_fraccionable'
        when lower(catalogo.presentacion) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
        else 'unidad' end;
    end if;

    total_original := round(linea.cantidad * referencia);
    motivo := nullif(btrim(linea."motivoAjuste"), '');
    if linea.cantidad is null or linea.cantidad not between 0.001 and 100000
      or linea.cantidad <> round(linea.cantidad, 3)
      or referencia not between 0 and limite or linea."precioReferencia" is distinct from referencia
      or total_original not between 0 and limite or linea."totalOriginal" is distinct from total_original
      or linea."totalFinal" is null or linea."totalFinal" not between 0 and limite
      or linea."totalFinal" <> trunc(linea."totalFinal")
      or length(linea."motivoAjuste") > 1000
      or (linea."totalFinal" <> total_original and (motivo is null or referencia = 0))
      or (linea."totalFinal" = total_original and linea."motivoAjuste" is not null) then
      raise exception 'LINEAS_INVALIDAS';
    end if;

    -- El BEFORE valida los dos totales sobre la misma fila NEW. La autorización
    -- se escribe después de la línea por su FK y antes de aceptar la cabecera.
    item_id := linea."itemId";
    if item_id is null then
      insert into public.items_pedido (
        pedido_id, producto_id, presentacion_producto_id, nombre_producto_snapshot, nombre_presentacion_snapshot,
        unidad_snapshot, cantidad, precio_neto_unitario_snapshot, precio_final_unitario_snapshot,
        total_linea, modo_cantidad_snapshot, total_final_administrativo
      ) values (
        pedido.id, linea."productoId", linea."presentacionId", catalogo.producto, catalogo.presentacion,
        catalogo.unidad, linea.cantidad, catalogo.precio_neto, referencia, linea."totalFinal",
        modo, case when motivo is not null then linea."totalFinal" end
      ) returning id into item_id;
    elsif (item.cantidad, item.total_linea) is distinct from (linea.cantidad, linea."totalFinal") then
      update public.items_pedido
      set cantidad = linea.cantidad, total_linea = linea."totalFinal",
          total_final_administrativo = case when motivo is not null then linea."totalFinal" end
      where id = item_id;
    else
      continue;
    end if;

    cambiar_lineas := true;
    if motivo is not null then
      insert into public.auditoria_precios_pedido_administrativo
        (item_pedido_id, precio_referencia, precio_aplicado, total_original, total_aplicado, motivo, administrador_id)
      values (item_id, referencia, null, total_original, linea."totalFinal", motivo, actor);
    end if;
  end loop;

  if cambiar_lineas then
    select sum(i.total_linea) into subtotal_nuevo from public.items_pedido i where i.pedido_id = pedido.id;
  else
    subtotal_nuevo := pedido.subtotal;
  end if;
  -- La tarifa vigente depende del subtotal. Con la misma base se conserva
  -- el despacho registrado, incluso si se editó la dirección o la fecha.
  despacho := case when subtotal_nuevo = pedido.subtotal then pedido.costo_entrega
    when subtotal_nuevo < 25000 then 2000 else 0 end;
  total_nuevo := subtotal_nuevo + despacho - pedido.descuento;
  if subtotal_nuevo is null or subtotal_nuevo not between 0 and limite or despacho not between 0 and limite
    or pedido.descuento not between 0 and limite or total_nuevo not between 0 and limite
    or subtotal_nuevo is distinct from (p_pedido ->> 'subtotal')::numeric
    or despacho is distinct from (p_pedido ->> 'costoEntrega')::numeric
    or total_nuevo is distinct from (p_pedido ->> 'total')::numeric then
    raise exception 'TOTALES_INVALIDOS';
  end if;

  if fecha is distinct from pedido.fecha_entrega then
    perform d.id from public.dias_entrega d order by d.dia_semana for share;
    momento := clock_timestamp();
    hoy := (momento at time zone 'America/Santiago')::date;
    if fecha is null or fecha not between hoy and hoy + 14 or not public.fecha_entrega_disponible(fecha, momento) then
      raise exception 'FECHA_ENTREGA_NO_DISPONIBLE';
    end if;
  end if;

  update public.pedidos
  set cliente_id = cliente_id_nuevo, direccion_cliente_id = direccion_id_nueva,
      nombre_cliente_snapshot = case when cambiar_cliente then cliente.nombre else pedido.nombre_cliente_snapshot end,
      telefono_cliente_snapshot = case when cambiar_cliente then cliente.telefono else pedido.telefono_cliente_snapshot end,
      email_cliente_snapshot = case when cambiar_cliente then cliente.email else pedido.email_cliente_snapshot end,
      nombre_ubicacion_snapshot = case when cambiar_ubicacion then nombre_ubicacion else pedido.nombre_ubicacion_snapshot end,
      direccion_snapshot = case when cambiar_ubicacion then coalesce(direccion.direccion, nombre_ubicacion) else pedido.direccion_snapshot end,
      comuna_snapshot = case when cambiar_ubicacion then direccion.comuna else pedido.comuna_snapshot end,
      region_snapshot = case when cambiar_ubicacion then direccion.region else pedido.region_snapshot end,
      referencia_direccion_snapshot = case when cambiar_ubicacion then direccion.referencia else pedido.referencia_direccion_snapshot end,
      destinatario_entrega_snapshot = case when cambiar_ubicacion then coalesce(direccion.destinatario, direccion.nombre, cliente.nombre) else pedido.destinatario_entrega_snapshot end,
      telefono_contacto_entrega_snapshot = case when cambiar_ubicacion then coalesce(direccion.telefono_contacto, cliente.telefono) else pedido.telefono_contacto_entrega_snapshot end,
      latitud_entrega_snapshot = case when cambiar_ubicacion then direccion.latitud else pedido.latitud_entrega_snapshot end,
      longitud_entrega_snapshot = case when cambiar_ubicacion then direccion.longitud else pedido.longitud_entrega_snapshot end,
      zona_entrega_snapshot = case when cambiar_ubicacion then zona else pedido.zona_entrega_snapshot end,
      fecha_entrega = fecha, metodos_pago_previstos = metodos,
      subtotal = subtotal_nuevo, costo_entrega = despacho, total = total_nuevo
  where id = pedido.id and (
    cambiar_ubicacion or fecha is distinct from pedido.fecha_entrega
    or metodos is distinct from pedido.metodos_pago_previstos
    or subtotal_nuevo is distinct from pedido.subtotal
  );

  perform public.aceptar_pedido_administrativo(pedido.id);
end;
$$;

alter function public.guardar_y_aceptar_pedido_recibido(uuid,timestamptz,jsonb) owner to postgres;
revoke all on function public.guardar_y_aceptar_pedido_recibido(uuid,timestamptz,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.guardar_y_aceptar_pedido_recibido(uuid,timestamptz,jsonb) to authenticated;

commit;
