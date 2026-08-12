-- Cuenta corriente operativa y reconstruible por cliente.
-- La fuente de verdad son los pedidos, pagos confirmados y ajustes históricos.

create table public.ajustes_cuenta_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  tipo text not null check (tipo in ('cargo', 'abono')),
  monto bigint not null check (monto > 0),
  motivo text not null check (btrim(motivo) <> ''),
  observacion text,
  registrado_por uuid references auth.users(id) on delete set null,
  fecha_ajuste timestamptz not null default now(),
  fecha_creacion timestamptz not null default now()
);

create index ajustes_cuenta_cliente_cliente_id_idx
  on public.ajustes_cuenta_cliente (cliente_id);

create index ajustes_cuenta_cliente_cliente_fecha_idx
  on public.ajustes_cuenta_cliente (cliente_id, fecha_ajuste desc);

alter table public.ajustes_cuenta_cliente enable row level security;

grant select, insert, update, delete on public.ajustes_cuenta_cliente to authenticated;
revoke all on public.ajustes_cuenta_cliente from public, anon;

create policy ajustes_cuenta_cliente_lectura_propia
  on public.ajustes_cuenta_cliente
  for select
  to authenticated
  using (
    public.es_admin()
    or exists (
      select 1
      from public.clientes c
      where c.id = cliente_id
        and c.usuario_id = auth.uid()
    )
  );

create policy ajustes_cuenta_cliente_administracion
  on public.ajustes_cuenta_cliente
  for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create view public.v_movimientos_cuenta_cliente
with (security_invoker = true)
as
with movimientos_base as (
  select
    p.cliente_id,
    p.fecha_creacion as fecha,
    'pedido'::text as tipo_movimiento,
    p.id as referencia_id,
    p.numero_pedido as referencia,
    ('Pedido ' || p.numero_pedido) as concepto,
    p.total as cargo,
    0::bigint as abono,
    p.total as movimiento_neto,
    p.fecha_creacion,
    1 as prioridad_orden
  from public.pedidos p
  where p.cliente_id is not null
    and p.estado <> 'cancelado'

  union all

  select
    p.cliente_id,
    p.fecha_pago as fecha,
    'pago'::text as tipo_movimiento,
    p.id as referencia_id,
    coalesce(nullif(btrim(p.referencia), ''), 'Pago ' || left(p.id::text, 8)) as referencia,
    ('Pago ' || p.metodo_pago::text) as concepto,
    0::bigint as cargo,
    p.monto as abono,
    -p.monto as movimiento_neto,
    p.fecha_creacion,
    2 as prioridad_orden
  from public.pagos p
  where p.estado = 'confirmado'

  union all

  select
    a.cliente_id,
    a.fecha_ajuste as fecha,
    'ajuste'::text as tipo_movimiento,
    a.id as referencia_id,
    'Ajuste ' || left(a.id::text, 8) as referencia,
    a.motivo as concepto,
    case when a.tipo = 'cargo' then a.monto else 0::bigint end as cargo,
    case when a.tipo = 'abono' then a.monto else 0::bigint end as abono,
    case when a.tipo = 'cargo' then a.monto else -a.monto end as movimiento_neto,
    a.fecha_creacion,
    3 as prioridad_orden
  from public.ajustes_cuenta_cliente a
)
select
  cliente_id,
  fecha,
  tipo_movimiento,
  referencia_id,
  referencia,
  concepto,
  cargo,
  abono,
  movimiento_neto,
  sum(movimiento_neto) over (
    partition by cliente_id
    order by fecha, prioridad_orden, fecha_creacion, referencia_id
    rows between unbounded preceding and current row
  )::bigint as saldo_acumulado
from movimientos_base;

create view public.v_saldos_cuenta_clientes
with (security_invoker = true)
as
select
  c.id as cliente_id,
  c.nombre as nombre_cliente,
  coalesce(sum(m.cargo) filter (where m.tipo_movimiento = 'pedido'), 0)::bigint as total_pedidos,
  coalesce(sum(m.abono) filter (where m.tipo_movimiento = 'pago'), 0)::bigint as total_pagos_confirmados,
  coalesce(sum(m.cargo) filter (where m.tipo_movimiento = 'ajuste'), 0)::bigint as total_ajustes_cargo,
  coalesce(sum(m.abono) filter (where m.tipo_movimiento = 'ajuste'), 0)::bigint as total_ajustes_abono,
  coalesce(sum(m.movimiento_neto), 0)::bigint as saldo_actual,
  count(m.referencia_id) filter (where m.tipo_movimiento = 'pedido')::bigint as cantidad_pedidos,
  max(m.fecha) as fecha_ultimo_movimiento
from public.clientes c
left join public.v_movimientos_cuenta_cliente m on m.cliente_id = c.id
group by c.id, c.nombre;

revoke all on public.v_movimientos_cuenta_cliente, public.v_saldos_cuenta_clientes from public, anon;
grant select on public.v_movimientos_cuenta_cliente, public.v_saldos_cuenta_clientes to authenticated;
