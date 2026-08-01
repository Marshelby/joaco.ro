# Flujos operativos

**Estado:** Definición conceptual vigente; pantallas y automatizaciones específicas pendientes.  
**Propósito:** Describir recorridos de negocio para orientar la implementación futura.  
**Última actualización:** 2026-07-30

Los estados referidos son conceptuales y se describen en [Reglas de negocio](./02-REGLAS-NEGOCIO.md).

La vista mock de detalle de pedido presenta el estado, el historial y los snapshots congelados de ítems como representación de estos flujos. No ejecuta pagos, cambios de estado, notificaciones ni operaciones reales.

La gestión visual mock de direcciones centraliza la dirección principal y las direcciones alternativas de la cuenta. Las acciones de agregar, editar, eliminar o marcar como principal no persisten cambios hasta contar con reglas y backend aprobados.

La vista mock de beneficios presenta campañas, promociones, sorteos y participaciones como consulta de cliente. No implementa puntos, cupones, sorteos ejecutables, elegibilidad automática ni premios.

La exploración pública mock permite buscar, filtrar por categoría y ordenar la misma selección de productos usada por Home. No crea carrito, solicitud, pago ni operaciones de catálogo reales.

La navegación pública solo expone Inicio, Catálogo y Mi Cuenta hasta que el flujo de carrito esté implementado. Las rutas de carrito, checkout y confirmación permanecen fuera de los enlaces públicos para evitar llevar a placeholders.

La ficha pública mock resuelve cada producto por slug desde esa colección compartida. Expone precios, regla mayorista y disponibilidad pública, y explica que la solicitud se revisará antes de coordinar pago y entrega o retiro. No crea solicitudes, reserva stock ni ejecuta operaciones comerciales.

Las imágenes de pedidos forman parte del snapshot visual del ítem: el historial conserva su propia imagen o fallback y no consulta el catálogo vivo para representar una compra pasada. La UI actual no duplica assets de producto; una futura persistencia deberá conservar una referencia de imagen y su texto alternativo dentro del snapshot.

La cuenta mock expone Resumen, Pedidos, Direcciones y Beneficios como consulta. No ofrece edición ni acciones de dirección hasta que haya autenticación, persistencia y reglas aprobadas.

## Compra web

- **Actor:** Cliente.
- **Inicio:** Entra al catálogo.
- **Pasos:** Explora o filtra productos; agrega productos al carrito; revisa cantidades y precio aplicable; elige entrega o retiro; completa los datos exigidos; envía la solicitud.
- **Resultado:** Se crea una solicitud para revisión administrativa.
- **Estados:** `solicitud_recibida` → `revisando_stock`.
- **Excepciones:** Producto agotado, datos requeridos faltantes o disponibilidad que deba confirmarse.

## Revisión administrativa

- **Actor:** Administración autorizada.
- **Inicio:** Solicitud recibida.
- **Pasos:** Revisa stock físico; separa productos; aprueba completamente, ajusta parcialmente o rechaza; define plazo de pago si se aprueba.
- **Resultado:** Pedido listo para pago, pendiente de confirmación del cliente o rechazado.
- **Estados:** `revisando_stock` → `aprobado_esperando_pago`, `requiere_confirmacion_cliente` o `rechazado_sin_stock`.
- **Excepciones:** Disponibilidad parcial o inexistente; cualquier ajuste de producto, cantidad, subtotal o total exige confirmación.

## Confirmación del cliente

- **Actor:** Cliente.
- **Inicio:** Administración ajustó una solicitud.
- **Pasos:** Revisa los cambios y acepta o cancela la propuesta.
- **Resultado:** Si acepta, se habilita el pago; si no, se cancela el pedido.
- **Estados:** `requiere_confirmacion_cliente` → `aprobado_esperando_pago` o `cancelado`.
- **Excepciones:** No confirmar no permite avanzar al pago; el manejo temporal del ajuste queda pendiente de definir.

## Pago por transferencia

- **Actor:** Cliente y administración.
- **Inicio:** Pedido aprobado y esperando pago.
- **Pasos:** Se entregan instrucciones y plazo; cliente realiza transferencia e informa/comparte respaldo según la experiencia futura; administración revisa el pago y aprueba o mantiene observación.
- **Resultado:** Pedido pagado o aún en revisión.
- **Estados:** `aprobado_esperando_pago` → `pago_en_revision` → `pagado`.
- **Excepciones:** Pago incompleto, no identificable o fuera de plazo requiere gestión administrativa; no se presume aprobación automática.

## Retiro

- **Actor:** Cliente y administración.
- **Inicio:** Pago aprobado con modalidad de retiro.
- **Pasos:** Administración prepara el pedido; notifica que está disponible; cliente retira; administración registra entrega.
- **Resultado:** Pedido entregado en local.
- **Estados:** `pagado` → `preparando` → `listo_para_retiro` → `entregado`.
- **Excepciones:** Dirección no es obligatoria; condiciones de retiro y verificación quedan pendientes.

## Entrega

- **Actor:** Cliente y administración.
- **Inicio:** Compra con entrega.
- **Pasos:** Cliente selecciona un día habilitado; administración considera zona, capacidad, horario y ruta; prepara, programa y despacha; registra la entrega.
- **Resultado:** Pedido entregado.
- **Estados:** `pagado` → `preparando` → `programado_para_entrega` → `en_ruta` → `entregado`.
- **Excepciones:** Zona o día no disponible; cambios operativos deben comunicarse al cliente. No hay cálculo automático por kilómetros en la primera etapa.

## Vencimiento por no pago

- **Actor:** Sistema y administración.
- **Inicio:** Expira el plazo definido para un pedido pendiente de pago.
- **Pasos:** Se emiten recordatorios prudentes cuando corresponda; al vencer, administración o una futura automatización marca el pedido vencido.
- **Resultado:** Solicitud ya no continúa como pedido pagable.
- **Estados:** `aprobado_esperando_pago` o `pago_en_revision` → `vencido_sin_pago`.
- **Excepciones:** El tratamiento de pagos reportados cerca del vencimiento se definirá operativamente.

## Cancelación

- **Actor:** Cliente o administración autorizada.
- **Inicio:** Existe una solicitud/pedido que no continuará.
- **Pasos:** Se solicita o registra la cancelación y se conserva el historial.
- **Resultado:** Pedido cancelado.
- **Estados:** Estado aplicable → `cancelado`.
- **Excepciones:** Las condiciones de cancelación después del pago son pendientes; no se deben inventar reembolsos.

## Pedido físico ingresado por administración

- **Actor:** Personal autorizado.
- **Inicio:** Venta o solicitud en local físico.
- **Pasos:** Personal registra el pedido manualmente, sus ítems, cliente cuando corresponda, modalidad y pago/estado aplicable; continúa con la revisión y preparación necesarias.
- **Resultado:** Pedido incorporado al historial operativo.
- **Estados:** Según el punto real del proceso; no se presume un único estado de entrada.
- **Excepciones:** La identificación obligatoria del cliente y tratamiento de efectivo quedan sujetos a política vigente.

## Registro e inicio de sesión con Google

- **Actor:** Cliente.
- **Inicio:** El cliente decide crear cuenta o iniciar sesión.
- **Pasos:** Autentica con Google mediante la futura integración Supabase Auth; el sistema obtiene el email y completa o actualiza los datos requeridos del perfil.
- **Resultado:** Sesión autenticada y perfil disponible.
- **Estados:** No aplica estado de pedido.
- **Excepciones:** Teléfono, comuna o dirección pueden ser necesarios según la modalidad de compra; dirección no se exige para retiro.

## Futuro seguimiento por WhatsApp

- **Actor:** Sistema, administración, chatbot futuro y cliente.
- **Inicio:** Un evento permitido requiere comunicación o el cliente solicita asistencia.
- **Pasos:** Una acción controlada prepara soporte, recordatorio, enlace, confirmación, seguimiento o aviso de ruta; el mensaje se envía por la integración futura.
- **Resultado:** Comunicación contextual registrada cuando corresponda.
- **Estados:** Puede acompañar estados existentes; no debe modificarlos libremente.
- **Excepciones:** Evitar spam y no otorgar acceso irrestricto del chatbot a la base de datos.
