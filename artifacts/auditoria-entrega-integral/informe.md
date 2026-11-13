# Entrega y contabilidad: revisión estática

Implementación local, sin ejecución de SQL ni acceso a la base remota. No se ejecutaron migraciones, Supabase CLI, tests, builds, ESLint, TypeScript CLI, commits ni push. Revisión por lectura del código, contratos SQL locales, guías de Next 16.2 y código instalado de Base UI; `git diff --check` sin incidencias.

## Causa del bloqueo

`EntregaVisualDialog` combinaba `Dialog.Portal keepMounted` con `{abierto ? <ContenidoEntrega /> : null}`. Al cerrar, retiraba `Dialog.Popup` antes de completar la transición. En Base UI 1.6, `useOpenStateTransitions` espera `useOpenChangeComplete` sobre `popupRef`; `useAnimationsFinished` retorna sin invocar la finalización cuando esa referencia es null. El estado interno `mounted` puede permanecer activo, con el backdrop fijo todavía montado. F5 elimina ese árbol y sus estados.

Además, confirmar/recuperar un comprobante solo actualizaba estados internos y llamaba `router.refresh()`: nunca cerraba el diálogo. Next conserva el estado local al fusionar el nuevo payload RSC; refresh no equivale a cerrar ni reiniciar el modal. `RutaDiaMap` deriva sus paradas de las props actuales, no conserva una copia de los detalles, y no requiere resetear el mapa ni su orden. La causa identificada es estática; no se reprodujo en navegador por el alcance autorizado.

Corrección: portal con ciclo de montaje normal y popup presente durante el cierre. Un callback estable del propietario cierra el modal únicamente al confirmar/recuperar un resultado persistido, publica el aviso fuera del modal y solicita refresh. Se conservan la invalidación del servidor, bloqueo de doble clic, solicitud en sessionStorage y recuperación de solo lectura. No se utiliza recarga completa ni se reenvía automáticamente una escritura para refrescar.

## Observaciones y persistencia

Campo opcional de hasta 2000 caracteres en el resumen final común a ambas modalidades. El comentario se congela con la clave, versión, cantidades y cobro del intento, incluyendo recuperaciones tras pérdida de conexión. Si está vacío se utiliza el contrato anterior, sin requerir la nueva RPC de escritura.

El esquema existente contiene `observacion_general` del pedido, observaciones del historial de estados y una auditoría operativa privada e inmutable. Ninguno representa un comentario específico de entrega sin mezclarlo con instrucciones originales, cambios de estado o modificar la solicitud contable histórica. Se agrega una tabla privada de observaciones de entrega reutilizando el mecanismo de inmutabilidad existente. Registra pedido, clave, autor autenticado y fecha del servidor. Sin backfill ni modificación retroactiva.

La nueva RPC envuelve las RPC contables existentes en una transacción: entrega/cobro y observación se confirman juntos o se revierten juntos. Serializa por cliente siguiendo el orden existente, valida el comentario al recuperar la misma clave y no agrega comentarios a entregas previas. La recuperación consulta sin escribir. No se sustituyen reglas de venta, deuda, pagos, estados ni cálculos contables.

Lectura para administración/contabilidad desde Pedidos del día, Ver pedido y Ver historial; también en tarjetas de ruta, incluyendo la vista legacy. Mantiene el control de acceso administrativo vigente, sin crear nuevos roles.

## Productos e importes

Componente compartido compacto con precio unitario histórico de referencia, presentación, solicitado, preparado y enviado, subtotal solicitado y subtotal enviado. Si existe entrega definitiva, agrega cantidad e importe efectivamente entregados. Totales separados: solicitado, subtotal de productos enviados y total entregado con despacho/descuento. Conserva los colores por cantidad enviada, incluida la paleta legacy.

Precio: `items_pedido.precio_final_unitario_snapshot`; solicitado: `total_linea` y total original del pedido. Enviado: preparación persistida en el snapshot inmutable del evento `salir` de rutas múltiples o del resultado histórico de salida de carga legacy. Entregado: `venta_definitiva_snapshot` vigente, incluidas correcciones administrativas existentes. Solo se suman importes históricos exactos para el subtotal enviado completo. No se consultan precios del catálogo ni se derivan precios unitarios de totales ajustados ni se prorratean ajustes. Formato de cantidades y unidades reutiliza las reglas existentes.

## SQL manual único requerido

`supabase/manual/entrega_observaciones_y_detalle_historico.sql` (NO ejecutado). Crea una tabla privada inmutable, una RPC transaccional de confirmación/consulta con observación y una RPC administrativa de lectura. Incluye RLS sin acceso directo, grants limitados, propietario postgres y notificación del esquema API. Requiere contrato 2, `consultar_resultado_entrega`, infraestructura operativa y tablas de rutas múltiples fase 3 existentes. Las correcciones SQL que ya estaban sin seguimiento al comenzar se dejaron intactas.

Antes de instalar el SQL, las entregas sin comentario conservan su flujo; una entrega con comentario falla explícitamente por incompatibilidad sin guardar parcialmente. Las pantallas indican que no está disponible el lector histórico. No hay fallback que descarte un comentario ingresado.

## Archivos de esta implementación

- `src/app/(admin)/admin/rutas/entrega-visual-dialog.tsx`
- `src/app/(admin)/admin/rutas/entrega-actions.ts`
- `src/app/(admin)/admin/rutas/entrega-confirmacion.ts`
- `src/app/(admin)/admin/rutas/entrega-validacion.ts`
- `src/app/(admin)/admin/rutas/entrega-errores.ts`
- `src/app/(admin)/admin/rutas/page.tsx`
- `src/app/(admin)/admin/rutas/legacy-routes.tsx`
- `src/app/(admin)/admin/pedidos/[id]/page.tsx`
- `src/components/admin/delivery-order-card.tsx`
- `src/components/admin/preparation-compact-item-control.tsx`
- `src/components/admin/delivery-product-detail.tsx` (nuevo)
- `src/components/admin/delivery-observation.tsx` (nuevo)
- `src/lib/admin/entrega-contexto.ts` (nuevo)
- `src/lib/admin/pedidos.ts`
- `src/lib/admin/pedido-historial.ts`
- SQL manual e informe presentes.

## Riesgos y datos pendientes

No se verificó el esquema remoto, la aplicación del SQL ni el comportamiento visual en ejecución. La instalación debe contrastarse con las versiones de los contratos realmente desplegados. Los pedidos anteriores sin evidencia compatible muestran “Sin dato”/“Sin importe histórico”; no se inventan cantidades, comentarios, autores ni importes. Un total administrativo puede diferir del precio unitario de referencia multiplicado por cantidad: se conserva el importe autorizado. La salida histórica presentada es la última salida persistida del pedido; no reconstruye intentos sin snapshot. El lector añade una consulta RPC por pedido y resolución de autor cuando hay comentario; revisar latencia con jornadas grandes en una validación posterior autorizada.
