-- Fase 1/3. Separación de direcciones sin cambiar identidades ni referencias.
-- Fuentes y límites: docs/13-FASE1-AMBITOS-DIRECCIONES.md.
begin;
set local lock_timeout = '5s';
set local search_path = pg_catalog;

-- Bloquea DML durante clasificación, comprobación de datos e intercambio de índice.
lock table public.direcciones_cliente in access exclusive mode;

-- Fallar cerrado ante políticas/triggers/sobrecargas no presentes en las fuentes
-- revisadas. No eliminar silenciosamente autorizaciones o lógica desconocidas.
do $$
begin
  if (select count(*) from pg_catalog.pg_policy
      where polrelid = 'public.direcciones_cliente'::regclass) <> 2
    or exists (select 1 from pg_catalog.pg_policy
      where polrelid = 'public.direcciones_cliente'::regclass and polname not in
        ('direcciones_cliente_lectura_propia', 'direcciones_cliente_administracion')) then
    raise exception 'BLOQUEO_POLITICAS_DIRECCIONES_NO_REVISADAS';
  end if;
  if (select count(*) from pg_catalog.pg_trigger where tgrelid =
      'public.direcciones_cliente'::regclass and not tgisinternal) <> 1
    or exists (select 1 from pg_catalog.pg_trigger where tgrelid =
      'public.direcciones_cliente'::regclass and not tgisinternal
      and tgname <> 'actualizar_direcciones_cliente_fecha_actualizacion') then
    raise exception 'BLOQUEO_TRIGGERS_DIRECCIONES_NO_REVISADOS';
  end if;
  if (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('guardar_direccion_cliente',
        'desactivar_direccion_cliente', 'obtener_cliente_administrativo',
        'guardar_cliente_administrativo', 'crear_pedido_desde_carrito')) <> 5
    or to_regprocedure('public.guardar_direccion_cliente(uuid,text,text,text,uuid,numeric,numeric,text,boolean)') is null
    or to_regprocedure('public.desactivar_direccion_cliente(uuid)') is null
    or to_regprocedure('public.obtener_cliente_administrativo(uuid)') is null
    or to_regprocedure('public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint)') is null
    or to_regprocedure('public.crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date,text[])') is null then
    raise exception 'BLOQUEO_SOBRECARGAS_DIRECCIONES_NO_REVISADAS';
  end if;
end;
$$;

-- DEFAULT sólo durante ADD COLUMN: clasifica filas previas sin UPDATE, sin tocar
-- fecha_actualizacion ni disparar triggers. El origen histórico NO está probado.
alter table public.direcciones_cliente
  add column ambito text not null default 'personal',
  add constraint direcciones_cliente_ambito_valido check (ambito in ('personal', 'comercial'));
alter table public.direcciones_cliente alter column ambito drop default;
comment on column public.direcciones_cliente.ambito is
  'personal/comercial. Históricas: personal provisional, origen no demostrado. Nuevas: literal de RPC servidor; reclasificación sólo mediante intervención privilegiada auditada (ver docs fase 1).';

-- La unicidad histórica cubría sólo principales ACTIVAS. No imponer unicidad a
-- inactivas ni exigir que haya una principal. Si hay deriva de datos, abortar;
-- nunca corregirla borrando filas o cambiando principales automáticamente.
do $$
begin
  if exists (select 1 from public.direcciones_cliente where es_principal and activa
      group by cliente_id, ambito having count(*) > 1) then
    raise exception 'BLOQUEO_PRINCIPALES_DUPLICADAS_REQUIERE_REVISION';
  end if;
end;
$$;
create unique index direcciones_cliente_una_principal_por_ambito
  on public.direcciones_cliente (cliente_id, ambito) where es_principal and activa;
drop index public.direcciones_cliente_una_principal_por_cliente;

-- Escrituras exclusivamente por RPC: ningún ámbito puede elegirse mediante DML
-- de los roles API. El owner postgres de las RPC conserva acceso transaccional.
revoke all on public.direcciones_cliente from public, anon, authenticated, service_role;
grant select on public.direcciones_cliente to authenticated;
alter table public.direcciones_cliente enable row level security;
drop policy direcciones_cliente_lectura_propia on public.direcciones_cliente;
drop policy direcciones_cliente_administracion on public.direcciones_cliente;
create policy direcciones_cliente_lectura_personal on public.direcciones_cliente
  for select to authenticated using (
    ambito = 'personal' and exists (select 1 from public.clientes c
      where c.id = cliente_id and c.usuario_id = auth.uid()));
-- Lectura operativa existente: el selector de conversión consulta la tabla
-- directamente y debe poder seleccionar ambos ámbitos. Esto no autoriza DML
-- ni amplía obtener/guardar_cliente_administrativo a direcciones personales.
create policy direcciones_cliente_lectura_operativa_admin on public.direcciones_cliente
  for select to authenticated using (public.es_admin());
-- Sin políticas INSERT/UPDATE/DELETE: también denegadas por RLS.

create or replace function public.guardar_direccion_cliente(
  p_direccion_id uuid,
  p_destinatario text,
  p_telefono_contacto text,
  p_direccion text,
  p_zona_entrega_id uuid,
  p_latitud numeric,
  p_longitud numeric,
  p_referencia text default null,
  p_es_principal boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_cliente_id uuid;
  v_direccion_id uuid;
  v_destinatario text := nullif(btrim(p_destinatario), '');
  v_direccion text := nullif(btrim(p_direccion), '');
  v_telefono_digitos text := regexp_replace(coalesce(p_telefono_contacto, ''), '[^0-9]', '', 'g');
  v_telefono_contacto text;
  v_zona record;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTORIZADO';
  end if;

  if v_destinatario is null then
    raise exception 'DESTINATARIO_REQUERIDO';
  end if;

  if v_direccion is null then
    raise exception 'DIRECCION_REQUERIDA';
  end if;

  if v_telefono_digitos !~ '^569[0-9]{8}$' then
    raise exception 'TELEFONO_INVALIDO';
  end if;
  v_telefono_contacto := '+' || v_telefono_digitos;

  if p_latitud is null or p_longitud is null then
    raise exception 'UBICACION_REQUERIDA';
  end if;

  if p_latitud < -90 or p_latitud > 90 or p_longitud < -180 or p_longitud > 180 then
    raise exception 'UBICACION_INVALIDA';
  end if;

  select id into v_cliente_id
  from public.clientes
  where usuario_id = auth.uid() and activo = true for update;

  if v_cliente_id is null then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;

  -- Mismo orden que administración/conversión: cliente -> direcciones -> zona.
  perform d.id from public.direcciones_cliente d
    where d.cliente_id = v_cliente_id and d.ambito = 'personal' order by d.id for update;

  select id, nombre, region into v_zona
  from public.zonas_entrega
  where id = p_zona_entrega_id
    and activa = true
    and region = 'Región de Valparaíso'
  for share;

  if not found then
    raise exception 'ZONA_ENTREGA_INVALIDA';
  end if;

  if p_direccion_id is not null then
    select id into v_direccion_id
    from public.direcciones_cliente
    where id = p_direccion_id
      and cliente_id = v_cliente_id
      and ambito = 'personal'
      and activa = true;

    if v_direccion_id is null then
      raise exception 'DIRECCION_NO_ENCONTRADA';
    end if;
  end if;

  if coalesce(p_es_principal, false) then
    update public.direcciones_cliente
    set es_principal = false
    where cliente_id = v_cliente_id
      and ambito = 'personal'
      and activa = true
      and (p_direccion_id is null or id <> p_direccion_id);
  end if;

  if p_direccion_id is null then
    insert into public.direcciones_cliente (
      cliente_id, ambito, nombre, destinatario, telefono_contacto, direccion, comuna,
      region, zona_entrega_id, latitud, longitud, referencia, es_principal
    ) values (
      v_cliente_id, 'personal', null, v_destinatario, v_telefono_contacto, v_direccion, v_zona.nombre,
      'Región de Valparaíso', v_zona.id, p_latitud, p_longitud, nullif(btrim(p_referencia), ''), coalesce(p_es_principal, false)
    ) returning id into v_direccion_id;
  else
    update public.direcciones_cliente
    set destinatario = v_destinatario,
        telefono_contacto = v_telefono_contacto,
        direccion = v_direccion,
        comuna = v_zona.nombre,
        region = 'Región de Valparaíso',
        zona_entrega_id = v_zona.id,
        latitud = p_latitud,
        longitud = p_longitud,
        referencia = nullif(btrim(p_referencia), ''),
        es_principal = coalesce(p_es_principal, false)
    where id = v_direccion_id and cliente_id = v_cliente_id and ambito = 'personal';
  end if;

  return v_direccion_id;
end;
$$;

alter function public.guardar_direccion_cliente(uuid, text, text, text, uuid, numeric, numeric, text, boolean) owner to postgres;

revoke all on function public.guardar_direccion_cliente(uuid, text, text, text, uuid, numeric, numeric, text, boolean) from public, anon, authenticated;
grant execute on function public.guardar_direccion_cliente(uuid, text, text, text, uuid, numeric, numeric, text, boolean) to authenticated;

create or replace function public.desactivar_direccion_cliente(
  p_direccion_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_cliente_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NO_AUTORIZADO';
  end if;

  select id into v_cliente_id
  from public.clientes
  where usuario_id = auth.uid() and activo = true for update;

  if v_cliente_id is null then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;

  update public.direcciones_cliente
  set activa = false,
      es_principal = false
  where id = p_direccion_id
    and cliente_id = v_cliente_id
    and ambito = 'personal'
    and activa = true;

  if not found then
    raise exception 'DIRECCION_NO_ENCONTRADA';
  end if;
end;
$$;


create or replace function public.obtener_cliente_administrativo(p_cliente_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = pg_catalog set timezone = 'UTC' as $$
declare v_ficha jsonb;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  select jsonb_build_object('cliente', to_jsonb(c), 'direcciones',
    coalesce((select jsonb_agg(to_jsonb(d) order by d.id)
      from public.direcciones_cliente d where d.cliente_id = c.id and d.ambito = 'comercial'), '[]'::jsonb))
  into v_ficha from public.clientes c where c.id = p_cliente_id;
  if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
  return v_ficha || jsonb_build_object('revision', encode(public.pp_huella(v_ficha), 'hex'));
end;
$$;

create or replace function public.guardar_cliente_administrativo(
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
    -- Mantener el comprobante original y la huella de solicitud. Un comprobante
    -- previo a ambito no acredita origen comercial: no devolver sus direcciones.
    -- Revisión calculada sobre la misma ficha filtrada, igual que la lectura.
    v_resultado := v_operacion.resultado || jsonb_build_object('direcciones',
      coalesce((select jsonb_agg(d.value order by (d.value ->> 'id')::uuid)
        from jsonb_array_elements(v_operacion.resultado -> 'direcciones') d(value)
        where d.value ->> 'ambito' = 'comercial'
          and exists (select 1 from public.direcciones_cliente actual
            where actual.id = (d.value ->> 'id')::uuid
              and actual.cliente_id = (v_operacion.resultado ->> 'cliente_id')::uuid
              and actual.ambito = 'comercial')), '[]'::jsonb));
    return v_resultado || jsonb_build_object('revision', encode(public.pp_huella(
      jsonb_build_object('cliente', v_resultado -> 'cliente',
        'direcciones', v_resultado -> 'direcciones')), 'hex'));
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
    perform d.id from public.direcciones_cliente d where d.cliente_id = v_id and d.ambito = 'comercial' order by d.id for update;
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
      if not exists (select 1 from public.direcciones_cliente d where d.id = v_did and d.cliente_id = v_id and d.ambito = 'comercial') then
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
    update public.direcciones_cliente set es_principal = false where cliente_id = v_id and ambito = 'comercial' and es_principal;
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
      insert into public.direcciones_cliente (cliente_id, ambito, nombre, destinatario, telefono_contacto,
        direccion, comuna, region, zona_entrega_id, referencia, latitud, longitud, es_principal, activa)
      values (v_id, 'comercial', v_direccion.nombre, v_direccion.destinatario, v_direccion.telefono_contacto,
        v_direccion.direccion, v_direccion.comuna, v_direccion.region, v_direccion.zona_entrega_id,
        v_direccion.referencia, v_direccion.latitud, v_direccion.longitud, v_direccion.es_principal, v_direccion.activa);
    else
      update public.direcciones_cliente set nombre = v_direccion.nombre, destinatario = v_direccion.destinatario,
        telefono_contacto = v_direccion.telefono_contacto, direccion = v_direccion.direccion,
        comuna = v_direccion.comuna, region = v_direccion.region, zona_entrega_id = v_direccion.zona_entrega_id,
        referencia = v_direccion.referencia, latitud = v_direccion.latitud, longitud = v_direccion.longitud,
        es_principal = v_direccion.es_principal, activa = v_direccion.activa
      where id = v_did and cliente_id = v_id and ambito = 'comercial';
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

-- Checkout web vigente (7 parámetros). No reintroducir firmas retiradas.
create or replace function public.crear_pedido_desde_carrito(
  p_cliente_id uuid,
  p_direccion_cliente_id uuid,
  p_items jsonb,
  p_observacion text,
  p_clave_idempotencia uuid,
  p_fecha_entrega date,
  p_metodos_pago_previstos text[]
)
returns table (
  pedido_id uuid,
  numero_pedido text,
  estado public.estado_pedido,
  subtotal bigint,
  costo_entrega bigint,
  descuento bigint,
  total bigint
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_es_admin boolean;
  v_cliente public.clientes%rowtype;
  v_direccion public.direcciones_cliente%rowtype;
  v_pedido public.pedidos%rowtype;
  v_pedido_existente public.pedidos%rowtype;
  v_presentacion record;
  v_item jsonb;
  v_presentacion_id uuid;
  v_cantidad numeric;
  v_texto_presentacion_id text;
  v_presentaciones uuid[] := array[]::uuid[];
  v_subtotal bigint;
  v_costo_entrega bigint;
  v_observacion_normalizada text;
  v_zona_entrega_snapshot text;
  v_hoy_local date;
  v_modo_cantidad_snapshot text;
  v_metodos_pago_previstos text[];
begin
  if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
  if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
  if p_metodos_pago_previstos is null or cardinality(p_metodos_pago_previstos) = 0 then
    raise exception 'METODOS_PAGO_PREVISTOS_REQUERIDOS';
  end if;
  if array_position(p_metodos_pago_previstos, null) is not null
    or not (p_metodos_pago_previstos <@ array['efectivo', 'transferencia', 'tarjeta']::text[])
    or cardinality(p_metodos_pago_previstos) <>
      (case when 'efectivo' = any(p_metodos_pago_previstos) then 1 else 0 end
      + case when 'transferencia' = any(p_metodos_pago_previstos) then 1 else 0 end
      + case when 'tarjeta' = any(p_metodos_pago_previstos) then 1 else 0 end) then
    raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
  end if;
  select array_agg(metodo order by posicion)
  into v_metodos_pago_previstos
  from unnest(array['efectivo', 'transferencia', 'tarjeta']::text[]) with ordinality as metodos(metodo, posicion)
  where metodo = any(p_metodos_pago_previstos);

  v_es_admin := coalesce(public.es_admin(), false);
  select * into v_cliente from public.clientes c where c.id = p_cliente_id and c.activo = true for share;
  if not found then raise exception 'CLIENTE_INVALIDO'; end if;
  if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;

  select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
  if found then
    if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
    return;
  end if;

  if p_fecha_entrega is null then raise exception 'FECHA_ENTREGA_REQUERIDA'; end if;
  v_hoy_local := (now() at time zone 'America/Santiago')::date;
  if p_fecha_entrega < v_hoy_local or p_fecha_entrega > v_hoy_local + 14 then raise exception 'FECHA_ENTREGA_INVALIDA'; end if;
  if not public.fecha_entrega_disponible(p_fecha_entrega) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
  if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;

  select * into v_direccion from public.direcciones_cliente d where d.id = p_direccion_cliente_id and d.cliente_id = p_cliente_id and d.activa = true and d.ambito = 'personal' for share;
  if not found then raise exception 'DIRECCION_INVALIDA'; end if;
  if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
  select z.nombre into v_zona_entrega_snapshot from public.zonas_entrega z where z.id = v_direccion.zona_entrega_id and z.activa = true for share;
  if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;

  v_observacion_normalizada := nullif(btrim(coalesce(p_observacion, '')), '');
  insert into public.pedidos (
    cliente_id, canal_origen, estado, nombre_cliente_snapshot, telefono_cliente_snapshot, email_cliente_snapshot,
    direccion_cliente_id, direccion_snapshot, comuna_snapshot, region_snapshot, referencia_direccion_snapshot,
    destinatario_entrega_snapshot, telefono_contacto_entrega_snapshot, zona_entrega_snapshot, latitud_entrega_snapshot, longitud_entrega_snapshot,
    subtotal, costo_entrega, descuento, total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos
  ) values (
    p_cliente_id, 'web', 'recibido', v_cliente.nombre, v_cliente.telefono, v_cliente.email,
    p_direccion_cliente_id, v_direccion.direccion, v_direccion.comuna, v_direccion.region, v_direccion.referencia,
    coalesce(v_direccion.destinatario, v_direccion.nombre), v_direccion.telefono_contacto, v_zona_entrega_snapshot, v_direccion.latitud, v_direccion.longitud,
    0, 0, 0, 0, v_observacion_normalizada, p_fecha_entrega, p_clave_idempotencia, v_metodos_pago_previstos
  ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;

  if v_pedido.id is null then
    select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
    if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
    v_texto_presentacion_id := nullif(btrim(v_item ->> 'presentacion_id'), '');
    if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
    if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
    v_presentacion_id := v_texto_presentacion_id::uuid;
    v_cantidad := (v_item ->> 'cantidad')::numeric;
    if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
    v_presentaciones := array_append(v_presentaciones, v_presentacion_id);
    select pp.id, pp.producto_id, pp.nombre as nombre_presentacion, pp.cantidad as cantidad_presentacion, pp.unidad, pp.precio_neto, pp.precio_final, pr.nombre as nombre_producto
    into v_presentacion from public.presentaciones_producto pp join public.productos pr on pr.id = pp.producto_id
    where pp.id = v_presentacion_id and pp.activa = true and pp.es_principal = true and pr.activo = true and pr.disponible = true for share of pp, pr;
    if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
    if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
    v_modo_cantidad_snapshot := case when public.es_presentacion_kg_fraccionable(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion) then 'kg_fraccionable' when lower(coalesce(v_presentacion.nombre_presentacion, '')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada' else 'unidad' end;
    insert into public.items_pedido (pedido_id,producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_neto_unitario_snapshot,precio_final_unitario_snapshot,total_linea,observacion_cliente,modo_cantidad_snapshot)
    values (v_pedido.id,v_presentacion.producto_id,v_presentacion.id,v_presentacion.nombre_producto,v_presentacion.nombre_presentacion,v_presentacion.unidad,v_cantidad,v_presentacion.precio_neto,v_presentacion.precio_final,round(v_cantidad * v_presentacion.precio_final)::bigint,null,v_modo_cantidad_snapshot);
  end loop;

  select coalesce(sum(i.total_linea), 0)::bigint into v_subtotal from public.items_pedido i where i.pedido_id = v_pedido.id;
  v_costo_entrega := case when v_subtotal < 25000 then 2000 else 0 end;
  update public.pedidos set subtotal = v_subtotal, costo_entrega = v_costo_entrega, descuento = 0, total = v_subtotal + v_costo_entrega where id = v_pedido.id returning * into v_pedido;
  return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;
end;
$$;

alter function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date, text[]) owner to postgres;
revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date, text[]) from public, anon, authenticated;
grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date, text[]) to authenticated;

-- Reafirmar owner/ACL de toda RPC reemplazada, también service_role.
alter function public.desactivar_direccion_cliente(uuid) owner to postgres;
revoke all on function
  public.guardar_direccion_cliente(uuid,text,text,text,uuid,numeric,numeric,text,boolean),
  public.desactivar_direccion_cliente(uuid),
  public.obtener_cliente_administrativo(uuid),
  public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint),
  public.crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date,text[])
  from public, anon, authenticated, service_role;
grant execute on function
  public.guardar_direccion_cliente(uuid,text,text,text,uuid,numeric,numeric,text,boolean),
  public.desactivar_direccion_cliente(uuid),
  public.obtener_cliente_administrativo(uuid),
  public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint),
  public.crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date,text[]) to authenticated;

commit;
