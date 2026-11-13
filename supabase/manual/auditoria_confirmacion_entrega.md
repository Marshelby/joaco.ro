# Auditoría estática de confirmación de entrega — HL-000083

## Evidencia y alcance

Se revisaron entrega-visual-dialog.tsx, entrega-actions.ts, entrega-preview.ts,
entrega-confirmacion.ts, diferencias-actions.ts, entrega-disponibilidad.ts y las
definiciones locales de las RPC y sus auxiliares. Se leyó la guía local de Next.js.
No se ejecutaron SQL, migraciones, Supabase CLI, tests, builds, ESLint, TypeScript
CLI, commits ni push. No se consultó producción ni el almacenamiento del navegador.

El código local NO contiene una escritura al pasar de Pago a Resumen:
`continuar()` llama a `balanceVistaEntrega()` y `setPaso(3)`. Productos llama a
`valorarVistaEntrega()`. Ambas funciones son cálculos puros; cargarVistaEntrega y
prepararEntregaTodoCorrecto solo consultan permisos, disponibilidad, preparación,
precios y abonos. Las RPC leer_preparacion_explicita y
verificar_contrato_confirmar_entrega consultan datos/catálogos.

La única llamada cliente a las acciones de confirmación está en `confirmar()`,
vinculada al botón Confirmar entrega/Reintentar confirmación, con botones de tipo
button y claves distintas para Continuar y Confirmar. No hay efecto de confirmación
automática ni envío de formulario al continuar.

Existe un camino diferente: al abrir con entrega-pendiente:<pedidoId> en
sessionStorage, el efecto pasa directamente al paso 3 y llama a recuperarEntrega.
resolverEntrega(..., true) consulta consultar_resultado_entrega y NO llama a las
RPC de escritura si no encuentra comprobante. La definición SQL local de esa
consulta solo lee historial, entregas, pedidos y cobros. Una solicitud confirmada
se recupera verificando actor, clave, operación, versión y payload; otra solicitud
se informa por separado sin atribuirle los montos actuales.

Las RPC confirmar_entrega_todo_correcto/hubo_diferencias sí escriben venta,
pagos, aplicaciones, deuda/saldo, snapshot e historial en una misma transacción.
iniciar_operacion recupera primero el resultado con la misma clave/payload y
actor, antes de verificar la versión actual. completar_operacion registra auditoría.
La corrección 42702 existente no se modificó.

## Defectos comprobados y cambios

1. La respuesta perdía la procedencia del comprobante: una recuperación se mostraba
   igual que una nueva confirmación. entrega-confirmacion.ts ahora conserva
   recuperada=true tanto desde consulta como desde una respuesta RPC reintento=true.
   El diálogo distingue comprobante anterior, nueva confirmación y otra solicitud.
2. La simulación se llamaba balanceServidor aunque se calcula localmente.
   Se renombró a balancePrevisto y el resumen explica explícitamente que no registra
   entrega ni cobro. No se agregaron etapas ni se alteró la estructura visual.
3. Un fallo en sessionStorage.removeItem después de recibir un comprobante podía
   entrar en el manejo de error de confirmación/recuperación y mostrar un error
   pese al éxito. Ahora la limpieza es tolerante a fallos; la clave restante permite
   recuperar el mismo resultado en otra apertura.
4. El manejador verifica también el bloqueo síncrono de confirmación completada y
   la carga en curso, además del bloqueo durante el envío y los estados del botón.

Se mantienen clave, versión, orden de items y cobro para reintentos; la recuperación
no reenvía automáticamente. Se conservan revalidación de rutas/pedidos/clientes y
router.refresh tras resultado persistido, además de todas las reglas contables SQL.

## Conclusión para el caso reportado

No se demostró una escritura prematura en el código local. Sí se demostró la
recuperación automática de solicitudes anteriores y su presentación ambigua.
No puede afirmarse que HL-000083 siguió ese camino sin correlacionar el historial
persistido (clave, actor, operación, versión, payload e instante), la solicitud
conservada en la pestaña y los registros de red del incidente. Tampoco se certifican
los cuerpos SQL instalados ni la versión desplegada mediante esta revisión local.

No se requiere SQL manual para estos cambios. No se revierten ni alteran entregas
ni cobros existentes. La atribución histórica de HL-000083 queda sin verificar.
