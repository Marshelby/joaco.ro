-- Sólo migración LOCAL: todavía no aplicada.
-- Cierre limitado a grants de authenticated. Si PUBLIC o una membresía mantiene
-- DML efectivo, se aborta toda la transacción sin alterar otros consumidores.
begin;

do $migration$
declare
  rol_authenticated oid;
  tabla regclass;
  columna record;
  propietario oid;
begin
  select r.oid into strict rol_authenticated
  from pg_catalog.pg_roles r
  where r.rolname = 'authenticated';

  if exists (
    select 1 from pg_catalog.pg_roles r
    where r.oid = rol_authenticated and r.rolsuper
  ) then
    raise exception 'Cierre bloqueado: authenticated es superusuario; revocar grants no limita su DML';
  end if;

  foreach tabla in array array[
    'public.pagos'::regclass,
    'public.aplicaciones_pago'::regclass
  ] loop
    select c.relowner into strict propietario
    from pg_catalog.pg_class c
    where c.oid = tabla;

    -- USAGE comprueba privilegios disponibles sin SET ROLE; MEMBER sólo
    -- comprobaría la membresía, incluso cuando no hay herencia efectiva.
    -- La propiedad permite recuperar grants: no es un cierre seguro.
    if pg_catalog.pg_has_role(rol_authenticated, propietario, 'USAGE') then
      raise exception
        'Cierre bloqueado: authenticated posee o hereda efectivamente la propiedad de % mediante %',
        tabla, pg_catalog.pg_get_userbyid(propietario);
    end if;

    -- Sólo se retiran grants del rol objetivo. RESTRICT abortará si existen
    -- grants dependientes; no se modifican PUBLIC, otros roles ni membresías.
    execute pg_catalog.format(
      'revoke insert, update, delete on table %s from authenticated restrict',
      tabla
    );

    -- Los grants por columna son independientes de los grants de tabla.
    for columna in
      select a.attname from pg_catalog.pg_attribute a
      where a.attrelid = tabla and a.attnum > 0 and not a.attisdropped
    loop
      execute pg_catalog.format(
        'revoke insert (%I), update (%I) on table %s from authenticated restrict',
        columna.attname, columna.attname, tabla
      );
    end loop;
  end loop;

  -- Verificar ambas tablas después de todas las revocaciones. Estas funciones
  -- consideran PUBLIC y la herencia efectiva, no sólo las ACL directas.
  -- Las listas de privilegios significan CUALQUIERA, no TODOS.
  foreach tabla in array array[
    'public.pagos'::regclass,
    'public.aplicaciones_pago'::regclass
  ] loop
    if pg_catalog.has_table_privilege(rol_authenticated, tabla, 'INSERT,UPDATE,DELETE')
       or pg_catalog.has_any_column_privilege(rol_authenticated, tabla, 'INSERT,UPDATE') then
      raise exception
        'Cierre bloqueado: authenticated conserva DML efectivo sobre % tras revocar sus grants directos', tabla
        using detail = 'PUBLIC o un rol con privilegios heredados mantiene INSERT, UPDATE o DELETE de tabla, o INSERT/UPDATE de columna.',
              hint = 'Resolver esa dependencia por separado. Esta migración no revoca permisos de otros roles ni de PUBLIC y se revierte íntegramente.';
    end if;
  end loop;
end;
$migration$;

-- No se revocan SELECT ni EXECUTE. No se modifican funciones, políticas RLS,
-- propietarios, service_role ni postgres. Un error impide confirmar el cierre.
commit;
