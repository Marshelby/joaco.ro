# Fase 2: interfaz de direcciones comerciales

## Orden obligatorio de despliegue

Este frontend NO debe desplegarse antes de aplicar y validar en Supabase la migración `20261101030000_separar_ambitos_direcciones_cliente.sql` de fase 1. Esta entrega no aplica ni modifica migraciones y no accede a servicios remotos.

1. Revisar y aplicar la migración de fase 1 siguiendo `13-FASE1-AMBITOS-DIRECCIONES.md`, con su respaldo y validaciones de datos, RLS y permisos.
2. Confirmar que `direcciones_cliente.ambito` existe, la RPC administrativa devuelve únicamente comerciales con su ámbito y revisión, y las RPC de autogestión y checkout restringen operaciones a personales. Validar principales independientes y conservación de datos históricos.
3. Solo después desplegar este frontend. No habilitarlo mediante un despliegue automático previo a la validación SQL.
4. Validar manualmente la matriz indicada abajo en un entorno autorizado antes de producción.

No hay compatibilidad del frontend nuevo con la base anterior: los filtros personales necesitan la columna y el lector administrativo exige `ambito = comercial`, sin asumir ámbitos ausentes. La base migrada conserva firmas RPC para el frontend anterior; durante esa transición, el administrador anterior mostrará solo comerciales según la RPC y la cuenta depende de las protecciones SQL. Un rollback de frontend debe mantener la migración y sus protecciones; no retirar SQL mientras haya instancias nuevas.

## Funcionamiento y contrato

La ficha individual muestra permanentemente tarjetas comerciales activas e inactivas, dirección, comuna, región disponible, principal comercial y pendientes separados de ubicación y zona. Su botón abre el editor propio sin entrar a Editar cliente. Permite añadir varias, editar, activar/desactivar y cambiar principal; los cambios se confirman juntos con Guardar direcciones comerciales. No se eliminan filas existentes.

Se reutilizan el formulario, estilos, esquema Zod y Server Action administrativos. Solo dirección y comuna son obligatorias; nombre, región, zona, coordenadas (ambas o ninguna), referencia, destinatario y teléfono son opcionales. Editar dirección/comuna/región retira las coordenadas previas para no conservar una ubicación obsoleta. La región puede ser derivada por SQL cuando corresponda.

Se mantienen `obtener_cliente_administrativo` y `guardar_cliente_administrativo`, sin RPC nuevas. El documento guarda revisión y UUID de operación; reintentos conservan exactamente el documento, y un resultado incierto bloquea modificaciones hasta reintentar o recargar. Los conflictos no sobrescriben datos. La revisión compartida detecta ediciones simultáneas de ficha y direcciones. Editar cliente envía un arreglo vacío de direcciones (la RPC no elimina ni altera las omitidas); gestionar direcciones envía exclusivamente comerciales y conserva la ficha leída. No se envía `ambito` ni ownership en las escrituras.

Creación rápida y creación/asociación desde Posibles pedidos conservan su flujo y dirección simplificada. No se cambian conversión administrativa, pedidos, contabilidad, rutas, invitaciones ni sidebar.

## Aislamiento personal

Se revisaron todas las referencias a `direcciones_cliente` de `src`: listado de Mi cuenta, resumen de cuenta, edición directa por ID, carga de checkout y validación de la selección en su Server Action exigen `ambito = personal`. Checkout también filtra los datos recibidos antes de renderizar opciones y seleccionar la inicial. Las altas, ediciones y desactivaciones personales siguen usando las RPC existentes protegidas en fase 1. La lectura de Posibles pedidos pertenece al circuito administrativo y se conserva.

## Validación pendiente y fase 3

Revisión estática de lectura/escritura, contratos, aislamiento y diff realizada; ejecutar `git diff --check` al cerrar la entrega. Por instrucción no se ejecutan builds, tests, instalaciones, Docker, MCP, Supabase remoto, commit ni push.

Para fase 3, validar en entorno autorizado:

- Cliente con direcciones personales y comerciales: tarjetas completas, vacío comercial, activas/inactivas y principales independientes.
- Alta solo con dirección/comuna; campos opcionales vacíos, coordenadas incompletas/rangos, cambio de ubicación y zona inactiva.
- Varias direcciones, cambio de principal, desactivación y reactivación; recargar y confirmar persistencia.
- Guardado concurrente de ficha/direcciones: conflicto sin sobrescritura; pérdida de respuesta y reintento con mismo UUID sin duplicados.
- Cuenta, edición por URL y checkout excluyen comerciales, incluso con un ID comercial manipulado. Confirmar creación y principal personal sin alterar el comercial.
- Creación rápida, asociación desde Posibles pedidos y conversión administrativa mantienen su comportamiento.
- Responsive, teclado, mensajes de error y confirmación en navegador.

Riesgos pendientes: migración aún no aplicada/validada, interacción real y compilación no verificadas. Datos históricos de cliente que no satisfagan la validación existente pueden impedir el guardado completo; una zona comercial inactiva debe sustituirse o retirarse en el editor. No se infiere geolocalización ni aptitud logística solo por tener dirección escrita.
