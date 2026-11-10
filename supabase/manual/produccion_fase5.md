# Producción — Fase 5

Cambios locales en `/admin/produccion` y `/admin/produccion/configuracion`.
Inspeccionadas la base original, sus índices/FK/triggers/RLS/RPC y el complemento
Fase 3. Leída la guía local de Next.js para mutaciones. Sin ejecución de SQL,
comandos Supabase, tests, builds, ESLint, migraciones, commit ni push.

## Aplicación manual pendiente

Archivo independiente: `/home/unk0/joaco.ro/supabase/manual/produccion_fase5_complemento.sql`.
Aplicar una vez después de la base de Producción. Compatible con el complemento
Fase 3 ya existente. Incluye BEGIN/COMMIT y recarga de caché PostgREST.
Las vistas nuevas son requisito para el frontend actualizado: aplicar el SQL
antes de habilitar esta versión de la aplicación. No se alteraron migraciones históricas.
No se certifica funcionamiento en base o navegador mediante esta revisión estática.

## Contrato

- Originales inmutables. Tabla de revisiones append-only con nombre, descripción,
  estado, versión, autor, fecha y clave idempotente. La revisión inicial implícita
  es versión 0, activa y con los datos originales. Las vistas security_invoker
  presentan el último estado, conservando RLS administrativa.
- RPC `editar_entidad_produccion(p_clave_idempotencia uuid, p_entidad text,
  p_id uuid, p_version_esperada integer, p_nombre text, p_observaciones text,
  p_activo boolean)`: entidad lugar/unidad. Administración verificada también en
  Server Action; autorización SQL, idempotencia compartida y versión esperada.
- Tipos, IDs y pertenencia no son editables. Se conservan todas las FK y la unidad
  avícola única y obligatoria de cada gallinero. La unidad avícola puede renombrarse
  independientemente del gallinero; ambos nombres se presentan en la aplicación.
- Estado efectivo = unidad activa y lugar activo. Desactivar un lugar suspende
  todas sus unidades sin sobrescribir estados individuales. Reactivar el padre
  respeta las unidades desactivadas. No se puede reactivar una unidad bajo un
  lugar inactivo; sí se pueden editar sus datos o desactivarla.
- Triggers impiden altas de unidades en lugares inactivos y nuevas actividades o
  configuraciones en unidades o lugares inactivos, incluso desde RPC anteriores.
  La fecha operativa no permite eludir el estado actual. Correcciones/anulaciones
  históricas siguen disponibles. No se borra ni reescribe ninguna actividad.
- Bloqueo transaccional común en el motor existente antes de los bloqueos de
  entidad, más triggers de defensa; serializa altas y cambios de estado/nombre.
  Las compras siguen pasando por el mismo motor, con importe atómico.
- Unicidad de nombres actuales global para lugares y dentro del lugar para
  unidades, incluyendo inactivos. Los índices originales se conservan: los nombres
  originales de otros registros quedan reservados aun después de renombrarlos.
- UI responsiva con formularios desplegables, confirmación de cambios de estado,
  estados visibles, conservación de datos y solicitud exacta ante respuesta incierta,
  y recarga obligatoria ante conflicto. Los inactivos siguen seleccionables para
  consultar registros diarios; el formulario de alta se muestra solo si están activos.

Solo se modificó Producción. La navegación y los archivos de fases anteriores
preexistentes en el árbol de trabajo se conservaron. Pendiente aplicación manual
del SQL y validación funcional en un entorno autorizado.
