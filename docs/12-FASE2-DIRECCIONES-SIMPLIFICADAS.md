# Fase 2 final: direcciones administrativas simplificadas

## Cambio local

Admin Clientes y Admin Posibles pedidos comparten `CustomerCommercialForm`. Al crear exigen nombre comercial y celular `+569` seguido de exactamente ocho dígitos (HTML, Zod y RPC administrativa). Sin dirección no se inserta ninguna fila de dirección. Si se escribe dirección o comuna, ambas deben estar completas.

La acción transforma la dirección rápida en un documento con nombre de dirección, destinatario, teléfono de contacto, región, zona, referencia y coordenadas NULL. No copia nombres ni teléfonos ni usa valores de relleno. La RPC deriva región desde `zonas_entrega.comuna_base`, comparando sin mayúsculas, tildes vocálicas ni espacios exteriores. Considera zonas activas e inactivas; varias zonas con una misma región cuentan como una sola. Sin coincidencias o con regiones distintas guarda NULL. No asigna zona automáticamente. La resolución ocurre después del control de reintentos: una operación ya confirmada devuelve su resultado original aunque cambie el catálogo.

La edición completa permite mantener o completar los campos opcionales, conserva múltiples direcciones (máximo 50), pertenencia, principal única activa, revisión de ficha, versión de posible pedido y clave idempotente. Cambiar texto de dirección, comuna o región retira coordenadas como antes. La asociación se ejecuta en la misma transacción; sus fallos revierten la creación.

## Restricciones locales revisadas

- `20260810041535_crear_nucleo_hidro_leufu.sql`: dirección y comuna NOT NULL; región NOT NULL y CHECK `btrim(region) <> ''`; nombre/destinatario/teléfono y coordenadas admiten NULL. Índice único de principal activa y checks de rango permanecen.
- `20260814110000_crear_zonas_entrega_y_direcciones_logisticas.sql`: zona nullable con FK; `zonas_entrega.region` NOT NULL, no vacía. No existe unicidad de comuna/región, por eso se cuentan regiones distintas.
- Se corrige **la migración pendiente** `20261101020000_gestion_administrativa_clientes.sql`, sin crear otra. Solo retira NOT NULL de `direcciones_cliente.region`: el CHECK existente acepta NULL según la semántica SQL y sigue rechazando texto vacío. No hace falta sustituirlo ni cambiar las restricciones de zonas.
- RPC administrativa: admite campos accesorios NULL y exige el formato chileno al crear. No modifica las firmas de RPC, grants, autorización admin, huella, locks ni asociación/versionado.

## Conversión, rutas y contabilidad

No se modifica ninguna RPC de autogestión, checkout, conversión, pedidos, pagos, deuda ni invitaciones, ni sidebar. La conversión oficial de posibles pedidos mantiene `DIRECCION_SIN_UBICACION` si falta cualquier coordenada y `ZONA_INVALIDA` sin zona activa. Por esa vía una dirección simplificada no genera pedidos ni entra a rutas hasta completar logística. Crear/asociar una ficha no crea pedidos, pagos ni movimientos contables.

La planificación existente opera sobre pedidos; no se ha añadido acceso desde fichas comerciales ni se han cambiado sus reglas. La sincronización local de rutas admite snapshots nulos de pedidos históricos: este cambio no corrige ni endurece ese comportamiento preexistente.

## Límites de revisión

Solo inspección estática de frontend, Zod, RPC y migraciones locales. Sin MCP, remoto, Docker, build, tests, instalaciones, commit o push. No se verificaron divergencias del esquema remoto ni ejecución/concurrencia. La normalización es conservadora: alias de comuna, abreviaturas, espacios internos distintos o errores de escritura pueden dejar región NULL. El repositorio ya tenía cambios y migraciones sin seguimiento ajenos a esta corrección; deben revisarse por separado.

## Aplicar SQL exactamente

Primero confirmar fuera de esta sesión que están aplicadas las dependencias previas de clientes/direcciones y `20261022012000_crear_rpcs_posibles_pedidos.sql` (incluye pp_huella, pp_bloquear_admin, pp_exigir_abierto y asociar_cliente_posible_pedido). La migración administrativa debe seguir SIN aplicar: contiene CREATE TABLE/FUNCTION y no es un script para repetir sobre una instalación previa. Si el remoto tiene restricciones extra que impidan NULL, detener la aplicación e inspeccionarlas; no rellenar regiones ficticias.

En Supabase SQL Editor, abrir y ejecutar **todo el contenido** de `supabase/migrations/20261101020000_gestion_administrativa_clientes.sql`, desde BEGIN hasta COMMIT, una sola vez. No ejecutar únicamente el ALTER ni omitir las RPC. El archivo incluye su propia transacción.

Alternativa con psql ya disponible y una conexión administrativa configurada en SUPABASE_DB_URL, sin imprimir esa variable:

```sh
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261101020000_gestion_administrativa_clientes.sql
```

Elegir solo una vía. Si se aplicó manualmente y se usa historial de Supabase CLI, registrar **después del éxito**, con el proyecto correcto ya enlazado y CLI disponible:

```sh
supabase migration repair 20261101020000 --status applied --linked
```

No usar db push indiscriminadamente: hay otras migraciones locales cuya aplicación remota no fue revisada. Aplicar SQL antes de desplegar el frontend actualizado. Queda pendiente validación funcional autorizada: alta sin dirección; comuna conocida/desconocida/ambigua; lectura y edición con NULL; múltiples direcciones; reintento; rechazo de versiones viejas y no-admin; rollback de asociación; conversión rechazada sin zona o coordenadas.

## Commit y push (no ejecutados)

Desde la raíz, revisar el diff: estos archivos incluyen también los cambios de creación rápida que ya estaban en el workspace. Las dependencias locales sin seguimiento no quedan incluidas automáticamente; revisar su publicación por separado. Luego seleccionar únicamente el alcance revisado:

```sh
git diff -- src/app/\(admin\)/admin/clientes/comercial-actions.ts src/components/admin/customer-commercial-form.tsx src/lib/admin/cliente-comercial-contrato.ts src/lib/admin/cliente-comercial.ts supabase/migrations/20261101020000_gestion_administrativa_clientes.sql
git add -- 'src/app/(admin)/admin/clientes/comercial-actions.ts' src/components/admin/customer-commercial-form.tsx src/lib/admin/cliente-comercial-contrato.ts src/lib/admin/cliente-comercial.ts supabase/migrations/20261101020000_gestion_administrativa_clientes.sql docs/12-FASE2-DIRECCIONES-SIMPLIFICADAS.md
git diff --cached --name-only
git diff --cached
```

Confirmar que el índice no contiene cambios ajenos previamente preparados. Si contiene otros, separarlos antes del commit. Después:

```sh
git commit -m "Permitir direcciones administrativas simplificadas con region nullable"
git push -u origin HEAD
```
