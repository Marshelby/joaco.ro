# Controles y contabilidad de /admin/rutas

Revisión exclusivamente estática. No se ejecutaron SQL, migraciones, Supabase CLI,
tests, builds, ESLint, TypeScript CLI, commits ni push. No se verificó el esquema
remoto ni el comportamiento visual en navegador.

## Hallazgos y cambios

- `page.tsx`: los indicadores preceden a tres controles en una fila responsive.
  Crear ruta conserva RutaMultipleForm, comando, validación e idempotencia.
  Productos usa entrega.resumenProductos de todos los pedidos de la fecha,
  incluso al seleccionar una ruta. Se elimina el acordeón duplicado inferior.
- `jornada-controles.tsx`: botones nativos con aria-expanded/aria-controls y
  regiones identificadas; un panel abierto, sin navegación ni scroll programado.
  Los paneles permanecen montados para conservar el formulario al alternar.
- `rutas-contabilidad.tsx`: ventas reconocidas, aplicaciones vigentes y saldos
  actuales; desglose por cliente y método real, enlace sólo con UUID válido.
  Deduplicación por pedido y agrupación por identificador, nunca por nombre.
  Sin identificador se mantiene cada pedido separado. Los datos ausentes no
  se convierten en cero; se indica cobertura y se conservan subtotales válidos.
  Las sumas fuera del rango entero seguro se ocultan. Se corrige también el
  rótulo de aplicaciones en las tarjetas individuales.
- `lib/admin/rutas-contabilidad.ts`: misma RPC por lote y autorización existente;
  valida importes no negativos, conciliación venta-aplicado=saldo y suma de
  métodos=aplicado. Una fila ausente o inválida no descarta las demás.
  No se añadieron consultas por pedido.
- `legacy-routes.tsx`: mismos controles de consulta y sin productos duplicados;
  Crear ruta deshabilitado en jornada histórica, cuya operación se conserva.
  El fallback ante contrato múltiple inválido sigue bloqueando la operación.

## Fuentes contrastadas

`obtenerDetalleEntregaAdmin` y `consolidarItemsEntrega` suministran los productos
solicitados. Sus importes operativos/preparados no se usan como venta reconocida.
`leer_resumen_contable_rutas_admin` (SQL manual existente) selecciona pedidos de
fecha_entrega no cancelados y exige venta_reconocida_en; obtiene importes desde
v_saldos_pedidos y métodos desde aplicaciones_pago activas con pagos confirmados.
La vista deriva el importe definitivo del snapshot para entrega_v1 y contabiliza
cada aplicación, no el monto recibido completo del pago. El lector individual
leer_resumen_contable_pedido_admin distingue aplicaciones, cobros_entrega y
saldo disponible de origen; esos valores no deben sumarse entre sí.

La integración de entregas 20261108140000 registra recepción, pagos por método,
aplicación parcial y eventual crédito. La corrección 20261108200000 anula pagos
y crea reemplazos con fecha_pago: esos registros no acreditan nuevas recepciones.
Por eso no se equipara fecha_entrega, fecha_pago ni fecha de aplicación.
Preparación, selección/asignación, despacho, cierre y permisos no se modifican.

## SQL y limitaciones

La interfaz requiere la RPC por lote del archivo existente
`resumen_contable_rutas_admin.sql`; si falta, muestra indisponibilidad sin fallback
N+1. No requiere cambiar esa RPC para los controles ni los subtotales.

`cobros_recibidos_jornada_admin.sql` es un borrador manual nuevo, NO ejecutado ni
conectado a la interfaz. Sólo propone un subtotal de recepciones originales de
entrega aún confirmadas, por instante registrado en America/Santiago, separado
de aplicaciones. Devuelve total_recibido NULL y cobertura_completa=false.
No resuelve recepciones administrativas, anulaciones históricas o sustituciones;
para un total exacto falta una fuente de recepción con evidencia de instante y
origen y trazabilidad completa de correcciones/reversos. La sección de cobros
por fecha queda pendiente, incluso si se instala ese borrador parcial.

La lectura operativa y la contable son solicitudes distintas: cambios concurrentes
pueden afectar cobertura. Se validan las identidades esperadas sin inventar filas;
no se afirma un snapshot transaccional compartido entre ambas lecturas.
