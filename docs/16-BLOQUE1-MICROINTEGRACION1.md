# Hidro Leufú — Bloque 1, microintegración 1/8

Fecha: 2026-11-06. Estado: infraestructura local implementada, sin aplicar SQL.
El reconocimiento contable al entregar permanece **inactivo**. Este documento
rige exclusivamente el contrato incremental solicitado; no redefine otros bloques.

## Inspección y fuentes vigentes

Se inspeccionaron README, Constitución, reglas, base de datos, RPCs, documentación
de posibles pedidos, totales administrativos y activación administrativa. README
y documentos 00/02/05/06 contienen antecedentes mock/preliminares que no describen
el SQL actual. Para esta intervención se sigue el alcance explícito solicitado y
las definiciones locales vigentes; no se comprobó el esquema remoto.

Las tres entradas oficiales auditadas son:

| Vía | Consumidor | Definición SQL vigente antes de esta incremental |
| --- | --- | --- |
| Checkout público autenticado | `src/app/(public)/checkout/actions.ts`, `crearPedidoCheckout` | `20261101030000`, `crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date,text[])` |
| Conversión de posible pedido | `src/lib/posibles-pedidos/admin-contrato.ts`, acción `convertir` | `20261022012000`, `convertir_posible_pedido_administrativo(uuid,bigint,uuid,uuid,date,text[])` |
| Creación administrativa | `src/app/(admin)/admin/pedidos/nuevo/actions.ts`, `confirmarPedidoAdministrativo` | `20261105030000`, `crear_pedido_administrativo(uuid,jsonb)` |

También se inspeccionaron el núcleo `20260810041535`, cuenta corriente
`20260811120000`, ciclo `20260814100000`, base de preparación `20260817100000`,
cierre/vistas `20260817113000` y las migraciones posteriores de permisos,
cancelaciones, métodos previstos y beneficios. La firma antigua del checkout
se retira en `20260827111000`; no se vuelve a introducir una sobrecarga.

## Contrato de importes

Todos los importes son pesos CLP enteros. No se inventan IVA ni prorrateos.

| Concepto | Fuente y significado |
| --- | --- |
| Importe previsto | `pedidos.subtotal`, `costo_entrega`, `descuento`, `total`, más `items_pedido.cantidad`, snapshots unitarios y `total_linea`. Es la solicitud valorizada, incluidos los totales administrativos autorizados. No acredita entrega. En una intención aún no convertida son los campos `*_estimado` de posibles pedidos; todavía no existe pedido oficial. |
| Importe operativo provisional | `pedidos.importe_operativo`, generado como `coalesce(total_final,total)`. Antes del cierre usa el previsto; después usa el total calculado por preparación vigente. `subtotal_final` y `total_final` mantienen sus nombres históricos pero expresan cierre de preparación, no venta definitiva por entrega. |
| Venta definitiva | Futuro `venta_definitiva_snapshot` y `venta_reconocida_en`. Ambos quedan NULL por restricción explícita de esta fase, incluso en pedidos que hoy lleguen a entregado. No se fabrican snapshots históricos ni se deducen entregas a partir de cantidades preparadas. |

La columna generada evita dos fuentes editables para el importe operativo: se
conserva automáticamente con los cálculos actuales, sin modificar ninguna RPC de
preparación. No genera cargos ni escribe otros campos. No representa un segundo
importe a sumar al total. Los ceros son importes válidos; NULL en los campos de
venta significa ausencia de reconocimiento, no una venta por cero.

El futuro snapshot deberá tener versión, moneda CLP, identidad del pedido y de
cada línea, nombres/presentaciones/unidades capturados, cantidades efectivamente
entregadas, referencias de precio y totales exactos autorizados por línea,
subtotal, despacho, descuento, total, actor y evidencia de entrega. Debe cumplir
suma de líneas = subtotal y total = subtotal + despacho - descuento, admitir cero
y preservar motivos de ajustes. Su validación, unicidad del reconocimiento e
inmutabilidad se implementarán antes de habilitar su escritura. JSONB queda
reservado: esta fase no ofrece una RPC que lo escriba ni acepta JSON arbitrario.

## Estados y cantidades

Se conservan los estados reales del enum: `recibido`, `en_revision`, `confirmado`,
`programado`, `preparando`, `listo_despacho`, `en_reparto`, `entregado`,
`entrega_fallida`, `cancelado`. No se añaden ni reinterpretan transiciones.
Creación oficial inicia en `recibido`. El flujo actual permite confirmar,
preparar, cerrar preparación, repartir y marcar entrega. Un estado operativo
por sí solo no prueba cantidades reales de despacho o entrega.

| Cantidad | Contrato |
| --- | --- |
| Solicitada | `items_pedido.cantidad`, positiva; snapshot de solicitud, no se reemplaza por la preparada. |
| Preparada | `preparacion_items_pedido.cantidad_preparada`, admite cero y faltantes; cierre actual usa solicitada si no hay registro. Ese fallback operativo no prueba una entrega. |
| Despachada | Dimensión distinta; no existe registro independiente por línea en el esquema inspeccionado. `en_reparto` no equivale a cantidad despachada. Persistencia explícita pendiente, sin inferencias ni backfill en esta fase. |
| Entregada | Dimensión distinta; marcar `entregado` hoy no captura cantidades independientes por línea. Su registro explícito y snapshot definitivo quedan pendientes. Cero, entrega parcial, fallida y reintentos requieren reglas transaccionales antes de activar reconocimiento. |

La futura captura deberá distinguir ausencia de dato de cero y validar cantidades
no negativas y coherencia entre solicitado, preparado, despachado y entregado.
No se autoriza sobreentrega ni se fija aquí una política de sustituciones o
entregas múltiples. Los kilos fraccionables y formatos cerrados conservan las
validaciones actuales. Una línea administrativa ajustada con preparación parcial
sigue rechazando el cierre con `TOTAL_ADMINISTRATIVO_REQUIERE_PREPARACION_COMPLETA`;
no se autoriza repartir proporcionalmente un total arbitrario.

## Deuda y anticipos: objetivo y transición

Contrato objetivo de `entrega_v1`: la deuda por venta nace una única vez al
confirmar la entrega efectiva y congelar el snapshot definitivo, en la misma
transacción. Crear, confirmar, preparar o despachar no debe reconocer venta en
ese régimen una vez activado. `fecha_entrega` es programación; no es el instante
de reconocimiento. Una entrega fallida no acredita venta. Las entregas parciales
requieren decidir alcance de cierre y cargos de despacho antes de habilitarlas.

Un pago anticipado confirmado representa fondos recibidos del cliente, no venta
ni prueba de entrega. Debe conservarse una sola vez como crédito/anticipo hasta
su aplicación a deuda reconocida; el exceso queda disponible, sin inventar venta
para absorberlo. Los métodos de pago previstos son intención, no pagos recibidos.
Cancelar o fallar una entrega no borra pagos: devolución, anulación y aplicación
requieren sus operaciones auditadas. No se crean pagos ni aplicaciones al crear
pedidos.

**Comportamiento efectivo durante 1/8:** las vistas siguen reconociendo el cargo
desde la creación del pedido no cancelado, por `coalesce(total_final,total)`, con
fecha de creación; los pagos confirmados y aplicaciones conservan sus reglas
actuales. Esto ocurre también para filas marcadas `entrega_v1` durante la
transición. El marcador identifica la cohorte futura y no funciona como switch.
Esta fase no promete deuda cero antes de entrega ni convierte aplicaciones ya
existentes en reservas de anticipos. La fase posterior deberá reconciliar esa
cohorte transitoria sin duplicar cargos, pagos o aplicaciones, incluso si algunos
pedidos ya se entregaron antes de activar el nuevo comportamiento.

## Migración y compatibilidad

Nueva migración: `20261106010000_preparar_regimen_contable_entrega.sql`.
Se ejecutará después de todas sus predecesoras, incluida `20261105030000`.

- `regimen_contable text NOT NULL DEFAULT 'legado'`, limitado a `legado` y
  `entrega_v1`. El default constante conserva todas las filas existentes como
  legado sin UPDATE de datos de negocio ni disparar historial/fechas de fila.
- El default permanece legado para vías ajenas a las tres oficiales. Cada RPC
  oficial escribe explícitamente `entrega_v1` en su INSERT de un pedido nuevo.
  Una intención histórica convertida por primera vez después de la migración
  produce un pedido nuevo `entrega_v1`; un pedido ya convertido conserva legado.
- Un trigger impide cambiar el régimen después del INSERT, también mediante
  DML administrativo. No se reclasifica por fecha, estado ni por reintento.
- `importe_operativo bigint GENERATED ALWAYS ... STORED` expone el importe
  provisional vigente. No puede ser escrito manualmente. Los campos de venta
  NULL están protegidos por `pedidos_venta_definitiva_inactiva`; activarlos exige
  otra migración con controles completos.
- No hay UPDATE/DELETE económico ni de fechas históricas. Permanecen importes,
  saldos, pagos, aplicaciones, estados, fechas y snapshots anteriores. No se
  reemplazan vistas ni funciones de preparación, despacho, entrega o beneficios.
- Solo se reemplazan las tres RPCs de creación, copiando sus cuerpos vigentes
  salvo la columna y valor de régimen en el INSERT. `CREATE OR REPLACE` conserva
  firmas, tipo de retorno, propietario y ACL existentes; no se recrean funciones
  ni se otorgan permisos. Se mantienen SECURITY DEFINER, search_path,
  validaciones, locks, límites, auditoría, efectos e idempotencia anteriores.
- Checkout conserva clave única y `ON CONFLICT ... DO NOTHING`, recuperación
  posterior al conflicto y retorno de la fila existente. Conversión conserva
  bloqueo de intención y recuperación del pedido convertido. Administración
  conserva advisory lock, huella, actor, solicitud y comprobante original antes
  de revalidar catálogo/fecha. Ningún retorno de reintento cambia el régimen.
- Los consumidores TypeScript no cambian: argumentos y respuestas siguen siendo
  los mismos, sin un parámetro que permita al navegador elegir régimen.

## Verificación, riesgos y fase 2

Revisión exclusivamente estática de fuentes y diferencias de las RPCs. No se
aplicó SQL local ni remoto, ni se ejecutaron tests, lint, tsc, builds, Docker o
servidores. No hubo commit ni push. Se conservaron los cambios preexistentes del
workspace. La implementación no acredita validación de ejecución PostgreSQL.

Riesgos: la columna generada STORED puede reescribir físicamente la tabla y el
ALTER requiere bloqueo; planificar ventana y tamaño antes de aplicar. Aunque no
hay UPDATE lógico ni cambios económicos, existe costo de DDL. Los CHECK y la
columna generada requieren comprobar compatibilidad con la versión real de
PostgreSQL. La nueva columna amplía SELECT * de tabla y %rowtype; las respuestas
explícitas de estas RPCs no se amplían. Divergencias remotas de las tres funciones
deben reconciliarse antes de reemplazarlas: la auditoría fue local. No existe
reconocimiento nuevo activo ni snapshot definitivo utilizable todavía.

Pendientes de fase 2 y siguientes, sin implementarlos aquí:

1. Validar en entorno autorizado migración, permisos, filas históricas sin
   diferencias económicas y reintentos históricos/nuevos/concurrentes de las
   tres vías. Comprobar fallos atómicos y bloqueo de reclasificación/snapshot.
2. Definir y persistir cantidades despachadas/entregadas, faltantes, parciales,
   entrega fallida, devoluciones y política para totales administrativos parciales.
3. Implementar escritura transaccional, validación e inmutabilidad del snapshot,
   actor e instante real, con reconocimiento único y recuperación idempotente.
4. Sustituir la barrera de inactividad solo junto a esos controles; diseñar el
   corte de activación y reconciliar pedidos entrega_v1 creados en la transición.
   Nunca migrar automáticamente los pedidos legado al régimen nuevo.
5. Adaptar en su fase autorizada saldos/movimientos y anticipos/aplicaciones para
   reconocer deuda al entregar, conservando el régimen legado íntegro y evitando
   dobles cargos o doble descuento de pagos. Revisar consumidores y beneficios
   únicamente cuando corresponda a su fase.

Archivos creados en esta intervención: esta documentación y la migración citada.
No se modificaron migraciones históricas, interfaz ni archivos de aplicación.
