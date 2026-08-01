# JOACO RO

JOACO RO es una plataforma de comercio para administrar y mostrar un catálogo de productos de hogar, aseo, cocina, iluminación, juguetes y artículos cotidianos.

El proyecto se encuentra en una fase mock-first de UX/UI: la experiencia y la arquitectura visual están preparadas antes de incorporar servicios persistentes.

## Estado actual

- Experiencia pública diseñada, con Home, catálogo, ficha de producto, navegación, Footer y sistema de imágenes.
- Catálogo y ficha de producto alimentados por datos mock centralizados.
- Mi Cuenta mock, con pedidos, detalle de pedido, direcciones y beneficios.
- Panel administrador mock con Dashboard, Productos, Categorías y Subcategorías, Secciones Inicio y Configuración.
- Editor visual compartido para crear o editar productos, sin persistencia.
- Secciones editoriales de Home basadas en referencias manuales a productos existentes.
- Sin integración con Supabase, Auth real, persistencia, pagos ni carrito funcional.

## Funcionalidades actuales

### Área pública

- Home editorial, navegación y Footer.
- Catálogo con búsqueda y filtros mock.
- Ficha de producto, precios y productos relacionados mock.
- Sistema de imágenes con fallbacks accesibles.

### Área cliente

- Mi Cuenta.
- Pedidos y detalle de pedido.
- Direcciones.
- Beneficios.

Estas vistas usan información mock y no guardan cambios.

### Área administrativa

- Dashboard visual.
- Listado de productos y formulario visual compartido para crear o editar.
- Arquitectura de categorías y subcategorías.
- Editor editorial de Secciones Inicio.
- Configuración como estructura inicial.

Las acciones administrativas aún no persisten información ni habilitan CRUD.

## Stack tecnológico

- [Next.js](https://nextjs.org/) 16.2.12.
- React 19.2.4.
- TypeScript 5.
- Tailwind CSS 4.
- Base UI y componentes shadcn existentes.
- Lucide React para iconografía.

## Requisitos

Next.js declara compatibilidad con Node.js `>=20.9.0`. Se recomienda usar una versión LTS compatible; este entorno se ha revisado con Node.js 22.22.2 y npm 10.9.7.

## Instalación local

```bash
npm install
npm run dev
```

Para una instalación reproducible desde el lockfile, especialmente en CI, se puede usar `npm ci`.

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

## Scripts

```bash
npm run dev
npm run lint
npx tsc --noEmit
npm run build
npm run start
```

## Estructura del proyecto

- `src/app`: rutas y layouts de las áreas pública, cliente y administrativa.
- `src/components`: componentes compartidos y componentes por dominio visual.
- `src/mocks`: fuentes mock centralizadas.
- `src/lib`: utilidades puras y adaptadores de presentación.
- `src/types`: contratos TypeScript.
- `public`: assets públicos, incluido el Hero de Home.
- `docs`: decisiones, arquitectura, reglas y roadmap del proyecto.

## Variables de entorno

La experiencia mock actual se ejecuta sin variables de entorno ni Supabase. El archivo [`.env.example`](.env.example) prepara únicamente las variables públicas que requerirá la integración futura de Supabase; no contiene valores reales.

## Arquitectura actual

- Enfoque mock-first para validar experiencia antes de persistencia.
- Server Components por defecto; Client Components solo donde existe interacción local.
- Fuentes mock centralizadas para productos, categorías y secciones editoriales.
- El producto es la unidad principal del catálogo.
- Una categoría contiene subcategorías; los productos referencian una categoría y una subcategoría.
- Las secciones de Home son escaparates editoriales manuales que solo referencian productos existentes.

## Próximas fases

1. Versionado en GitHub y despliegue en Vercel.
2. Integración con Supabase.
3. Auth.
4. Roles `customer` y `super_admin`.
5. Storage.
6. Persistencia de categorías, subcategorías y productos.
7. Persistencia de secciones editoriales.
8. Carrito y pedidos.
9. Pagos y entregas.

No se comprometen fechas para estas etapas.

## Build en WSL

Al ejecutar el proyecto desde `/mnt/c`, el build de Next.js puede verse afectado por el filesystem montado. Se observó un error relacionado con la eliminación de `.next/diagnostics` (`ENOTEMPTY`) y ejecuciones que se detienen durante la creación del build sin generar `.next/BUILD_ID`.

Esto no implica que el código esté roto. Para validar el build, se recomienda copiar el proyecto a un directorio nativo de WSL:

```bash
cp -a /mnt/c/ruta/al/proyecto/joacoro ~/joacoro
cd ~/joacoro
npm ci
rm -rf .next
npm run build
```

## Documentación interna

La documentación de arquitectura, sistema de diseño, reglas de negocio, decisiones y roadmap se encuentra en [`docs/`](docs/).

## Licencia

Este repositorio no declara todavía una licencia de uso.
