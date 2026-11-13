-- HIDRO LEUFÚ: corrección manual 42702. NO EJECUTADO.
-- A: diagnóstico independiente, sólo lectura. B: modificación transaccional.
-- Ejecutar A por separado y conservar resultados antes de considerar B.
-- No reproduce la operación ni llama RPC de escritura. No acredita la causa remota.

-- A. DIAGNÓSTICO REMOTO DE SÓLO LECTURA
begin transaction read only;
select pg_catalog.current_setting('server_version') as version_postgresql,
       pg_catalog.current_setting('plpgsql.variable_conflict', true) as variable_conflict;
-- Incluye sobrecargas, helpers, wrappers y funciones de triggers de ambos esquemas.
-- Permite revisar definiciones remotas desconocidas sin inventarlas.
select n.nspname as esquema, p.oid::regprocedure as firma,
       pg_catalog.md5(p.prosrc) as huella,
       pg_catalog.pg_get_userbyid(p.proowner) as propietario,
       p.proacl, p.proconfig, pg_catalog.pg_get_functiondef(p.oid) as definicion
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','operativo_privado') and p.prokind='f'
order by n.nspname,p.proname,p.oid;
select t.tgrelid::regclass as tabla, t.tgname, t.tgenabled,
       pg_catalog.pg_get_triggerdef(t.oid,true) as definicion,
       t.tgfoid::regprocedure as funcion
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','operativo_privado') and not t.tgisinternal
order by t.tgrelid::regclass::text,t.tgname;
select c.oid::regclass as objeto, pg_catalog.pg_get_constraintdef(cn.oid,true) as restriccion
from pg_catalog.pg_constraint cn join pg_catalog.pg_class c on c.oid=cn.conrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='operativo_privado'
   or (n.nspname='public' and c.relname in ('pedidos','pagos','aplicaciones_pago'))
order by c.oid::regclass::text,cn.conname;
select n.nspname,c.relname,pg_catalog.pg_get_viewdef(c.oid,true) as definicion
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
  and c.relname in ('v_saldos_pedidos','v_movimientos_cuenta_cliente');
-- Evidencia mínima del pedido: no incluye datos personales ni altera comprobantes.
select p.id,p.numero_pedido,p.estado,p.regimen_contable,
       p.venta_reconocida_en,p.venta_definitiva_snapshot is not null as tiene_snapshot
from public.pedidos p where p.numero_pedido='HL-000083';
commit;
-- Para acreditar el punto exacto remoto se necesita también el error original
-- PostgreSQL con MESSAGE, DETAIL, HINT y CONTEXT (función y línea), desde logs
-- existentes. No provocar otra entrega para obtenerlo ni cambiar su clave/payload.

-- B. CORRECCIÓN MANUAL: ejecutar separadamente del diagnóstico.
-- Sólo admite el cuerpo local conocido o esta misma corrección ya instalada.
-- Se conserva pg_get_functiondef remoto: firma, parámetros, guard, atributos y SET.
-- No DROP, GRANT, REVOKE, DML de negocio ni sustitución por una versión antigua.
-- Una variante remota desconocida aborta: requiere revisar A y los logs primero.
begin;
set local lock_timeout='5s';
do $correccion$
declare
 v_oid oid;
 v_antes pg_catalog.pg_proc%rowtype;
 v_despues pg_catalog.pg_proc%rowtype;
 v_definicion text;
 v_cuerpo text;
 v_original text := $original$select 1 from public.items_pedido i
       where i.pedido_id=p.id and i.id=(x->>'item_pedido_id')::uuid$original$;
 v_corregido text := $corregido$select 1 from public.items_pedido as item_validacion
       where item_validacion.pedido_id=p.id and item_validacion.id=(x->>'item_pedido_id')::uuid$corregido$;
begin
 if current_user <> 'postgres' then raise exception 'REQUIERE_POSTGRES'; end if;
 v_oid:=pg_catalog.to_regprocedure('public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)');
 if v_oid is null then raise exception 'FIRMA_NO_INSTALADA'; end if;
 select f.* into strict v_antes from pg_catalog.pg_proc f where f.oid=v_oid;
 if v_antes.proowner <> 'postgres'::regrole
    or v_antes.prolang <> (select l.oid from pg_catalog.pg_language l where l.lanname='plpgsql')
    or v_antes.prokind <> 'f' or v_antes.prorettype <> 'jsonb'::regtype
    or v_antes.proretset or not v_antes.prosecdef
    or v_antes.proargnames is distinct from array['p_pedido_id','p_version_esperada','p_clave','p_items','p_cobro']::text[]
 then raise exception 'CONTRATO_INSTALADO_INCOMPATIBLE'; end if;
 -- Normalizar CRLF sólo para comparar; la modificación conserva el texto remoto.
 v_cuerpo:=replace(v_antes.prosrc,chr(13)||chr(10),chr(10));
 if pg_catalog.md5(v_cuerpo)='e7143f7892ecc39030bcd9704a609afd' then
   raise notice 'Corrección ya instalada; sin cambios';
   return;
 end if;
 if pg_catalog.md5(v_cuerpo)<>'ef5daa9b01db61ea70ae0dd87f03ba3d' then
   raise exception 'DEFINICION_REMOTA_DESCONOCIDA: obtener sección A y CONTEXT del error; no sobrescribir';
 end if;
 if position(chr(13)||chr(10) in v_antes.prosrc)>0 then
   v_original:=replace(v_original,chr(10),chr(13)||chr(10));
   v_corregido:=replace(v_corregido,chr(10),chr(13)||chr(10));
 end if;
 if (length(v_antes.prosrc)-length(replace(v_antes.prosrc,v_original,'')))/length(v_original)<>1 then
   raise exception 'FRAGMENTO_AMBIGUO_INESPERADO';
 end if;
 v_cuerpo:=replace(v_antes.prosrc,v_original,v_corregido);
 v_definicion:=pg_catalog.pg_get_functiondef(v_oid);
 -- pg_get_functiondef utiliza un delimitador que no aparece en el cuerpo.
 -- La sustitución exacta del cuerpo no altera cabecera ni atributos instalados.
 execute replace(v_definicion,v_antes.prosrc,v_cuerpo);
 select f.* into strict v_despues from pg_catalog.pg_proc f where f.oid=v_oid;
 if v_despues.prosrc is distinct from v_cuerpo
    or (to_jsonb(v_antes)-'prosrc') is distinct from (to_jsonb(v_despues)-'prosrc') then
   raise exception 'CAMBIO_NO_AUTORIZADO_DE_CONTRATO';
 end if;
end;
$correccion$;
commit;
-- Sin cambio de firma: no necesita recrear RPC ni ampliar permisos.
-- Pendiente de validación real por operador; no afirmar resolución en producción.
