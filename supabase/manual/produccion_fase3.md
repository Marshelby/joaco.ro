# Producción — Fase 3

Implementación local del registro diario en `/admin/produccion`. No se ejecutaron pruebas, builds, ESLint, SQL remoto, migraciones ni comandos Supabase.

## Contrato utilizado

Se inspeccionó `20261109100000_crear_base_produccion.sql`. Las actividades ordinarias llaman a la firma existente de `registrar_actividad_produccion(p_clave_idempotencia, p_unidad_id, p_fecha_operativa, p_tipo_actividad, p_cantidad, p_unidad_medida, p_observaciones)`.

Las cantidades obligatorias y unidades respetan sus CHECK: huevos y lechugas enteros en unidad, alimentación/compras en kg o g, flores cosechadas enteras en unidad o ramo. Las otras actividades usan descripción opcional y actividad libre la exige. No se exige configuración de capacidad porque el contrato SQL no lo exige. Suelo sigue configurable sin formulario.

Cada registro explícitamente nuevo recibe otra UUID. Los reintentos conservan la UUID. Ante respuesta incierta se bloquean cambios de datos y selección para reintentar la misma solicitud. Tras éxito se actualiza la lista y se puede registrar otra actividad conservando fecha, lugar y unidad. No existe unicidad por tipo/día.

La autorización se comprueba en layout, consultas y Server Action; las lecturas usan el cliente de sesión y las políticas RLS existentes. Todas las escrituras pasan por RPC.

## Bloqueo de compras

La migración original no guarda precios. `produccion_fase3_complemento.sql` es una propuesta local NO aplicada. Agrega una tabla inmutable de importes por versión y una sobrecarga de ocho argumentos de la RPC existente. Reutiliza su motor privado, autorización y bloqueo idempotente; precio y actividad se guardan en la misma transacción. Reutilizar una clave con distinto precio produce conflicto, incluso si los demás datos coinciden. No convierte registros originales sin precio en compras con precio retroactivamente.

Hasta aplicar el complemento, comprar alimento devuelve un mensaje específico sin guardar la actividad. El resto del registro funciona con la base original. Los registros antiguos sin precio muestran que el importe no está disponible. CLP es la convención de presentación del precio total; admite hasta dos decimales, mayor que cero y menor que 10^12.

## Límites

La consulta resuelve la última versión antes de filtrar la fecha, omite anulaciones y pagina en bloques de 500 sin truncar el historial. Actualmente lee todo el historial para resolver el estado actual; a gran volumen conviene una consulta SQL dedicada con paginación y resolución de última versión en servidor. No se agregaron edición, anulación, estadísticas ni roles nuevos.

La verificación realizada fue revisión estática del código y del contrato local. Quedan pendientes la validación funcional en el entorno autorizado y la revisión/aplicación del complemento de precios.
