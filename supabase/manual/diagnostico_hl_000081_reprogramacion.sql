-- Diagnóstico puntual HL-000081 / GAME COVER. Ejecutar manualmente como postgres.
-- EXCLUSIVAMENTE SELECT: no llama RPC, no cambia sesión, datos ni esquema.
-- Contiene datos privados del pedido: compartir los resultados por canal privado.
-- Bloque 1: contrato realmente instalado (prevalece sobre el código del repositorio).
SELECT n.nspname AS esquema, p.proname AS funcion,
       p.oid::regprocedure::text AS firma,
       pg_get_userbyid(p.proowner) AS propietario,
       pg_get_function_identity_arguments(p.oid) AS argumentos,
       pg_get_function_result(p.oid) AS retorno,
       p.proargnames AS nombres_argumentos, p.proretset, p.proisstrict,
       p.provolatile, l.lanname AS lenguaje,
       md5(replace(p.prosrc,chr(13)||chr(10),chr(10))) AS md5_cuerpo_lf,
       p.prosecdef AS security_definer, p.proconfig AS configuracion,
       p.proacl AS permisos, pg_get_functiondef(p.oid) AS definicion_instalada
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
JOIN pg_language l ON l.oid=p.prolang
WHERE (n.nspname='public' AND p.proname IN
 ('leer_fechas_reprogramacion_admin','reprogramar_no_entregado_administrativo',
  'registrar_entrega_fallida','operar_ruta_multiple','fecha_entrega_disponible',
  'es_admin','leer_rutas_multiples','leer_mi_reparto','leer_intentos_pedido_admin',
  'leer_resolucion_no_entregado_admin','operar_carga_jornada','orden_ruta_dia'))
 OR (n.nspname='operativo_privado' AND p.proname IN
 ('exigir_pedido_reprogramable','proteger_ruta_multi','proteger_entrega_fallida',
  'proteger_pedido_ruta_cerrada','permite_reprogramacion',
  'snapshot_ruta_multi','cantidades_ruta_multi','fecha_reprogramacion_admite_pedidos',
  'fecha_reprogramacion_tiene_rutas_multi','iniciar_operacion','completar_operacion',
  'proteger_cierre_carga','proteger_contratos_multi','proteger_ruta_reprogramado_no_incluido',
  'proteger_linea_ruta_cerrada','proteger_orden_ruta_cerrada','impedir_mutacion_historial'))
ORDER BY n.nspname,p.proname,p.oid;

-- Bloque 2: requisitos exactos del auxiliar LOCAL, en orden de rechazo.
-- No afirma que ese auxiliar sea el instalado: contrastar con bloque 1.
-- Se compara JSON de filas completas porque ése es el contrato legacy actual.
WITH objetivo AS (
 SELECT p.* FROM public.pedidos p WHERE p.numero_pedido='HL-000081'
), evidencia AS (
 SELECT p.id, to_jsonb(p) AS pedido, to_jsonb(cp) AS seleccion,
        to_jsonb(c) AS carga, x.intento, to_jsonb(f) AS fallo,
        coalesce(v.version,0) AS version_actual,
        EXISTS(SELECT 1 FROM operativo_privado.entregas_definitivas d WHERE d.pedido_id=p.id) AS entrega_definitiva,
        EXISTS(SELECT 1 FROM operativo_privado.historial_cargas h
          WHERE h.fecha=cp.fecha AND h.version=c.version AND h.resultado=c.resumen_cierre
            AND h.solicitud->>'accion'='cerrar') AS cierre_auditado,
        (SELECT count(*) FROM operativo_privado.cargas cc
          CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(cc.resumen_cierre->'intentos')='array'
           THEN cc.resumen_cierre->'intentos' ELSE '[]'::jsonb END) xx
          WHERE cc.fecha=cp.fecha AND xx->'pedido'->>'id'=p.id::text) AS intentos_en_cierre
 FROM objetivo p
 LEFT JOIN operativo_privado.carga_pedidos cp ON cp.pedido_id=p.id
 LEFT JOIN operativo_privado.cargas c ON c.fecha=cp.fecha
 LEFT JOIN operativo_privado.versiones_pedido v ON v.pedido_id=p.id
 LEFT JOIN LATERAL (
   SELECT h.* FROM operativo_privado.historial_operativo h
   WHERE h.pedido_id=p.id AND h.operacion='entrega_fallida' ORDER BY h.version DESC LIMIT 1
 ) f ON true
 LEFT JOIN LATERAL (
   SELECT xx AS intento FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.resumen_cierre->'intentos')='array'
    THEN c.resumen_cierre->'intentos' ELSE '[]'::jsonb END) xx
   WHERE xx->'pedido'->>'id'=p.id::text LIMIT 1
 ) x ON true
), requisitos AS (
 SELECT NULL::uuid AS pedido_id, 0 AS orden, 'pedido encontrado una sola vez' AS requisito,
        (SELECT count(*)=1 FROM objetivo) AS cumple,
        jsonb_build_object('coincidencias',(SELECT count(*) FROM objetivo)) AS valor_real,
        'PEDIDO_NO_ENCONTRADO / identidad ambigua' AS error_local
 UNION ALL
 SELECT e.id, r.orden, r.requisito, r.cumple, r.valor_real, r.error_local
 FROM evidencia e CROSS JOIN LATERAL (VALUES
 (1,'estado entrega_fallida',e.pedido->>'estado'='entrega_fallida',e.pedido->'estado','PEDIDO_NO_REPROGRAMABLE'),
 (2,'preparación finalizada',e.pedido->>'preparacion_finalizada_en' IS NOT NULL,e.pedido->'preparacion_finalizada_en','PEDIDO_NO_REPROGRAMABLE'),
 (3,'sin snapshot de venta definitiva',e.pedido->>'venta_definitiva_snapshot' IS NULL,e.pedido->'venta_definitiva_snapshot','PEDIDO_NO_REPROGRAMABLE'),
 (4,'sin venta reconocida',e.pedido->>'venta_reconocida_en' IS NULL,e.pedido->'venta_reconocida_en','PEDIDO_NO_REPROGRAMABLE'),
 (5,'sin entrega definitiva',NOT e.entrega_definitiva,to_jsonb(e.entrega_definitiva),'PEDIDO_NO_REPROGRAMABLE'),
 (6,'selección LEGACY existente e incluida',e.seleccion IS NOT NULL AND e.seleccion->>'incluido'='true',e.seleccion,'PEDIDO_NO_REPROGRAMABLE'),
 (7,'carga LEGACY cerrada',e.carga->>'estado'='cerrada',e.carga-'resumen_cierre','CIERRE_REQUERIDO'),
 (8,'intento en cierre LEGACY',e.intento IS NOT NULL,jsonb_build_object('coincidencias',e.intentos_en_cierre,'intento',e.intento),'TRAZABILIDAD_INTENTO_INVALIDA'),
 (9,'evento entrega_fallida existente',e.fallo IS NOT NULL,e.fallo,'TRAZABILIDAD_INTENTO_INVALIDA'),
 (10,'snapshot pedido igual a fila actual',e.intento->'pedido' IS NOT DISTINCT FROM e.pedido,jsonb_build_object('cierre',e.intento->'pedido','actual',e.pedido),'TRAZABILIDAD_INTENTO_INVALIDA'),
 (11,'snapshot selección igual a fila actual',e.intento->'seleccion' IS NOT DISTINCT FROM e.seleccion,jsonb_build_object('cierre',e.intento->'seleccion','actual',e.seleccion),'TRAZABILIDAD_INTENTO_INVALIDA'),
 (12,'snapshot fallo igual a último fallo',e.intento->'fallo' IS NOT DISTINCT FROM e.fallo,jsonb_build_object('cierre',e.intento->'fallo','actual',e.fallo),'TRAZABILIDAD_INTENTO_INVALIDA'),
 (13,'versión numérica y no futura',CASE WHEN jsonb_typeof(e.intento->'version')='number' THEN (e.intento->>'version')::numeric<=e.version_actual ELSE false END,jsonb_build_object('cierre',e.intento->'version','actual',e.version_actual),'TRAZABILIDAD_INTENTO_INVALIDA'),
 (14,'motivo exacto',e.intento->'motivo' IS NOT DISTINCT FROM e.fallo->'motivo',jsonb_build_object('cierre',e.intento->'motivo','fallo',e.fallo->'motivo'),'TRAZABILIDAD_INTENTO_INVALIDA'),
 (15,'versión de fallo no posterior al cierre',CASE WHEN jsonb_typeof(e.intento->'version')='number' THEN (e.fallo->>'version')::numeric<=(e.intento->>'version')::numeric ELSE false END,jsonb_build_object('fallo',e.fallo->'version','cierre',e.intento->'version'),'TRAZABILIDAD_INTENTO_INVALIDA'),
 (16,'estado auditado entrega_fallida',e.fallo->'valores_nuevos'->>'estado'='entrega_fallida',e.fallo->'valores_nuevos','TRAZABILIDAD_INTENTO_INVALIDA'),
 (17,'cierre LEGACY coincide con historial',e.cierre_auditado,to_jsonb(e.cierre_auditado),'TRAZABILIDAD_INTENTO_INVALIDA')
 ) r(orden,requisito,cumple,valor_real,error_local)
)
SELECT *, cumple IS DISTINCT FROM true AS bloquea_contrato_local,
 min(orden) FILTER(WHERE cumple IS DISTINCT FROM true) OVER () AS primer_requisito_bloqueante
FROM requisitos ORDER BY orden,pedido_id;

-- Bloque 3: recorrido completo del pedido y evidencia multi, SIN depender de
-- que todavía exista su pertenencia vigente. Busca también snapshots históricos.
WITH objetivo AS (
 SELECT p.* FROM public.pedidos p WHERE p.numero_pedido='HL-000081'
), rutas_relacionadas AS (
 SELECT r.* FROM operativo_privado.rutas_multi r
 WHERE EXISTS(SELECT 1 FROM operativo_privado.ruta_multi_pedidos m JOIN objetivo p ON p.id=m.pedido_id WHERE m.ruta_id=r.id)
 OR EXISTS(SELECT 1 FROM objetivo p WHERE r.cierre::text LIKE '%'||p.id::text||'%')
 OR EXISTS(SELECT 1 FROM operativo_privado.ruta_multi_eventos e JOIN objetivo p
   ON (e.solicitud::text||e.anterior::text||e.resultado::text) LIKE '%'||p.id::text||'%'
   WHERE e.ruta_id=r.id)
), filas AS (
 SELECT '01_pedido' AS seccion,to_jsonb(p) AS evidencia FROM objetivo p
 UNION ALL SELECT '02_cliente',to_jsonb(c) FROM public.clientes c JOIN objetivo p ON p.cliente_id=c.id
 UNION ALL SELECT '03_items',to_jsonb(i) FROM public.items_pedido i JOIN objetivo p ON p.id=i.pedido_id
 UNION ALL SELECT '04_preparacion',to_jsonb(i) FROM public.preparacion_items_pedido i JOIN objetivo p ON p.id=i.pedido_id
 UNION ALL SELECT '05_version',to_jsonb(v) FROM operativo_privado.versiones_pedido v JOIN objetivo p ON p.id=v.pedido_id
 UNION ALL SELECT '06_historial_operativo',to_jsonb(h) FROM operativo_privado.historial_operativo h JOIN objetivo p ON p.id=h.pedido_id
 UNION ALL SELECT '07_seleccion_legacy',to_jsonb(c) FROM operativo_privado.carga_pedidos c JOIN objetivo p ON p.id=c.pedido_id
 UNION ALL SELECT '08_carga_legacy_original_o_historica',to_jsonb(c) FROM operativo_privado.cargas c
 WHERE EXISTS(SELECT 1 FROM operativo_privado.carga_pedidos cp JOIN objetivo p ON p.id=cp.pedido_id WHERE cp.fecha=c.fecha)
 OR EXISTS(SELECT 1 FROM objetivo p WHERE c.resumen_cierre::text LIKE '%'||p.id::text||'%')
 UNION ALL SELECT '09_historial_cargas',to_jsonb(h) FROM operativo_privado.historial_cargas h
 WHERE EXISTS(SELECT 1 FROM objetivo p WHERE (h.solicitud::text||h.anterior::text||h.resultado::text) LIKE '%'||p.id::text||'%')
 UNION ALL SELECT '10_pertenencia_multi_actual',to_jsonb(m) FROM operativo_privado.ruta_multi_pedidos m JOIN objetivo p ON p.id=m.pedido_id
 UNION ALL SELECT '11_ruta_multi_incluye_cierre',to_jsonb(r) FROM rutas_relacionadas r
 UNION ALL SELECT '12_eventos_multi_ordenar_por_instante',to_jsonb(e) FROM operativo_privado.ruta_multi_eventos e JOIN rutas_relacionadas r ON r.id=e.ruta_id
 UNION ALL SELECT '13_entrega_definitiva',to_jsonb(d) FROM operativo_privado.entregas_definitivas d JOIN objetivo p ON p.id=d.pedido_id
)
SELECT seccion,evidencia FROM filas ORDER BY seccion,evidencia->>'instante',evidencia->>'version';

-- Bloque 4: barreras reales que una futura corrección debe conservar/adaptar.
SELECT n.nspname AS esquema,c.relname AS tabla,t.tgname AS trigger,
       t.tgenabled AS habilitacion,
       pg_get_triggerdef(t.oid) AS definicion,
       pg_get_functiondef(t.tgfoid) AS funcion_barrera
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND
 ((n.nspname='public' AND c.relname IN ('pedidos','items_pedido','preparacion_items_pedido'))
 OR (n.nspname='operativo_privado' AND c.relname IN
 ('cargas','carga_pedidos','ruta_multi_pedidos','rutas_multi','entregas_definitivas',
  'ruta_multi_eventos','ruta_multi_autorizaciones','ruta_multi_repartidores',
  'ruta_multi_capacidad','historial_cargas','permiso_reprogramacion','historial_operativo','versiones_pedido')))
ORDER BY n.nspname,c.relname,t.tgname;

-- Complemento indispensable del bloque 4: PK/UNIQUE/FK/CHECK reales, incluidas
-- referencias entrantes que podrían impedir o propagar el DELETE de pertenencia.
-- No ejecutar el parche hasta decidir si esa fila es evidencia que debe conservarse.
SELECT con.conrelid::regclass::text AS tabla, con.conname AS restriccion,
       con.contype AS tipo, con.convalidated AS validada,
       con.condeferrable AS diferible, con.condeferred AS inicialmente_diferida,
       pg_get_constraintdef(con.oid) AS definicion
FROM pg_constraint con
WHERE con.conrelid IN (to_regclass('operativo_privado.ruta_multi_pedidos'),
                      to_regclass('operativo_privado.permiso_reprogramacion'),
                      to_regclass('operativo_privado.carga_pedidos'),
                      to_regclass('operativo_privado.ruta_multi_autorizaciones'),
                      to_regclass('operativo_privado.ruta_multi_eventos'))
   OR con.confrelid IN (to_regclass('operativo_privado.ruta_multi_pedidos'),
                        to_regclass('operativo_privado.carga_pedidos'))
ORDER BY tabla,restriccion;

-- Acceso efectivo y políticas de las tablas privadas usadas por la transición.
SELECT c.oid::regclass::text AS tabla, pg_get_userbyid(c.relowner) AS propietario,
       c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls, c.relacl AS permisos,
       (SELECT jsonb_agg(jsonb_build_object('nombre',p.polname,'comando',p.polcmd,
         'permisiva',p.polpermissive,'roles',p.polroles,
         'using',pg_get_expr(p.polqual,p.polrelid),
         'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname)
        FROM pg_policy p WHERE p.polrelid=c.oid) AS politicas
FROM pg_class c
WHERE c.oid IN (to_regclass('operativo_privado.permiso_reprogramacion'),
               to_regclass('operativo_privado.ruta_multi_pedidos'),
               to_regclass('operativo_privado.rutas_multi'),
               to_regclass('operativo_privado.ruta_multi_eventos'),
               to_regclass('operativo_privado.historial_operativo'),
               to_regclass('operativo_privado.versiones_pedido'),
               to_regclass('operativo_privado.cargas'),
               to_regclass('operativo_privado.carga_pedidos'),
               to_regclass('operativo_privado.historial_cargas'),
               to_regclass('operativo_privado.ruta_multi_autorizaciones'),
               to_regclass('operativo_privado.ruta_multi_capacidad'),
               to_regclass('operativo_privado.entregas_definitivas'),
               to_regclass('public.pedidos'))
ORDER BY tabla;
