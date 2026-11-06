-- Permite anticipación cero sin configurar ni actualizar días/horarios.
-- La fórmula existente de fecha_entrega_disponible ya soporta el mismo día
-- y corte exclusivo (momento < deadline) en America/Santiago.
alter table public.dias_entrega
  drop constraint dias_entrega_dias_anticipacion_corte_check;
alter table public.dias_entrega
  add constraint dias_entrega_dias_anticipacion_corte_check
  check (dias_anticipacion_corte >= 0);

-- Cuarto argumento obligatorio: evita ambigüedad con el contrato antiguo.
create function public.guardar_dia_entrega_administrativo(
  p_dia_semana smallint,
  p_activo boolean,
  p_hora_corte time,
  p_dias_anticipacion_corte smallint
)
returns public.dias_entrega
language plpgsql security definer set search_path = pg_catalog as $$
declare v_dia public.dias_entrega%rowtype;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_dia_semana is null or p_dia_semana not between 1 and 7 then
    raise exception 'DIA_SEMANA_INVALIDO';
  end if;
  if p_activo is null then raise exception 'ACTIVO_INVALIDO'; end if;
  if p_hora_corte is null then raise exception 'HORA_CORTE_INVALIDA'; end if;
  if p_dias_anticipacion_corte is null or p_dias_anticipacion_corte < 0 then
    raise exception 'ANTICIPACION_CORTE_INVALIDA';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('dia-entrega:' || p_dia_semana::text, 0));
  insert into public.dias_entrega (dia_semana, activo, dias_anticipacion_corte, hora_corte, orden)
  values (p_dia_semana, p_activo, p_dias_anticipacion_corte, p_hora_corte, p_dia_semana)
  on conflict (dia_semana) do update
  set activo = excluded.activo,
      hora_corte = excluded.hora_corte,
      dias_anticipacion_corte = excluded.dias_anticipacion_corte,
      orden = excluded.orden
  returning * into v_dia;
  return v_dia;
end;
$$;

-- Compatibilidad con el dashboard actual: no restablecer silenciosamente a 1.
-- Si el día existe se conserva su anticipación, incluido 0; solo un día nuevo
-- mantiene el valor histórico inicial 1. La nueva UI usará la firma explícita.
create or replace function public.guardar_dia_entrega_administrativo(
  p_dia_semana smallint, p_activo boolean, p_hora_corte time
)
returns public.dias_entrega
language plpgsql security definer set search_path = pg_catalog as $$
declare v_anticipacion smallint;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_dia_semana is null or p_dia_semana not between 1 and 7 then
    raise exception 'DIA_SEMANA_INVALIDO';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('dia-entrega:' || p_dia_semana::text, 0));
  select d.dias_anticipacion_corte into v_anticipacion
  from public.dias_entrega d where d.dia_semana = p_dia_semana for update;
  return public.guardar_dia_entrega_administrativo(
    p_dia_semana, p_activo, p_hora_corte, coalesce(v_anticipacion, 1::smallint));
end;
$$;

alter function public.guardar_dia_entrega_administrativo(smallint,boolean,time,smallint) owner to postgres;
alter function public.guardar_dia_entrega_administrativo(smallint,boolean,time) owner to postgres;
revoke all on function public.guardar_dia_entrega_administrativo(smallint,boolean,time,smallint),
  public.guardar_dia_entrega_administrativo(smallint,boolean,time)
  from public, anon, authenticated, service_role;
grant execute on function public.guardar_dia_entrega_administrativo(smallint,boolean,time,smallint),
  public.guardar_dia_entrega_administrativo(smallint,boolean,time) to authenticated;
