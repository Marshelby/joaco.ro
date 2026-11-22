begin;

create function public.rut_facturacion_valido(p_rut text)
returns boolean
language plpgsql immutable strict
set search_path = pg_catalog
as $$
declare
  v_cuerpo text;
  v_suma integer := 0;
  v_digito integer;
begin
  if p_rut !~ '^[1-9][0-9]{0,7}-[0-9K]$' then
    return false;
  end if;
  v_cuerpo := split_part(p_rut, '-', 1);
  for i in 1..length(v_cuerpo) loop
    v_suma := v_suma + substr(v_cuerpo, length(v_cuerpo) - i + 1, 1)::integer * (2 + (i - 1) % 6);
  end loop;
  v_digito := (11 - v_suma % 11) % 11;
  return right(p_rut, 1) = case when v_digito = 10 then 'K' else v_digito::text end;
end;
$$;

create table public.clientes_datos_facturacion (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  rut text not null check (public.rut_facturacion_valido(rut)),
  razon_social text not null check (length(razon_social) between 1 and 200 and razon_social = btrim(razon_social) and razon_social ~ '[^[:space:]]' and razon_social !~ '[[:cntrl:]]'),
  giro_comercial text not null check (length(giro_comercial) between 1 and 200 and giro_comercial = btrim(giro_comercial) and giro_comercial ~ '[^[:space:]]' and giro_comercial !~ '[[:cntrl:]]'),
  direccion_tributaria text not null check (length(direccion_tributaria) between 1 and 250 and direccion_tributaria = btrim(direccion_tributaria) and direccion_tributaria ~ '[^[:space:]]' and direccion_tributaria !~ '[[:cntrl:]]'),
  comuna text not null check (length(comuna) between 1 and 100 and comuna = btrim(comuna) and comuna ~ '[^[:space:]]' and comuna !~ '[[:cntrl:]]'),
  ciudad text not null check (length(ciudad) between 1 and 100 and ciudad = btrim(ciudad) and ciudad ~ '[^[:space:]]' and ciudad !~ '[[:cntrl:]]'),
  correo_facturacion text not null check (
    length(correo_facturacion) <= 254
    and length(split_part(correo_facturacion, '@', 1)) <= 64
    and correo_facturacion = lower(correo_facturacion)
    and correo_facturacion ~ '^[a-z0-9!#$%&''*+/=?^_`{|}~-]+([.][a-z0-9!#$%&''*+/=?^_`{|}~-]+)*@[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
  ),
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

alter table public.clientes_datos_facturacion owner to postgres;
alter function public.rut_facturacion_valido(text) owner to postgres;
alter table public.clientes_datos_facturacion enable row level security;
revoke all on public.clientes_datos_facturacion from public, anon, authenticated, service_role;
grant select on public.clientes_datos_facturacion to authenticated;
create policy clientes_datos_facturacion_lectura_admin
  on public.clientes_datos_facturacion for select to authenticated
  using ((select auth.uid()) is not null and (select public.es_admin()));

revoke all on function public.rut_facturacion_valido(text) from public, anon, authenticated, service_role;

create function public.guardar_datos_facturacion_cliente(
  p_cliente_id uuid,
  p_rut text,
  p_razon_social text,
  p_giro_comercial text,
  p_direccion_tributaria text,
  p_comuna text,
  p_ciudad text,
  p_correo_facturacion text
)
returns void
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_rut text := upper(btrim(p_rut));
  v_compacto text;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;

  if v_rut is null or v_rut !~ '^([0-9]{1,8}-?|[0-9]{1,3}([.][0-9]{3}){1,2}-)[0-9K]$' then
    raise exception 'RUT_INVALIDO' using errcode = '22023';
  end if;
  v_compacto := translate(v_rut, '.-', '');
  v_rut := ltrim(left(v_compacto, -1), '0') || '-' || right(v_compacto, 1);
  if not public.rut_facturacion_valido(v_rut) then
    raise exception 'RUT_INVALIDO' using errcode = '22023';
  end if;

  insert into public.clientes_datos_facturacion as ficha (
    cliente_id, rut, razon_social, giro_comercial, direccion_tributaria, comuna, ciudad, correo_facturacion
  ) values (
    p_cliente_id, v_rut, btrim(p_razon_social), btrim(p_giro_comercial),
    btrim(p_direccion_tributaria), btrim(p_comuna), btrim(p_ciudad), lower(btrim(p_correo_facturacion))
  )
  on conflict (cliente_id) do update set
    rut = excluded.rut,
    razon_social = excluded.razon_social,
    giro_comercial = excluded.giro_comercial,
    direccion_tributaria = excluded.direccion_tributaria,
    comuna = excluded.comuna,
    ciudad = excluded.ciudad,
    correo_facturacion = excluded.correo_facturacion,
    fecha_actualizacion = greatest(ficha.fecha_actualizacion, clock_timestamp());
end;
$$;

alter function public.guardar_datos_facturacion_cliente(uuid, text, text, text, text, text, text, text) owner to postgres;
revoke all on function public.guardar_datos_facturacion_cliente(uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.guardar_datos_facturacion_cliente(uuid, text, text, text, text, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
