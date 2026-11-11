# Hidro Leufú — Fase 3

Implementación local. SQL pendiente de instalación manual; no ejecutado.

## Archivos de esta fase

- `src/app/(admin)/admin/rutas/page.tsx`: contrato 3, contadores separados, incorporación autorizada, historial por ruta y aviso de creación de otra ruta cuando está cerrada.
- `src/app/(admin)/admin/rutas/multiple-types.ts`: contrato de incorporación, historial y contadores.
- `src/app/(admin)/admin/rutas/multiple-actions.ts`: errores de incorporación, motivo, selección y régimen incompatible.
- `src/app/reparto/actions.ts`: mensajes de conflictos de versión, permisos y estado para rutas independientes.
- `src/app/reparto/reparto-movil.tsx`: preparación Sin preparar / Parcial / ticket Listo; estado de entrega separado; cantidades solicitadas, preparadas y faltantes; contadores de entregas y fallos.
- `src/app/reparto/page.tsx`: aclara que Listo indica preparación y que se confirma la entrega efectiva de los productos preparados.
- `supabase/manual/rutas_multiples_fase3.sql`: SQL incremental transaccional.
- Este informe. El resto de cambios preexistentes del workspace no pertenece a esta fase.

## SQL pendiente

Instalar manualmente el archivo completo `rutas_multiples_fase3.sql` como postgres, después de las fases 1 y 2 ya instaladas. No reinstalar SQL histórico. Comprueba propietario, huellas exactas de los tres cuerpos de Fase 2, dependencias y aislamiento de esquema; una diferencia o segunda instalación aborta. Las huellas son controles de compatibilidad, no firmas de seguridad. El script toma bloqueos NOWAIT y timeout de cinco segundos; ante contención se revierte todo.

Reemplaza sólo tres RPC conservando OID y ACL y restringe explícitamente EXECUTE a authenticated. Reutiliza las tablas privadas con RLS, capacidades privadas, versiones y eventos inmutables de Fase 2. No crea copias de preparación, no convierte jornadas y no hace backfill. El frontend exige contrato 3; hasta instalar el SQL se bloquea la operación administrativa nueva y se conserva consulta. Las jornadas históricas vuelven al flujo original después de verificar contrato 3; no se alteran sus cierres.

## Operación e integridad

Todos los repartidores activos asignados mantienen lectura y confirmación de entregas/fallos de su ruta. La BD verifica pertenencia, permisos y versiones, serializa con operaciones anteriores y conserva la clave y solicitud para reintentos. Un segundo responsable con una versión anterior debe consultar el estado actualizado. El cierre sigue siendo individual y exige que todos los pedidos estén entregados o tengan un fallo registrado. No se cierra la fecha ni otras rutas.

En preparación se conserva selección de pedidos nuevos, preparación existente y autorización expresa de parciales con actor, instante, motivo, versión y cantidades. Las cantidades vendidas y los importes no se reescriben al despachar; el reconocimiento de venta continúa en el contrato vigente de entrega efectiva.

Después del despacho se ofrece una modificación deliberadamente aditiva: incorpora pedidos libres de cualquier ruta/carga, de la misma fecha (hoy en America/Santiago), entrega_v1, completamente preparados, confirmados por línea y con preparación finalizada. Requiere administración y motivo; valida y despacha todos los nuevos pedidos en una única transacción. No cambia preparación, membresía, posiciones ni entregas anteriores. El resultado registra como modificación controlada si todavía no existen entregas/fallos, o incorporación extraordinaria si ya comenzaron, determinado por la BD y no por el cliente. Guarda snapshots antes/después y evidencia operativa por cada nuevo pedido; no ejecuta cobros.

El historial administrativo muestra responsable (UUID persistido), fecha/hora en America/Santiago, acción, motivo y resultado. Los snapshots completos de cantidades y operaciones permanecen privados en los eventos inmutables. La preparación conserva su historial previo. Las entregas administrativas siguen utilizando sus contratos existentes y su historial por pedido; no necesariamente producen un evento adicional de ruta.

## Bloqueos y riesgos

- No se retiran pedidos ni se cambian productos, preparación, orden o repartidores después de salir. Se evita revertir operaciones, invalidar autorizaciones o mover pertenencias históricas; para otra composición se debe crear otra ruta.
- No se incorporan extraordinariamente parciales: requieren autorización propia en otra ruta antes del despacho. Tampoco se incorporan pedidos pertenecientes a otra ruta, aunque esté cerrada. No hay reapertura, reciclaje de pedidos ni conversión automática de jornadas antiguas.
- Se bloquean nuevas salidas con régimen distinto de entrega_v1 para no crear pedidos en reparto sin confirmación compatible. Una ruta preexistente con un pedido incompatible requiere gestión específica; no se convierte su contabilidad automáticamente.
- Se conserva la restricción de preparación/salida en el día efectivo de entrega. La planificación anticipada sigue permitida.
- El bloqueo común de pedidos puede producir contención entre rutas independientes; se rechaza sin efectos parciales y se requiere actualizar/reintentar. No se promete ejecución simultánea ilimitada.
- El listado de historial y los snapshots crecen con las operaciones. No hay paginación ni retención destructiva nueva.
- Una respuesta incierta conserva la solicitud en la página; después de recargar se debe consultar el estado antes de emitir otra operación.
- No se verificó ejecución SQL ni comportamiento en navegador. Diferencias en la instalación real causan aborto por precondición y deben resolverse sin omitir los controles.

## Validación realizada

Una sola revisión estática integral, con correcciones en la misma pasada: contratos locales de autorización, preparación, entrega/fallo, cierre, historial y contabilidad; permisos, concurrencia, claves de idempotencia, preservación de preparación e interfaz responsive. Incluyó revisión de whitespace mediante `git diff --check`.

No se ejecutaron tests, builds, ESLint, SQL local/remoto, migraciones, comandos Supabase, commits ni push. No se modificó SQL histórico instalado.
