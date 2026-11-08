-- Aplicar manualmente después de 20261108120000_fijar_corte_pedidos_mismo_dia.sql.
-- Reutiliza dias_entrega.hora_corte: no crea almacenamiento adicional.
-- Las funciones existentes de disponibilidad y validación ya leen esta columna.
-- El formulario depende de esta RPC, ausente en las migraciones existentes.
-- Se puede reaplicar: no restablece la hora ni los días configurados.
begin;

alter table public.dias_entrega
  drop constraint if exists dias_entrega_hora_corte_fija_check;
alter table public.dias_entrega
  drop constraint if exists dias_entrega_hora_corte_minutos_check;
alter table public.dias_entrega
  add constraint dias_entrega_hora_corte_minutos_check
  check (hora_corte < time '24:00' and extract(second from hora_corte) = 0);

create or replace function public.guardar_hora_corte_administrativa(p_hora_corte time)
returns void
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_hora_corte is null or p_hora_corte >= time '24:00'
    or extract(second from p_hora_corte) <> 0 then
    raise exception 'HORA_CORTE_INVALIDA';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('configuracion-hora-corte-entrega', 0));
  if not exists (select 1 from public.dias_entrega) then
    raise exception 'DIAS_ENTREGA_VACIOS';
  end if;
  update public.dias_entrega set hora_corte = p_hora_corte
  where hora_corte is distinct from p_hora_corte;
end;
$$;

alter function public.guardar_hora_corte_administrativa(time) owner to postgres;
revoke all on function public.guardar_hora_corte_administrativa(time) from public, anon, authenticated;
grant execute on function public.guardar_hora_corte_administrativa(time) to authenticated;

-- Activar/desactivar un día conserva el horario común, incluso desde un
-- formulario abierto antes de un cambio de hora. NULL significa conservar.
-- Se conserva la firma usada también por la sobrecarga de tres argumentos.
create or replace function public.guardar_dia_entrega_administrativo(
  p_dia_semana smallint,
  p_activo boolean,
  p_hora_corte time,
  p_dias_anticipacion_corte smallint
)
returns public.dias_entrega
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_dia public.dias_entrega%rowtype;
  v_hora time;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_dia_semana is null or p_dia_semana not between 1 and 7 then
    raise exception 'DIA_SEMANA_INVALIDO';
  end if;
  if p_activo is null then raise exception 'ACTIVO_INVALIDO'; end if;
  if p_dias_anticipacion_corte is distinct from 0::smallint then
    raise exception 'ANTICIPACION_CORTE_INVALIDA';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('configuracion-hora-corte-entrega', 0));
  select d.hora_corte into v_hora from public.dias_entrega d order by d.dia_semana limit 1;
  v_hora := coalesce(v_hora, time '16:00');
  -- Los consumidores antiguos no pueden sobrescribir silenciosamente el corte.
  if p_hora_corte is not null and p_hora_corte is distinct from v_hora then
    raise exception 'HORA_CORTE_INVALIDA';
  end if;
  insert into public.dias_entrega (dia_semana, activo, dias_anticipacion_corte, hora_corte, orden)
  values (p_dia_semana, p_activo, 0, v_hora, p_dia_semana)
  on conflict (dia_semana) do update set activo = excluded.activo
  returning * into v_dia;
  return v_dia;
end;
$$;

alter function public.guardar_dia_entrega_administrativo(smallint, boolean, time, smallint) owner to postgres;
revoke all on function public.guardar_dia_entrega_administrativo(smallint, boolean, time, smallint) from public, anon, authenticated;
grant execute on function public.guardar_dia_entrega_administrativo(smallint, boolean, time, smallint) to authenticated;

-- Se conservan RLS y la prohibición de escrituras directas de clientes.
-- Actualizar la caché de PostgREST para que la RPC quede disponible por API.
notify pgrst, 'reload schema';
commit;
