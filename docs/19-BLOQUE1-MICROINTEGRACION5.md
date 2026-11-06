# Bloque 1 — Microintegración 5/8: preparación explícita por productos

## Archivos de esta implementación

- `supabase/migrations/20261106050000_preparacion_explicita_productos.sql` (nueva).
- `src/app/(admin)/admin/pedidos/actions.ts`.
- `src/lib/admin/pedidos.ts`.
- `src/components/admin/preparation-item-control.tsx`.
- `src/components/admin/finalize-preparation-action.tsx`.
- `src/components/admin/delivery-order-card.tsx`.
- `src/components/admin/order-operational-action.tsx`.
- Este informe.

Se revisaron AGENTS.md, la guía local de Next.js sobre mutaciones, las RPC históricas de preparación y las migraciones pendientes 20261106010000, 20261106030000 y 20261106040000. Se conservaron los cambios de trabajo preexistentes. No se modificaron migraciones históricas ni las tres RPC de creación (carrito, conversión WhatsApp y pedido administrativo).

## Interfaz y persistencia

La jornada administrativa muestra PENDIENTE hasta que un administrador pulse Listo e ingrese y confirme la cantidad real. La primera edición comienza con la cantidad solicitada; Corregir preparación comienza con la cantidad confirmada. Cada confirmación se persiste en Supabase y sobrevive a alternar entre pedidos o recargar. Cancelar descarta únicamente la edición aún no enviada. Al corregir una cantidad distinta se exige volver a ingresar manualmente el importe, sin sugerir ni reutilizar automáticamente el importe anterior.

Las cantidades y los importes originales se muestran tachados junto a los operativos cuando difieren. Se muestra el importe operativo provisional del pedido y el historial por versión, producto, fecha, UUID del actor, motivo y valores anteriores/nuevos. El acceso desde el detalle del pedido a la jornada existente se conserva. Finalizar queda deshabilitado mientras haya pendientes; la RPC también lo impide, incluso con llamadas directas. Se retira de la interfaz la transición alternativa desde preparando que usaba la RPC antigua.

## Cantidades y precios

- Cero, cantidades inferiores y superiores a la solicitud están permitidos.
- KG fraccionable: hasta tres decimales, entre 0 y 999999999.999, sin redondeo silencioso. Unidades y presentaciones cerradas: enteros no negativos dentro del mismo límite. Se utiliza primero modo_cantidad_snapshot y, para datos antiguos sin modo, la clasificación histórica de presentación/unidad.
- Si cambia la cantidad respecto del snapshot original, el importe total de la línea es obligatorio, manual, entero CLP, no negativo y hasta 9007199254740991. Cero preparado también exige importe manual; no se inventa una regla de precio para ese caso.
- Sin cambio de cantidad se conserva total_linea, incluyendo totales administrativos especiales. La RPC rechaza un importe diferente; nunca multiplica cantidad por precio ni prorratea descuentos especiales.
- El agregado provisional suma importes confirmados y, para las líneas pendientes, sus importes autorizados originales, más costo de entrega menos descuento. Este agregado no significa que los pendientes estén listos. Un agregado negativo o fuera del rango soportado se rechaza transaccionalmente.

## Seguridad y auditoría

Las tres nuevas RPC son SECURITY DEFINER, propiedad de postgres, con search_path pg_catalog y referencias calificadas. Sólo authenticated recibe EXECUTE y cada cuerpo exige auth.uid() y es_admin(). No se abren permisos de escritura directa ni acceso al esquema privado. Se revoca EXECUTE de las dos RPC antiguas de preparación y de marcar listo despacho para impedir confirmaciones implícitas, prorrateos y reajustes contables por rutas antiguas.

confirmar_producto_preparado y cerrar_preparacion_explicita utilizan iniciar_operacion/completar_operacion de 3/8: lock común por pedido, versión esperada, clave UUID, solicitud canónica y resultado estable. Una clave reutilizada con actor, operación, versión o contenido distinto falla. El reintento idéntico retorna el resultado original sin otra revisión; sigue sujeto al día habilitado de 4/8. Los conflictos de versión exigen revisar el pedido actualizado. Cada revisión guarda valores anteriores/nuevos, cantidad e importe originales, actor, motivo y fecha real en el historial privado inmutable. leer_preparacion_explicita expone sólo a administradores la versión e historial de estas operaciones.

Se exige estado preparando y ausencia de cierre. Las RPC verifican fecha_entrega contra clock_timestamp() en America/Santiago después de adquirir locks. No se habilitan fechas futuras, vencidas o nulas, ni se agregan reglas de corte comercial. El cierre exige al menos una línea y confirmación explícita de todas. Registra actor/fecha y pasa a listo_despacho; no permite corregir después. preparacion_estado conserva completa/incompleta por compatibilidad: incompleta indica que alguna cantidad difiere de la solicitada, incluso por exceso; cada producto confirmado continúa LISTO.

## Aislamiento contable y compatibilidad

No se actualizan total, subtotal, total_final, subtotal_final ni los snapshots de items_pedido. No se escriben pagos ni aplicaciones, no se generan deudas ni ventas definitivas. La barrera de venta_definitiva_snapshot/venta_reconocida_en de 1/8 permanece activa. El cierre sólo cambia estado y metadatos de preparación, además de la auditoría.

Se agrega total_operativo_preparacion y se renombra el alias generado anterior a importe_operativo_legacy, conservando sus valores y referencias SQL existentes. El nuevo importe_operativo prioriza el agregado provisional y mantiene coalesce(total_final,total) como fallback. Las vistas contables históricas continúan usando sus totales anteriores. Futuras integraciones deben consumir el campo adecuado explícitamente, sin convertir el provisional en deuda.

Los registros antiguos de preparación permanecen intactos y reciben confirmado_explicito=false por defecto: no se reinterpretan como confirmación humana. No hay borrados ni backfill de datos ficticios o pedidos existentes; los pedidos históricos cerrados no se reabren. Las tres vías de creación comienzan con productos pendientes por ausencia de confirmación, sin necesidad de modificar sus contratos.

## Dependencias y validación pendiente

La migración nueva requiere las tres migraciones pendientes indicadas y todas sus dependencias previas. Deben aplicarse posteriormente en orden mediante el proceso autorizado; no se aplicó SQL remoto ni local durante esta tarea. La aplicación requiere desplegar SQL y código coordinadamente: las RPC nuevas deben existir antes de usar esta interfaz.

Se hizo revisión estática por lectura. Por instrucción expresa no se ejecutaron tests, lint, tsc, builds, Docker ni servidores. Quedan pendientes las verificaciones de integración en un entorno autorizado: tres vías de creación, cero/exceso/fracciones, importes manuales y administrativos, reintentos, concurrencia de administradores, cambio de día durante locks y ausencia de efectos contables. No se implementaron carga de camioneta, reparto, entrega ni cobros; sus flujos existentes no se ampliaron. No hubo commit ni push.
