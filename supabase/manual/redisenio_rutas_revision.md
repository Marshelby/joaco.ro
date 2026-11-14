# /admin/rutas — revisión estática

Intervención sin SQL ejecutado, migraciones, CLI de Supabase, pruebas, builds,
ESLint, CLI de TypeScript, commits ni push. No se verificó instalación remota
ni presentación en navegador.

## Operación

Retirados formulario, comando tipado, serialización de motivo y mensajes de
incorporación extraordinaria. La Server Action exige administración y aplica
una lista cerrada de comandos antes de llamar a la RPC: peticiones antiguas o
manipuladas con `incorporar` tampoco pasan por esta acción.
Selección y asignación conservan su disponibilidad únicamente antes de salir;
no se tocan preparación, despacho, entregas, fallos, cierre, versiones, claves
idempotentes, snapshots, restauración de scroll ni historial de incorporaciones.
Se compactan navegación de rutas, tarjetas, modos y resumen de jornada con
estados diferenciados y distribución responsive, conservando los colores base.

## Contabilidad

Auditados `leer_resumen_contable_pedido_admin`, `v_saldos_pedidos`,
`aplicaciones_pago`, `pagos`, correcciones de venta y registros privados de cobro.
La RPC individual sigue intacta: no se usa en bucle. Su importe definitivo
procede de la vista, que incluye correcciones; aplicaciones activas de pagos
confirmados determinan aplicado, saldo y desglose por método real.
`cobros_entrega` / `pagos_entrega` representan origen del cobro: no son una segunda
aplicación al pedido. No se suman ni se presentan como saldo del pedido.
Tampoco se usan métodos previstos o deuda global del cliente.

Único SQL nuevo requerido: `resumen_contable_rutas_admin.sql`, solo lectura,
con control `auth.uid()` + `es_admin()`, search_path fijo y permisos restringidos.
Consulta toda la fecha en una sentencia, agregando aplicaciones por lote:
pertenencia, cifras y métodos comparten snapshot. El frontend comprueba que los
IDs coincidan con la jornada operativa leída; si cambió su pertenencia, oculta
la contabilidad hasta recargar. Comprueba enteros seguros no negativos, ecuación
del saldo y concordancia de métodos con total aplicado. No hay fallback N+1.
Errores, RPC ausente o datos inválidos muestran «no disponible», nunca cero.

Solo se muestran totales si TODOS los pedidos no cancelados de la jornada tienen
venta reconocida y datos verificables. Un pedido legado sin reconocimiento
explícito no recibe un importe definitivo supuesto; impide totalizar la jornada.
Fechas pasadas muestran saldos contables actuales, no un cierre contable a esa
fecha. El detalle operativo conserva sus snapshots originales y sus importes
solicitados/enviados claramente etiquetados.
Las lecturas operativas previas por pedido (`leer_preparacion_explicita` y
contexto de entrega) son preexistentes; esta intervención no agrega consultas
contables individuales. Las distintas lecturas operativas siguen siendo
independientes; la lectura contable mantiene consistencia interna propia.

## Backend heredado pendiente de desactivación segura

`public.operar_ruta_multiple(jsonb)` conserva la rama `accion='incorporar'`,
definida en `rutas_multiples_fase3.sql` y su variante `_compatibilidad.sql`.
Un cliente con acceso directo a esa RPC podría seguir invocándola. Para eliminar
esa capacidad globalmente se debe revisar la definición realmente instalada y
bloquear solo esa rama (también sus reintentos idempotentes), preservando
`entregar`, `fallida`, `cerrar`, autorizaciones y auditoría histórica. No revocar
la RPC completa ni borrar eventos `ruta_multiple_incorporar` o modalidades
históricas. No se modificaron ni ejecutaron estos scripts compartidos.
Las jornadas legacy continúan con su carga original; el contrato actual impide
convertirlas automáticamente a rutas múltiples. Una nueva ruta independiente
en una fecha legacy necesita evolución backend específica; no se ofrece una
incorporación alternativa ni una conversión silenciosa desde este rediseño.
