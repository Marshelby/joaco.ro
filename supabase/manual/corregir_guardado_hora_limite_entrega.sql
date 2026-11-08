-- Ejecutar manualmente en el MISMO proyecto Supabase utilizado por la aplicación.
-- Corrección incremental después del Success de configurar_hora_limite_entrega.sql.
-- No restablece horas, días ni restricciones; no deshabilita safeupdate ni RLS.
-- Crear una función no ejecuta su UPDATE: Success no garantiza su ejecución por API.
begin;

create or replace function public.guardar_hora_corte_administrativa(p_hora_corte time)
returns void
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null or not coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO' using errcode = '42501';
  end if;
  if p_hora_corte is null or p_hora_corte >= time '24:00'
    or extract(second from p_hora_corte) <> 0 then
    raise exception 'HORA_CORTE_INVALIDA';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('configuracion-hora-corte-entrega', 0));
  if not exists (select 1 from public.dias_entrega) then
    raise exception 'DIAS_ENTREGA_VACIOS';
  end if;
  update public.dias_entrega set hora_corte = p_hora_corte
  where hora_corte is distinct from p_hora_corte;
end;
$$;

alter function public.guardar_hora_corte_administrativa(time) owner to postgres;
revoke all on function public.guardar_hora_corte_administrativa(time) from public, anon, authenticated;
grant execute on function public.guardar_hora_corte_administrativa(time) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Inspección de solo lectura: confirmar definición efectiva, firma y permisos.
select p.oid::regprocedure as firma,
       p.prosecdef as security_definer,
       pg_get_userbyid(p.proowner) as propietario,
       p.proconfig,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       pg_get_functiondef(p.oid) as definicion
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('guardar_hora_corte_administrativa', 'es_admin');

select conname, pg_get_constraintdef(oid) as definicion
from pg_constraint where conrelid = 'public.dias_entrega'::regclass;

select dia_semana, hora_corte from public.dias_entrega order by dia_semana;
-- No invocar la RPC desde SQL Editor para probar permisos de la sesión web:
-- auth.uid() puede ser NULL allí. Guardar desde /admin/configuracion.
