# Carga inicial del catálogo — revisión estática

## Evidencia y alcance de la causa

La portada carga productos y categorías en paralelo y después las asignaciones de
secciones. Cualquier error de esas tres lecturas sustituía todo el catálogo por
«No pudimos cargar el catálogo». Los errores originales se descartaban.

Todas esas lecturas creaban clientes SSR independientes con las cookies del
visitante (`src/lib/supabase/server.ts`). El SDK instalado obtiene el token mediante
`auth.getSession()` antes de ejecutar REST (`SupabaseClient._getSessionToken` y
`_getAccessToken`). Por tanto, un catálogo público dependía innecesariamente de la
sesión y su renovación, incluso en paralelo con `obtenerIdentidadActual` del layout.
El proxy no cubría `/`; las renovaciones durante el render no podían persistirse:
el cliente SSR captura el rechazo de escritura de cookies de Server Components.
Este defecto del flujo está demostrado por código y es compatible con el regreso
tras horas de inactividad. No hay registros HTTP de la visita fallida que permitan
afirmar que una renovación, un arranque en frío o un fallo concreto de red fue el
desencadenante del incidente de producción.

El SDK instalado ya reintentaba transporte y HTTP 503/520, pero sin un plazo propio
en estas consultas. No sería correcto atribuir el fallo a ausencia total de retries.

## Corrección y archivos

- `src/lib/supabase/storefront.ts` (nuevo): cliente exclusivamente público, sin
  persistencia, cookies ni renovación. Mantiene la clave pública y RLS; no usa
  credenciales privilegiadas. Lecturas GET con `no-store`, máximo dos intentos
  secuenciales, 8 segundos por intento incluyendo lectura del cuerpo y 400 ms
  entre intentos. Reintenta transporte, timeout y HTTP 408/429/502/503/504/520/522/524.
  Desactiva retries del SDK para evitar multiplicación. Respeta cancelación externa.
- `src/lib/storefront-catalog.ts`: usa ese cliente para las lecturas públicas,
  conserva filtros, relaciones, precios y mapeo. Memoiza productos y categorías
  solo durante el render mediante React `cache`, sin caché persistente ni datos
  de otra sesión. Conserva el error original como causa y registra operación/código.
- `src/proxy.ts`: incluye `/` y `/catalogo/:path*` para renovar y guardar la sesión
  antes de que el layout lea la identidad. No cambia comprobaciones de permisos.
- `src/app/(public)/page.tsx`: respeta excepciones internas de Next mediante
  `unstable_rethrow`, registra el fallo final y mantiene el mensaje si no se recupera.
- Este informe.

## Revisión final y límites

Se revisaron portada, layout/identidad, clientes Supabase, proxy, SDK instalado,
componentes de categorías/productos, configuración Next y revalidaciones del
administrador. Se leyeron las guías locales de Next para fetch, cookies, proxy y
excepciones internas. Las políticas y grants versionados permiten estas lecturas
al rol anónimo; no se verificó el estado desplegado de RLS. No se encontró registro
de Service Worker ni implementación de caché PWA en el repositorio.

El layout usa cookies y la ruta es dinámica; no hay `use cache`, `unstable_cache`
ni configuración de caché persistente del catálogo. `no-store` hace explícito que
las lecturas no deben guardar errores o precios obsoletos. Las revalidaciones
existentes del administrador se mantienen. La memoización evita lecturas iguales
de productos/categorías en el mismo render; un reintento solo repite la lectura
fallida, nunca toda la portada. La portada tiene dos fases de consultas y puede
consumir aproximadamente 32,8 segundos si ambas agotan sus plazos, sin contar
autenticación del layout/proxy ni latencia del hosting.

No se cambiaron carrito, autenticación de escrituras, permisos, metadatos SEO,
categorías, datos ni precios. El catálogo no introduce productos de respaldo ni
oculta errores permanentes. Las consultas de identidad mantienen su tratamiento
existente y dependen de disponibilidad de Auth; esta corrección no garantiza
servicio ante una caída sostenida de Supabase o un límite menor del hosting.

Validación exclusivamente estática: no se ejecutaron SQL, migraciones, Supabase
CLI, tests, builds, ESLint, TypeScript CLI, commits ni push. No se realizaron
solicitudes a producción ni se verificaron en navegador visitas nuevas o sesiones
vencidas. Esos escenarios requieren comprobación posterior en un entorno autorizado.
