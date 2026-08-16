create table public.dias_entrega (
  id uuid primary key default gen_random_uuid(),
  dia_semana smallint not null check (dia_semana between 1 and 7),
  activo boolean not null default false,
  dias_anticipacion_corte smallint not null default 1 check (dias_anticipacion_corte >= 1),
  hora_corte time not null default time '16:00',
  orden smallint not null,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now(),
  unique (dia_semana)
);

create trigger actualizar_dias_entrega_fecha_actualizacion
before update on public.dias_entrega
for each row execute function public.actualizar_fecha_actualizacion();

insert into public.dias_entrega (
  dia_semana,
  activo,
  dias_anticipacion_corte,
  hora_corte,
  orden
)
values
  (1, false, 1, time '16:00', 1),
  (2, false, 1, time '16:00', 2),
  (3, false, 1, time '16:00', 3),
  (4, false, 1, time '16:00', 4),
  (5, false, 1, time '16:00', 5),
  (6, false, 1, time '16:00', 6),
  (7, false, 1, time '16:00', 7)
on conflict (dia_semana) do nothing;

alter table public.dias_entrega enable row level security;

revoke all on public.dias_entrega from public, anon, authenticated;
grant select on public.dias_entrega to authenticated;

create policy dias_entrega_lectura_administrativa
on public.dias_entrega
for select
to authenticated
using (public.es_admin());

create function public.guardar_dia_entrega_administrativo(
  p_dia_semana smallint,
  p_activo boolean,
  p_hora_corte time
)
returns public.dias_entrega
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia public.dias_entrega;
begin
  if not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;

  if p_dia_semana is null or p_dia_semana not between 1 and 7 then
    raise exception 'DIA_SEMANA_INVALIDO';
  end if;

  if p_activo is null then
    raise exception 'ACTIVO_INVALIDO';
  end if;

  if p_hora_corte is null then
    raise exception 'HORA_CORTE_INVALIDA';
  end if;

  insert into public.dias_entrega (
    dia_semana,
    activo,
    dias_anticipacion_corte,
    hora_corte,
    orden
  )
  values (
    p_dia_semana,
    p_activo,
    1,
    p_hora_corte,
    p_dia_semana
  )
  on conflict (dia_semana) do update
  set activo = excluded.activo,
      hora_corte = excluded.hora_corte,
      dias_anticipacion_corte = 1,
      orden = excluded.orden
  returning * into v_dia;

  return v_dia;
end;
$$;

alter function public.guardar_dia_entrega_administrativo(smallint, boolean, time) owner to postgres;

revoke all on function public.guardar_dia_entrega_administrativo(smallint, boolean, time) from public, anon, authenticated;
grant execute on function public.guardar_dia_entrega_administrativo(smallint, boolean, time) to authenticated;
