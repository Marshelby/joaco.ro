# Hidro Leufu: fase 1/3, ámbitos de direcciones

Implementación local en `supabase/migrations/20261101030000_separar_ambitos_direcciones_cliente.sql`. No aplicada ni validada contra un servidor. Esta nota sustituye, para este cambio, la indicación antigua de editar la migración administrativa en `12-FASE2-DIRECCIONES-SIMPLIFICADAS.md`: la creación administrativa ya funciona en producción según el contexto recibido; ninguna migración anterior se modifica.

## Evidencia revisada

- Núcleo `20260810041535` y hardening `20260810042236`: tabla, UUID, FK a clientes/pedidos, dos políticas, grants, índice único de principal **activa** por cliente y trigger de fecha. Logística `20260814110000` y autogestión vigente `20260815090000`; desactivación en `20260812100000`.
- Administración vigente `20261101020000`: autorización, huella, comprobantes, revisión, asociación atómica y bloqueos. Ayudantes/convertidor en `20261022012000`, con bloqueo/versionado actualizado por `20261101010000`.
- Checkout vigente de siete parámetros `20260827110000`; las firmas de cinco y seis fueron retiradas por `20260827111000` y `20260827112000`. No se recrean. Se conservaron precios, despacho, fechas, métodos de pago e idempotencia.
- Invitaciones: definición final `20260819114000`; la comprobación de historial considera cualquier dirección y permanece intacta. Rutas: `20260907040910`, `20260907040959`, `20260907120822`, `20260907120938`; sincronización usa snapshots con fallback a dirección por UUID, sin exigir ámbito.
- Lecturas locales de cuenta/checkout y selector `src/lib/posibles-pedidos/administracion.ts`; este último consulta directamente direcciones. No se modifica frontend. No se infiere el esquema remoto a partir de estas fuentes.

## Contrato SQL y permisos

Una sola tabla; `ambito text NOT NULL CHECK (ambito IN ('personal','comercial'))`. El DEFAULT personal existe sólo durante ADD COLUMN para clasificar todas las filas históricas sin UPDATE ni alterar fechas. Se retira inmediatamente: los INSERT futuros deben indicar ámbito. El origen histórico **no está demostrado**; personal es una clasificación provisional, incluso para direcciones previamente creadas por administración. Conserva UUID, contenido, actividad y principales existentes; no demuestra consentimiento ni procedencia.

La nueva unicidad es `(cliente_id, ambito) WHERE es_principal AND activa`. Se comprueban duplicados antes de crear el índice nuevo y retirar el antiguo dentro de la misma transacción. No se impone unicidad a principales inactivas ni obligación de tener principal; no se corrigen datos automáticamente. El único trigger local de direcciones es el de fecha; no existe un trigger local que sincronice principales.

| Vía | Lectura | Escritura |
| --- | --- | --- |
| Cuenta web sin rol admin | Sólo personales propias, mediante RLS | RPC de autogestión: personal literal del servidor; ownership y actividad exigidos |
| RPC de ficha administrativa | Sólo comerciales, también en revisión | Comercial literal; rechaza UUID personales, de otro cliente y campo `ambito` en JSON |
| SELECT directo de administrador | Ambos ámbitos, para conservar el selector operativo de conversión | Sin DML directo |
| Conversión administrativa | Ambos ámbitos, con autorización y requisitos logísticos existentes | Crea pedido/snapshots; no modifica dirección |

Se revocan todos los privilegios de tabla a PUBLIC/anon/authenticated/service_role y se concede sólo SELECT a authenticated. Se reemplazan las dos políticas conocidas por lectura personal propia y lectura operativa admin. Sin políticas de escritura: RLS también deniega INSERT/UPDATE/DELETE directos aunque se concediese nuevamente DML. Un usuario web sin rol admin no puede consultar ni alterar comerciales aun conociendo su UUID. El administrador conserva lectura operativa de personales; la separación de gestión se aplica a las RPC, no pretende ocultar direcciones a la operación logística autorizada.

Las cinco RPC reemplazadas son SECURITY DEFINER, owner postgres, `search_path = pg_catalog`, referencias de aplicación calificadas; sólo authenticated recibe EXECUTE y cada RPC verifica sesión/rol o pertenencia. No se crea una vía API de reclasificación. Postgres/otros roles privilegiados quedan fuera de la frontera RLS normal. Los consumidores de service_role que dependieran de acceso directo deben revisarse fuera de esta sesión; no se encontraron en `src`.

## Concurrencia, reintentos y compatibilidad

Autogestión serializa por cliente antes de bloquear direcciones personales en orden UUID y zona; desactivación bloquea cliente y su dirección personal. Cambiar principal nunca actualiza otro ámbito. Administración conserva clave/huella/autor originales, orden operación → posible pedido → cliente → direcciones comerciales ordenadas → zonas ordenadas y asociación en la misma transacción. La revisión incluye ficha de cliente y sólo direcciones comerciales; una modificación puramente personal no la invalida. Cambios a la ficha compartida del cliente sí pueden invalidarla.

Los comprobantes anteriores se mantienen íntegros. Su respuesta de reintento se filtra: sólo snapshots marcados comercial cuyo UUID aún pertenece al cliente y al ámbito comercial; un snapshot sin ámbito no acredita origen comercial. Se recalcula revisión sobre la ficha filtrada. Los reintentos posteriores conservan su respuesta mientras no haya reclasificación; nunca repiten creación/asociación. **Un reintento anterior a esta fase no devuelve exactamente el JSON antiguo**: se omiten direcciones y cambia revisión por privacidad. Refrescar ficha tras cualquier reintento y al iniciar una edición después del despliegue; una revisión anterior puede producir `40001`.

Checkout selecciona exclusivamente personal (también si lo invoca un admin, por ser canal web), activa y del cliente; bloquea cliente/dirección/zona con FOR SHARE para preservar la selección durante la transacción. Un reintento de pedido ya creado conserva la recuperación previa y no revalida su dirección histórica. Conversión permanece sin cambios: admite personal/comercial, activa, del cliente activo, coordenadas válidas y zona activa. Una dirección comercial simplificada sigue sin poder convertirse hasta completar logística. Mantener lectura operativa admin evita romper el selector actual, incluidas direcciones históricas provisionales.

No se actualizan pedidos previos, FK, snapshots, importes, pagos, deuda, invitaciones, rutas ni paradas. Las referencias operativas existentes siguen resolviendo ambos ámbitos. Las direcciones históricas dejan de aparecer en la ficha comercial hasta reclasificarlas; las invitaciones no convierten automáticamente direcciones comerciales en personales.

## Límites, reclasificación y fase 2

La migración es una transacción BEGIN/COMMIT con `lock_timeout = '5s'` y bloqueo ACCESS EXCLUSIVE de direcciones; DDL/índice no concurrente y ACL se publican juntos. Un error revierte todo; desplegar en ventana adecuada y, ante timeout/deadlock, reintentar la migración completa tras resolver la causa. No es un script para reaplicar después del éxito.

Los controles iniciales abortan ante conjuntos de políticas/triggers desconocidos, firmas ausentes/sobrecargas extra o principales activas duplicadas. No certifican que los cuerpos remotos coincidan con los locales ni detectan toda dependencia externa. Antes de aplicar debe contrastarse el esquema real (cuerpos, políticas, triggers, índices, constraints, vistas, grants y consumidores) con estas fuentes: cualquier diferencia sin evidencia bloquea el cambio correspondiente y requiere revisión, sin borrar estructuras para forzar el despliegue. No hubo un bloqueo concreto en las definiciones locales revisadas; sigue pendiente la comprobación del remoto.

La reclasificación futura requiere evidencia por UUID y una intervención privilegiada auditada separada: registrar actor, motivo, evidencia y valores anteriores/finales en el mecanismo de auditoría aprobado; no se presume una tabla de auditoría inexistente. En una transacción bloquear clientes en orden UUID, luego direcciones afectadas en orden UUID; comprobar pertenencia, ámbito esperado y principal activa del destino; abortar si hay colisión, sin desmarcar principales ni reasignar cliente automáticamente. Cambiar sólo ámbito de UUID explícitos, nunca inferirlo por canal de un pedido, usuario vinculado o falta de usuario. Conservar referencias/snapshots/comprobantes. El trigger existente actualizará fecha; refrescar revisiones y revisar efecto sobre disponibilidad en checkout. Hasta acordar evidencia y auditoría, no ejecutar reclasificaciones.

Fase 2: adaptar filtros/etiquetas de ámbito y refresco de revisiones, conservar la selección operativa de ambos ámbitos, y validar en entorno autorizado aislamiento RLS y DML directo, UUID cruzados, principales independientes, reintentos anteriores/nuevos, concurrencia, rollback de asociación, checkout comercial rechazado, conversión de ambos ámbitos y referencias históricas/rutas. Validación realizada aquí: inspección estática y `git diff --check` (incluidos archivos nuevos). No se ejecutaron SQL, MCP, Supabase remoto, Docker, builds, tests, instalaciones, commit ni push.
