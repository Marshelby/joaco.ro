-- Catálogo comercial definitivo de Hidro Leufú (agosto 2026).
-- Idempotente: conserva IDs, imágenes y flags comerciales ya existentes.

begin;

-- Evita transformar el slug histórico en una segunda fila si hubiese una colisión.
do $$
begin
  if exists (select 1 from public.productos where slug = 'italiano')
     and exists (select 1 from public.productos where slug = 'zapallo-italiano') then
    raise exception 'No se puede normalizar italiano: existen ambos slugs';
  end if;
end;
$$;

-- Conserva el mismo producto (y sus relaciones) al normalizar su identidad comercial.
update public.productos
set slug = 'zapallo-italiano', nombre = 'Zapallo italiano'
where slug = 'italiano';

insert into public.categorias (slug, nombre, activa, orden)
values
  ('hidroponicos', 'Hidropónicos', true, 1),
  ('verduras-hortalizas', 'Verduras y hortalizas', true, 2),
  ('frutas', 'Frutas', true, 3),
  ('hierbas-especias', 'Hierbas y especias', true, 4),
  ('formatos-cajas', 'Formatos y cajas', true, 5),
  ('otros', 'Otros', true, 6)
on conflict (slug) do update set
  nombre = excluded.nombre,
  activa = excluded.activa,
  orden = excluded.orden;

with datos (categoria_slug, slug, nombre, orden) as (
  values
    ('hidroponicos', 'albahaca-en-rama', 'Albahaca en rama', 1),
    ('hidroponicos', 'berro-hidroponico', 'Berro hidropónico', 2),
    ('hidroponicos', 'ciboulette-75-gr', 'Ciboulette 75 gr', 3),
    ('hidroponicos', 'docena-de-ciboulette', 'Docena de ciboulette', 4),
    ('hidroponicos', 'flores-comestibles-50-und', 'Flores comestibles 50 und', 5),
    ('hidroponicos', 'jengibre', 'Jengibre', 6),
    ('hidroponicos', 'lechuga-hidroponica', 'Lechuga hidropónica', 7),
    ('hidroponicos', 'microgreens-50-gr', 'Microgreens 50 gr (brotes)', 8),
    ('hidroponicos', 'mix-de-hojas-mizuna-y-mostaza', 'Mix de hojas (mizuna y mostaza)', 9),
    ('hidroponicos', 'romero-fresco', 'Romero fresco', 10),
    ('hidroponicos', 'rucula', 'Rúcula', 11),
    ('hidroponicos', 'tomate-cherry', 'Tomate cherry', 12),
    ('hidroponicos', 'menta', 'Menta', 13),
    ('verduras-hortalizas', 'aji-verde', 'Ají verde', 13),
    ('verduras-hortalizas', 'ajo', 'Ajo', 14),
    ('verduras-hortalizas', 'apio', 'Apio', 15),
    ('verduras-hortalizas', 'berenjena', 'Berenjena', 16),
    ('verduras-hortalizas', 'betarraga', 'Betarraga', 17),
    ('verduras-hortalizas', 'brocoli', 'Brócoli', 18),
    ('verduras-hortalizas', 'cebolla-blanca', 'Cebolla blanca', 19),
    ('verduras-hortalizas', 'cebolla-morada', 'Cebolla morada', 20),
    ('verduras-hortalizas', 'coliflor', 'Coliflor', 21),
    ('verduras-hortalizas', 'escarola', 'Escarola', 22),
    ('verduras-hortalizas', 'espinaca', 'Espinaca', 23),
    ('verduras-hortalizas', 'lechuga-chilena', 'Lechuga chilena', 24),
    ('verduras-hortalizas', 'papa-camote', 'Papa camote', 25),
    ('verduras-hortalizas', 'papa', 'Papa', 26),
    ('verduras-hortalizas', 'pepino-verdura', 'Pepino verdura', 27),
    ('verduras-hortalizas', 'pimenton-amarillo', 'Pimentón amarillo', 28),
    ('verduras-hortalizas', 'pimenton-rojo-primera', 'Pimentón rojo 1era', 29),
    ('verduras-hortalizas', 'pimenton-verde-primera', 'Pimentón verde 1era', 30),
    ('verduras-hortalizas', 'rabano', 'Rábano', 31),
    ('verduras-hortalizas', 'repollo-morado', 'Repollo morado', 32),
    ('verduras-hortalizas', 'repollo-verde', 'Repollo verde', 33),
    ('verduras-hortalizas', 'tomate-primera', 'Tomate primera', 34),
    ('verduras-hortalizas', 'zanahoria', 'Zanahoria', 35),
    ('verduras-hortalizas', 'zapallo-camote', 'Zapallo camote', 36),
    ('verduras-hortalizas', 'aji-amarillo', 'Ají amarillo', 37),
    ('verduras-hortalizas', 'zapallo-italiano', 'Zapallo italiano', 38),
    ('frutas', 'limon-camote-malla', 'Limón camote malla', 39),
    ('frutas', 'limon-normal-malla', 'Limón normal malla', 40),
    ('frutas', 'limon-sutil', 'Limón sutil', 41),
    ('frutas', 'mango', 'Mango', 42),
    ('frutas', 'manzana-roja-o-verde', 'Manzana roja o verde', 43),
    ('frutas', 'naranja', 'Naranja', 44),
    ('frutas', 'palta-peruana-1ra', 'Palta peruana 1ra', 45),
    ('frutas', 'pina', 'Piña', 46),
    ('frutas', 'platano', 'Plátano', 47),
    ('frutas', 'pomelo', 'Pomelo', 48),
    ('frutas', 'platano-macho', 'Plátano macho', 49),
    ('frutas', 'mandarina', 'Mandarina', 50),
    ('frutas', 'kiwi', 'Kiwi', 51),
    ('hierbas-especias', 'cebollin', 'Cebollín', 52),
    ('hierbas-especias', 'champinon', 'Champiñón', 53),
    ('hierbas-especias', 'cilantro', 'Cilantro', 54),
    ('hierbas-especias', 'perejil', 'Perejil', 55),
    ('hierbas-especias', 'semilla-de-mostaza', 'Semilla de mostaza', 56),
    ('hierbas-especias', 'anis-estrellado', 'Anís estrellado', 57),
    ('formatos-cajas', 'cebolla-blanca-malla', 'Cebolla blanca malla', 58),
    ('formatos-cajas', 'cebolla-morada-malla', 'Cebolla morada malla', 59),
    ('formatos-cajas', 'paquete-cebollin-10-und', 'Paquete cebollín 10 und', 60),
    ('formatos-cajas', 'escarola-caja', 'Escarola caja', 61),
    ('formatos-cajas', 'naranja-malla-15-kg', 'Naranja malla 15 kg', 62),
    ('formatos-cajas', 'saco-papa-lavada-25-kg', 'Saco papa lavada 25 kg', 63),
    ('formatos-cajas', 'saco-de-papa-sucia-25-kg', 'Saco de papa sucia 25 kg', 64),
    ('formatos-cajas', 'tomate-primera-caja-17-kg', 'Tomate primera caja 17 kg', 65),
    ('formatos-cajas', 'caja-de-italiano', 'Caja de italiano', 66),
    ('formatos-cajas', 'caja-de-huevo', 'Caja de huevo', 67),
    ('otros', 'miel', 'Miel', 68)
)
insert into public.productos (categoria_id, slug, nombre, descripcion, unidad_base, activo, disponible, orden)
select c.id, d.slug, d.nombre, d.nombre || '.', 'comercial', true, true, d.orden
from datos d
join public.categorias c on c.slug = d.categoria_slug
on conflict (slug) do update set
  categoria_id = excluded.categoria_id,
  nombre = excluded.nombre,
  unidad_base = excluded.unidad_base,
  activo = excluded.activo,
  disponible = excluded.disponible;

with datos (producto_slug, nombre, cantidad, unidad, precio_neto, precio_final) as (
  values
    ('albahaca-en-rama', '1 unidad', 1, 'UND', 1000, 1190),
    ('berro-hidroponico', '1 kg', 1, 'KG', 9000, 10710),
    ('ciboulette-75-gr', '75 gr', 75, 'GR', 500, 595),
    ('docena-de-ciboulette', 'Docena', 12, 'UND', 5000, 5950),
    ('flores-comestibles-50-und', '50 unidades', 50, 'UND', 2500, 2975),
    ('jengibre', '1 kg', 1, 'KG', 4000, 4760),
    ('lechuga-hidroponica', '1 unidad', 1, 'UND', 700, 833),
    ('menta', '1 kg', 1, 'KG', 15000, 17850),
    ('microgreens-50-gr', '50 gr', 50, 'GR', 2500, 2975),
    ('mix-de-hojas-mizuna-y-mostaza', '1 kg', 1, 'KG', 9000, 10710),
    ('romero-fresco', '100 gr', 100, 'GR', 1500, 1785),
    ('rucula', '1 kg', 1, 'KG', 9000, 10710),
    ('tomate-cherry', '1 kg', 1, 'KG', 2500, 2975),
    ('aji-verde', '1 kg', 1, 'KG', 4000, 4760),
    ('ajo', '1 unidad', 1, 'UND', 250, 298),
    ('apio', '1 unidad', 1, 'UND', 1200, 1428),
    ('berenjena', '1 unidad', 1, 'UND', 600, 714),
    ('betarraga', '1 unidad', 1, 'UND', 1500, 1785),
    ('brocoli', '1 unidad', 1, 'UND', 1200, 1428),
    ('cebolla-blanca', '1 kg', 1, 'KG', 800, 952),
    ('cebolla-morada', '1 kg', 1, 'KG', 1500, 1785),
    ('coliflor', '1 unidad', 1, 'UND', 1500, 1785),
    ('escarola', '1 unidad', 1, 'UND', 1000, 1190),
    ('espinaca', '1 unidad', 1, 'UND', 800, 952),
    ('lechuga-chilena', '1 unidad', 1, 'UND', 1000, 1190),
    ('papa-camote', '1 kg', 1, 'KG', 2500, 2975),
    ('papa', '1 kg', 1, 'KG', 950, 1131),
    ('pepino-verdura', '1 unidad', 1, 'UND', 500, 595),
    ('pimenton-amarillo', '1 unidad', 1, 'UND', 900, 1071),
    ('pimenton-rojo-primera', '1 unidad', 1, 'UND', 1000, 1190),
    ('pimenton-verde-primera', '1 unidad', 1, 'UND', 800, 952),
    ('rabano', '1 unidad', 1, 'UND', 600, 714),
    ('repollo-morado', '1 unidad', 1, 'UND', 2000, 2380),
    ('repollo-verde', '1 unidad', 1, 'UND', 2000, 2380),
    ('tomate-primera', '1 kg', 1, 'KG', 1200, 1428),
    ('zanahoria', '1 kg', 1, 'KG', 1400, 1666),
    ('zapallo-camote', '1 kg', 1, 'KG', 2500, 2975),
    ('aji-amarillo', '1 kg', 1, 'KG', 8000, 9520),
    ('zapallo-italiano', '1 unidad', 1, 'UND', 600, 714),
    ('limon-camote-malla', '1 unidad', 1, 'UND', 4000, 4760),
    ('limon-normal-malla', '1 unidad', 1, 'UND', 4500, 5355),
    ('limon-sutil', '1 kg', 1, 'KG', 2800, 3332),
    ('mango', '1 unidad', 1, 'UND', 1500, 1785),
    ('manzana-roja-o-verde', '1 kg', 1, 'KG', 1500, 1785),
    ('naranja', '1 kg', 1, 'KG', 700, 833),
    ('palta-peruana-1ra', '1 kg', 1, 'KG', 3000, 3570),
    ('pina', '1 unidad', 1, 'UND', 2800, 3332),
    ('platano', '1 kg', 1, 'KG', 1200, 1428),
    ('pomelo', '1 kg', 1, 'KG', 1000, 1190),
    ('platano-macho', '1 kg', 1, 'KG', 2500, 2975),
    ('mandarina', '1 kg', 1, 'KG', 1000, 1190),
    ('kiwi', '1 kg', 1, 'KG', 1500, 1785),
    ('cebollin', '1 unidad', 1, 'UND', 700, 833),
    ('champinon', '1 kg', 1, 'KG', 8000, 9520),
    ('cilantro', '1 unidad', 1, 'UND', 900, 1071),
    ('perejil', '1 unidad', 1, 'UND', 600, 714),
    ('semilla-de-mostaza', '1 kg', 1, 'KG', 5500, 6545),
    ('anis-estrellado', '1 kg', 1, 'KG', 18000, 21420),
    ('cebolla-blanca-malla', '1 malla', 1, 'UND', 12000, 14280),
    ('cebolla-morada-malla', '1 malla', 1, 'UND', 20000, 23800),
    ('paquete-cebollin-10-und', 'Paquete 10 unidades', 10, 'UND', 7000, 8330),
    ('escarola-caja', '1 caja', 1, 'UND', 13000, 15470),
    ('naranja-malla-15-kg', 'Malla 15 kg', 15, 'KG', 7000, 8330),
    ('saco-papa-lavada-25-kg', 'Saco 25 kg', 25, 'KG', 22000, 26180),
    ('saco-de-papa-sucia-25-kg', 'Saco 25 kg', 25, 'KG', 19000, 22610),
    ('tomate-primera-caja-17-kg', 'Caja 17 kg', 17, 'KG', 19000, 22610),
    ('caja-de-italiano', '1 caja', 1, 'UND', 22000, 26180),
    ('caja-de-huevo', '1 caja', 1, 'UND', 36000, 42840),
    ('miel', '1 kg', 1, 'KG', 6000, 7140)
)
insert into public.presentaciones_producto
  (producto_id, nombre, cantidad, unidad, precio_neto, precio_final, es_principal, activa, orden)
select p.id, d.nombre, d.cantidad, d.unidad, d.precio_neto, d.precio_final, true, true, 1
from datos d
join public.productos p on p.slug = d.producto_slug
on conflict (producto_id) where es_principal and activa do update set
  nombre = excluded.nombre,
  cantidad = excluded.cantidad,
  unidad = excluded.unidad,
  precio_neto = excluded.precio_neto,
  precio_final = excluded.precio_final,
  orden = excluded.orden;

commit;
