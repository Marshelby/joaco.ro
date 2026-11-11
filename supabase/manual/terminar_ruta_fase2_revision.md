# Informe FINAL — terminar ruta, Fase 2

Fecha: 2026-11-11. Dictamen: **APTO para instalación manual inicial**, respecto de los contratos locales revisados y con las precondiciones que el propio archivo exige. Es un dictamen estático: no certifica una base remota ni una ejecución en PostgreSQL.

SQL entregado: [terminar_ruta_fase2.sql](terminar_ruta_fase2.sql).

Se modificaron únicamente ese SQL y este informe. No se ejecutaron tests, builds, ESLint, SQL, migraciones, comandos Supabase, commit ni push. No se modificaron migraciones históricas ni módulos de aplicación. Los cambios preexistentes del workspace permanecen ajenos a esta intervención.

## Dependencias reales contrastadas

Se rastrearon las definiciones y sus sustituciones posteriores, no sólo las primeras apariciones:

| Contrato | Fuentes locales determinantes | Resultado |
| --- | --- | --- |
| Pedidos, ítems, estados, actualización automática e historial de estados | `20260810041535`, hardening `20260810042236`, ciclo `20260814100000` | UUID de pedido/ítem; estado enum; registro AFTER de transición; fecha de actualización automática. |
| Preparación y coherencia de padres | `20260817100000`, `20260817111500`, `20260817112000`, finalización `20260817113000` | **`preparacion_items_pedido` sí tiene `pedido_id uuid NOT NULL`**, FK directa a pedidos; también `item_pedido_id uuid NOT NULL UNIQUE`, FK a ítems. El trigger valida que ambos padres coincidan. No existe retirada posterior de `pedido_id` en las fuentes. |
| Preparación vigente, importes y acceso | `20261105030000`, `20261106040000`, `20261106050000`, `20261107130000` | Confirmación explícita, importe operativo bigint, cantidad numeric; DML directo retirado; preparación limitada a la jornada. |
| Infraestructura de auditoría | `20261106030000` | Versiones por pedido; historial privado inmutable; auxiliares SECURITY INVOKER; clave única por pedido y versión esperada. |
| Cargas y asignación | `20261106060000` | Fecha PK de carga; **pedido_id es la PK de carga_pedidos**; historial por fecha/versión y fecha/clave; EXCLUSIVE antes de advisory y filas. |
| Venta y barrera de carga | `20261106010000`, `20261108130000`, `20261108140000` | Régimen inmutable; snapshot pareado; entrega definitiva privada; barrera vigente de carga sólo para lista/en_ruta. |
| Entregas vigentes | `20261108140000`, `20261108150000`, `20261108160000` | Éxito de cinco argumentos; cliente → pedido → versión/líneas; fallo auditado antes del UPDATE; sin venta por fallo. |
| Contabilidad y correcciones | `20261108170000`, `20261108180000`, `20261108190000`, `20261108200000` | Corrección de venta mediante evidencia/ajustes; pagos centralizados; versión operativa también avanza por operaciones contables. |
| Rutas y planificación | `20260907040910`, `20260907040959`, correcciones `20260907120822`/`20260907120938`, `20261107120000` | Fecha operativa en rutas; ruta_id en paradas; firma/defaults de orden_ruta_dia; lectura toma fila de ruta; escritura toma FOR SHARE de pedidos. |
| Dependencias posteriores | `20261108120000`, `20261109100000` y referencias de consumidores locales | Fecha_entrega sigue siendo date; producción no sustituye estos contratos. Los consumidores de cierre reciben las mismas claves y tipos de respuesta. |

## Hallazgos y correcciones de esta pasada

1. **Preflight insuficiente.** La existencia de unas firmas no acreditaba columnas, tipos, claves, triggers activos o aislamiento. Se añadieron verificaciones de columnas/tipos utilizados, estados enum, claves únicas inmediatas con índices válidos, propietario/retorno/volatilidad/SECURITY DEFINER de las RPC y auxiliares principales, triggers críticos activos, RLS/FORCE RLS y privilegios efectivos. El script aborta ante una instalación previa/parcial identificada, configuración de replicación inapropiada o aislamiento incompatible. No adapta silenciosamente un esquema distinto.

2. **Resolución del padre de preparación.** El acceso inicial a OLD/NEW.pedido_id era válido para el esquema real; no se eliminó esa columna ni se inventó un join obligatorio por ausencia. Se reforzó el trigger para proteger también el padre real de item_pedido_id, tanto OLD como NEW. Una comprobación previa al DDL rechaza preparación incoherente ya existente.

3. **Reasignación de un ítem con preparación.** El trigger histórico de coherencia corre sobre preparación, no cuando cambia items_pedido.pedido_id. Se impide trasladar un ítem dejando su preparación asociada a otro pedido. La comprobación ocurre después de bloquear los padres, para cubrir una inserción concurrente de preparación entre la lectura y el bloqueo.

4. **Inversión hija → padre.** Un UPDATE/DELETE de línea puede retener ya la fila hija antes de ejecutar su BEFORE. Esperar al pedido podía formar un ciclo con una entrega que retuviera el pedido y necesitara esa línea. El bloqueo de padres pasa a `FOR UPDATE NOWAIT`, en orden UUID. Ante conflicto se aborta con 55P03 y se revierte la operación completa. No se debilita la barrera EXCLUSIVE del cierre.

5. **Snapshots antiguos en triggers.** Comprobar READ COMMITTED únicamente en las nuevas RPC dejaba abiertas otras RPC/escrituras bajo REPEATABLE READ que podían consultar un cierre invisible en su snapshot. Las cuatro barreras de cierre —cargas/selección, pedidos, líneas y planificación— exigen también READ COMMITTED. Esto alcanza a escritores legacy que entren por esas tablas.

6. **Huella incompleta.** El snapshot de cierre sólo incluía pedido, versión y motivo. Una modificación de líneas/preparación sin cambio de esos datos podía no invalidar la revisión. Ahora incluye también selección, ítems completos, preparación completa y evento de fallo completo, con agregados ordenados. La huella cubre los pedidos incluidos, que constituyen el intento que se cierra.

7. **Configuración de sesión en evidencia y capacidades.** `to_jsonb(timestamptz)` y las conversiones de fechas a texto podían variar con TimeZone/DateStyle, causando conflictos falsos de huella o trazabilidad. Las funciones nuevas o redefinidas fijan UTC y formato ISO. Las reglas de día operativo continúan usando explícitamente America/Santiago.

8. **Motivo de un intento fallido anterior mostrado en una entrega posterior.** La búsqueda del último fallo era incondicional. El snapshot sólo incorpora motivo/evento de fallo cuando el estado actual es entrega_fallida. Una entrega exitosa tras reprogramación conserva el fallo anterior en su historial, sin presentarlo como motivo de su nuevo cierre.

9. **Cierre de terminales inconsistentes.** Se añadió comprobación de fecha del pedido frente a la carga. Un fallo debe tener evento auditado en_reparto → entrega_fallida, versión no posterior a la capturada y ninguna venta/snapshot definitivo. Una entrega de régimen entrega_v1 debe corresponder al snapshot e instante de su entrega definitiva privada. No se crea una venta de importe cero ni se reconstruye contabilidad para legitimar datos inconsistentes.

10. **Versión histórica confundida con versión actual.** La reprogramación exigía igualdad entre versión congelada y versión esperada actual, aunque operaciones contables pueden avanzar ésta sin alterar el pedido. Ahora iniciar_operacion sigue exigiendo la versión actual exacta y la versión del cierre debe ser menor o igual. El fallo debe preceder o coincidir con la versión capturada en el cierre. Se mantienen coincidencias exactas del pedido, selección y evento de fallo con la evidencia congelada.

11. **TRUNCATE omitía los triggers de fila.** Se incorporó una barrera BEFORE TRUNCATE a pedidos, ítems, preparación, rutas, paradas, cargas y selección. Rechaza también operaciones con CASCADE que alcancen esas tablas. Los historiales y las entregas definitivas conservan sus propias barreras históricas de truncado.

12. **ACL/owner implícitos del lector reemplazado.** El lector conserva su interfaz, pero ahora fija explícitamente propietario postgres, revoca EXECUTE de PUBLIC/anon/authenticated/service_role y concede únicamente a authenticated. La autorización de administrador sigue dentro de la función. Las funciones privadas continúan sin acceso API.

13. **search_path heredado de la implementación trasladada.** Al mover orden_ruta_dia al esquema privado se conservaba su search_path public. Se fija pg_catalog, compatible con sus referencias explícitas a public. El wrapper conserva firma, defaults, autorización y lectura; también rechaza fechas nulas o infinitas.

14. **Instalación podía esperar con locks DDL parciales.** Antes del DDL se adquieren ACCESS EXCLUSIVE NOWAIT sobre las tablas afectadas. Una base ocupada provoca aborto transaccional en vez de una espera circular de instalación con escritores activos. Esto exige una ventana breve sin consultas incompatibles, incluidas lecturas.

15. **Dictamen previo demasiado acotado.** Se sustituyó el informe centrado en un deadlock por este informe integral. La cabecera del SQL remite al informe y evita presentar una validación estática como ejecución satisfactoria o certificación remota.

## Protecciones y funcionalidades conservadas

- Revisión y cierre requieren administrador autenticado, carga en_ruta y salida registrada. El cierre exige carga no vacía y todos sus incluidos terminales. Se comparan versión y huella antes de mutar.
- El cierre incrementa exactamente una versión de carga y persiste un único evento. La misma clave/actor/solicitud devuelve el resultado original antes de reevaluar estado/versiones; reutilización incompatible se rechaza. No se convierte la instalación de una sola aplicación en un script de reinstalación.
- La carga cerrada y su selección quedan protegidas, al igual que pedidos incluidos, líneas, preparación y rutas/paradas de esa fecha. Se comprueban ambos lados de los traslados. El único bypass de reprogramación es una capacidad privada con tabla, transacción, actor y OLD/NEW exactos; no una GUC falsificable.
- La capacidad omite sólo fecha_actualizacion y columnas generadas al comparar pedidos. Sus fuentes siguen comparadas. Se elimina dentro de la misma transacción, antes del retorno. Un error revierte capacidad, pedido, selección, versiones e historiales.
- El lector STABLE usa un snapshot común para decidir entre jornada viva y cerrada. Una cerrada se obtiene de pedidos_carga congelados, no de las asignaciones actuales. Los intentos completos quedan también en resumen_cierre e historial_cargas.
- La reprogramación sólo admite fallo incluido en carga cerrada, preparación finalizada, sin venta reconocida ni entrega definitiva. Cambia únicamente fecha y estado a listo_despacho; conserva preparación, precios, importes, régimen y dinero.
- La fecha destino debe ser posterior al origen y no pasada en America/Santiago; se vuelve a comprobar el día antes de retornar. No se introducen cortes comerciales o límites de compra nuevos en esta excepción administrativa.
- El destino debe estar en preparación. Se materializa tras advisory de ambas fechas en orden y se bloquean ambas filas por fecha. La selección se traslada como excluida, pendiente de decisión explícita. No se cambia la PK por pedido ni se pierde la evidencia del intento anterior.
- El origen cerrado no cambia de versión ni recibe eventos nuevos. Destino y pedido reciben sus incrementos/eventos correspondientes. El historial enlaza fallo, cierre original, clave operativa, versión y selección antes/después.
- Se mantiene la excepción exacta en proteger_entrega_fallida, sin retirar sus validaciones normales. proteger_pedido_cargado vigente no restringe cerrada; proteger_venta_definitiva admite el traslado con ambos campos de venta nulos; el régimen no cambia. El AFTER histórico registra entrega_fallida → listo_despacho. No se dispara un nuevo beneficio por entrega.
- Las operaciones contables auditadas que sólo escriben evidencia, ajustes o pagos siguen funcionando tras el cierre; no necesitan reescribir pedidos/líneas. La versión de ese pedido puede avanzar, mientras el cierre conserva la foto del momento original. Las cancelaciones o ediciones que necesiten mutar un pedido cerrado son rechazadas y revierten sus efectos previos.

## Concurrencia y límites operativos

Se conserva el protocolo de cargas existente: EXCLUSIVE sobre pedidos antes de advisory/filas. Revisión, cierre y reprogramación no toman locks de cliente ni de dinero, evitando añadir una inversión frente a entregas/cobros que toman cliente antes de pedido.

La planificación de escritura conserva EXCLUSIVE NOWAIT tanto en wrapper como en triggers de rutas/paradas. Si una entrega tiene ROW SHARE/ROW EXCLUSIVE, planificación aborta antes de esperar por sus pedidos. Si planificación obtiene EXCLUSIVE primero, la entrega espera antes de bloquear pedidos. Las otras RPC de planificación quedan cubiertas por los triggers aunque retengan ya rutas/paradas. La lectura de orden mantiene su comportamiento sin barrera global de pedidos.

Las líneas intentan bloquear sus padres con NOWAIT. El cierre no necesita bloquear las filas hijas: usa lecturas de snapshot; una escritura de línea que llegue después debe superar luego la comprobación de carga cerrada bajo READ COMMITTED. Los locks sobre padres que ya posea una misma transacción no se contradicen con los de sus propios triggers.

**Riesgos residuales y alcance del dictamen:**

1. Las barreras de tabla son globales y serializan trabajo entre jornadas. Hay esperas y abortos 55P03 esperables. El consumidor debe reintentar la transacción completa con la misma solicitud/clave; este SQL no añade reintentos a la UI.
2. No se promete ausencia de deadlocks entre flujos legacy ajenos entre sí o composiciones arbitrarias de varias RPC en una transacción externa. Las escrituras alcanzadas por estas barreras requieren READ COMMITTED.
3. No se ejecutó parser ni motor PostgreSQL, pruebas de concurrencia o instalación. El preflight verifica contratos estructurales y permisos relevantes, pero no compara íntegramente el cuerpo de cada función remota con el repositorio ni detecta toda extensión o trigger adicional que pudiera existir allí.
4. El script es de instalación inicial completa, con rollback ante errores, no de actualización/reparación de una Fase 2 ya instalada. No hace backfill de evidencia ni modifica datos incoherentes preexistentes para forzar su aceptación.
5. La instalación requiere postgres con SUPERUSER o BYPASSRLS. Ser propietario o SECURITY DEFINER no basta para las tablas FORCE RLS heredadas sin policies. El preflight rechaza privilegios API incompatibles, incluida escritura heredada por roles/columnas; no intenta reparar permisos globales ajenos.
6. Superusuarios, propietarios que alteren o deshabiliten las barreras, DDL concurrente administrativo o configuraciones de replicación que omitan triggers quedan fuera del modelo de autorización de negocio.
7. La evidencia completa aumenta almacenamiento, coste de agregación y tamaño del historial/JSON. No se añadieron índices o particiones sin evidencia de necesidad. Las huellas normalizan sesión y orden; no son una firma criptográfica contra un administrador de base privilegiado.
8. carga_pedidos sigue siendo asignación vigente, no una tabla relacional de intentos. Los intentos anteriores están en snapshots/historial. No se añade preparación independiente por visita, devolución de inventario, interfaz de reprogramación ni una segunda salida de una jornada cerrada.
9. El cierre corresponde exclusivamente a los pedidos incluidos. Excluidos o pedidos nuevos de esa fecha no se incorporan retroactivamente al cierre. Su programación posterior sigue dependiendo de los circuitos existentes.

## Instalación manual prevista

Ejecutar únicamente el archivo SQL completo, una sola vez, como postgres con bypass RLS, bajo READ COMMITTED y session_replication_role=origin, en una ventana sin actividad incompatible. El propio BEGIN/COMMIT y las excepciones mantienen atomicidad; no ejecutar fragmentos para saltarse un preflight fallido. Ante 55P03 de instalación, deshacer la transacción antes de volver a intentar el archivo completo. Ninguna instalación se realizó en esta sesión.

**Conclusión FINAL: APTO para instalación manual inicial, con el alcance estático y las precondiciones anteriores.**
