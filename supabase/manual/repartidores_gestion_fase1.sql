-- Incremental manual posterior a repartidores_fase5.sql. No ejecutado.
-- El correo de acceso pertenece a auth.users; clientes.email es un contacto comercial.
-- No cambia permisos, asignaciones ni contratos operativos. La gestión de personas
-- queda separada de la futura relación ruta/repartidores (uno o varios).
begin;
create function public.leer_gestion_repartidores_admin(p_busqueda text default '')
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog set timezone = 'UTC' set datestyle = 'ISO, YMD'
as $$
declare resultado jsonb; consulta text := btrim(coalesce(p_busqueda, ''));
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;
  if length(consulta) > 100 then raise exception 'BUSQUEDA_INVALIDA'; end if;
  select jsonb_build_object(
    'repartidores', coalesce((
      select jsonb_agg(jsonb_build_object('usuario_id', r.usuario_id,
        'nombre', p.nombre, 'correo', u.email, 'activo', r.activo,
        'administrador', p.rol = 'admin') order by lower(coalesce(p.nombre, u.email, '')), r.usuario_id)
      from operativo_privado.repartidores r
      join public.perfiles p on p.usuario_id = r.usuario_id
      join auth.users u on u.id = r.usuario_id
    ), '[]'::jsonb),
    'usuarios', coalesce((
      select jsonb_agg(to_jsonb(c) order by lower(coalesce(c.nombre, c.correo, '')), c.usuario_id)
      from (
        select p.usuario_id, p.nombre, u.email as correo
        from public.perfiles p join auth.users u on u.id = p.usuario_id
        where p.rol <> 'admin' and length(consulta) >= 2
          and not exists (select 1 from operativo_privado.repartidores r where r.usuario_id = p.usuario_id and r.activo)
          and (strpos(lower(coalesce(p.nombre, '')), lower(consulta)) > 0
            or strpos(lower(coalesce(u.email, '')), lower(consulta)) > 0)
        order by lower(coalesce(p.nombre, u.email, '')), p.usuario_id limit 30
      ) c
    ), '[]'::jsonb)
  ) into resultado;
  return resultado;
end;
$$;
alter function public.leer_gestion_repartidores_admin(text) owner to postgres;
revoke all on function public.leer_gestion_repartidores_admin(text) from public, anon, authenticated, service_role;
grant execute on function public.leer_gestion_repartidores_admin(text) to authenticated;
commit;
