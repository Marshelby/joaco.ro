-- Rutas públicas verificadas para fotografías de verduras, frutas y hierbas.
-- Sólo actualiza los productos incluidos explícitamente en este mapa.

begin;

with imagenes (slug, ruta_imagen) as (
  values
    ('aji-amarillo', '/products/verduras/ajiamarillo.webp'),
    ('aji-verde', '/products/verduras/ajiverde.webp'),
    ('ajo', '/products/verduras/ajo.webp'),
    ('apio', '/products/verduras/apio.webp'),
    ('berenjena', '/products/verduras/berengena.webp'),
    ('betarraga', '/products/verduras/betarraga.webp'),
    ('brocoli', '/products/verduras/brocoli.webp'),
    ('cebolla-blanca', '/products/verduras/cebollablanca.webp'),
    ('cebolla-morada', '/products/verduras/cebollamorada.webp'),
    ('cebollin', '/products/verduras/cebollin.webp'),
    ('champinon', '/products/verduras/champiñon.webp'),
    ('cilantro', '/products/verduras/cilantro.webp'),
    ('coliflor', '/products/verduras/coliflor.webp'),
    ('escarola', '/products/verduras/escarola.webp'),
    ('espinaca', '/products/verduras/espinaca.webp'),
    ('lechuga-chilena', '/products/verduras/lechugachilena.webp'),
    ('limon-sutil', '/products/verduras/limon.webp'),
    ('limon-camote-malla', '/products/verduras/limoncamote.webp'),
    ('limon-normal-malla', '/products/verduras/limonmalla.webp'),
    ('mango', '/products/verduras/mango.webp'),
    ('manzana-roja-o-verde', '/products/verduras/manzana.webp'),
    ('naranja', '/products/verduras/naranja.webp'),
    ('palta-peruana-1ra', '/products/verduras/paltaperuana.webp'),
    ('papa', '/products/verduras/papa.webp'),
    ('papa-camote', '/products/verduras/papacamote.webp'),
    ('pepino-verdura', '/products/verduras/pepino.webp'),
    ('perejil', '/products/verduras/perejil.webp'),
    ('pimenton-amarillo', '/products/verduras/pimentonamarillo.webp'),
    ('pimenton-rojo-primera', '/products/verduras/pimentonrojo.webp'),
    ('pimenton-verde-primera', '/products/verduras/pimentonverde.webp'),
    ('pina', '/products/verduras/piña.webp'),
    ('platano', '/products/verduras/platano.webp'),
    ('platano-macho', '/products/verduras/platanomacho.webp'),
    ('pomelo', '/products/verduras/pomelo.webp'),
    ('rabano', '/products/verduras/rabano.webp'),
    ('repollo-morado', '/products/verduras/repollomorado.webp'),
    ('repollo-verde', '/products/verduras/repolloverde.webp'),
    ('tomate-primera', '/products/verduras/tomateprimera.webp'),
    ('zanahoria', '/products/verduras/zanahoria.webp'),
    ('zapallo-camote', '/products/verduras/zapallocamote.webp'),
    ('zapallo-italiano', '/products/verduras/zapalloitaliano.webp')
)
update public.productos as producto
set ruta_imagen = imagenes.ruta_imagen
from imagenes
where producto.slug = imagenes.slug
  and producto.ruta_imagen is distinct from imagenes.ruta_imagen;

commit;
