-- Rutas estáticas versionadas; la aplicación no usa Supabase Storage para estas imágenes.
with imagenes (slug, ruta_imagen) as (
  values
    ('albahaca-en-rama', '/products/hidroponicos/albaca.webp'),
    ('berro-hidroponico', '/products/hidroponicos/berro.webp'),
    ('ciboulette-75-gr', '/products/hidroponicos/ciboulette.webp'),
    ('docena-de-ciboulette', '/products/hidroponicos/ciboulette.webp'),
    ('flores-comestibles-50-und', '/products/hidroponicos/flores.webp'),
    ('jengibre', '/products/hidroponicos/jengibre.webp'),
    ('lechuga-hidroponica', '/products/hidroponicos/lechugahidroponica.webp'),
    ('microgreens-50-gr', '/products/hidroponicos/microgreens.webp'),
    ('mix-de-hojas-mizuna-y-mostaza', '/products/hidroponicos/mixhojas.webp'),
    ('romero-fresco', '/products/hidroponicos/romero.webp'),
    ('rucula', '/products/hidroponicos/rucula.webp'),
    ('tomate-cherry', '/products/hidroponicos/cherry.webp')
)
update public.productos as producto
set ruta_imagen = imagenes.ruta_imagen
from imagenes
where producto.slug = imagenes.slug;

do $$
declare
  filas_asignadas integer;
begin
  select count(*) into filas_asignadas
  from public.productos
  where slug in (
    'albahaca-en-rama', 'berro-hidroponico', 'ciboulette-75-gr', 'docena-de-ciboulette',
    'flores-comestibles-50-und', 'jengibre', 'lechuga-hidroponica', 'microgreens-50-gr',
    'mix-de-hojas-mizuna-y-mostaza', 'romero-fresco', 'rucula', 'tomate-cherry'
  ) and ruta_imagen is not null;
  if filas_asignadas <> 12 then
    raise exception 'Se esperaban 12 productos con ruta_imagen; se encontraron %', filas_asignadas;
  end if;
end;
$$;
