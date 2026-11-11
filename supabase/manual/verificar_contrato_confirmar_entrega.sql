-- Fase 1: revisar y ejecutar MANUALMENTE. No ejecutado por el agente.
-- No instala las migraciones 20261108130000/140000/150000 ni modifica datos.
-- Si retorna false, revisar esas migraciones y sus dependencias en orden antes
-- de habilitar entregas. No reemplazar funciones de cinco argumentos por las antiguas.
-- Este diagnóstico verifica disponibilidad estructural; no certifica cuerpos SQL
-- modificados manualmente ni sustituye una revisión de despliegue.
begin;
create or replace function public.verificar_contrato_confirmar_entrega()
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare
 firma text;
 funcion oid;
 pedidos oid;
 entregas oid;
 cobros oid;
 pagos oid;
begin
 if auth.uid() is null or not coalesce(public.es_admin(), false) then
   raise exception 'NO_AUTORIZADO';
 end if;
 foreach firma in array array[
   'public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)',
   'public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)'
 ] loop
   funcion := to_regprocedure(firma);
   if funcion is null then return false; end if;
   if not has_function_privilege('authenticated', funcion, 'EXECUTE') then return false; end if;
   if not exists(select 1 from pg_proc where oid=funcion
     and proargnames=array['p_pedido_id','p_version_esperada','p_clave','p_items','p_cobro']::text[]
     and prorettype='jsonb'::regtype
     and prokind='f' and not proretset and prosecdef
     and proargmodes is null) then return false; end if;
 end loop;
 -- Consultar catálogos evita exigir USAGE en operativo_privado al propietario
 -- del diagnóstico. No se leen tablas privadas ni se amplían sus permisos.
 select c.oid into pedidos from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='pedidos' and c.relkind in ('r','p');
 select c.oid into entregas from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='operativo_privado' and c.relname='entregas_definitivas' and c.relkind in ('r','p');
 select c.oid into cobros from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='operativo_privado' and c.relname='cobros_entrega' and c.relkind in ('r','p');
 select c.oid into pagos from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='operativo_privado' and c.relname='pagos_entrega' and c.relkind in ('r','p');
 if pedidos is null or entregas is null or cobros is null or pagos is null then return false; end if;
 if not exists(select 1 from pg_constraint where conrelid=pedidos
   and conname='pedidos_venta_definitiva_pareada' and convalidated) then return false; end if;
 if not exists(select 1 from pg_trigger where tgrelid=pedidos
   and tgname='proteger_venta_definitiva' and tgenabled in ('O','A')) then return false; end if;
 if not exists(select 1 from pg_trigger where tgrelid=entregas
   and tgname='entrega_exige_cobro' and tgenabled in ('O','A')) then return false; end if;
 return true;
end; $$;
revoke all on function public.verificar_contrato_confirmar_entrega() from public, anon;
grant execute on function public.verificar_contrato_confirmar_entrega() to authenticated;
commit;
-- Tras instalar, refrescar el schema cache de PostgREST por el procedimiento
-- habitual del operador si la función aún no aparece. La app bloquea mientras falte.
