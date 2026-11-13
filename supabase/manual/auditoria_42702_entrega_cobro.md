# Auditoría estática 42702 — HL-000083

No se ejecutaron SQL, migraciones, Supabase CLI, build, tests, ESLint, TypeScript CLI, commits ni push. No se consultó producción. No hay validación real de resolución.

## Hallazgo y alcance de la evidencia

La definición local `public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)` de `20261108150000_confirmar_entrega_hubo_diferencias.sql` declara `i public.items_pedido%rowtype` y reutiliza `i` como alias de `public.items_pedido` dentro de `NOT EXISTS`. Las referencias `i.pedido_id` e `i.id` tienen dos candidatos: campos de la variable PL/pgSQL y columnas del alias SQL. Es una colisión demostrable en el texto local, susceptible de 42702 con resolución de conflictos en modo error. No demuestra por sí sola la función/línea que falló en producción: faltan definición instalada y CONTEXT del error original. Una configuración o directiva distinta puede cambiar la resolución.

El mensaje recibido contiene el código, pero el frontend no expone DETAIL/CONTEXT. `No hay resultado confirmado visible` es el resultado de una consulta posterior; no identifica una función SQL ni certifica por sí mismo la ausencia de todo movimiento remoto.

## Recorrido completo

1. `entrega-visual-dialog.tsx`: botón Confirmar entrega → `confirmar()`. Conserva solicitud, clave UUID, versión, cantidades, orden, cobro y selección de diferencias en sessionStorage antes de escribir. Los reintentos reutilizan la solicitud.
2. Con diferencias: `diferencias-actions.ts::confirmarEntregaDiferencias` → `resolverEntrega(s,true)`. Sin diferencias: `entrega-actions.ts::confirmarEntregaTodoCorrecto` → `resolverEntrega(s,false)`.
3. `entrega-confirmacion.ts::resolverEntrega`: primero llama `consultar_resultado_entrega`; recupera un comprobante propio o informa otra entrega persistida. Sólo si no existe resultado, llama la RPC de cinco argumentos correspondiente. Ante error o respuesta incompatible vuelve a consultar. `recuperarEntrega` utiliza el mismo lector sin escritura.
4. Ambas RPC: autorización → lock de cliente → `operativo_privado.iniciar_operacion` (lock de pedido, comprobación actor/operación/solicitud/versión, respuesta original en reintento) → validación estado/preparación/cobro/items. En diferencias aparece la colisión durante la validación de pertenencia, antes de insertar la venta.
5. Venta: inserción única en `entregas_definitivas` → snapshot/estado de pedido. Triggers de historial de estados, fecha, protección de venta/carga y, si están instaladas, barreras de rutas múltiples participan en la escritura.
6. Cobro: descuenta aplicaciones previas confirmadas; recorre efectivo y transferencia, omite importes cero, inserta pagos y aplicaciones validadas por `validar_aplicacion_pago`, registra `pagos_entrega` y `cobros_entrega`. Calcula restante y excedente con las reglas existentes.
7. `completar_operacion` vuelve a resolver idempotencia, avanza versión y conserva solicitud/resultado en `historial_operativo`. `exigir_cobro_entrega` comprueba al cierre transaccional la existencia del cobro y su suma. El lector recupera ese resultado persistido sin reconstruir importes.

## Revisión de variantes relacionadas

Se rastrearon definiciones y sustituciones en migraciones y SQL manuales de entrega real, integración contable, diferencias, auditoría operativa, correcciones de venta/pago, centralización contable, recuperación, contrato frontend, repartidores, cierre y rutas múltiples fases 2/3/compatibilidad, preparación parcial y confirmación única. También se revisaron triggers de pedidos, aplicaciones y barreras de rutas que pueden intervenir.

- Todo correcto (contrato 2, migración 140000): usa alias `i`/`pi`, pero no declara variables de fila `i`/`pi`; no presenta esta colisión. La firma antigua de cuatro argumentos fue retirada por esa migración: no debe restaurarse.
- Historial/iniciar/completar: columnas calificadas con `h`/`v`, parámetros `p_*`, variables `v_*`. Las listas de columnas de INSERT no son expresiones ambiguas.
- Recuperación: `pedido_id` y `clave_idempotencia` sin alias en consultas de una sola tabla no colisionan con sus parámetros `p_*` ni variables `h`, `e`, `op`, `s`. No son errores reales sólo por carecer de alias.
- Cobro mixto: `fila.metodo`/`fila.monto` identifican inequívocamente el registro del bucle; el alias de VALUES no convierte automáticamente las variables en referencias ambiguas. No se modifica orden ni aplicación del dinero.
- Triggers contables y diferido: no se identificó otra colisión entre sus variables y columnas utilizadas. La reactivación de aplicaciones es una vía separada que no se ejecuta en el INSERT ordinario de entrega.
- Repartidores fase 5 modifica el guard de todo correcto e iniciar_operacion. Rutas múltiples consume todo correcto y modifica capacidades/barreras; no reemplaza el cuerpo de diferencias en las fuentes revisadas. No se sobrescriben esos contratos, permisos o wrappers.
- Correcciones administrativas posteriores son vías separadas: no hay evidencia de que el botón las invoque. No se confunden sus definiciones históricas con la función vigente de entrega.

No se atribuyen errores a cada columna sin alias ni se aplica `#variable_conflict use_column/use_variable`, pues ocultaría colisiones y podría cambiar semántica.

## Artefactos y preservación

Único SQL nuevo: `supabase/manual/corregir_42702_entrega_cobro.sql`.

Sección A: transacción READ ONLY independiente; obtiene todas las funciones de public/operativo_privado (incluidas sobrecargas y atributos), triggers, constraints, vistas contables y estado mínimo de HL-000083. Requiere acceso del operador al catálogo/datos. Pedir además MESSAGE/DETAIL/HINT/CONTEXT de logs existentes; el diagnóstico no provoca otra confirmación.

Sección B: transacción independiente, sólo admite el cuerpo local exacto (normalizando CRLF para comparar) o el cuerpo ya corregido. Reemplaza el alias SQL `i` por `item_validacion` y sus dos referencias. Usa la definición instalada y comprueba que el resto de pg_proc permanece idéntico, incluido OID, ACL, argumentos, atributos y configuración. Ante firma/cuerpo desconocido aborta sin sobrescribir. Reejecución del parche corregido es no-op.

No modifica fuentes históricas para evitar simular una migración ya aplicada. No cambia frontend, datos, cálculos, estados, permisos, restricciones únicas, venta, deuda, snapshots, historial, rutas ni formato de idempotencia. Cualquier variante remota no disponible requiere completar evidencia y adaptar el parche antes de instalarlo; no se inventa su definición.

Se realizó una única revisión estática final de los dos archivos nuevos. Pendiente: evidencia remota y validación real controlada por el operador de diferencias/sin diferencias, efectivo/transferencia/mixto/por pagar y reintentos con la misma solicitud, verificando venta/cobro únicos y comprobantes persistidos.
