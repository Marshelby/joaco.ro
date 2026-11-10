# Producción — Fase 1 (local, pendiente de validación)

Archivo aplicable: `supabase/migrations/20261109100000_crear_base_produccion.sql`.
No se aplicó SQL ni se ejecutaron pruebas, builds o comandos de Supabase.
No se localizó una auditoría específica de Producción en los archivos del repositorio;
se implementó el contrato solicitado siguiendo las convenciones SQL existentes.
No hay frontend ni relación con entidades comerciales o contables.

## Contrato

- `produccion_lugares`: nave o gallinero, nombre y observaciones.
- `produccion_unidades`: meson/flores/suelo dentro de nave; avicola dentro de
  gallinero. La creación del gallinero crea su unidad automáticamente. Índice
  único y restricción diferida garantizan exactamente una unidad avícola.
- `produccion_configuraciones_unidad`: capacidad positiva de lechugas en mesones
  o cantidad entera no negativa de gallinas en unidades avícolas. Cada inicio de
  vigencia es único por unidad; termina al comenzar la siguiente configuración.
  Se permiten altas con fechas anteriores y futuras. Antes de la primera fecha
  no existe configuración, nunca se presupone cero. Configurar no registra compras,
  pérdidas ni movimientos de aves. Las actividades no requieren configuración previa.
- `produccion_actividades`: identidad, unidad y autor originales inmutables.
- `produccion_actividad_versiones`: datos completos de cada registro, corrección
  o anulación; fecha operativa independiente de la fecha de registro. La última
  versión representa el estado actual. La anulación conserva los datos, exige
  motivo y es terminal. No se suman versiones históricas en reportes.

Se permiten múltiples actividades iguales por día: no hay unicidad por fecha/tipo.
Suelo no admite actividades, tampoco libre, en esta fase.

Cantidades positivas menores de 10^12. Huevos y plantación/cosecha/pérdidas de
mesones: enteros en `unidad`. Alimentación y compra de alimento: `kg` o `g`.
Cosecha de flores: enteros en `unidad` o `ramo`. Riego, fertilización, tratamiento
 y libre admiten cantidad opcional emparejada con unidad (`unidad`, `kg`, `g`,
`litro`, `ml`, `ramo`). Libre exige observaciones. No hay importes monetarios.

Todas las filas son inmutables. Lugares y unidades no se renombran ni se cambian
 de tipo en esta fase. Las configuraciones se agregan por nueva fecha; no se
sobrescribe una fecha existente. Una futura corrección de configuración en la
misma fecha requerirá un contrato explícito de revisiones, sin eliminar originales.
Los UUID de autor no tienen FK para conservar auditoría si se elimina una cuenta.

## RPC habilitadas para authenticated, con comprobación administrativa interna

Todas reciben primero `p_clave_idempotencia uuid`, sin valores predeterminados;
los parámetros opcionales de negocio se envían explícitamente como NULL.

| RPC | Parámetros restantes en orden |
| --- | --- |
| `crear_lugar_produccion` | tipo text, nombre text, observaciones text |
| `crear_unidad_produccion` | lugar_id uuid, tipo text, nombre text, observaciones text |
| `configurar_unidad_produccion` | unidad_id uuid, vigente_desde date, capacidad_lechugas integer, cantidad_gallinas integer, observaciones text |
| `registrar_actividad_produccion` | unidad_id uuid, fecha_operativa date, tipo_actividad text, cantidad numeric, unidad_medida text, observaciones text |
| `corregir_actividad_produccion` | actividad_id uuid, version_esperada bigint, fecha_operativa date, tipo_actividad text, cantidad numeric, unidad_medida text, observaciones text, motivo text |
| `anular_actividad_produccion` | actividad_id uuid, version_esperada bigint, motivo text |

Los nombres de parámetros SQL tienen prefijo `p_`. Una corrección reemplaza el
contenido completo, manteniendo unidad e identidad. No es un parche parcial.
La versión esperada evita sobrescribir correcciones concurrentes. Las RPC devuelven
JSON con identificadores y, para actividades, versión y evento.

Tipos exactos: avícola `colecta_huevos`, `alimentacion`, `compra_alimento`, `libre`;
mesón `plantacion`, `cosecha`, `perdidas`, `fertilizacion`, `riego`, `libre`;
flores `cosecha`, `riego`, `tratamiento`, `libre`.

La misma clave y solicitud del mismo actor devuelve el resultado original,
aunque después existan nuevas versiones. Reutilizar una clave con otra operación,
actor o parámetros falla. Cada operación completa se confirma o revierte junta.
`produccion_privado.operaciones` conserva solicitudes y resultados; no es accesible
por API. Los bloqueos de idempotencia preceden a los bloqueos de entidad.

RLS habilitado y forzado; solo lectura administrativa. Sin DML directo ni acceso
anon/service_role por ACL. Las RPC SECURITY DEFINER pertenecen a postgres, fijan
search_path y exigen auth.uid() y public.es_admin(). Los auxiliares privados no
tienen EXECUTE para roles API. El punto privado de autorización permite extender
la política en una fase posterior; no se crea rol Temporero/a ni se altera rol_perfil.

## Pasos manuales pendientes (no ejecutados)

1. Revisar y aprobar el contrato, incluyendo unidades de medida y la política de
   configuraciones por fecha. Confirmar que public.es_admin(), auth.uid() y los
   roles PostgreSQL del proyecto existen en el destino autorizado.
2. Aplicar únicamente la nueva migración, mediante el procedimiento autorizado,
   primero en una base aislada con las migraciones anteriores. El archivo incluye
   BEGIN/COMMIT; no aplicar dos veces ni copiarlo como otra migración.
3. Validar allí: RLS/ACL como anon, cliente, administrador y service_role; rechazo
   de DML directo; rollback atómico; gallinero con exactamente una unidad;
   incompatibilidad lugar/unidad; configuraciones por fecha; todas las combinaciones
   de actividad/cantidad/unidad, NULL y valores no finitos; suelo reservado;
   múltiples registros iguales por día; correcciones y anulaciones con motivo;
   inmutabilidad, DELETE/TRUNCATE; lectura histórica y baja de usuario.
4. Validar reintentos exactos, claves reutilizadas con otro actor/contenido,
   reintentos después de correcciones, altas simultáneas con la misma clave,
   correcciones concurrentes y corrección frente a anulación con versión esperada.
5. Revisar resultados antes de autorizar despliegue. Luego podrá implementarse el
   frontend en otra fase. Esta entrega no certifica ejecución ni despliegue.
