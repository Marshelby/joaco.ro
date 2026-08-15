drop function public.guardar_direccion_cliente(uuid, text, text, text, uuid, text, boolean);

create function public.guardar_direccion_cliente(
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
set search_path = public
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

  select id, nombre, region into v_zona
  from public.zonas_entrega
  where id = p_zona_entrega_id
    and activa = true
    and region = 'Región de Valparaíso';

  if not found then
    raise exception 'ZONA_ENTREGA_INVALIDA';
  end if;

  select id into v_cliente_id
  from public.clientes
  where usuario_id = auth.uid() and activo = true;

  if v_cliente_id is null then
    raise exception 'CLIENTE_NO_ENCONTRADO';
  end if;

  if p_direccion_id is not null then
    select id into v_direccion_id
    from public.direcciones_cliente
    where id = p_direccion_id
      and cliente_id = v_cliente_id
      and activa = true;

    if v_direccion_id is null then
      raise exception 'DIRECCION_NO_ENCONTRADA';
    end if;
  end if;

  if coalesce(p_es_principal, false) then
    update public.direcciones_cliente
    set es_principal = false
    where cliente_id = v_cliente_id
      and activa = true
      and (p_direccion_id is null or id <> p_direccion_id);
  end if;

  if p_direccion_id is null then
    insert into public.direcciones_cliente (
      cliente_id, nombre, destinatario, telefono_contacto, direccion, comuna,
      region, zona_entrega_id, latitud, longitud, referencia, es_principal
    ) values (
      v_cliente_id, null, v_destinatario, v_telefono_contacto, v_direccion, v_zona.nombre,
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
    where id = v_direccion_id;
  end if;

  return v_direccion_id;
end;
$$;

alter function public.guardar_direccion_cliente(uuid, text, text, text, uuid, numeric, numeric, text, boolean) owner to postgres;

revoke all on function public.guardar_direccion_cliente(uuid, text, text, text, uuid, numeric, numeric, text, boolean) from public, anon, authenticated;
grant execute on function public.guardar_direccion_cliente(uuid, text, text, text, uuid, numeric, numeric, text, boolean) to authenticated;
