-- Rutas públicas verificadas para los productos que incorporan fotografía.
-- Sólo actualiza productos identificados explícitamente por su slug.

begin;

with imagenes (slug, ruta_imagen) as (
  values
    ('anis-estrellado', '/products/verduras/anis.webp'),
    ('kiwi', '/products/verduras/kiwi.webp'),
    ('naranja-malla-15-kg', '/products/verduras/mallanaranjas.webp'),
    ('mandarina', '/products/verduras/mandarinas.webp'),
    ('miel', '/products/verduras/miel.webp'),
    ('cebolla-blanca-malla', '/products/verduras/sacocebollas.webp'),
    ('cebolla-morada-malla', '/products/verduras/sacocebollamorada.webp'),
    ('saco-papa-lavada-25-kg', '/products/verduras/sacopapaslavadas.webp'),
    ('saco-de-papa-sucia-25-kg', '/products/verduras/sacopapassucias.webp'),
    ('semilla-de-mostaza', '/products/verduras/semillasmostaza.webp'),
    ('menta', '/products/hidroponicos/menta.webp')
)
update public.productos as producto
set ruta_imagen = imagenes.ruta_imagen
from imagenes
where producto.slug = imagenes.slug
  and producto.ruta_imagen is distinct from imagenes.ruta_imagen;

commit;
