# Changelog

**Estado:** Activo.  
**Propósito:** Registrar cambios relevantes del proyecto de forma cronológica.  
**Última actualización:** 2026-08-01

Este archivo sigue el formato de [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las entradas deben agruparse, cuando corresponda, en `Agregado`, `Cambiado`, `Corregido`, `Eliminado`, `Obsoleto` y `Seguridad`.

## No publicado

### Agregado

- Listado administrativo mock de productos con búsqueda local, fichas responsive y visibilidad Activo u Oculto.

- Formulario administrativo mock compartido para crear y editar productos, con bloques de información, clasificación dependiente visualmente, precios, imagen única y estado.

- Editor mock de Secciones Inicio con cuatro escaparates editoriales, referencias ordenadas a productos existentes y controles visuales de selección, orden y retiro.

- Arquitectura visual mock de Categorías: relación tipo carpetas entre categorías y subcategorías, búsqueda local, rutas futuras y fuente taxonómica única compartida con el Home.

- Arquitectura visual mock del Panel Administrador: Dashboard informativo, navegación de cinco áreas y módulo de Secciones Inicio.

- Patrón reutilizable para enlaces de acción con variantes primaria, secundaria y discreta.
- Enlace para saltar al contenido principal y soporte global reforzado para reducción de movimiento.

- Inicialización del proyecto JOACO RO.
- Stack base: Next.js 16, App Router, TypeScript, Tailwind CSS v4, shadcn/ui, Base UI, preset Nova, Lucide, Geist, ESLint y npm.
- Documentación inicial de constitución, arquitectura, reglas de negocio, sistema de diseño, flujos, preparación de base de datos, RPCs, decisiones y roadmap.
- Base de Fase 1: aplicación migrada a `src/`, layouts públicos, de cuenta y administrativos, rutas demostrativas, navegación responsive y menú móvil accesible.
- Configuración centralizada de marca, rutas y flags informativos; mocks separados de navegación, carrito visual y usuario demostrativo.
- Componentes base de layout, encabezado, logo y estados vacío, carga y error.
- Metadata inicial de JOACO RO, idioma `es-CL` y corrección del token de fuente Geist Sans.
- Registro documental de la arquitectura aplicada, decisiones y cierre de Fase 1.
- Identidad visual inicial: azul petróleo, arena, blanco, grafito y terracota mediante tokens semánticos con modo oscuro coherente.
- Home base con Hero reutilizable, categorías y subcategorías mock de interfaz, y estado vacío para el catálogo futuro.
- Assets locales temporales y reemplazables para validar composición editorial sin usar productos ni imágenes externas.
- Integración del asset definitivo del Hero con composición de fondo en escritorio, versión apilada en móvil y eliminación del SVG temporal ya sin uso.
- Evolución del Home hacia descubrimiento: Lo más vendido, Oportunidades, Recién llegados, categorías como navegación secundaria y Todos los productos.
- Componentes reutilizables de secciones, grilla y tarjetas de producto, con precios en CLP formateados de forma centralizada.
- Productos mock centralizados y temporales para validar la experiencia sin catálogo real, rutas de detalle ni operaciones comerciales.
- Ajuste móvil del Hero: imagen primero, contenido después y eliminación del eyebrow duplicado de marca.
- Rails horizontales reutilizables para Lo más vendido, Oportunidades y Recién llegados, con scroll nativo, `scroll snap`, gesto táctil y flechas accesibles; Todos los productos permanece como grilla.
- Historial de pedidos mock de Mi Cuenta, con estados tipados, tarjetas reutilizables, formato localizado y enlaces al detalle existente.
- Fuente única de pedidos mock compartida por el resumen de cuenta y el historial, preparada para sustituirse por datos reales más adelante.
- Detalle de pedido mock con snapshots históricos de ítems, costos, entrega o retiro, pago, seguimiento e historial de estados.
- Listado mock de direcciones de cliente, con dirección principal centralizada, etiquetas de tipo y rutas visuales preparadas para agregar o editar.
- Sección mock de beneficios con campañas, promociones, sorteos y participaciones, además de estados, vigencia y ordenamiento centralizados.
- Catálogo público mock con búsqueda, filtro de categoría, ordenamientos respaldados por datos existentes, resultados en URL y estado sin coincidencias.
- Ficha pública mock de producto con resolución por slug, metadata dinámica, navegación contextual, precios mayoristas, disponibilidad honesta y productos relacionados derivados de la colección compartida.
- Sistema visual de imágenes con contratos tipados, fallbacks vectoriales por familia de producto, categorías diferenciadas, miniaturas preparadas para una galería real y snapshots visuales independientes en pedidos.
- Navegación pública refinada con Inicio, Catálogo y Mi Cuenta, estado activo accesible, menú móvil y Footer con proceso de compra honesto.
- Pulido de Mi Cuenta con navegación contextual superior, resumen sin accesos duplicados, estados de pedido centralizados y detalle con menos superficies anidadas.
- Consolidación transversal de estados vacíos y not-found mediante un patrón compartido y accesible.

### Cambiado

- La colección central de productos incorpora el estado visual de visibilidad administrativa, sin afectar la disponibilidad pública ni reglas comerciales.

- La navegación pública incorpora Administrador mientras la experiencia se mantiene abierta durante la etapa mock.
- La barra lateral administrativa se adapta como navegación completa en escritorio, compacta en tablet y drawer accesible en móvil.

- Refinamiento transversal de tipografía de encabezados, acciones, estados de carga, vacío y error, foco de controles, landmarks y copy visible.
- El Hero elimina texto accesorio redundante; el catálogo reutiliza el encabezado de página y la ficha evita un landmark principal anidado.

- La experiencia visible de Mi Cuenta elimina los avisos internos de demostración y utiliza datos de perfil, dirección, beneficios y pedidos con presentación de cliente.
- El detalle de pedido resuelve su ID desde la fuente centralizada y presenta una vista de pedido no encontrado para IDs inválidos.
- El resumen de Mi Cuenta deriva su dirección principal desde la misma fuente usada por Mis direcciones.
- El resumen de Mi Cuenta deriva el beneficio destacado desde la misma fuente usada por Mis beneficios.
- Las tarjetas de producto y las categorías de Home enlazan al catálogo o a la ruta preparada de producto.
- Los datos mock de producto incorporan descripción editorial breve y un contrato de imagen accesible, sin convertirlos en especificaciones técnicas ni promesas comerciales.
- Se retiró el placeholder único de categorías y productos para evitar repetición visual entre catálogo, Home, ficha y pedidos.
- Se ocultó el acceso público al carrito hasta que exista un flujo real y se consolidó la navegación reutilizada por Header, menú móvil y Footer.

### Estado

- Aún no hay funcionalidades implementadas.
