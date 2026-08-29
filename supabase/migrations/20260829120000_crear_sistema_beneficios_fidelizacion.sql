-- Fidelización V1: cada pedido entregado elegible genera una compra acumulada.
-- Este modelo no crea pagos ni modifica deuda, descuentos o totales de pedidos.

create table public.cupones_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  tipo text not null,
  porcentaje integer not null,
  estado text not null,
  origen text not null,
  fecha_creacion timestamptz not null default now(),
  fecha_uso timestamptz,
  pedido_usado_id uuid references public.pedidos(id) on delete restrict,
  fecha_vencimiento timestamptz,
  fecha_actualizacion timestamptz not null default now(),
  constraint cupones_cliente_tipo_valido check (tipo = 'porcentaje'),
  constraint cupones_cliente_porcentaje_valido check (porcentaje = 10),
  constraint cupones_cliente_estado_valido check (estado in ('disponible', 'usado')),
  constraint cupones_cliente_origen_valido check (origen = 'beneficio_5_compras'),
  constraint cupones_cliente_uso_coherente check (
    (estado = 'disponible' and fecha_uso is null and pedido_usado_id is null)
    or (estado = 'usado' and fecha_uso is not null and pedido_usado_id is not null)
  )
);

create table public.beneficios_stacks (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  monto_elegible bigint not null check (monto_elegible > 15000),
  fecha_otorgamiento timestamptz not null default now(),
  cupon_id uuid references public.cupones_cliente(id) on delete restrict,
  fecha_creacion timestamptz not null default now(),
  constraint beneficios_stacks_pedido_unico unique (pedido_id)
);

create index beneficios_stacks_cliente_fecha_otorgamiento_idx
  on public.beneficios_stacks (cliente_id, fecha_otorgamiento);

create index beneficios_stacks_cliente_cupon_idx
  on public.beneficios_stacks (cliente_id, cupon_id);

create index cupones_cliente_cliente_estado_fecha_creacion_idx
  on public.cupones_cliente (cliente_id, estado, fecha_creacion);

create trigger actualizar_cupones_cliente_fecha_actualizacion
before update on public.cupones_cliente
for each row execute function public.actualizar_fecha_actualizacion();

alter table public.beneficios_stacks enable row level security;
alter table public.cupones_cliente enable row level security;

revoke all on public.beneficios_stacks, public.cupones_cliente from public, anon, authenticated;
grant select on public.beneficios_stacks, public.cupones_cliente to authenticated;

create policy beneficios_stacks_lectura_propia
  on public.beneficios_stacks
  for select
  to authenticated
  using (
    public.es_admin()
    or exists (
      select 1
      from public.clientes c
      where c.id = beneficios_stacks.cliente_id
        and c.usuario_id = auth.uid()
    )
  );

create policy beneficios_stacks_administracion
  on public.beneficios_stacks
  for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy cupones_cliente_lectura_propia
  on public.cupones_cliente
  for select
  to authenticated
  using (
    public.es_admin()
    or exists (
      select 1
      from public.clientes c
      where c.id = cupones_cliente.cliente_id
        and c.usuario_id = auth.uid()
    )
  );

create policy cupones_cliente_administracion
  on public.cupones_cliente
  for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create function public.procesar_beneficio_pedido_entregado(
  p_pedido_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_monto_elegible bigint;
  v_stack_id uuid;
  v_stack_ids uuid[];
  v_cupon_id uuid;
begin
  select p.cliente_id, coalesce(p.subtotal_final, p.subtotal)
  into v_cliente_id, v_monto_elegible
  from public.pedidos p
  where p.id = p_pedido_id;

  if v_cliente_id is null or v_monto_elegible is null or v_monto_elegible <= 15000 then
    return;
  end if;

  -- Serializa sólo la emisión de beneficios de un mismo cliente durante esta transacción.
  perform pg_advisory_xact_lock(hashtextextended(v_cliente_id::text, 0));

  insert into public.beneficios_stacks (
    cliente_id,
    pedido_id,
    monto_elegible
  ) values (
    v_cliente_id,
    p_pedido_id,
    v_monto_elegible
  )
  on conflict (pedido_id) do nothing
  returning id into v_stack_id;

  if v_stack_id is null then
    return;
  end if;

  loop
    select array_agg(stacks.id order by stacks.fecha_otorgamiento asc, stacks.id asc)
    into v_stack_ids
    from (
      select s.id, s.fecha_otorgamiento
      from public.beneficios_stacks s
      where s.cliente_id = v_cliente_id
        and s.cupon_id is null
      order by s.fecha_otorgamiento asc, s.id asc
      limit 5
      for update
    ) as stacks;

    exit when coalesce(cardinality(v_stack_ids), 0) < 5;

    insert into public.cupones_cliente (
      cliente_id,
      tipo,
      porcentaje,
      estado,
      origen
    ) values (
      v_cliente_id,
      'porcentaje',
      10,
      'disponible',
      'beneficio_5_compras'
    )
    returning id into v_cupon_id;

    update public.beneficios_stacks
    set cupon_id = v_cupon_id
    where id = any(v_stack_ids)
      and cupon_id is null;
  end loop;
end;
$$;

create function public.otorgar_beneficio_al_entregar_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.estado is distinct from new.estado
    and new.estado = 'entregado'::public.estado_pedido
    and old.estado is distinct from 'entregado'::public.estado_pedido then
    perform public.procesar_beneficio_pedido_entregado(new.id);
  end if;

  return new;
end;
$$;

create trigger otorgar_beneficio_pedido_entregado_despues_de_actualizar
after update of estado on public.pedidos
for each row execute function public.otorgar_beneficio_al_entregar_pedido();

alter function public.procesar_beneficio_pedido_entregado(uuid) owner to postgres;
alter function public.otorgar_beneficio_al_entregar_pedido() owner to postgres;

revoke all on function public.procesar_beneficio_pedido_entregado(uuid) from public, anon, authenticated;
revoke all on function public.otorgar_beneficio_al_entregar_pedido() from public, anon, authenticated;
