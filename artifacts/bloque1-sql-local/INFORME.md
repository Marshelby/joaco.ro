# Validación SQL local integral · Bloque 1 · 2026-11-06

**Dictamen: BLOQUEADO.** No se acredita validación integral ni aptitud para revisión de despliegue. Se ejecutaron comprobaciones del entorno y revisión estática; **cero migraciones aplicadas y cero pruebas SQL ejecutadas** en esta sesión.

## Bloqueo reproducido

Docker CLI 29.9.2 está instalado. `docker version` y `docker ps --all` fallan al acceder a unix:///var/run/docker.sock con permission denied. No se pudo identificar contenedores, servicios, volúmenes, historial aplicado ni datos. Supabase CLI no está en PATH (127); la instalación histórica `/tmp/hidro-leufu-tools/node_modules/.bin/supabase` no existe. Tampoco se encontraron psql, postgres o initdb en PATH. Evidencia nueva: `preflight.json` con códigos y salidas.

La política de esta sesión no permite escalación. No se cambiaron permisos del socket, grupos ni servicios. No se intentó reset, start, stop, instalación ni conexión alternativa. Sin inspección efectiva del servidor no puede garantizarse que reutilizar el entorno histórico preserve datos y servicios de otros proyectos; por ello no se ejecutó SQL.

Los resultados de docs/11 y artifacts/fase1 son históricos y no validan este bloque ni el estado actual del daemon. No se reutilizaron como pruebas aprobadas de esta sesión.

## Fuentes y comprobaciones ejecutadas

Se leyeron AGENTS.md, docs/16–21, las cinco migraciones pendientes y antecedentes de entorno docs/10–11. Se revisaron también la página /admin/rutas y su acción de carga, sin iniciar la aplicación ni modificar código Next.js.

Se inventariaron **74 archivos SQL locales: 69 predecesoras y cinco pendientes**, con versiones únicas. El orden pendiente es 20261106010000 → 20261106030000 → 20261106040000 → 20261106050000 → 20261106060000. No existe migración 020000; la documentación lo reconoce. La presencia de archivos no demuestra suficiencia de dependencias ni aplicación en la base. Manifiesto completo: `migraciones-sha256.json`.

Comparación textual de las tres funciones de creación de 010000 frente a sus últimas definiciones locales anteriores: cuerpos equivalentes tras omitir incorporación de régimen, comentarios y espacios. Para conversión se aisló además CREATE frente a CREATE OR REPLACE; el diff auxiliar está conservado. Esto no prueba idempotencia en ejecución. Evidencia: `revision-estatica.json` y `diferencia-conversion.txt`.

Observaciones de fuentes, **sin certificación de ejecución**:

- 010000 reserva venta definitiva inactiva y crea alias provisional; las tres vías insertan entrega_v1. 030000 define auditoría/versiones privadas y revoca acceso API; las tablas declaran RLS forzada.
- 040000 revoca DML directo en pedidos/items/preparación y agrega validaciones de fecha Santiago tras locks. Su cierre legacy conserva lógica de reajuste de aplicaciones; 050000 revoca EXECUTE de ese cierre y otras rutas implícitas. Debe verificarse la revocación efectiva, no basta con leerla.
- 050000 conserva importes financieros históricos y separa total_operativo_preparacion; requiere confirmación explícita y cantidades/importes autorizados. Sus reintentos se verifican contra el día habilitado antes del retorno; el contrato difiere deliberadamente del replay de cargas.
- 060000 declara selección persistida, exclusión motivada, cobertura al confirmar, reabrir antes de salir y salida conjunta. Usa lock EXCLUSIVE de pedidos, serializando escrituras incluso de otras fechas. Falta medir y probar su interacción con todas las RPC legacy.
- `proteger_pedido_cargado` consulta pg_attribute y resta columnas generadas de OLD/NEW antes de comparar. Las columnas fuente siguen comparándose. Permite estado/fecha_actualizacion, restringe retrocesos y protege campos fuente en lista y en_ruta. La reapertura libera primero el estado global. No se ha demostrado en PostgreSQL que la salida, entrega y cancelaciones interactúen correctamente con todos los triggers existentes.
- Carga recupera historial por clave/actor/solicitud antes de validar día y versión actuales; las operaciones nuevas revalidan clock_timestamp en America/Santiago al final. Falta probar esperas que crucen medianoche, atomicidad e idempotencia real.
- No se observaron reemplazos de vistas financieras en las cinco pendientes. Esto no certifica conservación de saldos/pagos: se necesitan catálogo y snapshots de datos sintéticos antes/después. El régimen contable al entregar continúa inactivo; las vistas históricas mantienen su contrato previo.
- /admin/rutas consume lectores y acciones participantes; su revisión fue estática. No hubo validación visual, HTTP, renderizado ni pruebas de paginación con volumen.

## Matriz de pruebas pendientes

**Todas las filas siguientes están NO EJECUTADAS**, no fallidas ni aprobadas:

| Área | Cobertura requerida al desbloquear |
|---|---|
| Aislamiento y cadena | Identificar daemon local, contenedores/volúmenes y ausencia de enlace remoto; crear entorno nuevo vacío con identidad y recursos propios. Aplicar las 69 predecesoras y verificar historial, firmas y dependencias antes de las cinco pendientes. No resetear el stack histórico. |
| Aplicación | Aplicar cinco pendientes en orden con parada ante error; comprobar sintaxis SQL y cuerpos PL/pgSQL, owners, search_path, constraints, columnas generadas, triggers y dependencias. |
| Tres vías | Checkout personal, conversión de posible pedido y creación administrativa comercial; régimen, snapshots, pendientes explícitos, reintentos exactos/históricos, payload distinto, actor diferente, rollback y dos sesiones concurrentes. |
| Preparación por fecha | Hoy, futuro, vencido, NULL e infinito; sesión en otra zona; inicio, confirmación, cierre y rutas legacy revocadas. |
| Productos | Sin registro, completo, cero, faltante, exceso, KG con tres decimales, enteros obligatorios, NaN/infinito, límites, importe manual obligatorio, precio original inmutable y total administrativo especial. |
| Cierre | Bloquear pendientes y pedido sin líneas; cerrar todo explícitamente, verificar totales/metadatos y rechazo de edición posterior; rollback ante fallo intermedio. |
| Selección | Cobertura completa, pedidos nuevos entre guardar/confirmar, UUID duplicado/ajeno, motivo vacío/largo, cancelados y desplazados, miembro omitido, asociación a otra jornada. |
| Pedidos listos | Certificación global separada del estado individual, incluidos con preparación cerrada, rechazo de legacy sin confirmaciones y conservación de excluidos. |
| Retroceso y salida | Reabrir con motivo antes de salir conservando cantidades/importes; volver a cerrar; salir todos incluidos atómicamente y conservar excluidos; bloquear edición y retroceso posterior. |
| Trigger | Salida con ambos alias generados, UPDATE sin cambios, cambios de campos fuente, fecha/cancelaciones antes y después de confirmar/salir, entrega legacy compatible y rechazo de bypass directo. |
| Reintentos | Misma clave/payload/actor, diferente actor/payload/versión, replay tras salir y tras medianoche; no duplicar historial ni estados; distinguir replay de preparación sujeto al día. |
| Concurrencia | Dos admins sobre mismo producto/pedido/carga; guardar/confirmar/salir/reabrir frente a creación, cancelación y cambio de fecha; observación de espera real, versión obsoleta, rollback de A y ausencia de deadlocks. |
| Tiempo | 23:59:59/00:00:00 Santiago con zona de sesión distinta; operación esperando locks al cruzar día; rechazo atómico sin efectos parciales; no confundir simular una expresión con probar reloj/locks reales. |
| ACL/RLS | anon, authenticated cliente, authenticated admin y service_role; RPC permitidas/retiradas, DML de tablas, helpers privados, lectura ajena y mutación/TRUNCATE del historial. |
| Finanzas | Fixtures no vacías de pagos/aplicaciones/ajustes; comparar datos, saldos, movimientos, definiciones/ACL de vistas antes/después de migrar y de preparar/cargar/salir; reconocimiento definitivo siempre NULL. |
| /admin/rutas | Contratos RPC y lector por fecha; navegación sin escrituras, listados por encima de max_rows, cancelados/excluidos, pedidos nuevos y estados visibles. Validación visual separada sin iniciar web en este encargo. |

Las pruebas secuenciales deberán usar BEGIN/ROLLBACK y usuarios/datos ficticios; las carreras requieren sesiones independientes y una base desechable propia. Si se detecta un error corregible, editar exclusivamente migraciones locales pendientes y repetir desde una base nueva limpia conservando logs del fallo y corrección. No se aplicó ni ejecutó una suite de este bloque, ni se creó aquí un runner SQL funcional.

## Errores, correcciones y alcance

Errores constatados: acceso denegado al daemon y CLI ausente. No hay fallo SQL de ejecución confirmado porque no hubo servidor accesible. No se corrigieron migraciones por conjetura. No se alteraron archivos de aplicación ni migraciones históricas o pendientes; únicamente se añadieron estos artefactos. Los cambios preexistentes del workspace se conservaron.

No se ejecutó SQL remoto ni se contactó el proyecto gxmkrerhuuzeeupjliap. No se modificaron datos reales, contenedores o servicios, no hubo commit, push, despliegue ni servidor web. La reanudación requiere acceso permitido a Docker local y una CLI local disponible; después deberá cumplirse la precondición de aislamiento antes de cualquier escritura.

**BLOQUEADO: validación SQL integral pendiente por prerrequisitos locales inaccesibles.**
