-- Rutas P1: infraestructura logística persistente. No crea rutas, paradas ni
-- orígenes iniciales; los datos se crearán únicamente mediante RPCs administrativas.

create type public.estado_ruta_logistica as enum (
  'borrador',
  'planificada',
  'en_reparto',
  'completada',
  'archivada'
);

create type public.estado_parada_ruta as enum (
  'sin_ordenar',
  'planificada',
  'en_camino',
  'entregada',
  'omitida',
  'cancelada'
);

create table public.configuracion_logistica (
  id uuid primary key default gen_random_uuid(),
  nombre_origen text null,
  direccion_origen text null,
  latitud numeric(9,6) null,
  longitud numeric(9,6) null,
  activa boolean not null default true,
  es_principal boolean not null default false,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint configuracion_logistica_latitud_valida check (latitud is null or latitud between -90 and 90),
  constraint configuracion_logistica_longitud_valida check (longitud is null or longitud between -180 and 180),
  constraint configuracion_logistica_coordenadas_completas check ((latitud is null) = (longitud is null)),
  constraint configuracion_logistica_principal_activa check (not es_principal or activa)
);

create unique index configuracion_logistica_una_principal_idx
  on public.configuracion_logistica (es_principal)
  where es_principal;

create table public.rutas (
  id uuid primary key default gen_random_uuid(),
  fecha_operativa date not null,
  es_principal boolean not null default false,
  estado_logistico public.estado_ruta_logistica not null default 'borrador',
  nombre text null,
  origen_nombre_snapshot text null,
  origen_direccion_snapshot text null,
  origen_latitud_snapshot numeric(9,6) null,
  origen_longitud_snapshot numeric(9,6) null,
  creada_por uuid null references auth.users(id) on delete set null,
  version bigint not null default 1,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint rutas_version_valida check (version >= 1),
  constraint rutas_origen_latitud_valida check (origen_latitud_snapshot is null or origen_latitud_snapshot between -90 and 90),
  constraint rutas_origen_longitud_valida check (origen_longitud_snapshot is null or origen_longitud_snapshot between -180 and 180),
  constraint rutas_origen_coordenadas_completas check ((origen_latitud_snapshot is null) = (origen_longitud_snapshot is null))
);

create unique index rutas_una_principal_por_fecha_idx
  on public.rutas (fecha_operativa)
  where es_principal;

create index rutas_fecha_estado_idx
  on public.rutas (fecha_operativa, estado_logistico);

create table public.paradas_ruta (
  id uuid primary key default gen_random_uuid(),
  ruta_id uuid not null references public.rutas(id) on delete restrict,
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  posicion integer null,
  estado_logistico public.estado_parada_ruta not null default 'sin_ordenar',
  numero_pedido_snapshot text not null,
  cliente_id uuid null references public.clientes(id) on delete set null,
  cliente_nombre_snapshot text not null,
  destinatario_snapshot text null,
  telefono_snapshot text null,
  direccion_snapshot text null,
  comuna_snapshot text null,
  region_snapshot text null,
  referencia_snapshot text null,
  zona_snapshot text null,
  latitud_snapshot numeric(9,6) null,
  longitud_snapshot numeric(9,6) null,
  total_snapshot bigint not null,
  metodos_pago_previstos_snapshot text[] null,
  hora_inicio timestamptz null,
  hora_entrega timestamptz null,
  observacion_logistica text null,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  constraint paradas_ruta_unica_por_pedido unique (ruta_id, pedido_id),
  constraint paradas_ruta_posicion_positiva check (posicion is null or posicion > 0),
  constraint paradas_ruta_latitud_valida check (latitud_snapshot is null or latitud_snapshot between -90 and 90),
  constraint paradas_ruta_longitud_valida check (longitud_snapshot is null or longitud_snapshot between -180 and 180),
  constraint paradas_ruta_coordenadas_completas check ((latitud_snapshot is null) = (longitud_snapshot is null)),
  constraint paradas_ruta_total_valido check (total_snapshot >= 0),
  constraint paradas_ruta_horas_coherentes check (hora_entrega is null or hora_inicio is null or hora_entrega >= hora_inicio)
);

create unique index paradas_ruta_posicion_unica_idx
  on public.paradas_ruta (ruta_id, posicion)
  where posicion is not null;

create index paradas_ruta_ruta_estado_posicion_idx
  on public.paradas_ruta (ruta_id, estado_logistico, posicion);

create index paradas_ruta_pedido_id_idx
  on public.paradas_ruta (pedido_id);

create trigger actualizar_configuracion_logistica_fecha_actualizacion
before update on public.configuracion_logistica
for each row execute function public.actualizar_fecha_actualizacion();

create trigger actualizar_rutas_fecha_actualizacion
before update on public.rutas
for each row execute function public.actualizar_fecha_actualizacion();

create trigger actualizar_paradas_ruta_fecha_actualizacion
before update on public.paradas_ruta
for each row execute function public.actualizar_fecha_actualizacion();

alter table public.configuracion_logistica enable row level security;
alter table public.rutas enable row level security;
alter table public.paradas_ruta enable row level security;

revoke all on public.configuracion_logistica from public, anon, authenticated;
revoke all on public.rutas from public, anon, authenticated;
revoke all on public.paradas_ruta from public, anon, authenticated;

create policy configuracion_logistica_administracion
on public.configuracion_logistica
for all to authenticated
using (public.es_admin())
with check (public.es_admin());

create policy rutas_administracion
on public.rutas
for all to authenticated
using (public.es_admin())
with check (public.es_admin());

create policy paradas_ruta_administracion
on public.paradas_ruta
for all to authenticated
using (public.es_admin())
with check (public.es_admin());