# Reglas de negocio

**Estado:** Decidido para la primera definición funcional; ampliable por el dueño del proyecto.  
**Propósito:** Registrar las reglas de operación conocidas sin convertir propuestas futuras en hechos.  
**Última actualización:** 2026-07-30

## Productos

JOACO RO vende múltiples categorías: juguetes, productos solares, energía e iluminación, artículos de aseo, productos para el hogar, cocina, ropa de cama, frazadas, almohadas y otros productos de utilidad diversa.

Cada producto debe tener categoría principal y subcategoría; su creación y edición se realizará desde el panel administrativo. Debe contar con estado público de disponibilidad y precio unitario. La opción mayorista es configurable por producto: puede tener solo precio unitario, o precio unitario y mayorista. Sus campos conceptuales son `tiene precio mayorista`, `cantidad mínima mayorista` y `precio mayorista`. La regla mayorista depende de cada producto.

La ficha pública puede mostrar una descripción editorial breve y una imagen referencial mientras se valida el catálogo mock. No debe convertir esos campos en especificaciones técnicas ni prometer condiciones no registradas. Las imágenes múltiples quedan como capacidad futura del contrato, no como una galería simulada.

## Stock

Inicialmente no se mantendrá stock exacto y público en tiempo real. Los estados públicos recomendados son: **disponible sujeto a confirmación**, **disponibilidad limitada** y **agotado**. No se mostrarán cantidades exactas al cliente salvo decisión futura del negocio.

## Pedidos y aprobaciones

Flujo general: el cliente envía una solicitud; administración revisa stock físico y separa productos; luego aprueba, ajusta parcialmente o rechaza. Cuando existe modificación, el cliente debe confirmarla. Después se solicita y revisa el pago; finalmente se prepara para entrega o retiro.

Estados conceptuales:

- `solicitud_recibida`
- `revisando_stock`
- `requiere_confirmacion_cliente`
- `aprobado_esperando_pago`
- `pago_en_revision`
- `pagado`
- `preparando`
- `listo_para_retiro`
- `programado_para_entrega`
- `en_ruta`
- `entregado`
- `rechazado_sin_stock`
- `vencido_sin_pago`
- `cancelado`

Los nombres finales pueden cambiar antes de crear la base de datos. Se permite aprobación completa, parcial o rechazo. Si cambia cantidad, producto, subtotal o total, el cliente debe aceptar antes de pagar.

## Congelación de precios

Al enviar un pedido se debe guardar un snapshot de cada ítem: nombre de producto, cantidad, precio aplicado, tipo de precio y subtotal. Los cambios posteriores del catálogo no alteran los pedidos ya enviados.

## Clientes

Los clientes tendrán cuenta. La autenticación planificada es Google mediante Supabase Auth. El perfil considera nombre, email proveniente de Google, teléfono, direcciones, comuna e historial de pedidos, pagos y entregas.

Como futuro, se consideran puntos, sorteos, recompensas, cupones, beneficios y nivel de confianza. Para entrega son obligatorios nombre, teléfono, comuna y dirección; para retiro no se exige dirección.

La interfaz mock de beneficios representa sorteos, promociones y campañas sin definir puntos, saldo, niveles, cupones ni reglas de elegibilidad definitivas.

## Canales

Los pedidos online se realizan exclusivamente desde la web. WhatsApp se utilizará para soporte, asistencia, recordatorios, enlaces, seguimiento y comunicación. Los pedidos del local físico podrán ser ingresados manualmente por personal autorizado.

## Pagos

Inicialmente se contempla transferencia bancaria y, eventualmente, efectivo. La aceptación de efectivo puede depender de monto, historial del cliente, nivel de confianza y política vigente. Una pasarela de pago queda para el futuro.

El plazo de pago no será fijo en código: administración lo define por pedido. Presets sugeridos: 2, 6, 12 y 24 horas, además de un valor personalizado. Es independiente del día de entrega.

## Entregas y rutas

La cobertura inicial considera Quilpué, Villa Alemana y Peñablanca; Viña del Mar y estaciones de metro son posibilidades pendientes de confirmación. Se usarán zonas geográficas administrables, no cálculo automático por kilómetros en la primera etapa. Cada zona podrá tener nombre, tarifa, estado activo/inactivo, condiciones y días disponibles.

Administración define días disponibles, capacidad, horarios y rutas. El cliente elige entre días habilitados. El sistema debe prepararse para recordatorio de pago, aviso de vencimiento, confirmación de pedido, programación de entrega y aviso de ruta, evitando spam.

## Chatbot futuro

La integración futura se realizará mediante Meta WhatsApp Cloud API, n8n, acciones controladas y RPCs específicas. El chatbot no tendrá acceso libre a toda la base de datos.

Los recorridos operativos están detallados en [Flujos](./04-FLUJOS.md).
