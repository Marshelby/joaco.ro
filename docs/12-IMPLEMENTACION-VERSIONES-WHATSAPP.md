# Implementación de solicitudes WhatsApp y versiones

## Archivos de esta intervención

- `src/components/posibles-pedidos/whatsapp-form.tsx`
- `src/lib/posibles-pedidos/contrato.ts`
- `src/lib/posibles-pedidos/servidor.ts`
- `src/lib/posibles-pedidos/http.ts`
- `src/lib/posibles-pedidos/mensaje.ts`
- `src/lib/posibles-pedidos/administracion.ts`
- `src/app/(admin)/admin/posibles-pedidos/page.tsx`
- `src/app/(admin)/admin/posibles-pedidos/[id]/page.tsx`
- `supabase/migrations/20261101010000_versiones_solicitudes_whatsapp.sql`
- Este documento.

Se conservaron los cambios locales preexistentes, incluidos los de archivos compartidos con esta intervención. No se modificaron checkout tradicional, configuración de entorno ni otras áreas.

## Comportamiento implementado

El botón muestra «Procesando pedido...» y queda deshabilitado durante el registro. WhatsApp se abre al 56954878711 después de validar la respuesta de la RPC. El mensaje contiene referencia estable, número de versión, nombre, teléfono, localidad y observaciones, fecha solicitada, productos, cantidades, precios, subtotal, despacho y total calculados en PostgreSQL. WhatsApp requiere que el cliente pulse Enviar dentro de su aplicación.

La localidad se conserva en observaciones, reutilizando el contrato existente. No se inventan coordenadas ni una dirección verificada. La dirección georreferenciada del cliente comercial se exige en la conversión existente.

«Preparar una nueva versión» es una acción explícita después de un registro confirmado. Crea una intención independiente, incluso si los datos coinciden. Se pueden modificar los datos del formulario y los productos mediante el carrito. Los reintentos conservan clave, secreto y datos; los intentos inciertos no caducan silenciosamente. Las credenciales de la raíz y la intención se conservan en la sesión del navegador; no se incorporan al mensaje de WhatsApp ni a URLs.

## Modelo y RPC

Se reutiliza `posibles_pedidos`: `solicitud_id` identifica el grupo estable, cuya cabecera es la fila `numero_version = 1`. Las restantes filas son versiones con sus propias líneas, snapshots e historial. `numero_version` (1–5) es distinto de `version`, que sigue siendo el contador de concurrencia para cambios administrativos. No se reinterpretan las revisiones previas como versiones intencionales. Cada solicitud anterior conserva su identidad y pasa a ser un grupo independiente con una versión.

La RPC `registrar_posible_pedido_whatsapp` conserva su nombre y siete argumentos existentes y añade `p_solicitud_clave` y `p_solicitud_secreto`, opcionales. PostgreSQL reemplaza la firma anterior por la ampliada, con valores por defecto para llamadas antiguas. Para crear otra versión exige prueba del secreto de la cabecera, bloquea esa fila, recupera primero cualquier reintento confirmado y luego comprueba cierre y máximo de cinco. Las versiones nuevas consumen las cuotas antiabuso existentes; los reintentos válidos no. Las claves y hashes privados no aparecen en la respuesta pública.

`pp_bloquear_admin` bloquea primero la cabecera del grupo; `pp_exigir_abierto` comprueba el cierre de cualquiera de sus versiones. Las RPC administrativas existentes reutilizan estos helpers. La conversión existente mantiene pedido, cargo, vínculos e historial en una sola transacción. Un índice único parcial impide además dos conversiones para el mismo grupo. Convertir o descartar cualquier versión impide nuevas versiones y operaciones sobre las restantes, pero permite recuperar el resultado de un reintento ya confirmado.

La vista `solicitudes_posibles_pedidos`, con `security_invoker`, ofrece una tarjeta por grupo y muestra la versión cerrada o, en grupos abiertos, la última. Su referencia pública proviene siempre de la cabecera. RLS y permisos administrativos de lectura siguen vigentes. La vista no concede acceso anónimo. El detalle permite desplegar cada versión con datos, productos e importes, seleccionarla y usar las operaciones existentes. Su historial administrativo se consulta en la versión seleccionada.

## Pendientes para producción

1. Revisar y aplicar la migración nueva con un operador autorizado, después de sus dependencias de octubre. Desplegar aplicación y migración de forma coordinada: el código requiere las nuevas columnas y la vista. La aplicación anterior puede seguir invocando los siete argumentos por defecto de la RPC ampliada.
2. Validar en un proceso autorizado: registro y WhatsApp, respuesta incierta seguida de reintento, cinco versiones y rechazo de la sexta, cuotas, RLS, conversión simultánea de versiones diferentes, descarte y recuperación de reintentos después del cierre. No se ejecutó ninguna de estas comprobaciones en esta intervención.
3. Verificar la configuración existente de registro y fase administrativa en producción sin exponer secretos.

## Límites y decisiones

- No se ejecutaron pruebas, compilaciones, Docker, instalaciones, auditorías generales ni entornos adicionales. Solo se realizó lectura y revisión estática del cambio. La migración no fue ejecutada, ni localmente ni en Supabase remoto.
- No se ejecutaron commit ni push; se preservaron los cambios locales.
- Se mantienen las cuotas actuales: 300 altas/h globales, 10 altas/10 minutos para todo el canal público y 5 altas/h por teléfono. Son independientes del máximo de cinco versiones por solicitud y pueden impedir temporalmente una nueva versión antes de alcanzar ese máximo. No se amplían sin una decisión operativa.
- La recuperación entre dispositivos y el inicio de otra solicitud independiente tras finalizar este flujo no se incorporan: no existe aquí un mecanismo autorizado de recuperación de identidad. No se agrupan registros históricos por teléfono ni se vinculan clientes automáticamente.
- El flujo requiere Web Locks, Web Crypto y almacenamiento disponible. Una recuperación inconsistente bloquea el envío para evitar duplicados.
- El comando inicial `python` no estaba disponible; los scripts de edición se ejecutaron con `python3`. Esto no ejecutó la aplicación ni la migración.
