# Compras parciales y utilidad del día

Implementación preparada mediante revisión estática. SQL **no ejecutado**:
`supabase/manual/compras_productos_dia_fase2_incremental.sql`.
Instalación única y transaccional como postgres, posterior a fase 1 y al esquema
actual de reconocimiento y correcciones de venta. No volver a ejecutar fase 1.
El SQL debe revisarse contra el esquema de destino antes de su ejecución manual.
No se inspeccionó Supabase remoto ni se presume instalado el parche.

## Archivos

- `src/app/(admin)/admin/rutas/compra-actions.ts`: validación administrativa y escritura según contrato.
- `src/app/(admin)/admin/rutas/page.tsx` y `legacy-routes.tsx`: integración del desplegable en las variantes de rutas.
- `src/components/admin/jornada-controles.tsx`: cuarto desplegable, disposición móvil y actualización de lecturas.
- `src/components/admin/day-purchase-row.tsx`: compras separadas, edición, cantidades y formulario accesible con movimiento reducido.
- `src/components/admin/day-purchases-summary.tsx`: cotejo con el resumen operativo y aviso de compatibilidad.
- `src/components/admin/day-profit-summary.tsx`: desglose y totales de utilidad estimada.
- `src/lib/admin/compras-dia.ts`: lectura compartida por render, validación y fallback de fase 1 solo si falta la RPC v2.
- SQL incremental y este informe.

## Cantidades y cálculo

Se mantienen fecha_entrega y pedidos no cancelados, cantidades originales de
items_pedido y agrupación exacta de producto/presentación/unidad de fase 1.
La preparación parcial no redefine la demanda original. No hay conversiones.
Unidades desconocidas o snapshots incompatibles bloquean el registro y el costo.

Cada compra conserva cantidad, precio, UUID, actor, versión y fecha de actualización.
Costo real registrado = suma(cantidad de compra × precio unitario).
Promedio ponderado = costo real registrado / cantidad total comprada.
Costo estimado para pedidos = promedio × mínimo(comprado compatible, requerido).
Si hay compras incompatibles, se deja el costo pendiente y no se atribuyen ingresos
a una parte con costo desconocido. Excedentes históricos quedan fuera del costo estimado.

Venta proyectada = suma(total_linea), sin promediar precios de venta.
Parte con costo conocido: se toma la misma proporción comprada/requerida de cada
línea; por distributividad, se muestra suma(total_linea) × esa proporción.
Este reparto proporcional es una estimación, no una asignación física a pedidos
ni un reconocimiento contable. Venta pendiente = venta proyectada menos parte estimada.
Utilidad bruta estimada = ingreso estimado de esa parte menos costo de esa parte.
Margen = utilidad / ingreso de esa parte × 100; sin ingreso se muestra «—».
No se calcula costo ni utilidad para la parte pendiente. Los totales se identifican
como parciales ante faltantes, incompatibilidades o cambios de demanda.

Ventas reconocidas: solo pedidos con venta_reconocida_en, sumando importes_definitivos
por ítem del snapshot definitivo o su última corrección por versión. Nunca se usa
preparación como venta. Pedidos históricos sin desglose se señalan como incompletos.
No se añaden flete, descuentos de pedido, gastos ni impuestos adicionales; el total
exigible y pagos siguen perteneciendo al Resumen contable existente.
Se conserva precisión decimal de compra en SQL; CLP se redondea al mostrar y los
totales se calculan antes del redondeo visual, por lo que pueden diferir del agregado
manual de filas redondeadas. Valores fuera del rango seguro bloquean la presentación.

## Transición, seguridad y concurrencia

Se crea solamente la tabla incremental de compras; costos y auditoría de fase 1
se conservan. Cada registro anterior pasa a una compra, incluyendo versiones,
actor, identidad, revisión y fecha. La auditoría previa sigue vinculada por fecha/clave;
las nuevas revisiones incluyen también UUID de compra en los JSON anterior/nuevo.
Los nombres se capturan si existe demanda actual; una compra previa sin demanda y
sin nombre recuperable se identifica como compra histórica. Ninguna se borra.
Los registros sin demanda se muestran con cero necesario, fuera de la utilidad y
sin edición operativa. No se reconstruyen nombres ni conversiones ausentes.

Hasta instalar el parche se utiliza el contrato 1, explicitando que editar reemplaza
el total de una única compra. Tras instalarlo, la RPC anterior rechaza escrituras
y un trigger protege el archivo de fase 1 incluso ante llamadas antiguas en vuelo.
Las compras independientes y utilidad se habilitan al verificar el contrato 2.

RLS sin políticas de acceso directo; RPC SECURITY DEFINER con search_path vacío,
propietario postgres, auth.uid() y es_admin(), ejecución solo para authenticated.
El parche no modifica funciones de pedidos, rutas, ventas ni contabilidad.
Lock por fecha/producto y por UUID de compra, bloqueo NOWAIT de pedidos/ítems,
revisión de demanda y versión de cada compra previenen sobreasignación y pisadas.
Reintento idéntico con el mismo UUID/versión no duplica escritura ni auditoría.
Una respuesta incierta requiere recargar antes de iniciar otra compra.

Cambios posteriores de demanda conservan compras, limitan lo considerado y muestran
revisión pendiente. Para corregir varias compras que exceden una demanda reducida,
se puede dejar una compra en cantidad cero (con auditoría) y luego corregir las demás.
No hay borrado ni reajuste automático de compras. Una entrada posterior de demanda
puede aumentar la necesidad; la siguiente lectura la señala para revisión.

## Validación

Solo lectura estática de código, SQL, snapshots, reglas operativas y documentación
local de Next.js, más `git diff --check`. No se ejecutaron SQL, migraciones, CLI de
Supabase, pruebas, builds, ESLint, TypeScript CLI, commits ni push.
