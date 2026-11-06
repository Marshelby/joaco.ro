-- Fase 2: cuotas persistentes compartidas entre instancias. Sin datos personales.
create table public.limites_posibles_pedidos (
  clave text not null,
  ventana bigint not null,
  cantidad integer not null check (cantidad > 0),
  expira_en timestamptz not null,
  primary key (clave, ventana)
);
alter table public.limites_posibles_pedidos enable row level security;
revoke all on public.limites_posibles_pedidos from public, anon, authenticated, service_role;
create index limites_posibles_expiracion_idx on public.limites_posibles_pedidos(expira_en);

create function public.consumir_limite_posibles_pedidos(p_origen_hash text, p_telefono_hash text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_ahora timestamptz := clock_timestamp(); v_claves text[];
  v_duraciones integer[] := array[3600,600,3600]; v_maximos integer[] := array[300,10,5];
  v_indice integer; v_cantidad integer; v_ventana bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'NO_AUTORIZADO' using errcode='42501'; end if;
  if p_origen_hash is null or p_origen_hash !~ '^[a-f0-9]{64}$'
    or p_telefono_hash is null or p_telefono_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HUELLA_INVALIDA';
  end if;
  delete from public.limites_posibles_pedidos where expira_en < v_ahora;
  v_claves := array['global','origen:'||p_origen_hash,'telefono:'||p_telefono_hash];
  -- Orden fijo global/origen/teléfono. ON CONFLICT serializa cada contador.
  for v_indice in 1..3 loop
    v_ventana := floor(extract(epoch from v_ahora)/v_duraciones[v_indice])::bigint;
    insert into public.limites_posibles_pedidos as l(clave,ventana,cantidad,expira_en)
      values(v_claves[v_indice],v_ventana,1,to_timestamp((v_ventana+1)*v_duraciones[v_indice]))
      on conflict(clave,ventana) do update set cantidad=l.cantidad+1
        where l.cantidad < v_maximos[v_indice]
      returning cantidad into v_cantidad;
    if not found then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.consumir_limite_posibles_pedidos(text,text) from public, anon, authenticated;
grant execute on function public.consumir_limite_posibles_pedidos(text,text) to service_role;
