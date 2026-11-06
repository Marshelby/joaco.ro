# Auditoría final previa · Hidro Leufú · Bloque 1 · 2026-11-06

**DICTAMEN: BLOQUEADO para aplicación remota.** Hay revisión estática local, pero no evidencia del catálogo remoto ni validación de ejecución PostgreSQL. No pegar las migraciones hasta resolver los controles indicados abajo. Que los datos sean ficticios permite planificar una ventana sencilla; no demuestra compatibilidad ni autoriza borrarlos.

Proyecto objetivo: **gxmkrerhuuzeeupjliap**. No se ejecutó ninguna consulta ni escritura remota. No se aplicaron migraciones, ni se modificaron funciones/datos remotos. No se ejecutaron Docker, Supabase CLI, tests, lint, tsc, builds, servidores, commit o push. Se conservaron los cambios preexistentes del workspace y las cinco migraciones originales.

## Evidencia y limitación

Se leyeron AGENTS.md, docs/16–21, las cinco migraciones completas y antecedentes locales de preparación, estados, pagos, cuenta corriente, creaciones y permisos. Se inspeccionaron los consumidores afectados por los siete hallazgos. AGENTS exige consultar las guías Next antes de escribir código Next; esta auditoría no modifica código Next.

No hay herramienta Supabase SQL en las herramientas disponibles; tampoco conexión PostgreSQL en las variables de entorno. `.env.local` contiene URL/key pública y Turnstile, no credenciales de catálogo. No hay psql instalado. La clave pública de PostgREST no proporciona inspección arbitraria de pg_catalog. No se utilizaron RPC de negocio para intentar obtener acceso SQL. No se puede afirmar qué migraciones, columnas, RPC, ACL o triggers tiene el proyecto remoto. Tampoco se puede deducirlo de los archivos locales o del hecho de que el proyecto esté en desarrollo.

Paquete preparado:

- `01-catalogo-remoto.sql`: consultas de catálogo, roles/herencia, columnas y ACL de columna, funciones completas, sobrecargas, vistas, constraints, índices, triggers internos/externos, policies, permisos efectivos, event triggers, dependencias, tamaños y bloqueos.
- `02-historial.sql`: compara el inventario local completo con supabase_migrations; ejecutar sólo si existe esa tabla. El historial es evidencia auxiliar, no prueba de igualdad de cuerpos SQL.
- `03-huellas-antes-despues.sql`: huellas de columnas originales del núcleo y consultas generadas de vistas financieras. Sin tráfico, las capturas anteriores/posteriores deben coincidir.
- `04-verificaciones-posteriores.sql`: barreras contables, alias, ausencia de backfill operativo, firmas y matriz de ejecución esperada.
- `referencia-rpc-anteriores.txt`: últimas definiciones locales anteriores al bloque para revisión contra el remoto. NO ejecutar este archivo; contiene referencias históricas, no un rollback ni un parche.
- `manifest.json`: SHA-256 y tamaño exactos de las cinco migraciones auditadas.

Los SQL de diagnóstico contienen transacciones READ ONLY, sin llamadas a RPC de aplicación. No se ejecutaron contra PostgreSQL. Si SQL Editor sólo muestra el último resultado, ejecutar/exportar cada SELECT individualmente dentro de una sesión de sólo lectura o como SELECT autónomo. Guardar todos los resultados; no interpretar una exportación truncada como inventario completo. Revisar también las consultas financieras generadas por 03 y ejecutarlas manualmente: generar texto no las ejecuta.

## Las siete correcciones

Verificación estática, no prueba funcional ni confirmación de despliegue:

| Hallazgo | Evidencia presente | Límite |
| --- | --- | --- |
| 1. BEFORE y columnas generadas | 060000, proteger_pedido_cargado consulta pg_attribute/attgenerated y resta derivados en OLD y NEW; permite estado/fecha_actualizacion y protege fuentes en lista/en_ruta. Owner postgres y EXECUTE revocado. | Confirmar otros triggers y columnas reales; probar posteriormente salida/reapertura y rechazo de cambios de fuentes en una tarea autorizada. |
| 2. Selección estable | jornada-carga-control usa borradores por UUID, key fecha:versión, payload ordenado; nuevos sin decisión y sin inclusión automática; bloquea confirmar con borradores o pendientes. | No hay validación visual/ejecución. |
| 3. Fecha e idempotencia | operar_carga_jornada recupera historial por fecha/clave y compara actor/solicitud antes de fecha/versión; usa clock_timestamp y control final, también guardar. carga-actions delega la fecha al SQL. | El reintento adquiere EXCLUSIVE antes de recuperar resultado y puede esperar. Las RPC de preparación 050000 deliberadamente siguen exigiendo hoy incluso al reintentar. |
| 4. Cancelaciones/asociaciones | Lector incluye toda la fecha y asociados desplazados/terminales; guardar permite exclusión motivada, impide omitir asociados y no borra historia. | Asociado a otra fecha sigue rechazado; no hay traslado ni recuperación de jornada vencida. |
| 5. Cobertura | confirmar verifica asociación de cada pedido de la fecha, incluidos cancelados/terminales; EXCLUSIVE estabiliza creación/fecha/cancelación durante comando. | Los creados después del commit no se incorporan a la carga; requieren decisión posterior explícita. |
| 6. Lecturas completas | pedidos.ts usa leerCompleto hasta página vacía, avance por filas recibidas, lotes IN de 100, desempates por ID y líneas separadas en detalle. Lectores SQL agregan JSON escalar. | Sin snapshot entre páginas; JSON/historial no paginado puede agotar timeout/memoria. |
| 7. Estado cliente | customer-order-status-badge y mapa compartido etiquetan en_reparto como En ruta. | No cambia el enum ni acredita el código desplegado. |

No existe migración 20261106020000 en el repositorio; docs/21 lo declara. No inventar un paso 020000 ni asumir que hay una migración omitida.

## Compatibilidad y efectos concretos

| Migración | Cambios de aplicación | Riesgo / condición |
| --- | --- | --- |
| 20261106010000 | Añade régimen inmutable, alias generado STORED, snapshot e instante reservados NULL; reemplaza tres creaciones oficiales para insertar entrega_v1. Reintentos existentes conservan su fila/régimen. | ALTER puede reescribir pedidos y toma ACCESS EXCLUSIVE. CREATE OR REPLACE conserva owner/ACL existentes, pero reemplaza cuerpos/configuración. Comparar definición remota completa y contrato de argumentos/retorno/defaults antes. |
| 20261106030000 | Crea esquema privado, versiones/historial y auxiliares; RLS forzada y ACL denegadas; historial append-only. | CREATE SCHEMA/TABLE/FUNCTION sin IF NOT EXISTS: cualquier colisión bloquea. Versiona sólo operaciones participantes, no todo el pedido. |
| 20261106040000 | Revoca DML directo de pedidos/items/preparación; reemplaza cuatro RPC legacy con fecha efectiva hoy Santiago. | Rompe escritores externos directos. REVOKE de tabla no elimina grants de columna o membresías adicionales. Owner/ACL de RPC previas se conservan. Legacy usa search_path public: revisar CREATE en ese esquema y referencias no calificadas. |
| 20261106050000 | Confirmación explícita/cierre; total provisional separado; renombra importe_operativo a importe_operativo_legacy y crea nuevo alias STORED. Revoca guardar/finalizar/marcar listo legacy. | Otra reescritura/bloqueo posible. Referencias SQL almacenadas conservan attnum del alias viejo; texto SQL/PLpgSQL/dinámico puede resolver el nombre nuevo al ejecutar. Revisar consumidores externos y SELECT */rowtype. Preparaciones viejas quedan NO confirmadas; cierres históricos no se reabren. |
| 20261106060000 | Carga por fecha, guardar/confirmar/salir/reabrir, auditoría y trigger protector; revoca salida individual. | Cada comando toma EXCLUSIVE global en pedidos, incluso guardar/reintento. Bloquea INSERT/UPDATE/DELETE y SELECT FOR UPDATE/SHARE de cualquier fecha; SELECT normal puede seguir. FK carga_pedidos.pedido_id ON DELETE RESTRICT impide borrar pedidos asociados, también excluidos. |

No hay DROP/TRUNCATE ni UPDATE/DELETE de filas de negocio en el nivel superior de estas cinco migraciones. Los UPDATE/DELETE/INSERT de los cuerpos de funciones no se ejecutan por definirlas. No se borra ni resetea el dataset ficticio. Sí hay cambios potencialmente disruptivos: renombrar una columna, retirar permisos/rutas, reemplazar siete cuerpos de RPC y añadir restricciones/trigger/FK. No son migraciones idempotentes ni reversibles con una simple reaplicación.

Checkout/conversión/creación admin conservan sus firmas públicas locales; después de 040000 dependen de que sus SECURITY DEFINER tengan owner con privilegios adecuados. Si falta una función previa, CREATE OR REPLACE puede crearla en vez de reemplazarla y recibir ACL por defecto: es motivo para bloquear, no una reparación automática.

050000 deja el total operativo de preparación separado de subtotal/total/subtotal_final/total_final: una cantidad o importe preparado distinto NO ajusta deuda, pagos ni aplicaciones en el flujo nuevo. La cuenta corriente y saldos locales siguen usando coalesce(total_final,total), cargo desde creación para pedido no cancelado. entrega_v1 es cohorte, NO switch de reconocimiento al entregar. No se crean ventas definitivas ni pagos ni anticipos por estas migraciones.

La función legacy finalizar_preparacion reemplazada por 040000 conserva reajuste de aplicaciones; 050000 retira su ejecución a roles API, no elimina su cuerpo ni impide al owner/wrapper invocarla. Buscar wrappers y sobrecargas remotas. Las ACL sobre pagos/aplicaciones/historial legacy no se endurecen aquí.

El trigger 060000 protege TODAS las fuentes del pedido en lista/en_ruta salvo estado/fecha_actualizacion, por lo que RPC de cancelación u otras que cambien totales/cierre pueden ser rechazadas. La entrega legacy que sólo cambia estado es compatible con la fuente local. La barrera de estados no define por sí sola todas las transiciones permitidas: dependen también de las RPC y permisos reales. No existe captura de cantidades entregadas/cobros/reconocimiento nuevo.

EXCLUSIVE evita la inversión concreta con filas legacy que ya tienen ROW SHARE/ROW EXCLUSIVE de pedidos; no demuestra ausencia de todos los deadlocks entre tablas (pagos, clientes, items o wrappers externos). DDL toma locks más fuertes y los conserva hasta cada COMMIT. Se requiere ventana sin tráfico y sin transacciones antiguas; no terminar sesiones por iniciativa de esta auditoría.

## Controles previos obligatorios para levantar el bloqueo

1. En Dashboard abrir exactamente gxmkrerhuuzeeupjliap / SQL Editor, rol postgres. Confirmar proyecto en URL/UI; current_database() no basta. Detener tráfico de aplicación y jobs escritores mediante el procedimiento operativo autorizado. Inventariar consumidores fuera del repo; los REVOKE afectan también service_role. Respaldar/exportar definiciones, ACL y datos necesarios antes de la aplicación futura.
2. Ejecutar 01. Confirmar versión PostgreSQL compatible con GENERATED STORED, JSONB menos text[], hashtextextended, sha256(bytea), gen_random_uuid y funciones disponibles bajo los search_path fijados. Revisar tablas particionadas/herencia, tipos, constraints y event triggers. Cualquier estructura inesperada requiere comparación, no adaptación improvisada.
3. Ejecutar 02 sólo si existe historial. Revisar TODAS las predecesoras locales hasta 20261105030000 inclusive. Las cinco nuevas deben estar ausentes tanto del historial como del catálogo. Si falta registro histórico por aplicación manual, no asumir falta real: exigir equivalencia del catálogo y constancia de aplicación; no insertar registros ficticios. Si aparece cualquiera de las cinco o sus objetos, clasificar como aplicación parcial/previa y detener la secuencia completa hasta reconciliarla.
4. Comparar cuerpos remotos contra referencia-rpc-anteriores.txt y migraciones históricas completas. Requeridas para reemplazo: checkout(uuid,uuid,jsonb,text,uuid,date,text[]), convertir_posible_pedido_administrativo(uuid,bigint,uuid,uuid,date,text[]), crear_pedido_administrativo(uuid,jsonb), marcar_pedido_preparando_administrativo(uuid), marcar_pedido_listo_despacho_administrativo(uuid), guardar_preparacion_item_pedido_administrativo(uuid,numeric,text), finalizar_preparacion_pedido_administrativo(uuid). Verificar firmas, nombres de parámetros, defaults, retorno, owner postgres, SECURITY DEFINER, ACL y proconfig. No debe quedar checkout antiguo ni otra sobrecarga/wrapper que evite controles. Revisar también salida, entrega, cancelaciones, pagos y auxiliares pp_* que usan estas creaciones.
5. Confirmar que no existe operativo_privado ni nombres nuevos públicos, triggers o columnas del bloque. Confirmar todas las columnas referenciadas por los cuerpos. Especialmente pedidos.total_final/subtotal_final/preparacion_*, numero_pedido y snapshots; items_pedido.modo_cantidad_snapshot/total_final_administrativo/total_linea; preparación numeric(12,3), registrado_por y constraint UNIQUE con nombre exacto preparacion_items_pedido_item_pedido_id_key; estructuras de posibles pedidos, auditoría admin y creaciones administrativas de 20261105030000. Verificar índices de idempotencia y FK. 01 proporciona inventario completo, no sólo columnas seleccionadas.
6. Revisar propietarios y privilegios efectivos, ACL de columna, herencia, PUBLIC y default privileges. Para las tres tablas que 040000 endurece, no debe existir vía DML API residual por columna o membresía. Las cinco nuevas RPC públicas deben quedar sólo authenticated con autorización admin interna; auxiliares privados sin USAGE/EXECUTE API. Grants remotos a otros roles no se eliminan con los REVOKE enumerados: resolver explícitamente antes. Confirmar public no escribible por roles no confiables, considerando search_path legacy.
7. Revisar triggers reales y sus funciones (incluidos event triggers y orden alfabético BEFORE), constraints, policies, vistas y dependencias registradas más referencias de texto/dinámicas no registradas por pg_depend. Confirmar que ningún consumidor financiero pasará accidentalmente al nuevo importe_operativo. Exportar definiciones completas; no comparar sólo nombres/hashes.
8. Ejecutar 03 y cada SELECT financiero generado. Conservar valores y resultados de estado/fecha. Revisar tamaño de pedidos y bloqueos activos de 01. No iniciar aplicación con transacciones escritoras abiertas, conexiones antiguas bloqueantes ni despliegues/jobs concurrentes.
9. Registrar revisión de los resultados y levantar explícitamente este bloqueo mediante una nueva auditoría. La revisión de catálogos no demuestra concurrencia, respuestas HTTP o usabilidad: esas validaciones funcionales continúan pendientes y no se han ejecutado por instrucción.

## Procedimiento exacto futuro en SQL Editor (condicionado a controles aprobados)

No hay consolidado de aplicación en este paquete porque la seguridad remota no está acreditada. Las cinco migraciones ya contienen BEGIN/COMMIT propios y su DDL ordinario es transaccional; no contienen CREATE INDEX CONCURRENTLY, VACUUM u otra instrucción superior que exija salir de transacción. No añadir BEGIN alrededor de los cinco archivos: PostgreSQL no anida transacciones y el primer COMMIT cerraría la transacción externa. Un único COMMIT global exigiría editar explícitamente los delimitadores originales, cosa que no se hizo ni se entrega silenciosamente.

Aplicar **un archivo original completo por ejecución**, en este orden, sin seleccionar fragmentos, una vez levantado el bloqueo:

1. `supabase/migrations/20261106010000_preparar_regimen_contable_entrega.sql`
2. `supabase/migrations/20261106030000_seguridad_auditoria_operativa.sql`
3. `supabase/migrations/20261106040000_restringir_fecha_preparacion.sql`
4. `supabase/migrations/20261106050000_preparacion_explicita_productos.sql`
5. `supabase/migrations/20261106060000_carga_camioneta_salida.sql`

Antes de cada ejecución comprobar que coincide con manifest.json y no cambió desde esta auditoría. Usar rol postgres, ninguna transacción manual abierta y aplicación en ventana de mantenimiento. Como protección opcional de sesión, en una sesión garantizada por la herramienta establecer antes del archivo `SET lock_timeout='5s'; SET statement_timeout='120s';`; son configuración de sesión, no parte de los originales ni ejecutados por esta auditoría. Si el editor no garantiza misma sesión, no asumir que esos límites aplican. No aumentar tiempos automáticamente si falla; evaluar tamaño/bloqueos.

Después de cada archivo y COMMIT confirmado, ejecutar los SELECT relevantes de 01 y guardar evidencia:

- Tras 010000: régimen NOT NULL/default legado/CHECK de valores, generated coalesce(total_final,total), venta NULL/CHECK, trigger de inmutabilidad; las tres firmas/cuerpos de creación con entrega_v1 y owners/ACL conservados. Huellas originales 03 idénticas.
- Tras 030000: esquema owner postgres, dos tablas vacías owner postgres RLS ENABLE/FORCE sin policies, dos triggers append-only y tres auxiliares con ACL privadas. No cambios económicos.
- Tras 040000: DML efectivo INSERT/UPDATE/DELETE/TRUNCATE falso para roles API en las tres tablas y ningún privilegio por columna; SELECT autorizado preservado; cuatro cuerpos con reloj tras locks, firma/owner/ACL conservados. Cualquier permiso residual bloquea el siguiente paso.
- Tras 050000: alias legacy y nuevo con expresiones correctas; columnas nuevas/default false y constraints; tres RPC nuevas owner postgres/SECURITY DEFINER; tres legacy no ejecutables por roles API. Filas históricas sin confirmación ni agregado nuevo, huellas 03 iguales.
- Tras 060000: tres tablas privadas vacías, RLS forzada/ACL/owner postgres, FK restrict y dos triggers de historial; trigger protector en pedidos activo y dueño de su función postgres; lector/comando con firmas y ACL correctos; salida individual no ejecutable por API. Completar 04, repetir 01 y 03 y comparar todas las huellas, definiciones financieras y permisos. Anomalías sin tráfico deben ser cero.

Los cinco commits son independientes. Una falla en el cuarto NO revierte los tres anteriores. Mantener la ventana de mantenimiento hasta completar/reconciliar la cadena y coordinar el código que consume las RPC nuevas. No reabrir el frontend antiguo entre 040000 y 060000: sus botones/RPC pueden haber quedado retirados. Tras la revisión de catálogo, actualizar el esquema expuesto de PostgREST por el mecanismo autorizado si no detecta aún las nuevas firmas; no recurrir a recrear funciones ni dar grants amplios. Esta auditoría no envía NOTIFY ni cambia configuración.

SQL Editor no actualiza por sí mismo supabase_migrations.schema_migrations al pegar SQL. Guardar archivo, SHA, hora, operador, estado COMMIT y resultados en la bitácora de aplicación. La eventual regularización del historial requiere un procedimiento explícito y revisión de su esquema remoto; no inventar INSERT de bookkeeping aquí ni afirmar que la ausencia de registro permite reaplicar.

## Si falla o se pierde la respuesta

- Detenerse inmediatamente; no ejecutar la siguiente migración ni reintentar la cadena completa. Conservar SQLSTATE, mensaje, posición, hora y archivo/huella. No borrar datos ficticios, columnas, funciones ni schema privado para vencer colisiones.
- Error antes del COMMIT dentro de un archivo: PostgreSQL aborta esa transacción; si la misma sesión permanece abierta emitir ROLLBACK como operación de recuperación durante la futura aplicación autorizada. Confirmar el catálogo desde otra consulta/sesión. No tratar ROLLBACK en una pestaña con conexión diferente como garantía de cerrar la sesión original.
- Timeout, desconexión o respuesta incierta: COMMIT puede haber ocurrido. Comparar catálogo, cuerpos/ACL y objetos completos con el hito anterior/posterior; el historial manual puede no cambiar y no prueba rollback. No reaplicar hasta determinar si quedó aplicado íntegro, revertido o hubo ejecución parcial por selección de fragmentos.
- Columna/esquema/función duplicada, incompatibilidad de retorno/nombres de argumentos, permiso denegado o dependencia inesperada: volver a BLOQUEADO. No convertir CREATE a CREATE OR REPLACE/IF NOT EXISTS, no DROP CASCADE ni conceder privilegios para forzar avance.
- Lock timeout/deadlock: identificar bloqueadores con 01, retirar tráfico por procedimiento autorizado y revaluar orden de locks. Una vez confirmado rollback y resuelta la causa puede reintentarse SÓLO el archivo no confirmado. No terminar sesiones ni aumentar timeouts sin entender el bloqueo.
- Tras COMMIT, no hay rollback transaccional de ese archivo. Cualquier reversión requiere migración correctiva explícita preservando datos/historial, o restauración autorizada del respaldo. No existe un down seguro genérico para estas revocaciones, renombres y tablas auditadas.

Para cambiar el dictamen a APTO se necesitan los resultados remotos completos y su reconciliación, ausencia de conflictos/ACL residuales y aceptación de los riesgos de bloqueo y corte coordinado. No se solicita permiso para aplicar ahora: el trabajo autorizado de esta sesión termina en auditoría y preparación, sin escrituras remotas.
