# Selector de reprogramación de No entregados

Revisión estática de fuentes locales. No se consultó producción ni se ejecutó SQL.

## Causa identificada

`leer_fechas_reprogramacion_admin(uuid)` mezclaba elegibilidad y disponibilidad en un único SELECT: sus INNER JOIN con `carga_pedidos` incluido y `cargas` cerrada, más los filtros de preparación y venta, devolvían `[]` si el pedido no era elegible. `leer_resolucion_no_entregado_admin` solo devuelve versión e historial, no certifica elegibilidad. La acción aceptaba esa versión y el componente mostraba «No hay fechas habilitadas» para ambos casos.

La lista No entregados usa `estado='entrega_fallida'`, que no significa necesariamente intento físico cerrado: `preparacion_sin_stock_y_parciales.sql` registra ese mismo estado con origen `sin_stock_pre_despacho`, puede excluir la selección de carga y retira pertenencia multi; los fallos de rutas múltiples tampoco generan la selección y el cierre legacy que exige esta reprogramación. Son casos no elegibles bajo el contrato vigente, incluso con días comerciales disponibles. No se inventó una conversión de esos casos ni se relajó su evidencia histórica. Sin datos y definiciones instaladas no se puede afirmar cuál de esas condiciones corresponde al pedido reportado.

## Corrección y auditoría del flujo

- La RPC de lectura valida primero existencia, estado, preparación, ausencia de venta y entrega definitiva, selección incluida, carga anterior cerrada y evidencia exacta del intento/fallo/historial. Devuelve errores de dominio distintos; solo un pedido elegible puede recibir `[]` por falta real de fechas.
- La confirmación llama al mismo auxiliar después del retorno idempotente. Mantiene además sus comprobaciones originales bajo locks, versión esperada, capacidades privadas exactas, snapshots, historial, protecciones contables y comprobación final del corte. Una respuesta ya confirmada se recupera aunque después cambie la disponibilidad.
- Parámetro conservado: `p_pedido_id: id`, validado como UUID. Lectura y escritura mantienen `auth.uid()` y `es_admin()`. Lectura SECURITY DEFINER, search_path fijo, propietario postgres y EXECUTE solo para authenticated; auxiliares sin acceso para roles API. No se usan credenciales service_role.
- Se reutiliza `obtenerFechasEntregaDisponibles`, igual que `admin/pedidos/nuevo/actions.ts`, y se interseca con la lectura de disponibilidad operativa. La configuración compartida rechaza respuestas nulas/malformadas como error técnico. `[]` de días activos sigue siendo configuración realmente sin días habilitados.
- TypeScript y `fecha_entrega_disponible` usan America/Santiago, días activos, corte exclusivo y horizonte hasta hoy +14 inclusive; hoy solo antes del corte. La configuración vigente en migraciones fija anticipación cero y 16:00. No se agregan fechas para completar diez opciones. Se conserva máximo diez y fecha posterior al intento.
- El destino legacy admite ausencia de carga o carga en preparación. El destino multi admite rutas en planificación/preparación; en reparto requiere una versión reconocida con incorporación, fecha de hoy y repartidor activo asignado, conforme a `operar_ruta_multiple`. Un cierre individual no cierra toda la fecha si otra ruta admite pedidos. Se conserva la barrera ante coexistencia incompatible de carga legacy y rutas multi.
- En destino multi no se crea carga ni selección legacy: se retira solo la selección viva de origen mediante capacidad exacta y el pedido queda listo_despacho sin asignación automática. Seleccionar/incorporar exige su operación posterior con permisos y validaciones propios. No se habilitan orígenes multi por este cambio.
- Errores de consulta, RPC ausente y respuesta inválida muestran error; rechazo de elegibilidad muestra su causa; únicamente consulta exitosa con lista vacía muestra ausencia real. La versión permanece indefinida ante error y bloquea confirmar. Los fallos de configuración ya no se atribuyen automáticamente a sesión. El mensaje al confirmar jornada incompatible ahora refleja también rutas múltiples.

## SQL pendiente y límites

Archivo: `supabase/manual/corregir_reprogramacion_no_entregados.sql`, actualizado, **no ejecutado**. Instalación manual después de Fases 2, 3 y 4. Ahora permite actualizar también la revisión anterior de este complemento mediante sus huellas explícitas; usa CREATE OR REPLACE para la lectura existente. Contratos desconocidos abortan la transacción. No reinstalar Fase 4 sobre este complemento: aquella verifica cuerpos anteriores. Aplicación y SQL deben desplegarse coordinadamente; con la lectura antigua todavía instalada persiste su ambigüedad.

Revisados estáticamente contratos, permisos, dependencias opcionales de rutas multi, condiciones de fechas, orden de idempotencia y locks, errores y controles del formulario. No se ejecutaron tests, builds, ESLint, TypeScript CLI, SQL, migraciones, Supabase CLI, commits ni push. No se verificó ejecución PostgreSQL, zona horaria del servidor desplegado, configuración o estado del pedido en producción ni interfaz en navegador. Los cambios ajenos preexistentes en navegación/detalle de clientes y pedidos se conservaron.
