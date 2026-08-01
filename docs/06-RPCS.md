# Preparación de RPCs

**Estado:** Preliminar; no existen RPCs ni conexión a Supabase.  
**Propósito:** Establecer cuándo las RPCs serán apropiadas en la futura capa de datos.  
**Última actualización:** 2026-07-26

Las RPCs se definirán al conectar Supabase. No deben crearse por cada consulta simple: se usarán para procesos transaccionales, validaciones sensibles y acciones controladas del chatbot.

## Áreas futuras posibles

Todo lo siguiente es preliminar: crear pedido, aprobar pedido, ajustar pedido, confirmar ajuste, registrar pago, aprobar pago, vencer pedido, asignar entrega, cambiar estado, registrar entrega, aplicar puntos y enviar acciones seguras desde el chatbot.

Cada RPC futura deberá definir autorización, validaciones, transacción cuando aplique, cambios de estado permitidos, auditoría, errores controlados y contrato de respuesta. La UI no sustituye estas garantías.

No se debe implementar SQL ni funciones de base de datos hasta validar el diseño descrito en [Database](./05-DATABASE.md).
