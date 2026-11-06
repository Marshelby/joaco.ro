# Bloque 1 · Microintegración 6/8

Migración incremental: `20261106060000_carga_camioneta_salida.sql`. Aplicar posteriormente y en orden, después de 010000, 030000, 040000 y 050000. No se aplicó SQL local ni remoto durante la implementación.

## Estados y contrato

Una carga por fecha de jornada, sin creación automática durante lecturas. Selección explícita persistida en esquema privado, con incluidos y excluidos; no incorpora automáticamente pedidos nuevos. Todos los pedidos que aparecen en la selección enviada deben tener decisión; excluir requiere motivo no vacío de hasta 2000 caracteres. Los miembros previamente guardados no pueden desaparecer de la solicitud: deben excluirse con motivo. Un pedido no puede pertenecer a dos cargas.

`leer_carga_jornada(date)` devuelve estado de carga, versión, selección, estado individual, productos preparados, cantidades, importes provisionales, pendientes e historial. Los nuevos pedidos aparecen sin decisión guardada. Revisarlos y guardar nuevamente es una decisión administrativa; confirmar nunca los incorpora implícitamente.

`operar_carga_jornada(date,bigint,uuid,text,jsonb,text)` es el comando transaccional administrativo compartido. Acciones:

- `guardar`: conserva selección explícita completa; solo en preparación. No cambia pedidos.
- `confirmar`: certificación humana de carga física. Requiere incluidos en `listo_despacho`, cierre de preparación y todos los productos explícitamente confirmados con importe. Carga pasa a `lista` (Lista para salir). No cambia estados individuales ni importes.
- `salir`: exige carga `lista` y revalida productos, estado y fecha. Cambia todos los incluidos a `en_reparto`, carga a `en_ruta`, con auditoría por pedido y carga en la misma transacción. Lectores existentes muestran En ruta.
- `reabrir`: exige carga `lista` y motivo. Carga vuelve a preparación y todos los incluidos a `preparando`; libera cierre y conserva filas de preparación, cantidades, importes y confirmaciones para corregirlas. Deben cerrar nuevamente la preparación antes de confirmar otra vez.

Confirmar, salir y reabrir exigen fecha efectiva igual a hoy America/Santiago después de adquirir todos los bloqueos. No permiten recuperar una jornada vencida mediante esta integración. En ruta no hay edición, reconfirmación ni retroceso global.

## Concurrencia, permisos y auditoría

Lock transaccional por fecha, fila de carga y pedidos en orden UUID; bloqueos de productos al validar. Versión de carga obligatoria; cambios individuales se serializan mediante los mismos locks de pedido usados por preparación. Salida y reapertura también incrementan versión operativa de cada pedido mediante infraestructura 030000. No se interpreta esa versión como versión global del pedido legacy.

Clave por fecha, actor y solicitud completa incluyendo versión esperada. Reintento idéntico devuelve resultado original antes de validar estado actual o fecha; no repite efectos. Reutilizar con otro payload o actor falla. La interfaz conserva clave mientras no cambia el payload, incluso ante respuesta de red incierta.

Tablas privadas sin permisos API y con RLS forzada, funciones SECURITY DEFINER con search_path fijo y autorización administrativa. Historial append-only con triggers contra UPDATE, DELETE y TRUNCATE; snapshots de selección, cantidades e importes en anterior/resultado. Las filas privadas no se exponen directamente. Se revoca la RPC individual legacy de salida y se retira su botón. Trigger protege pedidos de cargas confirmadas frente a cambios de preparación/fecha y bloquea estados previos tras salir.

## Interfaz y alcance

Control adaptable a móvil/escritorio en jornadas administrativas, revisión de productos, pendientes, exclusiones, certificación física, salida separada y reapertura motivada. Lector, acción y componente reutilizables desde `/admin/rutas`; no se activó el planificador pendiente ni se alteraron sus paradas. Estado de carga separado del estado del pedido y del estado logístico de las rutas históricas.

No cambia vistas financieras, pagos, aplicaciones, venta definitiva ni reconocimiento contable. No agrega ajustes del repartidor, entregas o cobros. Se preservan los cambios previos del workspace.

## Revisión y riesgos pendientes

Revisión estática manual únicamente. Por instrucción no se ejecutaron tests, lint, tsc, builds, Docker, servidores, commits ni push. La migración está pendiente de aplicar y validar en un entorno autorizado; no afirmar validación de ejecución SQL o TypeScript.

Pendientes de validación futura: roles anon/cliente/admin/service_role, doble clic, reintentos después de salida, conflictos entre pestañas, pendientes y cierres legacy sin confirmación explícita, exclusión sin motivo, cruce de medianoche al esperar locks, reapertura y edición conservando importes, atomicidad ante fallo intermedio y consulta del cliente En ruta. Validar también las ACL reales contra las migraciones locales: propietarios de base de datos pueden administrar o desactivar triggers; la inmutabilidad es de aplicación, no protección frente al superusuario.

La carga física es una declaración del administrador, no una comprobación por sensores. Una sola carga por fecha es el alcance actual; múltiples camionetas o salidas requieren otra integración. La planificación histórica no consume todavía la selección de carga: no usar sincronización de paradas como manifiesto operativo. No hay reprogramación de pedidos ya asociados a una carga: requiere diseño posterior explícito, sin borrar su historial. La lista y su auditoría no están paginadas; revisar rendimiento para jornadas grandes.
