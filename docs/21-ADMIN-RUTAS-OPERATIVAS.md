# /admin/rutas · Preparación y reparto

Implementación sobre la infraestructura local de las microintegraciones 1, 3, 4, 5 y 6. Se revisaron AGENTS.md, la guía local Next.js de page/searchParams, las pantallas de pedidos y jornadas, los componentes de preparación, las acciones y las migraciones del rango 20261106010000–20261106060000. No existe archivo 20261106020000 en las migraciones locales.

## Archivos intervenidos en esta tarea

- src/app/(admin)/admin/rutas/page.tsx: reemplaza el placeholder por el centro operativo.
- src/lib/admin/pedidos.ts: exporta el cálculo existente de hoy local y agrega conteo de pedidos por fecha acotado a los siete días.
- src/components/admin/delivery-order-card.tsx: modo operativo con progreso explícito por pedido; mantiene el comportamiento anterior por defecto.
- src/components/admin/preparation-item-control.tsx: distingue cantidades solicitadas y preparadas e importes originales y provisionales, incluso cuando coinciden.
- src/components/admin/jornada-carga-control.tsx: deshabilita selección y guardado fuera de fecha; admite identidad comercial para Rutas.
- src/app/(admin)/admin/pedidos/carga-actions.ts: valida hoy en el servidor antes de guardar selección. Confirmar, salir y reabrir conservan validación transaccional e idempotencia de la RPC existente.
- src/app/(admin)/admin/pedidos/actions.ts: invalida también /admin/rutas después de mutaciones existentes.
- docs/21-ADMIN-RUTAS-OPERATIVAS.md: este informe.

Se conservaron los cambios anteriores del workspace, incluidos archivos sin seguimiento. En la implementación inicial no se modificaron migraciones; la corrección de auditoría descrita al final modifica únicamente la pendiente 20261106060000.

## Selector y lectura

Hoy se calcula en America/Santiago. El selector presenta hoy y los seis días siguientes, conteo y resaltado de días con pedidos, y fecha seleccionada accesible. En móvil permite desplazamiento horizontal. El calendario nativo y el botón Consultar permiten cualquier fecha histórica o futura. La selección vive en ?fecha=AAAA-MM-DD, compatible con enlaces y navegación atrás/adelante. Fechas inexistentes o parámetros repetidos producen 404. Sumar días civiles en UTC evita desplazamientos por horario de verano.

El detalle reutiliza obtenerDetalleEntregaAdmin: filtra por fecha_entrega efectiva y conserva todos los estados no cancelados, incluidos recibidos, confirmados, preparando, listo_despacho y en_reparto. La identidad muestra cliente, ubicación comercial y código. Se conservan las páginas anteriores. Los recibidos muestran su situación pendiente y enlace al detalle existente para aceptación.

Abrir, navegar y desplegar productos sólo ejecuta SELECT y las RPC lectoras leer_preparacion_explicita y leer_carga_jornada. No se llama ninguna acción desde montaje o apertura de acordeones. No se crean jornadas ni cargas por lectura.

## Componentes y RPC reutilizados

DeliveryOrderCard, OrderIdentity, PreparationItemControl, FinalizePreparationAction, OrderOperationalAction, OrderStatusBadge, PreparationStatusBadge, DeliveryProductsSummary y JornadaCargaControl. No se replican fórmulas de preparación ni reglas de importe manual.

La edición usa confirmar_producto_preparado, el cierre cerrar_preparacion_explicita y el inicio marcar_pedido_preparando_administrativo a través de sus acciones existentes. Se respetan versión y clave de idempotencia de los flujos participantes. El total provisional agregado suma el importe operativo devuelto por el lector existente; sólo usa totalFinal/total como respaldo.

La carga usa operar_carga_jornada: selección completa explícita con exclusiones justificadas, confirmación física mediante Pedidos listos, salida separada mediante Salir a ruta y reapertura motivada. No se preseleccionan pedidos nuevos ni se agregan silenciosamente a la carga persistida. El estado global permanece separado de los estados individuales.

## Validación y riesgos pendientes

Revisión de código únicamente. No se ejecutaron tests, lint, tsc, builds, Docker, servidores, SQL local/remoto, commits ni push. No se afirma validación de ejecución o visual.

- Las migraciones deben estar disponibles en el entorno de ejecución; no se comprobó ni modificó la base remota.
- Pendiente validar visualmente móvil/escritorio, roles, concurrencia entre pestañas, reintentos, cruce de medianoche y reapertura con cantidades conservadas.
- Corregido en la auditoría posterior: la RPC pendiente valida también guardar en la fecha local efectiva y recupera reintentos antes del control temporal. La interfaz conserva el bloqueo temporal; la acción delega en la RPC para no bloquear recuperaciones legítimas.
- Las lecturas de detalle y carga no comparten snapshot transaccional. Las RPC revalidan el estado al mutar.
- Los lectores administrativos se paginan y los filtros IN se dividen en lotes. Las RPC lectoras devuelven agregados JSON completos. Sigue pendiente medir el coste de una RPC de metadatos por pedido y del historial completo.
- La disponibilidad temporal visible corresponde al momento de renderizado. Las RPC de preparación y salida validan de nuevo el reloj de PostgreSQL.
- Pedidos asociados a cargas antiguas o cambiados desde otros flujos pueden requerir resolución explícita; no se implementó reprogramación ni múltiples camionetas/salidas.
- Se excluyen ajustes del repartidor, confirmación de entrega, cobros y reconocimiento contable.


## Corrección de auditoría integral · 2026-11-06

Estado: cambios preparados para validación SQL local; sin validación de ejecución y sin autorización implícita para aplicar SQL remoto.

Se revisaron AGENTS.md, este documento, las cinco migraciones pendientes 20261106010000, 20261106030000, 20261106040000, 20261106050000 y 20261106060000, las acciones, lectores, componentes consumidores y RPC históricas relacionadas. Se consultaron las guías locales de Next.js para Link, useRouter y revalidatePath. Se conservaron los cambios previos del workspace. De las migraciones, sólo se editó 20261106060000; ninguna histórica aplicada se modificó.

### Correcciones por prioridad

1. **Trigger y columnas generadas.** `proteger_pedido_cargado` obtiene de `pg_attribute` las columnas generadas de la tabla y las resta de ambos JSON antes de comparar. En un trigger BEFORE, NEW aún no contiene valores generados fiables. Se siguen comparando todas las columnas fuente: totales, importes de preparación, fecha, identidad, dirección, snapshots y demás datos comerciales y operativos. Sólo se permite variar estado y fecha_actualizacion, además de omitir los derivados. La barrera de campos también se mantiene en ruta; las restricciones de estados impiden retrocesos. La salida legítima lista → en_reparto deja de fallar por los alias importe_operativo e importe_operativo_legacy. La reapertura cambia primero la carga a preparación y conserva las cantidades/importes existentes.

2. **Selección por identidad estable.** El componente mantiene borradores por UUID y deriva la selección desde los pedidos actuales. Reordenar no traslada casillas ni motivos; pedidos nuevos aparecen sin decisión persistida y sin inclusión automática; IDs ausentes no se envían. Cambiar fecha o versión remonta el control y descarta borradores de una revisión anterior. El payload se ordena por UUID para que reordenamientos visuales no cambien su firma de reintento. Cancelados pueden desmarcarse y excluirse con motivo, pero no volver a incluirse desde la casilla. Confirmar queda deshabilitado con decisiones pendientes o borradores sin guardar.

3. **Fecha efectiva e idempotencia.** La RPC autoriza y valida el comando, recupera el historial por fecha/clave y compara actor y solicitud completa antes de validar el reloj o la versión actual. Un reintento ya confirmado puede recuperar su resultado original al día siguiente. Una operación nueva exige hoy en America/Santiago usando clock_timestamp; se revalida también al final de guardar, después de sus bloqueos y escrituras. Una excepción revierte toda la transacción. La acción de servidor elimina el rechazo temporal anticipado que impedía recuperar reintentos; la RPC es la autoridad temporal para cualquier consumidor.

4. **Cancelaciones y asociaciones.** El lector conserva todos los pedidos de la fecha y todos los asociados, incluso cancelados, entregados o desplazados de fecha. Guardar admite esos miembros como exclusiones justificadas; sólo los estados operativos elegibles de la fecha pueden incluirse. No permite omitir miembros persistidos ni excluir sin motivo (máximo 2000 caracteres). No se borran asociaciones ni historial: cada cambio conserva snapshot anterior, solicitud, actor y resultado. Una asociación a otra carga sigue rechazándose explícitamente; no se implementó traslado de cargas ni reprogramación.

5. **Cobertura explícita al confirmar.** Antes del cierre se comprueba que cada pedido existente con fecha_entrega de la jornada tenga asociación persistida de inclusión/exclusión. Incluye cancelados y terminales, que sólo admiten exclusión. Si aparece un pedido entre guardar y confirmar, se devuelve DECISIONES_PENDIENTES; hay que actualizar, revisar y guardar su decisión. Los pedidos posteriores a la confirmación no se incorporan: salir recorre únicamente los incluidos persistidos. Reabrir y confirmar de nuevo vuelve a exigir cobertura de los pedidos que existan entonces.

6. **Lecturas completas.** `src/lib/admin/pedidos.ts` pagina listados administrativos, próximas entregas, detalle de jornada, líneas, preparación, ubicaciones snapshot, auditoría de precios y conteos del selector. Cada consulta tiene desempate único; cada página avanza por el número real recibido y termina con una página vacía, tolerando max_rows menor que el tamaño solicitado. Los filtros IN se dividen en lotes de 100 IDs y cada lote se pagina por separado. El detalle administrativo lee las líneas aparte para evitar el truncamiento de relaciones embebidas. El conteo exacto de recibidos ya usaba head/count exact y se conserva. Los lectores SQL de carga y preparación usan agregados JSON escalares completos, por lo que el límite de filas de PostgREST no recorta los arrays internos.

7. **Estado visible al cliente.** `CustomerOrderStatusBadge` y su función compartida de etiquetas muestran «En ruta» para en_reparto. El cambio cubre listado, detalle e historial de la cuenta que reutilizan ese mapa. El valor persistido del enum permanece en_reparto.

### Archivos modificados por esta corrección

- `supabase/migrations/20261106060000_carga_camioneta_salida.sql`: trigger, cobertura, cancelaciones, reloj, bloqueos y owner explícito del trigger.
- `src/components/admin/jornada-carga-control.tsx`: borradores por ID, reconciliación, versión, payload estable y bloqueo por decisiones pendientes.
- `src/app/(admin)/admin/pedidos/carga-actions.ts`: autoridad temporal en RPC, recuperación idempotente y mensajes de decisiones/exclusiones.
- `src/lib/admin/pedidos.ts`: paginación, lotes y lectura separada de líneas del detalle anterior.
- `src/components/account/customer-order-status-badge.tsx`: etiqueta En ruta.
- `docs/21-ADMIN-RUTAS-OPERATIVAS.md`: actualización del informe y riesgos.

### Compatibilidad, permisos y concurrencia

Las firmas y retornos públicos de las RPC permanecen iguales. Se conservan SECURITY DEFINER, search_path pg_catalog, comprobación de sesión/admin, ACL restrictivas y RLS de las tablas privadas. El trigger se asigna explícitamente a postgres y no se concede EXECUTE público. Se mantienen los retiros de RPC legacy de preparación y salida, ya previstos por las migraciones 050000/060000, y las páginas anteriores siguen usando sus lectores y acciones participantes. La RPC histórica de marcar entregado cambia sólo el estado y sigue siendo compatible con la barrera; no se añadió lógica de entrega, pagos ni reconocimiento contable.

Para impedir pedidos fantasma durante la comprobación de cobertura, operar_carga_jornada toma primero un bloqueo EXCLUSIVE de public.pedidos, luego el advisory de jornada, la carga y las filas en orden determinista. EXCLUSIVE espera también los SELECT FOR UPDATE/SHARE legacy, evitando adquirir un bloqueo de tabla que después impida al dueño de una fila terminar su UPDATE. Los SELECT ordinarios siguen permitidos. Esto estabiliza INSERT, cambios de fecha y cancelaciones durante el cierre sin exigir que todas las RPC históricas adopten un advisory nuevo. La versión de carga se comprueba bajo bloqueo, las versiones operativas de cada pedido se leen bajo su lock y todo el comando se audita en una única transacción.

### Riesgos restantes y validación local pendiente

- El bloqueo EXCLUSIVE serializa temporalmente todas las escrituras de pedidos, incluso de otras fechas. Debe medirse su espera/duración con datos representativos y con las RPC legacy en sesiones concurrentes antes de desplegar. Es una decisión conservadora de integridad; no se afirma rendimiento validado.
- Los lectores paginados de interfaz no comparten snapshot y pueden reflejar cambios entre páginas o entre pedidos, productos y metadatos. El orden estable elimina ambigüedad y el límite fijo del API, pero no convierte varias peticiones en una transacción. Las mutaciones revalidan el universo y los estados en SQL; la vista puede requerir actualización.
- El JSON completo de historial/productos y la RPC de metadatos por pedido pueden consumir tiempo y memoria con jornadas grandes. No hay recorte silencioso; podrían alcanzarse límites de respuesta o timeout, que deben tratarse como errores.
- Una asociación de otra carga o una jornada vencida sigue necesitando un futuro flujo específico de resolución/reprogramación. No se transfiere ni borra historia para sortear esas barreras.
- Validar localmente la cadena de migraciones y dependencias en orden, transición lista → en_reparto con ambas columnas generadas, rechazo de cambios en campos fuente, reapertura, exclusiones de cancelados, cobertura con pedidos nuevos, versiones obsoletas, doble pestaña, misma clave con distinto actor/payload, recuperación de reintento tras medianoche y rollback al cruzar el día durante una espera.
- Verificar roles anon/authenticated/service_role, permisos de las RPC retiradas, páginas de pedidos/jornadas anteriores, reordenamiento y llegada de pedidos sin cambiar versión, conteos y líneas por encima del max_rows configurado, y etiqueta de cliente en listado/detalle/historial.

Sólo se revisaron fuentes y diferencias. No se ejecutaron tests, lint, tsc, builds, Docker, servidores, SQL local/remoto, commits ni push. El conjunto está listo para iniciar validación SQL local; no se declara validado ni listo para producción.
