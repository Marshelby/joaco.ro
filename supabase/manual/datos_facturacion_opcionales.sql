begin;

alter table public.clientes_datos_facturacion
  alter column rut drop not null,
  alter column razon_social drop not null,
  alter column giro_comercial drop not null,
  alter column direccion_tributaria drop not null,
  alter column comuna drop not null,
  alter column ciudad drop not null,
  alter column correo_facturacion drop not null,
  add constraint clientes_datos_facturacion_al_menos_un_dato check (
    num_nonnulls(rut, razon_social, giro_comercial, direccion_tributaria, comuna, ciudad, correo_facturacion) > 0
  );

create or replace function public.guardar_datos_facturacion_cliente(
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
  v_rut text := nullif(upper(btrim(p_rut)), '');
  v_compacto text;
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;

  if v_rut is not null then
    if v_rut !~ '^([0-9]{1,8}-?|[0-9]{1,3}([.][0-9]{3}){1,2}-)[0-9K]$' then
      raise exception 'RUT_INVALIDO' using errcode = '22023';
    end if;
    v_compacto := translate(v_rut, '.-', '');
    v_rut := ltrim(left(v_compacto, -1), '0') || '-' || right(v_compacto, 1);
    if not public.rut_facturacion_valido(v_rut) then
      raise exception 'RUT_INVALIDO' using errcode = '22023';
    end if;
  end if;

  insert into public.clientes_datos_facturacion as ficha (
    cliente_id, rut, razon_social, giro_comercial, direccion_tributaria, comuna, ciudad, correo_facturacion
  ) values (
    p_cliente_id, v_rut,
    nullif(btrim(p_razon_social), ''),
    nullif(btrim(p_giro_comercial), ''),
    nullif(btrim(p_direccion_tributaria), ''),
    nullif(btrim(p_comuna), ''),
    nullif(btrim(p_ciudad), ''),
    nullif(lower(btrim(p_correo_facturacion)), '')
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

commit;
