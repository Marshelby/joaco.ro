-- HIDRO LEUFÚ — mantenimiento definitivo de pedidos de prueba.
-- REVISIÓN ESTÁTICA LOCAL ÚNICAMENTE. No ejecutado contra ninguna base.
-- Ejecutar el archivo COMPLETO en sesión postgres y ventana sin tráfico/DDL/jobs.
-- Ante cualquier error, ROLLBACK; nunca continuar por fragmentos.
-- Contrato esperado comunicado: 26 pedidos, 106 items, 7 aplicaciones,
-- 9 carga_pedidos, 0 ruta_multi_pedidos, 85 historiales operativos.
-- No presupone que migraciones/manuales coincidan con el servidor instalado.
-- Conserva cargas/rutas (padres independientes), pagos, ajustes y todo lo que
-- no sea una dependencia exclusiva incluida abajo. No reinicia secuencias.
-- Al retirar aplicaciones cambia el saldo disponible de los pagos conservados.
-- Si una carga/historial por fecha o JSON conserva referencias a los objetivos,
-- ABORTA: una fecha compartida no demuestra propiedad exclusiva del pedido.
-- Fuentes revisadas: núcleo; preparación; auditoría operativa; cargas;
-- contabilidad entrega/pagos; correcciones; beneficios; chat; posibles pedidos;
-- manuales terminar_ruta_fase2 y rutas_multiples_fase2/fase3.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = pg_catalog, pg_temp;

CREATE TEMP TABLE reinicio_antes(tabla text NOT NULL, fila jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE reinicio_tablas(tabla text PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE reinicio_objetivos(
  tabla text NOT NULL, fila jsonb NOT NULL, orden integer NOT NULL,
  UNIQUE(tabla, fila)
) ON COMMIT DROP;
CREATE TEMP TABLE reinicio_despues(tabla text NOT NULL, fila jsonb NOT NULL) ON COMMIT DROP;

DO $mantenimiento$
DECLARE
  r record; f record; t record; n bigint; condicion text; hija text; padre text;
  definicion_trigger text; contrato_trigger jsonb;
BEGIN
  IF current_user <> 'postgres' OR NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)
  ) THEN RAISE EXCEPTION 'BLOQUEO: requiere postgres con lectura completa y BYPASSRLS'; END IF;
  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'BLOQUEO: session_replication_role debe ser origin';
  END IF;

  -- Copias temporales internas: no exportan datos Auth. Bloqueos amplios para
  -- detectar también efectos laterales sobre TODOS los registros conservados.
  FOR r IN
    SELECT c.oid,n.nspname,c.relname,c.relkind,c.relispartition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','f') AND c.relpersistence <> 't'
      AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_'
    ORDER BY n.nspname,c.relname
  LOOP
    IF r.relkind <> 'r' OR r.relispartition THEN
      RAISE EXCEPTION 'BLOQUEO: tabla particionada/remota requiere plan específico: %.%',r.nspname,r.relname;
    END IF;
    EXECUTE format('LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE NOWAIT',r.nspname,r.relname);
    INSERT INTO reinicio_tablas VALUES (r.nspname||'.'||r.relname);
    EXECUTE format('INSERT INTO pg_temp.reinicio_antes SELECT %L,to_jsonb(x) FROM %I.%I x',
      r.nspname||'.'||r.relname,r.nspname,r.relname);
  END LOOP;

  FOR r IN SELECT * FROM (VALUES
    ('public.pedidos',26),('public.items_pedido',106),
    ('public.aplicaciones_pago',7),('operativo_privado.carga_pedidos',9),
    ('operativo_privado.ruta_multi_pedidos',0),('operativo_privado.historial_operativo',85)
  ) e(tabla,esperado) LOOP
    IF to_regclass(r.tabla) IS NULL THEN
      RAISE EXCEPTION 'BLOQUEO: falta tabla esperada %',r.tabla;
    END IF;
    SELECT count(*) INTO n FROM reinicio_antes WHERE tabla=r.tabla;
    IF n<>r.esperado THEN
      RAISE EXCEPTION 'BLOQUEO: % esperado %, actual %',r.tabla,r.esperado,n;
    END IF;
  END LOOP;

  -- No ocultar evidencia de cierre borrando primero la selección.
  SELECT a.fila->>'pedido_id' pedido, c.fila->>'fecha' fecha INTO r
  FROM reinicio_antes a JOIN reinicio_antes c ON c.tabla='operativo_privado.cargas'
    AND c.fila->>'fecha'=a.fila->>'fecha'
  WHERE a.tabla='operativo_privado.carga_pedidos' AND c.fila->>'estado'='cerrada' LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION
    'BLOQUEO RUTA_CERRADA: carga % / pedido %; proteger_cierre_seleccion impide DELETE; no se reabre ni retira evidencia',r.fecha,r.pedido;
  END IF;
  IF EXISTS(SELECT 1 FROM reinicio_antes WHERE tabla IN (
    'operativo_privado.ruta_multi_autorizaciones','operativo_privado.permiso_reprogramacion',
    'operativo_privado.reparto_capacidad','operativo_privado.ruta_multi_capacidad')) THEN
    RAISE EXCEPTION 'BLOQUEO: autorizaciones multi/capacidades operativas presentes; no se consumen ni fabrican';
  END IF;

  INSERT INTO reinicio_objetivos SELECT tabla,fila,100 FROM reinicio_antes WHERE tabla='public.pedidos';
  -- Allowlist de HIJOS, nunca de padres compartidos. No cierre CASCADE automático.
  INSERT INTO reinicio_objetivos
  SELECT a.tabla,a.fila,e.orden FROM reinicio_antes a JOIN (VALUES
    ('public.items_pedido',80),('public.preparacion_items_pedido',20),
    ('public.historial_estados_pedido',20),('public.aplicaciones_pago',20),
    ('operativo_privado.carga_pedidos',20),('public.paradas_ruta',20),
    ('operativo_privado.versiones_pedido',20),('operativo_privado.historial_operativo',10),
    ('public.creaciones_pedidos_administrativas',20)
  ) e(tabla,orden) ON e.tabla=a.tabla
  WHERE EXISTS(SELECT 1 FROM reinicio_antes p WHERE p.tabla='public.pedidos'
    AND p.fila->>'id'=a.fila->>'pedido_id');
  INSERT INTO reinicio_objetivos
  SELECT a.tabla,a.fila,10 FROM reinicio_antes a
  WHERE a.tabla='public.auditoria_precios_pedido_administrativo'
    AND EXISTS(SELECT 1 FROM reinicio_objetivos i WHERE i.tabla='public.items_pedido'
      AND i.fila->>'id'=a.fila->>'item_pedido_id');
  IF (SELECT count(*) FROM reinicio_objetivos WHERE tabla='operativo_privado.historial_operativo')<>85 THEN
    RAISE EXCEPTION 'BLOQUEO: historial operativo huérfano/ajeno; no pertenece íntegramente a los 26 pedidos';
  END IF;

  -- Inspección de TODAS las FK instaladas, incluso CASCADE/SET NULL y esquemas
  -- adicionales. Cualquier hijo conservado bloquea ANTES del primer DELETE.
  FOR f IN SELECT * FROM pg_constraint WHERE contype='f' LOOP
    SELECT n.nspname||'.'||c.relname INTO hija FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=f.conrelid;
    SELECT n.nspname||'.'||c.relname INTO padre FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=f.confrelid;
    SELECT string_agg(format('(h.fila->%L <> ''null''::jsonb AND h.fila->%L=p.fila->%L)',
      ha.attname,ha.attname,pa.attname),' AND ' ORDER BY k.ord) INTO condicion
    FROM unnest(f.conkey,f.confkey) WITH ORDINALITY k(h,p,ord)
    JOIN pg_attribute ha ON ha.attrelid=f.conrelid AND ha.attnum=k.h
    JOIN pg_attribute pa ON pa.attrelid=f.confrelid AND pa.attnum=k.p;
    EXECUTE format('SELECT count(*) FROM pg_temp.reinicio_antes h JOIN pg_temp.reinicio_objetivos p ON %s
      WHERE h.tabla=$1 AND p.tabla=$2 AND NOT EXISTS
      (SELECT 1 FROM pg_temp.reinicio_objetivos o WHERE o.tabla=h.tabla AND o.fila=h.fila AND o.orden<p.orden)',condicion)
      INTO n USING hija,padre;
    IF n>0 THEN RAISE EXCEPTION 'BLOQUEO FK %: % -> %, % filas conservadas/orden incompatible',f.conname,hija,padre,n; END IF;
  END LOOP;

  -- Referencias históricas sin FK: JSON de cargas, pagos corregidos, solicitudes,
  -- chats, producción, etc. Conservador: coincidencias ambiguas también abortan.
  FOR r IN SELECT DISTINCT v.value #>> '{}' id FROM reinicio_objetivos o
    CROSS JOIN LATERAL jsonb_each(o.fila) v
    WHERE v.key IN ('id','pedido_id','item_pedido_id','clave_idempotencia')
      AND (v.value #>> '{}') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  LOOP
    SELECT a.tabla,a.fila INTO t FROM reinicio_antes a
    WHERE strpos(lower(a.fila::text),lower(r.id))>0
      AND NOT EXISTS(SELECT 1 FROM reinicio_objetivos o WHERE o.tabla=a.tabla AND o.fila=a.fila)
    LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'BLOQUEO referencia conservada sin exclusividad: tabla %, UUID %, claves %',
      t.tabla,r.id,(SELECT jsonb_object_agg(key,value) FROM jsonb_each(t.fila) WHERE key IN ('id','fecha','version','clave','pago_id'));
    END IF;
  END LOOP;

  -- Sólo excepción para historial_operativo. Otros registros inmutables (venta,
  -- entrega, creación administrativa, auditoría de precios) bloquean: no se
  -- presume que sea seguro perder comprobantes contables/administrativos.
  FOR r IN SELECT DISTINCT tabla FROM reinicio_objetivos LOOP
    IF EXISTS(SELECT 1 FROM pg_rewrite WHERE ev_class=to_regclass(r.tabla) AND ev_type<>'1') THEN
      RAISE EXCEPTION 'BLOQUEO regla de escritura en %',r.tabla;
    END IF;
    FOR t IN SELECT g.*,p.oid::regprocedure funcion FROM pg_trigger g JOIN pg_proc p ON p.oid=g.tgfoid
      WHERE g.tgrelid=to_regclass(r.tabla) AND NOT g.tgisinternal AND (g.tgtype::integer & 8)=8
    LOOP
      IF t.tgenabled<>'O' THEN RAISE EXCEPTION 'BLOQUEO trigger con estado no ordinario: % / %',r.tabla,t.tgname; END IF;
      IF r.tabla='operativo_privado.historial_operativo' AND t.tgname='historial_operativo_inmutable'
        AND t.tgfoid=to_regprocedure('operativo_privado.impedir_mutacion_historial()')
        AND t.tgtype=27 AND t.tgnargs=0 AND t.tgqual IS NULL THEN
        definicion_trigger:=pg_get_triggerdef(t.oid);
        contrato_trigger:=to_jsonb(t)-ARRAY['oid','funcion'];
      ELSIF t.tgfoid NOT IN (
        coalesce(to_regprocedure('operativo_privado.proteger_ruta_multi()'),0::oid),
        coalesce(to_regprocedure('operativo_privado.proteger_contratos_multi()'),0::oid),
        coalesce(to_regprocedure('operativo_privado.proteger_cierre_carga()'),0::oid),
        coalesce(to_regprocedure('operativo_privado.proteger_pedido_ruta_cerrada()'),0::oid),
        coalesce(to_regprocedure('operativo_privado.proteger_linea_ruta_cerrada()'),0::oid),
        coalesce(to_regprocedure('operativo_privado.proteger_orden_ruta_cerrada()'),0::oid)
      ) THEN RAISE EXCEPTION 'BLOQUEO trigger DELETE requiere contrato específico: % / % / %',r.tabla,t.tgname,t.funcion;
      END IF;
    END LOOP;
  END LOOP;
  IF definicion_trigger IS NULL THEN RAISE EXCEPTION 'BLOQUEO: contrato esperado historial_operativo_inmutable ausente'; END IF;

  -- Excepción de mantenimiento ESTRICTAMENTE transaccional y de UNA tabla,
  -- bloqueada ACCESS EXCLUSIVE. No cambia la función compartida, ACL, RLS,
  -- replication_role ni triggers de otras tablas. El trigger vuelve ANTES del
  -- COMMIT; cualquier error revierte también el DDL. Ningún rol API accede.
  EXECUTE 'DROP TRIGGER historial_operativo_inmutable ON operativo_privado.historial_operativo';
  FOR r IN SELECT * FROM reinicio_objetivos ORDER BY orden,tabla,fila::text LOOP
    EXECUTE format('DELETE FROM %s x WHERE to_jsonb(x)=$1',to_regclass(r.tabla)) USING r.fila;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>1 THEN RAISE EXCEPTION 'BLOQUEO DELETE no exacto: %, filas %',r.tabla,n; END IF;
  END LOOP;
  EXECUTE definicion_trigger;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger g WHERE g.tgrelid='operativo_privado.historial_operativo'::regclass
    AND g.tgname='historial_operativo_inmutable' AND to_jsonb(g)-'oid'=contrato_trigger) THEN
    RAISE EXCEPTION 'BLOQUEO: restauración exacta del trigger falló';
  END IF;
  SET CONSTRAINTS ALL IMMEDIATE;
  FOR r IN SELECT tabla FROM reinicio_tablas LOOP
    EXECUTE format('INSERT INTO pg_temp.reinicio_despues SELECT %L,to_jsonb(x) FROM %s x',r.tabla,to_regclass(r.tabla));
  END LOOP;
  IF EXISTS(
    (SELECT tabla,fila FROM reinicio_despues EXCEPT ALL
      SELECT a.tabla,a.fila FROM reinicio_antes a WHERE NOT EXISTS
        (SELECT 1 FROM reinicio_objetivos o WHERE o.tabla=a.tabla AND o.fila=a.fila))
    UNION ALL
    (SELECT a.tabla,a.fila FROM reinicio_antes a WHERE NOT EXISTS
      (SELECT 1 FROM reinicio_objetivos o WHERE o.tabla=a.tabla AND o.fila=a.fila)
      EXCEPT ALL SELECT tabla,fila FROM reinicio_despues)
  ) THEN RAISE EXCEPTION 'BLOQUEO: cambió una fila fuera del conjunto exclusivo; rollback integral'; END IF;
  IF EXISTS(SELECT 1 FROM public.pedidos) THEN RAISE EXCEPTION 'BLOQUEO: quedan pedidos'; END IF;
END;
$mantenimiento$;

SELECT tabla,count(*) AS filas_eliminadas FROM reinicio_objetivos GROUP BY tabla ORDER BY tabla;
COMMIT;
-- Límites: UUID codificados/consumidores externos no se pueden probar con FK
-- ni búsqueda textual. Revisar integraciones externas antes de la ejecución.
-- No se afirma que exista un bloqueo remoto: se informa con nombre/fila al
-- evaluar el contrato real, antes de borrar, o revierte íntegramente si un
-- trigger operativo activo rechaza DELETE. Nunca completar borrados a mano.
