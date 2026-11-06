# Activación de Confirmar pedido administrativo

Fecha: 2026-11-06. Estado: **habilitada en el código**.

## Alcance y evidencia

Auditoría estática del frontend y del SQL local. Se toma como antecedente del
solicitante que `20261105020000` y `20261105030000` están aplicadas en Supabase.
No se inspeccionó el esquema remoto ni se ejecutó SQL remoto. No se ejecutaron
tests, lint, tsc, builds, Docker ni servidores. No se modificaron migraciones.
No se hizo commit ni push. Los cambios preexistentes del workspace se conservaron.

Se consultaron las guías instaladas de Next.js sobre Server Functions y
`useRouter` antes de adaptar el envío y la navegación.

## Contrato auditado

La definición vigente local es la de
`supabase/migrations/20261105030000_totales_linea_pedido_administrativo.sql`,
que sustituye el contrato unitario de `20261105020000`.

Firma: `public.crear_pedido_administrativo(p_clave_idempotencia uuid, p_pedido jsonb)`.
Devuelve un objeto JSON, no un array ni una fila tabular.

| Campo | Construcción / validación |
| --- | --- |
| `p_clave_idempotencia` | UUID generado una vez por documento enviado; conservado durante reintentos. |
| `p_pedido.clienteId` | ID del cliente activo seleccionado. |
| `p_pedido.ubicacionId` | ID de su dirección activa de ámbito comercial. |
| `p_pedido.lineas` | Entre 1 y 100; sin presentaciones duplicadas. |
| `p_pedido.subtotal` | Suma exacta de `totalFinal` de las líneas. |
| `p_pedido.fechaEntrega` | Fecha ISO; validación final SQL con corte exclusivo en America/Santiago y horizonte de 14 días, después de adquirir los locks. |
| `p_pedido.metodosPagoPrevistos` | Uno o varios de efectivo, transferencia y tarjeta; sin duplicados y en orden canónico. |

Cada línea contiene exactamente `productoId`, `presentacionId`, `cantidad`,
`precioReferencia`, `totalFinal`, `motivoAjuste` y `totalOriginal`.
`precioReferencia` es el precio **unitario de catálogo**, positivo y vigente.
`totalOriginal` es el redondeo por línea de cantidad por referencia, al peso;
el frontend lo calcula con enteros BigInt para enteros y medios kilos.
`totalFinal` es el **total exacto autorizado de la línea**, incluido cero:
no se divide por cantidad ni se vuelve a multiplicar o redondear.
El motivo se envía recortado cuando hay ajuste y como `null` cuando no lo hay.
Los importes y el subtotal están limitados a 9.000.000.000.000; la cantidad
máxima técnica SQL es 100.000. El servidor SQL mantiene además su límite de
solicitud de 262.144 bytes y todas sus validaciones de tipos y referencias.

La RPC revalida catálogo, categoría, presentación, pertenencia al producto,
cantidades y precio de referencia bajo locks. Un cambio de precio rechaza la
operación: no autoriza silenciosamente otro importe.

## Snapshots y auditoría

El consumidor no envía nombres, dirección, coordenadas, actor ni fecha de
aprobación. La RPC captura cliente y ubicación comercial, incluyendo nombre de
ubicación con fallback histórico, destinatario, contacto, zona y coordenadas.
Captura también producto, presentación, unidad y modo de cantidad.

Los snapshots unitarios siguen siendo referencias del catálogo (neto y final).
La columna `total_final_administrativo` conserva el total autorizado cuando hay
ajuste y el trigger permite ese importe exacto. La auditoría del ajuste registra
referencia, total original, total aplicado, motivo, `auth.uid()` y fecha de la
base. No inventa un precio unitario aplicado o una tasa fiscal. Tanto auditoría
como comprobante idempotente están protegidos contra modificación y borrado.
El detalle administrativo muestra `total_linea`, sin reconstruirlo del unitario.

## Idempotencia y permisos

La RPC comprueba `auth.uid()` y `es_admin()`. Se ejecuta como SECURITY DEFINER,
con `search_path = pg_catalog`; solo authenticated tiene EXECUTE entre los roles
API. La acción del servidor verifica también usuario y rol con la sesión real,
sin usar credenciales service_role. Las tablas administrativas permiten lectura
administrativa por RLS, sin DML para los roles API.

Un advisory lock transaccional por clave serializa los intentos concurrentes.
La tabla de operaciones tiene clave primaria y pedido único; la RPC compara
actor, SHA-256 y documento JSON completo. El orden de las líneas forma parte
del documento. Devuelve el comprobante original antes de revalidar fecha o
catálogo si la operación ya existe. Otra cuenta o documento con la misma clave
se rechaza.

El frontend bloquea el doble clic mediante ref sin esperar al próximo render y
muestra el estado de envío. Durante una respuesta incierta conserva clave y
payload originales, bloquea volver a editar los pasos y permite recuperar ese
mismo intento, incluso si una actualización posterior invalida la fecha.
Solo errores de negocio SQL conocidos, posteriores a la consulta idempotente,
permiten editar nuevamente. Un error de sesión, transporte, timeout o comprobante
inválido no prueba que un intento anterior no se haya confirmado.
Después de un rechazo definitivo, un documento sin cambios conserva su clave;
un documento corregido recibe otra al enviarse.

## Efectos contables y despacho

La creación guarda un pedido manual en estado `recibido`, sus líneas, auditoría,
historial por trigger y comprobante idempotente, en la misma transacción.
Descuento: cero. Despacho: $2.000 con subtotal menor que $25.000, gratis desde
$25.000. Coincide con `cotizarDespacho`; el backend recalcula estos importes.

`v_movimientos_cuenta_cliente` (definición de `20260817113000`) obtiene el cargo
una sola vez desde el pedido no cancelado, con `coalesce(total_final, total)`.
No se insertan ajustes de cuenta, pagos, cobros ni aplicaciones de pago al crear
el pedido. Seleccionar varios métodos previstos solo guarda preferencias.

La preparación posterior conserva los totales administrativos. La SQL ya aplicada
rechaza finalizar una línea ajustada con cantidad preparada distinta de la
solicitada (`TOTAL_ADMINISTRATIVO_REQUIERE_PREPARACION_COMPLETA`): no existe una
regla autorizada de prorrateo. Este comportamiento previo se conserva.

## Activación y archivos modificados

- `src/lib/admin/pedido-borrador.ts`: habilitación compartida, límites compatibles con SQL y comprobación adicional de clasificación SQL para cantidades fraccionadas.
- `src/components/admin/order-customer-selection.tsx`: validez de nombre/dirección y coordenadas de la ubicación, requeridos por la RPC.
- `src/components/admin/order-wizard.tsx`: validez conjunta de pasos, bloqueo del intento incierto y desmontaje de los pasos para limpiar el borrador únicamente tras éxito.
- `src/components/admin/order-delivery-selection.tsx`: envío, documento estable, recuperación idempotente y navegación al detalle con replace; conserva resumen enviado ante fallos de lectura posteriores.
- `src/app/(admin)/admin/pedidos/nuevo/actions.ts`: límites de transporte, distinción conservadora de errores y validación de comprobante, subtotal, despacho, descuento y total contra el documento enviado.
- `src/app/(admin)/admin/pedidos/nuevo/page.tsx`: texto de integración actualizado.
- Este informe.

La confirmación inicial requiere los cuatro pasos de datos válidos y el quinto
paso activo con resumen completo. No se informa éxito por iniciar el envío.
Solo un resultado satisfactorio de Supabase, validado y coherente con los
importes enviados, limpia el borrador y navega al detalle del UUID devuelto.
Si falla la navegación, queda un enlace al pedido ya creado en el asistente
limpio. Todo error anterior al éxito conserva el borrador.

## Riesgos y límites

- No se verificó ejecución real ni divergencias entre el SQL remoto y los archivos locales. La activación depende del despliegue de migraciones informado por el solicitante.
- Catálogo, ubicación, permisos y corte pueden cambiar después de la revisión visual; la RPC rechaza cambios incompatibles sin guardar pedidos parciales.
- El borrador y la clave conservan su alcance previo: memoria de esta página. Recargar, cerrar la pestaña o abandonar la ruta pierde ese estado. No se añadió almacenamiento de borradores ni recuperación entre sesiones. Ante un resultado incierto se debe recuperar el intento en la página antes de abandonarla.
- Solicitudes fuera de los límites técnicos SQL se rechazan; no se recortan líneas, motivos ni importes para hacerlas pasar.
- La finalización parcial de una línea con total ajustado sigue bloqueada por la regla SQL descrita arriba.

No se encontró necesidad de soporte SQL adicional para la creación solicitada.
La compatibilidad financiera revisada queda cubierta por totales de línea
exactos, transacción única, validaciones del comprobante e idempotencia.
