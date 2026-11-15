# Reprogramación de No entregados

Revisión estática de las fuentes locales, sin consultar ni modificar la base de datos.

## Causas demostrables

- El formulario enviaba una fecha libre; la acción sólo comprobaba formato y la RPC de Fase 2 sólo exigía una fecha posterior al intento y no pasada. No aplicaban días habilitados, corte comercial ni horizonte del creador. Una jornada destino no editable se conocía recién al enviar.
- Cualquier error conservaba la solicitud y deshabilitaba los campos: un rechazo conocido por fecha, jornada o versión impedía corregir los datos sin cerrar todo el formulario. Las respuestas inciertas sí necesitan conservar clave y contenido.
- El historial no recibía contexto de origen y su enlace siempre volvía al detalle del pedido, sujeto a la interceptación modal de Pedidos.
- La variante de rutas múltiples anteponía `exigir_fecha_legacy` al retorno idempotente. Una ruta individual creada posteriormente en el destino podía impedir recuperar una respuesta ya confirmada.

No hay evidencia del error concreto de una sesión de producción ni del SQL efectivamente instalado. No se atribuyen a datos reales las condiciones deducidas del código.

## Cambios

- Formulario compacto, ancho acotado, texto cotidiano, selector nativo accesible y explicación de que el pedido debe agregarse al nuevo reparto. Se conserva motivo obligatorio, límite de longitud y confirmación explícita. Controles adaptables y estados de consulta, envío, éxito, error y ausencia de fechas.
- Reutiliza `obtenerFechasEntregaDisponibles`, la misma fuente del creador. Interseca sus fechas con una nueva lectura administrativa que aplica las restricciones del pedido y de la jornada destino; muestra las primeras diez como máximo. La acción verifica sesión y permisos, y rechaza respuestas de disponibilidad con formato inesperado.
- La RPC valida pertenencia a esas fechas después de resolver reintentos confirmados; conserva locks, control de versión, capacidades exactas, auditoría y snapshots originales. Vuelve a comprobar el corte con `clock_timestamp()` antes de retornar, revirtiendo toda la operación si venció durante la espera. La barrera multi se conserva después del retorno idempotente.
- Sólo los rechazos conocidos permiten editar una nueva solicitud. Fallos de transporte o resultados no verificables conservan clave y contenido. Se mantienen el bloqueo simultáneo por referencia y los controles de duplicación del servidor.
- Historial abierto desde No entregados recibe la URL de origen validada; muestra “Volver a no entregados”. Navegación documental mediante enlaces nativos para evitar interceptación y modales. Guarda URL, scroll y productos desplegados en `sessionStorage`, y restaura al volver. Los demás accesos conservan “Volver al pedido”. No se cambia el contenido de auditoría del historial.

## SQL manual necesario

Aplicar por separado `supabase/manual/corregir_reprogramacion_no_entregados.sql`, después de Fases 2, 3 y 4. No se ejecutó. Añade una lectura administrativa y un auxiliar privado; parchea exclusivamente cuerpos reconocidos de la RPC (base o variante multi, normalizando CRLF). Si difieren firma, propietario, configuración o huella esperada, aborta la transacción. No actualiza pedidos históricos ni cierres. No cambia concesiones de la RPC existente.

Instalar este complemento después del resto de fases: Fase 4 valida la huella anterior de la RPC. No reinstalar Fase 4 sobre la función ya parcheada. La aplicación exige la nueva lectura para abrir la reprogramación; no recurre a fechas manuales si falta SQL.

## Límites y revisión final

- Se conserva el horizonte comercial de **14 días** presente tanto en TypeScript como en `fecha_entrega_disponible`. Si hay menos de diez fechas habilitadas dentro de él, se muestran menos: completar diez requeriría ampliar una regla de negocio, prohibido en esta intervención.
- La lectura de fechas es orientativa; las comprobaciones transaccionales siguen siendo autoritativas ante cambios concurrentes. No se evita una espera legítima por locks ni se habilitan pedidos históricos sin evidencia, repartos sin cerrar o jornadas incompatibles.
- Scroll depende del almacenamiento de sesión disponible y de que el contenido siga teniendo altura suficiente; sin almacenamiento queda la restauración nativa del navegador. No se guardan motivos ni datos de formularios administrativos en el navegador.
- Revisados estáticamente imports, contratos RPC, orden de validación e idempotencia, restricciones de fechas, enlaces, parámetros de retorno, cleanup de restauración y estados responsive/accesibles. `git diff --check` sin errores.
- Por instrucción expresa no se ejecutaron SQL, migraciones, Supabase CLI, tests, builds, ESLint, TypeScript CLI, commits ni push. No se verificó comportamiento visual en navegador ni ejecución contra PostgreSQL. Cambios ajenos preexistentes permanecen sin intervención.
