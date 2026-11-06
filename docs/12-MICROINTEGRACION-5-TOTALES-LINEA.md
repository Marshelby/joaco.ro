# Microintegración 5/6: total administrativo por línea

Alcance: `/admin/pedidos/nuevo`, etapa Precios y su contrato de persistencia.
Confirmación deshabilitada en interfaz y servidor. No se implementa fase 6.

## Decisión de esquema

El trigger `validar_total_linea_pedido` exigía `total_linea = round(cantidad *
precio_final_unitario_snapshot)`. Un total de 501 para 5 unidades no puede
representarse con un unitario entero. No se divide el importe autorizado.

Se agrega `items_pedido.total_final_administrativo`, nullable. Si está presente,
el trigger exige que `total_linea` coincida exactamente; si es NULL conserva la
regla histórica. El snapshot unitario y neto mantienen sus valores de catálogo.
La RPC solo llena la nueva columna cuando existe una diferencia de total.
No se actualizan productos ni presentaciones del catálogo.

## Contrato

Cada línea envía `productoId`, `presentacionId`, `cantidad`, `precioReferencia`
(unitario vigente), `totalOriginal`, `totalFinal`, `motivoAjuste`.
La RPC vuelve a consultar y bloquear el catálogo, verifica el unitario y calcula
el original con el redondeo histórico al peso de cantidad por precio vigente.
Solo ese cálculo original redondea: el total final entero se usa directamente.
Se permiten cero, ceros iniciales (`000` representa cero) y totales no divisibles
por cantidad. Límite de importe/subtotal: 9.000.000.000.000 CLP.
El motivo es obligatorio exclusivamente si ambos totales difieren (máx. 1000
caracteres). Al cambiar cantidad se restaura el total original y se borra el
motivo; la interfaz informa esta regla. Subtotal, despacho y resumen se recalculan.

## Auditoría y compatibilidad

La auditoría agrega `total_original` y `total_aplicado`. Para ajustes nuevos,
`precio_aplicado` es NULL; el CHECK exige ambos totales diferentes. Las filas
unitarias anteriores se conservan sin reescritura, junto a sus snapshots,
restricciones, RLS y triggers de inmutabilidad. La lectura distingue los dos
formatos y sigue funcionando antes de aplicar las columnas nuevas.
Se mantienen motivo, actor autenticado y fecha de autorización. La solicitud
inmutable conserva también líneas sin ajuste y administrador de creación.

La comprobación de idempotencia ocurre antes de validar el nuevo contrato: un
reintento idéntico de una solicitud histórica ya persistida devuelve su resultado
original. Nuevas solicitudes deben usar el contrato de totales; no se reinterpretan
los antiguos campos unitarios como totales.

Cuenta corriente continúa usando el único cargo derivado de `pedidos.total`
(o `total_final`). No se agregan pagos, cargos ni ajustes. La preparación completa
usa el total autorizado exacto. Para una línea ajustada con preparación parcial,
el cierre falla antes de modificar importes o aplicaciones existentes:
`TOTAL_ADMINISTRATIVO_REQUIERE_PREPARACION_COMPLETA`. Definir una política explícita
para ese caso queda pendiente; no se inventa un prorrateo que cambie el importe.
Las líneas históricas y sin ajuste conservan la preparación anterior.

## Despliegue y pendientes

Aplicar únicamente la nueva migración incremental
`20261105030000_totales_linea_pedido_administrativo.sql` sobre un entorno que ya
tenga `20261105020000`. La anterior solo recibió una nota histórica, sin alterar
su SQL ejecutable. No volver a ejecutarla en remoto.

Se realizó revisión estática de contratos y cambios. Por restricción expresa,
no se ejecutaron SQL remoto, tests, lint, tsc, builds, Docker ni servidores.
Pendiente validar y aplicar la incremental mediante el proceso autorizado antes
de cualquier habilitación futura. Validar entonces cero, 501/5, motivo condicional,
umbral de despacho, reintento histórico/nuevo y preparación completa/parcial.
No hubo commit ni push.
