-- Bloque 1, microintegración 3/8. Infraestructura INACTIVA para futuras RPC.
-- Requiere 20261106010000. No sustituye RPC, vistas ni permisos del núcleo.
begin;

create schema operativo_privado authorization postgres;
revoke all on schema operativo_privado from public, anon, authenticated, service_role;

-- Identificadores históricos sin FK a tablas mutables: una baja no borra,
-- reescribe ni queda bloqueada por esta infraestructura. Se validan al registrar.
create table operativo_privado.versiones_pedido (
  pedido_id uuid primary key,
  version bigint not null default 0 check (version >= 0)
);
create table operativo_privado.historial_operativo (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null,
  item_pedido_id uuid,
  operacion text not null check (btrim(operacion) <> '' and length(operacion) <= 100),
  actor_id uuid not null,
  motivo text not null check (btrim(motivo) <> '' and length(motivo) <= 2000),
  valores_anteriores jsonb not null check (jsonb_typeof(valores_anteriores) = 'object'),
  valores_nuevos jsonb not null check (jsonb_typeof(valores_nuevos) = 'object'),
  version bigint not null check (version > 0),
  fecha timestamptz not null default clock_timestamp(),
  clave_idempotencia uuid not null,
  version_esperada bigint not null check (version_esperada >= 0),
  solicitud jsonb not null check (jsonb_typeof(solicitud) = 'object'),
  resultado jsonb not null check (jsonb_typeof(resultado) = 'object'),
  unique (pedido_id, version),
  -- Una clave por pedido, entre actores y operaciones. No permite reutilizarla
  -- con otro actor/payload. No revela existencia de claves de otros pedidos.
  unique (pedido_id, clave_idempotencia),
  check (version = version_esperada + 1)
);

alter table operativo_privado.versiones_pedido owner to postgres;
alter table operativo_privado.historial_operativo owner to postgres;
alter table operativo_privado.versiones_pedido enable row level security;
alter table operativo_privado.versiones_pedido force row level security;
alter table operativo_privado.historial_operativo enable row level security;
alter table operativo_privado.historial_operativo force row level security;
-- Sin policies: denegación por defecto, incluso para administradores de negocio.
revoke all on all tables in schema operativo_privado from public, anon, authenticated, service_role;

create function operativo_privado.impedir_mutacion_historial()
returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  raise exception 'AUDITORIA_OPERATIVA_INMUTABLE';
end;
$$;
create trigger historial_operativo_inmutable
before update or delete on operativo_privado.historial_operativo
for each row execute function operativo_privado.impedir_mutacion_historial();
create trigger historial_operativo_no_truncable
before truncate on operativo_privado.historial_operativo
for each statement execute function operativo_privado.impedir_mutacion_historial();

-- Contrato: futura RPC SECURITY DEFINER de postgres, misma transacción:
-- autorizar -> iniciar -> si reintento retornar resultado -> validar dominio y
-- mutar -> completar. Nunca hacer mutaciones antes de resolver el reintento.
-- SECURITY INVOKER deliberado: estos auxiliares NO elevan privilegios.
create function operativo_privado.iniciar_operacion(
  p_pedido_id uuid, p_version_esperada bigint, p_clave uuid,
  p_operacion text, p_solicitud jsonb
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  v_actor uuid := auth.uid();
  v_evento operativo_privado.historial_operativo%rowtype;
  v_version bigint;
begin
  -- Defensa adicional: el permiso de negocio no sustituye las ACL privadas.
  -- Se limita la infraestructura inicial a operaciones administrativas futuras.
  if v_actor is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if p_pedido_id is null or p_clave is null or p_version_esperada is null
    or p_version_esperada < 0 or p_operacion is null
    or btrim(p_operacion) = '' or length(p_operacion) > 100
    or p_solicitud is null or jsonb_typeof(p_solicitud) <> 'object' then
    raise exception 'OPERACION_INVALIDA';
  end if;
  -- Lock común por pedido, incluso cuando todavía no hay versión privada.
  perform 1 from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;

  select h.* into v_evento from operativo_privado.historial_operativo h
    where h.pedido_id = p_pedido_id and h.clave_idempotencia = p_clave;
  if found then
    if v_evento.actor_id is distinct from v_actor
      or v_evento.operacion is distinct from p_operacion
      or v_evento.solicitud is distinct from p_solicitud
      or v_evento.version_esperada is distinct from p_version_esperada then
      raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
    end if;
    -- Reintento antes de comparar versión actual: respuesta original estable.
    return jsonb_build_object('reintento', true, 'resultado', v_evento.resultado,
      'version', v_evento.version);
  end if;
  insert into operativo_privado.versiones_pedido (pedido_id) values (p_pedido_id)
    on conflict (pedido_id) do nothing;
  select v.version into v_version from operativo_privado.versiones_pedido v
    where v.pedido_id = p_pedido_id for update;
  if v_version <> p_version_esperada then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
  return jsonb_build_object('reintento', false, 'version', v_version);
end;
$$;

create function operativo_privado.completar_operacion(
  p_pedido_id uuid, p_version_esperada bigint, p_clave uuid,
  p_operacion text, p_solicitud jsonb, p_item_pedido_id uuid,
  p_motivo text, p_anteriores jsonb, p_nuevos jsonb, p_resultado jsonb
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  v_inicio jsonb;
  v_version bigint;
begin
  v_inicio := operativo_privado.iniciar_operacion(p_pedido_id, p_version_esperada,
    p_clave, p_operacion, p_solicitud);
  if (v_inicio ->> 'reintento')::boolean then return v_inicio; end if;
  if p_motivo is null or btrim(p_motivo) = '' or length(p_motivo) > 2000
    or p_anteriores is null or jsonb_typeof(p_anteriores) <> 'object'
    or p_nuevos is null or jsonb_typeof(p_nuevos) <> 'object'
    or p_resultado is null or jsonb_typeof(p_resultado) <> 'object' then
    raise exception 'AUDITORIA_OPERATIVA_INVALIDA';
  end if;
  if p_item_pedido_id is not null then
    perform 1 from public.items_pedido i
      where i.id = p_item_pedido_id and i.pedido_id = p_pedido_id for share;
    if not found then raise exception 'ITEM_PEDIDO_NO_CORRESPONDE_AL_PEDIDO'; end if;
  end if;
  update operativo_privado.versiones_pedido v set version = v.version + 1
    where v.pedido_id = p_pedido_id and v.version = p_version_esperada
    returning v.version into v_version;
  if not found then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
  insert into operativo_privado.historial_operativo (
    pedido_id, item_pedido_id, operacion, actor_id, motivo, valores_anteriores,
    valores_nuevos, version, clave_idempotencia, version_esperada, solicitud, resultado
  ) values (p_pedido_id, p_item_pedido_id, p_operacion, auth.uid(), p_motivo,
    p_anteriores, p_nuevos, v_version, p_clave, p_version_esperada, p_solicitud, p_resultado);
  return jsonb_build_object('reintento', false, 'resultado', p_resultado, 'version', v_version);
end;
$$;

alter function operativo_privado.impedir_mutacion_historial() owner to postgres;
alter function operativo_privado.iniciar_operacion(uuid, bigint, uuid, text, jsonb) owner to postgres;
alter function operativo_privado.completar_operacion(uuid, bigint, uuid, text, jsonb, uuid, text, jsonb, jsonb, jsonb) owner to postgres;
revoke all on all functions in schema operativo_privado from public, anon, authenticated, service_role;

comment on schema operativo_privado is
  'Microintegración 3/8: sin exposición API, sin lectores ni escritores de aplicación. Uso futuro exclusivo desde RPC autorizadas de postgres.';
comment on table operativo_privado.historial_operativo is
  'Append-only. Sin backfill ni captura automática de flujos existentes. UUID históricos sin cascadas. Solicitud completa canónica y resultado conservados para reintentos.';
comment on table operativo_privado.versiones_pedido is
  'Versión de operaciones participantes, NO versión global del pedido. Las escrituras legacy no la incrementan; no activar concurrencia global antes de migrarlas.';
commit;
