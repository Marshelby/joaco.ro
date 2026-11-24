begin;

create or replace function public.actualizar_mi_nombre_administrador(p_nombre text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_nombre text;
begin
  if v_usuario_id is null
    or auth.role() is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'false' then
    raise exception using errcode = '42501', message = 'NO_AUTORIZADO';
  end if;

  v_nombre := pg_catalog.regexp_replace(p_nombre, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if v_nombre is null or v_nombre = '' then
    raise exception using errcode = '22023', message = 'NOMBRE_REQUERIDO';
  end if;

  if pg_catalog.char_length(v_nombre) > 100 then
    raise exception using errcode = '22023', message = 'NOMBRE_DEMASIADO_LARGO';
  end if;

  if v_nombre !~ '[[:alpha:]]' or v_nombre ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'NOMBRE_INVALIDO';
  end if;

  update public.perfiles as perfil
  set nombre = v_nombre
  where perfil.usuario_id = v_usuario_id and perfil.rol = 'admin';

  if not found then
    raise exception using errcode = '42501', message = 'ADMIN_REQUERIDO';
  end if;
end;
$$;

revoke all on function public.actualizar_mi_nombre_administrador(text)
  from public, anon, authenticated, service_role;
grant execute on function public.actualizar_mi_nombre_administrador(text) to authenticated;

commit;
