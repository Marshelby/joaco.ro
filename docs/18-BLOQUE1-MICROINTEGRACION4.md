# Bloque 1 — Microintegración 4/8: restricción temporal de preparación

Implementación local, sin aplicar SQL ni ejecutar pruebas. Requiere las migraciones
locales en orden, incluidas las pendientes 20261106010000 y 20261106030000.
Nueva migración: `supabase/migrations/20261106040000_restringir_fecha_preparacion.sql`.
No modifica migraciones históricas ni activa la infraestructura privada de auditoría.

## Regla y RPC

La fecha efectiva es `pedidos.fecha_entrega` (date). No se infiere desde creación,
ruta, jornada ni cortes comerciales. Un pedido sin fecha también queda bloqueado.
Se exige igualdad con `(clock_timestamp() at time zone 'America/Santiago')::date`.
No se usa `fecha_entrega_disponible`, CURRENT_DATE ni now() para este permiso.

Se reemplazan los cuerpos vigentes conservando firmas, owners y ACL:

- `marcar_pedido_preparando_administrativo`: valida después del lock del pedido,
  antes de la transición y del retorno cuando ya está preparando.
- `guardar_preparacion_item_pedido_administrativo`: valida tras bloquear pedido,
  ítem y registro de preparación existente, incluso para volver a completo (DELETE).
- `finalizar_preparacion_pedido_administrativo`: valida tras bloquear pedido antes
  del retorno de cierre previo; para un cierre nuevo vuelve a validar después de
  bloquear ítems, preparación, aplicaciones y pagos. Los dos bloqueos financieros
  existentes se adelantan antes de la validación y de cualquier mutación; no se
  cambia el cálculo ni la política de reajuste vigente.
- `marcar_pedido_listo_despacho_administrativo`: cubre también la salida legacy,
  manteniendo su rechazo a preparación pendiente.

El error estable es `PREPARACION_FECHA_NO_HABILITADA`. Futuros, vencidos, NULL e
infinitos no coinciden con hoy. Los reintentos fuera de fecha también se rechazan.
La aceptación anticipada permanece intacta. Cancelación, reparto y entrega
conservan sus RPC y reglas vigentes. No se agregan transiciones ni reprogramación.

## Escrituras directas y compatibilidad

Antes de implementar se revisaron los grants locales, los cuerpos SQL y todos los
accesos `.from` de la aplicación a pedidos, ítems y preparación. El grant histórico
20260810042236 permite DML directo a authenticated sobre pedidos e ítems; RLS de
administración no evita que un administrador cambie la fecha o estado para saltar
las RPC. Preparación ya tenía SELECT solamente para authenticated, pero service_role
puede disponer de permisos de escritura por defecto.

La nueva migración revoca INSERT, UPDATE, DELETE y TRUNCATE sobre las tres tablas
a PUBLIC, anon, authenticated y service_role. No hay grants locales por columna.
La aplicación actual sólo hace SELECT directo; las escrituras oficiales ocurren
en funciones SECURITY DEFINER de postgres. Se conservan SELECT, RLS, permisos de
RPC, creación oficial, aceptación, cancelaciones y cierre vigente. No se revocan
permisos en tablas de pagos ni vistas financieras. Es deliberado que scripts o
consumidores externos que escriban directamente estas tres tablas deban migrar a
las RPC: esos consumidores no aparecen en el código local revisado.

No quedan vías conocidas de preparación fuera de fecha para los roles de API
bajo las migraciones locales revisadas. El owner/superusuario puede escribir o
restaurar permisos: no se promete protección frente al operador de base de datos.
Grants manuales remotos, roles con membresías adicionales, funciones externas o
escrituras desde consumidores fuera del repositorio no se comprobaron: no se
consultó ni modificó SQL remoto. No conceder nuevos grants DML ni crear wrappers
SECURITY DEFINER sin preservar esta regla. El flujo futuro de reprogramación
deberá implementarse explícitamente mediante una RPC autorizada.

## Interfaz y archivos

- `src/lib/order-preparation.ts`: permiso informativo por fecha en Santiago,
  independiente de cortes comerciales, con mensajes para hoy, futura, vencida y NULL.
- `src/app/(admin)/admin/pedidos/actions.ts`: traducción del error para inicio,
  guardado, cierre y salida legacy; la RPC es la autoridad, sin prechequeo vulnerable.
- `src/components/admin/order-operational-action.tsx`: deshabilita inicio/salida
  de preparación si la fecha está bloqueada; conserva las otras acciones.
- `src/components/admin/delivery-order-card.tsx`: mensaje, inicio deshabilitado,
  oculta cierre y controles editables fuera de fecha; conserva faltantes en lectura.
- `src/app/(admin)/admin/pedidos/[id]/page.tsx`: permiso visible y acceso a la
  preparación de la jornada para pedidos preparando.
- `src/app/(admin)/admin/pedidos/entregas/[fecha]/page.tsx`: permiso de la jornada.
- La migración nueva y este informe.

Se conservaron las modificaciones previas existentes en el workspace. La interfaz
refleja el reloj del servidor de aplicación al renderizar; una página abierta al
cruzar medianoche puede quedar desactualizada hasta refrescar. PostgreSQL revalida
cada operación con su propio reloj después de esperas y rechaza una petición vieja.
No se añadió progreso explícito, sobrecantidades, edición de precios, carga,
reparto, entrega ni reconocimiento contable nuevo.

## Criterios de aceptación pendientes de ejecución

1. Aceptar un pedido futuro funciona; iniciar, guardar y cerrar su preparación falla
   con el error temporal. Lo mismo ocurre con vencidos, NULL y fechas infinitas.
2. Hoy en Santiago: confirmado permite iniciar; preparando permite guardar faltante,
   editar motivo, volver a completo y cerrar, sujeto a las validaciones vigentes.
3. Pasada la hora de corte comercial, un pedido existente para hoy sigue habilitado.
4. Una espera de lock de pedido, ítem, preparación o cierre que cruce medianoche
   vuelve a evaluar la fecha real y rechaza el día anterior sin cambios parciales.
5. Probar diferencia UTC/Santiago y cambios estacionales: el permiso sigue el día
   calendario de Santiago, no la zona de sesión ni un desfase UTC fijo.
6. Reintentos de inicio/cierre y salida legacy fuera de fecha también fallan;
   reintentos del mismo día conservan su comportamiento previo.
7. DML directo en las tres tablas con authenticated (también administrador) y
   service_role falla por permisos, incluido cambiar fecha, estado, cantidades,
   preparación o borrar un faltante. SELECT autorizado continúa funcionando.
8. Creación web/administrativa/conversión, aceptación anticipada, cancelación y las
   demás transiciones existentes siguen funcionando a través de sus RPC.
9. Detalle y jornadas explican el bloqueo; no permiten editar ni cerrar preparación
   fuera de fecha. Los faltantes existentes siguen visibles sin edición.
10. Cantidades y totales administrativos conservan las reglas previas; no se agregan
    vistas, pagos, aplicaciones ni reconocimiento contable nuevos.

Validación realizada: lectura y comparación estática de archivos y cuerpos SQL.
No se ejecutaron tests, lint, tsc, builds, Docker, servidores ni SQL local/remoto.
No se hizo commit ni push. Estos criterios no se presentan como pruebas aprobadas.
