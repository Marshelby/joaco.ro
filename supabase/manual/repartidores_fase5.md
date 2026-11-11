# Hidro Leufú · Fase 5 · Informe de entrega

Implementación local de frontend, servidor y SQL manual. El flujo requiere instalar `supabase/manual/repartidores_fase5.sql`; no se ejecutó SQL ni se comprobó el estado remoto. La instalación exitosa de Fases 2, 3 y 4 es información proporcionada por el usuario.

## Funcionalidades implementadas

- `/admin/repartidores`: habilitar o revocar el rol operativo sobre una identidad existente de Supabase Auth; asignar o reasignar una ruta principal y su jornada completa. Incluye navegación administrativa. Gestión reservada a administradores tanto en servidor como en la RPC. Registro privado inmutable de cambios de permisos y asignaciones.
- `/reparto`: pantalla móvil con jornadas activas asignadas al usuario, pedidos incluidos en carga, dirección con comuna y región, teléfono, referencia, productos preparados, estado, orden existente y progreso. Permite actualizar y cerrar sesión.
- Confirmación explícita de entrega completa e intento fallido con motivo/observaciones. Se reutilizan `confirmar_entrega_todo_correcto` y `registrar_entrega_fallida`. El repartidor no envía cantidades, importes, precios ni parámetros de cobro: los items se derivan de preparación en servidor de base de datos. La entrega usa el contrato existente con `por_pagar`, cero efectivo y cero transferencia. La contabilidad resultante es la normal de la entrega existente; no se crean pagos ni se implementan cálculos contables alternativos.
- Revisión y confirmación de cierre mediante `revisar_cierre_ruta` y `cerrar_ruta` de Fase 2. El botón depende del progreso y la RPC original vuelve a exigir pedidos resueltos, versión, huella y trazabilidad. El servidor devuelve sólo fecha, estado, versión y huella; nunca el snapshot financiero del cierre.
- Se conserva la autenticación actual, incluyendo contraseña y callback OAuth. `/reparto` es un retorno local permitido; al entrar por ese destino se comprueba el permiso operativo antes de asegurar una cuenta comercial. No exige crear un cliente comercial ni activar uno inactivo para trabajar como repartidor.

## Auditoría indispensable de estructuras existentes

Se consultaron exclusivamente los contratos locales necesarios de perfiles/Auth, autorización administrativa, rutas/paradas, pedidos y snapshots logísticos, preparación, carga, versiones/historial operativo, entrega, contabilidad dependiente y cierre/no entregados de Fases 2–4, además de sus puntos de integración en Next.js.

`perfiles.rol` contiene `cliente` y `admin`; `es_admin()` consulta el perfil persistido. No había un rol de reparto ni una asignación de repartidor en las estructuras locales consultadas. Se incorporó un rol operativo adicional en `operativo_privado.repartidores`, vinculado a `auth.users`. No se cambia el enum ni se sobrescribe el rol comercial, evitando cambios en los contratos existentes de registro y cuenta.

Las rutas/paradas existentes se reutilizan. La operación real de Fase 2 está organizada por `cargas.fecha`, no por una partición de repartidores. Por ello la nueva asignación tiene una única identidad por jornada y se vincula a la ruta principal ya existente. No se crean rutas, pedidos, clientes ni líneas de preparación duplicados.

## Autorización, concurrencia e idempotencia

- Las cuatro tablas nuevas son privadas, con RLS y FORCE RLS y sin privilegios de API. Las funciones usan propietario postgres y `search_path` fijo. La instalación exige postgres con bypass RLS y esquemas aislados.
- `es_admin()` conserva su definición. Las seis funciones indispensables existentes conservan su OID y su cuerpo de negocio; el instalador modifica sólo su condición administrativa para aceptar una capacidad interna. Valida propietario y una única aparición del guard esperado; cualquier incompatibilidad aborta la transacción.
- La capacidad es una fila privada por transacción, actor, fecha y pedido. Sólo el wrapper autorizado la crea, la consume sincrónicamente y la elimina antes de devolver. No usa metadata de usuario, JWT, GUC, service key ni suplantación de identidad. Un error revierte también la capacidad.
- La llamada directa a las RPC administrativas conserva su rechazo al repartidor: fuera del wrapper no existe capacidad. No se amplían grants de tablas, RLS públicas, lectores financieros, cancelación, reprogramación ni corrección administrativa. El permiso de reparto tampoco autoriza la interfaz admin. Los derechos comerciales propios que ya tuviera la cuenta siguen bajo las reglas de cliente existentes; no se concede acceso a clientes generales ni a pedidos ajenos por esas vías.
- Mutaciones de permisos/asignaciones y operaciones de reparto se serializan mediante un advisory lock común. La autorización efectiva se vuelve a evaluar en base de datos; una sesión antigua no conserva un permiso revocado después de que la revocación se confirma. Una operación que ya estaba ejecutándose puede terminar antes de que la revocación consiga el lock y se confirme.
- Reasignar incrementa la versión de asignación. Cambiar el permiso también incrementa las versiones de sus asignaciones: revocar y volver a habilitar no revive solicitudes abiertas anteriores. Cada operación exige identidad y versión actuales, y verifica que la ruta siga siendo principal para esa fecha.
- Se reutiliza la barrera global de pedidos de Fase 2. La selección, preparación e historial se leen después de adquirirla. El lock de cliente adicional usa NOWAIT para abortar sin esperar a un administrador que ya retuvo ese cliente antes de necesitar pedidos. La instalación usa locks NOWAIT y es transaccional.
- Las RPC originales conservan versiones operativas, actor y claves idempotentes. El reintento de entrega recupera los items originales del historial, no los recalcula sobre una preparación posterior. La interfaz conserva clave y contenido para reintentar mientras permanece abierta. Tras una respuesta incierta permite consultar el estado actualizado.
- Las jornadas cerradas desaparecen del lector operativo; los snapshots y cierres históricos siguen en sus lectores administrativos originales. La RPC admite recuperar una respuesta idempotente ya confirmada si la asignación vigente sigue autorizando al actor; una revocación o reasignación prevalece sobre recuperar esa respuesta.

## Archivos creados

- `src/lib/reparto/server.ts`
- `src/app/reparto/page.tsx`
- `src/app/reparto/actions.ts`
- `src/app/reparto/reparto-movil.tsx`
- `src/app/reparto/sin-acceso/page.tsx`
- `src/app/(admin)/admin/repartidores/page.tsx`
- `src/app/(admin)/admin/repartidores/actions.ts`
- `supabase/manual/repartidores_fase5.sql`
- `supabase/manual/repartidores_fase5.md` (este informe)

## Archivos existentes modificados

- `src/lib/account/post-auth.ts`: acceso operativo al volver a `/reparto`.
- `src/lib/account/return-to.ts`: permite el retorno local `/reparto`.
- `src/app/iniciar-sesion/actions.ts`: conecta la comprobación operativa con la sesión existente.
- `src/app/auth/callback/route.ts`: misma integración para OAuth.
- `src/proxy.ts`: renovación de cookies de sesión también en `/reparto`.
- `src/mocks/navigation.ts`: enlace administrativo Repartidores.

Se preservaron los cambios locales previos de Fases 2–4. No se modificaron sus SQL, migraciones históricas ni módulos operativos existentes de rutas/entregas/pedidos.

## SQL pendiente

Instalar manualmente **una sola vez**, como postgres, `supabase/manual/repartidores_fase5.sql`, después de las Fases 2–4. Contiene precondiciones, tablas privadas, capacidades, adaptación acotada de guards, RPC y ACL, todo en una transacción. No es una migración automática ni un script de actualización para una Fase 5 parcial. Si hay actividad incompatible con sus locks NOWAIT, aborta sin instalar parcialmente.

Después de instalar, la gestión disponible es `/admin/repartidores`; se usa el UUID de una cuenta Auth con perfil existente no administrativo. La jornada y su ruta principal deben existir por el flujo administrativo habitual; el repartidor ve la jornada sólo cuando la carga está `en_ruta`.

## Revisión estática única y límites

Se realizó una pasada integral estática de seguridad, contratos, dependencias y coherencia, con correcciones dentro de esa misma pasada: concesión de ejecución independiente de cómo PostgreSQL formatea regprocedure, invalidación de solicitudes tras revocar/reactivar, renovación de sesión, entrada operativa independiente de la cuenta comercial, consistencia de ruta/fecha y aborto NOWAIT para evitar espera circular con el lock de cliente.

No se ejecutaron tests, builds, ESLint, verificadores de tipos, SQL remoto, migraciones, comandos Supabase, commits ni push. No hay validación de ejecución de frontend o PostgreSQL; la compatibilidad remota depende de que las funciones instaladas conserven los contratos locales documentados. El instalador aborta ante dependencias/guards incompatibles en lugar de adaptar silenciosamente otro contrato.

Limitaciones y riesgos concretos:

- Un repartidor por jornada completa. Repartir una fecha entre varias personas exigiría cambiar el alcance del cierre de Fase 2; no se introduce ese cambio.
- Entrega completa únicamente bajo el contrato existente `entrega_v1`. Diferencias y entregas legacy deben resolverlas administradores. Intentos fallidos y cierres conservan las reglas legacy de las RPC existentes.
- No se registran cobros desde reparto. Confirmar una entrega reconoce la venta y su pendiente conforme a la RPC actual, respetando abonos previos. El texto de confirmación informa que no se registrará un cobro.
- Los locks globales preservan coherencia con Fase 2 y pueden producir contención o rechazos reintentables durante actividad administrativa. Los cambios de permiso se confirman tras terminar la operación que ya estuviera en curso.
- No hay sincronización en tiempo real ni borrado remoto de datos ya renderizados: actualizar o mutar vuelve a comprobar permisos y asignación. Datos previamente mostrados pueden permanecer en una pestaña antigua hasta actualizar.
- Las claves de reintento de la interfaz se mantienen en memoria de la página. Tras cerrarla o recargarla debe consultarse el estado vigente; no se implementó cola offline ni persistencia de datos de clientes en almacenamiento local.
- La asignación administrativa solicita UUID, sin búsqueda global de usuarios ni gestión nueva de credenciales.
