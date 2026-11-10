# Fase 9 — Resúmenes y estadísticas

Ruta: `/admin/produccion/resumen`. Acceso administrativo en layout, lector servidor y RPC.

## SQL pendiente de ejecución manual

Aplicar `supabase/manual/produccion_fase9_complemento.sql` después de la base y los complementos locales de Fases 3, 5 y 7. No se ha ejecutado SQL remoto ni comandos Supabase. La interfaz muestra un estado de habilitación pendiente si falta la RPC o sus dependencias.

La RPC es de solo lectura, devuelve configuración efectiva al cierre y agregados diarios de dos períodos de igual duración en una sola consulta. Resuelve la versión máxima por actividad con el índice único existente antes de filtrar fechas operativas o anulaciones. No transporta versiones históricas al navegador. Compras e importes se unen exclusivamente por versión vigente (PK de importes), sin duplicar correcciones. Gramos de alimento se convierten a kg; cultivos y demás medidas permanecen separados. Incluye lugares inactivos para conservar resultados históricos. Límite: 366 días por período.

Día, semana de lunes a domingo, mes calendario y rango inclusivo. Referencia inicial calculada en America/Santiago; la aritmética usa fechas civiles, sin convertir fechas operativas a instantes locales ni sumar horas a través de cambios de horario.

La comparación exige cantidades presentes en ambos períodos y ninguna cantidad/importe faltante. No se infieren ceros para días sin actividades; importes incompletos se identifican como parciales. No se calcula ocupación, rendimiento por gallina ni inventario desde eventos incompletos. El período calendario puede incluir días futuros; siempre se indican las fechas exactas comparadas.

## Limitaciones del esquema existente

La base admite unidades de suelo pero su CHECK de actividades no admite registros para ellas; la sección las muestra con un estado vacío explícito. No se modifica esta restricción histórica. Sectores de flores muestran sus registros compatibles en unidades o ramos por separado. El cultivo histórico está tipado exclusivamente para mesones: no se atribuyen cosechas de flores/suelo a lechuga o berro sin evidencia.

## Revisión

Revisión estática de código, contratos SQL y navegación. Por instrucción del usuario no se ejecutaron tests, build, ESLint, migraciones ni SQL. La integración y el rendimiento remoto quedan pendientes de aplicar el SQL y de la validación operativa en el entorno de destino.
