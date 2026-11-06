# Bloque 1 — Microintegración 3/8: seguridad y auditoría operativa

Implementación local del 2026-11-06, sin aplicar SQL. Migración nueva:
`supabase/migrations/20261106030000_seguridad_auditoria_operativa.sql`.
Requiere el orden local completo, incluida la pendiente `20261106010000`.

## Alcance y objetos

Se crea el esquema `operativo_privado`, propiedad de postgres, con:

| Objeto | Propósito |
| --- | --- |
| `historial_operativo` | UUID, pedido, ítem opcional, operación, actor, motivo obligatorio, objetos JSONB anteriores/nuevos, versión, fecha real del servidor; además clave, versión esperada, solicitud y respuesta originales para idempotencia. |
| `versiones_pedido` | Contador bigint por pedido, inicializado perezosamente en cero. Sin backfill. |
| `iniciar_operacion(uuid,bigint,uuid,text,jsonb)` | Exige sesión administrativa, bloquea pedido, resuelve reintento exacto y valida versión bajo lock. |
| `completar_operacion(uuid,bigint,uuid,text,jsonb,uuid,text,jsonb,jsonb,jsonb)` | Revalida, comprueba pertenencia del ítem, incrementa versión y añade evento/respuesta en la transacción llamante. |
| `impedir_mutacion_historial()` y dos triggers | Rechazan UPDATE/DELETE por fila y TRUNCATE por sentencia. |

La unicidad `(pedido_id, version)` impide versiones duplicadas; la unicidad
`(pedido_id, clave_idempotencia)` impide duplicar una operación. La comparación
exacta de JSONB evita depender de una función hash o extensión criptográfica.
Una misma clave con otro actor, operación, versión esperada o solicitud falla.
Un reintento exacto retorna la respuesta original aunque el pedido haya avanzado.
Claves iguales en pedidos distintos son independientes.

Los identificadores históricos no tienen FK a tablas mutables: borrar usuarios,
ítems o pedidos no reescribe eventos ni introduce una nueva restricción sobre
flujos existentes. El pedido debe existir al iniciar; el ítem debe pertenecerle
al completar. El actor se toma exclusivamente de `auth.uid()`, sin parámetro
suplantable. Fecha e ID se generan en servidor. Los JSONB son snapshots cuyo
contenido deberá construir y validar la futura RPC; el auxiliar valida estructura,
no semántica de cantidades, dinero ni estados.

## Permisos y revisión estática de aislamiento

No se concede ningún privilegio nuevo a roles de aplicación. Se revoca ALL en
el esquema, tablas y funciones nuevos a PUBLIC, anon, authenticated y service_role.
Ambas tablas tienen ENABLE/FORCE RLS y ninguna policy. Las funciones tienen owner
postgres, SECURITY INVOKER y search_path fijo pg_catalog; referencias calificadas,
sin SQL dinámico. No hay wrappers en public ni consumidores nuevos.

Un administrador de negocio sigue siendo authenticated: no tiene USAGE, SELECT,
INSERT, UPDATE, DELETE, TRUNCATE ni EXECUTE sobre estos objetos. No puede consultar
pedidos ajenos por ellos ni falsificar eventos. service_role tampoco obtiene acceso
por BYPASSRLS, porque este no sustituye ACL. Incluso si en el futuro se concediera
por error UPDATE/DELETE/TRUNCATE, los triggers rechazan las mutaciones del historial.
La infraestructura inicial solo admite actores administradores y no publica lecturas,
ni siquiera de auditorías propias: cualquier lectura futura requiere un contrato
explícito que filtre pedido/actor y redacte snapshots y respuestas sensibles.

Los triggers no protegen contra un superusuario/owner que altere DDL o los desactive.
No se promete inmutabilidad frente al operador de la base de datos. No hay FK con
CASCADE/SET NULL que pueda alterar auditoría. No se alteran vistas ni sus ACL.

## Contrato para futuras RPC (todavía sin activar)

En una sola llamada/transacción SECURITY DEFINER propiedad de postgres:

1. Autorizar al actor para el pedido y la operación; conservar un orden de locks
   compatible con cliente/pago/pedido cuando corresponda.
2. Construir solicitud canónica completa con todos los argumentos significativos,
   incluidos ítem, motivo y cambios. Invocar `iniciar_operacion` antes de mutar.
3. Si devuelve `reintento=true`, retornar su resultado inmediatamente, sin efectos.
4. Capturar valores reales anteriores bajo lock, validar reglas de dominio y hacer
   los cambios permitidos. Construir snapshots nuevos y resultado estable.
5. Invocar `completar_operacion` y devolver el resultado. Propagar cualquier error
   para revertir cambios, contador y evento juntos. No capturar errores para
   confirmar cambios parciales. No separar inicio/completado en llamadas HTTP.

El lock de pedido se conserva hasta finalizar la transacción: serializa claves
iguales y diferentes del mismo pedido, incluida la inicialización concurrente.
Una segunda clave con versión obsoleta falla. Rollback deja la clave reutilizable.
La operación puede agrupar varias líneas en los JSONB; el ítem es opcional.
No hay reserva persistente ni estado «en curso» que pueda quedar huérfano.

**Restricción:** este contador solo versiona operaciones participantes. RPC legacy,
escrituras directas y cambios de preparación/pagos no lo incrementan ni generan
este historial. No usarlo todavía como versión global ni afirmar que ya existe
cobertura de auditoría completa. No hay captura retroactiva ni trigger nuevo sobre
las cinco tablas del núcleo. Para eliminar físicamente un ítem en el futuro habrá
que registrar antes de eliminar o diseñar un contrato específico.

## Revisión de escrituras y decisión de conservar permisos

Se revisaron AGENTS.md, el índice de documentación Next local (no se cambia código
Next), las migraciones SQL locales en orden, definiciones y reemplazos de RPC,
triggers, RLS y GRANT/REVOKE; también consumidores de src, scripts y SQL de pruebas.
Las fuentes vigentes de creación son las tres definiciones de `20261106010000`,
no sus cuerpos históricos. No se modificó ningún archivo preexistente.

| Consumidor legítimo local | RPC / efecto en núcleo |
| --- | --- |
| `src/app/(public)/checkout/actions.ts` | `crear_pedido_desde_carrito`: INSERT pedidos/items; UPDATE totales de cabecera. |
| `src/app/(admin)/admin/pedidos/nuevo/actions.ts` | `crear_pedido_administrativo`: INSERT pedidos/items y snapshots de precio administrativos. |
| `src/app/(admin)/admin/posibles-pedidos/actions.ts` (despachador RPC) | `convertir_posible_pedido_administrativo`: INSERT pedidos/items y vínculos con origen. Las restantes RPC de posibles pedidos escriben su propio agregado. |
| `src/app/(admin)/admin/pedidos/actions.ts` | `aceptar_pedido_administrativo`, `marcar_pedido_preparando_administrativo`, `marcar_pedido_listo_despacho_administrativo`, `marcar_pedido_en_reparto_administrativo`, `marcar_pedido_entregado_administrativo`: UPDATE de cabecera/estado. |
| Mismo archivo | `guardar_preparacion_item_pedido_administrativo`: UPDATE de preparacion_estado en pedidos; preparación en tabla separada. `finalizar_preparacion_pedido_administrativo`: UPDATE de totales/estado, UPDATE/INSERT aplicaciones y observación en historial. |
| Mismo archivo | `cancelar_pedido_administrativo`: UPDATE pedido/aplicaciones/historial. |
| `src/app/(customer)/mi-cuenta/pedidos/actions.ts` | `cancelar_pedido_cliente`: UPDATE pedido/aplicaciones/historial, con validación de propiedad. |
| `src/app/(admin)/admin/clientes/actions.ts` | `registrar_pago_cliente_administrativo`: INSERT pagos/aplicaciones; `anular_pago_administrativo`: UPDATE pagos/aplicaciones. Ajustes usan su tabla propia. |
| Trigger `registrar_historial_estado_pedido` (migración núcleo) | INSERT historial tras INSERT de pedido o cambio de estado. Las RPC de cancelación/finalización enriquecen luego observacion mediante UPDATE legítimo. |

Fuentes vigentes adicionales: aceptación `20260811130000`; pagos/anulación/cancelación
admin `20260812130000`; reparto/entregado `20260814100000`; preparando/listo
`20260817110000`; preparación por ítem `20260817111500`; cancelación cliente
`20260816190243`; finalización `20261105030000`. Triggers de fechas, validación de
línea y aplicaciones siguen operando sin cambios. Las RPC de rutas leen pedidos,
no escriben estas cinco tablas. Beneficios/chat no incorporan escritores nuevos
de estas cinco tablas. Las vistas financieras SECURITY INVOKER siguen necesitando
SELECT sobre sus tablas subyacentes.

No se encontraron DML Supabase directos de estas cinco tablas en src; sus consultas
`.from(...)` son lecturas. Los scripts de validación y `supabase/tests` incluyen
fixtures/SQL privilegiado y llamadas RPC para el entorno local; no son interfaces
productivas, no se ejecutaron ni se consideran prueba de ausencia de consumidores
externos. No se ha inspeccionado el catálogo desplegado ni integraciones externas.

**No se revoca escritura de ninguna tabla existente.** La migración
`20260810042236` otorga SELECT/INSERT/UPDATE/DELETE a authenticated sobre las cinco;
las policies `*_administracion` de `20260810041535` son FOR ALL y autorizan admin.
Las policies de lectura propia no conceden DML a clientes no administradores.
No se encontró endurecimiento posterior que cierre esas escrituras del núcleo.
Los permisos heredados/default de service_role deberán verificarse en catálogo;
esta migración no los altera sobre tablas existentes.

Accesos pendientes antes de revocar definitivamente:

| Tabla | Operaciones actualmente permitidas sin alternativa RPC general equivalente |
| --- | --- |
| pedidos | INSERT manual arbitrario; UPDATE de cantidades agregadas, precios/totales, snapshots, cliente, logística y estados fuera de transiciones concretas; DELETE. Las RPC de creación/transición cubren únicamente sus contratos. |
| items_pedido | INSERT en pedido existente, UPDATE cantidad/producto/precios/snapshots, DELETE. Las creaciones oficiales solo insertan líneas al crear el pedido; preparación no edita la solicitud original. |
| historial_estados_pedido | INSERT/UPDATE/DELETE administrativos arbitrarios. Solo hay INSERT automático y UPDATE de observación específico desde RPC; no alternativa para mantenimiento general. No se hace inmutable este historial legacy porque rompería esas RPC. |
| pagos | INSERT con estados/datos fuera del registro administrativo, UPDATE de monto/método/cliente/referencia u otros estados, DELETE. Registro y anulación no sustituyen estas operaciones. |
| aplicaciones_pago | INSERT/asignación manual, UPDATE de monto o vínculos, reactivación y DELETE. Autoaplicación/anulación/reajuste de preparación solo cubren casos concretos. |

Que un acceso no aparezca en la interfaz no demuestra que pueda retirarse. Debe
inventariarse uso externo/API, decidir qué operaciones se prohíben y cuáles necesitan
RPC, revisar dependencias SECURITY INVOKER y probar roles/concurrencia antes de
cerrar ACL. No crear una RPC CRUD genérica ni conceder privilegios amplios para
resolver esa transición.

## Compatibilidad y límites de verificación

No cambia firma ni cuerpo de RPC existente; no modifica datos, estados, saldos,
importes, pagos, preparación, despacho, entrega, beneficios ni interfaz. Tampoco
regimen_contable, importe_operativo, snapshot reservado, barrera de venta inactiva
ni las tres creaciones de `20261106010000`. No introduce columna en pedidos ni
cambia su rowtype. El esquema privado solo se llena cuando futuras RPC lo invoquen.

Revisión estática: contraste de objetos/ACL, ausencia de GRANT y policies nuevas,
referencias calificadas, claves y locks, atomicidad, ausencia de mutaciones del
núcleo y de reemplazos de funciones existentes. No se ejecutaron tests, lint, tsc,
builds, Docker, servidores ni SQL local/remoto. No hay validación dinámica ni
confirmación del estado real de grants/default privileges/event triggers en remoto.
Antes de desplegar, validar migración y seguridad por roles en un entorno autorizado,
compatibilidad del nombre de esquema, orden completo de migraciones y retención de
los JSONB sensibles. Sin commit ni push.
