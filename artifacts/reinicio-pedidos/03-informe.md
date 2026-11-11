# Reinicio exclusivo de pedidos — Hidro Leufú

Proyecto indicado: **gxmkrerhuuzeeupjliap**. Revisión estática local integral del 11 de noviembre de 2026. No se contactó el proyecto ni se ejecutó SQL, tests, builds, ESLint, migraciones, CLI Supabase, commits, push o escrituras remotas. Únicamente se leyeron fuentes y se crearon estos archivos locales.

**Dictamen: no hay evidencia suficiente para entregar un borrado remoto listo para ejecutar.** Las fuentes contienen protecciones que rechazan DELETE incluso como postgres, y referencias comerciales que deben conservarse. Su presencia en el repositorio no demuestra que estén instaladas ni que existan filas bloqueantes en remoto. No se inventan cantidades, UUID, instalación de módulos ni ausencia de bloqueos.

Se prepararon el diagnóstico SELECT y una plantilla transaccional con DELETE exactos por manifiesto, cerrada por defecto y terminada en ROLLBACK. El trabajo autorizado en esta sesión es preparación estática; no se hizo ninguna eliminación.

## Entrega

1. `01-diagnostico.sql`: catálogo, todas las FK, triggers y cuerpos, funciones, reglas, políticas, vistas contables, dependencias de objetos, cantidades exactas, filas de aplicación y referencias UUID/JSON a pedidos e ítems. Los módulos opcionales se inspeccionan por catálogo, sin asumir su instalación. Sólo SELECT; `query_to_xml` ejecuta exclusivamente SELECT generados. No invoca funciones de negocio.
2. `02-eliminacion.sql`: manifiesto explícito por PK y fila completa esperada, justificación de exclusividad, contrato remoto revisado, locks, comprobaciones de FK/orden y referencias indirectas, DELETE individual, restricciones inmediatas y comparación exacta del resto de los datos. Incluye a todos los pedidos; no incluye ninguna identidad Auth como objetivo. No habilita CASCADE implícito ni SET NULL.
3. Este informe: alcance, bloqueos y mantenimiento propuesto.
4. `04-evidencia-estatica.md`: índice de declaraciones, FK, triggers, funciones, excepciones y referencias operativas de las fuentes locales.
5. `05-fuentes.json`: 103 fuentes SQL de migraciones y módulos manuales con SHA-256 y cantidad de líneas. Los antiguos scripts de limpieza se revisaron separadamente y se excluyeron del índice de contrato para no confundir instrucciones de borrado con esquema.
6. `06-referencias-aplicacion.txt`: 139 referencias de código/scripts a pedidos, ítems, rutas y contabilidad; son evidencia de consumidores, no prueba de contrato remoto.

No se modificaron los anteriores `supabase/manual/limpieza_controlada_*`: contienen un objetivo distinto que incluye eliminar usuarios. **No utilizarlos para esta solicitud.**

## Conservación obligatoria

Todos los usuarios Auth, identidades/sesiones y demás datos Auth; perfiles; todos los clientes y direcciones; productos, categorías, presentaciones y precios; proveedores; configuraciones logísticas, zonas y días; maestros de repartidores; invitaciones; conversaciones y mensajes; solicitudes WhatsApp/posibles pedidos originales; producción y sus compras/actividades/configuraciones; novedades; cualquier tabla o fila independiente. No se resetean secuencias.

La plantilla prohíbe borrar **todos los pagos y todos los ajustes**, aunque alguno pudiera provenir de pruebas: es la opción conservadora que evita inferir exclusividad contable sin evidencia. También conserva cupones, posibles pedidos, sus ítems e historiales, operaciones administrativas de clientes y correcciones de pagos. Una referencia de estos datos a un pedido objetivo es un bloqueo, no permiso para borrar el dato independiente ni desvincularlo.

Los vínculos `vinculos_items_posible_pedido` pueden ser exclusivamente del ítem oficial, pero eliminar sólo el vínculo no resuelve `posibles_pedidos.pedido_oficial_id`. La solicitud original se conserva y, si está convertida, su FK impide el borrado total bajo este procedimiento.

## Dependencias y bloqueos concretos de las fuentes

| Fuente local | Dependencia/protección concreta | Resultado bajo este alcance |
|---|---|---|
| `20260810041535_crear_nucleo_hidro_leufu.sql` | `items_pedido`, `historial_estados_pedido`, `aplicaciones_pago` referencian pedidos. Aplicaciones enlazan pagos y pedidos. | Eliminar primero filas dependientes por PK. Conservar pagos íntegros, incluido su saldo no aplicado. |
| `20260817100000_crear_base_preparacion_real_pedidos.sql` | Preparación tiene FK a pedido e ítem con `ON DELETE CASCADE`. | Incluir y borrar explícitamente cada preparación antes de ítem/pedido; no aprovechar la cascada. |
| `20261106030000_seguridad_auditoria_operativa.sql` | `versiones_pedido.pedido_id` e `historial_operativo.pedido_id/item_pedido_id` **sin FK**. `historial_operativo_inmutable` llama `impedir_mutacion_historial()`. | El historial debe clasificarse aunque no bloquee una FK. DELETE provoca `AUDITORIA_OPERATIVA_INMUTABLE`. |
| `20261106060000_carga_camioneta_salida.sql` | `carga_pedidos.pedido_id` RESTRICT; cargas son padres por fecha. `historial_cargas` relaciona fecha y JSON sin FK. | No borrar una jornada por el mero hecho de tener pedidos. `historial_cargas_inmutable` rechaza DELETE con la misma excepción. |
| `20261108130000_confirmar_entrega_real_todo_correcto.sql` | `entregas_definitivas.pedido_id` RESTRICT e `entregas_definitivas_inmutables`. | Una entrega existente bloquea borrar el pedido; el comprobante no puede eliminarse con las protecciones actuales. |
| `20261108140000_integrar_contabilidad_entrega_y_pagos.sql` | `cobros_entrega` y `pagos_entrega` referencian entregas; `pagos_entrega.pago_id` referencia un pago independiente. Triggers `cobros_entrega_inmutables`, `pagos_entrega_inmutables`; validación diferida mediante la función `exigir_cobro_entrega()`. | Evidencia contable inmutable; no borrar el pago para resolverla ni alterar/reactivar aplicaciones para evitar controles. |
| `20261105020000_crear_pedido_administrativo_transaccional.sql` | Creaciones administrativas FK al pedido y auditoría de precios FK al ítem. `proteger_creacion_pedido_administrativo` / `proteger_auditoria_precio_pedido_administrativo` llaman `proteger_registro_creacion_pedido_administrativo()`. | DELETE provoca `REGISTRO_ADMINISTRATIVO_INMUTABLE` (42501). |
| `20261108170000_corregir_venta_entregada_administrativo.sql` | Correcciones de venta FK a pedido, cliente y ajuste; `correcciones_venta_inmutables`; `proteger_ajuste_correccion`. | Corrección rechaza DELETE por auditoría inmutable; ajuste ligado rechaza modificación con `AJUSTE_CORRECCION_INMUTABLE`. Conservar ajuste y detenerse; no dejarlo sin evidencia. |
| `20261108200000_corregir_pagos_administrativo_auditado.sql` | Correcciones de pago dependen del pago/cliente y conservan `solicitud`, `anteriores`, `nuevos`, `resultado`, con snapshots de aplicaciones. | Conservar correcciones y pagos. UUID de pedido/aplicación en sus JSON bloquea por referencia indirecta aunque no haya FK. |
| `20261108180000_centralizar_escrituras_contables.sql` y `20261108190000_cerrar_dml_directo_pagos_authenticated.sql` | RPC contables centralizadas, auditoría operativa, DML directo restringido a roles API. | No usar RPC de cancelación/anulación para simular limpieza: cambian estados, aplicaciones y auditorías, y no eliminan pedidos. No cambiar permisos ni suplantar `auth.uid()`. |
| `20260829120000_crear_sistema_beneficios_fidelizacion.sql` | Stacks FK al pedido y cupón; cupón usado FK `pedido_usado_id` RESTRICT. CHECK exige referencia/fecha para estado usado. | Cupón usado conservado bloquea el pedido. No poner referencia NULL, reactivar ni borrar cupones. Stacks con `cupon_id` no son candidatos seguros por sí solos. |
| `20260829130000_crear_chat_cliente_admin.sql` | `mensajes_conversacion.pedido_id` RESTRICT; mensaje además pertenece a conversación/usuario. | Conservar comunicación comercial. Si referencia pedido, bloqueo de FK; no borrar conversación ni quitar referencia. |
| `20261022010000_crear_estructura_posibles_pedidos.sql`, `20261022012000_crear_rpcs_posibles_pedidos.sql`, `20261101010000_versiones_solicitudes_whatsapp.sql` | Cabecera `pedido_oficial_id` RESTRICT; vínculos a ítems; historiales/versiones y snapshots idempotentes. `proteger_historial_posible_pedido` rechaza UPDATE/DELETE. | Conservar solicitud independiente y sus versiones. Si se intentara borrar historial, `HISTORIAL_POSIBLE_PEDIDO_INMUTABLE`; la conversión conservada bloquea borrar pedido. |
| `20260907040910_crear_modelo_rutas_logisticas.sql` | Paradas referencian pedido y ruta con RESTRICT; rutas son padres, no hijos de pedidos. | Borrar sólo rutas demostrablemente exclusivas. Una ruta vacía no se presume histórica ni desechable. |
| Manual `terminar_ruta_fase2.sql` | `proteger_cierre_carga`, `proteger_pedido_ruta_cerrada`, `proteger_linea_ruta_cerrada`, `proteger_orden_ruta_cerrada`; triggers en cargas, selección, pedidos, ítems, preparación, rutas y paradas. | `RUTA_CERRADA` y guard de aislamiento READ COMMITTED. No eliminar primero selección/carga para ocultar cierre; no reabrir ni fabricar permiso de reprogramación. |
| Manual `repartidores_fase5.sql` | Asignaciones FK a ruta/maestro; `reparto_auditoria` sin FK contiene también cambios del maestro; trigger `reparto_auditoria_inmutable`. | Conservar maestro Auth/repartidor y auditoría del maestro. Sólo asignaciones/evidencia exclusivamente de pedidos se podrían justificar, pero auditoría inmutable bloquea DELETE. |
| Manual `rutas_multiples_fase2.sql` y complementos fase 3 | Rutas multi FK a ruta; pertenencias, autorizaciones, repartidores y eventos; `ruta_multi_eventos_inmutables`. `proteger_contratos_multi` impone `REQUIERE_RUTA_INDIVIDUAL` sobre tablas legacy. | No borrar primero modelo multi para esquivar barreras legacy. Eventos inmutables bloquean; capacidades privadas no son mecanismo de mantenimiento. |
| Producción, invitaciones, operación administrativa de clientes y otros módulos | Referencias Auth/clientes y JSON/resultados independientes; producción tiene sus propias protecciones. | Conservar completamente. No aplicar un cierre transitivo indiscriminado de FK como autorización de eliminación. |

Los nombres concretos de triggers, FK instaladas y filas afectadas deben obtenerse con el diagnóstico. No se afirma que estos bloqueos estén activos remotamente: faltan catálogo y datos reales. Los archivos manuales son opcionales; algunos parchean cuerpos de funciones existentes, por lo que las migraciones por sí solas no prueban el contrato final.

## Clasificación de filas y orden del manifiesto

Los resultados `filas_a_clasificar` y `vinculadas_o_bloqueantes` identifican filas concretas y UUID sin autorizar automáticamente su eliminación. Para cada fila registrar: PK, JSON completo esperado, pedido(s) de origen, consumidores ajenos, decisión conservar/eliminar/bloqueo y evidencia de exclusividad. La tabla temporal `borrar` expresa exactamente el conjunto que se eliminaría; el resumen final agrupa cantidades por tabla. No se generan UUID ni cantidades ficticias para completarla.

Hijos antes de padres según **las FK reales**: auditoría de precios/preparación/vínculos antes de ítems; aplicaciones, estados, stacks exclusivos, pertenencias/paradas/selecciones e historiales exclusivos antes de pedidos; comprobantes de pago/cobro antes de entrega; eventos/autorizaciones/repartidores/asignaciones antes de ruta multi/ruta/carga correspondiente. Estos órdenes son relaciones parciales, no autorización para superar los triggers. Si hay ciclos, referencias conservadas o inmutabilidad, no existe un orden de DELETE válido bajo el contrato actual.

Las rutas/cargas y auditorías por fecha o JSON requieren evidencia adicional: una coincidencia de fecha o un UUID no acredita exclusividad. Cargas/historiales pueden incluir pedidos de varias rutas; auditoría de reparto puede referirse al maestro. Filas sin relación demostrable quedan conservadas. Los originales de posibles pedidos se conservan incluso cuando dieron origen a un pedido oficial.

## Verificaciones incorporadas y límites

- Contrato de catálogo revisado idéntico entre diagnóstico y transacción; las tablas temporales quedan excluidas de esa huella. Datos objetivo idénticos a sus JSON esperados y PK exactas.
- Todos los pedidos incluidos. Allowlist excluye Auth, perfiles, clientes, direcciones, catálogo, proveedores, configuración, pagos, ajustes y otros independientes. Las tablas permitidas no autorizan por sí solas todas sus filas.
- FK entrantes completas y orden hijo/padre estricto: ni CASCADE ni SET NULL pueden afectar una fila conservada. Restricciones diferidas se fuerzan antes de la comprobación final.
- Búsqueda conservadora de UUID de PK objetivo en todas las filas conservadas, incluidos JSON/texto en otros esquemas. Detecta referencias sin FK y puede producir falsos positivos; no demuestra ausencia de referencias por fecha, enteros, UUID codificados, sistemas externos o datos fuera de PostgreSQL. Su revisión semántica es precondición explícita.
- Se bloquea ante cargas/rutas multi cerradas o capacidades operativas presentes. **Cualquier trigger DELETE no interno en una tabla objetivo bloquea antes de mutar**, incluso condicional o deshabilitado; es deliberadamente más conservador que simular su condición. El diagnóstico permite identificarlo exactamente. No retirar ese control como paso rutinario.
- Copia temporal y comparación exacta multiconjunto de todas las tablas persistentes de usuario: fuera de objetivos nada puede cambiar. Incluye Auth completo sin exportarlo; exige lectura total y espacio temporal. Los locks son amplios e interrumpen tráfico. Tablas remotas/particionadas provocan aborto y requieren procedimiento específico; no se intenta improvisar soporte.
- Cero pedidos tras el DELETE y conservación exacta del resto. La búsqueda previa de referencias a los UUID objetivo y la comparación posterior evitan dejar nuevas referencias conservadas de ese tipo. No se certifica que el entorno carezca de huérfanos preexistentes ni que estén cubiertos consumidores externos.
- Sin TRUNCATE, sin desactivar triggers/restricciones, sin cambiar funciones productivas, RLS, roles o secuencias. Sin RPC de negocio. No se incluye eliminación ni anulación de pagos/ajustes.

La huella comprueba metadatos, no la identidad del proyecto ni el estado completo de datos. Los SELECT independientes requieren una ventana estable. Deben detenerse también jobs y DDL: los locks de tablas no bastan para impedir cambios concurrentes de funciones o nuevos objetos. Funciones de vista/reglas/triggers pueden tener efectos externos no reversibles: revisar sus cuerpos antes de ejecutar incluso un ensayo ROLLBACK. No se ejecutó ninguna validación de este SQL por prohibición expresa.

Eliminar ventas y aplicaciones cambia la cuenta corriente **aunque pagos y ajustes permanezcan idénticos**: aumenta el importe disponible de pagos antes aplicados y desaparece deuda de ventas. La cuenta puede conservar crédito o deuda de ajustes independientes; no debe forzarse a cero. Las vistas de saldo se exportan para cuantificar ese resultado, no como filas que deban eliminarse.

## Mantenimiento acotado propuesto — no implementado ni ejecutado

Si existen filas inmutables, la eliminación total y la prohibición de alterar protecciones son incompatibles en el contrato local actual. Ser postgres, cambiar el orden, usar una RPC o envolver en transacción no elimina esa incompatibilidad.

La solución que respeta todas las restricciones es preparar un entorno aislado para pruebas de rutas, con el mismo contrato y los datos independientes necesarios, sin importar pedidos ni su evidencia operativa; mantener intacto el proyecto indicado. Esto permite reiniciar pruebas, pero **no equivale a borrar históricos en ese proyecto**. No se crea ni copia ningún entorno en esta entrega.

Si el requisito continúa siendo eliminar dentro de `gxmkrerhuuzeeupjliap`, se necesita un procedimiento separado de mantenimiento, limitado a una ventana, un manifiesto cerrado de UUID/filas y un respaldo recuperable. Su diseño tendría que incorporar una capacidad privada excepcional, inaccesible a API, ligada a transacción/rol/manifiesto, que los guards reconozcan exclusivamente para esas filas, manteniendo auditoría de mantenimiento y restauración exacta del contrato al terminar. Las referencias mixtas conservadas necesitan una decisión de dominio específica; esa capacidad por sí sola no permite perder pagos, ajustes, solicitudes o cupones. **Este diseño requiere cambiar temporalmente funciones productivas, acción prohibida en esta solicitud: se propone únicamente, sin SQL de bypass ni implementación.** No consiste en desactivar triggers ni restricciones ni debilitar permanentemente protecciones.

Con las restricciones actuales, si el diagnóstico confirma esos bloqueos, debe detenerse antes del DELETE. No presentar la plantilla vacía como una limpieza ejecutable ni cambiar ROLLBACK por COMMIT para intentar resolverlos.

## Comandos para copiar/ver archivos

Desde `/home/unk0/joaco.ro`:

```bash
cat artifacts/reinicio-pedidos/01-diagnostico.sql
cat artifacts/reinicio-pedidos/02-eliminacion.sql
cat artifacts/reinicio-pedidos/03-informe.md
cat artifacts/reinicio-pedidos/04-evidencia-estatica.md
cat artifacts/reinicio-pedidos/05-fuentes.json
cat artifacts/reinicio-pedidos/06-referencias-aplicacion.txt
```

Estos comandos imprimen archivos locales; no ejecutan su SQL.
