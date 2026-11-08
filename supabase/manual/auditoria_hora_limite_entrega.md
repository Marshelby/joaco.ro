# Auditoría acotada del guardado de hora límite

## Evidencia local

- `delivery-days-settings.tsx`: formulario independiente, `useActionState`, campo `horaCorte`, `type=time`, minutos completos, submit deshabilitado mientras guarda. El nombre coincide con la Action. No hay conversión UTC.
- `configuracion/actions.ts`: firma `(estadoAnterior, FormData)` correcta. Valida HH:mm, autentica con `getUser()` y llama a `guardar_hora_corte_administrativa` con la clave exacta `p_hora_corte`. Ahora envía HH:mm:00 explícito, verifica `es_admin()` y comprueba la persistencia antes del mensaje de éxito.
- `lib/supabase/server.ts`: cliente SSR por petición, URL y clave pública desde entorno, cookies de la sesión; no usa service role. La Action puede renovar cookies. No se encontró un defecto local del cliente que justifique cambiarlo.
- SQL manual: `public.guardar_hora_corte_administrativa(p_hora_corte time without time zone) returns void`. `time` es alias de ese tipo. El JSON enviado coincide; HH:mm ya era válido para ese tipo. La normalización no es la causa del fallo anterior.
- Permisos declarados: `SECURITY DEFINER`, propietario postgres, search_path pg_catalog, EXECUTE para authenticated, sin EXECUTE para PUBLIC/anon, comprobación interna de `auth.uid()` y `public.es_admin()`. No requiere conceder UPDATE al usuario web. La tabla permite SELECT administrativo por RLS. El trigger local solo actualiza `fecha_actualizacion`.
- La migración de corte fijo imponía 16:00. El SQL manual aplicado elimina esa restricción y agrega validación de minutos; no hay evidencia para afirmar que ese SQL falló.

## Causa y límites de la conclusión

El mensaje genérico provenía de `mensajesRpc[error.message] ?? "No fue posible guardar la hora límite."` en la Action. Descartaba código, mensaje técnico y contexto; además atribuía algunos errores automáticamente a SQL pendiente. Esto está comprobado y corregido.

El cuerpo SQL contenía `UPDATE public.dias_entrega SET hora_corte = p_hora_corte` sin WHERE. Es incompatible con una sesión con protección safeupdate activa, que puede emitir `UPDATE requires a WHERE clause` al ejecutar la función. CREATE FUNCTION puede responder Success sin ejecutar ese cuerpo. El archivo incremental corrige la sentencia con `WHERE hora_corte IS DISTINCT FROM p_hora_corte` y evita éxito vacío cuando no hay días.

No se consultó el proyecto remoto ni se ejecutó la RPC. Por eso safeupdate es una causa posible respaldada por la sentencia local, no una causa remota confirmada. Los permisos efectivos, configuración de sesión y definición desplegada se confirman con las consultas de catálogo del archivo manual y el diagnóstico del siguiente intento desde la aplicación.

## Diagnóstico seguro

La pantalla muestra etapa, código y referencia UUID. El servidor registra el mensaje real y hint bajo `[configuracion:hora-corte]`, con la misma referencia. Omite `details` (puede incluir filas), cookies, sesión y parámetros; redacta URLs, JWT y claves Supabase. Los mensajes técnicos arbitrarios no se devuelven al navegador. Un fallo de lectura posterior indica expresamente que la RPC ya terminó; no debe interpretarse como rollback.

## Paso manual

Ejecutar `supabase/manual/corregir_guardado_hora_limite_entrega.sql` en el mismo proyecto de la aplicación. Reemplaza solo la RPC de hora, conserva firma y permisos, no cambia horas existentes ni restricciones y recarga la caché de PostgREST. Al final incluye consultas de inspección de firma, definición, permisos, restricciones y horas persistidas. Después guardar desde `/admin/configuracion` con la versión local corregida; si falla, localizar la referencia en los logs del servidor.

Revisión realizada por lectura del código y del diff. No se ejecutaron tests, builds, SQL remoto, migraciones automáticas, commit ni push.
