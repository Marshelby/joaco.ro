# Arquitectura objetivo

**Estado:** Base de Fase 1 implementada; arquitectura restante pendiente según roadmap.  
**Propósito:** Orientar una arquitectura modular y preparada para la evolución del producto.  
**Última actualización:** 2026-08-01

## Enfoque

La arquitectura objetivo es modular, escalable, mock-first y preparada para Supabase. Debe separar responsabilidades por dominio y favorecer componentes reutilizables sin caer en sobreabstracción.

## Estructura objetivo sugerida

```text
src/
├── app/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── shared/
│   └── feedback/
├── features/
│   ├── catalog/
│   ├── cart/
│   ├── checkout/
│   ├── auth/
│   ├── customers/
│   ├── orders/
│   ├── payments/
│   ├── delivery/
│   ├── routes/
│   ├── loyalty/
│   └── admin/
├── mocks/
├── types/
├── schemas/
├── lib/
├── hooks/
├── providers/
├── constants/
└── config/
```

Esta es una referencia, no una obligación de crear carpetas de inmediato. Debe ajustarse a necesidades reales y no se deben crear directorios vacíos sin utilidad.

## Implementación actual de Fase 1

La aplicación usa ahora `src/` como raíz de código. Se implementaron `src/app`, `src/components`, `src/config`, `src/mocks`, `src/types` y `src/lib`; no se crearon dominios, servicios o carpetas vacías que todavía no tienen uso.

Los route groups `(public)`, `(customer)` y `(admin)` organizan sus layouts sin alterar las URL. Las áreas de cuenta y administración son mock-first y abiertas mientras no exista autenticación ni autorización; la experiencia visible de cuenta no expone detalles internos de esa condición. No hay middleware ni mecanismo de seguridad temporal.

La configuración de marca y rutas está centralizada en `src/config`. Los destinos de navegación públicos y de cuenta viven en `src/mocks/navigation.ts`; no contienen componentes React ni datos comerciales. El carrito no se expone hasta que su flujo exista.

Los layouts, páginas, componentes estructurales y estados visuales permanecen como Server Components. Solo `navigation-link.tsx` usa `usePathname` para el estado activo y `mobile-navigation.tsx` usa Base UI Dialog para la interacción, foco y cierre del menú móvil.

El panel administrativo mock usa un layout independiente y una navegación intencionalmente reducida: Dashboard, Productos, Categorías, Secciones Inicio y Configuración. La barra lateral se presenta completa en escritorio, compacta en tablet y como diálogo accesible en móvil. Los contenidos de cada módulo son superficies informativas; no incluyen CRUD, formularios, tablas, permisos ni acceso a datos.

El listado administrativo de productos consume la colección mock central ya usada por la tienda pública. La búsqueda local se limita a nombre, categoría y subcategoría; las rutas de creación y edición se definen como destinos futuros sin vistas ni mutaciones asociadas.

Las rutas administrativas de creación y edición de producto comparten `ProductFormPage` y `ProductForm`. El modo nuevo usa un valor vacío tipado y el modo edición resuelve el producto desde `HOME_PRODUCTS`; ambos adaptan sus datos con la misma utilidad. La única interacción local es presentar subcategorías según la categoría elegida. Guardar, cambios de imagen y validaciones de negocio no están implementados.

Secciones Inicio mantiene una configuración editorial independiente con IDs de productos ordenados por sección. Una utilidad resuelve esos IDs contra `HOME_PRODUCTS` exclusivamente para presentación. Este módulo no crea ni muta productos, categorías o la Home pública; los controles de agregar, mover y quitar son visuales mientras no exista persistencia.

El módulo administrativo de Categorías consume `CATEGORY_CATALOG_MOCK`, la misma taxonomía que adapta el Home. Presenta una relación explícita de categoría a subcategorías, ordenada alfabéticamente y filtrable por ambos nombres. Las rutas de alta y edición solo quedan centralizadas como destinos futuros; no hay formularios, mutaciones ni acciones destructivas. El contrato tipado conserva IDs y visibilidad para que el futuro formulario de producto pueda seleccionar una categoría y una subcategoría sin crear una segunda taxonomía.

El Header público consume la misma definición de destinos que el Footer y el menú móvil: Inicio, Catálogo y Mi Cuenta. Checkout, carrito y confirmación mantienen sus rutas para fases posteriores, pero no se presentan como acciones mientras sean placeholders.

Mi Cuenta usa navegación contextual superior para sus cuatro destinos reales, evitando una sidebar de dashboard con pocas secciones. La presentación de estados de pedido se centraliza en `src/lib/orders.ts`; badges, descripción y futuros consumidores comparten el mismo contrato tipado.

El catálogo público deriva sus resultados de la misma colección mock usada por Home. Las funciones puras de `src/lib/catalog.ts` normalizan búsqueda, validan filtros y ordenan productos; la barra de catálogo solo sincroniza controles con los parámetros `q`, `categoria` y `orden` de la URL.

La ficha pública resuelve el mismo producto por `slug` mediante utilidades puras de `src/lib/products.ts`; esas utilidades también centralizan el texto de disponibilidad y la derivación de productos relacionados. La página queda limitada a resolución, metadata y navegación, mientras `ProductDetail` recibe datos tipados sin conocer la fuente mock.

La presentación visual de catálogo se centraliza en `CatalogImage`. Los contratos `ImageAsset` e `ImageFallbackKind` permiten una imagen local o futura URL aprobada, su texto alternativo y un fallback semántico sin que Home, Catálogo, ficha y pedidos dupliquen la lógica. `ProductMedia` mantiene aislada la interacción de galería para cuando haya dos o más imágenes distintas.

## Principios técnicos

- Server Components por defecto.
- Client Components solo si hay interacción, estado, efectos o APIs del navegador.
- No marcar árboles completos con `"use client"` sin necesidad.
- Zod para validaciones y React Hook Form para formularios.
- Tipos de dominio centralizados y mocks separados.
- Acceso a datos detrás de servicios o repositorios; evitar consultas directas dispersas.
- Componentes visuales sin reglas de negocio complejas.
- Funciones puras para cálculos y formateadores centralizados.
- Variables de entorno validadas y errores controlados.
- Estados de carga, vacío y error como parte de cada experiencia relevante.
- Accesibilidad por teclado y diseño mobile-first.

## Estrategia futura con Supabase

Cuando se valide el frontend y las reglas, se considerará Supabase Auth con Google, Database y Storage. RLS será obligatoria. Las RPCs se reservarán para operaciones sensibles o transaccionales; los procesos simples no deben complejizarse innecesariamente.

Las integraciones de WhatsApp/n8n deberán usar acciones controladas. El chatbot no tendrá acceso irrestricto a datos. Las migraciones serán versionadas, los tipos se generarán desde la base de datos y los datos mock permanecerán separados de los reales. Ver [Database](./05-DATABASE.md) y [RPCs](./06-RPCS.md).

## Convenciones

- **Archivos:** nombres descriptivos en `kebab-case`; excepciones requeridas por el framework.
- **Componentes:** `PascalCase`, con un nombre que describa su responsabilidad.
- **Hooks:** prefijo `use`, por ejemplo `useCart`.
- **Tipos:** `PascalCase`, centralizados por dominio cuando se compartan.
- **Schemas:** sufijo `Schema`, por ejemplo `checkoutSchema`.
- **Constantes:** nombres descriptivos; usar mayúsculas solo para valores globales inmutables.
- **Handlers:** prefijo `handle` para eventos de UI y verbos claros para acciones de dominio.
- **Módulos:** una responsabilidad coherente por módulo; preferir imports mediante alias configurados.
- Evitar abreviaciones ambiguas; el nombre debe comunicar intención sin depender de contexto implícito.
