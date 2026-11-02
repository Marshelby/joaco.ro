-- Sólo lectura. Ejecutar DESPUÉS de la migración en un entorno autorizado.
-- No prueba ejecución de RPC, RLS con identidades reales ni concurrencia.
\set ON_ERROR_STOP on
begin read only;
do $$
declare r record; rol text; firma text;
begin
  if not exists (select 1 from pg_attribute where attrelid = 'public.direcciones_cliente'::regclass
      and attname = 'ambito' and attnotnull and not attisdropped and not atthasdef) then
    raise exception 'ambito debe existir, NOT NULL y sin DEFAULT';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.direcciones_cliente'::regclass) then
    raise exception 'RLS deshabilitada';
  end if;
  foreach rol in array array['anon','authenticated','service_role'] loop
    if has_table_privilege(rol, 'public.direcciones_cliente', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      or has_any_column_privilege(rol, 'public.direcciones_cliente', 'INSERT,UPDATE,REFERENCES') then
      raise exception 'DML o privilegio de columna inesperado: %', rol;
    end if;
    if has_table_privilege(rol, 'public.direcciones_cliente', 'SELECT') <> (rol = 'authenticated') then
      raise exception 'SELECT inesperado: %', rol;
    end if;
  end loop;
  if (select count(*) from pg_policy where polrelid = 'public.direcciones_cliente'::regclass) <> 2
    or exists (select 1 from pg_policy where polrelid = 'public.direcciones_cliente'::regclass
      and (polcmd <> 'r' or polname not in
        ('direcciones_cliente_lectura_personal','direcciones_cliente_lectura_operativa_admin'))) then
    raise exception 'Políticas inesperadas';
  end if;
  if exists (select 1 from public.direcciones_cliente where es_principal and activa
      group by cliente_id, ambito having count(*) > 1) then
    raise exception 'Principales duplicadas';
  end if;
  if to_regclass('public.direcciones_cliente_una_principal_por_cliente') is not null
    or not exists (select 1 from pg_index where indexrelid =
      to_regclass('public.direcciones_cliente_una_principal_por_ambito') and indisunique and indisvalid) then
    raise exception 'Índice inesperado';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('guardar_direccion_cliente',
        'desactivar_direccion_cliente','obtener_cliente_administrativo',
        'guardar_cliente_administrativo','crear_pedido_desde_carrito')) <> 5 then
    raise exception 'Sobrecargas inesperadas';
  end if;
  foreach firma in array array[
    'public.guardar_direccion_cliente(uuid,text,text,text,uuid,numeric,numeric,text,boolean)',
    'public.desactivar_direccion_cliente(uuid)',
    'public.obtener_cliente_administrativo(uuid)',
    'public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint)',
    'public.crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date,text[])'
  ] loop
    select p.*, pg_get_userbyid(p.proowner) as propietario into r
      from pg_proc p where p.oid = to_regprocedure(firma);
    if not found then raise exception 'RPC ausente: %', firma; end if;
    if not r.prosecdef or r.propietario <> 'postgres'
      or not ('search_path=pg_catalog' = any(coalesce(r.proconfig, array[]::text[]))) then
      raise exception 'Owner/SECURITY DEFINER/search_path inesperado: %', firma;
    end if;
    foreach rol in array array['anon','authenticated','service_role'] loop
      if has_function_privilege(rol, firma, 'EXECUTE') <> (rol = 'authenticated') then
        raise exception 'EXECUTE inesperado: % %', rol, firma;
      end if;
    end loop;
    if exists (select 1 from aclexplode(coalesce(r.proacl, acldefault('f', r.proowner)))
        where grantee = 0 and privilege_type = 'EXECUTE') then
      raise exception 'EXECUTE a PUBLIC: %', firma;
    end if;
  end loop;
end;
$$;
-- Inspeccionar expresiones completas; los asserts anteriores no las certifican.
select policyname, roles, cmd, qual, with_check from pg_policies
  where schemaname = 'public' and tablename = 'direcciones_cliente';
select indexdef from pg_indexes where schemaname = 'public' and tablename = 'direcciones_cliente';
select conname, pg_get_constraintdef(oid) from pg_constraint
  where conrelid = 'public.direcciones_cliente'::regclass;
select ambito, activa, count(*) from public.direcciones_cliente group by ambito, activa;
rollback;
