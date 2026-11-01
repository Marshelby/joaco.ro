-- Fase 1: sólo fichas comerciales y direcciones; no crea identidades Auth.
-- Dependencias: pp_huella, pp_bloquear_admin, pp_exigir_abierto y
-- asociar_cliente_posible_pedido de 20261022012000; esquema logístico de direcciones.
-- No sustituye autogestión, conversión, invitaciones ni funciones contables.
-- Contrato fase 2:
-- obtener_cliente_administrativo devuelve ficha, direcciones y revision opaca.
-- guardar: p_cliente_id NULL crea; edición exige revision de la lectura anterior.
-- p_cliente es documento completo: nombre, telefono, email, observaciones, activo.
-- p_direcciones es una lista de upserts completos (máx. 50); omitir una dirección
-- NO la borra. id NULL crea; id existente sólo puede pertenecer a esta ficha.
-- Cada dirección: id, nombre/destinatario/telefono_contacto nullable, direccion,
-- comuna, region nullable (derivada si es unívoca), zona_entrega_id opcional, referencia, latitud, longitud,
-- es_principal, activa. Desactivar conserva identidad e historia.
-- Reintento: mismos argumentos y UUID; devuelve respuesta original, luego refrescar.
-- Con posible pedido: ambos parámetros no nulos; asociación usa la misma clave,
-- versión y RPC existentes. Un fallo revierte ficha, direcciones y asociación.
-- Alcance: los grants/RLS administrativos preexistentes de clientes/direcciones
-- se conservan. DML directo no participa del protocolo idempotente de esta RPC.
-- Coincidencias informativas al guardar, incluidas fichas inactivas: comparación
-- exacta de dígitos/correo sin inferir país, identidad ni autorización de acceso.
-- No hay informe específico de auditoría de clientes en las fuentes locales;
-- compatibilidad revisada contra migraciones y docs/09-POSIBLES-PEDIDOS-RPCS.md.
-- Validación de ejecución/concurrencia pendiente en entorno aislado (fase 2).

begin;

-- El CHECK original btrim(region) <> '' admite NULL (UNKNOWN), pero sigue
-- rechazando texto vacío. No se modifica zonas_entrega ni la autogestión.
alter table public.direcciones_cliente alter column region drop not null;

create table public.operaciones_clientes_administrativas (
  clave_operacion uuid primary key,
  administrador_id uuid not null,
  huella bytea not null,
  resultado jsonb not null,
  fecha_creacion timestamptz not null default now()
);
alter table public.operaciones_clientes_administrativas owner to postgres;
alter table public.operaciones_clientes_administrativas enable row level security;
revoke all on public.operaciones_clientes_administrativas from public, anon, authenticated, service_role;
-- Sin políticas: sólo la RPC propietaria accede; no expone PII ni permite
-- manipular/eliminar comprobantes desde roles de aplicación.

create function public.obtener_cliente_administrativo(p_cliente_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog set timezone = 'UTC' as $$
declare v_ficha jsonb;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  select jsonb_build_object('cliente', to_jsonb(c), 'direcciones',
    coalesce((select jsonb_agg(to_jsonb(d) order by d.id)
      from public.direcciones_cliente d where d.cliente_id = c.id), '[]'::jsonb))
  into v_ficha from public.clientes c where c.id = p_cliente_id;
  if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
  return v_ficha || jsonb_build_object('revision', encode(public.pp_huella(v_ficha), 'hex'));
end;
$$;

create function public.guardar_cliente_administrativo(
  p_clave_operacion uuid,
  p_cliente_id uuid,
  p_revision_esperada text,
  p_cliente jsonb,
  p_direcciones jsonb default '[]'::jsonb,
  p_posible_pedido_id uuid default null,
  p_version_posible_pedido bigint default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_huella bytea; v_operacion public.operaciones_clientes_administrativas%rowtype;
  v_p public.posibles_pedidos%rowtype; v_id uuid; v_d jsonb; v_k text; v_tipo text;
  v_nombre text; v_telefono text; v_email text; v_activo boolean;
  v_did uuid; v_zid uuid; v_lat numeric; v_lon numeric;
  v_region text;
  v_ids uuid[] := array[]::uuid[]; v_zonas uuid[] := array[]::uuid[];
  v_nprincipales integer := 0; v_asociacion jsonb; v_resultado jsonb; v_coincidencias jsonb;
  v_direccion public.direcciones_cliente%rowtype;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_clave_operacion is null then raise exception 'CLAVE_OPERACION_REQUERIDA'; end if;
  if jsonb_typeof(p_cliente) is distinct from 'object'
    or jsonb_typeof(p_direcciones) is distinct from 'array' then
    raise exception 'DOCUMENTO_INVALIDO';
  end if;
  if octet_length(p_cliente::text) > 16384 or octet_length(p_direcciones::text) > 131072
    or jsonb_array_length(p_direcciones) > 50 then raise exception 'LIMITE_SOLICITUD'; end if;
  if (p_posible_pedido_id is null) <> (p_version_posible_pedido is null) then
    raise exception 'ASOCIACION_INCOMPLETA';
  end if;
  v_huella := public.pp_huella(jsonb_build_object('cliente_id', p_cliente_id,
    'revision', p_revision_esperada, 'cliente', p_cliente, 'direcciones', p_direcciones,
    'posible_pedido_id', p_posible_pedido_id, 'version', p_version_posible_pedido));
  -- Serializa incluso creaciones sin cliente_id. Namespace exclusivo, antes de
  -- cualquier fila. Colisiones de hash sólo serializan operaciones independientes.
  perform pg_advisory_xact_lock(hashtextextended('guardar_cliente_administrativo:' || p_clave_operacion::text, 0));
  select o.* into v_operacion from public.operaciones_clientes_administrativas o
    where o.clave_operacion = p_clave_operacion;
  if found then
    if v_operacion.administrador_id is distinct from auth.uid() or v_operacion.huella <> v_huella then
      raise exception 'CLAVE_OPERACION_EN_USO';
    end if;
    return v_operacion.resultado;
  end if;
  -- Orden compartido con conversión: posible pedido -> cliente -> direcciones
  -- (UUID ascendente) -> zonas (UUID ascendente). Nunca adquirir PP tras cliente.
  if p_posible_pedido_id is not null then
    v_p := public.pp_bloquear_admin(p_posible_pedido_id, p_version_posible_pedido, p_clave_operacion);
    -- Una clave usada directamente por otra RPC no autoriza nuevas mutaciones.
    if exists (select 1 from public.historial_posibles_pedidos h
      where h.posible_pedido_id = p_posible_pedido_id and h.clave_operacion = p_clave_operacion) then
      raise exception 'CLAVE_OPERACION_EN_USO';
    end if;
    perform public.pp_exigir_abierto(v_p, p_version_posible_pedido);
  end if;
  if (p_cliente - array['nombre','telefono','email','observaciones','activo']) <> '{}'::jsonb
    or not (p_cliente ?& array['nombre','telefono','email','observaciones','activo']) then
    raise exception 'CAMPOS_CLIENTE_INVALIDOS';
  end if;
  for v_k, v_tipo in select key, jsonb_typeof(value) from jsonb_each(p_cliente) loop
    if (v_k = 'activo' and v_tipo <> 'boolean')
      or (v_k = 'nombre' and v_tipo <> 'string')
      or (v_k in ('telefono','email','observaciones') and v_tipo not in ('string','null')) then
      raise exception 'TIPO_CLIENTE_INVALIDO';
    end if;
  end loop;
  v_nombre := nullif(btrim(p_cliente ->> 'nombre'), '');
  v_telefono := nullif(regexp_replace(coalesce(p_cliente ->> 'telefono',''), '[^0-9]', '', 'g'), '');
  v_email := nullif(lower(btrim(p_cliente ->> 'email')), '');
  v_activo := (p_cliente ->> 'activo')::boolean;
  if v_nombre is null or length(v_nombre) > 200 then raise exception 'NOMBRE_INVALIDO'; end if;
  if (nullif(btrim(p_cliente ->> 'telefono'), '') is not null and v_telefono is null)
    or (v_telefono is not null and v_telefono !~ '^[0-9]{8,15}$') then raise exception 'TELEFONO_INVALIDO'; end if;
  if v_email is not null and (length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'EMAIL_INVALIDO'; end if;
  if length(coalesce(p_cliente ->> 'observaciones','')) > 4000 then raise exception 'OBSERVACIONES_INVALIDAS'; end if;
  if p_cliente_id is null then
    if p_revision_esperada is not null then raise exception 'REVISION_INVALIDA'; end if;
    if coalesce(p_cliente ->> 'telefono','') !~ '^\+569[0-9]{8}$' then
      raise exception 'TELEFONO_INVALIDO';
    end if;
    insert into public.clientes (usuario_id, nombre, telefono, email, observaciones, activo)
      values (null, v_nombre, case when v_telefono is not null then '+' || v_telefono end,
        v_email, nullif(btrim(p_cliente ->> 'observaciones'),''), v_activo) returning id into v_id;
  else
    perform 1 from public.clientes c where c.id = p_cliente_id for update;
    if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
    v_id := p_cliente_id;
    perform d.id from public.direcciones_cliente d where d.cliente_id = v_id order by d.id for update;
    if p_revision_esperada is null or p_revision_esperada is distinct from
      (public.obtener_cliente_administrativo(v_id) ->> 'revision') then
      raise exception 'CLIENTE_DESACTUALIZADO' using errcode = '40001';
    end if;
    update public.clientes set nombre = v_nombre,
      telefono = case when v_telefono is not null then '+' || v_telefono end,
      email = v_email, observaciones = nullif(btrim(p_cliente ->> 'observaciones'),''), activo = v_activo
      where id = v_id;
  end if;
  -- Validar todo antes de escribir direcciones; no se aceptan campos de ownership.
  for v_d in select value from jsonb_array_elements(p_direcciones) loop
    if jsonb_typeof(v_d) is distinct from 'object' then raise exception 'DIRECCION_INVALIDA'; end if;
    if (v_d - array['id','nombre','destinatario','telefono_contacto','direccion','comuna','region',
      'zona_entrega_id','referencia','latitud','longitud','es_principal','activa']) <> '{}'::jsonb
      or not (v_d ?& array['nombre','telefono_contacto','direccion','comuna','region',
        'latitud','longitud','es_principal','activa']) then
      raise exception 'CAMPOS_DIRECCION_INVALIDOS';
    end if;
    for v_k, v_tipo in select key, jsonb_typeof(value) from jsonb_each(v_d) loop
      if (v_k in ('es_principal','activa') and v_tipo <> 'boolean')
        or (v_k in ('latitud','longitud') and v_tipo not in ('number','null'))
        or (v_k not in ('es_principal','activa','latitud','longitud') and v_tipo not in ('string','null')) then
        raise exception 'TIPO_DIRECCION_INVALIDO';
      end if;
      if v_tipo = 'string' and length(v_d ->> v_k) > 1000 then raise exception 'DIRECCION_DEMASIADO_LARGA'; end if;
    end loop;
    if nullif(btrim(v_d ->> 'direccion'),'') is null
      or nullif(btrim(v_d ->> 'comuna'),'') is null
      or ((v_d ->> 'nombre') is not null and nullif(btrim(v_d ->> 'nombre'),'') is null)
      or ((v_d ->> 'region') is not null and nullif(btrim(v_d ->> 'region'),'') is null)
      or ((v_d ->> 'telefono_contacto') is not null and
        (length(v_d ->> 'telefono_contacto') > 100 or
        regexp_replace(v_d ->> 'telefono_contacto', '[^0-9]', '', 'g') !~ '^[0-9]{8,15}$')) then
      raise exception 'DIRECCION_INCOMPLETA';
    end if;
    v_lat := (v_d ->> 'latitud')::numeric; v_lon := (v_d ->> 'longitud')::numeric;
    if (v_lat is null) <> (v_lon is null) or (v_lat is not null and
      not (v_lat between -90 and 90 and v_lon between -180 and 180)) then raise exception 'UBICACION_INVALIDA'; end if;
    v_did := (v_d ->> 'id')::uuid;
    if v_did is not null then
      if v_did = any(v_ids) then raise exception 'DIRECCION_DUPLICADA'; end if;
      v_ids := array_append(v_ids, v_did);
      if not exists (select 1 from public.direcciones_cliente d where d.id = v_did and d.cliente_id = v_id) then
        raise exception 'DIRECCION_NO_PERTENECE_AL_CLIENTE';
      end if;
    end if;
    if (v_d ->> 'es_principal')::boolean then
      if not (v_d ->> 'activa')::boolean then raise exception 'PRINCIPAL_INACTIVA'; end if;
      v_nprincipales := v_nprincipales + 1;
    end if;
    v_zid := (v_d ->> 'zona_entrega_id')::uuid;
    if v_zid is not null then v_zonas := array_append(v_zonas, v_zid); end if;
  end loop;
  if v_nprincipales > 1 then raise exception 'MULTIPLES_DIRECCIONES_PRINCIPALES'; end if;
  perform z.id from public.zonas_entrega z where z.id = any(v_zonas) order by z.id for share;
  if exists (select 1 from unnest(v_zonas) z(id) where not exists
    (select 1 from public.zonas_entrega e where e.id = z.id and e.activa)) then raise exception 'ZONA_INVALIDA'; end if;
  if v_nprincipales = 1 then
    update public.direcciones_cliente set es_principal = false where cliente_id = v_id and es_principal;
  end if;
  for v_d in select value from jsonb_array_elements(p_direcciones) loop
    v_did := (v_d ->> 'id')::uuid;
    -- Documento completo: null en ambos ejes conserva una dirección escrita;
    -- al editar permite retirar ubicación previa explícitamente. No geocodifica.
    v_direccion := null;
    v_direccion.nombre := nullif(btrim(v_d ->> 'nombre'),'');
    v_direccion.destinatario := nullif(btrim(v_d ->> 'destinatario'),'');
    v_direccion.telefono_contacto := '+' || nullif(regexp_replace(v_d ->> 'telefono_contacto', '[^0-9]', '', 'g'), '');
    v_direccion.direccion := btrim(v_d ->> 'direccion');
    v_direccion.comuna := btrim(v_d ->> 'comuna');
    v_region := nullif(btrim(v_d ->> 'region'),'');
    if v_region is null then
      -- Compara comuna_base ignorando espacios exteriores, mayúsculas y tildes.
      -- Incluye zonas inactivas para detectar también ambigüedades históricas.
      -- Varias zonas de la misma comuna/región no constituyen ambigüedad.
      select case when count(distinct btrim(z.region)) = 1 then min(btrim(z.region)) end
        into v_region from public.zonas_entrega z
        where translate(lower(btrim(z.comuna_base)), 'áéíóúü', 'aeiouu')
          = translate(lower(v_direccion.comuna), 'áéíóúü', 'aeiouu');
    end if;
    v_direccion.region := v_region;
    v_direccion.zona_entrega_id := (v_d ->> 'zona_entrega_id')::uuid;
    v_direccion.referencia := nullif(btrim(v_d ->> 'referencia'),'');
    v_direccion.latitud := (v_d ->> 'latitud')::numeric; v_direccion.longitud := (v_d ->> 'longitud')::numeric;
    v_direccion.es_principal := (v_d ->> 'es_principal')::boolean;
    v_direccion.activa := (v_d ->> 'activa')::boolean;
    if v_did is null then
      insert into public.direcciones_cliente (cliente_id, nombre, destinatario, telefono_contacto,
        direccion, comuna, region, zona_entrega_id, referencia, latitud, longitud, es_principal, activa)
      values (v_id, v_direccion.nombre, v_direccion.destinatario, v_direccion.telefono_contacto,
        v_direccion.direccion, v_direccion.comuna, v_direccion.region, v_direccion.zona_entrega_id,
        v_direccion.referencia, v_direccion.latitud, v_direccion.longitud, v_direccion.es_principal, v_direccion.activa);
    else
      update public.direcciones_cliente set nombre = v_direccion.nombre, destinatario = v_direccion.destinatario,
        telefono_contacto = v_direccion.telefono_contacto, direccion = v_direccion.direccion,
        comuna = v_direccion.comuna, region = v_direccion.region, zona_entrega_id = v_direccion.zona_entrega_id,
        referencia = v_direccion.referencia, latitud = v_direccion.latitud, longitud = v_direccion.longitud,
        es_principal = v_direccion.es_principal, activa = v_direccion.activa
      where id = v_did and cliente_id = v_id;
    end if;
  end loop;
  if p_posible_pedido_id is not null then
    -- Cabecera ya bloqueada; la RPC conserva versión, evento e idempotencia propios.
    v_asociacion := public.asociar_cliente_posible_pedido(p_posible_pedido_id,
      p_version_posible_pedido, p_clave_operacion, v_id);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('cliente_id', c.id, 'nombre', c.nombre,
    'por_telefono', v_telefono is not null and regexp_replace(coalesce(c.telefono,''),'[^0-9]','','g') = v_telefono,
    'por_email', v_email is not null and lower(btrim(c.email)) = v_email) order by c.id), '[]'::jsonb)
  into v_coincidencias from public.clientes c where c.id <> v_id and
    ((v_telefono is not null and regexp_replace(coalesce(c.telefono,''),'[^0-9]','','g') = v_telefono)
      or (v_email is not null and lower(btrim(c.email)) = v_email));
  v_resultado := public.obtener_cliente_administrativo(v_id) || jsonb_build_object(
    'cliente_id', v_id, 'coincidencias', v_coincidencias, 'asociacion', v_asociacion);
  insert into public.operaciones_clientes_administrativas (clave_operacion, administrador_id, huella, resultado)
    values (p_clave_operacion, auth.uid(), v_huella, v_resultado);
  return v_resultado;
end;
$$;

alter function public.obtener_cliente_administrativo(uuid) owner to postgres;
alter function public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint) owner to postgres;
revoke all on function public.obtener_cliente_administrativo(uuid),
  public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.obtener_cliente_administrativo(uuid),
  public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint) to authenticated;

commit;
