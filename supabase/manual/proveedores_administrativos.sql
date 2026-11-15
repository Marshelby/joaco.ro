-- PENDIENTE: revisar y ejecutar manualmente como postgres. No se ejecutó.
-- Dependencias existentes: public.es_admin(), public.perfiles y auth.uid().
-- Sin saldos a favor. Montos CLP enteros. No instalar sobre estructuras homónimas.
begin;
create table public.proveedores (
  id uuid primary key,
  nombre text not null check (length(btrim(nombre)) between 1 and 200),
  descripcion text check (length(descripcion) <= 2000),
  telefono text check (length(telefono) = 12 and telefono ~ '^[+]569[0-9]{8}$'),
  direccion text check (length(direccion) <= 2000),
  -- Dirección postal independiente: futuras coordenadas serán columnas separadas.
  administrador_id uuid not null,
  fecha_creacion timestamptz not null default clock_timestamp()
);
create table public.movimientos_proveedores (
  id uuid primary key,
  proveedor_id uuid not null references public.proveedores(id),
  tipo text not null check (tipo in ('deuda','abono')),
  monto numeric(15,0) not null check (monto > 0 and monto <= 999999999999),
  comentario text not null check (length(btrim(comentario)) between 1 and 2000),
  administrador_id uuid not null,
  administrador_nombre text not null,
  fecha timestamptz not null default clock_timestamp()
);
create index on public.movimientos_proveedores(proveedor_id, fecha, id);
alter table public.proveedores enable row level security;
alter table public.movimientos_proveedores enable row level security;
revoke all on public.proveedores, public.movimientos_proveedores from public, anon, authenticated, service_role;
grant select on public.proveedores, public.movimientos_proveedores to authenticated;
create policy proveedores_lectura_admin on public.proveedores for select to authenticated using (public.es_admin());
create policy movimientos_proveedores_lectura_admin on public.movimientos_proveedores for select to authenticated using (public.es_admin());
create view public.v_saldos_proveedores with (security_invoker = true) as
select p.id, p.nombre, p.descripcion, p.telefono, p.direccion,
 coalesce(sum(case when m.tipo = 'deuda' then m.monto else -m.monto end),0) as saldo_actual
from public.proveedores p left join public.movimientos_proveedores m on m.proveedor_id = p.id
group by p.id;
revoke all on public.v_saldos_proveedores from public, anon, authenticated, service_role;
grant select on public.v_saldos_proveedores to authenticated;

create function public.crear_proveedor_administrativo(p_clave uuid, p_nombre text, p_descripcion text, p_telefono text, p_direccion text)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare v public.proveedores%rowtype;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_clave is null or p_nombre is null or length(btrim(p_nombre)) not between 1 and 200
 or length(coalesce(p_descripcion,'')) > 2000
 or (p_telefono is not null and (length(p_telefono) <> 12 or p_telefono !~ '^[+]569[0-9]{8}$'))
 or length(coalesce(p_direccion,'')) > 2000 then raise exception 'DATOS_INVALIDOS'; end if;
 perform pg_advisory_xact_lock(hashtextextended('proveedores:' || p_clave::text,0));
 select * into v from public.proveedores where id = p_clave;
 if found then
  if v.nombre is distinct from btrim(p_nombre) or v.descripcion is distinct from nullif(btrim(p_descripcion),'')
   or v.telefono is distinct from p_telefono or v.direccion is distinct from nullif(btrim(p_direccion),'')
   or v.administrador_id <> auth.uid() then raise exception 'CLAVE_REUTILIZADA'; end if;
  return v.id;
 end if;
 insert into public.proveedores(id,nombre,descripcion,telefono,direccion,administrador_id)
 values(p_clave,btrim(p_nombre),nullif(btrim(p_descripcion),''),p_telefono,nullif(btrim(p_direccion),''),auth.uid());
 return p_clave;
end; $$;

-- Solo modifica datos del proveedor; no escribe saldos ni movimientos.
-- Asignar nuevamente los mismos datos no crea registros ni movimientos.
create function public.actualizar_proveedor_administrativo(p_proveedor_id uuid, p_nombre text, p_descripcion text, p_telefono text, p_direccion text)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_proveedor_id is null or p_nombre is null or length(btrim(p_nombre)) not between 1 and 200
 or length(coalesce(p_descripcion,'')) > 2000
 or (p_telefono is not null and (length(p_telefono) <> 12 or p_telefono !~ '^[+]569[0-9]{8}$'))
 or length(coalesce(p_direccion,'')) > 2000 then raise exception 'DATOS_INVALIDOS'; end if;
 update public.proveedores set nombre=btrim(p_nombre), descripcion=nullif(btrim(p_descripcion),''),
 telefono=p_telefono, direccion=nullif(btrim(p_direccion),'') where id=p_proveedor_id;
 if not found then raise exception 'PROVEEDOR_NO_ENCONTRADO'; end if;
 return p_proveedor_id;
end; $$;

create function public.registrar_movimiento_proveedor_administrativo(p_clave uuid, p_proveedor_id uuid, p_tipo text, p_monto numeric, p_comentario text)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare v public.movimientos_proveedores%rowtype; v_saldo numeric; v_nombre text;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_clave is null or p_proveedor_id is null or p_tipo is null or p_tipo not in ('deuda','abono')
 or p_monto is null or p_monto::text in ('NaN','Infinity','-Infinity') or p_monto <= 0 or p_monto > 999999999999 or trunc(p_monto) <> p_monto
 or p_comentario is null or length(btrim(p_comentario)) not between 1 and 2000 then raise exception 'DATOS_INVALIDOS'; end if;
 perform pg_advisory_xact_lock(hashtextextended('movimientos_proveedores:' || p_clave::text,0));
 -- Serializa deudas y abonos del mismo proveedor antes de consultar el saldo.
 perform 1 from public.proveedores where id = p_proveedor_id for update;
 if not found then raise exception 'PROVEEDOR_NO_ENCONTRADO'; end if;
 select * into v from public.movimientos_proveedores where id = p_clave;
 if found then
  if v.proveedor_id <> p_proveedor_id or v.tipo <> p_tipo or v.monto <> p_monto
   or v.comentario <> btrim(p_comentario) or v.administrador_id <> auth.uid() then raise exception 'CLAVE_REUTILIZADA'; end if;
  return v.id;
 end if;
 select coalesce(sum(case when tipo = 'deuda' then monto else -monto end),0) into v_saldo
 from public.movimientos_proveedores where proveedor_id = p_proveedor_id;
 if p_tipo = 'abono' and p_monto > v_saldo then raise exception 'ABONO_SUPERA_SALDO'; end if;
 select coalesce(nullif(btrim(nombre),''),auth.uid()::text) into v_nombre from public.perfiles where usuario_id = auth.uid();
 insert into public.movimientos_proveedores(id,proveedor_id,tipo,monto,comentario,administrador_id,administrador_nombre)
 values(p_clave,p_proveedor_id,p_tipo,p_monto,btrim(p_comentario),auth.uid(),coalesce(v_nombre,auth.uid()::text));
 return p_clave;
end; $$;

-- Una sola lectura consistente, sin truncar el historial por el límite REST.
create function public.obtener_proveedor_administrativo(p_proveedor_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare v jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 select to_jsonb(p) || jsonb_build_object('saldo_actual',
 coalesce((select sum(case when m.tipo='deuda' then m.monto else -m.monto end) from public.movimientos_proveedores m where m.proveedor_id=p.id),0),
 'movimientos',coalesce((select jsonb_agg(to_jsonb(m) order by m.fecha,m.id) from public.movimientos_proveedores m where m.proveedor_id=p.id),'[]'::jsonb))
 into v from public.proveedores p where p.id=p_proveedor_id;
 return v;
end; $$;
revoke all on function public.crear_proveedor_administrativo(uuid,text,text,text,text), public.actualizar_proveedor_administrativo(uuid,text,text,text,text), public.registrar_movimiento_proveedor_administrativo(uuid,uuid,text,numeric,text), public.obtener_proveedor_administrativo(uuid) from public, anon, authenticated, service_role;
grant execute on function public.crear_proveedor_administrativo(uuid,text,text,text,text), public.actualizar_proveedor_administrativo(uuid,text,text,text,text), public.registrar_movimiento_proveedor_administrativo(uuid,uuid,text,numeric,text), public.obtener_proveedor_administrativo(uuid) to authenticated;
commit;
