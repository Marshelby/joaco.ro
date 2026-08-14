-- Ajustes manuales append-only de la cuenta corriente. El saldo se deriva de
-- v_movimientos_cuenta_cliente; no se persiste ni se recalcula en esta función.

create or replace function public.registrar_ajuste_cuenta_cliente(
  p_cliente_id uuid,
  p_tipo text,
  p_monto bigint,
  p_motivo text,
  p_observacion text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ajuste_id uuid;
  v_tipo text := lower(btrim(p_tipo));
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;

  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;

  if v_tipo not in ('cargo', 'abono') then
    raise exception 'TIPO_AJUSTE_INVALIDO';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'MONTO_INVALIDO';
  end if;

  if v_motivo is null then
    raise exception 'MOTIVO_REQUERIDO';
  end if;

  insert into public.ajustes_cuenta_cliente (
    cliente_id, tipo, monto, motivo, observacion, registrado_por, fecha_ajuste
  ) values (
    p_cliente_id, v_tipo, p_monto, v_motivo,
    nullif(btrim(p_observacion), ''), auth.uid(), now()
  ) returning id into v_ajuste_id;

  return v_ajuste_id;
end;
$$;

alter function public.registrar_ajuste_cuenta_cliente(uuid, text, bigint, text, text) owner to postgres;

revoke all on function public.registrar_ajuste_cuenta_cliente(uuid, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.registrar_ajuste_cuenta_cliente(uuid, text, bigint, text, text) to authenticated;
