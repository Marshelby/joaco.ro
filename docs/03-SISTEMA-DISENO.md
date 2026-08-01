# Sistema de diseño

**Estado:** Identidad visual inicial y Home de descubrimiento mock implementados; evolución comercial pendiente.  
**Propósito:** Dar coherencia visual y de experiencia sin cerrar prematuramente el diseño.  
**Última actualización:** 2026-08-01

## Objetivo visual

La marca debe transmitir cercanía, confianza, orden, variedad, oportunidad, buen precio, comercio real y modernidad sin frialdad. No debe parecer una copia directa de Mercado Libre, una interfaz bancaria, un dashboard genérico, una tienda de lujo ni un bazar digital desordenado.

## Principios

- Identidad propia, legibilidad y jerarquía clara.
- Fotografías protagonistas, tarjetas limpias y precios visibles.
- CTAs claros y experiencia mobile-first.
- Panel administrativo funcional y consistente con la tienda.
- Accesibilidad y estados claros para carga, vacío, error, éxito y confirmación.

## Base técnica visual decidida

El proyecto ya utiliza Geist, Lucide, shadcn/ui, Base UI, preset Nova y Tailwind CSS v4. Estas decisiones se preservan; no son una definición de identidad de marca.

## Componentes fundamentales futuros

Header, navegación, buscador, filtros, card y detalle de producto, carrito, checkout, badge de disponibilidad, badge mayorista, resumen de pedido, timeline de estado, tablas administrativas, formularios, modales, drawers, toasts, empty states, skeletons, alertas y confirmaciones.

## Responsive

La prioridad es: 1) móvil, 2) tablet, 3) escritorio. El panel administrativo también debe funcionar en móvil, aunque puede optimizarse para escritorio donde la operación lo justifique.

## Colores

La identidad inicial aprobada usa azul petróleo profundo como base, arena muy clara y blanco como superficies, grafito para texto y terracota como acento. Se implementa mediante tokens semánticos CSS y conserva una interpretación coherente para modo oscuro; no se usan colores directos en componentes.

## Aplicación en Fase 1

La implementación usa los tokens semánticos neutrales ya provistos por shadcn/Nova, sin establecer colores de marca. Se corrigió la asociación de `--font-sans` con Geist Sans y se conservó Geist Mono.

Se implementaron layouts públicos, de cuenta y administrativos, con navegación responsive, menú móvil accesible mediante Base UI Dialog, foco visible, enlaces activos con `aria-current`, áreas táctiles amplias y soporte para reducción de movimiento. Los componentes base disponibles son contenedor, encabezado de página, logo textual temporal y estados vacío, carga y error.

## Aplicación en Fase 2

El Home público prioriza el descubrimiento antes de la exploración por categorías: Hero editorial, secciones mock de Lo más vendido, Oportunidades y Recién llegados, exploración secundaria de categorías y subcategorías, y una grilla de Todos los productos. Este orden no define una taxonomía comercial definitiva ni supone ventas reales.

Las tarjetas de producto son reutilizables y reciben datos por props. Los productos, imágenes y banderas de presentación son mocks centralizados y temporales; la UI no contiene reglas comerciales, carrito, rutas de detalle ni acciones transaccionales. Los precios se formatean de forma centralizada en pesos chilenos para evitar representaciones inconsistentes durante la etapa visual.

Las secciones destacadas comparten un rail horizontal reutilizable con tarjetas, encabezado compacto e icono semántico. Usan scroll nativo, `scroll snap`, gesto táctil y controles de flecha accesibles, sin autoplay ni dependencia adicional. En móvil cada tarjeta deja ver parte de la siguiente; tablet y escritorio conservan el desplazamiento horizontal con más tarjetas visibles. La grilla responsive se reserva para Todos los productos.

Las tarjetas enlazan a la ruta preparada de producto para mantener continuidad de exploración. La ficha completa y las acciones de compra siguen pendientes; las tarjetas no muestran CTAs transaccionales.

El wordmark temporal se mantiene como texto `JOACO RO`, con espaciado y jerarquía refinados; no existe isotipo. La imagen del Hero es un asset local temporal y reemplazable mediante props, pensado para ser sustituido por una imagen IA con el lenguaje fotográfico definido.

La dirección fotográfica es editorial, cálida y ordenada: luz natural suave, fondos arena o domésticos sobrios, producto como protagonista y espacio negativo suficiente. Se evitan códigos visuales de marketplace agresivo.

## Hero definitivo

El Home usa `public/images/hero/joaco-ro-hero-principal.webp` como asset definitivo del Hero. En escritorio se presenta como una composición única de fondo, con el contenido sobre el espacio negativo izquierdo y un degradado semántico suave para preservar contraste. En móvil se conserva el mismo archivo en una composición apilada: imagen primero y contenido después, con recorte orientado al sector derecho para mantener visibles los productos. El Hero no repite el nombre de marca ni incorpora un eyebrow; `JOACO RO` permanece en el Header.

El asset temporal anterior del Hero fue eliminado tras verificar que no tenía referencias. La navegación por categorías usa ahora fallbacks vectoriales tipados mientras se define un sistema de assets comercial; la revisión de taxonomía comercial sigue pendiente de aprobación y no modifica los mocks actuales.

## Catálogo mock

`/catalogo` continúa el descubrimiento de Home con una barra compacta de búsqueda, categorías en chips horizontales, ordenamiento y grilla responsive. Los filtros usan URL compartible (`q`, `categoria`, `orden`), no inventan métricas de ventas o descuentos, y las tarjetas llevan a la ruta preparada de producto sin exponer acciones de compra.

La ficha de producto reutiliza esa colección: navegación contextual, imagen principal estable, precio unitario como jerarquía principal y bloque mayorista solo cuando el producto lo define. Su mensaje de disponibilidad explica que la confirmación ocurre al revisar la solicitud; no muestra stock exacto, tarifas, plazos, descuentos, reseñas ni una galería falsa. Los relacionados reutilizan las tarjetas existentes y no se presentan como recomendaciones personalizadas.

## Sistema de imágenes provisional

El Hero conserva su fotografía local. Productos, categorías y snapshots de pedido usan un contrato tipado de imagen y, cuando no existe una imagen comercial verificable, una ilustración vectorial local derivada de su familia. Las ilustraciones no representan color, modelo ni especificaciones exactas; solo diferencian visualmente la navegación. Todas conservan un contenedor con proporción estable y no compiten con el nombre ni el precio.

La imagen de producto contiene `src`, `alt` y ajuste opcional de encuadre; el producto puede tener imagen principal, una colección futura o ninguna. Con cero imágenes se muestra fallback; con una no hay controles; con dos o más assets distintos, la ficha muestra miniaturas accesibles. Las cards son diferidas por defecto y solo la imagen principal de la ficha usa prioridad.

## Navegación y confianza pública

La navegación pública se mantiene deliberadamente breve: Inicio, Catálogo y Mi Cuenta. El Header no es sticky y usa estado activo con texto, fondo sobrio y `aria-current`. En móvil, los mismos destinos se presentan en un diálogo accesible con cierre por Escape y al navegar.

El Footer acompaña la exploración con una descripción breve de la tienda, enlaces a destinos existentes y una explicación general del proceso: disponibilidad revisada antes de confirmar, seguida de coordinación de pago y entrega o retiro. No se publican contactos, cobertura, horarios, tarifas ni medios de pago mientras no estén definidos.

## Mi Cuenta

Mi Cuenta prioriza navegación contextual, espacio y divisores antes que superficies anidadas. Los pedidos siguen siendo cards enlazables; perfil, dirección y beneficio resumen entidades independientes. En el detalle, productos y datos operativos conservan sus bloques, mientras seguimiento e historial se integran como secciones ligeras.

## Estados globales

Los estados vacíos y not-found reutilizan `EmptyState`: icono discreto, título con jerarquía contextual, explicación breve y acciones reales cuando existen. Loading y error mantienen la misma escala de borde, radio y texto secundario. No se muestran mensajes técnicos al cliente.

## Refinamiento transversal

Las acciones de navegación usan un único patrón de 44 px mínimos, con variantes primaria, secundaria y discreta. Las superficies informativas comparten borde, radio y padding responsive; los títulos de página y sección usan una jerarquía consistente. Los estados vacío, error y carga mantienen iconografía, espaciado y anuncios accesibles, con IDs únicos cuando hay más de uno en la misma vista.

La aplicación incluye un enlace para saltar al contenido principal, landmarks `main` únicos por layout y foco programático seguro. Los controles de formulario y navegación conservan foco visible; la reducción de movimiento elimina transiciones y animaciones no esenciales de forma global. La ficha evita landmarks anidados y el Hero mantiene la composición editorial sin texto accesorio redundante.

## Panel administrativo mock

El panel administrativo extiende los mismos tokens de JOACO RO con un layout propio y una navegación reducida a cinco destinos. El Dashboard usa tarjetas de referencia editorial, sin gráficos ni métricas comerciales. Los módulos restantes emplean una misma superficie informativa para preparar su alcance sin presentar controles operativos antes de tiempo.

El listado de Productos reemplaza la tabla por fichas adaptativas: imagen, identidad, clasificación, precios, visibilidad y una única acción. La disposición se ordena en columnas desde tablet y se convierte en card vertical en móvil, sin scroll horizontal.

Categorías adopta una lectura tipo carpetas: cada superficie reúne la identidad de una categoría, su visibilidad, la cantidad de subcategorías y sus acciones de navegación; debajo, las subcategorías se leen como filas simples con su propio estado y edición futura. La búsqueda es única y local, los controles mantienen un objetivo táctil mínimo de 44 px y la composición se apila sin scroll horizontal en móvil. No se muestran acciones destructivas ni controles de operación antes de que exista su flujo.

El formulario administrativo de Producto usa los mismos bloques para creación y edición: información general, clasificación, precio, imagen única y estado. En escritorio, clasificación y precio aprovechan dos columnas; en móvil todos los campos conservan una columna legible. La imagen es una representación mock y las acciones del pie permanecen sin mutación hasta que exista el flujo persistente.

Secciones Inicio se presenta como cuatro superficies editoriales de ancho completo. Cada una muestra su selección ordenada como filas con imagen, nombre, categoría y controles de movimiento o retiro; no usa tablas, métricas ni estados comerciales. El selector de producto es un disclosure mock accesible y no modifica la colección.
