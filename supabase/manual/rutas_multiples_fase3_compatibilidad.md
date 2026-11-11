# Corrección de compatibilidad de Fase 3

Archivos nuevos:

- `rutas_multiples_fase3_compatibilidad.sql`: sustituto completo del incremental original; cambia exclusivamente precondiciones y comentarios. Desde el primer `LOCK TABLE` hasta `COMMIT`, el contenido es idéntico byte a byte al original.
- `verificar_compatibilidad_rutas_fase3.sql`: las mismas precondiciones corregidas, en transacción de solo lectura y sin el payload de instalación.

No se modificaron SQL históricos ni funciones instaladas. Tampoco se modificaron archivos de aplicación.

## Causa y corrección

Las tres precondiciones originales comparan `md5(prosrc)` con hashes calculados sobre los cuerpos de Fase 2 con LF. CRLF cambia esos bytes y produce un rechazo aunque el cuerpo coincida después de normalizar exclusivamente CRLF a LF. El diagnóstico existente ya distingue ambas representaciones y se conserva sin cambios.

Se usa `md5(replace(prosrc, chr(13)||chr(10), chr(10)))`, manteniendo los tres hashes originales. No se transforma `prosrc` persistido ni se ignoran CR aislados, espacios, comentarios u otros cambios. Se conservan firmas exactas, propietario postgres, dependencias explícitas, aislamiento de esquemas, controles de sesión y bloqueos originales.

Se agregan comprobaciones del contrato declarado en Fase 2: retorno jsonb, lenguaje, nombres/modos de argumentos, SECURITY DEFINER, volatilidad, atributos de ejecución y configuración de sesión. La ACL rechaza permisos adicionales, delegación de authenticated y ejecución efectiva de anon o service_role; no repara permisos antes de validar. Una diferencia real de metadatos o permisos aborta aunque coincida el hash.

Las dependencias directas conservan la comprobación original de firma y propietario; no se afirma verificar sus cuerpos mediante hashes. Las huellas MD5 son controles de compatibilidad, no firmas criptográficas de seguridad.

## Ejecución manual y límite de alcance

Con la restricción actual de no modificar funciones instaladas, ejecutar únicamente el archivo completo `verificar_compatibilidad_rutas_fase3.sql` en Supabase SQL Editor como postgres. Si todas las precondiciones se cumplen, devuelve `COMPATIBILIDAD_FASE_2_CORRECTA`. Ante un error, finalizar la transacción abortada con ROLLBACK antes de otra operación.

Esto no instala Fase 3 ni hace que el incremental original deje de rechazar CRLF. No ejecutar el original después de esta comprobación.

El archivo `rutas_multiples_fase3_compatibilidad.sql` queda preparado como sustituto del original para una instalación de Fase 3 cuyo alcance permita reemplazar las tres RPC. No ejecutarlo bajo la restricción actual: conserva exactamente los reemplazos operativos que ya contenía el incremental de Fase 3. No ejecutar ambos incrementales ni reinstalar Fase 2. Una segunda instalación de Fase 3 sigue abortando por los hashes de Fase 2.

## Revisión y riesgos

Una única revisión estática de la corrección, resolviendo en la misma pasada los hallazgos de metadatos, permisos y alcance de ejecución. Se cotejaron los tres hashes con los cuerpos locales de Fase 2 y se comparó el payload del incremental byte a byte. No se ejecutaron tests, builds, ESLint, SQL local/remoto, migraciones, comandos Supabase, commits ni push; no hubo conexión a producción ni escrituras remotas.

Pendiente: validación manual de los metadatos y ACL reales. El diagnóstico confirmado de los cuerpos no implica que esos atributos coincidan. Una divergencia abortará deliberadamente y debe investigarse sin quitar controles. La instalación efectiva de Fase 3 queda fuera del alcance que prohíbe reemplazar funciones instaladas.
