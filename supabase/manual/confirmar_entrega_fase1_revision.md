# Confirmar entrega: revisión estática fase 1

No se ejecutaron SQL, migraciones, comandos Supabase, tests, builds ni ESLint.

## Despliegue manual pendiente

La aplicación requiere `verificar_contrato_confirmar_entrega.sql` de esta carpeta.
Hasta instalar esta función, la confirmación queda deshabilitada con explicación.
La función solo consulta catálogos tras verificar `es_admin`; no cambia pedidos,
saldos, ventas, cobros ni funciones de confirmación existentes.

No se conoce el estado de producción. Revisar primero las migraciones
20261108130000, 20261108140000 y 20261108150000 y sus dependencias. No aplicarlas
ciegamente ni volver a ejecutarlas si ya existen: contienen creación de tablas,
constraints y retirada de la firma antigua. Si el diagnóstico devuelve false,
resolver la instalación incompleta antes de habilitar la UI. La presencia de
firmas y barreras no certifica cuerpos SQL modificados fuera del repositorio.

## Contratos y garantías conservadas

Ambas llamadas usan `p_pedido_id`, `p_version_esperada`, `p_clave`, `p_items`
y `p_cobro`. No hay fallback de cuatro argumentos. Se conserva el orden de items,
la clave, versión y cobro en reintentos. Las confirmaciones delegan directamente
en la RPC sin comprobar antes la versión/estado actual, de modo que
`iniciar_operacion` pueda devolver un resultado idempotente ya confirmado.
No se modificaron locks, historial, tablas ni constraints de cobro único.

## Reconocimiento contable: evidencia y límite

En 20261108130000, `pedidos_venta_definitiva_pareada` exige que un snapshot y
reconocimiento no nulos correspondan a entrega_v1 y estado entregado.
`proteger_venta_definitiva` exige además la entrega privada persistida.
20261108140000 y 20261108150000 escriben estado, snapshot y reconocimiento juntos,
y completan cobro e historial dentro de la misma transacción. Las claves primarias
de entregas y cobros son por pedido y pagos_entrega es único por pedido/método.
Las vistas `v_saldos_pedidos` y `v_movimientos_cuenta_cliente` de 20261108140000
excluyen entrega_v1 sin venta_reconocida_en; la revisión posterior de saldos en
20261108170000 conserva ese filtro. Las vistas previas a la integración contable
no ofrecen esa garantía: 20261106010000 explícitamente no activa otra contabilidad.

Por tanto, el SQL revisado con la integración instalada impide que un pedido
no entregado bajo entrega_v1 origine reconocimiento o el cargo derivado de su
venta. Las vistas previas de esta UI solo leen; no registran venta, cargo ni pago.
Esto no certifica producción sin revisar su esquema. No se alteraron ajustes
manuales ajenos a esta entrega ni saldos históricos para corregir esa incertidumbre.
