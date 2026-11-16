# Acciones de entrega compartidas — revisión estática

Estado: código preparado; SQL NO ejecutado. No se verificó el esquema remoto.
Instalar manualmente `reparto_entrega_compartida.sql` después de revisar sus
prerrequisitos y los cuerpos vigentes. La ausencia de la nueva RPC bloquea la
confirmación con un mensaje explícito; no existe fallback que declare un cobro.

Inspeccionados: reparto-movil/actions, EntregaVisualDialog, EntregaFallidaDialog,
entrega-actions/confirmacion/preview/validacion/disponibilidad, RPC financieras
contrato 2, historial operativo, reparto fase 5, rutas múltiples fases 2/3,
recuperación de resultados y observaciones de entrega.

El flujo anterior del repartidor construía cantidades desde preparación y forzaba
por_pagar sin cobro; no aceptaba diferencias ni importes. Los guards separados de
diferencias y recuperación rechazaban al repartidor. Los cobros de entrega se
insertan dentro de las RPC financieras con su actor real; no requieren habilitar
registrar_pago_cliente_administrativo ni otras operaciones administrativas.

La interfaz usa los dos modales existentes, con las mismas validaciones de CLP,
métodos, parcialidades, deuda, saldo a favor, cantidades y observaciones. Sólo se
inyecta el transporte autorizado. Las vistas previas usan las mismas reglas de
valoración; el backend vuelve a validar todo bajo los locks originales. El ámbito
del intento se conserva junto a su clave en la pestaña para evitar adoptar una
asignación nueva al reintentar. La recuperación consulta antes de escribir.

SQL incremental: agrega una RPC cerrada y un predicado privado sobre capacidades
ya existentes, y amplía únicamente los guards de diferencias, consulta de
comprobantes y observaciones. No cambia es_admin, RLS ni permisos de tablas. El
wrapper exige rol activo y pertenencia actual al pedido/ruta, fecha, versión de
ruta/asignación y versión operativa. Las respuestas excluyen historial general,
otros pedidos y snapshots financieros. Las capacidades se eliminan al terminar;
una excepción revierte toda la llamada. Los reintentos comparan actor, clave,
versión y payload mediante el historial vigente. Tras cierre sólo se recupera un
resultado persistido: ninguna escritura nueva. Reasignar a otro actor revoca el
acceso incluso para recuperación; administración debe resolver esos casos.

Concurrencia: barrera NOWAIT de pedidos y advisory lock existentes, bloqueo de
ruta y cliente, delegación a locks contables. Las escrituras múltiples agregan su
evento de ruta e incrementan versión una sola vez, atómicamente con la entrega.
La instalación verifica owner/aislamiento/capacidades y conserva OID, ACL y
atributos al cambiar guards; falla y revierte ante objetos o contratos inesperados.

Mapa, listado, preparación, asignaciones, cierre y fórmulas financieras no se
modifican. Sin tests, builds, lint, TypeScript CLI, Supabase CLI, SQL, commits ni
push. Validación local: lectura estática y git diff --check. La revisión estática
no certifica la instalación ni la ejecución financiera en remoto.
