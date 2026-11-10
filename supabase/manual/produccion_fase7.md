# Producción Fase 7: cultivos configurables

SQL pendiente, no ejecutado: `supabase/manual/produccion_fase7_complemento.sql`.
Requiere la base de Producción y los complementos locales de Fases 3 y 5. La aplicación de Fase 7 necesita este complemento; no se modificaron migraciones históricas.

Se conserva `meson` como tipo. El cultivo inicial se elige al crear el mesón. Las configuraciones posteriores establecen cultivo y capacidad desde una fecha, sin reemplazar filas. Antes de la primera configuración se utiliza el cultivo inicial. Los mesones y configuraciones anteriores sin cultivo se interpretan como lechuga.

Plantación, cosecha y pérdidas de lechuga usan unidades enteras. Las mismas actividades de berro usan kg con decimales (por ejemplo, 4.32). La capacidad se expresa también en la medida del cultivo. No se convierte una cantidad anterior entre unidades y kg.

Cada versión nueva conserva una instantánea del cultivo. Corregir o anular mantiene el cultivo de la actividad, incluso al cambiar su fecha. Las versiones históricas sin cultivo siguen representando lechuga. Cambiar una configuración no reinterpreta actividades registradas.

Las firmas RPC anteriores siguen disponibles. Las nuevas RPC delegan en el mismo motor privado y conservan autorización administrativa, bloqueo global de configuración, claves idempotentes, comparación de solicitudes, secuencia de versiones y anulación terminal. El registro nuevo incluye el cultivo mostrado: un cambio concurrente de configuración se rechaza antes de confirmar; un reintento ya confirmado recupera su resultado original.

Para añadir otro cultivo se agrega su definición al catálogo SQL mediante un futuro complemento local y al registro central `src/lib/produccion/cultivos.ts`. No hace falta crear otro tipo de unidad ni duplicar formularios.

Revisión realizada únicamente por lectura del código y SQL. No se ejecutaron tests, builds, ESLint, SQL, migraciones ni comandos Supabase. No incluye rediseño visual, Resúmenes ni cambios comerciales.
