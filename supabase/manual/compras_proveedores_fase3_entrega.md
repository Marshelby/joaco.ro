# Compras y proveedores — fase 3

SQL pendiente: `compras_proveedores_fase3_incremental.sql`. No fue ejecutado.
Instalación única, manual como postgres, sobre compras fase 2 y proveedores ya instalados. No reinstalar parches anteriores. La instalación es transaccional; no modifica ni vincula automáticamente compras o movimientos históricos.

Antes de instalar: el frontend usa los contratos existentes; continúan compras múltiples, costos y utilidad. No aparece el selector de proveedores. El detalle de proveedores admite la respuesta anterior sin compras.

Después de instalar: selector completo de proveedores con Sin proveedor por defecto, estados Por pagar/Pagado completamente/Abono parcial, resumen de total/pagado/pendiente. Sin proveedor no hay asientos. Los formularios abiertos con contrato anterior deben recargar; su escritura se rechaza para impedir eludir la integración.

Se reutiliza el guardado fase 2 (demanda, unidades, concurrencia, auditoría, promedio ponderado). La obligación es el total redondeado al peso CLP; el costo operativo sigue usando cantidad × precio sin redondeos nuevos. El cálculo en frontend y servidor usa aritmética decimal exacta para coincidir con SQL. Se rechazan totales que exceden el entero seguro del frontend.

Cada compra tiene estado financiero privado. Los asientos inmutables identifican compra, proveedor, versión, administrador y fecha. Cambiar el total genera solo su diferencia; cambiar proveedor sin pagos revierte la obligación anterior y genera la nueva. Los pagos adicionales se registran aumentando el monto acumulado en la compra desde Rutas; solo se asienta la diferencia. No se borran pagos ni se aceptan reducciones del acumulado, cambios de proveedor con pagos o totales inferiores a lo ya pagado. La cantidad cero solo neutraliza compras sin pagos.

Los abonos manuales continúan aplicándose exclusivamente a deudas manuales. No se usan para pagar compras registradas. El saldo global suma movimientos manuales y asientos de compras una sola vez. El detalle muestra todas las compras vinculadas, incluso fechas anteriores y cantidad cero, y conserva los asientos de proveedores anteriores cuando hubo un cambio.

Serialización: UUID de compra, bloqueos del proveedor en orden estable, controles heredados de demanda y versión. Guardado de compra, finanzas, asientos y auditoría ocurre en una sola transacción. Repetir la misma operación con UUID, versión y contenido originales no duplica pagos ni obligaciones; una versión obsoleta con otros datos se rechaza. Lectores comparten snapshot para no mezclar costos y finanzas concurrentes. Acceso exclusivamente administrativo mediante RPC; tablas privadas sin DML ni lectura directa para clientes.

Revisión estática: contratos antiguos/nuevo, permisos, rutas de escritura heredadas, reintentos, pago completo/parcial, transferencia sin pagos, rechazo de reducción de pagos y de total bajo lo abonado, aislamiento de movimientos manuales y fórmula de utilidad. `git diff --check` ejecutado. No se ejecutaron SQL, migraciones, Supabase CLI, tests, builds, ESLint ni TypeScript CLI. La validación de ejecución queda pendiente hasta instalar el SQL en el entorno autorizado.

Archivos: acción de compras, lector de compras, cálculo decimal compartido, fila y resumen de compras, compatibilidad del resumen de utilidad, tipos y diálogo de proveedores; este informe y el SQL incremental.
