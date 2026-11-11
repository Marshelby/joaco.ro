# Hidro Leufú — rutas múltiples y preparación independiente

Implementación local de Fase 2. No instalada ni ejecutada contra Supabase.

## Archivos de esta entrega

- `src/app/(admin)/admin/rutas/page.tsx`: listado diario, fechas, creación, selección de ruta, pedidos disponibles, asignaciones múltiples, autorizaciones, salida, cierre y contadores por ruta.
- `src/app/(admin)/admin/rutas/legacy-routes.tsx` (nuevo): conserva la página anterior para fechas con carga persistida; no convierte historial.
- `src/app/(admin)/admin/rutas/multiple-types.ts`, `multiple-actions.ts`, `multiple-controls.tsx` (nuevos): contrato, autorización del servidor, formularios con confirmación expresa y reintentos conservando solicitud/clave.
- `src/app/(admin)/admin/rutas/actions.ts`, `ruta-dia-map.tsx`: orden y mapa acotados a la identidad de ruta; conserva el contrato anterior para jornadas históricas.
- `src/components/admin/delivery-order-card.tsx`: componentes de preparación existentes, cantidades persistidas, Sin preparar / Parcial / ticket Listo, consulta de pedidos y finalización explícita dentro de la ruta.
- `src/components/admin/preparation-item-control.tsx`, `preparation-compact-item-control.tsx`: conserva cantidades previamente guardadas al confirmar; distingue cantidad e importe confirmados de pedido completo.
- `src/app/reparto/actions.ts`, `reparto-movil.tsx`: lectura/operaciones por identificador de ruta, admite varias rutas para el mismo repartidor y varios repartidores en una ruta. Mantiene contratos anteriores para legado.
- `supabase/manual/rutas_multiples_fase2.sql` (nuevo): único SQL incremental manual, transaccional, con precondiciones y barreras.
- Este informe.

Los cambios de Fase 1 encontrados en `admin/repartidores` y `repartidores_gestion_fase1.sql` eran preexistentes y no fueron modificados en esta entrega. No se tocaron migraciones históricas ni SQL manual anterior.

## SQL manual pendiente y dependencias

Instalar manualmente **todo** `rutas_multiples_fase2.sql` como `postgres`, después de los contratos de preparación explícita/avance parcial, entrega real y cobro, cierre anterior, gestión de fallos, repartidores Fase 5 y gestión de repartidores Fase 1 ya instalada. El script comprueba firmas, propietarios, aislamiento de esquema y disponibilidad de los contratos que adapta. Usa bloqueo NOWAIT y timeout; una incompatibilidad o contención aborta la transacción completa. Rechaza una segunda instalación. No requiere ejecutar migraciones históricas nuevamente.

El script añade tablas privadas para estados de ruta, selección ordenada, repartidores, autorizaciones, capacidades temporales y eventos inmutables. `public.rutas` aporta la identidad existente; su estado logístico antiguo no es el estado operativo nuevo. Las paradas del modelo nuevo son la selección ordenada privada; no se ejecuta la sincronización automática de paradas por fecha.

La preparación permanece exclusivamente en `preparacion_items_pedido`. No hay copias acumulativas ni backfill de cantidades. La autorización parcial guarda actor, instante, motivo, versión y cantidades/diferencias por línea; se vuelve a validar al salir. Ni confirmar un producto ni finalizar la preparación equivale a completar las cantidades solicitadas.

Las salidas consumen sólo los miembros persistidos de la ruta. La PK de pertenencia impide compartir un pedido entre rutas; las ediciones se serializan con las RPC anteriores. El cierre conserva evidencia sólo de esa ruta, sin cerrar la fecha. Las entregas/cobros usan las funciones vigentes sin cambiar precios, importes, pagos, deudas, FIFO ni reconocimiento contable. Un repartidor sólo puede operar rutas asignadas mientras esté habilitado, con versión y autorización verificadas en BD; los reintentos no devuelven snapshots administrativos.

## Revisión estática única

Se realizó una única revisión estática integral de interfaz, acciones, contratos SQL anteriores, concurrencia, permisos, idempotencia, preparación y cierre. En esa misma pasada se corrigieron la devolución de evidencia interna en reintentos, la invalidación de comandos al revocar/rehabilitar permisos, la protección de traslados de líneas entre pedidos, la actualización de versión después de reordenar y la conservación de cantidades al confirmar. Se comprobó también whitespace mediante `git diff --check` durante la revisión.

No se ejecutaron tests, builds, ESLint, SQL local/remoto, migraciones, comandos Supabase, commits ni push. No se verificó la ejecución del SQL ni la interfaz en navegador. El análisis se limita al código y contratos disponibles localmente; la instalación real puede contener diferencias que las precondiciones rechacen.

## Riesgos y limitaciones operativas

- **Hasta instalar el SQL nuevo, las operaciones de rutas permanecen bloqueadas** y el listado diario se muestra en consulta. El fallo de lectura/autorización tampoco habilita un fallback de escritura.
- **Las fechas con una carga anterior persistida conservan la jornada única anterior**, incluso si aún no salió. No se convierten automáticamente ni admiten mezclar modelos en la misma fecha. Esta es una limitación de transición: para trabajar con varias rutas se requiere una fecha sin carga previa. La conversión de cargas existentes queda pendiente.
- **Incorporaciones extraordinarias, reasignación de repartidores, cambios de selección/preparación después de salir, reapertura de rutas cerradas y reprogramación de pedidos de rutas nuevas quedan bloqueados hasta una fase posterior.** Las rutas cerradas retienen su pertenencia histórica; no se recicla silenciosamente el pedido.
- Se pueden mantener varias rutas en preparación y otras en reparto; los comandos de escritura toman una barrera breve compartida con los contratos existentes. La contención puede exigir consultar estado y reintentar; no se promete escritura paralela ilimitada.
- Las preparaciones mantienen la restricción actual: sólo el día efectivo de entrega en America/Santiago. La planificación y asignación se pueden hacer anticipadamente. Para salir deben existir cantidades/importes confirmados y preparación finalizada; un pedido sin cantidades preparadas no puede salir.
- Las correcciones de cobro/venta conservan sus contratos. Una ruta nueva cerrada congela sus pedidos y preparación; las operaciones que intenten modificarlos se rechazan. Las diferencias de entrega siguen requiriendo administración y el régimen contable compatible actual; no se habilita cobro por repartidor.
- El cierre por ruta guarda snapshots de evidencia y puede crecer con el historial. No se añadió paginación ni retención destructiva.
- Las autorizaciones perdidas por cambio de versión o cantidades deben emitirse nuevamente. Las respuestas inciertas conservan la solicitud en la página; después de recargar debe consultarse el estado persistido antes de emitir otro comando.
