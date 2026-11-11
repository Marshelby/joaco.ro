# Fase 4 · Informe único de implementación y revisión estática

Implementación local de Reprogramar y Cancelar en Pedidos → No entregados, también accesibles desde el detalle de un pedido con entrega fallida. No está instalada en Supabase: falta ejecutar manualmente `supabase/manual/no_entregados_fase4.sql`, después de las Fases 2 y 3 que el usuario informó instaladas con Success.

## Contrato de reprogramación

Se revisó el cuerpo completo del SQL local de Fase 2 y sus dependencias. La RPC existente se reutiliza sin sustituirla:

`public.reprogramar_no_entregado_administrativo(p_pedido_id uuid, p_version_esperada bigint, p_clave uuid, p_fecha date, p_motivo text) → jsonb`.

Respuesta inicial y reintento: `{reintento, version, resultado: {pedido_id, fecha, estado: "listo_despacho", incluido: false}}`. La acción verifica esa respuesta. La fecha debe ser posterior a la jornada del intento original y no anterior al día actual de Santiago; el destino debe estar en preparación. Requiere preparación finalizada, carga de origen cerrada, fallo auditado y correspondencia exacta con el snapshot de cierre. No admite venta definitiva. El motivo es obligatorio, máximo 2000 caracteres.

No se consultó el catálogo remoto, conforme a la prohibición. Para comprobar el contrato realmente instalado antes de habilitarlo, el nuevo SQL contiene una precondición transaccional sobre `pg_proc`: firma, nombres, retorno JSONB, propietario postgres, SECURITY DEFINER y huella del cuerpo revisado normalizando exclusivamente CRLF a LF. Comprueba además los cuerpos y metadatos de ambas lecturas de Fase 3 y de las barreras privadas utilizadas, sus permisos efectivos y la configuración de los dos triggers de pedidos. Si difieren, aborta la instalación completa, sin modificar la RPC previa. La interfaz requiere la nueva lectura de Fase 4 para preparar una operación, por lo que no conecta la mutación antes de esta instalación.

## Cancelación

Nueva RPC `public.cancelar_no_entregado_administrativo(uuid,bigint,uuid,text,text) → jsonb`, con motivo y tratamiento administrativo de pagos/créditos obligatorios, máximo 2000 caracteres cada uno. Exige sesión y administrador dentro de la RPC y de las Server Actions; ejecución concedida solo a authenticated, con comprobación de rol de negocio. Los auxiliares siguen privados.

Reutiliza `iniciar_operacion` y `completar_operacion`: misma clave, actor, payload y versión recuperan el resultado original; una clave reutilizada con otros datos falla. El reintento se resuelve antes de validar el estado vigente. La versión se obtiene como texto y se convierte solo si cabe en un entero seguro de JavaScript.

La transacción exige entrega fallida, ausencia de snapshot/instante/registro de venta definitiva, régimen `entrega_v1`, selección incluida y carga cerrada. Comprueba pedido, selección, fallo, versión y evento de cierre contra la evidencia inmutable, igual que la reprogramación. Los históricos sin evidencia suficiente quedan bloqueados. Una ruta aún abierta debe cerrarse primero.

Solo cambia `pedidos.estado` a `cancelado`, usando la capacidad privada existente ligada a transacción, actor y antes/después exactos. No deshabilita triggers ni habilita parches arbitrarios. Conserva selección histórica, cierre original, ID, líneas, precios, preparación y todos los intentos. El trigger existente conserva el cambio de estado; el historial operativo inmutable agrega motivo, tratamiento, actor, versión, solicitud, resultado y evidencia anterior. La fila temporal de capacidad se elimina antes de finalizar; cualquier error revierte la transacción completa.

No llama a la cancelación genérica anterior, porque esta desactiva aplicaciones de pago. No elimina ni modifica pagos, aplicaciones, ajustes, créditos, ventas o importes. El administrador debe registrar la revisión y gestión pendiente de pagos/créditos, o declarar expresamente su ausencia; esa constancia no ejecuta una devolución ni un ajuste.

## Revisión estática integral de dependencias afectadas

- Leídos los documentos locales de Next.js sobre Server Actions y `revalidatePath`, antes de escribir código. Validación y autorización en cada entrada de servidor; la RPC repite la autorización como frontera definitiva.
- Contrastados `iniciar_operacion`/`completar_operacion`, historial operativo, versiones y capacidad privada de Fase 2. Se mantiene el orden global de locks de reprogramación/cierre: tabla pedidos → pedido/versión → advisory de jornada → carga. Cancelar no toma locks de cliente, pagos o ajustes ni escribe dinero.
- Revisadas las barreras de cierre, entrega fallida, carga confirmada, régimen y venta definitiva. La capacidad exacta existente permite únicamente la transición construida por la RPC; las demás columnas permanecen protegidas. La evidencia cerrada no se reescribe.
- Revisadas `operar_carga_jornada`, `leer_carga_jornada` y el traslado de selección de Fase 2: reprogramar mueve la selección al destino con `incluido=false` y conserva el cierre anterior mediante su snapshot. Confirmar/salir exige selección explícita y pedido listo.
- Se detectó que el ordenador visual histórico materializa paradas por fecha. Se agregó un trigger acotado en `paradas_ruta` para impedir insertar o actualizar paradas de pedidos reprogramados sin selección incluida en una carga de la misma jornada de la ruta. Usa lock NOWAIT del pedido para no invertir bloqueos esperando. El intento de ordenar se revierte íntegramente y la interfaz explica que primero se debe incluir el pedido en la carga. No se modificó la RPC histórica ni migraciones.
- Revisadas las vistas vigentes de saldos y movimientos, validación de aplicaciones, cancelación contable genérica, corrección de venta y reconocimiento de entrega. `entrega_v1` sin venta reconocida no aporta cargos a las vistas; cancelarlo no retira cargos históricos ni altera pagos. Se bloquea cancelar régimen legado porque las vistas excluyen cancelados y retirarían su cargo histórico. Reprogramar un legado conserva su cargo previo, sin generar otro. No se convierte régimen ni se reescribe contabilidad pasada.
- Listado y detalle usan la misma interfaz. Motivo, fecha, tratamiento y confirmación explícita; bloqueo de doble envío; payload y clave congelados al enviar para repetir una respuesta incierta. El formulario conserva valores tras un error. Mensajes específicos para versiones, fechas, falta de evidencia, ruta sin cerrar, saldo legado y SQL pendiente. Notificación de éxito y revalidación de pedidos y rutas.
- El historial integra resoluciones con motivo, actor, fecha, versión, nueva fecha y tratamiento administrativo, además de los intentos y cierres de Fase 3. Si falta su lectura, muestra advertencia de historial parcial, sin inventar ausencia de eventos.
- Se conservaron los cambios preexistentes del árbol de trabajo de Fases 2/3 y otros módulos. No se modificaron migraciones históricas.

## Archivos de esta fase

Nuevos:

- `src/app/(admin)/admin/pedidos/no-entregados-actions.ts`: autorización, lectura de versión, llamadas RPC, validación, errores y revalidación.
- `src/components/admin/undelivered-order-actions.tsx`: formulario compartido y confirmaciones con reintentos idempotentes.
- `supabase/manual/no_entregados_fase4.sql`: precondiciones, cancelación transaccional, lectura administrativa y barrera de inclusión en ruta.
- `supabase/manual/no_entregados_fase4.md`: este informe.

Modificados sobre su contenido al iniciar esta tarea:

- `src/components/admin/undelivered-orders.tsx`: sustituye botones deshabilitados por acciones reales.
- `src/app/(admin)/admin/pedidos/[id]/page.tsx`: acciones de entrega fallida y aviso para cancelados.
- `src/lib/admin/pedido-historial.ts`: agrega lectura y representación de resoluciones, conservando los cambios preexistentes de Fase 3.
- `src/app/(admin)/admin/rutas/actions.ts`: agrega exclusivamente el mensaje de inclusión explícita; conserva los cambios preexistentes de Fase 2.

## Pendiente y riesgos

Instalar manualmente solo el nuevo SQL de Fase 4; no reinstalar Fases 2/3. No se ejecutó SQL local o remoto, tests, builds, ESLint, migraciones, comandos Supabase, commit ni push. La revisión fue estática; no equivale a verificación de ejecución o concurrencia en PostgreSQL.

La comprobación de contrato es deliberadamente estricta: solo tolera la diferencia CRLF/LF comprobada; cualquier otra diferencia del cuerpo o de los metadatos exigidos aborta la instalación. No se debe omitir la precondición para forzar un contrato desconocido. El archivo usa CREATE FUNCTION/CREATE TRIGGER y está diseñado para una instalación única transaccional; la idempotencia exigida corresponde a las operaciones administrativas, no a reinstalar el archivo.

Los pedidos sin evidencia de cierre/fallo y las cancelaciones de régimen legado requieren tratamiento administrativo fuera de esta fase. No se inventan eventos ni compensaciones contables. El tratamiento de pagos/créditos queda registrado como decisión administrativa y su ejecución posterior es manual; esta fase no verifica que una gestión externa haya concluido.

El bloqueo exclusivo de pedidos sigue la estrategia existente de Fase 2 y puede causar espera bajo carga. La barrera de paradas puede rechazar temporalmente la operación por contención NOWAIT. Guardar el orden visual de una fecha con un reprogramado excluido se bloqueará hasta su inclusión explícita; no se altera silenciosamente la selección.

Una respuesta perdida puede reintentarse con la misma solicitud mientras el formulario permanezca abierto. Cerrar o recargar pierde la clave en memoria: antes de iniciar otra solicitud se debe consultar el detalle/historial. No se agregó persistencia de datos administrativos en almacenamiento del navegador.

## Corrección de instalación · CRLF/LF (11 de noviembre de 2026)

El error informado `CONTRATO_FASE2_O_FASE3_INCOMPATIBLE` se reproduce por la representación del cuerpo de reprogramación. Se extrajo estáticamente el texto entre `AS $$` y `$$` del archivo local de Fase 2 y se calcularon sus huellas, sin ejecutar SQL:

| Contrato | MD5 con LF | MD5 con CRLF |
| --- | --- | --- |
| `reprogramar_no_entregado_administrativo` | `29ff5650d5e2809e3677e9de957a0bca` | `601638d4def143573e36e4039665b292` |
| `permite_reprogramacion` | `af7bf8198bf30f9fc9290a7cdd6919b6` | `4f8aa0f59bef9bf70888520490cf8356` |
| `proteger_pedido_ruta_cerrada` | `8a8d2f6237022ff861d28f453ac8629a` | `e5f94d63fa66a7f8cdda2157531efd1d` |
| `proteger_entrega_fallida` | `192cccdf6205e693e1979701bb964a30` | `34cee7271e9d8e071e0e1d9f85a44d46` |
| `leer_intentos_pedido_admin` | `3e49d05d83329b17b966575d8a5dc202` | `755ab18b75743a4abe5cb76eb6a30b32` |
| `leer_no_entregados_admin` | `17e62f92f323f42e2887d0a33cacd77c` | `05948e5bf9831685a4a68d20ec7326c9` |

La huella CRLF de reprogramación coincide exactamente con la informada por Supabase. En estos seis cuerpos locales no hay literales de texto que abarquen varias líneas ni expresiones que inspeccionen su propio código: cambiar los finales de línea no cambia instrucciones, valores, comentarios ni su delimitación. La equivalencia funcional de esta transformación se justifica por esa revisión del texto. La coincidencia MD5 es evidencia del origen del fallo, no una inspección independiente del cuerpo remoto; solo se dispone de la huella y existencia/firma comunicadas por el usuario.

Se conservan las cuatro huellas LF originales de Fase 2. La comparación usa `md5(replace(prosrc,chr(13)||chr(10),chr(10)))`; no elimina comentarios, espacios, CR aislados ni modifica literales para aceptar variantes desconocidas. Se normalizan las cuatro comparaciones, porque corregir solo la primera dejaría las otras expuestas al mismo fallo de transporte. Las huellas añadidas de Fase 3 provienen de sus cuerpos locales completos; comprobar solo existencia no garantizaba autorización ni contenido de las lecturas.

La revisión encontró además precondiciones incompletas: ahora se exige ejecutor postgres con bypass RLS, READ COMMITTED y triggers origin; lenguaje PL/pgSQL, retorno escalar, volatilidad, ausencia de STRICT y configuración exacta de búsqueda/fecha/zona según cada contrato; permisos efectivos de los roles API y ausencia de EXECUTE para PUBLIC; nombre, eventos, condición, argumentos y granularidad de los dos triggers existentes; aislamiento y FORCE RLS de la capacidad privada. Los errores identifican la función, trigger o rol que difiere. No se conceden permisos adicionales para superar discrepancias.

Se revisaron los contratos completos: Fase 2 aporta la mutación idempotente, capacidad exacta, barreras y evidencia de cierre; Fase 3 agrega únicamente lecturas administrativas. La corrección no cambia las RPC de esas fases, la cancelación, el orden de locks, las claves de reintento, la auditoría, snapshots ni escrituras contables de Fase 4. Las precondiciones no constituyen una recertificación completa de todas las dependencias históricas de la base: se presupone la instalación íntegra de Fases 2/3 informada por el usuario.

### Instalación manual corregida

1. Usar el archivo completo `supabase/manual/no_entregados_fase4.sql` corregido, como postgres y después de Fases 2/3. No reinstalar esas fases ni ejecutar fragmentos para saltar validaciones.
2. Si el editor conserva la transacción abortada del intento anterior, finalizarla manualmente con `ROLLBACK;` antes de enviar el archivo completo. El fallo de la precondición ocurre antes de los CREATE y la transacción no debe dejar objetos de Fase 4.
3. El archivo conserva BEGIN/COMMIT y aborta íntegramente ante discrepancias. Si falla otra precondición, conservar el error específico y revisar ese contrato; no reemplazar huellas. Si ya existe algún objeto de Fase 4, detener la reinstalación y revisar su origen: este instalador no sobrescribe objetos.

No se ejecutaron tests, builds, ESLint, SQL local/remoto, migraciones, comandos Supabase, commit ni push. Solo se leyeron archivos y se calcularon huellas locales como análisis de texto. La instalación y validación de ejecución quedan pendientes de la aplicación manual por el usuario.
