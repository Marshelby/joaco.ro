-- Solo estructura. No registra solicitudes ni convierte pedidos.
-- Las futuras RPCs deben bloquear la cabecera, comprobar version, escribir los
-- cambios y su auditoría en una transacción. No hay escrituras de aplicación
-- habilitadas aquí, tampoco para service_role mediante privilegios directos.
-- No modifica calendario, pedidos oficiales, pagos ni vistas contables.

create table public.posibles_pedidos (
  id uuid primary key default gen_random_uuid(),
  codigo_publico text not null unique default ('PP-' || replace(gen_random_uuid()::text, '-', '')),
  origen text not null default 'whatsapp' check (origen = 'whatsapp'),
  nombre_solicitante text not null check (char_length(btrim(nombre_solicitante)) between 1 and 160),
  telefono_contacto text not null check (telefono_contacto ~ '^569[0-9]{8}$'),
  fecha_entrega_solicitada date not null check (isfinite(fecha_entrega_solicitada)),
  observaciones text null check (char_length(observaciones) <= 2000),
  estado text not null default 'registrado'
    check (estado in ('registrado', 'en_gestion', 'convertido', 'descartado')),
  moneda text not null default 'CLP' check (moneda = 'CLP'),
  subtotal_estimado bigint not null check (subtotal_estimado >= 0),
  costo_entrega_estimado bigint not null check (costo_entrega_estimado >= 0),
  total_estimado bigint not null check (total_estimado >= 0),
  umbral_despacho_gratis_snapshot bigint not null check (umbral_despacho_gratis_snapshot >= 0),
  tarifa_despacho_snapshot bigint not null check (tarifa_despacho_snapshot >= 0),
  cliente_id uuid null references public.clientes(id) on delete restrict,
  pedido_oficial_id uuid null unique references public.pedidos(id) on delete restrict,
  clave_idempotencia uuid not null unique,
  huella_solicitud bytea not null check (octet_length(huella_solicitud) = 32),
  secreto_reintento_hash bytea not null check (octet_length(secreto_reintento_hash) = 32),
  version bigint not null default 1 check (version >= 1),
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  fecha_conversion timestamptz null,
  fecha_cierre timestamptz null,
  constraint posibles_pedidos_total_coherente check (
    total_estimado::numeric = subtotal_estimado::numeric + costo_entrega_estimado::numeric
  ),
  constraint posibles_pedidos_conversion_coherente check (
    (estado = 'convertido' and pedido_oficial_id is not null and cliente_id is not null and fecha_conversion is not null)
    or (estado <> 'convertido' and pedido_oficial_id is null and fecha_conversion is null)
  ),
  constraint posibles_pedidos_cierre_coherente check (
    (estado in ('convertido', 'descartado')) = (fecha_cierre is not null)
  ),
  constraint posibles_pedidos_fechas_coherentes check (
    isfinite(fecha_creacion) and isfinite(fecha_actualizacion)
    and fecha_actualizacion >= fecha_creacion
    and (fecha_cierre is null or (isfinite(fecha_cierre) and fecha_cierre >= fecha_creacion))
    and (fecha_conversion is null or (isfinite(fecha_conversion) and fecha_conversion = fecha_cierre))
  )
);

create table public.items_posible_pedido (
  id uuid primary key default gen_random_uuid(),
  posible_pedido_id uuid not null references public.posibles_pedidos(id) on delete restrict,
  producto_id uuid not null references public.productos(id) on delete restrict,
  presentacion_producto_id uuid not null references public.presentaciones_producto(id) on delete restrict,
  nombre_producto_snapshot text not null check (btrim(nombre_producto_snapshot) <> ''),
  nombre_presentacion_snapshot text not null check (btrim(nombre_presentacion_snapshot) <> ''),
  unidad_snapshot text not null check (btrim(unidad_snapshot) <> ''),
  cantidad_presentacion_snapshot numeric not null
    check (cantidad_presentacion_snapshot > 0 and cantidad_presentacion_snapshot < 'Infinity'::numeric),
  modo_cantidad_snapshot text not null
    check (modo_cantidad_snapshot in ('kg_fraccionable', 'presentacion_cerrada', 'unidad')),
  cantidad_original numeric not null check (cantidad_original > 0 and cantidad_original < 'Infinity'::numeric),
  cantidad numeric not null check (cantidad > 0 and cantidad < 'Infinity'::numeric),
  precio_neto_original_snapshot bigint not null check (precio_neto_original_snapshot >= 0),
  precio_venta_original_snapshot bigint not null check (precio_venta_original_snapshot >= 0),
  precio_neto_autorizado bigint null check (precio_neto_autorizado >= 0),
  precio_venta_autorizado bigint null check (precio_venta_autorizado >= 0),
  precio_autorizado_por uuid null references auth.users(id) on delete restrict,
  fecha_autorizacion_precio timestamptz null,
  motivo_autorizacion_precio text null,
  subtotal bigint generated always as (
    round(cantidad * coalesce(precio_venta_autorizado, precio_venta_original_snapshot))::bigint
  ) stored,
  orden integer not null check (orden >= 1),
  activo boolean not null default true,
  fecha_incorporacion timestamptz not null default now() check (isfinite(fecha_incorporacion)),
  constraint items_posible_autorizacion_completa check (
    (precio_neto_autorizado is null and precio_venta_autorizado is null
      and precio_autorizado_por is null and fecha_autorizacion_precio is null
      and motivo_autorizacion_precio is null)
    or (precio_neto_autorizado is not null and precio_venta_autorizado is not null
      and precio_autorizado_por is not null and fecha_autorizacion_precio is not null
      and isfinite(fecha_autorizacion_precio) and motivo_autorizacion_precio is not null
      and char_length(btrim(motivo_autorizacion_precio)) between 1 and 1000)
  )
);

create table public.historial_posibles_pedidos (
  id uuid primary key default gen_random_uuid(),
  posible_pedido_id uuid not null references public.posibles_pedidos(id) on delete restrict,
  clave_operacion uuid not null,
  evento text not null check (evento in (
    'registro', 'edicion', 'autorizacion_precio', 'asociacion_cliente', 'descarte', 'conversion'
  )),
  administrador_id uuid null references auth.users(id) on delete restrict,
  version_resultante bigint not null check (version_resultante >= 1),
  motivo text null check (char_length(motivo) <= 1000),
  -- Guardar IDs y diferencias comerciales; nunca cuerpos completos del formulario,
  -- secretos, hashes de reintento ni copias innecesarias de nombre/teléfono.
  cambios jsonb not null check (jsonb_typeof(cambios) = 'object'),
  fecha_creacion timestamptz not null default now() check (isfinite(fecha_creacion)),
  unique (posible_pedido_id, clave_operacion),
  unique (posible_pedido_id, version_resultante),
  constraint historial_posibles_actor_requerido check (evento = 'registro' or administrador_id is not null),
  constraint historial_posibles_motivo_requerido check (
    evento not in ('autorizacion_precio', 'descarte')
    or (motivo is not null and btrim(motivo) <> '')
  )
);

create table public.vinculos_items_posible_pedido (
  item_posible_pedido_id uuid primary key references public.items_posible_pedido(id) on delete restrict,
  item_pedido_id uuid not null unique references public.items_pedido(id) on delete restrict
);

create index posibles_pedidos_estado_creacion_idx on public.posibles_pedidos (estado, fecha_creacion desc, id);
create index posibles_pedidos_fecha_estado_idx on public.posibles_pedidos (fecha_entrega_solicitada, estado);
create index posibles_pedidos_cliente_idx on public.posibles_pedidos (cliente_id) where cliente_id is not null;
create index posibles_pedidos_cierre_idx on public.posibles_pedidos (fecha_cierre) where fecha_cierre is not null;
create index items_posible_pedido_cabecera_idx on public.items_posible_pedido (posible_pedido_id);
create index items_posible_pedido_producto_idx on public.items_posible_pedido (producto_id);
create index items_posible_pedido_presentacion_idx on public.items_posible_pedido (presentacion_producto_id);
create index items_posible_pedido_autorizador_idx on public.items_posible_pedido (precio_autorizado_por) where precio_autorizado_por is not null;
create unique index items_posible_presentacion_activa_unica
  on public.items_posible_pedido (posible_pedido_id, presentacion_producto_id) where activo;
create unique index items_posible_orden_activo_unico
  on public.items_posible_pedido (posible_pedido_id, orden) where activo;
create index historial_posibles_pedidos_actor_idx on public.historial_posibles_pedidos (administrador_id) where administrador_id is not null;

create function public.proteger_cabecera_posible_pedido()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    if new.version <> 1 or new.estado <> 'registrado' then
      raise exception 'ESTADO_INICIAL_POSIBLE_PEDIDO_INVALIDO';
    end if;
    return new;
  end if;
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if old.estado in ('convertido', 'descartado') then raise exception 'POSIBLE_PEDIDO_CERRADO'; end if;
  if row(new.id, new.codigo_publico, new.origen, new.moneda, new.clave_idempotencia,
      new.huella_solicitud, new.secreto_reintento_hash, new.fecha_creacion,
      new.fecha_entrega_solicitada, new.umbral_despacho_gratis_snapshot, new.tarifa_despacho_snapshot)
    is distinct from row(old.id, old.codigo_publico, old.origen, old.moneda, old.clave_idempotencia,
      old.huella_solicitud, old.secreto_reintento_hash, old.fecha_creacion,
      old.fecha_entrega_solicitada, old.umbral_despacho_gratis_snapshot, old.tarifa_despacho_snapshot) then
    raise exception 'SOLICITUD_ORIGINAL_INMUTABLE';
  end if;
  if new.version <> old.version + 1 then raise exception 'VERSION_POSIBLE_PEDIDO_INVALIDA'; end if;
  if new.estado = 'convertido' and not exists (
    select 1 from public.pedidos p where p.id = new.pedido_oficial_id
      and p.cliente_id = new.cliente_id and p.canal_origen = 'whatsapp'
  ) then raise exception 'PEDIDO_OFICIAL_INCONSISTENTE'; end if;
  new.fecha_actualizacion := clock_timestamp();
  return new;
end;
$$;

create function public.proteger_item_posible_pedido()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare
  v_estado text;
  v_producto_id uuid;
begin
  -- Mismo orden de bloqueo que deberán seguir las futuras RPCs.
  select p.estado into v_estado from public.posibles_pedidos p
  where p.id = new.posible_pedido_id for update;
  if not found then raise exception 'POSIBLE_PEDIDO_NO_ENCONTRADO'; end if;
  if v_estado in ('convertido', 'descartado') then raise exception 'POSIBLE_PEDIDO_CERRADO'; end if;
  if tg_op = 'UPDATE' then
    if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
    if row(new.id, new.posible_pedido_id, new.producto_id, new.presentacion_producto_id,
        new.nombre_producto_snapshot, new.nombre_presentacion_snapshot, new.unidad_snapshot,
        new.cantidad_presentacion_snapshot, new.modo_cantidad_snapshot, new.cantidad_original,
        new.precio_neto_original_snapshot, new.precio_venta_original_snapshot, new.fecha_incorporacion)
      is distinct from row(old.id, old.posible_pedido_id, old.producto_id, old.presentacion_producto_id,
        old.nombre_producto_snapshot, old.nombre_presentacion_snapshot, old.unidad_snapshot,
        old.cantidad_presentacion_snapshot, old.modo_cantidad_snapshot, old.cantidad_original,
        old.precio_neto_original_snapshot, old.precio_venta_original_snapshot, old.fecha_incorporacion) then
      raise exception 'SNAPSHOT_POSIBLE_PEDIDO_INMUTABLE';
    end if;
  else
    select pp.producto_id into v_producto_id from public.presentaciones_producto pp
    where pp.id = new.presentacion_producto_id for share;
    if v_producto_id is distinct from new.producto_id then raise exception 'PRESENTACION_PRODUCTO_INCONSISTENTE'; end if;
    if new.cantidad is distinct from new.cantidad_original then raise exception 'CANTIDAD_INICIAL_INCONSISTENTE'; end if;
    if new.precio_venta_autorizado is not null then raise exception 'AUTORIZAR_PRECIO_EN_OPERACION_SEPARADA'; end if;
  end if;
  if not public.es_cantidad_pedido_valida(new.unidad_snapshot, new.cantidad_presentacion_snapshot,
      new.nombre_presentacion_snapshot, new.cantidad)
    or not public.es_cantidad_pedido_valida(new.unidad_snapshot, new.cantidad_presentacion_snapshot,
      new.nombre_presentacion_snapshot, new.cantidad_original) then
    raise exception 'CANTIDAD_POSIBLE_PEDIDO_INVALIDA';
  end if;
  if new.modo_cantidad_snapshot is distinct from (case
    when public.es_presentacion_kg_fraccionable(new.unidad_snapshot,
      new.cantidad_presentacion_snapshot, new.nombre_presentacion_snapshot) then 'kg_fraccionable'
    when lower(new.nombre_presentacion_snapshot) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
    else 'unidad' end) then
    raise exception 'MODO_CANTIDAD_POSIBLE_PEDIDO_INVALIDO';
  end if;
  if tg_op = 'UPDATE' and row(new.precio_neto_autorizado, new.precio_venta_autorizado,
      new.precio_autorizado_por, new.fecha_autorizacion_precio, new.motivo_autorizacion_precio)
    is distinct from row(old.precio_neto_autorizado, old.precio_venta_autorizado,
      old.precio_autorizado_por, old.fecha_autorizacion_precio, old.motivo_autorizacion_precio) then
    if new.precio_venta_autorizado is null or new.precio_autorizado_por is distinct from auth.uid() then
      raise exception 'AUTORIZACION_PRECIO_INVALIDA';
    end if;
    new.fecha_autorizacion_precio := clock_timestamp();
  end if;
  return new;
end;
$$;

-- La autorización requiere un evento verificable al finalizar la transacción.
-- Contrato JSON: cambios.item_id, precio_neto_autorizado, precio_venta_autorizado.
-- Una autorización por versión/operación; la RPC debe incrementar primero la
-- cabecera y registrar el evento con esa versión y el mismo motivo.
create function public.verificar_auditoria_precio_posible_pedido()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if row(new.precio_neto_autorizado, new.precio_venta_autorizado, new.precio_autorizado_por,
      new.fecha_autorizacion_precio, new.motivo_autorizacion_precio)
    is not distinct from row(old.precio_neto_autorizado, old.precio_venta_autorizado, old.precio_autorizado_por,
      old.fecha_autorizacion_precio, old.motivo_autorizacion_precio) then return null; end if;
  if not exists (
    select 1 from public.historial_posibles_pedidos h
    join public.posibles_pedidos p on p.id = h.posible_pedido_id
    where h.posible_pedido_id = new.posible_pedido_id
      and h.evento = 'autorizacion_precio' and h.version_resultante = p.version
      and h.administrador_id = new.precio_autorizado_por
      and h.motivo = new.motivo_autorizacion_precio
      and h.cambios @> jsonb_build_object('item_id', new.id,
        'precio_neto_autorizado', new.precio_neto_autorizado,
        'precio_venta_autorizado', new.precio_venta_autorizado)
  ) then raise exception 'AUDITORIA_PRECIO_REQUERIDA'; end if;
  return null;
end;
$$;

create function public.proteger_historial_posible_pedido()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare v_version bigint;
begin
  if tg_op <> 'INSERT' then raise exception 'HISTORIAL_POSIBLE_PEDIDO_INMUTABLE'; end if;
  select p.version into v_version from public.posibles_pedidos p
    where p.id = new.posible_pedido_id for update;
  if new.version_resultante is distinct from v_version then raise exception 'VERSION_AUDITORIA_INVALIDA'; end if;
  if new.evento <> 'registro' and (not coalesce(public.es_admin(), false)
      or new.administrador_id is distinct from auth.uid()) then raise exception 'NO_AUTORIZADO'; end if;
  if new.evento = 'registro' and (new.version_resultante <> 1 or new.administrador_id is not null) then
    raise exception 'AUDITORIA_REGISTRO_INVALIDA';
  end if;
  return new;
end;
$$;

create function public.verificar_vinculo_item_posible_pedido()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'UPDATE' then raise exception 'VINCULO_POSIBLE_PEDIDO_INMUTABLE'; end if;
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if not exists (
    select 1 from public.items_posible_pedido i
    join public.posibles_pedidos p on p.id = i.posible_pedido_id
    join public.items_pedido oficial on oficial.id = new.item_pedido_id
    where i.id = new.item_posible_pedido_id and i.activo
      and p.estado = 'convertido' and p.pedido_oficial_id = oficial.pedido_id
      and row(oficial.producto_id, oficial.presentacion_producto_id,
        oficial.nombre_producto_snapshot, oficial.nombre_presentacion_snapshot,
        oficial.unidad_snapshot, oficial.modo_cantidad_snapshot, oficial.cantidad,
        oficial.precio_neto_unitario_snapshot, oficial.precio_final_unitario_snapshot, oficial.total_linea)
      is not distinct from row(i.producto_id, i.presentacion_producto_id,
        i.nombre_producto_snapshot, i.nombre_presentacion_snapshot,
        i.unidad_snapshot, i.modo_cantidad_snapshot, i.cantidad,
        coalesce(i.precio_neto_autorizado, i.precio_neto_original_snapshot),
        coalesce(i.precio_venta_autorizado, i.precio_venta_original_snapshot), i.subtotal)
  ) then raise exception 'VINCULO_PEDIDO_INCONSISTENTE'; end if;
  return new;
end;
$$;

create trigger proteger_cabecera_posible_pedido before insert or update on public.posibles_pedidos
  for each row execute function public.proteger_cabecera_posible_pedido();
create trigger proteger_item_posible_pedido before insert or update on public.items_posible_pedido
  for each row execute function public.proteger_item_posible_pedido();
create constraint trigger verificar_auditoria_precio_posible_pedido
  after update on public.items_posible_pedido deferrable initially deferred
  for each row execute function public.verificar_auditoria_precio_posible_pedido();
create trigger proteger_historial_posible_pedido before insert or update or delete on public.historial_posibles_pedidos
  for each row execute function public.proteger_historial_posible_pedido();
create trigger verificar_vinculo_item_posible_pedido before insert or update on public.vinculos_items_posible_pedido
  for each row execute function public.verificar_vinculo_item_posible_pedido();

alter table public.posibles_pedidos enable row level security;
alter table public.items_posible_pedido enable row level security;
alter table public.historial_posibles_pedidos enable row level security;
alter table public.vinculos_items_posible_pedido enable row level security;

-- Revocar también service_role: BYPASSRLS no elimina la necesidad de privilegios
-- de tabla. El servidor invocará futuras RPCs específicas, no DML directo.
revoke all on table public.posibles_pedidos, public.items_posible_pedido,
  public.historial_posibles_pedidos, public.vinculos_items_posible_pedido
  from public, anon, authenticated, service_role;
grant select on table public.posibles_pedidos, public.items_posible_pedido,
  public.historial_posibles_pedidos, public.vinculos_items_posible_pedido to authenticated;

create policy posibles_pedidos_lectura_admin on public.posibles_pedidos
  for select to authenticated using ((select public.es_admin()));
create policy items_posible_pedido_lectura_admin on public.items_posible_pedido
  for select to authenticated using ((select public.es_admin()));
create policy historial_posibles_pedidos_lectura_admin on public.historial_posibles_pedidos
  for select to authenticated using ((select public.es_admin()));
create policy vinculos_items_posible_pedido_lectura_admin on public.vinculos_items_posible_pedido
  for select to authenticated using ((select public.es_admin()));

revoke all on function public.proteger_cabecera_posible_pedido(),
  public.proteger_item_posible_pedido(), public.verificar_auditoria_precio_posible_pedido(),
  public.proteger_historial_posible_pedido(), public.verificar_vinculo_item_posible_pedido()
  from public, anon, authenticated, service_role;

-- Pendiente para RPCs: CAPTCHA/límites, captura de precios desde catálogo,
-- validación de disponibilidad y calendario, suma transaccional de líneas,
-- comparación de version, auditoría de toda edición y conversión idempotente.
-- La fecha original y las condiciones de despacho nunca se reescriben.
-- No se guarda ni se calcula un costo de compra en esta fase.
-- La política de retención/purga privilegiada se implementará por separado;
-- el historial no admite UPDATE/DELETE ordinarios.
