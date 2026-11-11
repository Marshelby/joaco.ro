# Hidro Leufú — Fase 6: revisión final integral prepublicación

Fecha: 11 de noviembre de 2026. Método: una pasada estática integral del código local, con correcciones dentro de la misma revisión.

## Dictamen

**Apto para push del código desde el alcance estático revisado, con las correcciones de esta fase incluidas. No se identificaron bloqueos estáticos pendientes demostrables en el flujo revisado. Esto no certifica que esté listo para operar en producción.** No se comprobó compilación, ejecución, comportamiento de PostgreSQL, funcionamiento móvil real ni correspondencia del catálogo remoto con los archivos locales. La publicación operativa queda sin validar en esos aspectos; no se presenta esta revisión como evidencia de pruebas de ejecución.

El usuario informó instalación manual exitosa de los SQL de las Fases 1–5. Se toma como antecedente, sin atribuirle comprobación remota por parte del agente. No se ejecutó SQL ni se necesita SQL adicional por las correcciones identificadas aquí.

## Alcance y evidencia consultada

Se siguió el flujo preparación → selección y confirmación de carga → salida → entrega completa/con diferencias o intento fallido → revisión y cierre → reprogramación/cancelación administrativa → inclusión en nueva jornada. También se revisaron habilitación, revocación, asignación y reasignación de repartidores, entrada por contraseña/OAuth, renovación de sesión y acceso directo por URL.

Fuentes principales:

- `src/app/(admin)/admin/rutas/`: página, mapa, acciones, validadores y diálogos de entrega, diferencias, fallo y cierre.
- `src/app/(admin)/admin/pedidos/`: acciones de preparación/carga y resolución de no entregados; integración en lista, detalle, historial y jornada.
- Controles de preparación, carga, salida y no entregados en `src/components/admin/`; lectores de carga, pedidos, historial y no entregados en `src/lib/admin/`.
- `src/app/reparto/`, `src/lib/reparto/server.ts`, gestión en `src/app/(admin)/admin/repartidores/`, layout administrativo y navegación.
- Resolución posterior a autenticación, destinos permitidos, acciones de inicio de sesión, callback y `src/proxy.ts`.
- SQL manual de Fases 2–5 y diagnóstico de entrega de Fase 1. Dependencias históricas locales de estados, rutas, preparación explícita, carga, versiones/idempotencia, venta definitiva, entrega con cobro, fallo y centralización de escrituras contables. Las migraciones se consultaron como evidencia, sin modificarlas.
- Guías de la versión instalada de Next.js en `node_modules/next/dist/docs/`: `use-server.md` y `revalidatePath.md`, además de la implementación local de etiquetas implícitas de invalidación.

Las conclusiones SQL siguientes describen lo que impone el código local; no son resultados obtenidos de una base de datos.

## Hallazgos corregidos

### 1. Inclusión automática de pedidos reprogramados o excluidos al salir

**Relevancia alta.** `JornadaSalidaControl` construía la selección de salida incluyendo todo pedido `listo_despacho`, aunque su selección persistida fuera `incluido=false`. Una reprogramación de Fase 2 deja precisamente ese estado y esa exclusión. El atajo podía volver a incluirlo sin la decisión específica requerida; también reemplazaba exclusiones administrativas ordinarias.

Ahora conserva toda exclusión persistida y su motivo. Los pedidos excluidos no bloquean la salida por falta de preparación y no cuentan como pedidos que puedan salir. Se incluye un enlace al control de carga existente para cambiar explícitamente su inclusión. Los pedidos nuevos sin decisión mantienen el comportamiento previo del atajo. No se modifica el contrato de la RPC ni la barrera SQL de Fase 4.

### 2. Falta de descripción de «Otro» en reparto móvil

La pantalla permitía preparar un fallo «Otro» sin descripción; el servidor tampoco lo rechazaba antes de llamar a la RPC. PostgreSQL lo rechaza, de modo que no era una escritura inválida consumada, pero el usuario entraba en un reintento inútil con contenido congelado.

Se exige descripción antes de preparar la confirmación y en la acción de servidor. Se valida la lista cerrada de motivos, la fecha civil real y el rango seguro de versión. Se añadieron mensajes específicos para estado incompatible, jornada sin salida y régimen contable no admitido. La RPC conserva la autoridad final.

### 3. Actualización incompleta entre superficies operativas

Las entregas administrativas invalidaban principalmente Rutas; las operaciones de reparto no invalidaban las vistas administrativas/comerciales relacionadas. La resolución de no entregados dependía de la invalidación sin solicitar refresco explícito desde su componente.

Se amplió la invalidación tras entrega, diferencias, fallo y cierre a las superficies afectadas, incluyendo reparto. Las operaciones móviles invalidan las vistas operativas y contables relacionadas. La resolución administrativa refresca el cliente y sus vistas relacionadas. Una falla de invalidación posterior a una RPC confirmada ya no transforma esa resolución en una respuesta aparente de fallo. Se conservan las claves y los contenidos originales de reintento.

Esta invalidación afecta a las próximas lecturas/navegaciones de la sesión; no sincroniza pestañas ni otros dispositivos en tiempo real.

### 4. Recuperación y presentación en móvil

Ante error de lectura inicial, `/reparto` omitía el componente que contiene «Actualizar rutas». Ahora mantiene el control de actualización y distingue error de consulta de ausencia de jornadas. Se agregó una barrera sincrónica contra llamadas móviles superpuestas y ajuste de textos largos en tarjetas/confirmaciones.

La respuesta de cierre se vincula a la fecha solicitada, comprueba versión no negativa y se proyecta a los campos necesarios antes de devolverla al cliente. No se devuelve el snapshot financiero.

## Resultado del contraste de contratos y permisos

| Área | Conclusión estática y límites |
| --- | --- |
| Administrador | El layout comprueba sesión y rol persistido para URL directa. Las RPC sensibles vuelven a autorizar; la seguridad no depende de ocultar botones ni del layout. Gestión y resolución de no entregados tienen además comprobación administrativa en servidor. |
| Repartidor | `/reparto` exige sesión y `acceso_repartidor`. La lectura SQL limita fechas al usuario asignado, carga `en_ruta` y ruta principal correspondiente. El wrapper comprueba nuevamente permiso, fecha, identidad, versión de asignación y pertenencia del pedido incluido. Las RPC de entrega exigen además el estado operativo válido. |
| Aislamiento | Fase 5 no cambia `es_admin`, el enum de perfiles ni las políticas de lectura de clientes. Sus tablas están en esquema privado, sin ACL de API, con RLS y FORCE RLS. Las funciones elevadas pertenecen a postgres y usan `search_path=pg_catalog`. El bypass RLS del propietario es una precondición explícita de instalación. |
| Capacidad interna | Sólo el wrapper crea y consume la capacidad por transacción, actor, pedido y fecha. No procede de metadata, JWT ni GUC manipulable. Se elimina antes de retornar; un error revierte su creación. Invocar directamente las RPC administrativas como repartidor no crea esa capacidad. Los auxiliares privados siguen sin ejecución para roles API. |
| Datos permitidos | El lector móvil expone información logística de los pedidos de la jornada asignada, no importes ni historial financiero. El wrapper no recibe precios, cantidades editadas, clientes, pagos ni parches administrativos. Deriva los items de preparación y fija `por_pagar` con importes cero. Las diferencias quedan reservadas al administrador. |
| Revocación y reasignación | Operaciones móviles y cambios de permisos/asignación comparten advisory lock. Revocar/reactivar incrementa versiones de asignación; reasignar también. Una solicitud vieja no revive por volver a habilitar al usuario. Una operación ya iniciada puede terminar antes de que la revocación consiga el lock y confirme. |
| Concurrencia | Se reutiliza la barrera EXCLUSIVE sobre pedidos de Fase 2. Las operaciones móviles bloquean el cliente con NOWAIT antes de llamar a las RPC contables, evitando esperar circularmente a un administrador que ya retenga ese cliente. Líneas y planificación también tienen barreras NOWAIT. Esto puede producir rechazos reintentables bajo carga. |
| Idempotencia | Historiales guardan actor, clave, versión esperada y contenido exacto. Las RPC resuelven reintentos antes de exigir el estado nuevo. En reparto, una entrega repetida recupera los items originales del historial. Las comprobaciones actuales de permiso/asignación prevalecen sobre recuperar una respuesta antigua. |
| Cierre | Revisión y cierre usan versión de carga y huella del snapshot vigente, pedidos incluidos y evidencia de fallos/ventas. El cierre conserva snapshot e historial. Triggers protegen carga, selección, pedido, items, preparación, rutas y paradas. La reprogramación/cancelación administrativa usa una capacidad privada que sólo permite los cambios exactos previstos, sin reescribir el cierre original. |
| Reprogramación | Requiere fallo auditado, preparación finalizada, carga de origen cerrada, ausencia de venta y destino en preparación con fecha posterior válida. Traslada la selección vigente como excluida. El cierre anterior conserva el intento. Fase 4 impide crear/actualizar paradas de un reprogramado sin inclusión explícita. El atajo de salida ya respeta esa exclusión. |

## Coherencia contable

- Entrega completa y diferencias reutilizan las RPC de cinco argumentos con `p_cobro`. Se contrastaron los nombres enviados, el contenido de items/cobro y la respuesta `resultado` consumida por frontend/servidor.
- Para `entrega_v1`, la entrega persiste una venta definitiva única y su snapshot, cambia a `entregado` y exige registro contable en la misma transacción. Los importes completos proceden de preparación confirmada; las diferencias usan las reglas autorizadas existentes. No se implementó cálculo alternativo en reparto.
- La cuenta corriente reconoce la venta desde el snapshot; los pagos son abonos y las aplicaciones distribuyen esos pagos, sin generar un segundo abono. Se descuentan aplicaciones previas confirmadas; si superan la venta, la operación aborta. El excedente recibido queda como crédito según el contrato existente.
- Reparto envía siempre cero efectivo y cero transferencia. Puede reconocer la venta y su deuda conforme al contrato actual; no crea un pago de importe cero ni registra cobros.
- El fallo registra motivo, observaciones e historial, sin venta definitiva, pagos ni deuda nueva. En régimen legado conserva los cargos históricos existentes; no significa saldo cero.
- El cierre no cobra ni cambia estados individuales. Reprogramar no escribe pagos, aplicaciones ni ajustes. Cancelar no entregado sólo admite `entrega_v1` sin venta definitiva, exige constancia de tratamiento administrativo y conserva los registros previos; el legado queda bloqueado para evitar retirar cargos de vistas históricas.
- No se cambiaron fórmulas contables, precios, abonos ni pagos históricos en esta fase.

## Compatibilidad de Fases 2–5

La instalación de Fase 5 cambia únicamente el guard administrativo de seis funciones: confirmar entrega completa, registrar fallo, iniciar operación, revisar cierre, cerrar ruta y leer carga. Conserva el OID y el resto de cada implementación. Se siguieron sus llamadas anidadas, incluyendo `completar_operacion` → `iniciar_operacion` y cierre → revisión/lector de carga.

Las huellas MD5 de Fase 4 son precondiciones de su instalación inicial sobre Fases 2–3, no un diagnóstico continuo que deba repetirse después de Fase 5. No se exige que las funciones legítimamente adaptadas conserven un hash anterior, ni se propone reinstalar Fases 2–4 encima de Fase 5. El diagnóstico de entrega utilizado por la aplicación verifica estructura y no usa esos hashes.

No se encontró una incompatibilidad demostrable entre esos contratos locales que requiera sustituir funciones instaladas. El resultado `Success` comunicado por el usuario no permite comprobar deriva posterior, ACL efectivas, triggers remotos o instalaciones con cuerpos distintos.

## Archivos modificados en esta fase

1. `src/components/admin/jornada-salida-control.tsx`
2. `src/app/reparto/actions.ts`
3. `src/app/reparto/reparto-movil.tsx`
4. `src/app/reparto/page.tsx`
5. `src/components/admin/undelivered-order-actions.tsx`
6. `src/app/(admin)/admin/pedidos/no-entregados-actions.ts`
7. `src/app/(admin)/admin/rutas/entrega-actions.ts`
8. `src/app/(admin)/admin/rutas/diferencias-actions.ts`
9. `src/app/(admin)/admin/rutas/fallida-actions.ts`
10. `src/app/(admin)/admin/rutas/cierre-actions.ts`
11. `supabase/manual/fase6_revision_final.md` (este informe).

El workspace ya contenía modificaciones y archivos sin seguimiento de las fases anteriores. Se conservaron; la lista anterior identifica los archivos intervenidos por esta fase, no la totalidad del diff contra HEAD.

## SQL manual requerido

**Ninguno adicional.** No se creó `fase6_correcciones.sql` porque las correcciones identificadas son de frontend/servidor y consumen los contratos existentes. No se editaron los SQL manuales instalados ni migraciones históricas. No hay SQL de Fase 6 para ejecutar.

## Riesgos y límites pendientes

- Sin tests, build, ESLint, comprobación de tipos, navegador ni ejecución SQL: no hay evidencia de compilación, interacción táctil, red real, concurrencia real, rollback o aplicación efectiva de RLS/ACL en el servidor remoto. Se revisaron implementaciones y contratos, no resultados de ejecución.
- Un repartidor por jornada completa; cierre global por fecha. No admite dividir una misma jornada entre repartidores.
- Pedidos legados y diferencias no se confirman desde reparto. Un pedido incompatible puede requerir gestión administrativa antes de resolver la ruta. La cancelación de legado se bloquea deliberadamente para preservar cargos históricos.
- La ruta visual administrativa trabaja con pedidos de la fecha; no constituye por sí misma evidencia de inclusión en carga. El cierre y reparto consumen exclusivamente la selección persistida. Guardar orden con un reprogramado excluido puede ser rechazado por la barrera de Fase 4 hasta decidir su inclusión.
- No hay cola offline ni persistencia de claves después de cerrar/recargar la página. Las respuestas inciertas conservan la solicitud mientras el componente siga montado; al abandonarla debe consultarse el estado vigente. No hay sincronización automática entre sesiones.
- Revocar acceso no borra información ya renderizada en otra pestaña; nuevas lecturas y mutaciones vuelven a autorizar. Los derechos comerciales propios de una cuenta cliente siguen existiendo sin conferir acceso a clientes ajenos.
- Los locks globales pueden limitar concurrencia y las barreras NOWAIT pueden rechazar operaciones en competencia; los mensajes permiten reintentar o consultar estado, sin prometer que la primera solicitud falló definitivamente.

No se ejecutaron tests, builds, ESLint, SQL remoto, migraciones, comandos Supabase, git commit ni git push. No se solicitó otra auditoría ni confirmaciones intermedias. Este documento es el único informe final de Fase 6.
