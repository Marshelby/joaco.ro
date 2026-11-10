# Producción — Fase 2

Implementación basada en lectura completa de `20261109100000_crear_base_produccion.sql`.
El usuario confirma que esa migración ya fue aplicada. No se ejecutó SQL remoto,
comandos Supabase, migraciones, tests ni builds durante esta fase.

## Rutas y seguridad

- `/admin/produccion`: layout propio en `(produccion)`, fuera del layout comercial;
  selector de fecha (hoy en America/Santiago), lugares y capacidades vigentes.
- `/admin/produccion/configuracion`: creación y consulta de lugares y unidades,
  altas de configuraciones e historial con intervalos de vigencia.
- Entrada compartida de navegación administrativa de escritorio y móvil.
- Cliente Supabase de sesión, `auth.getUser()` y `es_admin()` en layout,
  consultas y Server Action; RLS como segunda barrera. Sin service role ni DML.
- Lecturas paginadas de columnas explícitas de lugares, unidades y configuraciones.
- Escrituras exclusivamente con las siguientes firmas existentes (sin defaults):

```
crear_lugar_produccion(p_clave_idempotencia uuid, p_tipo text, p_nombre text, p_observaciones text)
crear_unidad_produccion(p_clave_idempotencia uuid, p_lugar_id uuid, p_tipo text, p_nombre text, p_observaciones text)
configurar_unidad_produccion(p_clave_idempotencia uuid, p_unidad_id uuid, p_vigente_desde date, p_capacidad_lechugas integer, p_cantidad_gallinas integer, p_observaciones text)
```

Los campos no aplicables se envían como NULL. El tipo de unidad para configurar
se consulta en el servidor; no se confía en el tipo enviado por el navegador.
La clave idempotente permanece estable durante los reintentos de cada formulario.
Luego de éxito se bloquea el formulario y se ofrece continuar con una solicitud nueva.
Los datos introducidos se conservan ante errores; no se exponen errores SQL crudos.
El gallinero usa la unidad automática creada por la RPC, presentada como Gallinas.
Capacidad de mesones > 0; gallinas >= 0; enteros PostgreSQL; fecha real y finita;
nombres de hasta 160 caracteres y observaciones de hasta 2000.

## Bloqueos del contrato aplicado

1. No existe estado activo, fecha de baja ni RPC de desactivación. Se muestran todos
   los lugares registrados; no se inventa un filtro de activos.
2. No existe RPC para editar lugares/unidades. Todas las tablas rechazan UPDATE,
   DELETE y TRUNCATE mediante triggers. No se ofrecen edición de nombre, tipo u
   observaciones originales ni escrituras directas para sortearlo.
3. Configurar agrega una fila histórica; no edita las anteriores. Una misma unidad
   no puede tener dos configuraciones con el mismo vigente_desde. La UI lo informa.
4. Flores y suelo no admiten configuración de capacidad en la RPC existente.

No es imprescindible SQL complementario para las funciones implementadas. Por eso
no se propone una migración que cambie silenciosamente el contrato inmutable.
Para habilitar edición/desactivación se requiere diseñar y aprobar por separado
un contrato de revisiones/estados con RPC tipadas, auditoría e idempotencia, y definir
cómo afecta a consultas por fecha y unidades hijas. Estas funciones quedan bloqueadas
hasta disponer de dicho contrato. No se modificaron migraciones históricas.

Fuera de alcance: actividades, estadísticas y rol Temporero/a. No hay cambios en
módulos comerciales; solamente se incorpora el enlace de navegación solicitado.

## Verificación

Revisión estática del contrato SQL, nombres de tablas/columnas y firmas de RPC,
separación de layouts, validación y flujo de formularios. ESLint sobre los archivos
nuevos y los dos archivos de navegación modificados terminó sin errores. No se ejecutaron tests,
builds ni validaciones contra Supabase. La ejecución en navegador y base de datos
queda pendiente para una sesión en que se autorice esa validación.
