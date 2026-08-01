# Preparación de base de datos

**Estado:** Preliminar; no definitivo y no implementado.  
**Propósito:** Delimitar el diseño futuro de datos sin adelantar SQL ni conexión real.  
**Última actualización:** 2026-07-30

## Situación actual

Supabase aún no está conectado. No existen tablas definitivas y no se debe ejecutar SQL todavía. El diseño se realizará después de validar el frontend y las reglas de negocio con mocks.

## Propuesta conceptual preliminar

Los dominios posibles —no nombres definitivos de tablas— son: productos, categorías, subcategorías, clientes, direcciones, pedidos, ítems de pedido, pagos, estados, zonas, días de entrega, rutas, historial, puntos, sorteos, beneficios y notificaciones.

Las relaciones, campos y permisos se definirán a partir de los recorridos documentados, especialmente los snapshots de pedido y los controles administrativos. Esta propuesta no autoriza crear una base de datos ni asumir campos no confirmados.

## Reglas futuras de diseño

- UUID como identificadores cuando se diseñe el modelo.
- Timestamps consistentes.
- Soft delete donde corresponda y sea compatible con auditoría.
- Snapshots para preservar precios e información histórica de pedidos.
- Auditoría de operaciones relevantes.
- Índices basados en consultas reales.
- RLS obligatoria y privilegio mínimo.
- Migraciones versionadas.
- Integridad referencial y estados controlados.
- Historial inmutable en operaciones críticas.

La interfaz mock actual valida el contrato conceptual de snapshots de ítems, entrega, pago, historial de estados, direcciones y beneficios con participaciones desde fuentes temporales únicas. No define nombres de tablas ni autoriza SQL.

Las imágenes futuras requerirán una referencia persistida para catálogo (URL o path aprobado, texto alternativo y orden de galería) y una referencia independiente dentro del snapshot de pedido. Supabase Storage no se configura en esta fase: la UI solo espera el contrato tipado y mantendrá un fallback local cuando no exista un asset válido.

Ver también [Reglas de negocio](./02-REGLAS-NEGOCIO.md) y [RPCs](./06-RPCS.md).
