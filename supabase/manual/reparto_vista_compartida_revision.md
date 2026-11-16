# Mi reparto y Ruta del día

## Alcance

Se reutilizan RutaDiaMap y su mapa Leaflet, marcadores numerados, listado,
selección y expansión sincronizada, estados visuales y navegación por coordenadas.
El modo soloLectura consume el orden devuelto por leer_mi_reparto, sin llamar
ordenRutaDiaAction ni permitir reordenar. El administrador conserva su modo actual.
EntregaFallidaDialog comparte formulario, validación, confirmación y reintentos;
su operación predeterminada administrativa no cambia. En reparto usa operarReparto.

/reparto permite elegir una ruta propia y muestra un estado vacío si no hay rutas.
Sólo envía al navegador campos operativos explícitos; excluye importes.
Entregado conserva la confirmación operativa existente sin cobros. El formulario
administrativo EntregaVisualDialog requiere es_admin e incluye cobros, balances y
diferencias: reutilizar ese flujo completo vulneraría el alcance solicitado.
No se alteraron preparación, salida, cálculos financieros ni asignaciones.

## Autorización y ciclo de vida

exigirRepartidor verifica sesión y acceso_repartidor. leer_mi_reparto limita las
rutas a asignaciones activas del usuario autenticado y salidas efectivas. El
contrato actual no publica rutas múltiples en preparación ni rutas cerradas.
No se amplía esa visibilidad. No se añaden permisos administrativos.

Las mutaciones conservan operar_ruta_multiple / operar_mi_reparto, sus claves
idempotentes, versiones y comprobaciones bajo bloqueo. El servidor verifica
pertenencia, asignación y estado. La UI sólo habilita entrega en reparto activo
y cierre con todos los pedidos resueltos. El cierre legado conserva su revisión
versionada y huella. La validación de motivo y observaciones también se aplica
a rutas múltiples desde la acción de servidor.

## SQL pendiente indispensable para el mapa

leer_mi_reparto no devuelve coordenadas en los contratos versionados del repo.
reparto_coordenadas_asignadas.sql propone una RPC de lectura adicional que deriva
los IDs de leer_mi_reparto sin aceptar IDs suministrados por el cliente. Sólo devuelve
ID y coordenadas snapshot. No reemplaza funciones de preparación ni la RPC actual.
No se ejecutó. Hasta instalarla, las entregas siguen disponibles, pero no aparecen
marcadores reales ni navegación por coordenadas; la pantalla informa el bloqueo.
La instalación real y su esquema no se verificaron contra una base de datos.

## Sincronización y límites

Las operaciones invalidan /admin/rutas y /reparto y refrescan al confirmar.
RutaActualizacion consulta nuevamente el servidor cada 15 segundos y al recuperar
el foco en reparto y en mapas administrativos bloqueados para ordenar. Evita
refrescar formularios, diálogos o confirmaciones pendientes. No guarda una copia
independiente del estado operativo. No hay contrato de suscripción autorizado a
las tablas privadas en el repositorio: no se garantiza actualización instantánea
entre dispositivos. Esa parte del objetivo queda pendiente de un canal autorizado.

## Revisión

Revisión estática de componentes, contratos SQL versionados y permisos. No se
invocaron SQL, migraciones, Supabase CLI, tests, builds, ESLint ni TypeScript CLI.
