-- SQL LOCAL exclusivamente. No aplicar ni conectar todavía con /admin/rutas.
-- Requiere 20261108150000 y su infraestructura operativa/contable anterior.
-- Sin backfill, nuevos cargos, pagos, devoluciones ni reprogramación.
begin;

create function public.registrar_entrega_fallida(
  p_pedido_id uuid, p_version_esperada bigint, p_clave uuid,
  p_motivo text, p_observaciones text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  p public.pedidos%rowtype;
  cliente uuid;
  solicitud jsonb;
  inicio jsonb;
  evento jsonb;
  respuesta jsonb;
  instante timestamptz;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  -- Cliente -> pedido -> versión: orden compartido con las entregas con cobro.
  select cliente_id into cliente from public.pedidos where id = p_pedido_id;
  perform 1 from public.clientes where id = cliente for update;
  -- Payload exacto: cambiar motivo u observaciones no es el mismo reintento.
  solicitud := jsonb_build_object('contrato', 1, 'motivo', p_motivo,
    'observaciones', p_observaciones);
  inicio := operativo_privado.iniciar_operacion(p_pedido_id, p_version_esperada,
    p_clave, 'entrega_fallida', solicitud);
  if (inicio->>'reintento')::boolean then return inicio; end if;

  select * into p from public.pedidos where id = p_pedido_id for update;
  if p.cliente_id is distinct from cliente then raise exception 'CLIENTE_INVALIDO'; end if;
  if p.estado <> 'en_reparto' or p.venta_definitiva_snapshot is not null
    or p.venta_reconocida_en is not null
    or exists (select 1 from operativo_privado.entregas_definitivas where pedido_id = p.id)
  then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
  if p_motivo is null or p_motivo not in (
    'Cliente ausente', 'Cliente rechazó pedido', 'Dirección incorrecta',
    'Problema de acceso', 'Otro'
  ) then raise exception 'MOTIVO_ENTREGA_FALLIDA_INVALIDO'; end if;
  if p_motivo = 'Otro' and nullif(btrim(p_observaciones), '') is null then
    raise exception 'DESCRIPCION_ENTREGA_FALLIDA_REQUERIDA';
  end if;
  if length(p_observaciones) > 2000 then raise exception 'OBSERVACIONES_DEMASIADO_LARGAS'; end if;

  instante := clock_timestamp();
  evento := jsonb_build_object('estado', 'entrega_fallida', 'fecha', instante,
    'actor_id', auth.uid(), 'motivo', p_motivo, 'observaciones', p_observaciones,
    'regimen_contable', p.regimen_contable);
  -- El historial es el registro del intento fallido; no es una venta de importe cero.
  -- Se registra antes del UPDATE para que la barrera valide su procedencia.
  -- Todo se revierte junto si cualquier trigger rechaza el cambio de estado.
  respuesta := operativo_privado.completar_operacion(p.id, p_version_esperada,
    p_clave, 'entrega_fallida', solicitud, null, p_motivo,
    jsonb_build_object('estado', p.estado, 'regimen_contable', p.regimen_contable),
    evento, evento || jsonb_build_object('pedido_id', p.id,
      'venta_registrada', false, 'deuda_registrada', false, 'pagos_registrados', false));
  update public.pedidos set estado = 'entrega_fallida' where id = p.id;
  -- El trigger histórico de estados sigue registrando la transición y su actor.
  -- Sólo cambia estado (y fecha_actualizacion por el trigger existente).
  -- Legado conserva sus cargos previos. entrega_v1, sin venta reconocida, queda
  -- fuera de v_saldos_pedidos/v_movimientos_cuenta_cliente y del FIFO de cobro.
  -- No tocar items, preparación, snapshots, pagos, aplicaciones ni ajustes.
  return respuesta;
end;
$$;

-- Barrera puntual contra UPDATE directo sin motivo/historial y contra una
-- entrega posterior del mismo intento fallido. No modifica las RPC de éxito.
create function operativo_privado.proteger_entrega_fallida()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if TG_OP = 'UPDATE' then
    if old.estado = 'entrega_fallida' and new.estado is distinct from old.estado
      and exists (select 1 from operativo_privado.historial_operativo
        where pedido_id = old.id and operacion = 'entrega_fallida') then
      raise exception 'ENTREGA_FALLIDA_SIN_REPROGRAMACION';
    end if;
    if new.estado is not distinct from old.estado then return new; end if;
  end if;
  if new.estado = 'entrega_fallida' then
    if TG_OP = 'INSERT' then raise exception 'ENTREGA_FALLIDA_REQUIERE_OPERACION'; end if;
    if old.estado <> 'en_reparto'
      or new.venta_definitiva_snapshot is not null or new.venta_reconocida_en is not null
      or not exists (
        select 1 from operativo_privado.historial_operativo h
        join operativo_privado.versiones_pedido v
          on v.pedido_id = h.pedido_id and v.version = h.version
        where h.pedido_id = new.id and h.operacion = 'entrega_fallida'
          and h.actor_id = auth.uid()
          and h.valores_anteriores->>'estado' = 'en_reparto'
          and h.valores_nuevos->>'estado' = 'entrega_fallida'
      ) then raise exception 'ENTREGA_FALLIDA_REQUIERE_OPERACION'; end if;
  end if;
  return new;
end;
$$;

alter function public.registrar_entrega_fallida(uuid,bigint,uuid,text,text) owner to postgres;
alter function operativo_privado.proteger_entrega_fallida() owner to postgres;
revoke all on function public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.registrar_entrega_fallida(uuid,bigint,uuid,text,text) to authenticated;
revoke all on function operativo_privado.proteger_entrega_fallida()
  from public, anon, authenticated, service_role;
create trigger proteger_entrega_fallida before insert or update of estado on public.pedidos
  for each row execute function operativo_privado.proteger_entrega_fallida();
comment on function public.registrar_entrega_fallida(uuid,bigint,uuid,text,text) is
  'No entregado: motivo cerrado y observaciones (obligatorias para Otro). Transacción administrativa con historial inmutable, versión e idempotencia; sin venta, cobro ni reprogramación. UI pendiente.';
commit;
