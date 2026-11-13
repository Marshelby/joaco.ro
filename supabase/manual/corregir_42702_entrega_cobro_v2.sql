-- HIDRO LEUFÚ — parche manual 42702 v2. NO EJECUTADO.
-- Ejecutar el archivo completo como postgres. Cualquier excepción revierte el parche.
-- Referencia: cuerpo completo de 20261108150000_confirmar_entrega_hubo_diferencias.sql,
-- MD5 ef5daa9b01db61ea70ae0dd87f03ba3d. No se reconstruye la RPC desde esa fuente.
-- Sólo el fragmento identificado admite variaciones de espacios/saltos de línea;
-- fuera de él se exige identidad completa con la referencia (normalizando CRLF).
-- No llama la RPC ni escribe datos de negocio. No modifica permisos ni comentarios.
begin;
set local lock_timeout = '5s';
set local search_path = pg_catalog;

do $parche$
declare
 v_oid oid;
 v_antes pg_catalog.pg_proc%rowtype;
 v_despues pg_catalog.pg_proc%rowtype;
 v_definicion text;
 v_cuerpo text;
 v_fragmento text;
 v_nuevo_fragmento text;
 v_normalizado text;
 v_comentario text;
 v_originales bigint;
 v_corregidos bigint;
 v_canonico constant text := $fragmento$select 1 from public.items_pedido i
       where i.pedido_id=p.id and i.id=(x->>'item_pedido_id')::uuid$fragmento$;
 -- Sin grupos de captura: regexp_matches devuelve el fragmento completo en [1].
 -- Los límites de palabra impiden aceptar identificadores con prefijos/sufijos.
 v_patron constant text := $regex$\mselect[[:space:]]+1[[:space:]]+from[[:space:]]+public[[:space:]]*\.[[:space:]]*items_pedido[[:space:]]+i[[:space:]]+where[[:space:]]+i[[:space:]]*\.[[:space:]]*pedido_id[[:space:]]*=[[:space:]]*p[[:space:]]*\.[[:space:]]*id[[:space:]]+and[[:space:]]+i[[:space:]]*\.[[:space:]]*id[[:space:]]*=[[:space:]]*\([[:space:]]*x[[:space:]]*->>[[:space:]]*'item_pedido_id'[[:space:]]*\)[[:space:]]*::[[:space:]]*uuid\M$regex$;
 v_patron_corregido text;
begin
 if current_user <> 'postgres' then
   raise exception 'REQUIERE_POSTGRES';
 end if;
 -- Serializa ejecuciones de este parche; cambios concurrentes externos también
 -- quedan sujetos a las comprobaciones posteriores y al rollback transaccional.
 perform pg_catalog.pg_advisory_xact_lock(42702, 20261108);
 v_oid := pg_catalog.to_regprocedure('public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)');
 if v_oid is null then raise exception 'FIRMA_NO_INSTALADA'; end if;
 select f.* into strict v_antes from pg_catalog.pg_proc f where f.oid = v_oid;
 v_comentario := pg_catalog.obj_description(v_oid, 'pg_proc');
 if v_antes.proowner <> 'postgres'::regrole
    or v_antes.prolang <> (select l.oid from pg_catalog.pg_language l where l.lanname = 'plpgsql')
    or v_antes.prokind <> 'f' or v_antes.prorettype <> 'jsonb'::regtype
    or v_antes.proretset or not v_antes.prosecdef
    or v_antes.proargnames is distinct from array['p_pedido_id','p_version_esperada','p_clave','p_items','p_cobro']::text[]
 then raise exception 'CONTRATO_INSTALADO_INCOMPATIBLE'; end if;

 -- Acepta el alias ya corregido por v2 o por el parche anterior (con AS).
 -- Alternativas completas sin grupos: m[1] sigue siendo el fragmento completo.
 v_patron_corregido := replace(v_patron, 'items_pedido[[:space:]]+i',
   'items_pedido[[:space:]]+item_validacion');
 v_patron_corregido := replace(v_patron_corregido, '+i[[:space:]]*', '+item_validacion[[:space:]]*');
 v_patron_corregido := v_patron_corregido || '|' ||
   replace(v_patron_corregido, 'items_pedido[[:space:]]+item_validacion',
     'items_pedido[[:space:]]+as[[:space:]]+item_validacion');
 select count(*) into v_originales from pg_catalog.regexp_matches(v_antes.prosrc, v_patron, 'g');
 select count(*) into v_corregidos from pg_catalog.regexp_matches(v_antes.prosrc, v_patron_corregido, 'g');
 if not ((v_originales = 1 and v_corregidos = 0)
      or (v_originales = 0 and v_corregidos = 1)) then
   raise exception 'FRAGMENTO_AMBIGUO_INESPERADO: originales %, corregidos %', v_originales, v_corregidos;
 end if;
 select m[1] into strict v_fragmento
 from pg_catalog.regexp_matches(v_antes.prosrc,
   case when v_originales = 1 then v_patron else v_patron_corregido end, 'g') as m;
 -- Canonicalizar únicamente el fragmento para comparar TODO el cuerpo conocido.
 -- No se normalizan espacios en validaciones, literales, comentarios u otras consultas.
 v_normalizado := replace(replace(v_antes.prosrc, v_fragmento, v_canonico), chr(13)||chr(10), chr(10));
 if pg_catalog.md5(v_normalizado) <> 'ef5daa9b01db61ea70ae0dd87f03ba3d' then
   raise exception 'DEFINICION_INSTALADA_DESCONOCIDA';
 end if;
 if v_corregidos = 1 then
   raise notice 'Corrección ya instalada y cuerpo conocido verificado; sin cambios';
   return;
 end if;
 -- El fragmento verificado contiene exactamente los tres identificadores i.
 -- Conserva cada espacio, salto de línea y todos los demás bytes instalados.
 v_nuevo_fragmento := pg_catalog.regexp_replace(v_fragmento, E'\\mi\\M', 'item_validacion', 'g');
 v_cuerpo := replace(v_antes.prosrc, v_fragmento, v_nuevo_fragmento);
 if v_cuerpo = v_antes.prosrc then raise exception 'SUSTITUCION_NO_REALIZADA'; end if;
 v_definicion := pg_catalog.pg_get_functiondef(v_oid);
 if (length(v_definicion) - length(replace(v_definicion, v_antes.prosrc, ''))) / length(v_antes.prosrc) <> 1 then
   raise exception 'CUERPO_NO_UNICO_EN_DEFINICION';
 end if;
 -- Usa cabecera, delimitadores y atributos de la definición INSTALADA.
 execute replace(v_definicion, v_antes.prosrc, v_cuerpo);
 select f.* into strict v_despues from pg_catalog.pg_proc f where f.oid = v_oid;
 if v_despues.prosrc is distinct from v_cuerpo
    or (to_jsonb(v_antes) - 'prosrc') is distinct from (to_jsonb(v_despues) - 'prosrc')
    or pg_catalog.obj_description(v_oid, 'pg_proc') is distinct from v_comentario
 then raise exception 'CAMBIO_NO_AUTORIZADO_DE_FUNCION'; end if;
 if exists(select 1 from pg_catalog.regexp_matches(v_despues.prosrc, v_patron, 'g'))
    or (select count(*) from pg_catalog.regexp_matches(v_despues.prosrc, v_patron_corregido, 'g')) <> 1 then
   raise exception 'VERIFICACION_FINAL_DE_ALIAS_FALLIDA';
 end if;
 raise notice 'Alias corregido; cuerpo restante, OID, firma, propietario, ACL, seguridad, configuración y comentario conservados';
end;
$parche$;
commit;
