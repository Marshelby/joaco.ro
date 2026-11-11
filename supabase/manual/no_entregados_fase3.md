# Fase 3 · No entregados

Aplicación: `/admin/pedidos?filtro=no-entregados`.

Pendiente: instalar manualmente `no_entregados_fase3.sql` después de Fase 2. No fue ejecutado. Agrega solamente `leer_no_entregados_admin` y `leer_intentos_pedido_admin`, ambas STABLE, con comprobación de sesión y `es_admin`, search_path fijo y ejecución solo para authenticated. El esquema privado continúa sin acceso directo; no se cambian políticas RLS ni funciones anteriores.

El listado exige estado vigente entrega_fallida y descarta transiciones operativas posteriores incompatibles. Búsqueda literal por cliente/número, filtros por fecha de entrega programada del intento vigente, 20 resultados por página. Los intentos con auditoría se muestran pendientes de resolución; los registros sin intento auditado se marcan históricos para revisión, sin inventar motivos o fechas de fallo. La fecha programada proviene del pedido vigente: no reconstruye fechas originales de intentos anteriores. Esas fechas se consultan en las evidencias inmutables de cierres del historial.

El historial agrega todos los intentos fallidos auditados y los cierres que contienen el pedido, incluso tras un traslado de jornada. Los montos del listado son los originales informativos. No se hacen operaciones financieras ni se cambia ningún pedido. Reprogramar y Cancelar son botones deshabilitados sin handlers.

Sin el SQL, el listado informa la dependencia pendiente; el historial anterior sigue disponible y advierte que falta la evidencia adicional. Los errores de consulta se muestran como errores y no como ausencia de pedidos.

No se ejecutaron tests, builds, ESLint, SQL remoto, migraciones ni comandos Supabase. Se conservaron los cambios preexistentes de otros módulos.
