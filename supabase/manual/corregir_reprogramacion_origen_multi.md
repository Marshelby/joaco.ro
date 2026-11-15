Revisión estática — NO INSTALAR

El contexto confirmado de HL-000081 se acepta: entrega fallida, preparación
finalizada, Cliente ausente auditado, ruta multi cerrada con evidencia y sin
venta definitiva. El bloqueo legacy está identificado. No se encontraron
resultados ejecutados de producción; los SQL de diagnóstico son consultas.

El archivo corregir_reprogramacion_origen_multi.sql conserva el borrador previo
con un bloqueo explícito antes de cualquier DDL funcional. No es definitivo y
no debe retirarse el bloqueo para intentar instalarlo. No se agregaron nuevas
ramas funcionales basadas en contratos supuestos.

Hallazgos que impiden declarar seguridad completa:
- ruta_multi_pedidos tiene PK por pedido y representa pertenencia vigente en el
  modelo local. Liberarla permitiría asignación explícita en otra jornada. Cierre,
  eventos, autorizaciones y auditoría deben permanecer íntegros; no reabrir rutas.
- leer_rutas_multiples calcula pedidos y contadores desde miembros vivos incluso
  en rutas cerradas. Retirar la pertenencia cambia esa lectura histórica.
  Además, admin/rutas/page.tsx busca las tarjetas entre pedidos de la fecha actual:
  conservar IDs históricos en la RPC tampoco resuelve por sí solo las tarjetas.
- leer_intentos_pedido_admin expone cierres legacy solamente. Debe contrastarse
  su definición instalada antes de decidir cómo exponer el cierre multi.
- Las huellas del borrador no certifican triggers, FK entrantes, ACL ni FORCE RLS.
  El borrado no tiene capacidad multi exacta propia en el borrador; se debe decidir
  si las barreras reales lo permiten y cómo limitarlo sin abrir permisos generales.

Resultados SELECT pendientes, completos y sin truncar, del archivo
supabase/manual/diagnostico_hl_000081_reprogramacion.sql:
1. Bloque 1: todas las firmas, definiciones, propietarios, configuraciones y ACL;
   incluye ahora las lecturas históricas y de reparto, operación legacy y barreras
   adicionales. Una función ausente también es un resultado relevante.
2. Bloque 3: filas del pedido, preparación, versiones, fallo, pertenencia vigente,
   ruta con cierre y eventos completos, selección legacy y entregas definitivas.
   Esto contrasta la forma exacta de la evidencia; no cuestiona el contexto confirmado.
3. Bloque 4: los tres SELECT completos: triggers y cuerpos; restricciones propias
   y referencias entrantes multi/legacy; propietarios, ACL, RLS y políticas.
   Se amplió cobertura a tablas legacy, capacidades, autorizaciones y auditoría.
No hace falta ejecutar RPC ni instalar complementos para obtener esos resultados.
El bloque 2 solo explica el rechazo legacy. El SELECT separado
verificar_cierre_multi_hl_000081.sql es auxiliar y no sustituye contratos/barreras.

Flujo revisado estáticamente:
- Lectura de fechas y confirmación deben compartir elegibilidad multi/legacy;
  preservar permisos admin, versión, locks, reintento, auditoría y ausencia de venta.
- El borrador conserva calendario, corte America/Santiago y horizonte de 14 días;
  devuelve listo_despacho/incluido=false y no inserta asignación multi automática.
- La nueva jornada local lista pedidos por fecha y estado listo_despacho sin
  pertenencia como disponibles, aunque existan rutas. La selección es explícita.
- Frontend distingue fallo de fechas de lista vacía; bloquea confirmación sin
  versión/fecha, muestra errores de evidencia y conserva clave/contenido ante
  respuesta incierta. Valida respuesta y refresca tras éxito. No se modificó.
- La doble llamada a iniciar_operacion en la rama legacy no duplica auditoría
  en el contrato local: solo completar_operacion registra e incrementa versión.

Se detiene el parche funcional hasta recibir los SELECT anteriores. Tras
contrastarlos habrá que resolver las lecturas históricas y recién entonces
producir un único SQL definitivo. No se ejecutaron SQL, migraciones, Supabase CLI,
tests, builds, ESLint, TypeScript CLI, commits ni push. No se modificaron datos
ni cambios preexistentes del frontend.
