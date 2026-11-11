-- Ejecutar manualmente como postgres. Sólo lectura: no instala Fase 3.
-- Mismas precondiciones del incremental corregido, sin DDL ni DML.
-- Un resultado correcto NO modifica las precondiciones del archivo original.
begin read only;
set local search_path=pg_catalog;
do $pre$ declare firma text; rol text; begin
 if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
 if to_regclass('operativo_privado.rutas_multi') is null then raise exception 'REQUIERE_FASE_2'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.operar_ruta_multiple(jsonb)') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='3e7bedaabab7ed3dd7058cafa3fb1f21') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.operar_ruta_multiple'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_rutas_multiples(date)') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='5438a8139ed3f3845e618380ce2b6794') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_rutas_multiples'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_mi_reparto()') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='bbeb502fd8085565c72e0f71f6f5b588') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_mi_reparto'; end if;
 -- El hash de prosrc no cubre firma de retorno, atributos ni ACL.
 -- Contratos declarados en rutas_multiples_fase2.sql; no se reparan permisos.
 foreach firma in array array['public.operar_ruta_multiple(jsonb)',
 'public.leer_rutas_multiples(date)', 'public.leer_mi_reparto()'] loop
 if not exists(
 select 1 from pg_catalog.pg_proc p
 join pg_catalog.pg_language l on l.oid=p.prolang
 where p.oid=pg_catalog.to_regprocedure(firma)
 and p.prokind='f' and p.prorettype='jsonb'::regtype and not p.proretset
 and p.prosecdef and not p.proisstrict and not p.proleakproof
 and p.proparallel='u' and p.pronargdefaults=0
 and p.proargmodes is null and p.proallargtypes is null
 and p.proargnames is not distinct from case firma
   when 'public.operar_ruta_multiple(jsonb)' then array['p_solicitud']::text[]
   when 'public.leer_rutas_multiples(date)' then array['p_fecha']::text[]
   else null::text[] end
 and l.lanname=case when firma='public.leer_mi_reparto()' then 'sql' else 'plpgsql' end
 and p.provolatile::text=case when firma='public.operar_ruta_multiple(jsonb)' then 'v' else 's' end
 and p.proconfig @> array['search_path=pg_catalog','TimeZone=UTC','DateStyle=ISO, YMD']::text[]
 and cardinality(p.proconfig)=3
 ) then raise exception 'ATRIBUTOS_FASE_2_INCOMPATIBLES: %',firma; end if;
 -- ACL exacta de Fase 2: dueño y authenticated, sin delegación a terceros.
 if exists(
 select 1 from pg_catalog.pg_proc p,
 lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
 where p.oid=pg_catalog.to_regprocedure(firma)
 and (a.grantee not in ('postgres'::regrole::oid,'authenticated'::regrole::oid)
 or a.grantor<>'postgres'::regrole::oid or a.privilege_type<>'EXECUTE'
 or (a.grantee='authenticated'::regrole::oid and a.is_grantable))
 ) or not has_function_privilege('authenticated',firma,'EXECUTE')
 or has_function_privilege('anon',firma,'EXECUTE')
 or has_function_privilege('service_role',firma,'EXECUTE') then
 raise exception 'PERMISOS_FASE_2_INCOMPATIBLES: %',firma;
 end if;
 end loop;
 foreach firma in array array['public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)',
 'public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)',
 'operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)',
 'operativo_privado.completar_operacion(uuid,bigint,uuid,text,jsonb,uuid,text,jsonb,jsonb,jsonb)',
 'operativo_privado.permiso_reparto(uuid,date)', 'operativo_privado.leer_mi_reparto()'] loop
 if not exists(select 1 from pg_proc where oid=to_regprocedure(firma) and proowner='postgres'::regrole) then raise exception 'DEPENDENCIA_INCOMPATIBLE: %',firma; end if;
 end loop;
 foreach rol in array array['anon','authenticated','service_role'] loop
 if has_schema_privilege(rol,'operativo_privado','USAGE') or has_schema_privilege(rol,'operativo_privado','CREATE') or has_schema_privilege(rol,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',rol; end if;
 end loop;
end $pre$;
select 'COMPATIBILIDAD_FASE_2_CORRECTA'::text as resultado;
commit;
