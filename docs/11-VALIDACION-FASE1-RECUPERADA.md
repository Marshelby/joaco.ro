# Validación real recuperada — Fase 1 Hidro Leufú

**Veredicto: APROBADO PARA REVISIÓN DE DESPLIEGUE**, exclusivamente para la Fase 1 SQL validada. No autoriza ni ejecuta un despliegue. Las pruebas críticas descritas a continuación fueron ejecutadas contra PostgreSQL/Supabase local aislado.

## 1. Estado del entorno y recuperación

La inspección de esta reanudación encontró Docker Engine 29.9.2 funcionando fuera del sandbox. Dentro del sandbox el socket devuelve `permission denied`; se utilizó el acceso escalado autorizado, sin cambiar permisos, grupos ni sudoers.

El stack `hidro-validacion-20261022` ya estaba iniciado: 11 contenedores activos y Edge Runtime detenido con salida 255. PostgreSQL estaba saludable y conservaba datos en el volumen Docker `supabase_db_hidro-validacion-20261022`. No se reinició PostgreSQL ni se recreó la base. Se reinició únicamente Edge Runtime; la comprobación final muestra los 12 contenedores activos. Los servicios que exponen healthcheck aparecen saludables; REST y Edge Runtime aparecen activos sin healthcheck equivalente.

Motor verificado: PostgreSQL 17.11; `plpgsql.check_asserts=on`. Puertos locales observados: API 55421, PostgreSQL 55422, Studio 55423, correo de pruebas 55424 y Analytics 55427. Docker publica estos puertos en todas las interfaces; no se cambiaron sus bindings en esta tarea.

El antiguo directorio `/tmp/hidro-leufu-aislado-f5f94pg4` y las herramientas `/tmp/hidro-leufu-tools` no estaban disponibles. El directorio `/tmp/hidro-validacion-20261022` conservaba solamente una estructura de carpetas, sin los archivos originales de configuración/migraciones. **El entorno de base de datos sí sobrevivió gracias al volumen Docker.** No debe hacerse `db reset`, eliminar el volumen ni repetir `start` desde el repositorio para recuperar estos archivos. Los runners incorporados usan exclusivamente el nombre fijo del contenedor aislado y no aceptan una URL remota.

El documento 10 refleja una sesión anterior bloqueada y queda como antecedente histórico; no describe el estado actual.

## 2. Migraciones realmente ejecutadas o recuperadas

Se encontraron **61 migraciones registradas** en `auditoria_local.migraciones`, con nombre y SHA-256. La tabla convencional `supabase_migrations.schema_migrations` no existe en esta base: su ausencia no significaba que faltaran las migraciones.

Los 61 nombres y hashes registrados coinciden exactamente con los 61 archivos del repositorio. La lista completa y verificable está en `artifacts/fase1/migraciones.json`. Comprende las 57 migraciones anteriores y las cuatro de Fase 1:

- `20261022010000_crear_estructura_posibles_pedidos.sql`.
- `20261022011000_corregir_auditoria_precio_posible_pedido.sql`.
- `20261022012000_crear_rpcs_posibles_pedidos.sql`.
- `20261022013000_habilitar_corte_entrega_mismo_dia.sql`.

**Migraciones aplicadas de nuevo durante esta reanudación: 0.** Se conservaron las 61 ya registradas. Los stdout originales de aplicación y sus tiempos no sobrevivieron en `/tmp`; la evidencia recuperada es el registro persistente con hashes y el esquema operativo probado. No se atribuye una ejecución nueva a la simple comparación de hashes.

No había administradores fixture al comenzar. Tampoco se recuperaron logs de pruebas funcionales anteriores. Por tanto, los resultados funcionales de este informe corresponden a ejecuciones reales de esta reanudación, sin asumir resultados anteriores.

## 3. Pruebas ejecutadas

Las suites usan datos propios y administradores sintéticos. Las pruebas secuenciales, ampliadas y de roles ejecutan BEGIN/ROLLBACK. Las carreras necesitan fixtures confirmadas y conservan sus resultados en esta base desechable para inspección. No se copiaron usuarios ni clientes de producción.

| Prueba | Resultado y evidencia |
|---|---|
| Recuperación y contraste de 61 migraciones | PASÓ: nombres y hashes idénticos; `migraciones.json` |
| Registro por service_role sin cuenta de visitante | PASÓ: respuesta comercial sin campos privados; `secuenciales.log` |
| Reintento idéntico y conservación de respuesta original | PASÓ, incluso tras cambiar precios de catálogo |
| Reintento con contenido o secreto diferente | PASÓ: rechazo esperado `REINTENTO_INVALIDO` |
| Fecha fuera de opciones, producto inactivo y presentación inexistente | PASÓ: errores esperados sin registro válido adicional |
| Fracciones, formatos cerrados, cantidad extrema y presentación duplicada | PASÓ: `secuenciales.log` y `ampliadas.log` |
| Edición administrativa e idempotencia de operación | PASÓ: una versión adicional, replay idéntico y rechazo de clave con parámetros distintos |
| Conservación de precios históricos al editar y convertir | PASÓ: original 1190; autorización efectiva neto 950/venta 1150; cantidad 2 y línea oficial 2300 |
| Captura de precio en línea nueva, retiro y reactivación | PASÓ: nueva línea a 3570; reactivación conserva original 1190; no se permite recotizar reinserción |
| Dos autorizaciones en una transacción y auditoría diferida | PASÓ: dos eventos y constraints forzados |
| Mutación de snapshot y precio sin evento de auditoría | PASÓ: rechazo esperado; `ampliadas.log` |
| Asociación de cliente comercial sin crear cuenta de acceso | PASÓ: ficha sintética asociada; usuario_id permanece nulo |
| Conversión con fecha vencida, formato cambiado, dirección/zona inactiva o método inválido | PASÓ: rechazos esperados |
| Conversión válida y repetición con otra clave | PASÓ: una venta, un vínculo por línea y versión esperada |
| Fallo inyectado al insertar líneas oficiales | PASÓ: rollback de cabecera, conversión y venta; no quedan efectos parciales |
| Ausencia de cargos antes de convertir | PASÓ: sin movimientos incluso después de asociar el cliente |
| Contabilidad después de convertir | PASÓ: suma de movimientos del cliente igual al total del pedido oficial; sin pago anticipado |
| Pedidos, pagos, aplicaciones, ajustes y saldos preexistentes | PASÓ: comparación antes/después; se añadieron pago, aplicación y ajuste sintéticos no vacíos antes de la ejecución final |
| RLS de las cuatro tablas para usuario sin administración | PASÓ: cero filas visibles |
| Lectura administrativa y ausencia de lectura anónima | PASÓ |
| INSERT/UPDATE/DELETE directos en las cuatro tablas | PASÓ: denegados para anon, authenticated (administrador) y service_role |
| Helpers privados | PASÓ: acceso denegado desde roles de aplicación |
| Cinco RPC administrativas como anon, usuario ordinario y service_role | PASÓ: denegadas; `roles.log` |
| RPC de registro como anon y authenticated | PASÓ: denegada; `roles.log` |
| Calendario lunes, martes y viernes | PASÓ: siete días comprobados; solo esos tres disponibles antes del corte |
| Corte exacto 07:59/08:00 America/Santiago | PASÓ: instantes explícitos convertidos con esa zona, corte exclusivo |
| Firma administrativa nueva y antigua | PASÓ: acepta anticipación 0 y 2; la firma antigua conserva 0 |
| Doble conversión simultánea | PASÓ: espera real y una sola venta |
| Conversión simultánea con rollback de A | PASÓ: B completa una sola venta |
| Edición contra edición | PASÓ: B rechazada por versión desactualizada |
| Edición contra conversión | PASÓ: conversión rechazada por versión desactualizada |
| Descarte contra conversión | PASÓ: conversión rechazada por estado cerrado |
| Autorización de precio contra edición | PASÓ: edición rechazada por versión desactualizada |
| Doble registro simultáneo con la misma clave | PASÓ: una cabecera y un evento de registro |
| Corte real mientras conversión espera bloqueo de catálogo | PASÓ: fecha válida al comenzar y rechazada al obtener el lock después del corte |
| Sesiones de prueba, transacciones abiertas y preparadas al terminar | PASÓ: ninguna pendiente |
| Frontend, endpoint HTTP y despliegue remoto | NO EJECUTADO: fuera del alcance autorizado |

Las seis carreras principales usan dos conexiones PostgreSQL independientes, dos administradores sintéticos y observación de `PgSleep` mientras A conserva sus locks. Las esperas medidas están en `concurrencia.json`. Los códigos de salida 3 en B de cuatro carreras son rechazos esperados que el runner verifica, no fallos de validación.

El corte exacto de las 08:00 se probó con instantes explícitos. La carrera de corte usa temporalmente un horario próximo al reloj real para cruzarlo durante la espera, con aserción previa de disponibilidad; no simula haber esperado hasta las 08:00 reales. Su calendario se restaura en un bloque `finally`. Evidencia: `adicionales.json`, `corte-tras-lock-A.log`, `corte-tras-lock-B.log` y su verificación.

## 4. Errores encontrados y correcciones

1. El informe previo afirmaba que Docker estaba bloqueado y no había migraciones aplicadas. La inspección real encontró el stack y la auditoría local; se corrigió la interpretación y se evitó reaplicar las 61 migraciones.
2. Edge Runtime seguía detenido tras el reinicio. Se inició solamente ese contenedor. No se necesitó reiniciar los demás servicios.
3. Una aserción nueva del test de rollback usó `pedido_id` y estado `abierto`, que no corresponden a la cabecera de intención. Se corrigió a `pedido_oficial_id` y `en_gestion` y la suite volvió a pasar.
4. La primera versión estricta de la precondición temporal llamó al helper privado `fecha_entrega_disponible` después de cambiar al rol authenticated. El permiso fue correctamente denegado. Se movió únicamente la precondición al contexto postgres y se mantuvo la conversión bajo el rol administrativo. La repetición pasó con espera real y rechazo temporal esperado.

**No se encontraron fallos funcionales de las migraciones en las pruebas ejecutadas. No se modificó ninguna migración durante esta reanudación.** Las correcciones de CASE, auditoría y anticipación cero descritas en documentos anteriores ya existían en los archivos recuperados; no son correcciones nuevas de esta sesión.

## 5. Archivos y datos modificados

- `supabase/tests/posibles_pedidos.sql`: cobertura ampliada, datos sintéticos y aserciones contables/ACL/calendario/rollback.
- `supabase/tests/posibles_pedidos_ampliados.sql`: líneas nuevas, retiro/reactivación, cierre, inmutabilidad, auditoría y límites.
- `supabase/tests/posibles_pedidos_roles.sql`: matriz de acceso a RPCs y RLS con usuario ordinario sintético.
- `scripts/validar-fase1-local.py`: recuperación de hashes, ejecución secuencial y seis carreras; admite `--solo-secuenciales`.
- `scripts/validar-fase1-adicional.py`: doble registro y carrera temporal con restauración del calendario.
- `docs/10-ENTORNO-PRUEBAS-LOCAL.md`: aviso de estado histórico y enlace a este informe.
- Este informe y `artifacts/fase1/`: logs, manifiesto de migraciones y hashes de fuentes.

La base aislada conserva dos administradores, fixtures de carreras, dos pedidos oficiales sintéticos, un pago, una aplicación de pago y un ajuste. El usuario ordinario del test de roles se revierte. Las secuencias pueden avanzar aunque las suites hagan rollback. El calendario local queda como calendario de pruebas: todos los días activos, anticipación cero y corte 23:59:59. No es una configuración comercial recomendada ni una modificación remota.

`next-env.d.ts` **ya estaba modificado al recuperar la sesión** y no se tocó. Su SHA-256 al inicio y al final sigue siendo `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`. Los demás archivos sin seguimiento que aparecían al inicio son trabajo recuperado, no cambios nuevos atribuibles a esta validación. No se modificó frontend, no se hicieron commits ni push.

## 6. Riesgos y límites pendientes

- La revisión de despliegue debe evaluar el entorno remoto y su historial mediante un procedimiento separado; esta aprobación local no certifica el estado actual de producción ni autoriza migraciones remotas.
- La configuración original en `/tmp` no sobrevivió. Conservar el volumen y estos artefactos; reconstruir una configuración aislada antes de gestionar nuevamente el stack con Supabase CLI. No usar la configuración enlazada del repositorio.
- Los puertos publicados en todas las interfaces requieren tener presente el alcance de red del equipo. No se cambiaron firewall ni permisos del sistema.
- El frontend y el futuro endpoint no se implementaron ni probaron. Siguen pendientes CAPTCHA, límites y controles del endpoint descritos en documento 09. La UI actual no incorpora el selector/textos de anticipación cero; conservar esa restricción en una revisión de despliegue que incluya UI.
- Las pruebas de concurrencia son carreras controladas, no pruebas de carga prolongada. No se probaron fallos de red HTTP ni despliegue.
- Las fixtures y servicios quedan disponibles deliberadamente para inspección; no hay procesos de test en ejecución ni tareas SQL pendientes.

## 7. Producción

**Producción `gxmkrerhuuzeeupjliap` permanece intacta por las acciones de esta sesión.** No se abrió conexión SQL remota, no se usó MCP de Supabase, no se ejecutaron `db push`, migraciones remotas, login/link, escrituras remotas, commits ni push. Todas las escrituras de base de datos se hicieron mediante `docker exec` al contenedor fijo `supabase_db_hidro-validacion-20261022`. Esto confirma el alcance de nuestras acciones, sin afirmar una auditoría de cambios que terceros pudieran haber hecho en producción.
