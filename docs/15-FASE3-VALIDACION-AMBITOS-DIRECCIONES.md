# Fase 3: auditoría local y salida a producción

## Resultado y evidencia

Auditoría estática compatible con las migraciones locales, sin certificar el esquema remoto ni la seguridad en ejecución. **NO VERIFICADAS**: aplicación SQL, RPC, RLS real, concurrencia y pruebas de navegador. No hay `psql` ni `postgres` en PATH. No se ejecutaron MCP, remoto, Docker, instalaciones, build, commit ni push.

- Firmas conservadas: guardar dirección personal (9 argumentos), desactivar (1), obtener ficha (1), guardar ficha (7) y checkout (7). No se restauran las firmas retiradas de checkout. Se compararon los cuerpos personales/checkout con sus últimas definiciones locales.
- Dependencias: núcleo/hardening, logística, autogestión, métodos de pago, Posibles pedidos `20261022010000` a `20261101010000` y gestión administrativa `20261101020000`, incluidos `pp_huella`, bloqueo, versión, asociación y tabla de comprobantes. La nulabilidad de región viene de `20261101020000`; el CHECK de región admite NULL. No modificar ni volver a aplicar migraciones previas ya registradas.
- ACL de tabla: solo SELECT a authenticated; sin DML para roles API ni políticas de escritura. Dos políticas SELECT: personal propia y lectura operativa admin de ambos ámbitos. Las cinco RPC son SECURITY DEFINER/postgres, search_path pg_catalog y EXECUTE authenticated, con validación de identidad/rol dentro. Revisar también privilegios de columna y roles heredados del entorno real.
- Autogestión fuerza personal y pertenencia; ficha administrativa devuelve/escribe comercial y rechaza ID personal, otro cliente y campos de ownership. Admin conserva SELECT personal para conversión; esto no autoriza modificarla mediante gestión comercial. Un admin que también sea titular sigue teniendo autogestión personal como titular, no como operador de otra ficha.
- Principal única **activa** por `(cliente_id, ambito)`; no se exige existencia de principal. Autogestión y administración bloquean cliente antes de direcciones y zona. Cambiar/desactivar principal no promueve otra automáticamente. Administración limpia principales comerciales antes de sus upserts si se solicita una nueva; no toca personales.
- Guardado comercial: dirección/comuna obligatorias, región y teléfono opcionales, coordenadas ambas o ninguna, zona activa si se indica. Edición con revisión; omitir una dirección no la borra. Se bloquea por clave antes de mutaciones y se guarda huella/autor/resultado en la misma transacción. Asociación falla atómicamente. Reintento con otra solicitud/autor no puede reutilizar la clave. Respuestas antiguas sin ámbito se filtran deliberadamente, luego se debe recargar ficha.
- Creación rápida produce comercial desde el servidor, sin ownership del navegador. Conversión administrativa conserva selección de ambos ámbitos, activa, cliente activo, zona activa y coordenadas; genera snapshots, no actualiza dirección. Checkout nuevo fuerza personal; reintentos de pedidos existentes conservan recuperación histórica. Sin cambios en UUID/FK, pedidos previos, importes, contabilidad, invitaciones o rutas. Rutas conservan snapshots y fallback por ID.
- Todas las filas históricas quedan **personal provisional**, sin prueba de origen, incluso antiguas altas administrativas. No se pierden, pero desaparecen de la ficha comercial; siguen visibles para su titular. No reclasificar por canal ni por vínculo Auth: exige evidencia por UUID y auditoría separada según documento 13.

## Corrección confirmada y verificaciones ejecutadas

Se corrigió `region: string` a `region: string | null` en la consulta y props de checkout: el esquema permite NULL. No cambia las reglas de selección ni se inventa una región. No se modificó la migración ni se hicieron refactorizaciones.

- `git diff --check`: sin errores en los cambios rastreados; se comprueban también los documentos/migración/SQL nuevos de esta integración al cerrar la revisión.
- `timeout 60s node_modules/.bin/tsc --noEmit --incremental false`: terminó por timeout (124), sin diagnóstico; **tipos NO VERIFICADOS**. No equivale a aprobación y no se lanzó build.
- ESLint dirigido a los nueve archivos de frontend de fases 2/3: salida 0, sin errores ni advertencias.
- Comparación textual de RPC personales y checkout con definiciones anteriores: cambios limitados a ámbito, locks, search_path y cierre de autorización NULL; contratos y cálculo de pedido conservados. Esto es inspección, no una prueba SQL.

## Orden obligatorio

1. Detener despliegues automáticos del frontend nuevo. En entorno autorizado revisar respaldo, historial de migraciones y deriva del esquema: cuerpos RPC (incluidos ayudantes), ACL, políticas, triggers, constraints, índices, vistas y consumidores service_role. Las guardas de la migración no comparan cuerpos remotos. Una diferencia sin explicación bloquea el despliegue.
2. Aplicar primero las dependencias que realmente falten según el historial, en orden de timestamp y tras revisión. No ejecutar masivamente todos los archivos locales no rastreados.
3. Conectar deliberadamente al destino correcto como rol de migración. Aplicar **una sola vez** el archivo `supabase/migrations/20261101030000_separar_ambitos_direcciones_cliente.sql`, por el mecanismo de migraciones habitual que registra la versión. Alternativa de aplicación manual controlada: `psql "$DESTINO_SQL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261101030000_separar_ambitos_direcciones_cliente.sql`; después registrar/reconciliar la versión con el procedimiento operativo habitual antes de usar nuevamente un runner. No ejecutar ambas vías. El archivo ya contiene BEGIN/COMMIT; no añadir `--single-transaction`.
4. Un timeout de lock (5 s), deadlock o error exige confirmar rollback y resolver la causa antes de reintentar el archivo completo. Tras éxito no reejecutarlo (ADD COLUMN no es idempotente). No borrar políticas ni triggers desconocidos para forzar su ejecución.
5. Ejecutar `psql "$DESTINO_SQL" -X -v ON_ERROR_STOP=1 -f supabase/tests/ambitos_direcciones_catalogo.sql`; debe terminar sin excepciones. Revisar manualmente el predicado de índice y las expresiones RLS mostradas. Confirmar también que el historial registra la versión. Refrescar caché de esquema PostgREST si fuese necesario; comprobar las firmas desde el cliente autenticado.
6. Ejecutar la matriz de seguridad y funcionalidad de abajo en entorno aislado. No promover a producción con esas pruebas pendientes. SQL primero y pruebas SQL/RLS aprobadas; **después** publicar frontend y probar cuenta/checkout/admin. La base migrada conserva firmas para frontend anterior, pero cambia la clasificación histórica. El frontend nuevo **no funciona antes de SQL**: filtros y lector Zod exigen `ambito`; no hay fallback inseguro.
7. Rollback de frontend conserva SQL y sus protecciones. No retirar ámbito ni restaurar permisos amplios. No revertir clasificación en bloque.

## SQL de seguridad con identidades reales de prueba

Solo en una base aislada con migración aplicada, usuario web sin admin, cliente suyo con una personal y una comercial conocidas, otra ficha, y admin. Conservar IDs y snapshots iniciales. El script de catálogo no sustituye estas pruebas.

En psql definir `usuario_web`, `cliente`, `personal`, `comercial`, `usuario_admin`, `zona` y una `fecha` disponible, todos de fixtures. Verificar como propietario que ambos UUID existen; si la comercial no existe, obtener cero filas no demuestra aislamiento. Cada bloque con un error esperado debe ejecutarse por separado y terminar en ROLLBACK; no ejecutar todo con ON_ERROR_STOP esperando continuar tras el error.

```sql
begin;
select set_config('request.jwt.claim.sub', :'usuario_web', true);
select set_config('request.jwt.claims', json_build_object(
  'sub', :'usuario_web', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.es_admin(); -- debe ser false
select id, ambito from public.direcciones_cliente where cliente_id = :'cliente'::uuid;
-- Debe incluir personal y excluir comercial, sin filtro de ámbito del cliente SQL.
select count(*) from public.direcciones_cliente where id = :'comercial'::uuid; -- 0
rollback;
```

Con el mismo encabezado de identidad web ejecutar separadamente:

```sql
update public.direcciones_cliente set direccion = 'INTENTO' where id = :'comercial'::uuid;
-- permission denied (42501); repetir con ID personal, INSERT y DELETE.
select public.desactivar_direccion_cliente(:'comercial'::uuid);
-- DIRECCION_NO_ENCONTRADA; comprobar después que comercial sigue intacta.
select public.guardar_direccion_cliente(:'comercial'::uuid, 'Prueba', '+56912345678',
  'Dirección prueba', :'zona'::uuid, -33, -71, null, true);
-- DIRECCION_NO_ENCONTRADA usando zona activa de Región de Valparaíso.
select public.obtener_cliente_administrativo(:'cliente'::uuid);
-- NO_AUTORIZADO (42501).
select public.crear_pedido_desde_carrito(:'cliente'::uuid, :'comercial'::uuid,
  '[{"presentacion_id":"00000000-0000-4000-8000-000000000001","cantidad":1}]'::jsonb,
  null, gen_random_uuid(), :'fecha'::date, array['efectivo']);
-- DIRECCION_INVALIDA: fecha disponible, clave nueva, cliente activo.
-- La comprobación de dirección precede a resolver ese producto de ejemplo.
```

Como admin (mismo bloque sustituyendo JWT por `usuario_admin`): `es_admin()` debe ser true y SELECT debe mostrar ambos ámbitos. `obtener_cliente_administrativo(cliente)` debe devolver solo comerciales y revisión. Enviar a `guardar_cliente_administrativo` el documento completo del cliente leído, la revisión actual y una dirección de prueba con ID personal debe fallar `DIRECCION_NO_PERTENECE_AL_CLIENTE`, incluso si el ID es del mismo cliente. Repetir con ID de otro cliente y con campo `ambito`/`cliente_id` adicional (CAMPOS_DIRECCION_INVALIDOS). Confirmar que no cambió ningún campo personal. DML directo admin también debe fallar. Repetir ACL con anon y service_role: no pueden SELECT ni ejecutar las cinco RPC.

## Matriz funcional pendiente (registrar evidencia, no marcar por lectura)

| Prueba | Resultado exigido |
| --- | --- |
| Crear comercial con dirección/comuna y resto NULL | Persiste, región derivada solo si unívoca; sin coordenadas/zona no se convierte |
| Crear/editar/desactivar/reactivar comercial | UUID estable; solo comerciales; coordenadas incompletas, rangos, dirección/comuna vacía y zona inactiva rechazados |
| Principal personal y comercial simultáneas | Una activa por ámbito; crear/editar/desactivar en uno no cambia el otro; se permite cero principales |
| Repetir mismo UUID de operación y documento | Misma ficha/UUID de dirección, sin segunda alta/asociación; refrescar revisión antes de editar |
| Mismo UUID con otros datos u otro admin | CLAVE_OPERACION_EN_USO, sin cambios |
| Dos sesiones, misma revisión comercial, claves distintas | Una guarda; segunda espera y falla CLIENTE_DESACTUALIZADO (40001), sin pérdida de cambios |
| Dos sesiones, misma clave, misma solicitud | Serialización y mismo resultado, una sola dirección; probar también creación sin cliente_id |
| Personal y comercial concurrentes del mismo cliente | Espera por cliente; principal independiente, sin duplicados; modificación solo personal no invalida revisión comercial |
| Asociación con versión obsoleta o solicitud cerrada | Rollback de cliente/direcciones/asociación; versión y evento coherentes |
| Pérdida de respuesta y reintento en UI | Documento y clave congelados, sin duplicados; en alta rápida puede aparecer coincidencia de la ficha ya creada y requerir confirmación informativa antes de recuperar el comprobante |
| Alta rápida desde Clientes y desde Posibles pedidos | Dirección comercial opcional; comuna obligatoria con dirección; asociación atómica y detección de coincidencias |
| Mi cuenta, URL de edición manipulada y checkout | Comerciales ausentes; escritura y checkout por UUID comercial rechazados por servidor; personales funcionan |
| Conversión con personal y con comercial completas | Ambas generan pedido único, snapshots correctos; sin logística falla sin pedido parcial |
| Pedidos anteriores, saldo, pagos, rutas | IDs/snapshots/importes sin cambios; fallback por ID sigue funcionando; desactivar dirección no cambia snapshots |
| Navegador | Tarjetas persistentes, editor independiente, vacío, móvil/teclado, conflictos y reintento incierto |

Concurrencia requiere dos conexiones reales: no basta simular llamadas secuenciales. Capturar conteos y documentos antes/después; usar transacciones con rollback para pruebas SQL que no requieran commits entre sesiones. Preparar fixtures desechables para concurrencia y pruebas de navegador.

## Git limitado a esta integración

No se ejecutaron los siguientes comandos. Revisar el diff primero; las rutas existentes contienen trabajo previo de fases 1/2 que se incluye deliberadamente. No incluir `.env.example`, `next-env.d.ts`, artifacts, scripts, accesos directos ni otras migraciones no rastreadas. Las dependencias previas deben estar disponibles en la rama/destino, pero no se agregan incidentalmente en este commit.

```bash
git add -- \
  supabase/migrations/20261101030000_separar_ambitos_direcciones_cliente.sql \
  supabase/tests/ambitos_direcciones_catalogo.sql \
  docs/13-FASE1-AMBITOS-DIRECCIONES.md \
  docs/14-FASE2-DIRECCIONES-COMERCIALES.md \
  docs/15-FASE3-VALIDACION-AMBITOS-DIRECCIONES.md \
  'src/app/(admin)/admin/clientes/[id]/page.tsx' \
  'src/app/(customer)/mi-cuenta/direcciones/[id]/editar/page.tsx' \
  'src/app/(customer)/mi-cuenta/direcciones/page.tsx' \
  'src/app/(customer)/mi-cuenta/page.tsx' \
  'src/app/(public)/checkout/actions.ts' \
  'src/app/(public)/checkout/page.tsx' \
  src/components/admin/customer-commercial-form.tsx \
  src/components/checkout/checkout-content.tsx \
  src/lib/admin/cliente-comercial.ts
git diff --cached --check
git diff --cached --stat
git diff --cached
# Antes de commit, confirmar que no había otros archivos previamente staged.
git commit -m "Separa ámbitos de direcciones y valida integración comercial"
# Confirmar que todos los commits salientes pertenecen al despliegue autorizado.
git log --oneline '@{upstream}..HEAD'
git push origin HEAD
```

El push puede disparar despliegue automático: mantenerlo detenido hasta completar SQL y validaciones. No usar `git add .` ni `git add -A`.
