-- Núcleo operativo inicial de Hidro Leufú. No incluye datos de catálogo.

create type public.rol_perfil as enum ('cliente', 'admin');
create type public.canal_origen_pedido as enum ('web', 'whatsapp', 'telefono', 'instagram', 'manual', 'otro');
create type public.estado_pedido as enum (
  'recibido', 'en_revision', 'confirmado', 'programado', 'preparando',
  'listo_despacho', 'en_reparto', 'entregado', 'entrega_fallida', 'cancelado'
);
create type public.metodo_pago as enum ('efectivo', 'transferencia', 'otro', 'tarjeta', 'pago_web');
create type public.estado_pago as enum ('registrado', 'pendiente_verificacion', 'confirmado', 'anulado');

create function public.actualizar_fecha_actualizacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

create table public.perfiles (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  rol public.rol_perfil not null default 'cliente',
  nombre text,
  telefono text,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid unique references auth.users(id) on delete set null,
  nombre text not null check (btrim(nombre) <> ''),
  telefono text,
  email text,
  activo boolean not null default true,
  observaciones text,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create table public.direcciones_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  nombre text,
  destinatario text,
  telefono_contacto text,
  direccion text not null check (btrim(direccion) <> ''),
  comuna text not null check (btrim(comuna) <> ''),
  region text not null check (btrim(region) <> ''),
  referencia text,
  latitud numeric(9,6),
  longitud numeric(9,6),
  es_principal boolean not null default false,
  activa boolean not null default true,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint direcciones_cliente_latitud_valida check (latitud is null or latitud between -90 and 90),
  constraint direcciones_cliente_longitud_valida check (longitud is null or longitud between -180 and 180)
);

create unique index direcciones_cliente_una_principal_por_cliente
  on public.direcciones_cliente (cliente_id) where es_principal and activa;

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  descripcion text,
  activa boolean not null default true,
  orden integer not null default 0,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references public.categorias(id) on delete restrict,
  nombre text not null check (btrim(nombre) <> ''),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  descripcion text,
  ruta_imagen text,
  unidad_base text not null check (btrim(unidad_base) <> ''),
  activo boolean not null default true,
  disponible boolean not null default true,
  destacado boolean not null default false,
  mas_vendido boolean not null default false,
  nuevo boolean not null default false,
  orden integer not null default 0,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create table public.presentaciones_producto (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete restrict,
  nombre text not null check (btrim(nombre) <> ''),
  cantidad numeric(12,3) not null check (cantidad > 0),
  unidad text not null check (btrim(unidad) <> ''),
  precio_neto bigint not null check (precio_neto >= 0),
  precio_final bigint not null check (precio_final >= 0),
  es_principal boolean not null default false,
  activa boolean not null default true,
  orden integer not null default 0,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create unique index presentaciones_producto_una_principal_por_producto
  on public.presentaciones_producto (producto_id) where es_principal and activa;

create sequence public.numeros_pedido_seq start with 1 increment by 1;

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_pedido text not null unique default ('HL-' || lpad(nextval('public.numeros_pedido_seq')::text, 6, '0')),
  cliente_id uuid references public.clientes(id) on delete restrict,
  canal_origen public.canal_origen_pedido not null,
  estado public.estado_pedido not null default 'recibido',
  nombre_cliente_snapshot text not null check (btrim(nombre_cliente_snapshot) <> ''),
  telefono_cliente_snapshot text,
  email_cliente_snapshot text,
  direccion_cliente_id uuid references public.direcciones_cliente(id) on delete set null,
  direccion_snapshot text,
  comuna_snapshot text,
  region_snapshot text,
  referencia_direccion_snapshot text,
  subtotal bigint not null default 0 check (subtotal >= 0),
  costo_entrega bigint not null default 0 check (costo_entrega >= 0),
  descuento bigint not null default 0 check (descuento >= 0),
  total bigint not null default 0 check (total >= 0),
  observacion_general text,
  fecha_entrega timestamptz,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint pedidos_total_coherente check (total = subtotal + costo_entrega - descuento),
  constraint pedidos_descuento_no_supera_base check (descuento <= subtotal + costo_entrega)
);

create table public.items_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  producto_id uuid references public.productos(id) on delete set null,
  presentacion_producto_id uuid references public.presentaciones_producto(id) on delete set null,
  nombre_producto_snapshot text not null check (btrim(nombre_producto_snapshot) <> ''),
  nombre_presentacion_snapshot text,
  unidad_snapshot text not null check (btrim(unidad_snapshot) <> ''),
  cantidad numeric(12,3) not null check (cantidad > 0),
  precio_neto_unitario_snapshot bigint not null check (precio_neto_unitario_snapshot >= 0),
  precio_final_unitario_snapshot bigint not null check (precio_final_unitario_snapshot >= 0),
  total_linea bigint not null check (total_linea >= 0),
  observacion_cliente text,
  fecha_creacion timestamptz not null default now()
);

create function public.validar_total_linea_pedido()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.total_linea <> round(new.cantidad * new.precio_final_unitario_snapshot)::bigint then
    raise exception 'total_linea debe corresponder a cantidad por precio final unitario';
  end if;
  return new;
end;
$$;

create trigger validar_total_linea_pedido_antes_de_guardar
before insert or update of cantidad, precio_final_unitario_snapshot, total_linea on public.items_pedido
for each row execute function public.validar_total_linea_pedido();

create table public.historial_estados_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  estado_anterior public.estado_pedido,
  estado_nuevo public.estado_pedido not null,
  cambiado_por uuid references auth.users(id) on delete set null,
  observacion text,
  fecha_creacion timestamptz not null default now()
);

create function public.registrar_historial_estado_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial_estados_pedido (pedido_id, estado_anterior, estado_nuevo, cambiado_por)
    values (new.id, null, new.estado, auth.uid());
  elsif new.estado is distinct from old.estado then
    insert into public.historial_estados_pedido (pedido_id, estado_anterior, estado_nuevo, cambiado_por)
    values (new.id, old.estado, new.estado, auth.uid());
  end if;
  return new;
end;
$$;

create trigger registrar_historial_estado_pedido_despues_de_guardar
after insert or update of estado on public.pedidos
for each row execute function public.registrar_historial_estado_pedido();

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  monto bigint not null check (monto >= 0),
  metodo_pago public.metodo_pago not null,
  estado public.estado_pago not null default 'registrado',
  referencia text,
  observacion text,
  registrado_por uuid references auth.users(id) on delete set null,
  fecha_pago timestamptz not null default now(),
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create table public.aplicaciones_pago (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid not null references public.pagos(id) on delete restrict,
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  monto_aplicado bigint not null check (monto_aplicado > 0),
  fecha_creacion timestamptz not null default now(),
  constraint aplicaciones_pago_unica_por_pago_y_pedido unique (pago_id, pedido_id)
);

create function public.validar_aplicacion_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pago_actual public.pagos%rowtype;
  pedido_actual public.pedidos%rowtype;
  aplicado_pago bigint;
  aplicado_pedido bigint;
begin
  select * into pago_actual from public.pagos where id = new.pago_id for update;
  if not found then raise exception 'Pago inexistente'; end if;
  if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;
  select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then
    raise exception 'El pago y el pedido deben pertenecer al mismo cliente';
  end if;
  if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;
  select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
  from public.aplicaciones_pago a join public.pagos p on p.id = a.pago_id
  where a.pago_id = new.pago_id and p.estado <> 'anulado' and a.id is distinct from new.id;
  if aplicado_pago + new.monto_aplicado > pago_actual.monto then
    raise exception 'La aplicación supera el monto disponible del pago';
  end if;
  select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
  from public.aplicaciones_pago a join public.pagos p on p.id = a.pago_id
  where a.pedido_id = new.pedido_id and p.estado <> 'anulado' and a.id is distinct from new.id;
  if aplicado_pedido + new.monto_aplicado > pedido_actual.total then
    raise exception 'La aplicación supera el saldo pendiente del pedido';
  end if;
  return new;
end;
$$;

create trigger validar_aplicacion_pago_antes_de_guardar
before insert or update of pago_id, pedido_id, monto_aplicado on public.aplicaciones_pago
for each row execute function public.validar_aplicacion_pago();

create view public.v_saldos_pedidos
with (security_invoker = true)
as
select
  p.id as pedido_id,
  p.cliente_id,
  p.total as total_pedido,
  coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado'), 0)::bigint as total_pagado,
  (p.total - coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado'), 0))::bigint as saldo_pendiente,
  case
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado'), 0) = 0 then 'sin_pago'
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado'), 0) < p.total then 'parcial'
    else 'pagado'
  end as estado_pago
from public.pedidos p
left join public.aplicaciones_pago a on a.pedido_id = p.id
left join public.pagos pa on pa.id = a.pago_id
where p.estado <> 'cancelado'
group by p.id, p.cliente_id, p.total;

create view public.v_saldos_clientes
with (security_invoker = true)
as
select
  c.id as cliente_id,
  coalesce(sum(s.total_pedido), 0)::bigint as total_facturado_relevante,
  coalesce(sum(s.total_pagado), 0)::bigint as total_pagado_aplicado,
  coalesce(sum(s.saldo_pendiente), 0)::bigint as deuda_pendiente,
  count(*) filter (where s.saldo_pendiente > 0)::bigint as cantidad_pedidos_pendientes
from public.clientes c
left join public.v_saldos_pedidos s on s.cliente_id = c.id
group by c.id;

create view public.v_saldos_pagos
with (security_invoker = true)
as
select
  p.id as pago_id,
  p.cliente_id,
  p.monto as monto_pago,
  coalesce(sum(a.monto_aplicado) filter (where p.estado = 'confirmado'), 0)::bigint as monto_aplicado,
  case when p.estado = 'confirmado'
    then (p.monto - coalesce(sum(a.monto_aplicado), 0))::bigint
    else 0::bigint
  end as monto_disponible,
  p.estado
from public.pagos p
left join public.aplicaciones_pago a on a.pago_id = p.id
group by p.id, p.cliente_id, p.monto, p.estado;

create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where usuario_id = auth.uid() and rol = 'admin'
  );
$$;

create trigger actualizar_perfiles_fecha_actualizacion before update on public.perfiles for each row execute function public.actualizar_fecha_actualizacion();
create trigger actualizar_clientes_fecha_actualizacion before update on public.clientes for each row execute function public.actualizar_fecha_actualizacion();
create trigger actualizar_direcciones_cliente_fecha_actualizacion before update on public.direcciones_cliente for each row execute function public.actualizar_fecha_actualizacion();
create trigger actualizar_categorias_fecha_actualizacion before update on public.categorias for each row execute function public.actualizar_fecha_actualizacion();
create trigger actualizar_productos_fecha_actualizacion before update on public.productos for each row execute function public.actualizar_fecha_actualizacion();
create trigger actualizar_presentaciones_producto_fecha_actualizacion before update on public.presentaciones_producto for each row execute function public.actualizar_fecha_actualizacion();
create trigger actualizar_pedidos_fecha_actualizacion before update on public.pedidos for each row execute function public.actualizar_fecha_actualizacion();
create trigger actualizar_pagos_fecha_actualizacion before update on public.pagos for each row execute function public.actualizar_fecha_actualizacion();

create index productos_categoria_id_idx on public.productos (categoria_id);
create index clientes_telefono_idx on public.clientes (telefono) where telefono is not null;
create index clientes_email_idx on public.clientes (email) where email is not null;
create index direcciones_cliente_cliente_id_idx on public.direcciones_cliente (cliente_id);
create index pedidos_cliente_id_idx on public.pedidos (cliente_id);
create index pedidos_estado_idx on public.pedidos (estado);
create index pedidos_fecha_creacion_idx on public.pedidos (fecha_creacion desc);
create index pedidos_fecha_entrega_idx on public.pedidos (fecha_entrega) where fecha_entrega is not null;
create index items_pedido_pedido_id_idx on public.items_pedido (pedido_id);
create index historial_estados_pedido_pedido_id_idx on public.historial_estados_pedido (pedido_id);
create index pagos_cliente_id_idx on public.pagos (cliente_id);
create index pagos_fecha_pago_idx on public.pagos (fecha_pago desc);
create index aplicaciones_pago_pago_id_idx on public.aplicaciones_pago (pago_id);
create index aplicaciones_pago_pedido_id_idx on public.aplicaciones_pago (pedido_id);

alter table public.perfiles enable row level security;
alter table public.clientes enable row level security;
alter table public.direcciones_cliente enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.presentaciones_producto enable row level security;
alter table public.pedidos enable row level security;
alter table public.items_pedido enable row level security;
alter table public.historial_estados_pedido enable row level security;
alter table public.pagos enable row level security;
alter table public.aplicaciones_pago enable row level security;

grant select on public.categorias, public.productos, public.presentaciones_producto to anon, authenticated;
grant select, insert, update, delete on public.categorias, public.productos, public.presentaciones_producto,
  public.clientes, public.direcciones_cliente, public.pedidos, public.items_pedido,
  public.historial_estados_pedido, public.pagos, public.aplicaciones_pago to authenticated;
grant select on public.perfiles to authenticated;
grant usage, select on sequence public.numeros_pedido_seq to authenticated;
grant execute on function public.es_admin() to anon, authenticated;
revoke all on function public.actualizar_fecha_actualizacion(), public.validar_total_linea_pedido(),
  public.registrar_historial_estado_pedido(), public.validar_aplicacion_pago() from public, anon, authenticated;

create policy categorias_lectura_publica_activas on public.categorias for select to anon, authenticated using (activa);
create policy productos_lectura_publica_activos on public.productos for select to anon, authenticated using (activo);
create policy presentaciones_lectura_publica_activas on public.presentaciones_producto for select to anon, authenticated using (activa and exists (select 1 from public.productos p where p.id = producto_id and p.activo));

create policy perfiles_lectura_propia on public.perfiles for select to authenticated using (usuario_id = auth.uid() or public.es_admin());
create policy clientes_lectura_propia on public.clientes for select to authenticated using (usuario_id = auth.uid() or public.es_admin());
create policy direcciones_cliente_lectura_propia on public.direcciones_cliente for select to authenticated using (public.es_admin() or exists (select 1 from public.clientes c where c.id = cliente_id and c.usuario_id = auth.uid()));
create policy pedidos_lectura_propia on public.pedidos for select to authenticated using (public.es_admin() or exists (select 1 from public.clientes c where c.id = cliente_id and c.usuario_id = auth.uid()));
create policy items_pedido_lectura_propia on public.items_pedido for select to authenticated using (public.es_admin() or exists (select 1 from public.pedidos p join public.clientes c on c.id = p.cliente_id where p.id = pedido_id and c.usuario_id = auth.uid()));
create policy historial_estados_pedido_lectura_propia on public.historial_estados_pedido for select to authenticated using (public.es_admin() or exists (select 1 from public.pedidos p join public.clientes c on c.id = p.cliente_id where p.id = pedido_id and c.usuario_id = auth.uid()));
create policy pagos_lectura_propia on public.pagos for select to authenticated using (public.es_admin() or exists (select 1 from public.clientes c where c.id = cliente_id and c.usuario_id = auth.uid()));
create policy aplicaciones_pago_lectura_propia on public.aplicaciones_pago for select to authenticated using (public.es_admin() or exists (select 1 from public.pedidos p join public.clientes c on c.id = p.cliente_id where p.id = pedido_id and c.usuario_id = auth.uid()));

create policy categorias_administracion on public.categorias for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy productos_administracion on public.productos for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy presentaciones_administracion on public.presentaciones_producto for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy clientes_administracion on public.clientes for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy direcciones_cliente_administracion on public.direcciones_cliente for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy pedidos_administracion on public.pedidos for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy items_pedido_administracion on public.items_pedido for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy historial_estados_pedido_administracion on public.historial_estados_pedido for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy pagos_administracion on public.pagos for all to authenticated using (public.es_admin()) with check (public.es_admin());
create policy aplicaciones_pago_administracion on public.aplicaciones_pago for all to authenticated using (public.es_admin()) with check (public.es_admin());

revoke all on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos from public, anon, authenticated;
