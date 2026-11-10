# Producción · Fase 4: historial y correcciones

Implementación sobre las firmas y columnas locales inspeccionadas de:
- `20261109100000_crear_base_produccion.sql`.
- `produccion_fase3_complemento.sql` (informados como aplicados).

No requiere SQL adicional. No se modificaron ni ejecutaron migraciones.

## Acceso y lectura

Historial en `/admin/produccion/historial`, accesible desde la navegación, la portada de Producción y cada actividad diaria. Detalle en `/admin/produccion/historial/[id]`.

Las consultas verifican sesión y `es_admin`, usan el cliente de sesión con RLS y no utilizan service role. Las páginas se autorizan mediante sus consultas y el detalle también antes de validar su identificador. Cada Server Action verifica administración nuevamente.

El listado resuelve la última versión por actividad antes de aplicar fecha/rango, lugar, unidad, tipo y estado. Incluye anuladas explícitamente sin efecto; no calcula sumas ni estadísticas. Las versiones históricas solo aparecen en el detalle. El registro diario existente sigue excluyendo anulaciones y versiones reemplazadas. Se muestra `autor_id`, identidad histórica persistente según el contrato SQL, sin asumir columnas de nombres o relaciones con perfiles.

Lecturas por lotes de 500 y precios por lotes de 100 evitan truncamiento de PostgREST; el listado muestra 30 actividades por página. La base actual no expone una consulta de últimas versiones: para el listado se recorren las versiones y se filtran en servidor. Para volúmenes grandes convendría una lectura SQL paginada de estados actuales; no es un requisito SQL para habilitar esta fase. El detalle consulta únicamente las versiones de la actividad elegida.

## Escritura

Se invocan exclusivamente las RPC existentes:
- `corregir_actividad_produccion(p_clave_idempotencia, p_actividad_id, p_version_esperada, p_fecha_operativa, p_tipo_actividad, p_cantidad, p_unidad_medida, p_observaciones, p_motivo)`.
- `anular_actividad_produccion(p_clave_idempotencia, p_actividad_id, p_version_esperada, p_motivo)`.

Motivo obligatorio, versión esperada explícita, confirmación de anulación y clave UUID por formulario. Ante respuesta incierta se conserva en memoria el FormData original, se bloquean campos y se reenvía la misma solicitud. Ante conflicto se exige recargar. La validación lee la versión esperada, para permitir que los reintentos lleguen al control idempotente SQL incluso después de haberse confirmado la operación. La RPC realiza el control definitivo de concurrencia, autorización, inmutabilidad e idempotencia en una transacción.

No se cambia la unidad de una actividad. Las compras conservan el importe de cada versión por el trigger existente. El formulario y la acción impiden convertir una compra a otro tipo o viceversa. No se acepta editar precio; para cambiarlo se anula y se registra otra compra. Compras antiguas sin importe se identifican explícitamente, sin imputar cero ni reutilizar otro precio.

## Verificación pendiente

Revisión estática del contrato y código realizada. Por instrucción no se ejecutaron tests, build, ESLint, SQL remoto, migraciones ni comandos Supabase. No se realizaron commit ni push. Queda pendiente validar la interacción contra Supabase en un entorno autorizado, especialmente dos administradores corrigiendo la misma versión y reintentos tras pérdida de conexión.

## Archivos de esta fase

Nuevos:
- `src/app/(produccion)/admin/produccion/historial/page.tsx`
- `src/app/(produccion)/admin/produccion/historial/[id]/page.tsx`
- `src/app/(produccion)/admin/produccion/historial-actions.ts`
- `src/components/produccion/cambio-actividad.tsx`
- `src/components/produccion/version-actividad.tsx`
- `src/lib/produccion/historial.ts`
- `supabase/manual/produccion_fase4.md`

Actualizados:
- `src/app/(produccion)/admin/produccion/page.tsx`
- `src/app/(produccion)/admin/produccion/layout.tsx`
- `src/app/(produccion)/admin/produccion/actividad-actions.ts`
- `src/components/produccion/registro-diario.tsx`
- `src/lib/produccion/actividades.ts`

El árbol ya contenía cambios sin seguimiento de fases anteriores. Los cambios preexistentes de rutas, navegación, configuración y SQL se conservaron.
