create table public.zonas_entrega (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  comuna_base text not null check (btrim(comuna_base) <> ''),
  region text not null default 'Región de Valparaíso' check (btrim(region) <> ''),
  activa boolean not null default true,
  orden integer not null default 0,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create trigger actualizar_zonas_entrega_fecha_actualizacion
before update on public.zonas_entrega
for each row execute function public.actualizar_fecha_actualizacion();

insert into public.zonas_entrega (nombre, slug, comuna_base, region, activa, orden)
values
  ('Quilpué', 'quilpue', 'Quilpué', 'Región de Valparaíso', true, 10),
  ('Villa Alemana', 'villa-alemana', 'Villa Alemana', 'Región de Valparaíso', true, 20),
  ('Peñablanca', 'penablanca', 'Villa Alemana', 'Región de Valparaíso', true, 30),
  ('Limache', 'limache', 'Limache', 'Región de Valparaíso', true, 40),
  ('Viña del Mar', 'vina-del-mar', 'Viña del Mar', 'Región de Valparaíso', true, 50),
  ('Valparaíso', 'valparaiso', 'Valparaíso', 'Región de Valparaíso', true, 60),
  ('Curauma', 'curauma', 'Valparaíso', 'Región de Valparaíso', true, 70),
  ('Concón', 'concon', 'Concón', 'Región de Valparaíso', true, 80),
  ('Placilla', 'placilla', 'Valparaíso', 'Región de Valparaíso', true, 90)
on conflict (slug) do update
set nombre = excluded.nombre,
    comuna_base = excluded.comuna_base,
    region = excluded.region,
    activa = excluded.activa,
    orden = excluded.orden;

alter table public.zonas_entrega enable row level security;

revoke all on public.zonas_entrega from public, anon, authenticated;
grant select, insert, update, delete on public.zonas_entrega to authenticated;

create policy zonas_entrega_lectura_activas
on public.zonas_entrega for select to authenticated
using (activa or public.es_admin());

create policy zonas_entrega_administracion
on public.zonas_entrega for all to authenticated
using (public.es_admin())
with check (public.es_admin());

alter table public.direcciones_cliente
add column zona_entrega_id uuid references public.zonas_entrega(id) on delete restrict;

create index direcciones_cliente_zona_entrega_id_idx
on public.direcciones_cliente (zona_entrega_id);

drop function public.guardar_direccion_cliente(uuid, text, text, text, text, text, text, text, boolean);

create function public.guardar_direccion_cliente(
  p_direccion_id uuid,
  p_destinatario text,
  p_telefono_contacto text,
  p_direccion text,
  p_zona_entrega_id uuid,
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
      region, zona_entrega_id, referencia, es_principal
    ) values (
      v_cliente_id, null, v_destinatario, v_telefono_contacto, v_direccion, v_zona.nombre,
      'Región de Valparaíso', v_zona.id, nullif(btrim(p_referencia), ''), coalesce(p_es_principal, false)
    ) returning id into v_direccion_id;
  else
    update public.direcciones_cliente
    set destinatario = v_destinatario,
        telefono_contacto = v_telefono_contacto,
        direccion = v_direccion,
        comuna = v_zona.nombre,
        region = 'Región de Valparaíso',
        zona_entrega_id = v_zona.id,
        referencia = nullif(btrim(p_referencia), ''),
        es_principal = coalesce(p_es_principal, false)
    where id = v_direccion_id;
  end if;

  return v_direccion_id;
end;
$$;

alter function public.guardar_direccion_cliente(uuid, text, text, text, uuid, text, boolean) owner to postgres;

revoke all on function public.guardar_direccion_cliente(uuid, text, text, text, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.guardar_direccion_cliente(uuid, text, text, text, uuid, text, boolean) to authenticated;
