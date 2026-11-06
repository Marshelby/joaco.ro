# Posibles pedidos: contratos SQL locales (paso 3)

Estado: redactado y revisado estáticamente, **sin ejecutar migraciones ni pruebas
en PostgreSQL**. No habilitar producción antes de validar en una base aislada.

## Auditoría y orden

Se contrastaron por MCP las columnas, enums, restricciones, RLS y firmas del
proyecto `gxmkrerhuuzeeupjliap`. Se revisaron `crear_pedido_desde_carrito`,
`fecha_entrega_disponible`, validadores de cantidades, `es_admin`, guardado de
producto/dirección, aceptación administrativa e invitaciones de clientes.

Orden local posterior a las 57 migraciones reconciliadas:

1. `20261022010000_crear_estructura_posibles_pedidos.sql` (corrección sintáctica mínima antes de aplicar).
2. `20261022011000_corregir_auditoria_precio_posible_pedido.sql`.
3. `20261022012000_crear_rpcs_posibles_pedidos.sql`.
4. `20261022013000_habilitar_corte_entrega_mismo_dia.sql`.

La validación posterior con parser PL/pgSQL detectó que el CASE dentro del IF de
`proteger_item_posible_pedido` necesitaba paréntesis. Se corrigieron únicamente
esos delimitadores en la migración estructural aún no aplicada. Una migración
posterior no puede subsanar un error que impide cargar su predecesora.

La correctiva elimina la dependencia del trigger diferido respecto de la última
versión de cabecera: dos autorizaciones o una autorización seguida de conversión
en la misma transacción deben poder validar sus propios eventos. Ahora cada NEW
se asocia a precios, actor, motivo e instante de autorización. No cambia snapshots
ni permisos de tablas. Los cuerpos originales permanecen en su migración.

## Firmas públicas exactas

Todas devuelven `jsonb`, salvo fechas, que devuelve `table(fecha date)`.

```sql
obtener_fechas_posibles_pedidos()

registrar_posible_pedido_whatsapp(
  p_nombre text, p_telefono text, p_fecha date, p_observaciones text,
  p_items jsonb, p_clave_idempotencia uuid, p_secreto_reintento text)

editar_posible_pedido_administrativo(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid, p_lineas jsonb)

autorizar_precio_posible_pedido(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid, p_item_id uuid,
  p_precio_neto bigint, p_precio_venta bigint, p_motivo text)

asociar_cliente_posible_pedido(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid, p_cliente_id uuid)

descartar_posible_pedido(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid, p_motivo text)

convertir_posible_pedido_administrativo(
  p_id uuid, p_version_esperada bigint, p_clave_operacion uuid,
  p_direccion_id uuid, p_fecha_efectiva date, p_metodos_pago text[])
```

| Función | EXECUTE | Control interno |
|---|---|---|
| Fechas | anon, authenticated, service_role | Solo fechas públicas |
| Registro | service_role | `auth.role() = service_role` |
| Cinco administrativas | authenticated | `auth.uid()` y `es_admin()` antes de leer |
| Helpers `pp_*` | Ningún rol de aplicación | Uso interno del propietario |

Todas las RPCs son SECURITY DEFINER con propietario postgres y search_path
pg_catalog. Las tablas nuevas mantienen RLS y no reciben DML directo, tampoco
para service_role. La migración no modifica las ACL del sistema existente.

## Contrato del futuro endpoint (no implementado)

El visitante no necesita sesión. El endpoint usará un cliente Supabase exclusivo
con credencial service_role almacenada solo en servidor; no debe reenviar el
Authorization del visitante a ese cliente. Nunca incluir esa clave en Android o
navegador. Añadir CAPTCHA verificable en servidor, límites por IP/sesión, cuota
global, timeout, máximo de cuerpo y errores públicos sin mensajes SQL internos.

El navegador genera y conserva ANTES del envío un UUID de intento y un secreto
criptográfico de 32 bytes (64 caracteres hexadecimales minúsculos). El servidor
valida estos campos y no los registra en logs. Se exige secreto también en el
primer intento: así la pérdida de respuesta no pierde la capacidad de reintentar.

Entrada de items, sin precios u otras claves:

```json
[{"presentacion_id":"UUID","cantidad":1.5}]
```

Se normalizan UUID, cantidades numéricas, bordes de textos y teléfono chileno
(9XXXXXXXX o +569XXXXXXXX). El orden de líneas forma parte de la solicitud.
Máximos técnicos: 100 líneas, JSON de items 32 KiB, cantidad 100000 y total
9e12 CLP. El endpoint debe limitar además el cuerpo HTTP completo y la frecuencia.

SHA-256 de contenido normalizado y del secreto; el secreto no se guarda en claro.
La clave se serializa con advisory lock transaccional antes de consultar/insertar.
Un reintento auténtico devuelve `respuesta_original` del evento de registro,
incluso tras editar, cerrar o cambiar el catálogo. Clave ajena, secreto incorrecto
o contenido diferente generan el mismo `REINTENTO_INVALIDO`, sin exponer datos.
No es un mecanismo público de búsqueda por código.

Respuesta: `codigo`, `fecha_solicitada`, `subtotal`, `despacho`, `total`, `moneda`,
`estado` inicial e `items` con nombre, presentación, unidad, cantidad, precio
unitario de venta y subtotal. No devuelve nombre del solicitante, teléfono,
observaciones, UUID interno, hashes ni secretos. El endpoint combina con los
campos que el propio visitante acaba de introducir para el mensaje WhatsApp.
El registro o apertura de WhatsApp no acredita envío del mensaje.

## Operaciones administrativas

Todas bloquean cabecera FOR UPDATE antes de tocar líneas. La clave de operación
se guarda con huella de parámetros, evento y actor. Una repetición idéntica
devuelve el resultado guardado, sin incrementar versión. Reusar clave con otro
actor/contenido/evento genera `CLAVE_OPERACION_EN_USO`. Una operación nueva exige
versión actual y solicitud abierta. Cada operación exitosa incrementa una vez.

Resultado administrativo: `posible_pedido_id`, `codigo`, `estado`, `version`,
`subtotal`, `despacho`, `total`, `pedido_id`, `numero_pedido`. No devuelve secretos.

Edición recibe la lista final, ordenada:

```json
[
  {"item_id":"UUID_LINEA_EXISTENTE","cantidad":2},
  {"presentacion_id":"UUID_PRESENTACION_NUEVA","cantidad":1}
]
```

Las omitidas quedan inactivas. Se pueden reactivar por item_id manteniendo sus
snapshots. No se permite insertar como nueva una presentación ya presente en el
historial: impide recotizar silenciosamente retirando y reinsertando. Cambiar un
producto requiere retirar la línea e incorporar una presentación diferente.
Solo las líneas nuevas capturan precios vigentes. Para precios de una existente
se debe llamar a la autorización explícita.

Autorización: neto y venta enteros, no negativos, venta >= neto. Es la regla de
`guardar_producto_administrativo` verificada; el modelo real no fija una tasa de
IVA ni redondeo tributario. No se impone un 19% supuesto. Requiere motivo y guarda
antes/después, actor e instante. Los originales nunca cambian. El trigger diferido
impide completar la transacción sin auditoría correspondiente.

Asociación: cliente comercial activo; no altera auth.users ni usuario_id. No se
implementa creación paralela de clientes. Si se necesita, el contrato futuro será
`crear_cliente_comercial_administrativo(nombre,telefono,email,observaciones,
clave_operacion)` con es_admin, validación, idempotencia y revisión explícita de
duplicados; sin crear usuario ni vincular automáticamente por correo/teléfono.

Descarte exige motivo, cierra y bloquea futuras modificaciones. Las respuestas de
reintentos administrativos son las del evento original, no una vista actualizada.
Después de recibirlas, el dashboard debe refrescar su consulta administrativa.

## Conversión

Exige cliente previamente asociado, dirección activa de ese cliente, coordenadas,
zona activa, fecha válida según calendario y medios previstos normalizados.
La fecha efectiva puede diferir de la solicitada; se registra en auditoría y no
se reescribe la original. El corte se evalúa con clock_timestamp tras las esperas
por locks. La consulta pública también usa el reloj real, no la hora de inicio de
una transacción larga. El registro vuelve a validar fechas después de bloquear
catálogo. Días/cortes proceden de dias_entrega; no hay DML de calendario.

La disponibilidad e identidad se revalidan y bloquean en catálogo; los precios
actuales no se usan, ni siquiera para imponer el límite monetario a una conversión.
Si cambian nombre de producto/presentación, unidad, cantidad o modo, se bloquea.
Revisión pendiente: si un formato cambió bajo el mismo UUID, se necesitará una
nueva identidad de presentación o un flujo explícito de revisión; esta RPC no
silencia el conflicto ni modifica snapshots para continuar.

Usa neto/venta autorizados o, si faltan, originales. Recalcula líneas/totales y
despacho con umbral/tarifa capturados. Descuento cero, canal whatsapp, estado
recibido. No llama a crear_pedido_desde_carrito, no crea pagos/abonos ni actualiza
pedidos previos. Se conserva el comportamiento de los triggers oficiales.

Inserta la cabecera oficial, marca la intención convertida, inserta líneas y
vínculos y registra auditoría en la misma transacción. El orden respeta el trigger
de vínculos. Una falla revierte todo. La cabecera bloqueada y su pedido único
impiden dobles conversiones. Si ya está convertido, cualquier administrador
autorizado recupera el resultado existente aun con otra clave/versión. Ese caso
no reinterpreta parámetros nuevos ni crea otro evento. El UUID idempotente del
pedido oficial se genera en servidor y no reutiliza claves de visitantes.

La venta recibida sí integra cuenta corriente al finalizar correctamente la
conversión. Antes de convertir, las intenciones no participan de vistas contables.

## Plan reproducible: pendiente, sin resultados simulados

No hay psql, servidor PostgreSQL ni Docker operativos en esta sesión. Tras la
autorización se instaló Supabase CLI 2.121.0 fuera del repositorio, y parsers
libpg-query: 17.7.4 para SQL y 18.1.5 para PL/pgSQL. Los 61 archivos SQL pasan el
parser PG17; los cuerpos nuevos y el cuerpo de pruebas pasan el parser PL/pgSQL
PG18. Esto no valida resolución de dependencias, permisos efectivos, compilación
en un servidor PG17 ni ejecución funcional. Ver `10-ENTORNO-PRUEBAS-LOCAL.md`.

En una base Supabase aislada/descarte, con esquema equivalente, aplicar las
migraciones en orden SOLO tras autorización separada. Nunca usar conexión MCP o
URL de producción para estas pruebas. Crear un administrador fixture real en
auth.users/perfiles mediante el mecanismo de seed del entorno. Marcar la base
aislada con `app.hidro_test_aislado=si` mediante el operador de ese entorno.

El script `supabase/tests/posibles_pedidos.sql` exige ese marcador, propietario
postgres y UUID de administrador. Las secuencias pueden avanzar incluso con
ROLLBACK: por eso requiere una base desechable. Crea datos propios dentro de BEGIN/ROLLBACK,
altera únicamente el calendario temporal del entorno aislado y fuerza constraints
diferidos. Ejecutar, cuando esté autorizado:

```bash
psql -X "$URL_LOCAL_AISLADA" -v ON_ERROR_STOP=1 \
  -v admin_uuid=UUID_ADMIN_FIXTURE -f supabase/tests/posibles_pedidos.sql
```

| Caso solicitado | Verificación preparada |
|---|---|
| 1. Registro correcto | Cabecera, línea y respuesta comercial |
| 2. Visitante sin cuenta | service_role con auth.uid vacío |
| 3. Fecha fuera de tres | Error y rollback de solicitud |
| 4. 07:59 / 08:00 | Calendario temporal, instante explícito America/Santiago |
| 5. Producto inactivo | Error sin intención nueva |
| 6. Presentación inválida | UUID inexistente, rechazo |
| 7. Fracciones/cerrados | Validadores SQL compartidos |
| 8. Catálogo recotizado | Reintento conserva respuesta original |
| 9. Cantidad editada | Conserva precio original, replay sin nueva versión |
| 10. Precio autorizado | Dos autorizaciones, auditoría diferida |
| 11. Replay idéntico | Igualdad de respuesta y una cabecera |
| 12. Otro contenido/secreto | REINTENTO_INVALIDO |
| 13. No autorizado | ACL, RLS sin filas y RPC no-admin denegada |
| 14. Dos administradores | Dos sesiones: procedimiento inferior |
| 15. Fecha vencida | Error, sin venta oficial |
| 16. Formato modificado | Error, restauración fixture para seguir |
| 17. Snapshots oficiales | Neto/final efectivos históricos exactos |
| 18. Sin deuda previa | Sin pedido ni movimiento de la ficha fixture |
| 19. Exactamente una vez | Segunda conversión devuelve el mismo pedido |
| 20. Preexistentes intactos | Comparación JSON de pedidos y pagos previos |

Ampliar la suite antes de aprobar producción: RLS como anon, rechazo de escritura
directa con cada rol, doble registro simultáneo con mismo intento, editar después
de cerrar, retiro/reactivación/reordenamiento, autorización sin auditoría, captura
de línea nueva, cantidades extremas, métodos inválidos, zona/dirección inactiva,
fecha que cruza el corte esperando un lock y fallo intencional a mitad de conversión.
Comparar también aplicaciones_pago, ajustes y saldos de clientes preexistentes.

### Prueba concurrente (caso 14)

En una base desechable, preparar y COMMIT una fixture con dos administradores,
cliente/dirección propios y una intención registrada/asociada abierta, usando el
setup del script. Anotar ID, versión, dirección y fecha válida. No ejecutar su
conversión secuencial antes de este caso. En ambas sesiones usar la MISMA versión
esperada; claves de operación diferentes. Las transacciones siguientes son solo
para esa base aislada:

```sql
-- Sesión A, definir variables psql id, version, direccion, fecha, admin_a:
begin;
select set_config('request.jwt.claim.sub', :'admin_a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', jsonb_build_object('sub', :'admin_a', 'role','authenticated')::text, true);
set local role authenticated;
select public.convertir_posible_pedido_administrativo(
  :'id'::uuid, :version, gen_random_uuid(), :'direccion'::uuid,
  :'fecha'::date, array['efectivo']);
select pg_sleep(10); -- solo simulación local, para solapar sesión B
commit;
```

En B ejecutar el mismo bloque con admin_b, sin pg_sleep, mientras A espera.
B debe esperar el lock y luego devolver el MISMO pedido, sin crear otra venta.
Como propietario local, comprobar una cabecera oficial vinculada, una conversión
en historial, version original+1 y un vínculo por línea. Repetir haciendo ROLLBACK
en A: B debe crear exactamente una venta. Descartar la base al finalizar.

## Decisiones pendientes

- Aprobar límites técnicos para el negocio y política de retención/purga.
- Confirmar mantener umbral/tarifa capturados al convertir (implementado así).
- Definir validación tributaria más estricta si se necesita; no existe en el modelo.
- La migración 013000 permite anticipación cero y preserva el valor al usar la
  firma antigua. El dashboard aún necesita selector de anticipación, textos
  dinámicos y envío del cuarto parámetro. No configurar cero usando la UI actual
  hasta corregir sus textos, que todavía describen siempre el día anterior.
- Configurar posteriormente lunes/martes/viernes y corte 08:00. Ninguna migración
  nueva establece días, horarios ni anticipaciones automáticamente.
- Autorizar y ejecutar pruebas reales antes de aplicar en remoto.
