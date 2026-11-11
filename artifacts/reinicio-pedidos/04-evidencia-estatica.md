# Evidencia estática local — una pasada de fuentes SQL

No demuestra instalación remota. Incluye módulos manuales opcionales. No es SQL ejecutable.

## supabase/migrations/20260810041535_crear_nucleo_hidro_leufu.sql

4: create type public.canal_origen_pedido as enum ('web', 'whatsapp', 'telefono', 'instagram', 'manual', 'otro');
5: create type public.estado_pedido as enum (
9: create type public.metodo_pago as enum ('efectivo', 'transferencia', 'otro', 'tarjeta', 'pago_web');
10: create type public.estado_pago as enum ('registrado', 'pendiente_verificacion', 'confirmado', 'anulado');
12: create function public.actualizar_fecha_actualizacion()
23: create table public.perfiles (
24:   usuario_id uuid primary key references auth.users(id) on delete cascade,
32: create table public.clientes (
34:   usuario_id uuid unique references auth.users(id) on delete set null,
44: create table public.direcciones_cliente (
46:   cliente_id uuid not null references public.clientes(id) on delete restrict,
67: create table public.categorias (
78: create table public.productos (
80:   categoria_id uuid references public.categorias(id) on delete restrict,
84:   ruta_imagen text,
96: create table public.presentaciones_producto (
98:   producto_id uuid not null references public.productos(id) on delete restrict,
114: create sequence public.numeros_pedido_seq start with 1 increment by 1;
116: create table public.pedidos (
118:   numero_pedido text not null unique default ('HL-' || lpad(nextval('public.numeros_pedido_seq')::text, 6, '0')),
119:   cliente_id uuid references public.clientes(id) on delete restrict,
120:   canal_origen public.canal_origen_pedido not null,
121:   estado public.estado_pedido not null default 'recibido',
125:   direccion_cliente_id uuid references public.direcciones_cliente(id) on delete set null,
138:   constraint pedidos_total_coherente check (total = subtotal + costo_entrega - descuento),
139:   constraint pedidos_descuento_no_supera_base check (descuento <= subtotal + costo_entrega)
142: create table public.items_pedido (
144:   pedido_id uuid not null references public.pedidos(id) on delete restrict,
145:   producto_id uuid references public.productos(id) on delete set null,
146:   presentacion_producto_id uuid references public.presentaciones_producto(id) on delete set null,
158: create function public.validar_total_linea_pedido()
165:     raise exception 'total_linea debe corresponder a cantidad por precio final unitario';
171: create trigger validar_total_linea_pedido_antes_de_guardar
172: before insert or update of cantidad, precio_final_unitario_snapshot, total_linea on public.items_pedido
173: for each row execute function public.validar_total_linea_pedido();
175: create table public.historial_estados_pedido (
177:   pedido_id uuid not null references public.pedidos(id) on delete restrict,
178:   estado_anterior public.estado_pedido,
179:   estado_nuevo public.estado_pedido not null,
180:   cambiado_por uuid references auth.users(id) on delete set null,
185: create function public.registrar_historial_estado_pedido()
193:     insert into public.historial_estados_pedido (pedido_id, estado_anterior, estado_nuevo, cambiado_por)
196:     insert into public.historial_estados_pedido (pedido_id, estado_anterior, estado_nuevo, cambiado_por)
203: create trigger registrar_historial_estado_pedido_despues_de_guardar
204: after insert or update of estado on public.pedidos
205: for each row execute function public.registrar_historial_estado_pedido();
207: create table public.pagos (
209:   cliente_id uuid not null references public.clientes(id) on delete restrict,
211:   metodo_pago public.metodo_pago not null,
212:   estado public.estado_pago not null default 'registrado',
215:   registrado_por uuid references auth.users(id) on delete set null,
216:   fecha_pago timestamptz not null default now(),
221: create table public.aplicaciones_pago (
223:   pago_id uuid not null references public.pagos(id) on delete restrict,
224:   pedido_id uuid not null references public.pedidos(id) on delete restrict,
227:   constraint aplicaciones_pago_unica_por_pago_y_pedido unique (pago_id, pedido_id)
230: create function public.validar_aplicacion_pago()
237:   pago_actual public.pagos%rowtype;
238:   pedido_actual public.pedidos%rowtype;
239:   aplicado_pago bigint;
240:   aplicado_pedido bigint;
242:   select * into pago_actual from public.pagos where id = new.pago_id for update;
243:   if not found then raise exception 'Pago inexistente'; end if;
244:   if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;
245:   select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
246:   if not found then raise exception 'Pedido inexistente'; end if;
247:   if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then
248:     raise exception 'El pago y el pedido deben pertenecer al mismo cliente';
250:   if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;
251:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
252:   from public.aplicaciones_pago a join public.pagos p on p.id = a.pago_id
253:   where a.pago_id = new.pago_id and p.estado <> 'anulado' and a.id is distinct from new.id;
254:   if aplicado_pago + new.monto_aplicado > pago_actual.monto then
255:     raise exception 'La aplicación supera el monto disponible del pago';
257:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
258:   from public.aplicaciones_pago a join public.pagos p on p.id = a.pago_id
259:   where a.pedido_id = new.pedido_id and p.estado <> 'anulado' and a.id is distinct from new.id;
260:   if aplicado_pedido + new.monto_aplicado > pedido_actual.total then
261:     raise exception 'La aplicación supera el saldo pendiente del pedido';
267: create trigger validar_aplicacion_pago_antes_de_guardar
268: before insert or update of pago_id, pedido_id, monto_aplicado on public.aplicaciones_pago
269: for each row execute function public.validar_aplicacion_pago();
271: create view public.v_saldos_pedidos
275:   p.id as pedido_id,
277:   p.total as total_pedido,
281:     when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado'), 0) = 0 then 'sin_pago'
284:   end as estado_pago
285: from public.pedidos p
286: left join public.aplicaciones_pago a on a.pedido_id = p.id
287: left join public.pagos pa on pa.id = a.pago_id
291: create view public.v_saldos_clientes
296:   coalesce(sum(s.total_pedido), 0)::bigint as total_facturado_relevante,
299:   count(*) filter (where s.saldo_pendiente > 0)::bigint as cantidad_pedidos_pendientes
301: left join public.v_saldos_pedidos s on s.cliente_id = c.id
304: create view public.v_saldos_pagos
308:   p.id as pago_id,
310:   p.monto as monto_pago,
317: from public.pagos p
318: left join public.aplicaciones_pago a on a.pago_id = p.id
321: create function public.es_admin()
334: create trigger actualizar_perfiles_fecha_actualizacion before update on public.perfiles for each row execute function public.actualizar_fecha_actualizacion();
335: create trigger actualizar_clientes_fecha_actualizacion before update on public.clientes for each row execute function public.actualizar_fecha_actualizacion();
336: create trigger actualizar_direcciones_cliente_fecha_actualizacion before update on public.direcciones_cliente for each row execute function public.actualizar_fecha_actualizacion();
337: create trigger actualizar_categorias_fecha_actualizacion before update on public.categorias for each row execute function public.actualizar_fecha_actualizacion();
338: create trigger actualizar_productos_fecha_actualizacion before update on public.productos for each row execute function public.actualizar_fecha_actualizacion();
339: create trigger actualizar_presentaciones_producto_fecha_actualizacion before update on public.presentaciones_producto for each row execute function public.actualizar_fecha_actualizacion();
340: create trigger actualizar_pedidos_fecha_actualizacion before update on public.pedidos for each row execute function public.actualizar_fecha_actualizacion();
341: create trigger actualizar_pagos_fecha_actualizacion before update on public.pagos for each row execute function public.actualizar_fecha_actualizacion();
347: create index pedidos_cliente_id_idx on public.pedidos (cliente_id);
348: create index pedidos_estado_idx on public.pedidos (estado);
349: create index pedidos_fecha_creacion_idx on public.pedidos (fecha_creacion desc);
350: create index pedidos_fecha_entrega_idx on public.pedidos (fecha_entrega) where fecha_entrega is not null;
351: create index items_pedido_pedido_id_idx on public.items_pedido (pedido_id);
352: create index historial_estados_pedido_pedido_id_idx on public.historial_estados_pedido (pedido_id);
353: create index pagos_cliente_id_idx on public.pagos (cliente_id);
354: create index pagos_fecha_pago_idx on public.pagos (fecha_pago desc);
355: create index aplicaciones_pago_pago_id_idx on public.aplicaciones_pago (pago_id);
356: create index aplicaciones_pago_pedido_id_idx on public.aplicaciones_pago (pedido_id);
358: alter table public.perfiles enable row level security;
359: alter table public.clientes enable row level security;
360: alter table public.direcciones_cliente enable row level security;
361: alter table public.categorias enable row level security;
362: alter table public.productos enable row level security;
363: alter table public.presentaciones_producto enable row level security;
364: alter table public.pedidos enable row level security;
365: alter table public.items_pedido enable row level security;
366: alter table public.historial_estados_pedido enable row level security;
367: alter table public.pagos enable row level security;
368: alter table public.aplicaciones_pago enable row level security;
372:   public.clientes, public.direcciones_cliente, public.pedidos, public.items_pedido,
373:   public.historial_estados_pedido, public.pagos, public.aplicaciones_pago to authenticated;
375: grant usage, select on sequence public.numeros_pedido_seq to authenticated;
377: revoke all on function public.actualizar_fecha_actualizacion(), public.validar_total_linea_pedido(),
378:   public.registrar_historial_estado_pedido(), public.validar_aplicacion_pago() from public, anon, authenticated;
387: create policy pedidos_lectura_propia on public.pedidos for select to authenticated using (public.es_admin() or exists (select 1 from public.clientes c where c.id = cliente_id and c.usuario_id = auth.uid()));
388: create policy items_pedido_lectura_propia on public.items_pedido for select to authenticated using (public.es_admin() or exists (select 1 from public.pedidos p join public.clientes c on c.id = p.cliente_id where p.id = pedido_id and c.usuario_id = auth.uid()));
389: create policy historial_estados_pedido_lectura_propia on public.historial_estados_pedido for select to authenticated using (public.es_admin() or exists (select 1 from public.pedidos p join public.clientes c on c.id = p.cliente_id where p.id = pedido_id and c.usuario_id = auth.uid()));
390: create policy pagos_lectura_propia on public.pagos for select to authenticated using (public.es_admin() or exists (select 1 from public.clientes c where c.id = cliente_id and c.usuario_id = auth.uid()));
391: create policy aplicaciones_pago_lectura_propia on public.aplicaciones_pago for select to authenticated using (public.es_admin() or exists (select 1 from public.pedidos p join public.clientes c on c.id = p.cliente_id where p.id = pedido_id and c.usuario_id = auth.uid()));
398: create policy pedidos_administracion on public.pedidos for all to authenticated using (public.es_admin()) with check (public.es_admin());
399: create policy items_pedido_administracion on public.items_pedido for all to authenticated using (public.es_admin()) with check (public.es_admin());
400: create policy historial_estados_pedido_administracion on public.historial_estados_pedido for all to authenticated using (public.es_admin()) with check (public.es_admin());
401: create policy pagos_administracion on public.pagos for all to authenticated using (public.es_admin()) with check (public.es_admin());
402: create policy aplicaciones_pago_administracion on public.aplicaciones_pago for all to authenticated using (public.es_admin()) with check (public.es_admin());
404: revoke all on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos from public, anon, authenticated;

## supabase/migrations/20260810041835_restringir_ejecucion_anonima_es_admin.sql


## supabase/migrations/20260810041908_cerrar_ejecucion_publica_es_admin.sql


## supabase/migrations/20260810042236_endurecer_seguridad_nucleo.sql

5: alter view public.v_saldos_pedidos set (security_invoker = true);
7: alter view public.v_saldos_pagos set (security_invoker = true);
8: revoke all on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos from public, anon;
9: grant select on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos to authenticated;
11: -- El API no requiere privilegios DDL ni de referencias para roles de aplicación.
14:   public.pedidos, public.items_pedido, public.historial_estados_pedido,
15:   public.pagos, public.aplicaciones_pago from public, anon, authenticated;
19:   public.clientes, public.direcciones_cliente, public.pedidos, public.items_pedido,
20:   public.historial_estados_pedido, public.pagos, public.aplicaciones_pago to authenticated;
23: revoke all on sequence public.numeros_pedido_seq from public, anon, authenticated;
24: grant usage on sequence public.numeros_pedido_seq to authenticated;
28:   public.validar_total_linea_pedido(), public.registrar_historial_estado_pedido(),
29:   public.validar_aplicacion_pago() from public, anon, authenticated;

## supabase/migrations/20260810043043_sembrar_catalogo_hidro_leufu.sql

2: -- No carga imágenes: el frontend actual sólo declara imageFallback, no rutas reales.
7:   ('verduras-hortalizas', 'Verduras y hortalizas', 'Variedad fresca para cada pedido.', true, 2),
8:   ('frutas', 'Frutas', 'Frutas frescas en distintos formatos.', true, 3),
10:   ('formatos-cajas', 'Formatos y cajas', 'Formatos comerciales para distintos pedidos.', true, 5),
55:     ('limon-camote-malla', 'frutas', 'Limón camote malla', 'Limón camote malla.', true, true, false, false, false, 39),
56:     ('limon-normal-malla', 'frutas', 'Limón normal malla', 'Limón normal malla.', true, true, false, false, false, 40),
57:     ('limon-sutil', 'frutas', 'Limón sutil', 'Limón sutil.', true, true, false, false, false, 41),
58:     ('mango', 'frutas', 'Mango', 'Mango.', true, true, false, false, false, 42),
59:     ('manzana-roja-o-verde', 'frutas', 'Manzana roja o verde', 'Manzana roja o verde.', true, true, false, false, false, 43),
60:     ('naranja', 'frutas', 'Naranja', 'Naranja.', true, true, false, false, false, 44),
61:     ('palta-peruana-1ra', 'frutas', 'Palta peruana 1ra', 'Palta peruana 1ra.', true, true, false, false, false, 45),
62:     ('pina', 'frutas', 'Piña', 'Piña.', true, true, false, false, false, 46),
63:     ('platano', 'frutas', 'Plátano', 'Plátano.', true, true, false, false, false, 47),
64:     ('pomelo', 'frutas', 'Pomelo', 'Pomelo.', true, true, false, false, false, 48),
65:     ('platano-macho', 'frutas', 'Plátano macho', 'Plátano macho.', true, true, false, false, true, 49),
66:     ('mandarina', 'frutas', 'Mandarina', 'Mandarina.', true, true, false, false, false, 50),
67:     ('kiwi', 'frutas', 'Kiwi', 'Kiwi.', true, true, false, false, false, 51),
86: insert into public.productos (categoria_id, nombre, slug, descripcion, ruta_imagen, unidad_base, activo, disponible, destacado, mas_vendido, nuevo, orden)
90:   categoria_id = excluded.categoria_id, nombre = excluded.nombre, descripcion = excluded.descripcion, ruta_imagen = excluded.ruta_imagen,

## supabase/migrations/20260810044148_administrar_catalogo_admin.sql

1: create function public.guardar_producto_administrativo(
7:   p_ruta_imagen text,
30:     raise exception 'No autorizado';
33:     raise exception 'Datos de producto inválidos';
36:     raise exception 'Datos de presentación inválidos';
39:     raise exception 'Categoría inválida';
43:     insert into public.productos (categoria_id, nombre, slug, descripcion, ruta_imagen, unidad_base, activo, disponible, destacado, mas_vendido, nuevo, orden)
44:     values (p_categoria_id, btrim(p_nombre), p_slug, nullif(btrim(p_descripcion), ''), nullif(btrim(p_ruta_imagen), ''), 'comercial', p_activo, p_disponible, p_destacado, p_mas_vendido, p_nuevo, p_orden)
50:       descripcion = nullif(btrim(p_descripcion), ''), ruta_imagen = nullif(btrim(p_ruta_imagen), ''), activo = p_activo,
53:     if v_producto_id is null then raise exception 'Producto inexistente'; end if;

## supabase/migrations/20260810051554_crear_perfil_al_registrarse.sql

1: create function public.crear_perfil_al_registrarse()
15: create trigger crear_perfil_al_registrarse
17: for each row execute function public.crear_perfil_al_registrarse();

## supabase/migrations/20260810110000_asignar_imagenes_hidroponicos.sql

1: -- Rutas estáticas versionadas; la aplicación no usa Supabase Storage para estas imágenes.
2: with imagenes (slug, ruta_imagen) as (
18: set ruta_imagen = imagenes.ruta_imagen
32:   ) and ruta_imagen is not null;
34:     raise exception 'Se esperaban 12 productos con ruta_imagen; se encontraron %', filas_asignadas;

## supabase/migrations/20260811090000_actualizar_catalogo_real_hidro_leufu_agosto.sql

11:     raise exception 'No se puede normalizar italiano: existen ambos slugs';
25:   ('frutas', 'Frutas', true, 3),
75:     ('frutas', 'limon-camote-malla', 'Limón camote malla', 39),
76:     ('frutas', 'limon-normal-malla', 'Limón normal malla', 40),
77:     ('frutas', 'limon-sutil', 'Limón sutil', 41),
78:     ('frutas', 'mango', 'Mango', 42),
79:     ('frutas', 'manzana-roja-o-verde', 'Manzana roja o verde', 43),
80:     ('frutas', 'naranja', 'Naranja', 44),
81:     ('frutas', 'palta-peruana-1ra', 'Palta peruana 1ra', 45),
82:     ('frutas', 'pina', 'Piña', 46),
83:     ('frutas', 'platano', 'Plátano', 47),
84:     ('frutas', 'pomelo', 'Pomelo', 48),
85:     ('frutas', 'platano-macho', 'Plátano macho', 49),
86:     ('frutas', 'mandarina', 'Mandarina', 50),
87:     ('frutas', 'kiwi', 'Kiwi', 51),

## supabase/migrations/20260811100000_asignar_imagenes_catalogo_verduras.sql

1: -- Rutas públicas verificadas para fotografías de verduras, frutas y hierbas.
6: with imagenes (slug, ruta_imagen) as (
51: set ruta_imagen = imagenes.ruta_imagen
54:   and producto.ruta_imagen is distinct from imagenes.ruta_imagen;

## supabase/migrations/20260811110000_endurecer_guardado_producto_administrativo.sql

5: create or replace function public.guardar_producto_administrativo(
11:   p_ruta_imagen text,
37:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
46:     raise exception 'CATEGORIA_INVALIDA' using errcode = '22023';
50:     raise exception 'NOMBRE_REQUERIDO' using errcode = '22023';
54:     raise exception 'SLUG_INVALIDO' using errcode = '22023';
58:     raise exception 'PRESENTACION_REQUERIDA' using errcode = '22023';
62:     raise exception 'UNIDAD_INVALIDA' using errcode = '22023';
66:     raise exception 'CANTIDAD_INVALIDA' using errcode = '22023';
74:     raise exception 'PRECIO_INVALIDO' using errcode = '22023';
78:     raise exception 'PRESENTACION_PRINCIPAL_REQUERIDA' using errcode = '22023';
87:     raise exception 'DATOS_PRODUCTO_INVALIDOS' using errcode = '22023';
96:       ruta_imagen,
110:       nullif(btrim(p_ruta_imagen), ''),
154:     raise exception 'PRODUCTO_INEXISTENTE' using errcode = '22023';
165:     raise exception 'PRESENTACION_PRINCIPAL_REQUERIDA' using errcode = '22023';
177:     raise exception 'PRESENTACION_PRINCIPAL_REQUERIDA' using errcode = '22023';
185:       ruta_imagen = nullif(btrim(p_ruta_imagen), ''),

## supabase/migrations/20260811120000_crear_cuenta_corriente_clientes.sql

2: -- La fuente de verdad son los pedidos, pagos confirmados y ajustes históricos.
4: create table public.ajustes_cuenta_cliente (
6:   cliente_id uuid not null references public.clientes(id) on delete restrict,
11:   registrado_por uuid references auth.users(id) on delete set null,
12:   fecha_ajuste timestamptz not null default now(),
16: create index ajustes_cuenta_cliente_cliente_id_idx
17:   on public.ajustes_cuenta_cliente (cliente_id);
19: create index ajustes_cuenta_cliente_cliente_fecha_idx
20:   on public.ajustes_cuenta_cliente (cliente_id, fecha_ajuste desc);
22: alter table public.ajustes_cuenta_cliente enable row level security;
24: grant select, insert, update, delete on public.ajustes_cuenta_cliente to authenticated;
25: revoke all on public.ajustes_cuenta_cliente from public, anon;
27: create policy ajustes_cuenta_cliente_lectura_propia
28:   on public.ajustes_cuenta_cliente
41: create policy ajustes_cuenta_cliente_administracion
42:   on public.ajustes_cuenta_cliente
48: create view public.v_movimientos_cuenta_cliente
55:     'pedido'::text as tipo_movimiento,
57:     p.numero_pedido as referencia,
58:     ('Pedido ' || p.numero_pedido) as concepto,
64:   from public.pedidos p
72:     p.fecha_pago as fecha,
73:     'pago'::text as tipo_movimiento,
75:     coalesce(nullif(btrim(p.referencia), ''), 'Pago ' || left(p.id::text, 8)) as referencia,
76:     ('Pago ' || p.metodo_pago::text) as concepto,
82:   from public.pagos p
89:     a.fecha_ajuste as fecha,
90:     'ajuste'::text as tipo_movimiento,
92:     'Ajuste ' || left(a.id::text, 8) as referencia,
99:   from public.ajustes_cuenta_cliente a
118: create view public.v_saldos_cuenta_clientes
124:   coalesce(sum(m.cargo) filter (where m.tipo_movimiento = 'pedido'), 0)::bigint as total_pedidos,
125:   coalesce(sum(m.abono) filter (where m.tipo_movimiento = 'pago'), 0)::bigint as total_pagos_confirmados,
126:   coalesce(sum(m.cargo) filter (where m.tipo_movimiento = 'ajuste'), 0)::bigint as total_ajustes_cargo,
127:   coalesce(sum(m.abono) filter (where m.tipo_movimiento = 'ajuste'), 0)::bigint as total_ajustes_abono,
129:   count(m.referencia_id) filter (where m.tipo_movimiento = 'pedido')::bigint as cantidad_pedidos,

## supabase/migrations/20260811121000_endurecer_grants_ajustes_cuenta_cliente.sql

2: revoke all on public.ajustes_cuenta_cliente from public, anon, authenticated;
3: grant select, insert, update, delete on public.ajustes_cuenta_cliente to authenticated;

## supabase/migrations/20260811121500_endurecer_grants_vistas_cuenta_cliente.sql


## supabase/migrations/20260811123000_crear_rpc_pedido_desde_carrito.sql

1: -- Creación transaccional de pedidos B2B desde el carrito.
3: alter table public.pedidos
6: create unique index pedidos_clave_idempotencia_unica
7:   on public.pedidos (clave_idempotencia)
10: create function public.es_presentacion_kg_fraccionable(
26: create function public.es_cantidad_pedido_valida(
55: create function public.crear_pedido_desde_carrito(
63:   pedido_id uuid,
64:   numero_pedido text,
65:   estado public.estado_pedido,
79:   v_pedido public.pedidos%rowtype;
80:   v_pedido_existente public.pedidos%rowtype;
92:     raise exception 'NO_AUTORIZADO';
96:     raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA';
108:     raise exception 'CLIENTE_INVALIDO';
112:     raise exception 'NO_AUTORIZADO';
116:   into v_pedido_existente
117:   from public.pedidos p
122:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then
123:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
128:       v_pedido_existente.id,
129:       v_pedido_existente.numero_pedido,
130:       v_pedido_existente.estado,
131:       v_pedido_existente.subtotal,
132:       v_pedido_existente.costo_entrega,
133:       v_pedido_existente.descuento,
134:       v_pedido_existente.total;
141:     raise exception 'ITEMS_REQUERIDOS';
153:       raise exception 'DIRECCION_INVALIDA';
159:   insert into public.pedidos (
200:   returning * into v_pedido;
202:   if v_pedido.id is null then
204:     into v_pedido_existente
205:     from public.pedidos p
209:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then
210:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
215:       v_pedido_existente.id,
216:       v_pedido_existente.numero_pedido,
217:       v_pedido_existente.estado,
218:       v_pedido_existente.subtotal,
219:       v_pedido_existente.costo_entrega,
220:       v_pedido_existente.descuento,
221:       v_pedido_existente.total;
227:       raise exception 'ITEM_INVALIDO';
235:       raise exception 'PRESENTACION_INVALIDA';
240:       raise exception 'CANTIDAD_INVALIDA';
247:       raise exception 'PRESENTACION_DUPLICADA';
272:       raise exception 'PRESENTACION_NO_DISPONIBLE';
275:     if not public.es_cantidad_pedido_valida(
281:       raise exception 'CANTIDAD_INVALIDA';
284:     insert into public.items_pedido (
285:       pedido_id,
298:       v_pedido.id,
314:   from public.items_pedido i
315:   where i.pedido_id = v_pedido.id;
317:   update public.pedidos
323:   where id = v_pedido.id
324:   returning * into v_pedido;
328:     v_pedido.id,
329:     v_pedido.numero_pedido,
330:     v_pedido.estado,
331:     v_pedido.subtotal,
332:     v_pedido.costo_entrega,
333:     v_pedido.descuento,
334:     v_pedido.total;
339: revoke all on function public.es_cantidad_pedido_valida(text, numeric, text, numeric) from public, anon, authenticated;
340: revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
341: grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) to authenticated;

## supabase/migrations/20260811123500_corregir_cantidad_json_pedido.sql

2: create or replace function public.crear_pedido_desde_carrito(
10:   pedido_id uuid,
11:   numero_pedido text,
12:   estado public.estado_pedido,
26:   v_pedido public.pedidos%rowtype;
27:   v_pedido_existente public.pedidos%rowtype;
38:     raise exception 'NO_AUTORIZADO';
42:     raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA';
52:     raise exception 'CLIENTE_INVALIDO';
56:     raise exception 'NO_AUTORIZADO';
59:   select * into v_pedido_existente
60:   from public.pedidos p
65:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then
66:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
69:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido,
70:       v_pedido_existente.estado, v_pedido_existente.subtotal,
71:       v_pedido_existente.costo_entrega, v_pedido_existente.descuento,
72:       v_pedido_existente.total;
77:     raise exception 'ITEMS_REQUERIDOS';
88:       raise exception 'DIRECCION_INVALIDA';
94:   insert into public.pedidos (
111:   returning * into v_pedido;
113:   if v_pedido.id is null then
114:     select * into v_pedido_existente
115:     from public.pedidos p
119:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then
120:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
123:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido,
124:       v_pedido_existente.estado, v_pedido_existente.subtotal,
125:       v_pedido_existente.costo_entrega, v_pedido_existente.descuento,
126:       v_pedido_existente.total;
132:       raise exception 'ITEM_INVALIDO';
139:       raise exception 'PRESENTACION_INVALIDA';
143:       raise exception 'CANTIDAD_INVALIDA';
150:       raise exception 'PRESENTACION_DUPLICADA';
169:       raise exception 'PRESENTACION_NO_DISPONIBLE';
172:     if not public.es_cantidad_pedido_valida(
178:       raise exception 'CANTIDAD_INVALIDA';
181:     insert into public.items_pedido (
182:       pedido_id, producto_id, presentacion_producto_id,
187:       v_pedido.id, v_presentacion.producto_id, v_presentacion.id,
197:   from public.items_pedido i
198:   where i.pedido_id = v_pedido.id;
200:   update public.pedidos
202:   where id = v_pedido.id
203:   returning * into v_pedido;
205:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado,
206:     v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;
210: revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
211: grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) to authenticated;

## supabase/migrations/20260811130000_crear_aceptacion_administrativa_pedidos.sql

1: create function public.aceptar_pedido_administrativo(
2:   p_pedido_id uuid
5:   pedido_id uuid,
6:   numero_pedido text,
7:   estado public.estado_pedido,
15:   v_pedido public.pedidos%rowtype;
18:     raise exception 'NO_AUTORIZADO';
22:   into v_pedido
23:   from public.pedidos p
24:   where p.id = p_pedido_id
28:     raise exception 'PEDIDO_NO_ENCONTRADO';
31:   if v_pedido.estado = 'confirmado' then
32:     return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.fecha_actualizacion;
36:   if v_pedido.estado <> 'recibido' then
37:     raise exception 'ESTADO_PEDIDO_INVALIDO';
40:   update public.pedidos
42:   where id = v_pedido.id
43:   returning * into v_pedido;
45:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.fecha_actualizacion;
49: revoke all on function public.aceptar_pedido_administrativo(uuid) from public, anon, authenticated;
50: grant execute on function public.aceptar_pedido_administrativo(uuid) to authenticated;

## supabase/migrations/20260812100000_autogestion_perfil_y_direcciones_cliente.sql

4: create or replace function public.actualizar_perfil_cliente(
19:     raise exception 'NO_AUTORIZADO';
23:     raise exception 'NOMBRE_REQUERIDO';
31:     raise exception 'CLIENTE_NO_ENCONTRADO';
41: create or replace function public.guardar_direccion_cliente(
65:     raise exception 'NO_AUTORIZADO';
69:     raise exception 'DIRECCION_INVALIDA';
77:     raise exception 'CLIENTE_NO_ENCONTRADO';
88:       raise exception 'DIRECCION_NO_ENCONTRADA';
126: create or replace function public.desactivar_direccion_cliente(
138:     raise exception 'NO_AUTORIZADO';
146:     raise exception 'CLIENTE_NO_ENCONTRADO';
157:     raise exception 'DIRECCION_NO_ENCONTRADA';

## supabase/migrations/20260812110000_registrar_ajuste_cuenta_cliente_admin.sql

1: -- Ajustes manuales append-only de la cuenta corriente. El saldo se deriva de
4: create or replace function public.registrar_ajuste_cuenta_cliente(
17:   v_ajuste_id uuid;
22:     raise exception 'NO_AUTORIZADO';
26:     raise exception 'CLIENTE_NO_ENCONTRADO';
30:     raise exception 'TIPO_AJUSTE_INVALIDO';
34:     raise exception 'MONTO_INVALIDO';
38:     raise exception 'MOTIVO_REQUERIDO';
41:   insert into public.ajustes_cuenta_cliente (
42:     cliente_id, tipo, monto, motivo, observacion, registrado_por, fecha_ajuste
46:   ) returning id into v_ajuste_id;
48:   return v_ajuste_id;
52: alter function public.registrar_ajuste_cuenta_cliente(uuid, text, bigint, text, text) owner to postgres;
54: revoke all on function public.registrar_ajuste_cuenta_cliente(uuid, text, bigint, text, text) from public, anon, authenticated;
55: grant execute on function public.registrar_ajuste_cuenta_cliente(uuid, text, bigint, text, text) to authenticated;

## supabase/migrations/20260812120000_registrar_pago_cliente_administrativo.sql

1: -- Registro administrativo atómico de pagos confirmados y distribución FIFO a
2: -- pedidos. La cuenta global sigue derivándose del pago completo en las vistas.
4: alter table public.pagos
7: create unique index pagos_clave_idempotencia_unica
8:   on public.pagos (clave_idempotencia)
11: create or replace function public.registrar_pago_cliente_administrativo(
14:   p_metodo_pago text,
20:   pago_id uuid,
30:   v_pago public.pagos%rowtype;
31:   v_pedido record;
32:   v_metodo text := lower(btrim(p_metodo_pago));
34:   v_aplicacion bigint;
38:     raise exception 'NO_AUTORIZADO';
42:     raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA';
46:     raise exception 'MONTO_INVALIDO';
49:   if v_metodo not in ('efectivo', 'transferencia', 'otro', 'tarjeta', 'pago_web') then
50:     raise exception 'METODO_PAGO_INVALIDO';
53:   -- Serializa los pagos automáticos de un mismo cliente antes de leer los
54:   -- saldos aplicables; así dos pagos no distribuyen el mismo saldo pendiente.
62:     raise exception 'CLIENTE_INVALIDO';
65:   select * into v_pago
66:   from public.pagos p
71:     if v_pago.cliente_id is distinct from p_cliente_id then
72:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
76:     from public.aplicaciones_pago a
77:     where a.pago_id = v_pago.id;
79:     return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
83:   insert into public.pagos (
84:     cliente_id, monto, metodo_pago, estado, referencia, observacion,
85:     registrado_por, fecha_pago, clave_idempotencia
87:     p_cliente_id, p_monto, v_metodo::public.metodo_pago, 'confirmado',
92:   returning * into v_pago;
94:   if v_pago.id is null then
95:     select * into v_pago
96:     from public.pagos p
100:     if not found or v_pago.cliente_id is distinct from p_cliente_id then
101:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
105:     from public.aplicaciones_pago a
106:     where a.pago_id = v_pago.id;
108:     return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
112:   -- Bloquea las filas base de pedidos antes de consultar v_saldos_pedidos,
113:   -- la autoridad existente para el saldo aplicable de cada pedido.
115:   from public.pedidos p
122:   for v_pedido in
124:     from public.pedidos p
125:     join public.v_saldos_pedidos s on s.pedido_id = p.id
132:     v_aplicacion := least(v_restante, v_pedido.saldo_pendiente);
133:     insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado)
134:     values (v_pago.id, v_pedido.id, v_aplicacion);
135:     v_restante := v_restante - v_aplicacion;
139:   return query select v_pago.id, p_monto, v_monto_aplicado, v_restante;
143: alter function public.registrar_pago_cliente_administrativo(uuid, bigint, text, text, text, uuid) owner to postgres;
145: revoke all on function public.registrar_pago_cliente_administrativo(uuid, bigint, text, text, text, uuid) from public, anon, authenticated;
146: grant execute on function public.registrar_pago_cliente_administrativo(uuid, bigint, text, text, text, uuid) to authenticated;

## supabase/migrations/20260812130000_anulacion_segura_pagos_y_cancelacion_pedidos.sql

1: -- Vigencia histórica de aplicaciones, anulación de pagos y cancelación de
2: -- pedidos. Ninguna operación elimina registros financieros u operativos.
4: alter table public.aplicaciones_pago
7:   add column anulada_por uuid references auth.users(id) on delete set null,
10: alter table public.pagos
12:   add column anulado_por uuid references auth.users(id) on delete set null,
15: create index aplicaciones_pago_activas_pago_id_idx
16:   on public.aplicaciones_pago (pago_id)
19: create index aplicaciones_pago_activas_pedido_id_idx
20:   on public.aplicaciones_pago (pedido_id)
23: create or replace function public.validar_aplicacion_pago()
30:   pago_actual public.pagos%rowtype;
31:   pedido_actual public.pedidos%rowtype;
32:   aplicado_pago bigint;
33:   aplicado_pedido bigint;
35:   select * into pago_actual from public.pagos where id = new.pago_id for update;
36:   if not found then raise exception 'Pago inexistente'; end if;
37:   if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;
38:   select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
39:   if not found then raise exception 'Pedido inexistente'; end if;
40:   if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then
41:     raise exception 'El pago y el pedido deben pertenecer al mismo cliente';
43:   if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;
44:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
45:   from public.aplicaciones_pago a join public.pagos p on p.id = a.pago_id
46:   where a.pago_id = new.pago_id
50:   if aplicado_pago + new.monto_aplicado > pago_actual.monto then
51:     raise exception 'La aplicación supera el monto disponible del pago';
53:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
54:   from public.aplicaciones_pago a join public.pagos p on p.id = a.pago_id
55:   where a.pedido_id = new.pedido_id
59:   if aplicado_pedido + new.monto_aplicado > pedido_actual.total then
60:     raise exception 'La aplicación supera el saldo pendiente del pedido';
66: create or replace view public.v_saldos_pedidos
70:   p.id as pedido_id,
72:   p.total as total_pedido,
76:     when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) = 0 then 'sin_pago'
79:   end as estado_pago
80: from public.pedidos p
81: left join public.aplicaciones_pago a on a.pedido_id = p.id
82: left join public.pagos pa on pa.id = a.pago_id
86: create or replace view public.v_saldos_clientes
91:   coalesce(sum(s.total_pedido), 0)::bigint as total_facturado_relevante,
94:   count(*) filter (where s.saldo_pendiente > 0)::bigint as cantidad_pedidos_pendientes
96: left join public.v_saldos_pedidos s on s.cliente_id = c.id
99: create or replace view public.v_saldos_pagos
103:   p.id as pago_id,
105:   p.monto as monto_pago,
112: from public.pagos p
113: left join public.aplicaciones_pago a on a.pago_id = p.id
116: create or replace function public.registrar_pago_cliente_administrativo(
119:   p_metodo_pago text,
124: returns table (pago_id uuid, monto bigint, monto_aplicado bigint, monto_disponible bigint)
128:   v_pago public.pagos%rowtype;
129:   v_pedido record;
130:   v_metodo text := lower(btrim(p_metodo_pago));
132:   v_aplicacion bigint;
135:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
136:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
137:   if p_monto is null or p_monto <= 0 then raise exception 'MONTO_INVALIDO'; end if;
138:   if v_metodo not in ('efectivo', 'transferencia', 'otro', 'tarjeta', 'pago_web') then raise exception 'METODO_PAGO_INVALIDO'; end if;
140:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
141:   select * into v_pago from public.pagos p where p.clave_idempotencia = p_clave_idempotencia for update;
143:     if v_pago.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
144:     select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa;
145:     return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
148:   insert into public.pagos (cliente_id, monto, metodo_pago, estado, referencia, observacion, registrado_por, fecha_pago, clave_idempotencia)
149:   values (p_cliente_id, p_monto, v_metodo::public.metodo_pago, 'confirmado', nullif(btrim(p_referencia), ''), nullif(btrim(p_observacion), ''), auth.uid(), now(), p_clave_idempotencia)
151:   returning * into v_pago;
152:   if v_pago.id is null then
153:     select * into v_pago from public.pagos p where p.clave_idempotencia = p_clave_idempotencia for update;
154:     if not found or v_pago.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
155:     select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa;
156:     return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
159:   perform 1 from public.pedidos p where p.cliente_id = p_cliente_id and p.estado <> 'cancelado' order by p.fecha_creacion, p.id for update;
161:   for v_pedido in select p.id, s.saldo_pendiente from public.pedidos p join public.v_saldos_pedidos s on s.pedido_id = p.id where p.cliente_id = p_cliente_id and p.estado <> 'cancelado' and s.saldo_pendiente > 0 order by p.fecha_creacion, p.id loop
163:     v_aplicacion := least(v_restante, v_pedido.saldo_pendiente);
164:     insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_pago.id, v_pedido.id, v_aplicacion);
165:     v_restante := v_restante - v_aplicacion;
168:   return query select v_pago.id, p_monto, v_monto_aplicado, v_restante;
172: create or replace function public.anular_pago_administrativo(p_pago_id uuid, p_motivo text)
177:   v_pago public.pagos%rowtype;
180:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
181:   if v_motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
182:   select * into v_pago from public.pagos p where p.id = p_pago_id for update;
183:   if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
184:   if v_pago.estado = 'anulado' then return v_pago.id; end if;
185:   if v_pago.estado <> 'confirmado' then raise exception 'ESTADO_PAGO_INVALIDO'; end if;
186:   perform 1 from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa for update;
187:   update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo where pago_id = v_pago.id and activa;
188:   update public.pagos set estado = 'anulado', fecha_anulacion = now(), anulado_por = auth.uid(), motivo_anulacion = v_motivo where id = v_pago.id;
189:   return v_pago.id;
193: create or replace function public.cancelar_pedido_administrativo(p_pedido_id uuid, p_motivo text)
198:   v_pedido public.pedidos%rowtype;
201:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
202:   if v_motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
203:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
204:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
205:   if v_pedido.estado = 'cancelado' then return v_pedido.id; end if;
206:   if v_pedido.estado not in ('recibido', 'en_revision', 'confirmado', 'programado', 'preparando') then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
207:   perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa for update;
208:   update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo where pedido_id = v_pedido.id and activa;
209:   update public.pedidos set estado = 'cancelado' where id = v_pedido.id;
210:   update public.historial_estados_pedido set observacion = v_motivo where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'cancelado' order by h.fecha_creacion desc, h.id desc limit 1);
211:   return v_pedido.id;
215: alter function public.anular_pago_administrativo(uuid, text) owner to postgres;
216: alter function public.cancelar_pedido_administrativo(uuid, text) owner to postgres;
218: revoke all on function public.anular_pago_administrativo(uuid, text) from public, anon, authenticated;
219: revoke all on function public.cancelar_pedido_administrativo(uuid, text) from public, anon, authenticated;
220: grant execute on function public.anular_pago_administrativo(uuid, text) to authenticated;
221: grant execute on function public.cancelar_pedido_administrativo(uuid, text) to authenticated;
223: revoke all on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos from public, anon, authenticated;
224: grant select on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos to authenticated;

## supabase/migrations/20260814100000_crear_ciclo_operativo_pedidos.sql

4: create function public.marcar_pedido_preparando_administrativo(
5:   p_pedido_id uuid
13:   v_pedido public.pedidos%rowtype;
15:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
17:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
18:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
19:   if v_pedido.estado = 'preparando' then return v_pedido.id; end if;
20:   if v_pedido.estado <> 'confirmado' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
22:   update public.pedidos set estado = 'preparando' where id = v_pedido.id;
23:   return v_pedido.id;
27: create function public.marcar_pedido_listo_despacho_administrativo(
28:   p_pedido_id uuid
36:   v_pedido public.pedidos%rowtype;
38:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
40:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
41:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
42:   if v_pedido.estado = 'listo_despacho' then return v_pedido.id; end if;
43:   if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
45:   update public.pedidos set estado = 'listo_despacho' where id = v_pedido.id;
46:   return v_pedido.id;
50: create function public.marcar_pedido_en_reparto_administrativo(
51:   p_pedido_id uuid
59:   v_pedido public.pedidos%rowtype;
61:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
63:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
64:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
65:   if v_pedido.estado = 'en_reparto' then return v_pedido.id; end if;
66:   if v_pedido.estado <> 'listo_despacho' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
68:   update public.pedidos set estado = 'en_reparto' where id = v_pedido.id;
69:   return v_pedido.id;
73: create function public.marcar_pedido_entregado_administrativo(
74:   p_pedido_id uuid
82:   v_pedido public.pedidos%rowtype;
84:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
86:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
87:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
88:   if v_pedido.estado = 'entregado' then return v_pedido.id; end if;
89:   if v_pedido.estado <> 'en_reparto' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
91:   update public.pedidos set estado = 'entregado' where id = v_pedido.id;
92:   return v_pedido.id;
96: alter function public.marcar_pedido_preparando_administrativo(uuid) owner to postgres;
97: alter function public.marcar_pedido_listo_despacho_administrativo(uuid) owner to postgres;
98: alter function public.marcar_pedido_en_reparto_administrativo(uuid) owner to postgres;
99: alter function public.marcar_pedido_entregado_administrativo(uuid) owner to postgres;
101: revoke all on function public.marcar_pedido_preparando_administrativo(uuid) from public, anon, authenticated;
102: revoke all on function public.marcar_pedido_listo_despacho_administrativo(uuid) from public, anon, authenticated;
103: revoke all on function public.marcar_pedido_en_reparto_administrativo(uuid) from public, anon, authenticated;
104: revoke all on function public.marcar_pedido_entregado_administrativo(uuid) from public, anon, authenticated;
106: grant execute on function public.marcar_pedido_preparando_administrativo(uuid) to authenticated;
107: grant execute on function public.marcar_pedido_listo_despacho_administrativo(uuid) to authenticated;
108: grant execute on function public.marcar_pedido_en_reparto_administrativo(uuid) to authenticated;
109: grant execute on function public.marcar_pedido_entregado_administrativo(uuid) to authenticated;

## supabase/migrations/20260814110000_crear_zonas_entrega_y_direcciones_logisticas.sql

1: create table public.zonas_entrega (
13: create trigger actualizar_zonas_entrega_fecha_actualizacion
15: for each row execute function public.actualizar_fecha_actualizacion();
35: alter table public.zonas_entrega enable row level security;
49: alter table public.direcciones_cliente
50: add column zona_entrega_id uuid references public.zonas_entrega(id) on delete restrict;
55: drop function public.guardar_direccion_cliente(uuid, text, text, text, text, text, text, text, boolean);
57: create function public.guardar_direccion_cliente(
81:     raise exception 'NO_AUTORIZADO';
85:     raise exception 'DESTINATARIO_REQUERIDO';
89:     raise exception 'DIRECCION_REQUERIDA';
93:     raise exception 'TELEFONO_INVALIDO';
104:     raise exception 'ZONA_ENTREGA_INVALIDA';
112:     raise exception 'CLIENTE_NO_ENCONTRADO';
123:       raise exception 'DIRECCION_NO_ENCONTRADA';
160: alter function public.guardar_direccion_cliente(uuid, text, text, text, uuid, text, boolean) owner to postgres;

## supabase/migrations/20260815090000_exigir_ubicacion_direcciones_cliente.sql

1: drop function public.guardar_direccion_cliente(uuid, text, text, text, uuid, text, boolean);
3: create function public.guardar_direccion_cliente(
29:     raise exception 'NO_AUTORIZADO';
33:     raise exception 'DESTINATARIO_REQUERIDO';
37:     raise exception 'DIRECCION_REQUERIDA';
41:     raise exception 'TELEFONO_INVALIDO';
46:     raise exception 'UBICACION_REQUERIDA';
50:     raise exception 'UBICACION_INVALIDA';
60:     raise exception 'ZONA_ENTREGA_INVALIDA';
68:     raise exception 'CLIENTE_NO_ENCONTRADO';
79:       raise exception 'DIRECCION_NO_ENCONTRADA';
118: alter function public.guardar_direccion_cliente(uuid, text, text, text, uuid, numeric, numeric, text, boolean) owner to postgres;

## supabase/migrations/20260815110000_agregar_snapshots_logisticos_pedidos.sql

1: alter table public.pedidos
7:   add constraint pedidos_latitud_entrega_snapshot_valida check (latitud_entrega_snapshot is null or latitud_entrega_snapshot between -90 and 90),
8:   add constraint pedidos_longitud_entrega_snapshot_valida check (longitud_entrega_snapshot is null or longitud_entrega_snapshot between -180 and 180);
10: create or replace function public.crear_pedido_desde_carrito(
18:   pedido_id uuid,
19:   numero_pedido text,
20:   estado public.estado_pedido,
34:   v_pedido public.pedidos%rowtype;
35:   v_pedido_existente public.pedidos%rowtype;
46:   if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
47:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
51:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
52:   if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
54:   select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
56:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
57:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
61:   if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
62:   if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;
66:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
67:   if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
71:   if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;
74:   insert into public.pedidos (
84:   ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;
86:   if v_pedido.id is null then
87:     select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
88:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
89:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
94:     if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
96:     if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
97:     if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
100:     if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
107:     if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
108:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
110:     insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id, nombre_producto_snapshot, nombre_presentacion_snapshot, unidad_snapshot, cantidad, precio_neto_unitario_snapshot, precio_final_unitario_snapshot, total_linea, observacion_cliente)
111:     values (v_pedido.id, v_presentacion.producto_id, v_presentacion.id, v_presentacion.nombre_producto, v_presentacion.nombre_presentacion, v_presentacion.unidad, v_cantidad, v_presentacion.precio_neto, v_presentacion.precio_final, round(v_cantidad * v_presentacion.precio_final)::bigint, null);
114:   select coalesce(sum(i.total_linea), 0)::bigint into v_subtotal from public.items_pedido i where i.pedido_id = v_pedido.id;
115:   update public.pedidos set subtotal = v_subtotal, costo_entrega = 0, descuento = 0, total = v_subtotal where id = v_pedido.id returning * into v_pedido;
116:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;
120: revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
121: grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) to authenticated;

## supabase/migrations/20260816110000_crear_dias_entrega.sql

1: create table public.dias_entrega (
13: create trigger actualizar_dias_entrega_fecha_actualizacion
15: for each row execute function public.actualizar_fecha_actualizacion();
34: alter table public.dias_entrega enable row level security;
45: create function public.guardar_dia_entrega_administrativo(
59:     raise exception 'NO_AUTORIZADO';
63:     raise exception 'DIA_SEMANA_INVALIDO';
67:     raise exception 'ACTIVO_INVALIDO';
71:     raise exception 'HORA_CORTE_INVALIDA';
99: alter function public.guardar_dia_entrega_administrativo(smallint, boolean, time) owner to postgres;

## supabase/migrations/20260816120000_programar_fecha_entrega_pedidos.sql

1: alter table public.pedidos
8: create or replace function public.obtener_dias_entrega_activos()
25: alter function public.obtener_dias_entrega_activos() owner to postgres;
30: create or replace function public.fecha_entrega_disponible(
72: alter function public.fecha_entrega_disponible(date, timestamptz) owner to postgres;
76: create or replace function public.crear_pedido_desde_carrito(
85:   pedido_id uuid,
86:   numero_pedido text,
87:   estado public.estado_pedido,
101:   v_pedido public.pedidos%rowtype;
102:   v_pedido_existente public.pedidos%rowtype;
114:   if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
115:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
119:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
120:   if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
122:   select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
124:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
125:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
129:   if p_fecha_entrega is null then raise exception 'FECHA_ENTREGA_REQUERIDA'; end if;
131:   if p_fecha_entrega < v_hoy_local or p_fecha_entrega > v_hoy_local + 14 then raise exception 'FECHA_ENTREGA_INVALIDA'; end if;
132:   if not public.fecha_entrega_disponible(p_fecha_entrega) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
134:   if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
135:   if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;
139:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
140:   if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
144:   if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;
147:   insert into public.pedidos (
157:   ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;
159:   if v_pedido.id is null then
160:     select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
161:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
162:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
167:     if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
169:     if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
170:     if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
173:     if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
180:     if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
181:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
183:     insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id, nombre_producto_snapshot, nombre_presentacion_snapshot, unidad_snapshot, cantidad, precio_neto_unitario_snapshot, precio_final_unitario_snapshot, total_linea, observacion_cliente)
184:     values (v_pedido.id, v_presentacion.producto_id, v_presentacion.id, v_presentacion.nombre_producto, v_presentacion.nombre_presentacion, v_presentacion.unidad, v_cantidad, v_presentacion.precio_neto, v_presentacion.precio_final, round(v_cantidad * v_presentacion.precio_final)::bigint, null);
187:   select coalesce(sum(i.total_linea), 0)::bigint into v_subtotal from public.items_pedido i where i.pedido_id = v_pedido.id;
188:   update public.pedidos set subtotal = v_subtotal, costo_entrega = 0, descuento = 0, total = v_subtotal where id = v_pedido.id returning * into v_pedido;
189:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;
193: alter function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date) owner to postgres;
195: revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date) from public, anon, authenticated;
196: grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date) to authenticated;
198: create or replace function public.crear_pedido_desde_carrito(
206:   pedido_id uuid,
207:   numero_pedido text,
208:   estado public.estado_pedido,
219:   raise exception 'FECHA_ENTREGA_REQUERIDA';
223: alter function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) owner to postgres;
225: revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) from public, anon, authenticated;
226: grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid) to authenticated;

## supabase/migrations/20260816185008_cancelacion_pedido_cliente.sql

2: -- El cliente sólo puede cancelar su propio pedido mientras continúa recibido.
4: create function public.cancelar_pedido_cliente(
5:   p_pedido_id uuid,
9:   pedido_id uuid,
10:   numero_pedido text,
11:   estado public.estado_pedido,
21:   v_pedido public.pedidos%rowtype;
26:     raise exception 'NO_AUTORIZADO';
33:   if not found then raise exception 'NO_AUTORIZADO'; end if;
35:     raise exception 'MOTIVO_DEMASIADO_LARGO';
38:   select * into v_pedido
39:   from public.pedidos p
40:   where p.id = p_pedido_id
43:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
44:   if v_pedido.cliente_id is distinct from v_cliente_id then raise exception 'NO_AUTORIZADO'; end if;
46:   if v_pedido.estado = 'cancelado' then
47:     return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
50:   if v_pedido.estado <> 'recibido' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
54:   perform 1 from public.aplicaciones_pago a
55:   where a.pedido_id = v_pedido.id and a.activa
58:   update public.aplicaciones_pago
60:   where pedido_id = v_pedido.id and activa;
62:   update public.pedidos set estado = 'cancelado'
63:   where id = v_pedido.id
64:   returning * into v_pedido;
66:   update public.historial_estados_pedido
69:     select h.id from public.historial_estados_pedido h
70:     where h.pedido_id = v_pedido.id and h.estado_nuevo = 'cancelado'
75:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
79: alter function public.cancelar_pedido_cliente(uuid, text) owner to postgres;
80: revoke all on function public.cancelar_pedido_cliente(uuid, text) from public, anon, authenticated;
81: grant execute on function public.cancelar_pedido_cliente(uuid, text) to authenticated;

## supabase/migrations/20260816190243_corregir_cancelacion_pedido_cliente.sql

1: -- Evita la ambigüedad entre el parámetro de salida pedido_id y la columna
2: -- aplicaciones_pago.pedido_id en la actualización de liberación.
4: create or replace function public.cancelar_pedido_cliente(
5:   p_pedido_id uuid,
9:   pedido_id uuid,
10:   numero_pedido text,
11:   estado public.estado_pedido,
21:   v_pedido public.pedidos%rowtype;
26:     raise exception 'NO_AUTORIZADO';
33:   if not found then raise exception 'NO_AUTORIZADO'; end if;
35:     raise exception 'MOTIVO_DEMASIADO_LARGO';
38:   select * into v_pedido
39:   from public.pedidos p
40:   where p.id = p_pedido_id
43:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
44:   if v_pedido.cliente_id is distinct from v_cliente_id then raise exception 'NO_AUTORIZADO'; end if;
46:   if v_pedido.estado = 'cancelado' then
47:     return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
50:   if v_pedido.estado <> 'recibido' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
54:   perform 1 from public.aplicaciones_pago a
55:   where a.pedido_id = v_pedido.id and a.activa
58:   update public.aplicaciones_pago a
60:   where a.pedido_id = v_pedido.id and a.activa;
62:   update public.pedidos set estado = 'cancelado'
63:   where id = v_pedido.id
64:   returning * into v_pedido;
66:   update public.historial_estados_pedido h
69:     select ultimo.id from public.historial_estados_pedido ultimo
70:     where ultimo.pedido_id = v_pedido.id and ultimo.estado_nuevo = 'cancelado'
75:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
79: alter function public.cancelar_pedido_cliente(uuid, text) owner to postgres;
80: revoke all on function public.cancelar_pedido_cliente(uuid, text) from public, anon, authenticated;
81: grant execute on function public.cancelar_pedido_cliente(uuid, text) to authenticated;

## supabase/migrations/20260817100000_crear_base_preparacion_real_pedidos.sql

4: alter table public.items_pedido
6:   add constraint items_pedido_modo_cantidad_snapshot_valido check (
11: alter table public.pedidos
16:   add column preparacion_finalizada_por uuid references auth.users(id) on delete set null,
17:   add constraint pedidos_preparacion_estado_valido check (
21:   add constraint pedidos_subtotal_final_no_negativo check (
24:   add constraint pedidos_total_final_no_negativo check (
27:   add constraint pedidos_totales_finales_coherentes check (
36: create table public.preparacion_items_pedido (
38:   pedido_id uuid not null references public.pedidos(id) on delete cascade,
39:   item_pedido_id uuid not null unique references public.items_pedido(id) on delete cascade,
42:   registrado_por uuid references auth.users(id) on delete set null,
47: create index preparacion_items_pedido_pedido_id_idx
48:   on public.preparacion_items_pedido (pedido_id);
50: create function public.validar_coherencia_preparacion_item_pedido()
57:   v_pedido_id uuid;
59:   select i.pedido_id
60:   into v_pedido_id
61:   from public.items_pedido i
62:   where i.id = new.item_pedido_id;
65:     raise exception 'ITEM_PEDIDO_NO_ENCONTRADO';
68:   if v_pedido_id is distinct from new.pedido_id then
69:     raise exception 'ITEM_PEDIDO_NO_CORRESPONDE_AL_PEDIDO';
76: create trigger validar_coherencia_preparacion_item_pedido_antes_de_guardar
77: before insert or update of pedido_id, item_pedido_id
78: on public.preparacion_items_pedido
79: for each row execute function public.validar_coherencia_preparacion_item_pedido();
81: create trigger actualizar_preparacion_items_pedido_fecha_actualizacion
82: before update on public.preparacion_items_pedido
83: for each row execute function public.actualizar_fecha_actualizacion();
85: alter table public.preparacion_items_pedido enable row level security;
87: revoke all on table public.preparacion_items_pedido from public, anon;
88: grant select on table public.preparacion_items_pedido to authenticated;
90: create policy preparacion_items_pedido_lectura_autorizada
91:   on public.preparacion_items_pedido
98:       from public.pedidos p
100:       where p.id = preparacion_items_pedido.pedido_id
105: alter function public.validar_coherencia_preparacion_item_pedido() owner to postgres;
106: revoke all on function public.validar_coherencia_preparacion_item_pedido() from public, anon, authenticated;
108: create or replace function public.crear_pedido_desde_carrito(
117:   pedido_id uuid,
118:   numero_pedido text,
119:   estado public.estado_pedido,
133:   v_pedido public.pedidos%rowtype;
134:   v_pedido_existente public.pedidos%rowtype;
147:   if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
148:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
152:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
153:   if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
155:   select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
157:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
158:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
162:   if p_fecha_entrega is null then raise exception 'FECHA_ENTREGA_REQUERIDA'; end if;
164:   if p_fecha_entrega < v_hoy_local or p_fecha_entrega > v_hoy_local + 14 then raise exception 'FECHA_ENTREGA_INVALIDA'; end if;
165:   if not public.fecha_entrega_disponible(p_fecha_entrega) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
167:   if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
168:   if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;
172:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
173:   if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
177:   if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;
180:   insert into public.pedidos (
190:   ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;
192:   if v_pedido.id is null then
193:     select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
194:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
195:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
200:     if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
202:     if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
203:     if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
206:     if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
213:     if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
214:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
224:     insert into public.items_pedido (
225:       pedido_id,
238:       v_pedido.id,
255:   from public.items_pedido i
256:   where i.pedido_id = v_pedido.id;
258:   update public.pedidos
263:   where id = v_pedido.id
264:   returning * into v_pedido;
268:     v_pedido.id,
269:     v_pedido.numero_pedido,
270:     v_pedido.estado,
271:     v_pedido.subtotal,
272:     v_pedido.costo_entrega,
273:     v_pedido.descuento,
274:     v_pedido.total;
278: alter function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date) owner to postgres;
279: revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date) from public, anon, authenticated;
280: grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date) to authenticated;

## supabase/migrations/20260817110000_registrar_preparacion_items_pedido.sql

4: create function public.guardar_preparacion_item_pedido_administrativo(
5:   p_item_pedido_id uuid,
10:   pedido_id uuid,
11:   item_pedido_id uuid,
20:   v_pedido_id uuid;
21:   v_pedido public.pedidos%rowtype;
22:   v_item public.items_pedido%rowtype;
27:     raise exception 'NO_AUTORIZADO';
30:   if p_item_pedido_id is null then
31:     raise exception 'ITEM_PEDIDO_NO_ENCONTRADO';
35:     raise exception 'CANTIDAD_PREPARADA_REQUERIDA';
39:     raise exception 'CANTIDAD_PREPARADA_INVALIDA';
43:     raise exception 'MOTIVO_DEMASIADO_LARGO';
46:   select i.pedido_id
47:   into v_pedido_id
48:   from public.items_pedido i
49:   where i.id = p_item_pedido_id;
52:     raise exception 'ITEM_PEDIDO_NO_ENCONTRADO';
56:   into v_pedido
57:   from public.pedidos p
58:   where p.id = v_pedido_id
62:     raise exception 'PEDIDO_NO_ENCONTRADO';
67:   from public.items_pedido i
68:   where i.id = p_item_pedido_id
71:   if not found or v_item.pedido_id is distinct from v_pedido.id then
72:     raise exception 'ITEM_PEDIDO_NO_CORRESPONDE_AL_PEDIDO';
75:   if v_pedido.estado <> 'preparando' then
76:     raise exception 'ESTADO_PEDIDO_INVALIDO';
80:     raise exception 'CANTIDAD_PREPARADA_SUPERA_SOLICITADA';
97:     raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA';
100:   update public.pedidos
102:   where id = v_pedido.id
106:     delete from public.preparacion_items_pedido
107:     where preparacion_items_pedido.item_pedido_id = v_item.id;
109:     return query select v_pedido.id, v_item.id, v_item.cantidad, false;
113:   insert into public.preparacion_items_pedido (
114:     pedido_id,
115:     item_pedido_id,
120:     v_pedido.id,
126:   on conflict (item_pedido_id) do update
131:   return query select v_pedido.id, v_item.id, p_cantidad_preparada, true;
135: alter function public.guardar_preparacion_item_pedido_administrativo(uuid, numeric, text) owner to postgres;
136: revoke all on function public.guardar_preparacion_item_pedido_administrativo(uuid, numeric, text) from public, anon, authenticated;
137: grant execute on function public.guardar_preparacion_item_pedido_administrativo(uuid, numeric, text) to authenticated;
139: create or replace function public.marcar_pedido_preparando_administrativo(
140:   p_pedido_id uuid
148:   v_pedido public.pedidos%rowtype;
150:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
152:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
153:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
154:   if v_pedido.estado = 'preparando' then return v_pedido.id; end if;
155:   if v_pedido.estado <> 'confirmado' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
157:   update public.pedidos
160:   where id = v_pedido.id;
161:   return v_pedido.id;
165: create or replace function public.marcar_pedido_listo_despacho_administrativo(
166:   p_pedido_id uuid
174:   v_pedido public.pedidos%rowtype;
176:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
178:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
179:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
180:   if v_pedido.estado = 'listo_despacho' then return v_pedido.id; end if;
181:   if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
182:   if v_pedido.preparacion_estado = 'pendiente' then raise exception 'PREPARACION_PENDIENTE_DE_FINALIZACION'; end if;
184:   update public.pedidos set estado = 'listo_despacho' where id = v_pedido.id;
185:   return v_pedido.id;
189: alter function public.marcar_pedido_preparando_administrativo(uuid) owner to postgres;
190: alter function public.marcar_pedido_listo_despacho_administrativo(uuid) owner to postgres;
191: revoke all on function public.marcar_pedido_preparando_administrativo(uuid) from public, anon, authenticated;
192: revoke all on function public.marcar_pedido_listo_despacho_administrativo(uuid) from public, anon, authenticated;
193: grant execute on function public.marcar_pedido_preparando_administrativo(uuid) to authenticated;
194: grant execute on function public.marcar_pedido_listo_despacho_administrativo(uuid) to authenticated;

## supabase/migrations/20260817111500_corregir_upsert_preparacion_item.sql

1: -- Corrige la ambigüedad entre la columna item_pedido_id y la columna de salida
4: create or replace function public.guardar_preparacion_item_pedido_administrativo(
5:   p_item_pedido_id uuid,
10:   pedido_id uuid,
11:   item_pedido_id uuid,
20:   v_pedido_id uuid;
21:   v_pedido public.pedidos%rowtype;
22:   v_item public.items_pedido%rowtype;
26:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
27:   if p_item_pedido_id is null then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
28:   if p_cantidad_preparada is null then raise exception 'CANTIDAD_PREPARADA_REQUERIDA'; end if;
29:   if p_cantidad_preparada < 0 then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
30:   if v_motivo is not null and char_length(v_motivo) > 400 then raise exception 'MOTIVO_DEMASIADO_LARGO'; end if;
32:   select i.pedido_id into v_pedido_id from public.items_pedido i where i.id = p_item_pedido_id;
33:   if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
35:   select * into v_pedido from public.pedidos p where p.id = v_pedido_id for update;
36:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
38:   select * into v_item from public.items_pedido i where i.id = p_item_pedido_id for update;
39:   if not found or v_item.pedido_id is distinct from v_pedido.id then raise exception 'ITEM_PEDIDO_NO_CORRESPONDE_AL_PEDIDO'; end if;
40:   if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
41:   if p_cantidad_preparada > v_item.cantidad then raise exception 'CANTIDAD_PREPARADA_SUPERA_SOLICITADA'; end if;
51:   if v_modo in ('presentacion_cerrada', 'unidad') and p_cantidad_preparada <> trunc(p_cantidad_preparada) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
53:   update public.pedidos set preparacion_estado = 'pendiente' where id = v_pedido.id and preparacion_estado is null;
56:     delete from public.preparacion_items_pedido where preparacion_items_pedido.item_pedido_id = v_item.id;
57:     return query select v_pedido.id, v_item.id, v_item.cantidad, false;
61:   insert into public.preparacion_items_pedido (pedido_id, item_pedido_id, cantidad_preparada, motivo_faltante, registrado_por)
62:   values (v_pedido.id, v_item.id, p_cantidad_preparada, v_motivo, auth.uid())
63:   on conflict on constraint preparacion_items_pedido_item_pedido_id_key do update
68:   return query select v_pedido.id, v_item.id, p_cantidad_preparada, true;
72: alter function public.guardar_preparacion_item_pedido_administrativo(uuid, numeric, text) owner to postgres;
73: revoke all on function public.guardar_preparacion_item_pedido_administrativo(uuid, numeric, text) from public, anon, authenticated;
74: grant execute on function public.guardar_preparacion_item_pedido_administrativo(uuid, numeric, text) to authenticated;

## supabase/migrations/20260817112000_endurecer_grants_preparacion_items.sql

2: revoke all on table public.preparacion_items_pedido from public, anon, authenticated;
3: grant select on table public.preparacion_items_pedido to authenticated;

## supabase/migrations/20260817113000_finalizar_preparacion_pedidos.sql

2: -- de aplicaciones que exceden el monto final. Los pedidos e ítems originales
5: alter table public.aplicaciones_pago
6:   drop constraint aplicaciones_pago_unica_por_pago_y_pedido;
8: create unique index aplicaciones_pago_una_activa_por_pago_y_pedido_idx
9:   on public.aplicaciones_pago (pago_id, pedido_id)
12: create or replace function public.validar_aplicacion_pago()
19:   pago_actual public.pagos%rowtype;
20:   pedido_actual public.pedidos%rowtype;
21:   aplicado_pago bigint;
22:   aplicado_pedido bigint;
25:   select * into pago_actual from public.pagos where id = new.pago_id for update;
26:   if not found then raise exception 'Pago inexistente'; end if;
27:   if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;
29:   select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
30:   if not found then raise exception 'Pedido inexistente'; end if;
31:   if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then raise exception 'El pago y el pedido deben pertenecer al mismo cliente'; end if;
32:   if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;
34:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
35:   from public.aplicaciones_pago a
36:   join public.pagos p on p.id = a.pago_id
37:   where a.pago_id = new.pago_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
38:   if aplicado_pago + new.monto_aplicado > pago_actual.monto then raise exception 'La aplicación supera el monto disponible del pago'; end if;
40:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
41:   from public.aplicaciones_pago a
42:   join public.pagos p on p.id = a.pago_id
43:   where a.pedido_id = new.pedido_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
44:   total_exigible := coalesce(pedido_actual.total_final, pedido_actual.total);
45:   if aplicado_pedido + new.monto_aplicado > total_exigible then raise exception 'La aplicación supera el saldo pendiente del pedido'; end if;
50: create or replace view public.v_saldos_pedidos
54:   p.id as pedido_id,
56:   coalesce(p.total_final, p.total) as total_pedido,
60:     when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) = 0 then 'sin_pago'
63:   end as estado_pago
64: from public.pedidos p
65: left join public.aplicaciones_pago a on a.pedido_id = p.id
66: left join public.pagos pa on pa.id = a.pago_id
70: create or replace view public.v_movimientos_cuenta_cliente
74:   select p.cliente_id, p.fecha_creacion as fecha, 'pedido'::text as tipo_movimiento, p.id as referencia_id,
75:     p.numero_pedido as referencia, ('Pedido ' || p.numero_pedido) as concepto,
78:   from public.pedidos p where p.cliente_id is not null and p.estado <> 'cancelado'
80:   select p.cliente_id, p.fecha_pago, 'pago'::text, p.id,
81:     coalesce(nullif(btrim(p.referencia), ''), 'Pago ' || left(p.id::text, 8)), ('Pago ' || p.metodo_pago::text),
83:   from public.pagos p where p.estado = 'confirmado'
85:   select a.cliente_id, a.fecha_ajuste, 'ajuste'::text, a.id, 'Ajuste ' || left(a.id::text, 8), a.motivo,
89:   from public.ajustes_cuenta_cliente a
95: create function public.finalizar_preparacion_pedido_administrativo(p_pedido_id uuid)
97:   pedido_id uuid,
98:   estado public.estado_pedido,
108:   v_pedido public.pedidos%rowtype;
109:   v_item public.items_pedido%rowtype;
117:   v_aplicacion public.aplicaciones_pago%rowtype;
122:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
123:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
124:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
126:   if v_pedido.estado = 'listo_despacho'
127:     and v_pedido.preparacion_estado in ('completa', 'incompleta')
128:     and v_pedido.preparacion_finalizada_en is not null
129:     and v_pedido.subtotal_final is not null
130:     and v_pedido.total_final is not null then
131:     return query select v_pedido.id, v_pedido.estado, v_pedido.preparacion_estado, v_pedido.subtotal_final, v_pedido.total_final;
134:   if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
136:   perform 1 from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id for update;
137:   perform 1 from public.preparacion_items_pedido pi where pi.pedido_id = v_pedido.id order by pi.item_pedido_id for update;
139:   for v_item in select * from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id loop
140:     select pi.cantidad_preparada into v_preparada from public.preparacion_items_pedido pi where pi.item_pedido_id = v_item.id;
142:     if v_preparada < 0 or v_preparada > v_item.cantidad then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
147:     if v_modo in ('presentacion_cerrada', 'unidad') and v_preparada <> trunc(v_preparada) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
152:   v_total := v_subtotal + v_pedido.costo_entrega - v_pedido.descuento;
153:   if v_total < 0 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
154:   if v_completa and (v_subtotal <> v_pedido.subtotal or v_total <> v_pedido.total) then raise exception 'PREPARACION_COMPLETA_INCONSISTENTE'; end if;
156:   -- El nuevo límite debe estar visible para el trigger al recrear aplicaciones activas.
157:   update public.pedidos set subtotal_final = v_subtotal, total_final = v_total where id = v_pedido.id;
159:   perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc for update;
160:   perform 1 from public.pagos p where p.id in (select a.pago_id from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa) order by p.id for update;
161:   select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
164:   for v_aplicacion in select * from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc loop
166:     v_conservar := greatest(v_aplicacion.monto_aplicado - v_exceso, 0);
167:     update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = 'Reajuste por preparación incompleta' where id = v_aplicacion.id;
169:       insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_aplicacion.pago_id, v_pedido.id, v_conservar);
171:     v_exceso := greatest(v_exceso - v_aplicacion.monto_aplicado, 0);
174:   select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
175:   if v_aplicado > v_total then raise exception 'APLICACIONES_SUPERAN_TOTAL_FINAL'; end if;
177:   update public.pedidos
180:   where id = v_pedido.id;
182:   update public.historial_estados_pedido set observacion = v_observacion
183:   where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'listo_despacho' order by h.fecha_creacion desc, h.id desc limit 1);
184:   return query select v_pedido.id, 'listo_despacho'::public.estado_pedido, case when v_completa then 'completa' else 'incompleta' end, v_subtotal, v_total;
188: alter function public.finalizar_preparacion_pedido_administrativo(uuid) owner to postgres;
189: revoke all on function public.finalizar_preparacion_pedido_administrativo(uuid) from public, anon, authenticated;
190: grant execute on function public.finalizar_preparacion_pedido_administrativo(uuid) to authenticated;
192: revoke all on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos, public.v_movimientos_cuenta_cliente, public.v_saldos_cuenta_clientes from public, anon;
193: grant select on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos, public.v_movimientos_cuenta_cliente, public.v_saldos_cuenta_clientes to authenticated;

## supabase/migrations/20260818090000_asegurar_cuenta_cliente_actual.sql

4: create function public.ensure_cuenta_cliente_actual()
30:     raise exception 'NO_AUTORIZADO';
39:     raise exception 'PERFIL_INVALIDO';
66:       raise exception 'PERFIL_INVALIDO';
76:     raise exception 'PERFIL_INVALIDO';
86:       raise exception 'CLIENTE_INACTIVO';
117:       raise exception 'PERFIL_INVALIDO';
122:     raise exception 'CLIENTE_INACTIVO';
129: alter function public.ensure_cuenta_cliente_actual() owner to postgres;

## supabase/migrations/20260819100000_corregir_conflicto_ensure_cuenta_cliente.sql

4: create or replace function public.ensure_cuenta_cliente_actual()
30:     raise exception 'NO_AUTORIZADO';
39:     raise exception 'PERFIL_INVALIDO';
66:       raise exception 'PERFIL_INVALIDO';
76:     raise exception 'PERFIL_INVALIDO';
86:       raise exception 'CLIENTE_INACTIVO';
117:       raise exception 'PERFIL_INVALIDO';
122:     raise exception 'CLIENTE_INACTIVO';
129: alter function public.ensure_cuenta_cliente_actual() owner to postgres;

## supabase/migrations/20260819110000_crear_invitaciones_acceso_cliente.sql

5: create table public.invitaciones_acceso_cliente (
7:   cliente_id uuid not null references public.clientes(id) on delete restrict,
11:   creada_por uuid references auth.users(id) on delete set null,
16:   aceptada_por uuid references auth.users(id) on delete set null,
17:   cliente_previo_id uuid references public.clientes(id) on delete set null,
28: create trigger actualizar_invitaciones_acceso_cliente_fecha_actualizacion
30: for each row execute function public.actualizar_fecha_actualizacion();
32: alter table public.invitaciones_acceso_cliente enable row level security;
34: create function public.crear_invitacion_acceso_cliente_administrativa(
56:     raise exception 'NO_AUTORIZADO';
60:     raise exception 'CORREO_INVALIDO';
69:     raise exception 'CLIENTE_NO_ENCONTRADO';
72:     raise exception 'CLIENTE_INACTIVO';
75:     raise exception 'CLIENTE_YA_VINCULADO';
96: create function public.revocar_invitacion_acceso_cliente_administrativa(p_invitacion_id uuid)
106:     raise exception 'NO_AUTORIZADO';
115:     raise exception 'INVITACION_NO_ENCONTRADA';
118:     raise exception 'INVITACION_NO_DISPONIBLE';
127: create function public.obtener_invitacion_acceso_cliente_administrativa(p_cliente_id uuid)
142:     raise exception 'NO_AUTORIZADO';
159: create function public.aceptar_invitacion_acceso_cliente(p_token text)
180:     raise exception 'NO_AUTORIZADO';
183:     raise exception 'INVITACION_INVALIDA';
191:     raise exception 'CORREO_NO_VERIFICADO';
199:     raise exception 'NO_AUTORIZADO';
208:     raise exception 'INVITACION_INVALIDA';
216:     raise exception 'CLIENTE_NO_ENCONTRADO';
224:     raise exception 'INVITACION_NO_DISPONIBLE';
227:     raise exception 'INVITACION_REVOCADA';
230:     raise exception 'INVITACION_EXPIRADA';
233:     raise exception 'INVITACION_NO_DISPONIBLE';
236:     raise exception 'CORREO_NO_COINCIDE';
239:     raise exception 'CLIENTE_INACTIVO';
242:     raise exception 'CLIENTE_YA_VINCULADO';
252:       or exists (select 1 from public.pedidos p where p.cliente_id = v_cliente_actual.id)
253:       or exists (select 1 from public.pagos p where p.cliente_id = v_cliente_actual.id)
254:       or exists (select 1 from public.ajustes_cuenta_cliente a where a.cliente_id = v_cliente_actual.id) then
255:       raise exception 'CUENTA_CLIENTE_EXISTENTE_CON_HISTORIAL';
285: alter function public.crear_invitacion_acceso_cliente_administrativa(uuid, text) owner to postgres;
286: alter function public.revocar_invitacion_acceso_cliente_administrativa(uuid) owner to postgres;
287: alter function public.obtener_invitacion_acceso_cliente_administrativa(uuid) owner to postgres;
288: alter function public.aceptar_invitacion_acceso_cliente(text) owner to postgres;

## supabase/migrations/20260819113000_corregir_pgcrypto_invitaciones_acceso_cliente.sql

3: create or replace function public.crear_invitacion_acceso_cliente_administrativa(
20:   if not public.es_admin() then raise exception 'NO_AUTORIZADO'; end if;
21:   if p_cliente_id is null or v_correo_destino !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'CORREO_INVALIDO'; end if;
23:   if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
24:   if not v_cliente.activo then raise exception 'CLIENTE_INACTIVO'; end if;
25:   if v_cliente.usuario_id is not null then raise exception 'CLIENTE_YA_VINCULADO'; end if;
36: create or replace function public.aceptar_invitacion_acceso_cliente(p_token text)
52:   if v_usuario_id is null then raise exception 'NO_AUTORIZADO'; end if;
53:   if p_token is null or btrim(p_token) !~ '^[a-f0-9]{64}$' then raise exception 'INVITACION_INVALIDA'; end if;
55:   if not found or v_usuario.email is null or v_usuario.email_confirmed_at is null then raise exception 'CORREO_NO_VERIFICADO'; end if;
57:   if not found or v_perfil.rol <> 'cliente' then raise exception 'NO_AUTORIZADO'; end if;
60:   if not found then raise exception 'INVITACION_INVALIDA'; end if;
62:   if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
65:     raise exception 'INVITACION_NO_DISPONIBLE';
67:   if v_invitacion.estado = 'revocada' then raise exception 'INVITACION_REVOCADA'; end if;
68:   if v_invitacion.estado = 'expirada' or v_invitacion.fecha_expiracion <= now() then raise exception 'INVITACION_EXPIRADA'; end if;
69:   if v_invitacion.estado <> 'pendiente' then raise exception 'INVITACION_NO_DISPONIBLE'; end if;
70:   if lower(v_usuario.email) <> v_invitacion.correo_destino then raise exception 'CORREO_NO_COINCIDE'; end if;
71:   if not v_cliente_b2b.activo then raise exception 'CLIENTE_INACTIVO'; end if;
72:   if v_cliente_b2b.usuario_id is not null then raise exception 'CLIENTE_YA_VINCULADO'; end if;
75:     if exists (select 1 from public.direcciones_cliente d where d.cliente_id = v_cliente_actual.id) or exists (select 1 from public.pedidos p where p.cliente_id = v_cliente_actual.id) or exists (select 1 from public.pagos p where p.cliente_id = v_cliente_actual.id) or exists (select 1 from public.ajustes_cuenta_cliente a where a.cliente_id = v_cliente_actual.id) then raise exception 'CUENTA_CLIENTE_EXISTENTE_CON_HISTORIAL'; end if;
86: alter function public.crear_invitacion_acceso_cliente_administrativa(uuid, text) owner to postgres;
87: alter function public.aceptar_invitacion_acceso_cliente(text) owner to postgres;

## supabase/migrations/20260819114000_corregir_ambiguedad_aceptar_invitacion.sql

3: create or replace function public.aceptar_invitacion_acceso_cliente(p_token text)
14:   if v_usuario_id is null then raise exception 'NO_AUTORIZADO'; end if;
15:   if p_token is null or btrim(p_token) !~ '^[a-f0-9]{64}$' then raise exception 'INVITACION_INVALIDA'; end if;
17:   if not found or v_usuario.email is null or v_usuario.email_confirmed_at is null then raise exception 'CORREO_NO_VERIFICADO'; end if;
19:   if not found or v_perfil.rol <> 'cliente' then raise exception 'NO_AUTORIZADO'; end if;
22:   if not found then raise exception 'INVITACION_INVALIDA'; end if;
24:   if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
27:     raise exception 'INVITACION_NO_DISPONIBLE';
29:   if v_invitacion.estado = 'revocada' then raise exception 'INVITACION_REVOCADA'; end if;
30:   if v_invitacion.estado = 'expirada' or v_invitacion.fecha_expiracion <= now() then raise exception 'INVITACION_EXPIRADA'; end if;
31:   if v_invitacion.estado <> 'pendiente' then raise exception 'INVITACION_NO_DISPONIBLE'; end if;
32:   if lower(v_usuario.email) <> v_invitacion.correo_destino then raise exception 'CORREO_NO_COINCIDE'; end if;
33:   if not v_cliente_b2b.activo then raise exception 'CLIENTE_INACTIVO'; end if;
34:   if v_cliente_b2b.usuario_id is not null then raise exception 'CLIENTE_YA_VINCULADO'; end if;
37:     if exists (select 1 from public.direcciones_cliente d where d.cliente_id = v_cliente_actual.id) or exists (select 1 from public.pedidos p where p.cliente_id = v_cliente_actual.id) or exists (select 1 from public.pagos p where p.cliente_id = v_cliente_actual.id) or exists (select 1 from public.ajustes_cuenta_cliente a where a.cliente_id = v_cliente_actual.id) then raise exception 'CUENTA_CLIENTE_EXISTENTE_CON_HISTORIAL'; end if;
47: alter function public.aceptar_invitacion_acceso_cliente(text) owner to postgres;

## supabase/migrations/20260826120000_aplicar_regla_despacho_pedidos.sql

2: -- Esta función es la autoridad monetaria para los pedidos nuevos.
3: create or replace function public.crear_pedido_desde_carrito(
12:   pedido_id uuid,
13:   numero_pedido text,
14:   estado public.estado_pedido,
28:   v_pedido public.pedidos%rowtype;
29:   v_pedido_existente public.pedidos%rowtype;
43:   if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
44:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
48:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
49:   if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
51:   select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
53:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
54:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
58:   if p_fecha_entrega is null then raise exception 'FECHA_ENTREGA_REQUERIDA'; end if;
60:   if p_fecha_entrega < v_hoy_local or p_fecha_entrega > v_hoy_local + 14 then raise exception 'FECHA_ENTREGA_INVALIDA'; end if;
61:   if not public.fecha_entrega_disponible(p_fecha_entrega) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
63:   if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
64:   if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;
68:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
69:   if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
73:   if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;
76:   insert into public.pedidos (
86:   ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;
88:   if v_pedido.id is null then
89:     select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
90:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
91:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
96:     if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
98:     if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
99:     if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
102:     if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
109:     if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
110:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
120:     insert into public.items_pedido (
121:       pedido_id,
134:       v_pedido.id,
151:   from public.items_pedido i
152:   where i.pedido_id = v_pedido.id;
156:   update public.pedidos
161:   where id = v_pedido.id
162:   returning * into v_pedido;
166:     v_pedido.id,
167:     v_pedido.numero_pedido,
168:     v_pedido.estado,
169:     v_pedido.subtotal,
170:     v_pedido.costo_entrega,
171:     v_pedido.descuento,
172:     v_pedido.total;
176: alter function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date) owner to postgres;
177: revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date) from public, anon, authenticated;
178: grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date) to authenticated;

## supabase/migrations/20260826130000_asignar_imagenes_productos_pendientes.sql

1: -- Rutas públicas verificadas para los productos que incorporan fotografía.
6: with imagenes (slug, ruta_imagen) as (
21: set ruta_imagen = imagenes.ruta_imagen
24:   and producto.ruta_imagen is distinct from imagenes.ruta_imagen;

## supabase/migrations/20260827090000_crear_secciones_inicio_productos.sql

2: -- Los títulos y descripciones siguen definidos por la aplicación.
6: create table public.secciones_inicio_productos (
9:   producto_id uuid not null references public.productos(id) on delete restrict,
16: alter table public.secciones_inicio_productos enable row level security;
79:     raise exception 'SEED_SECCION_INICIO_PRODUCTO_DUPLICADO';
88:     raise exception 'SEED_SECCION_INICIO_ORDEN_DUPLICADO';
98:     raise exception 'SEED_SECCION_INICIO_PRODUCTOS_INEXISTENTES: %', v_faltantes;

## supabase/migrations/20260827091000_endurecer_grants_secciones_inicio_productos.sql


## supabase/migrations/20260827100000_administrar_secciones_inicio.sql

5: create or replace function public.agregar_producto_seccion_inicio_administrativa(
18:   if not public.es_admin() then raise exception 'NO_AUTORIZADO'; end if;
20:     raise exception 'SECCION_INICIO_INVALIDA';
22:   if p_producto_id is null then raise exception 'PRODUCTO_INVALIDO'; end if;
30:     raise exception 'PRODUCTO_NO_DISPONIBLE';
37:     raise exception 'PRODUCTO_YA_ASIGNADO';
53: create or replace function public.quitar_producto_seccion_inicio_administrativa(
65:   if not public.es_admin() then raise exception 'NO_AUTORIZADO'; end if;
66:   if p_asignacion_id is null then raise exception 'ASIGNACION_INEXISTENTE'; end if;
76:   if not found then raise exception 'ASIGNACION_INEXISTENTE'; end if;
90: create or replace function public.mover_producto_seccion_inicio_administrativa(
105:   if not public.es_admin() then raise exception 'NO_AUTORIZADO'; end if;
106:   if p_asignacion_id is null then raise exception 'ASIGNACION_INEXISTENTE'; end if;
107:   if p_direccion not in ('arriba', 'abajo') then raise exception 'DIRECCION_INVALIDA'; end if;
117:   if not found then raise exception 'ASIGNACION_INEXISTENTE'; end if;

## supabase/migrations/20260827110000_agregar_metodos_pago_previstos_pedidos.sql

1: -- Intención declarada de pago para la entrega. No representa pagos recibidos.
4: alter table public.pedidos
5:   add column metodos_pago_previstos text[] null,
6:   add constraint pedidos_metodos_pago_previstos_validos check (
7:     metodos_pago_previstos is null or (
8:       cardinality(metodos_pago_previstos) between 1 and 3
9:       and array_position(metodos_pago_previstos, null) is null
10:       and metodos_pago_previstos <@ array['efectivo', 'transferencia', 'tarjeta']::text[]
11:       and cardinality(metodos_pago_previstos) =
12:         (case when 'efectivo' = any(metodos_pago_previstos) then 1 else 0 end
13:         + case when 'transferencia' = any(metodos_pago_previstos) then 1 else 0 end
14:         + case when 'tarjeta' = any(metodos_pago_previstos) then 1 else 0 end)
19: -- Checkout hasta que P2 envíe p_metodos_pago_previstos a esta sobrecarga.
20: create function public.crear_pedido_desde_carrito(
27:   p_metodos_pago_previstos text[]
30:   pedido_id uuid,
31:   numero_pedido text,
32:   estado public.estado_pedido,
46:   v_pedido public.pedidos%rowtype;
47:   v_pedido_existente public.pedidos%rowtype;
60:   v_metodos_pago_previstos text[];
62:   if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
63:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
64:   if p_metodos_pago_previstos is null or cardinality(p_metodos_pago_previstos) = 0 then
65:     raise exception 'METODOS_PAGO_PREVISTOS_REQUERIDOS';
67:   if array_position(p_metodos_pago_previstos, null) is not null
68:     or not (p_metodos_pago_previstos <@ array['efectivo', 'transferencia', 'tarjeta']::text[])
69:     or cardinality(p_metodos_pago_previstos) <>
70:       (case when 'efectivo' = any(p_metodos_pago_previstos) then 1 else 0 end
71:       + case when 'transferencia' = any(p_metodos_pago_previstos) then 1 else 0 end
72:       + case when 'tarjeta' = any(p_metodos_pago_previstos) then 1 else 0 end) then
73:     raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
76:   into v_metodos_pago_previstos
78:   where metodo = any(p_metodos_pago_previstos);
82:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
83:   if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
85:   select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
87:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
88:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
92:   if p_fecha_entrega is null then raise exception 'FECHA_ENTREGA_REQUERIDA'; end if;
94:   if p_fecha_entrega < v_hoy_local or p_fecha_entrega > v_hoy_local + 14 then raise exception 'FECHA_ENTREGA_INVALIDA'; end if;
95:   if not public.fecha_entrega_disponible(p_fecha_entrega) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
96:   if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
97:   if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;
100:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
101:   if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
103:   if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;
106:   insert into public.pedidos (
110:     subtotal, costo_entrega, descuento, total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos
115:     0, 0, 0, 0, v_observacion_normalizada, p_fecha_entrega, p_clave_idempotencia, v_metodos_pago_previstos
116:   ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;
118:   if v_pedido.id is null then
119:     select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
120:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
121:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
126:     if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
128:     if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
129:     if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
132:     if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
137:     if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
138:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
140:     insert into public.items_pedido (pedido_id,producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_neto_unitario_snapshot,precio_final_unitario_snapshot,total_linea,observacion_cliente,modo_cantidad_snapshot)
141:     values (v_pedido.id,v_presentacion.producto_id,v_presentacion.id,v_presentacion.nombre_producto,v_presentacion.nombre_presentacion,v_presentacion.unidad,v_cantidad,v_presentacion.precio_neto,v_presentacion.precio_final,round(v_cantidad * v_presentacion.precio_final)::bigint,null,v_modo_cantidad_snapshot);
144:   select coalesce(sum(i.total_linea), 0)::bigint into v_subtotal from public.items_pedido i where i.pedido_id = v_pedido.id;
146:   update public.pedidos set subtotal = v_subtotal, costo_entrega = v_costo_entrega, descuento = 0, total = v_subtotal + v_costo_entrega where id = v_pedido.id returning * into v_pedido;
147:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;
151: alter function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date, text[]) owner to postgres;
152: revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date, text[]) from public, anon, authenticated;
153: grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date, text[]) to authenticated;

## supabase/migrations/20260827111000_retirar_sobrecarga_legacy_crear_pedido.sql

3: drop function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid);

## supabase/migrations/20260827112000_retirar_firma_legacy_payment_intent.sql

1: -- Checkout ya envía p_metodos_pago_previstos; no debe quedar una vía para
2: -- crear pedidos nuevos sin intención de pago registrada.
3: drop function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date);

## supabase/migrations/20260829120000_crear_sistema_beneficios_fidelizacion.sql

1: -- Fidelización V1: cada pedido entregado elegible genera una compra acumulada.
2: -- Este modelo no crea pagos ni modifica deuda, descuentos o totales de pedidos.
4: create table public.cupones_cliente (
6:   cliente_id uuid not null references public.clientes(id) on delete restrict,
13:   pedido_usado_id uuid references public.pedidos(id) on delete restrict,
16:   constraint cupones_cliente_tipo_valido check (tipo = 'porcentaje'),
17:   constraint cupones_cliente_porcentaje_valido check (porcentaje = 10),
18:   constraint cupones_cliente_estado_valido check (estado in ('disponible', 'usado')),
19:   constraint cupones_cliente_origen_valido check (origen = 'beneficio_5_compras'),
20:   constraint cupones_cliente_uso_coherente check (
21:     (estado = 'disponible' and fecha_uso is null and pedido_usado_id is null)
22:     or (estado = 'usado' and fecha_uso is not null and pedido_usado_id is not null)
26: create table public.beneficios_stacks (
28:   cliente_id uuid not null references public.clientes(id) on delete restrict,
29:   pedido_id uuid not null references public.pedidos(id) on delete restrict,
32:   cupon_id uuid references public.cupones_cliente(id) on delete restrict,
34:   constraint beneficios_stacks_pedido_unico unique (pedido_id)
37: create index beneficios_stacks_cliente_fecha_otorgamiento_idx
38:   on public.beneficios_stacks (cliente_id, fecha_otorgamiento);
40: create index beneficios_stacks_cliente_cupon_idx
41:   on public.beneficios_stacks (cliente_id, cupon_id);
43: create index cupones_cliente_cliente_estado_fecha_creacion_idx
44:   on public.cupones_cliente (cliente_id, estado, fecha_creacion);
46: create trigger actualizar_cupones_cliente_fecha_actualizacion
47: before update on public.cupones_cliente
48: for each row execute function public.actualizar_fecha_actualizacion();
50: alter table public.beneficios_stacks enable row level security;
51: alter table public.cupones_cliente enable row level security;
53: revoke all on public.beneficios_stacks, public.cupones_cliente from public, anon, authenticated;
54: grant select on public.beneficios_stacks, public.cupones_cliente to authenticated;
56: create policy beneficios_stacks_lectura_propia
57:   on public.beneficios_stacks
65:       where c.id = beneficios_stacks.cliente_id
70: create policy beneficios_stacks_administracion
71:   on public.beneficios_stacks
77: create policy cupones_cliente_lectura_propia
78:   on public.cupones_cliente
86:       where c.id = cupones_cliente.cliente_id
91: create policy cupones_cliente_administracion
92:   on public.cupones_cliente
98: create function public.procesar_beneficio_pedido_entregado(
99:   p_pedido_id uuid
111:   v_cupon_id uuid;
115:   from public.pedidos p
116:   where p.id = p_pedido_id;
122:   -- Serializa sólo la emisión de beneficios de un mismo cliente durante esta transacción.
125:   insert into public.beneficios_stacks (
127:     pedido_id,
131:     p_pedido_id,
134:   on conflict (pedido_id) do nothing
146:       from public.beneficios_stacks s
148:         and s.cupon_id is null
156:     insert into public.cupones_cliente (
167:       'beneficio_5_compras'
169:     returning id into v_cupon_id;
171:     update public.beneficios_stacks
172:     set cupon_id = v_cupon_id
174:       and cupon_id is null;
179: create function public.otorgar_beneficio_al_entregar_pedido()
187:     and new.estado = 'entregado'::public.estado_pedido
188:     and old.estado is distinct from 'entregado'::public.estado_pedido then
189:     perform public.procesar_beneficio_pedido_entregado(new.id);
196: create trigger otorgar_beneficio_pedido_entregado_despues_de_actualizar
197: after update of estado on public.pedidos
198: for each row execute function public.otorgar_beneficio_al_entregar_pedido();
200: alter function public.procesar_beneficio_pedido_entregado(uuid) owner to postgres;
201: alter function public.otorgar_beneficio_al_entregar_pedido() owner to postgres;
203: revoke all on function public.procesar_beneficio_pedido_entregado(uuid) from public, anon, authenticated;
204: revoke all on function public.otorgar_beneficio_al_entregar_pedido() from public, anon, authenticated;

## supabase/migrations/20260829130000_crear_chat_cliente_admin.sql

5: create table public.conversaciones_cliente (
7:   cliente_id uuid not null references public.clientes(id) on delete restrict,
22: create table public.mensajes_conversacion (
24:   conversacion_id uuid not null references public.conversaciones_cliente(id) on delete restrict,
25:   remitente_usuario_id uuid not null references auth.users(id) on delete restrict,
29:   pedido_id uuid references public.pedidos(id) on delete restrict,
51: create trigger actualizar_conversaciones_cliente_fecha_actualizacion
53: for each row execute function public.actualizar_fecha_actualizacion();
55: alter table public.conversaciones_cliente enable row level security;
56: alter table public.mensajes_conversacion enable row level security;
104: create function public.enviar_mensaje_conversacion(
107:   p_pedido_id uuid,
117:   pedido_id uuid,
141:     raise exception 'CHAT_NO_AUTENTICADO';
151:     raise exception 'CHAT_ACTOR_INVALIDO';
157:     raise exception 'CHAT_MENSAJE_VACIO';
161:     raise exception 'CHAT_MENSAJE_DEMASIADO_LARGO';
165:     raise exception 'CHAT_CLAVE_IDEMPOTENCIA_REQUERIDA';
176:       raise exception 'CHAT_CLIENTE_NO_DISPONIBLE';
180:       raise exception 'CHAT_CLIENTE_DESTINO_INVALIDO';
187:       raise exception 'CHAT_CLIENTE_REQUERIDO';
196:       raise exception 'CHAT_CLIENTE_INEXISTENTE';
200:       raise exception 'CHAT_CLIENTE_INACTIVO';
208:     raise exception 'CHAT_REMITENTE_SIN_NOMBRE';
221:       m.remitente_nombre_snapshot, m.contenido, m.pedido_id, m.fecha_creacion
239:       m.remitente_nombre_snapshot, m.contenido, m.pedido_id, m.fecha_creacion
252:     raise exception 'CHAT_LIMITE_DE_MENSAJES';
255:   if p_pedido_id is not null and not exists (
257:     from public.pedidos p
258:     where p.id = p_pedido_id
261:     raise exception 'CHAT_PEDIDO_INVALIDO';
280:     pedido_id,
289:     p_pedido_id,
303:     m.remitente_nombre_snapshot, m.contenido, m.pedido_id, m.fecha_creacion
309: create function public.marcar_conversacion_leida(
329:     raise exception 'CHAT_NO_AUTENTICADO';
338:     raise exception 'CHAT_ACTOR_INVALIDO';
349:       raise exception 'CHAT_CLIENTE_NO_DISPONIBLE';
353:       raise exception 'CHAT_CLIENTE_DESTINO_INVALIDO';
357:       raise exception 'CHAT_CLIENTE_REQUERIDO';
366:       raise exception 'CHAT_CLIENTE_INEXISTENTE';
377:     raise exception 'CHAT_CONVERSACION_INEXISTENTE';
401: alter function public.enviar_mensaje_conversacion(uuid, text, uuid, uuid) owner to postgres;
402: alter function public.marcar_conversacion_leida(uuid) owner to postgres;

## supabase/migrations/20260829131000_corregir_rpc_enviar_mensaje_chat.sql

4: create or replace function public.enviar_mensaje_conversacion(
7:   p_pedido_id uuid,
17:   pedido_id uuid,
41:     raise exception 'CHAT_NO_AUTENTICADO';
51:     raise exception 'CHAT_ACTOR_INVALIDO';
57:     raise exception 'CHAT_MENSAJE_VACIO';
61:     raise exception 'CHAT_MENSAJE_DEMASIADO_LARGO';
65:     raise exception 'CHAT_CLAVE_IDEMPOTENCIA_REQUERIDA';
76:       raise exception 'CHAT_CLIENTE_NO_DISPONIBLE';
80:       raise exception 'CHAT_CLIENTE_DESTINO_INVALIDO';
87:       raise exception 'CHAT_CLIENTE_REQUERIDO';
96:       raise exception 'CHAT_CLIENTE_INEXISTENTE';
100:       raise exception 'CHAT_CLIENTE_INACTIVO';
108:     raise exception 'CHAT_REMITENTE_SIN_NOMBRE';
120:       m.remitente_nombre_snapshot, m.contenido, m.pedido_id, m.fecha_creacion
137:       m.remitente_nombre_snapshot, m.contenido, m.pedido_id, m.fecha_creacion
150:     raise exception 'CHAT_LIMITE_DE_MENSAJES';
153:   if p_pedido_id is not null and not exists (
155:     from public.pedidos p
156:     where p.id = p_pedido_id
159:     raise exception 'CHAT_PEDIDO_INVALIDO';
178:     pedido_id,
187:     p_pedido_id,
203:     m.remitente_nombre_snapshot, m.contenido, m.pedido_id, m.fecha_creacion
209: alter function public.enviar_mensaje_conversacion(uuid, text, uuid, uuid) owner to postgres;

## supabase/migrations/20260831100000_agregar_lecturas_admin_chat.sql

3: create function public.listar_conversaciones_chat_administrativas(
30:     raise exception 'CHAT_ADMIN_NO_AUTORIZADO';
68: create function public.obtener_resumen_chat_administrativo()
78:     raise exception 'CHAT_ADMIN_NO_AUTORIZADO';
90: alter function public.listar_conversaciones_chat_administrativas(boolean, timestamptz, uuid, integer) owner to postgres;
91: alter function public.obtener_resumen_chat_administrativo() owner to postgres;

## supabase/migrations/20260831110000_crear_novedades.sql

1: create table public.novedades (
7:   imagen_ruta text null,
9:   autor_usuario_id uuid not null references auth.users(id) on delete restrict,
10:   actualizado_por_usuario_id uuid not null references auth.users(id) on delete restrict,
25:     not (imagen_ruta is not null and youtube_video_id is not null)
42: create function public.proteger_autoria_novedades()
49:     raise exception 'NO_AUTORIZADO';
55:       raise exception 'AUTORIA_NOVEDAD_INVALIDA';
59:       raise exception 'AUTOR_NOVEDAD_INMUTABLE';
63:       raise exception 'ACTUALIZADOR_NOVEDAD_INVALIDO';
71: create trigger proteger_autoria_novedades
73: for each row execute function public.proteger_autoria_novedades();
75: create trigger actualizar_novedades_fecha_actualizacion
77: for each row execute function public.actualizar_fecha_actualizacion();
79: alter table public.novedades enable row level security;

## supabase/migrations/20260831111000_crear_storage_novedades.sql


## supabase/migrations/20260907040910_crear_modelo_rutas_logisticas.sql

1: -- Rutas P1: infraestructura logística persistente. No crea rutas, paradas ni
4: create type public.estado_ruta_logistica as enum (
12: create type public.estado_parada_ruta as enum (
21: create table public.configuracion_logistica (
41: create table public.rutas (
45:   estado_logistico public.estado_ruta_logistica not null default 'borrador',
51:   creada_por uuid null references auth.users(id) on delete set null,
55:   constraint rutas_version_valida check (version >= 1),
56:   constraint rutas_origen_latitud_valida check (origen_latitud_snapshot is null or origen_latitud_snapshot between -90 and 90),
57:   constraint rutas_origen_longitud_valida check (origen_longitud_snapshot is null or origen_longitud_snapshot between -180 and 180),
58:   constraint rutas_origen_coordenadas_completas check ((origen_latitud_snapshot is null) = (origen_longitud_snapshot is null))
61: create unique index rutas_una_principal_por_fecha_idx
62:   on public.rutas (fecha_operativa)
65: create index rutas_fecha_estado_idx
66:   on public.rutas (fecha_operativa, estado_logistico);
68: create table public.paradas_ruta (
70:   ruta_id uuid not null references public.rutas(id) on delete restrict,
71:   pedido_id uuid not null references public.pedidos(id) on delete restrict,
73:   estado_logistico public.estado_parada_ruta not null default 'sin_ordenar',
74:   numero_pedido_snapshot text not null,
75:   cliente_id uuid null references public.clientes(id) on delete set null,
87:   metodos_pago_previstos_snapshot text[] null,
93:   constraint paradas_ruta_unica_por_pedido unique (ruta_id, pedido_id),
94:   constraint paradas_ruta_posicion_positiva check (posicion is null or posicion > 0),
95:   constraint paradas_ruta_latitud_valida check (latitud_snapshot is null or latitud_snapshot between -90 and 90),
96:   constraint paradas_ruta_longitud_valida check (longitud_snapshot is null or longitud_snapshot between -180 and 180),
97:   constraint paradas_ruta_coordenadas_completas check ((latitud_snapshot is null) = (longitud_snapshot is null)),
98:   constraint paradas_ruta_total_valido check (total_snapshot >= 0),
99:   constraint paradas_ruta_horas_coherentes check (hora_entrega is null or hora_inicio is null or hora_entrega >= hora_inicio)
102: create unique index paradas_ruta_posicion_unica_idx
103:   on public.paradas_ruta (ruta_id, posicion)
106: create index paradas_ruta_ruta_estado_posicion_idx
107:   on public.paradas_ruta (ruta_id, estado_logistico, posicion);
109: create index paradas_ruta_pedido_id_idx
110:   on public.paradas_ruta (pedido_id);
112: create trigger actualizar_configuracion_logistica_fecha_actualizacion
114: for each row execute function public.actualizar_fecha_actualizacion();
116: create trigger actualizar_rutas_fecha_actualizacion
117: before update on public.rutas
118: for each row execute function public.actualizar_fecha_actualizacion();
120: create trigger actualizar_paradas_ruta_fecha_actualizacion
121: before update on public.paradas_ruta
122: for each row execute function public.actualizar_fecha_actualizacion();
124: alter table public.configuracion_logistica enable row level security;
125: alter table public.rutas enable row level security;
126: alter table public.paradas_ruta enable row level security;
129: revoke all on public.rutas from public, anon, authenticated;
130: revoke all on public.paradas_ruta from public, anon, authenticated;
138: create policy rutas_administracion
139: on public.rutas
144: create policy paradas_ruta_administracion
145: on public.paradas_ruta

## supabase/migrations/20260907040959_crear_rpcs_planificacion_rutas.sql

1: -- Rutas P1: RPCs administrativas de creación, sincronización y reordenamiento.
3: create function public.obtener_o_crear_ruta_administrativa(
6: returns public.rutas
12:   v_ruta public.rutas%rowtype;
16:     raise exception 'NO_AUTORIZADO';
19:     raise exception 'FECHA_OPERATIVA_REQUERIDA';
22:   perform pg_advisory_xact_lock(hashtextextended('ruta-principal:' || p_fecha_operativa::text, 0));
24:   select * into v_ruta
25:   from public.rutas r
30:     return v_ruta;
38:   insert into public.rutas (
48:   ) returning * into v_ruta;
50:   return v_ruta;
53:     select * into v_ruta
54:     from public.rutas r
58:     if found then return v_ruta; end if;
63: create function public.sincronizar_paradas_ruta_administrativa(
64:   p_ruta_id uuid
67:   ruta_id uuid,
77:   v_ruta public.rutas%rowtype;
82:     raise exception 'NO_AUTORIZADO';
84:   if p_ruta_id is null then
85:     raise exception 'RUTA_REQUERIDA';
88:   select * into v_ruta
89:   from public.rutas r
90:   where r.id = p_ruta_id
92:   if not found then raise exception 'RUTA_NO_ENCONTRADA'; end if;
93:   if v_ruta.estado_logistico in ('completada', 'archivada') then
94:     raise exception 'RUTA_NO_SINCRONIZABLE';
97:   update public.paradas_ruta pr
99:         when p.estado = 'cancelado' then 'cancelada'::public.estado_parada_ruta
100:         else 'omitida'::public.estado_parada_ruta
103:   from public.pedidos p
104:   where pr.ruta_id = v_ruta.id
105:     and p.id = pr.pedido_id
107:     and (p.estado = 'cancelado' or p.fecha_entrega is distinct from v_ruta.fecha_operativa);
110:   insert into public.paradas_ruta (
111:     ruta_id, pedido_id, posicion, estado_logistico,
112:     numero_pedido_snapshot, cliente_id, cliente_nombre_snapshot,
116:     total_snapshot, metodos_pago_previstos_snapshot
119:     v_ruta.id, p.id, null, 'sin_ordenar',
120:     p.numero_pedido, p.cliente_id, p.nombre_cliente_snapshot,
127:     coalesce(p.total_final, p.total), p.metodos_pago_previstos
128:   from public.pedidos p
132:   where p.fecha_entrega = v_ruta.fecha_operativa
135:       select 1 from public.paradas_ruta pr
136:       where pr.ruta_id = v_ruta.id and pr.pedido_id = p.id
138:   on conflict (ruta_id, pedido_id) do nothing;
142:     update public.rutas
144:     where id = v_ruta.id
145:     returning * into v_ruta;
148:   return query select v_ruta.id, v_insertadas, v_actualizadas, v_ruta.version;
152: create function public.guardar_orden_ruta_administrativo(
153:   p_ruta_id uuid,
158:   ruta_id uuid,
166:   v_ruta public.rutas%rowtype;
174:     raise exception 'NO_AUTORIZADO';
176:   if p_ruta_id is null then raise exception 'RUTA_REQUERIDA'; end if;
177:   if p_version_esperada is null then raise exception 'VERSION_REQUERIDA'; end if;
179:   select * into v_ruta
180:   from public.rutas r
181:   where r.id = p_ruta_id
183:   if not found then raise exception 'RUTA_NO_ENCONTRADA'; end if;
184:   if v_ruta.version <> p_version_esperada then raise exception 'RUTA_DESACTUALIZADA'; end if;
185:   if v_ruta.estado_logistico in ('en_reparto', 'completada', 'archivada') then
186:     raise exception 'RUTA_NO_REORDENABLE';
192:   if v_cantidad_enteros <> v_cantidad_distintos then raise exception 'ORDEN_CON_PARADAS_DUPLICADAS'; end if;
195:   from public.paradas_ruta pr
196:   where pr.ruta_id = v_ruta.id and pr.id = any(v_orden);
197:   if v_cantidad_existentes <> cardinality(v_orden) then raise exception 'PARADA_NO_CORRESPONDE_A_RUTA'; end if;
200:   from public.paradas_ruta pr
201:   where pr.ruta_id = v_ruta.id
204:   if v_cantidad_planificables <> cardinality(v_orden) then raise exception 'PARADA_NO_PLANIFICABLE'; end if;
206:   update public.paradas_ruta
209:   where ruta_id = v_ruta.id
212:   update public.paradas_ruta pr
216:   where pr.ruta_id = v_ruta.id
219:   update public.rutas
221:         when cardinality(v_orden) > 0 and estado_logistico = 'borrador' then 'planificada'::public.estado_ruta_logistica
222:         when cardinality(v_orden) = 0 and estado_logistico = 'planificada' then 'borrador'::public.estado_ruta_logistica
226:   where id = v_ruta.id
227:   returning * into v_ruta;
229:   return query select v_ruta.id, v_ruta.version;
233: alter function public.obtener_o_crear_ruta_administrativa(date) owner to postgres;
234: alter function public.sincronizar_paradas_ruta_administrativa(uuid) owner to postgres;
235: alter function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) owner to postgres;
237: revoke all on function public.obtener_o_crear_ruta_administrativa(date) from public, anon, authenticated;
238: revoke all on function public.sincronizar_paradas_ruta_administrativa(uuid) from public, anon, authenticated;
239: revoke all on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) from public, anon, authenticated;
241: grant execute on function public.obtener_o_crear_ruta_administrativa(date) to authenticated;
242: grant execute on function public.sincronizar_paradas_ruta_administrativa(uuid) to authenticated;
243: grant execute on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) to authenticated;

## supabase/migrations/20260907120822_corregir_rpc_guardar_orden_ruta.sql

1: -- Corrige la ambigüedad entre el campo de salida ruta_id y la columna
2: -- paradas_ruta.ruta_id dentro de la RPC de reordenamiento.
4: create or replace function public.guardar_orden_ruta_administrativo(
5:   p_ruta_id uuid,
10:   ruta_id uuid,
18:   v_ruta public.rutas%rowtype;
26:     raise exception 'NO_AUTORIZADO';
28:   if p_ruta_id is null then raise exception 'RUTA_REQUERIDA'; end if;
29:   if p_version_esperada is null then raise exception 'VERSION_REQUERIDA'; end if;
31:   select * into v_ruta
32:   from public.rutas r
33:   where r.id = p_ruta_id
35:   if not found then raise exception 'RUTA_NO_ENCONTRADA'; end if;
36:   if v_ruta.version <> p_version_esperada then raise exception 'RUTA_DESACTUALIZADA'; end if;
37:   if v_ruta.estado_logistico in ('en_reparto', 'completada', 'archivada') then
38:     raise exception 'RUTA_NO_REORDENABLE';
44:   if v_cantidad_enteros <> v_cantidad_distintos then raise exception 'ORDEN_CON_PARADAS_DUPLICADAS'; end if;
47:   from public.paradas_ruta pr
48:   where pr.ruta_id = v_ruta.id and pr.id = any(v_orden);
49:   if v_cantidad_existentes <> cardinality(v_orden) then raise exception 'PARADA_NO_CORRESPONDE_A_RUTA'; end if;
52:   from public.paradas_ruta pr
53:   where pr.ruta_id = v_ruta.id
56:   if v_cantidad_planificables <> cardinality(v_orden) then raise exception 'PARADA_NO_PLANIFICABLE'; end if;
58:   update public.paradas_ruta pr
61:   where pr.ruta_id = v_ruta.id
64:   update public.paradas_ruta pr
68:   where pr.ruta_id = v_ruta.id
71:   update public.rutas
73:         when cardinality(v_orden) > 0 and estado_logistico = 'borrador' then 'planificada'::public.estado_ruta_logistica
74:         when cardinality(v_orden) = 0 and estado_logistico = 'planificada' then 'borrador'::public.estado_ruta_logistica
78:   where id = v_ruta.id
79:   returning * into v_ruta;
81:   return query select v_ruta.id, v_ruta.version;
85: alter function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) owner to postgres;
86: revoke all on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) from public, anon, authenticated;
87: grant execute on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) to authenticated;

## supabase/migrations/20260907120938_corregir_version_rpc_guardar_orden_ruta.sql

1: -- Corrige la ambigüedad entre el campo de salida version y rutas.version.
3: create or replace function public.guardar_orden_ruta_administrativo(
4:   p_ruta_id uuid,
8: returns table (ruta_id uuid, version bigint)
14:   v_ruta public.rutas%rowtype;
21:   if auth.uid() is null or not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
22:   if p_ruta_id is null then raise exception 'RUTA_REQUERIDA'; end if;
23:   if p_version_esperada is null then raise exception 'VERSION_REQUERIDA'; end if;
25:   select * into v_ruta from public.rutas r where r.id = p_ruta_id for update;
26:   if not found then raise exception 'RUTA_NO_ENCONTRADA'; end if;
27:   if v_ruta.version <> p_version_esperada then raise exception 'RUTA_DESACTUALIZADA'; end if;
28:   if v_ruta.estado_logistico in ('en_reparto', 'completada', 'archivada') then raise exception 'RUTA_NO_REORDENABLE'; end if;
32:   if v_cantidad_enteros <> v_cantidad_distintos then raise exception 'ORDEN_CON_PARADAS_DUPLICADAS'; end if;
34:   select count(*) into v_cantidad_existentes from public.paradas_ruta pr
35:   where pr.ruta_id = v_ruta.id and pr.id = any(v_orden);
36:   if v_cantidad_existentes <> cardinality(v_orden) then raise exception 'PARADA_NO_CORRESPONDE_A_RUTA'; end if;
38:   select count(*) into v_cantidad_planificables from public.paradas_ruta pr
39:   where pr.ruta_id = v_ruta.id and pr.id = any(v_orden)
41:   if v_cantidad_planificables <> cardinality(v_orden) then raise exception 'PARADA_NO_PLANIFICABLE'; end if;
43:   update public.paradas_ruta pr set posicion = null, estado_logistico = 'sin_ordenar'
44:   where pr.ruta_id = v_ruta.id and pr.estado_logistico in ('sin_ordenar', 'planificada');
46:   update public.paradas_ruta pr
49:   where pr.ruta_id = v_ruta.id and pr.id = orden.parada_id;
51:   update public.rutas r
53:         when cardinality(v_orden) > 0 and r.estado_logistico = 'borrador' then 'planificada'::public.estado_ruta_logistica
54:         when cardinality(v_orden) = 0 and r.estado_logistico = 'planificada' then 'borrador'::public.estado_ruta_logistica
58:   where r.id = v_ruta.id
59:   returning r.* into v_ruta;
61:   return query select v_ruta.id, v_ruta.version;
65: alter function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) owner to postgres;
66: revoke all on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) from public, anon, authenticated;
67: grant execute on function public.guardar_orden_ruta_administrativo(uuid, uuid[], bigint) to authenticated;

## supabase/migrations/20261022010000_crear_estructura_posibles_pedidos.sql

1: -- Solo estructura. No registra solicitudes ni convierte pedidos.
3: -- cambios y su auditoría en una transacción. No hay escrituras de aplicación
5: -- No modifica calendario, pedidos oficiales, pagos ni vistas contables.
7: create table public.posibles_pedidos (
23:   cliente_id uuid null references public.clientes(id) on delete restrict,
24:   pedido_oficial_id uuid null unique references public.pedidos(id) on delete restrict,
33:   constraint posibles_pedidos_total_coherente check (
36:   constraint posibles_pedidos_conversion_coherente check (
37:     (estado = 'convertido' and pedido_oficial_id is not null and cliente_id is not null and fecha_conversion is not null)
38:     or (estado <> 'convertido' and pedido_oficial_id is null and fecha_conversion is null)
40:   constraint posibles_pedidos_cierre_coherente check (
43:   constraint posibles_pedidos_fechas_coherentes check (
51: create table public.items_posible_pedido (
53:   posible_pedido_id uuid not null references public.posibles_pedidos(id) on delete restrict,
54:   producto_id uuid not null references public.productos(id) on delete restrict,
55:   presentacion_producto_id uuid not null references public.presentaciones_producto(id) on delete restrict,
69:   precio_autorizado_por uuid null references auth.users(id) on delete restrict,
89: create table public.historial_posibles_pedidos (
91:   posible_pedido_id uuid not null references public.posibles_pedidos(id) on delete restrict,
96:   administrador_id uuid null references auth.users(id) on delete restrict,
103:   unique (posible_pedido_id, clave_operacion),
104:   unique (posible_pedido_id, version_resultante),
105:   constraint historial_posibles_actor_requerido check (evento = 'registro' or administrador_id is not null),
106:   constraint historial_posibles_motivo_requerido check (
112: create table public.vinculos_items_posible_pedido (
113:   item_posible_pedido_id uuid primary key references public.items_posible_pedido(id) on delete restrict,
114:   item_pedido_id uuid not null unique references public.items_pedido(id) on delete restrict
117: create index posibles_pedidos_estado_creacion_idx on public.posibles_pedidos (estado, fecha_creacion desc, id);
118: create index posibles_pedidos_fecha_estado_idx on public.posibles_pedidos (fecha_entrega_solicitada, estado);
119: create index posibles_pedidos_cliente_idx on public.posibles_pedidos (cliente_id) where cliente_id is not null;
120: create index posibles_pedidos_cierre_idx on public.posibles_pedidos (fecha_cierre) where fecha_cierre is not null;
121: create index items_posible_pedido_cabecera_idx on public.items_posible_pedido (posible_pedido_id);
122: create index items_posible_pedido_producto_idx on public.items_posible_pedido (producto_id);
123: create index items_posible_pedido_presentacion_idx on public.items_posible_pedido (presentacion_producto_id);
124: create index items_posible_pedido_autorizador_idx on public.items_posible_pedido (precio_autorizado_por) where precio_autorizado_por is not null;
126:   on public.items_posible_pedido (posible_pedido_id, presentacion_producto_id) where activo;
128:   on public.items_posible_pedido (posible_pedido_id, orden) where activo;
129: create index historial_posibles_pedidos_actor_idx on public.historial_posibles_pedidos (administrador_id) where administrador_id is not null;
131: create function public.proteger_cabecera_posible_pedido()
136:       raise exception 'ESTADO_INICIAL_POSIBLE_PEDIDO_INVALIDO';
140:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
141:   if old.estado in ('convertido', 'descartado') then raise exception 'POSIBLE_PEDIDO_CERRADO'; end if;
148:     raise exception 'SOLICITUD_ORIGINAL_INMUTABLE';
150:   if new.version <> old.version + 1 then raise exception 'VERSION_POSIBLE_PEDIDO_INVALIDA'; end if;
152:     select 1 from public.pedidos p where p.id = new.pedido_oficial_id
154:   ) then raise exception 'PEDIDO_OFICIAL_INCONSISTENTE'; end if;
160: create function public.proteger_item_posible_pedido()
167:   select p.estado into v_estado from public.posibles_pedidos p
168:   where p.id = new.posible_pedido_id for update;
169:   if not found then raise exception 'POSIBLE_PEDIDO_NO_ENCONTRADO'; end if;
170:   if v_estado in ('convertido', 'descartado') then raise exception 'POSIBLE_PEDIDO_CERRADO'; end if;
172:     if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
173:     if row(new.id, new.posible_pedido_id, new.producto_id, new.presentacion_producto_id,
177:       is distinct from row(old.id, old.posible_pedido_id, old.producto_id, old.presentacion_producto_id,
181:       raise exception 'SNAPSHOT_POSIBLE_PEDIDO_INMUTABLE';
186:     if v_producto_id is distinct from new.producto_id then raise exception 'PRESENTACION_PRODUCTO_INCONSISTENTE'; end if;
187:     if new.cantidad is distinct from new.cantidad_original then raise exception 'CANTIDAD_INICIAL_INCONSISTENTE'; end if;
188:     if new.precio_venta_autorizado is not null then raise exception 'AUTORIZAR_PRECIO_EN_OPERACION_SEPARADA'; end if;
190:   if not public.es_cantidad_pedido_valida(new.unidad_snapshot, new.cantidad_presentacion_snapshot,
192:     or not public.es_cantidad_pedido_valida(new.unidad_snapshot, new.cantidad_presentacion_snapshot,
194:     raise exception 'CANTIDAD_POSIBLE_PEDIDO_INVALIDA';
201:     raise exception 'MODO_CANTIDAD_POSIBLE_PEDIDO_INVALIDO';
208:       raise exception 'AUTORIZACION_PRECIO_INVALIDA';
220: create function public.verificar_auditoria_precio_posible_pedido()
228:     select 1 from public.historial_posibles_pedidos h
229:     join public.posibles_pedidos p on p.id = h.posible_pedido_id
230:     where h.posible_pedido_id = new.posible_pedido_id
237:   ) then raise exception 'AUDITORIA_PRECIO_REQUERIDA'; end if;
242: create function public.proteger_historial_posible_pedido()
246:   if tg_op <> 'INSERT' then raise exception 'HISTORIAL_POSIBLE_PEDIDO_INMUTABLE'; end if;
247:   select p.version into v_version from public.posibles_pedidos p
248:     where p.id = new.posible_pedido_id for update;
249:   if new.version_resultante is distinct from v_version then raise exception 'VERSION_AUDITORIA_INVALIDA'; end if;
251:       or new.administrador_id is distinct from auth.uid()) then raise exception 'NO_AUTORIZADO'; end if;
253:     raise exception 'AUDITORIA_REGISTRO_INVALIDA';
259: create function public.verificar_vinculo_item_posible_pedido()
262:   if tg_op = 'UPDATE' then raise exception 'VINCULO_POSIBLE_PEDIDO_INMUTABLE'; end if;
263:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
265:     select 1 from public.items_posible_pedido i
266:     join public.posibles_pedidos p on p.id = i.posible_pedido_id
267:     join public.items_pedido oficial on oficial.id = new.item_pedido_id
268:     where i.id = new.item_posible_pedido_id and i.activo
269:       and p.estado = 'convertido' and p.pedido_oficial_id = oficial.pedido_id
279:   ) then raise exception 'VINCULO_PEDIDO_INCONSISTENTE'; end if;
284: create trigger proteger_cabecera_posible_pedido before insert or update on public.posibles_pedidos
285:   for each row execute function public.proteger_cabecera_posible_pedido();
286: create trigger proteger_item_posible_pedido before insert or update on public.items_posible_pedido
287:   for each row execute function public.proteger_item_posible_pedido();
288: create constraint trigger verificar_auditoria_precio_posible_pedido
289:   after update on public.items_posible_pedido deferrable initially deferred
290:   for each row execute function public.verificar_auditoria_precio_posible_pedido();
291: create trigger proteger_historial_posible_pedido before insert or update or delete on public.historial_posibles_pedidos
292:   for each row execute function public.proteger_historial_posible_pedido();
293: create trigger verificar_vinculo_item_posible_pedido before insert or update on public.vinculos_items_posible_pedido
294:   for each row execute function public.verificar_vinculo_item_posible_pedido();
296: alter table public.posibles_pedidos enable row level security;
297: alter table public.items_posible_pedido enable row level security;
298: alter table public.historial_posibles_pedidos enable row level security;
299: alter table public.vinculos_items_posible_pedido enable row level security;
303: revoke all on table public.posibles_pedidos, public.items_posible_pedido,
304:   public.historial_posibles_pedidos, public.vinculos_items_posible_pedido
306: grant select on table public.posibles_pedidos, public.items_posible_pedido,
307:   public.historial_posibles_pedidos, public.vinculos_items_posible_pedido to authenticated;
309: create policy posibles_pedidos_lectura_admin on public.posibles_pedidos
311: create policy items_posible_pedido_lectura_admin on public.items_posible_pedido
313: create policy historial_posibles_pedidos_lectura_admin on public.historial_posibles_pedidos
315: create policy vinculos_items_posible_pedido_lectura_admin on public.vinculos_items_posible_pedido
318: revoke all on function public.proteger_cabecera_posible_pedido(),
319:   public.proteger_item_posible_pedido(), public.verificar_auditoria_precio_posible_pedido(),
320:   public.proteger_historial_posible_pedido(), public.verificar_vinculo_item_posible_pedido()
329: -- el historial no admite UPDATE/DELETE ordinarios.

## supabase/migrations/20261022011000_corregir_auditoria_precio_posible_pedido.sql

5: create or replace function public.verificar_auditoria_precio_posible_pedido()
13:     select 1 from public.historial_posibles_pedidos h
14:     where h.posible_pedido_id = new.posible_pedido_id
22:   ) then raise exception 'AUDITORIA_PRECIO_REQUERIDA'; end if;
26: alter function public.verificar_auditoria_precio_posible_pedido() owner to postgres;
27: revoke all on function public.verificar_auditoria_precio_posible_pedido()

## supabase/migrations/20261022012000_crear_rpcs_posibles_pedidos.sql

2: -- No configura días/cortes. No reemplaza crear_pedido_desde_carrito.
5: -- Helpers sin EXECUTE para roles de aplicación; RPCs con propietario explícito.
7: create function public.pp_fechas_validas(p_momento timestamptz)
17: create function public.obtener_fechas_posibles_pedidos()
23: create function public.pp_huella(p_datos jsonb)
28: create function public.pp_normalizar_items(p_items jsonb)
34:   if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'ITEMS_INVALIDOS'; end if;
36:     or octet_length(p_items::text) > 32768 then raise exception 'LIMITE_SOLICITUD'; end if;
42:       or jsonb_typeof(v_item -> 'cantidad') is distinct from 'number' then raise exception 'ITEM_INVALIDO'; end if;
45:     if not (v_cantidad > 0 and v_cantidad <= 100000) then raise exception 'CANTIDAD_INVALIDA'; end if;
46:     if v_id = any(v_ids) then raise exception 'PRESENTACION_DUPLICADA'; end if;
57: create function public.pp_capturar_presentacion(p_presentacion_id uuid, p_cantidad numeric, p_validar_precio boolean default true)
65:   if not found or not v_producto.activo or not v_producto.disponible then raise exception 'PRODUCTO_NO_DISPONIBLE'; end if;
68:     or not v_presentacion.es_principal then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
70:   if v_activa is distinct from true then raise exception 'CATEGORIA_NO_DISPONIBLE'; end if;
72:     or not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad,
73:       v_presentacion.nombre, p_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
75:     or v_presentacion.precio_final::numeric * p_cantidad > 9000000000000) then raise exception 'PRECIO_INVALIDO'; end if;
88: create function public.pp_insertar_linea(p_id uuid, p_linea jsonb, p_orden integer)
92:   insert into public.items_posible_pedido (posible_pedido_id, producto_id, presentacion_producto_id,
106: create function public.pp_resultado_admin(p_id uuid)
108:   select jsonb_build_object('posible_pedido_id', p.id, 'codigo', p.codigo_publico,
111:     'pedido_id', p.pedido_oficial_id, 'numero_pedido', o.numero_pedido)
112:   from public.posibles_pedidos p left join public.pedidos o on o.id = p.pedido_oficial_id where p.id = p_id;
115: create function public.pp_bloquear_admin(p_id uuid, p_version bigint, p_operacion uuid)
116: returns public.posibles_pedidos language plpgsql set search_path = pg_catalog as $$
117: declare v_p public.posibles_pedidos%rowtype;
119:   if auth.uid() is null or not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
120:   if p_id is null or p_version is null or p_version < 1 or p_operacion is null then raise exception 'OPERACION_INVALIDA'; end if;
121:   select p.* into v_p from public.posibles_pedidos p where p.id = p_id for update;
122:   if not found then raise exception 'POSIBLE_PEDIDO_NO_ENCONTRADO'; end if;
127: create function public.pp_reintento_admin(p_id uuid, p_operacion uuid, p_evento text, p_huella bytea)
129: declare v_h public.historial_posibles_pedidos%rowtype;
131:   select h.* into v_h from public.historial_posibles_pedidos h
132:     where h.posible_pedido_id = p_id and h.clave_operacion = p_operacion;
136:     raise exception 'CLAVE_OPERACION_EN_USO';
142: create function public.pp_exigir_abierto(p public.posibles_pedidos, p_version bigint)
145:   if p.estado in ('convertido', 'descartado') then raise exception 'POSIBLE_PEDIDO_CERRADO'; end if;
146:   if p.version <> p_version then raise exception 'POSIBLE_PEDIDO_DESACTUALIZADO'; end if;
150: create function public.pp_totales(p_id uuid)
153: declare v_s numeric; v_c integer; v_p public.posibles_pedidos%rowtype; v_d bigint;
155:   select p.* into v_p from public.posibles_pedidos p where p.id = p_id;
157:     from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo;
158:   if v_c not between 1 and 100 or v_s is null or v_s > 9000000000000 then raise exception 'LIMITE_SOLICITUD'; end if;
160:   if v_s + v_d > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
165: create function public.pp_evento(p_id uuid, p_operacion uuid, p_evento text, p_huella bytea, p_motivo text, p_cambios jsonb)
170:   select p.version into v_version from public.posibles_pedidos p where p.id = p_id;
171:   insert into public.historial_posibles_pedidos (posible_pedido_id, clave_operacion, evento,
179: create function public.registrar_posible_pedido_whatsapp(
187:   v_huella bytea; v_secreto bytea; v_p public.posibles_pedidos%rowtype;
192:   if auth.role() is distinct from 'service_role' then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
196:     or p_secreto_reintento !~ '^[0-9a-f]{64}$' then raise exception 'SOLICITUD_INVALIDA'; end if;
197:   if p_telefono is null or char_length(p_telefono) > 40 or p_telefono !~ '^\+?[0-9 ()-]+$' then raise exception 'TELEFONO_INVALIDO'; end if;
200:   if v_telefono !~ '^569[0-9]{8}$' then raise exception 'TELEFONO_INVALIDO'; end if;
207:   perform pg_advisory_xact_lock(hashtextextended('posible-pedido:' || p_clave_idempotencia::text, 0));
208:   select p.* into v_p from public.posibles_pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
211:       raise exception 'REINTENTO_INVALIDO';
213:     select h.cambios -> 'respuesta_original' into v_respuesta from public.historial_posibles_pedidos h
214:       where h.posible_pedido_id = v_p.id and h.evento = 'registro' and h.version_resultante = 1;
215:     if v_respuesta is null then raise exception 'REGISTRO_INCONSISTENTE'; end if;
222:     then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
229:   if v_subtotal + v_despacho > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
231:     then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
233:   insert into public.posibles_pedidos (id, nombre_solicitante, telefono_contacto, fecha_entrega_solicitada,
251:   insert into public.historial_posibles_pedidos (posible_pedido_id, clave_operacion, evento, version_resultante, cambios)
259: create function public.editar_posible_pedido_administrativo(
264:   v_p public.posibles_pedidos%rowtype; v_reintento jsonb; v_huella bytea;
265:   v_linea jsonb; v_i public.items_posible_pedido%rowtype; v_captura jsonb; v_t record;
270:   if jsonb_typeof(p_lineas) is distinct from 'array' then raise exception 'LINEAS_INVALIDAS'; end if;
271:   if jsonb_array_length(p_lineas) not between 1 and 100 or octet_length(p_lineas::text) > 32768 then raise exception 'LIMITE_SOLICITUD'; end if;
276:   select array_agg(i.id) into v_ids from public.items_posible_pedido i where i.posible_pedido_id = p_id;
278:     into v_antes from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo;
280:   update public.items_posible_pedido set activo = false where posible_pedido_id = p_id and activo;
285:       or ((v_linea ? 'item_id') = (v_linea ? 'presentacion_id')) then raise exception 'LINEA_INVALIDA'; end if;
287:     if not (v_cantidad > 0 and v_cantidad <= 100000) then raise exception 'CANTIDAD_INVALIDA'; end if;
290:       if coalesce(v_linea ->> 'item_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'ITEM_INVALIDO'; end if;
292:       if not coalesce(v_id = any(v_ids), false) or v_id = any(v_usados) then raise exception 'ITEM_INVALIDO'; end if;
294:       select i.* into v_i from public.items_posible_pedido i where i.id = v_id;
295:       if v_cantidad * coalesce(v_i.precio_venta_autorizado, v_i.precio_venta_original_snapshot)::numeric > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
296:       update public.items_posible_pedido set cantidad = v_cantidad, orden = v_orden, activo = true where id = v_id;
298:       if coalesce(v_linea ->> 'presentacion_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
301:       if exists (select 1 from public.items_posible_pedido i where i.posible_pedido_id = p_id
303:         raise exception 'PRESENTACION_EXISTENTE_USAR_ITEM_ID';
310:   update public.posibles_pedidos set subtotal_estimado = v_t.subtotal, costo_entrega_estimado = v_t.despacho,
313:     into v_despues from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo;
319: create function public.autorizar_precio_posible_pedido(
325:   v_p public.posibles_pedidos%rowtype; v_i public.items_posible_pedido%rowtype;
331:     or p_precio_venta < p_precio_neto or p_precio_venta > 9000000000000 then raise exception 'PRECIO_O_MOTIVO_INVALIDO'; end if;
338:   select i.* into v_i from public.items_posible_pedido i where i.id = p_item_id and i.posible_pedido_id = p_id and i.activo for update;
339:   if not found then raise exception 'ITEM_INVALIDO'; end if;
340:   if v_i.cantidad * p_precio_venta::numeric > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
341:   update public.items_posible_pedido set precio_neto_autorizado = p_precio_neto,
346:   update public.posibles_pedidos set subtotal_estimado = v_t.subtotal, costo_entrega_estimado = v_t.despacho,
355: create function public.asociar_cliente_posible_pedido(
359: declare v_p public.posibles_pedidos%rowtype; v_reintento jsonb; v_huella bytea;
367:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
368:   update public.posibles_pedidos set cliente_id = p_cliente_id, estado = 'en_gestion', version = version + 1 where id = p_id;
374: create function public.descartar_posible_pedido(
378: declare v_p public.posibles_pedidos%rowtype; v_reintento jsonb; v_huella bytea; v_motivo text := btrim(p_motivo);
381:   if v_motivo is null or char_length(v_motivo) not between 1 and 1000 then raise exception 'MOTIVO_REQUERIDO'; end if;
386:   update public.posibles_pedidos set estado = 'descartado', fecha_cierre = clock_timestamp(), version = version + 1 where id = p_id;
391: create function public.convertir_posible_pedido_administrativo(
393:   p_direccion_id uuid, p_fecha_efectiva date, p_metodos_pago text[]
397:   v_p public.posibles_pedidos%rowtype; v_cliente public.clientes%rowtype;
399:   v_i public.items_posible_pedido%rowtype; v_actual jsonb; v_t record;
400:   v_huella bytea; v_reintento jsonb; v_metodos text[]; v_pedido_id uuid := gen_random_uuid();
404:   -- Recuperación segura incluso con otra clave/versión: no hay segundo pedido.
406:   if p_metodos_pago is null or cardinality(p_metodos_pago) not between 1 and 3
407:     or array_ndims(p_metodos_pago) <> 1 or array_position(p_metodos_pago, null) is not null
408:     or not (p_metodos_pago <@ array['efectivo','transferencia','tarjeta']::text[])
409:     or (select count(distinct m) from unnest(p_metodos_pago) m) <> cardinality(p_metodos_pago) then
410:     raise exception 'METODOS_PAGO_INVALIDOS';
413:     from unnest(array['efectivo','transferencia','tarjeta']::text[]) with ordinality x(m,n) where m = any(p_metodos_pago);
420:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
423:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
426:     raise exception 'DIRECCION_SIN_UBICACION'; end if;
428:   if not found then raise exception 'ZONA_INVALIDA'; end if;
430:   -- Se valida con catálogo, pero NO se usan sus precios para el pedido.
431:   for v_i in select i.* from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo order by i.id for update loop
437:       raise exception 'PRESENTACION_MODIFICADA_REQUIERE_REVISION';
443:     or not public.fecha_entrega_disponible(p_fecha_efectiva, clock_timestamp()) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
444:   insert into public.pedidos (id, cliente_id, canal_origen, estado, nombre_cliente_snapshot,
449:     total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos)
450:   values (v_pedido_id, v_cliente.id, 'whatsapp', 'recibido', v_cliente.nombre,
458:   update public.posibles_pedidos set estado = 'convertido', pedido_oficial_id = v_pedido_id,
461:   for v_i in select i.* from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo order by i.orden loop
462:     insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id,
465:     values (v_pedido_id, v_i.producto_id, v_i.presentacion_producto_id,
470:     insert into public.vinculos_items_posible_pedido values (v_i.id, v_item_id);
473:     jsonb_build_object('pedido_id', v_pedido_id, 'direccion_id', p_direccion_id,
474:       'fecha_efectiva', p_fecha_efectiva, 'metodos_pago', v_metodos));
479: alter function public.obtener_fechas_posibles_pedidos() owner to postgres;
480: alter function public.pp_fechas_validas(timestamptz) owner to postgres;
481: alter function public.pp_huella(jsonb) owner to postgres;
482: alter function public.pp_normalizar_items(jsonb) owner to postgres;
483: alter function public.pp_capturar_presentacion(uuid,numeric,boolean) owner to postgres;
484: alter function public.pp_insertar_linea(uuid,jsonb,integer) owner to postgres;
485: alter function public.pp_resultado_admin(uuid) owner to postgres;
486: alter function public.pp_bloquear_admin(uuid,bigint,uuid) owner to postgres;
487: alter function public.pp_reintento_admin(uuid,uuid,text,bytea) owner to postgres;
488: alter function public.pp_exigir_abierto(public.posibles_pedidos,bigint) owner to postgres;
489: alter function public.pp_totales(uuid) owner to postgres;
490: alter function public.pp_evento(uuid,uuid,text,bytea,text,jsonb) owner to postgres;
491: alter function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) owner to postgres;
492: alter function public.editar_posible_pedido_administrativo(uuid,bigint,uuid,jsonb) owner to postgres;
493: alter function public.autorizar_precio_posible_pedido(uuid,bigint,uuid,uuid,bigint,bigint,text) owner to postgres;
494: alter function public.asociar_cliente_posible_pedido(uuid,bigint,uuid,uuid) owner to postgres;
495: alter function public.descartar_posible_pedido(uuid,bigint,uuid,text) owner to postgres;
496: alter function public.convertir_posible_pedido_administrativo(uuid,bigint,uuid,uuid,date,text[]) owner to postgres;
498: revoke all on function public.obtener_fechas_posibles_pedidos(), public.pp_fechas_validas(timestamptz), public.pp_huella(jsonb),
502:   public.pp_exigir_abierto(public.posibles_pedidos,bigint), public.pp_totales(uuid),
504:   public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text),
505:   public.editar_posible_pedido_administrativo(uuid,bigint,uuid,jsonb),
506:   public.autorizar_precio_posible_pedido(uuid,bigint,uuid,uuid,bigint,bigint,text),
507:   public.asociar_cliente_posible_pedido(uuid,bigint,uuid,uuid), public.descartar_posible_pedido(uuid,bigint,uuid,text),
508:   public.convertir_posible_pedido_administrativo(uuid,bigint,uuid,uuid,date,text[])
511: grant execute on function public.obtener_fechas_posibles_pedidos() to anon, authenticated, service_role;
512: grant execute on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) to service_role;
513: grant execute on function public.editar_posible_pedido_administrativo(uuid,bigint,uuid,jsonb),
514:   public.autorizar_precio_posible_pedido(uuid,bigint,uuid,uuid,bigint,bigint,text),
515:   public.asociar_cliente_posible_pedido(uuid,bigint,uuid,uuid), public.descartar_posible_pedido(uuid,bigint,uuid,text),
516:   public.convertir_posible_pedido_administrativo(uuid,bigint,uuid,uuid,date,text[]) to authenticated;

## supabase/migrations/20261022013000_habilitar_corte_entrega_mismo_dia.sql

4: alter table public.dias_entrega
5:   drop constraint dias_entrega_dias_anticipacion_corte_check;
6: alter table public.dias_entrega
11: create function public.guardar_dia_entrega_administrativo(
22:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
25:     raise exception 'DIA_SEMANA_INVALIDO';
27:   if p_activo is null then raise exception 'ACTIVO_INVALIDO'; end if;
28:   if p_hora_corte is null then raise exception 'HORA_CORTE_INVALIDA'; end if;
30:     raise exception 'ANTICIPACION_CORTE_INVALIDA';
48: create or replace function public.guardar_dia_entrega_administrativo(
56:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
59:     raise exception 'DIA_SEMANA_INVALIDO';
69: alter function public.guardar_dia_entrega_administrativo(smallint,boolean,time,smallint) owner to postgres;
70: alter function public.guardar_dia_entrega_administrativo(smallint,boolean,time) owner to postgres;

## supabase/migrations/20261023010000_limitar_registro_posibles_pedidos.sql

2: create table public.limites_posibles_pedidos (
9: alter table public.limites_posibles_pedidos enable row level security;
10: revoke all on public.limites_posibles_pedidos from public, anon, authenticated, service_role;
11: create index limites_posibles_expiracion_idx on public.limites_posibles_pedidos(expira_en);
13: create function public.consumir_limite_posibles_pedidos(p_origen_hash text, p_telefono_hash text)
20:   if auth.role() is distinct from 'service_role' then raise exception 'NO_AUTORIZADO' using errcode='42501'; end if;
23:     raise exception 'HUELLA_INVALIDA';
25:   delete from public.limites_posibles_pedidos where expira_en < v_ahora;
30:     insert into public.limites_posibles_pedidos as l(clave,ventana,cantidad,expira_en)
40: revoke all on function public.consumir_limite_posibles_pedidos(text,text) from public, anon, authenticated;
41: grant execute on function public.consumir_limite_posibles_pedidos(text,text) to service_role;

## supabase/migrations/20261031010000_registro_publico_whatsapp.sql

3: -- No abre tablas, no modifica RLS ni checkout; no crea pedidos oficiales ni deuda.
5: create or replace function public.consumir_limite_posibles_pedidos(p_origen_hash text, p_telefono_hash text)
14:     raise exception 'HUELLA_INVALIDA';
17:   perform pg_advisory_xact_lock(hashtextextended('posibles-pedidos:cuotas', 0));
19:   delete from public.limites_posibles_pedidos where expira_en < v_ahora;
24:     insert into public.limites_posibles_pedidos as l(clave,ventana,cantidad,expira_en)
34: alter function public.consumir_limite_posibles_pedidos(text,text) owner to postgres;
35: revoke all on function public.consumir_limite_posibles_pedidos(text,text) from public, anon, authenticated, service_role;
37: create or replace function public.registrar_posible_pedido_whatsapp(
45:   v_huella bytea; v_secreto bytea; v_p public.posibles_pedidos%rowtype;
53:     or p_secreto_reintento !~ '^[0-9a-f]{64}$' then raise exception 'SOLICITUD_INVALIDA'; end if;
54:   if p_telefono is null or char_length(p_telefono) > 40 or p_telefono !~ '^\+?[0-9 ()-]+$' then raise exception 'TELEFONO_INVALIDO'; end if;
57:   if v_telefono !~ '^569[0-9]{8}$' then raise exception 'TELEFONO_INVALIDO'; end if;
64:   perform pg_advisory_xact_lock(hashtextextended('posibles-pedidos:cuotas', 0));
67:   perform pg_advisory_xact_lock(hashtextextended('posible-pedido:' || p_clave_idempotencia::text, 0));
68:   select p.* into v_p from public.posibles_pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
71:       raise exception 'REINTENTO_INVALIDO';
73:     select h.cambios -> 'respuesta_original' into v_respuesta from public.historial_posibles_pedidos h
74:       where h.posible_pedido_id = v_p.id and h.evento = 'registro' and h.version_resultante = 1;
75:     if v_respuesta is null then raise exception 'REGISTRO_INCONSISTENTE'; end if;
83:   if not public.consumir_limite_posibles_pedidos(
86:     raise exception 'LIMITE_SOLICITUDES';
92:     then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
99:   if v_subtotal + v_despacho > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
101:     then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
103:   insert into public.posibles_pedidos (id, nombre_solicitante, telefono_contacto, fecha_entrega_solicitada,
121:   insert into public.historial_posibles_pedidos (posible_pedido_id, clave_operacion, evento, version_resultante, cambios)
127: alter function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) owner to postgres;
128: revoke all on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) from public, anon, authenticated, service_role;
129: grant execute on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) to anon, authenticated;

## supabase/migrations/20261101010000_versiones_solicitudes_whatsapp.sql

1: -- Versiones intencionales: reutiliza cabeceras, líneas, historial y conversión existentes.
4: alter table public.posibles_pedidos add column numero_version integer not null default 1;
7: alter table public.posibles_pedidos add column solicitud_id uuid not null default gen_random_uuid();
10: alter table public.posibles_pedidos alter column solicitud_id drop default;
11: alter table public.posibles_pedidos add constraint pp_numero_version check (numero_version between 1 and 5),
13: create unique index pp_una_conversion_por_solicitud on public.posibles_pedidos(solicitud_id) where estado = 'convertido';
14: create function public.pp_proteger_identidad_version() returns trigger
18:     raise exception 'SOLICITUD_ORIGINAL_INMUTABLE';
24: create trigger pp_proteger_identidad_version before update on public.posibles_pedidos
25: for each row execute function public.pp_proteger_identidad_version();
26: drop function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text);
27: create or replace function public.registrar_posible_pedido_whatsapp(
36:   v_huella bytea; v_secreto bytea; v_p public.posibles_pedidos%rowtype;
38:   v_respuesta jsonb; v_momento timestamptz; v_raiz public.posibles_pedidos%rowtype;
45:     or p_secreto_reintento !~ '^[0-9a-f]{64}$' then raise exception 'SOLICITUD_INVALIDA'; end if;
46:   if p_telefono is null or char_length(p_telefono) > 40 or p_telefono !~ '^\+?[0-9 ()-]+$' then raise exception 'TELEFONO_INVALIDO'; end if;
49:   if v_telefono !~ '^569[0-9]{8}$' then raise exception 'TELEFONO_INVALIDO'; end if;
54:   if (p_solicitud_clave is null) <> (p_solicitud_secreto is null) then raise exception 'REINTENTO_INVALIDO'; end if;
55:   if p_solicitud_secreto is not null and p_solicitud_secreto !~ '^[0-9a-f]{64}$' then raise exception 'REINTENTO_INVALIDO'; end if;
58:   perform pg_advisory_xact_lock(hashtextextended('posibles-pedidos:cuotas', 0));
62:   perform pg_advisory_xact_lock(hashtextextended('posible-pedido:' || p_clave_idempotencia::text, 0));
64:     select p.* into v_raiz from public.posibles_pedidos p
67:       raise exception 'REINTENTO_INVALIDO';
73:   select p.* into v_p from public.posibles_pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
77:       raise exception 'REINTENTO_INVALIDO';
79:     select h.cambios -> 'respuesta_original' into v_respuesta from public.historial_posibles_pedidos h
80:       where h.posible_pedido_id = v_p.id and h.evento = 'registro' and h.version_resultante = 1;
81:     if v_respuesta is null then raise exception 'REGISTRO_INCONSISTENTE'; end if;
85:     if exists (select 1 from public.posibles_pedidos where solicitud_id = v_solicitud and estado in ('convertido','descartado')) then
86:       raise exception 'POSIBLE_PEDIDO_CERRADO';
88:     select count(*) + 1 into v_numero from public.posibles_pedidos where solicitud_id = v_solicitud;
89:     if v_numero > 5 then raise exception 'LIMITE_VERSIONES'; end if;
96:   if not public.consumir_limite_posibles_pedidos(
99:     raise exception 'LIMITE_SOLICITUDES';
105:     then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
112:   if v_subtotal + v_despacho > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
114:     then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
116:   insert into public.posibles_pedidos (solicitud_id, numero_version, id, nombre_solicitante, telefono_contacto, fecha_entrega_solicitada,
134:   insert into public.historial_posibles_pedidos (posible_pedido_id, clave_operacion, evento, version_resultante, cambios)
140: create or replace function public.pp_bloquear_admin(p_id uuid, p_version bigint, p_operacion uuid)
141: returns public.posibles_pedidos language plpgsql set search_path = pg_catalog as $$
142: declare v_p public.posibles_pedidos%rowtype;
144:   if auth.uid() is null or not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO' using errcode = '42501'; end if;
145:   if p_id is null or p_version is null or p_version < 1 or p_operacion is null then raise exception 'OPERACION_INVALIDA'; end if;
148:   perform pg_advisory_xact_lock(hashtextextended('posibles-pedidos:cuotas', 0));
149:   perform 1 from public.posibles_pedidos r where r.numero_version = 1 and r.solicitud_id =
150:     (select solicitud_id from public.posibles_pedidos where id = p_id) for update;
151:   select p.* into v_p from public.posibles_pedidos p where p.id = p_id for update;
152:   if not found then raise exception 'POSIBLE_PEDIDO_NO_ENCONTRADO'; end if;
157: alter function public.pp_bloquear_admin(uuid,bigint,uuid) owner to postgres;
160: create or replace function public.pp_exigir_abierto(p public.posibles_pedidos, p_version bigint)
163:   if exists (select 1 from public.posibles_pedidos v where v.solicitud_id = p.solicitud_id and v.estado in ('convertido','descartado')) then raise exception 'POSIBLE_PEDIDO_CERRADO'; end if;
164:   if p.version <> p_version then raise exception 'POSIBLE_PEDIDO_DESACTUALIZADO'; end if;
169: alter function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text,uuid,text) owner to postgres;
170: revoke all on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text,uuid,text) from public,anon,authenticated,service_role;
171: grant execute on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text,uuid,text) to anon,authenticated;
173: create view public.solicitudes_posibles_pedidos with (security_invoker=true) as
174: select elegida.*, raiz.codigo_publico as codigo_solicitud from public.posibles_pedidos raiz
176:   select v.* from public.posibles_pedidos v where v.solicitud_id = raiz.solicitud_id
179: revoke all on public.solicitudes_posibles_pedidos from public,anon,authenticated,service_role;
180: grant select on public.solicitudes_posibles_pedidos to authenticated;

## supabase/migrations/20261101020000_gestion_administrativa_clientes.sql

3: -- asociar_cliente_posible_pedido de 20261022012000; esquema logístico de direcciones.
15: -- Con posible pedido: ambos parámetros no nulos; asociación usa la misma clave,
22: -- compatibilidad revisada contra migraciones y docs/09-POSIBLES-PEDIDOS-RPCS.md.
29: alter table public.direcciones_cliente alter column region drop not null;
31: create table public.operaciones_clientes_administrativas (
38: alter table public.operaciones_clientes_administrativas owner to postgres;
39: alter table public.operaciones_clientes_administrativas enable row level security;
42: -- manipular/eliminar comprobantes desde roles de aplicación.
44: create function public.obtener_cliente_administrativo(p_cliente_id uuid)
50:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
56:   if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
61: create function public.guardar_cliente_administrativo(
67:   p_posible_pedido_id uuid default null,
68:   p_version_posible_pedido bigint default null
73:   v_p public.posibles_pedidos%rowtype; v_id uuid; v_d jsonb; v_k text; v_tipo text;
82:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
84:   if p_clave_operacion is null then raise exception 'CLAVE_OPERACION_REQUERIDA'; end if;
87:     raise exception 'DOCUMENTO_INVALIDO';
90:     or jsonb_array_length(p_direcciones) > 50 then raise exception 'LIMITE_SOLICITUD'; end if;
91:   if (p_posible_pedido_id is null) <> (p_version_posible_pedido is null) then
92:     raise exception 'ASOCIACION_INCOMPLETA';
96:     'posible_pedido_id', p_posible_pedido_id, 'version', p_version_posible_pedido));
104:       raise exception 'CLAVE_OPERACION_EN_USO';
108:   -- Orden compartido con conversión: posible pedido -> cliente -> direcciones
110:   if p_posible_pedido_id is not null then
111:     v_p := public.pp_bloquear_admin(p_posible_pedido_id, p_version_posible_pedido, p_clave_operacion);
113:     if exists (select 1 from public.historial_posibles_pedidos h
114:       where h.posible_pedido_id = p_posible_pedido_id and h.clave_operacion = p_clave_operacion) then
115:       raise exception 'CLAVE_OPERACION_EN_USO';
117:     perform public.pp_exigir_abierto(v_p, p_version_posible_pedido);
121:     raise exception 'CAMPOS_CLIENTE_INVALIDOS';
127:       raise exception 'TIPO_CLIENTE_INVALIDO';
134:   if v_nombre is null or length(v_nombre) > 200 then raise exception 'NOMBRE_INVALIDO'; end if;
136:     or (v_telefono is not null and v_telefono !~ '^[0-9]{8,15}$') then raise exception 'TELEFONO_INVALIDO'; end if;
138:     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'EMAIL_INVALIDO'; end if;
139:   if length(coalesce(p_cliente ->> 'observaciones','')) > 4000 then raise exception 'OBSERVACIONES_INVALIDAS'; end if;
141:     if p_revision_esperada is not null then raise exception 'REVISION_INVALIDA'; end if;
143:       raise exception 'TELEFONO_INVALIDO';
150:     if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
155:       raise exception 'CLIENTE_DESACTUALIZADO' using errcode = '40001';
164:     if jsonb_typeof(v_d) is distinct from 'object' then raise exception 'DIRECCION_INVALIDA'; end if;
169:       raise exception 'CAMPOS_DIRECCION_INVALIDOS';
175:         raise exception 'TIPO_DIRECCION_INVALIDO';
177:       if v_tipo = 'string' and length(v_d ->> v_k) > 1000 then raise exception 'DIRECCION_DEMASIADO_LARGA'; end if;
186:       raise exception 'DIRECCION_INCOMPLETA';
190:       not (v_lat between -90 and 90 and v_lon between -180 and 180)) then raise exception 'UBICACION_INVALIDA'; end if;
193:       if v_did = any(v_ids) then raise exception 'DIRECCION_DUPLICADA'; end if;
196:         raise exception 'DIRECCION_NO_PERTENECE_AL_CLIENTE';
200:       if not (v_d ->> 'activa')::boolean then raise exception 'PRINCIPAL_INACTIVA'; end if;
206:   if v_nprincipales > 1 then raise exception 'MULTIPLES_DIRECCIONES_PRINCIPALES'; end if;
209:     (select 1 from public.zonas_entrega e where e.id = z.id and e.activa)) then raise exception 'ZONA_INVALIDA'; end if;
254:   if p_posible_pedido_id is not null then
256:     v_asociacion := public.asociar_cliente_posible_pedido(p_posible_pedido_id,
257:       p_version_posible_pedido, p_clave_operacion, v_id);
273: alter function public.obtener_cliente_administrativo(uuid) owner to postgres;
274: alter function public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint) owner to postgres;

## supabase/migrations/20261101030000_separar_ambitos_direcciones_cliente.sql

10: -- Fallar cerrado ante políticas/triggers/sobrecargas no presentes en las fuentes
19:     raise exception 'BLOQUEO_POLITICAS_DIRECCIONES_NO_REVISADAS';
26:     raise exception 'BLOQUEO_TRIGGERS_DIRECCIONES_NO_REVISADOS';
31:         'guardar_cliente_administrativo', 'crear_pedido_desde_carrito')) <> 5
36:     or to_regprocedure('public.crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date,text[])') is null then
37:     raise exception 'BLOQUEO_SOBRECARGAS_DIRECCIONES_NO_REVISADAS';
44: alter table public.direcciones_cliente
47: alter table public.direcciones_cliente alter column ambito drop default;
58:     raise exception 'BLOQUEO_PRINCIPALES_DUPLICADAS_REQUIERE_REVISION';
70: alter table public.direcciones_cliente enable row level security;
84: create or replace function public.guardar_direccion_cliente(
110:     raise exception 'NO_AUTORIZADO';
114:     raise exception 'DESTINATARIO_REQUERIDO';
118:     raise exception 'DIRECCION_REQUERIDA';
122:     raise exception 'TELEFONO_INVALIDO';
127:     raise exception 'UBICACION_REQUERIDA';
131:     raise exception 'UBICACION_INVALIDA';
139:     raise exception 'CLIENTE_NO_ENCONTRADO';
154:     raise exception 'ZONA_ENTREGA_INVALIDA';
166:       raise exception 'DIRECCION_NO_ENCONTRADA';
206: alter function public.guardar_direccion_cliente(uuid, text, text, text, uuid, numeric, numeric, text, boolean) owner to postgres;
211: create or replace function public.desactivar_direccion_cliente(
223:     raise exception 'NO_AUTORIZADO';
231:     raise exception 'CLIENTE_NO_ENCONTRADO';
243:     raise exception 'DIRECCION_NO_ENCONTRADA';
249: create or replace function public.obtener_cliente_administrativo(p_cliente_id uuid)
255:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
261:   if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
266: create or replace function public.guardar_cliente_administrativo(
272:   p_posible_pedido_id uuid default null,
273:   p_version_posible_pedido bigint default null
278:   v_p public.posibles_pedidos%rowtype; v_id uuid; v_d jsonb; v_k text; v_tipo text;
287:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
289:   if p_clave_operacion is null then raise exception 'CLAVE_OPERACION_REQUERIDA'; end if;
292:     raise exception 'DOCUMENTO_INVALIDO';
295:     or jsonb_array_length(p_direcciones) > 50 then raise exception 'LIMITE_SOLICITUD'; end if;
296:   if (p_posible_pedido_id is null) <> (p_version_posible_pedido is null) then
297:     raise exception 'ASOCIACION_INCOMPLETA';
301:     'posible_pedido_id', p_posible_pedido_id, 'version', p_version_posible_pedido));
309:       raise exception 'CLAVE_OPERACION_EN_USO';
326:   -- Orden compartido con conversión: posible pedido -> cliente -> direcciones
328:   if p_posible_pedido_id is not null then
329:     v_p := public.pp_bloquear_admin(p_posible_pedido_id, p_version_posible_pedido, p_clave_operacion);
331:     if exists (select 1 from public.historial_posibles_pedidos h
332:       where h.posible_pedido_id = p_posible_pedido_id and h.clave_operacion = p_clave_operacion) then
333:       raise exception 'CLAVE_OPERACION_EN_USO';
335:     perform public.pp_exigir_abierto(v_p, p_version_posible_pedido);
339:     raise exception 'CAMPOS_CLIENTE_INVALIDOS';
345:       raise exception 'TIPO_CLIENTE_INVALIDO';
352:   if v_nombre is null or length(v_nombre) > 200 then raise exception 'NOMBRE_INVALIDO'; end if;
354:     or (v_telefono is not null and v_telefono !~ '^[0-9]{8,15}$') then raise exception 'TELEFONO_INVALIDO'; end if;
356:     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'EMAIL_INVALIDO'; end if;
357:   if length(coalesce(p_cliente ->> 'observaciones','')) > 4000 then raise exception 'OBSERVACIONES_INVALIDAS'; end if;
359:     if p_revision_esperada is not null then raise exception 'REVISION_INVALIDA'; end if;
361:       raise exception 'TELEFONO_INVALIDO';
368:     if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
373:       raise exception 'CLIENTE_DESACTUALIZADO' using errcode = '40001';
382:     if jsonb_typeof(v_d) is distinct from 'object' then raise exception 'DIRECCION_INVALIDA'; end if;
387:       raise exception 'CAMPOS_DIRECCION_INVALIDOS';
393:         raise exception 'TIPO_DIRECCION_INVALIDO';
395:       if v_tipo = 'string' and length(v_d ->> v_k) > 1000 then raise exception 'DIRECCION_DEMASIADO_LARGA'; end if;
404:       raise exception 'DIRECCION_INCOMPLETA';
408:       not (v_lat between -90 and 90 and v_lon between -180 and 180)) then raise exception 'UBICACION_INVALIDA'; end if;
411:       if v_did = any(v_ids) then raise exception 'DIRECCION_DUPLICADA'; end if;
414:         raise exception 'DIRECCION_NO_PERTENECE_AL_CLIENTE';
418:       if not (v_d ->> 'activa')::boolean then raise exception 'PRINCIPAL_INACTIVA'; end if;
424:   if v_nprincipales > 1 then raise exception 'MULTIPLES_DIRECCIONES_PRINCIPALES'; end if;
427:     (select 1 from public.zonas_entrega e where e.id = z.id and e.activa)) then raise exception 'ZONA_INVALIDA'; end if;
472:   if p_posible_pedido_id is not null then
474:     v_asociacion := public.asociar_cliente_posible_pedido(p_posible_pedido_id,
475:       p_version_posible_pedido, p_clave_operacion, v_id);
491: alter function public.obtener_cliente_administrativo(uuid) owner to postgres;
492: alter function public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint) owner to postgres;
500: create or replace function public.crear_pedido_desde_carrito(
507:   p_metodos_pago_previstos text[]
510:   pedido_id uuid,
511:   numero_pedido text,
512:   estado public.estado_pedido,
526:   v_pedido public.pedidos%rowtype;
527:   v_pedido_existente public.pedidos%rowtype;
540:   v_metodos_pago_previstos text[];
542:   if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
543:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
544:   if p_metodos_pago_previstos is null or cardinality(p_metodos_pago_previstos) = 0 then
545:     raise exception 'METODOS_PAGO_PREVISTOS_REQUERIDOS';
547:   if array_position(p_metodos_pago_previstos, null) is not null
548:     or not (p_metodos_pago_previstos <@ array['efectivo', 'transferencia', 'tarjeta']::text[])
549:     or cardinality(p_metodos_pago_previstos) <>
550:       (case when 'efectivo' = any(p_metodos_pago_previstos) then 1 else 0 end
551:       + case when 'transferencia' = any(p_metodos_pago_previstos) then 1 else 0 end
552:       + case when 'tarjeta' = any(p_metodos_pago_previstos) then 1 else 0 end) then
553:     raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
556:   into v_metodos_pago_previstos
558:   where metodo = any(p_metodos_pago_previstos);
562:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
563:   if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
565:   select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
567:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
568:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
572:   if p_fecha_entrega is null then raise exception 'FECHA_ENTREGA_REQUERIDA'; end if;
574:   if p_fecha_entrega < v_hoy_local or p_fecha_entrega > v_hoy_local + 14 then raise exception 'FECHA_ENTREGA_INVALIDA'; end if;
575:   if not public.fecha_entrega_disponible(p_fecha_entrega) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
576:   if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
577:   if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;
580:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
581:   if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
583:   if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;
586:   insert into public.pedidos (
590:     subtotal, costo_entrega, descuento, total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos
595:     0, 0, 0, 0, v_observacion_normalizada, p_fecha_entrega, p_clave_idempotencia, v_metodos_pago_previstos
596:   ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;
598:   if v_pedido.id is null then
599:     select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
600:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
601:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
606:     if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
608:     if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
609:     if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
612:     if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
617:     if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
618:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
620:     insert into public.items_pedido (pedido_id,producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_neto_unitario_snapshot,precio_final_unitario_snapshot,total_linea,observacion_cliente,modo_cantidad_snapshot)
621:     values (v_pedido.id,v_presentacion.producto_id,v_presentacion.id,v_presentacion.nombre_producto,v_presentacion.nombre_presentacion,v_presentacion.unidad,v_cantidad,v_presentacion.precio_neto,v_presentacion.precio_final,round(v_cantidad * v_presentacion.precio_final)::bigint,null,v_modo_cantidad_snapshot);
624:   select coalesce(sum(i.total_linea), 0)::bigint into v_subtotal from public.items_pedido i where i.pedido_id = v_pedido.id;
626:   update public.pedidos set subtotal = v_subtotal, costo_entrega = v_costo_entrega, descuento = 0, total = v_subtotal + v_costo_entrega where id = v_pedido.id returning * into v_pedido;
627:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;
631: alter function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date, text[]) owner to postgres;
632: revoke all on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date, text[]) from public, anon, authenticated;
633: grant execute on function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date, text[]) to authenticated;
636: alter function public.desactivar_direccion_cliente(uuid) owner to postgres;
642:   public.crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date,text[])
649:   public.crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date,text[]) to authenticated;

## supabase/migrations/20261105010000_ubicaciones_comerciales_geolocalizadas.sql

5: alter table public.direcciones_cliente
24: create function public.validar_ubicacion_comercial()
31:         raise exception 'COORDENADAS_NO_RETIRABLES';
35:         raise exception 'DATOS_HISTORICOS_REQUERIDOS';
38:         raise exception 'UBICACION_REQUERIDA';
44:       raise exception 'UBICACION_INVALIDA';
49:         raise exception 'UBICACION_REQUERIDA';
55:         raise exception 'LIMITE_UBICACIONES';
62: alter function public.validar_ubicacion_comercial() owner to postgres;
64: create trigger validar_ubicacion_comercial before insert or update
65:   on public.direcciones_cliente for each row execute function public.validar_ubicacion_comercial();
67: create or replace function public.obtener_cliente_administrativo(p_cliente_id uuid)
73:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
79:   if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
84: create or replace function public.guardar_cliente_administrativo(
90:   p_posible_pedido_id uuid default null,
91:   p_version_posible_pedido bigint default null
96:   v_p public.posibles_pedidos%rowtype; v_id uuid; v_d jsonb; v_k text; v_tipo text;
105:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
107:   if p_clave_operacion is null then raise exception 'CLAVE_OPERACION_REQUERIDA'; end if;
110:     raise exception 'DOCUMENTO_INVALIDO';
113:     or jsonb_array_length(p_direcciones) > 50 then raise exception 'LIMITE_SOLICITUD'; end if;
114:   if (p_posible_pedido_id is null) <> (p_version_posible_pedido is null) then
115:     raise exception 'ASOCIACION_INCOMPLETA';
119:     'posible_pedido_id', p_posible_pedido_id, 'version', p_version_posible_pedido));
127:       raise exception 'CLAVE_OPERACION_EN_USO';
144:   -- Orden compartido con conversión: posible pedido -> cliente -> direcciones
146:   if p_posible_pedido_id is not null then
147:     v_p := public.pp_bloquear_admin(p_posible_pedido_id, p_version_posible_pedido, p_clave_operacion);
149:     if exists (select 1 from public.historial_posibles_pedidos h
150:       where h.posible_pedido_id = p_posible_pedido_id and h.clave_operacion = p_clave_operacion) then
151:       raise exception 'CLAVE_OPERACION_EN_USO';
153:     perform public.pp_exigir_abierto(v_p, p_version_posible_pedido);
157:     raise exception 'CAMPOS_CLIENTE_INVALIDOS';
163:       raise exception 'TIPO_CLIENTE_INVALIDO';
170:   if v_nombre is null or length(v_nombre) > 200 then raise exception 'NOMBRE_INVALIDO'; end if;
172:     or (v_telefono is not null and v_telefono !~ '^[0-9]{8,15}$') then raise exception 'TELEFONO_INVALIDO'; end if;
174:     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'EMAIL_INVALIDO'; end if;
175:   if length(coalesce(p_cliente ->> 'observaciones','')) > 4000 then raise exception 'OBSERVACIONES_INVALIDAS'; end if;
177:     if p_revision_esperada is not null then raise exception 'REVISION_INVALIDA'; end if;
179:       raise exception 'TELEFONO_INVALIDO';
186:     if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
191:       raise exception 'CLIENTE_DESACTUALIZADO' using errcode = '40001';
199:     raise exception 'UBICACION_REQUERIDA';
203:     raise exception 'LIMITE_UBICACIONES';
207:     if jsonb_typeof(v_d) is distinct from 'object' then raise exception 'DIRECCION_INVALIDA'; end if;
212:       raise exception 'CAMPOS_DIRECCION_INVALIDOS';
218:         raise exception 'TIPO_DIRECCION_INVALIDO';
220:       if v_tipo = 'string' and length(v_d ->> v_k) > 1000 then raise exception 'DIRECCION_DEMASIADO_LARGA'; end if;
227:       raise exception 'DIRECCION_INCOMPLETA';
231:       not (v_lat between -90 and 90 and v_lon between -180 and 180)) then raise exception 'UBICACION_INVALIDA'; end if;
234:       or v_lat is null or v_lon is null) then raise exception 'UBICACION_REQUERIDA'; end if;
237:       raise exception 'UBICACION_REQUERIDA';
240:       if v_did = any(v_ids) then raise exception 'DIRECCION_DUPLICADA'; end if;
243:         raise exception 'DIRECCION_NO_PERTENECE_AL_CLIENTE';
247:       if not (v_d ->> 'activa')::boolean then raise exception 'PRINCIPAL_INACTIVA'; end if;
263:   ) then raise exception 'NOMBRE_UBICACION_DUPLICADO'; end if;
264:   if v_nprincipales > 1 then raise exception 'MULTIPLES_DIRECCIONES_PRINCIPALES'; end if;
267:     (select 1 from public.zonas_entrega e where e.id = z.id and e.activa)) then raise exception 'ZONA_INVALIDA'; end if;
312:   if p_posible_pedido_id is not null then
314:     v_asociacion := public.asociar_cliente_posible_pedido(p_posible_pedido_id,
315:       p_version_posible_pedido, p_clave_operacion, v_id);
331: alter function public.obtener_cliente_administrativo(uuid) owner to postgres;
332: alter function public.guardar_cliente_administrativo(uuid,uuid,text,jsonb,jsonb,uuid,bigint) owner to postgres;

## supabase/migrations/20261105020000_crear_pedido_administrativo_transaccional.sql

3: -- 20261105030000_totales_linea_pedido_administrativo.sql.
4: -- Contrato p_pedido: PedidoBorrador (camelCase), sin campos opcionales ni
11: alter table public.pedidos add column nombre_ubicacion_snapshot text
17: create table public.creaciones_pedidos_administrativas (
19:   administrador_id uuid not null references auth.users(id) on delete restrict,
20:   pedido_id uuid not null unique references public.pedidos(id) on delete restrict,
26: create index creaciones_pedidos_administrativas_actor_idx
27:   on public.creaciones_pedidos_administrativas(administrador_id);
29: create table public.auditoria_precios_pedido_administrativo (
30:   item_pedido_id uuid primary key references public.items_pedido(id) on delete restrict,
34:   administrador_id uuid not null references auth.users(id) on delete restrict,
38: create index auditoria_precios_pedido_administrativo_actor_idx
39:   on public.auditoria_precios_pedido_administrativo(administrador_id);
41: alter table public.creaciones_pedidos_administrativas owner to postgres;
42: alter table public.auditoria_precios_pedido_administrativo owner to postgres;
45: alter table public.creaciones_pedidos_administrativas enable row level security;
46: alter table public.auditoria_precios_pedido_administrativo enable row level security;
47: revoke all on public.creaciones_pedidos_administrativas,
48:   public.auditoria_precios_pedido_administrativo from public, anon, authenticated, service_role;
49: grant select on public.creaciones_pedidos_administrativas,
50:   public.auditoria_precios_pedido_administrativo to authenticated;
51: create policy creaciones_pedidos_administrativas_lectura_admin
52:   on public.creaciones_pedidos_administrativas for select to authenticated
54: create policy auditoria_precios_pedido_administrativo_lectura_admin
55:   on public.auditoria_precios_pedido_administrativo for select to authenticated
58: create function public.proteger_registro_creacion_pedido_administrativo()
61:   raise exception 'REGISTRO_ADMINISTRATIVO_INMUTABLE' using errcode = '42501';
64: alter function public.proteger_registro_creacion_pedido_administrativo() owner to postgres;
65: revoke all on function public.proteger_registro_creacion_pedido_administrativo()
67: create trigger proteger_creacion_pedido_administrativo before update or delete
68:   on public.creaciones_pedidos_administrativas for each row
69:   execute function public.proteger_registro_creacion_pedido_administrativo();
70: create trigger proteger_auditoria_precio_pedido_administrativo before update or delete
71:   on public.auditoria_precios_pedido_administrativo for each row
72:   execute function public.proteger_registro_creacion_pedido_administrativo();
74: create function public.crear_pedido_administrativo(
76:   p_pedido jsonb
82:   v_operacion public.creaciones_pedidos_administrativas%rowtype;
87:   v_pedido public.pedidos%rowtype;
100:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
102:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
103:   if jsonb_typeof(p_pedido) is distinct from 'object' then raise exception 'PEDIDO_INVALIDO'; end if;
104:   if octet_length(p_pedido::text) > 262144 then raise exception 'LIMITE_SOLICITUD'; end if;
109:   v_huella := sha256(convert_to(p_pedido::text, 'UTF8'));
111:     'crear_pedido_administrativo:' || p_clave_idempotencia::text, 0));
112:   select o.* into v_operacion from public.creaciones_pedidos_administrativas o
116:       or v_operacion.huella <> v_huella or v_operacion.solicitud is distinct from p_pedido then
117:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO' using errcode = '23505';
123:   if (p_pedido - array['clienteId','ubicacionId','lineas','subtotal','fechaEntrega','metodosPagoPrevistos']) <> '{}'::jsonb
124:     or not (p_pedido ?& array['clienteId','ubicacionId','lineas','subtotal','fechaEntrega','metodosPagoPrevistos']) then
125:     raise exception 'CAMPOS_PEDIDO_INVALIDOS';
127:   if jsonb_typeof(p_pedido -> 'clienteId') is distinct from 'string'
128:     or jsonb_typeof(p_pedido -> 'ubicacionId') is distinct from 'string'
129:     or jsonb_typeof(p_pedido -> 'fechaEntrega') is distinct from 'string'
130:     or jsonb_typeof(p_pedido -> 'subtotal') is distinct from 'number'
131:     or jsonb_typeof(p_pedido -> 'lineas') is distinct from 'array'
132:     or jsonb_typeof(p_pedido -> 'metodosPagoPrevistos') is distinct from 'array' then
133:     raise exception 'TIPOS_PEDIDO_INVALIDOS';
135:   if (p_pedido ->> 'clienteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
136:     or (p_pedido ->> 'ubicacionId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
137:     or (p_pedido ->> 'fechaEntrega') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
138:     raise exception 'REFERENCIAS_PEDIDO_INVALIDAS';
140:   v_cliente_id := (p_pedido ->> 'clienteId')::uuid;
141:   v_ubicacion_id := (p_pedido ->> 'ubicacionId')::uuid;
142:   v_fecha := (p_pedido ->> 'fechaEntrega')::date;
143:   if jsonb_array_length(p_pedido -> 'lineas') not between 1 and 100 then raise exception 'LIMITE_LINEAS'; end if;
144:   if jsonb_array_length(p_pedido -> 'metodosPagoPrevistos') not between 1 and 3
145:     or exists (select 1 from jsonb_array_elements(p_pedido -> 'metodosPagoPrevistos') m
146:       where jsonb_typeof(m) <> 'string') then raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS'; end if;
148:     from jsonb_array_elements_text(p_pedido -> 'metodosPagoPrevistos') m;
151:     raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
159:   if not found or not v_cliente.activo then raise exception 'CLIENTE_INVALIDO'; end if;
162:   if not found or not v_direccion.activa then raise exception 'UBICACION_COMERCIAL_INVALIDA'; end if;
165:     raise exception 'UBICACION_SIN_COORDENADAS';
170:   if v_nombre_ubicacion is null then raise exception 'NOMBRE_UBICACION_REQUERIDO'; end if;
174:     if not found then raise exception 'ZONA_INVALIDA'; end if;
181:     (select (l ->> 'productoId')::uuid from jsonb_array_elements(p_pedido -> 'lineas') l)
183:   for v_linea in select value from jsonb_array_elements(p_pedido -> 'lineas')
186:       or (v_linea - array['productoId','presentacionId','cantidad','precioReferencia','precioAplicado','motivoAjuste','total']) <> '{}'::jsonb
187:       or not (v_linea ?& array['productoId','presentacionId','cantidad','precioReferencia','precioAplicado','motivoAjuste','total']) then
188:       raise exception 'CAMPOS_LINEA_INVALIDOS';
193:         or (v_k = 'motivoAjuste' and v_tipo not in ('string','null')) then
194:         raise exception 'TIPOS_LINEA_INVALIDOS';
199:     if v_producto_id is null or v_presentacion_id is null then raise exception 'REFERENCIAS_LINEA_INVALIDAS'; end if;
200:     if v_presentacion_id = any(v_ids) then raise exception 'PRESENTACION_DUPLICADA'; end if;
205:     v_motivo := nullif(btrim(v_linea ->> 'motivoAjuste'), '');
211:       or length(coalesce(v_linea ->> 'motivoAjuste','')) > 1000 then raise exception 'CANTIDAD_O_PRECIO_INVALIDO'; end if;
212:     if v_precio <> v_referencia and v_motivo is null then raise exception 'MOTIVO_PRECIO_REQUERIDO'; end if;
213:     if v_precio = v_referencia and v_linea -> 'motivoAjuste' <> 'null'::jsonb then raise exception 'MOTIVO_SIN_AJUSTE'; end if;
215:     if not found or not v_producto.activo or not v_producto.disponible then raise exception 'PRODUCTO_NO_DISPONIBLE'; end if;
218:       raise exception 'PRESENTACION_NO_DISPONIBLE';
221:     if not found then raise exception 'CATEGORIA_NO_DISPONIBLE'; end if;
222:     if v_presentacion.precio_final <> v_referencia then raise exception 'PRECIO_REFERENCIA_DESACTUALIZADO' using errcode = '40001'; end if;
223:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad,
224:       v_presentacion.nombre, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
226:     if v_total_linea > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
227:     if (v_linea ->> 'total')::numeric <> v_total_linea then raise exception 'TOTAL_LINEA_INCORRECTO'; end if;
229:     if v_subtotal > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
238:       -- ni neto autorizado que PedidoBorrador no contiene.
242:   if (p_pedido ->> 'subtotal')::numeric <> v_subtotal then raise exception 'SUBTOTAL_INCORRECTO'; end if;
252:     raise exception 'FECHA_ENTREGA_NO_DISPONIBLE';
255:   insert into public.pedidos (cliente_id, canal_origen, estado,
261:     fecha_entrega, metodos_pago_previstos)
268:     v_subtotal::bigint + v_despacho, v_fecha, v_metodos) returning * into v_pedido;
270:     insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id,
273:     values (v_pedido.id, (v_linea ->> 'producto')::uuid, (v_linea ->> 'presentacion')::uuid,
279:       insert into public.auditoria_precios_pedido_administrativo
280:         (item_pedido_id, precio_referencia, precio_aplicado, motivo, administrador_id)
285:   -- Las vistas vigentes generan el único cargo desde pedidos; no insertar
286:   -- ajustes, pagos ni aplicaciones. Los triggers existentes generan historial.
287:   v_resultado := jsonb_build_object('pedido_id', v_pedido.id, 'numero_pedido', v_pedido.numero_pedido,
288:     'estado', v_pedido.estado, 'subtotal', v_pedido.subtotal, 'costo_entrega', v_pedido.costo_entrega,
289:     'descuento', v_pedido.descuento, 'total', v_pedido.total);
290:   insert into public.creaciones_pedidos_administrativas
291:     (clave_idempotencia, administrador_id, pedido_id, huella, solicitud, resultado)
292:   values (p_clave_idempotencia, v_actor, v_pedido.id, v_huella, p_pedido, v_resultado);
296: alter function public.crear_pedido_administrativo(uuid,jsonb) owner to postgres;
297: revoke all on function public.crear_pedido_administrativo(uuid,jsonb)
299: grant execute on function public.crear_pedido_administrativo(uuid,jsonb) to authenticated;

## supabase/migrations/20261105030000_totales_linea_pedido_administrativo.sql

8: alter table public.items_pedido add column total_final_administrativo bigint
11: comment on column public.items_pedido.total_final_administrativo is
14: create or replace function public.validar_total_linea_pedido()
19:     raise exception 'TOTAL_LINEA_INCORRECTO';
25: drop trigger validar_total_linea_pedido_antes_de_guardar on public.items_pedido;
26: create trigger validar_total_linea_pedido_antes_de_guardar
28: on public.items_pedido for each row execute function public.validar_total_linea_pedido();
31: -- unitarios históricos conservan significado; nuevos ajustes usan totales.
32: alter table public.auditoria_precios_pedido_administrativo
44: create or replace function public.crear_pedido_administrativo(
46:   p_pedido jsonb
52:   v_operacion public.creaciones_pedidos_administrativas%rowtype;
57:   v_pedido public.pedidos%rowtype;
70:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
72:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
73:   if jsonb_typeof(p_pedido) is distinct from 'object' then raise exception 'PEDIDO_INVALIDO'; end if;
74:   if octet_length(p_pedido::text) > 262144 then raise exception 'LIMITE_SOLICITUD'; end if;
79:   v_huella := sha256(convert_to(p_pedido::text, 'UTF8'));
81:     'crear_pedido_administrativo:' || p_clave_idempotencia::text, 0));
82:   select o.* into v_operacion from public.creaciones_pedidos_administrativas o
86:       or v_operacion.huella <> v_huella or v_operacion.solicitud is distinct from p_pedido then
87:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO' using errcode = '23505';
93:   if (p_pedido - array['clienteId','ubicacionId','lineas','subtotal','fechaEntrega','metodosPagoPrevistos']) <> '{}'::jsonb
94:     or not (p_pedido ?& array['clienteId','ubicacionId','lineas','subtotal','fechaEntrega','metodosPagoPrevistos']) then
95:     raise exception 'CAMPOS_PEDIDO_INVALIDOS';
97:   if jsonb_typeof(p_pedido -> 'clienteId') is distinct from 'string'
98:     or jsonb_typeof(p_pedido -> 'ubicacionId') is distinct from 'string'
99:     or jsonb_typeof(p_pedido -> 'fechaEntrega') is distinct from 'string'
100:     or jsonb_typeof(p_pedido -> 'subtotal') is distinct from 'number'
101:     or jsonb_typeof(p_pedido -> 'lineas') is distinct from 'array'
102:     or jsonb_typeof(p_pedido -> 'metodosPagoPrevistos') is distinct from 'array' then
103:     raise exception 'TIPOS_PEDIDO_INVALIDOS';
105:   if (p_pedido ->> 'clienteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
106:     or (p_pedido ->> 'ubicacionId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
107:     or (p_pedido ->> 'fechaEntrega') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
108:     raise exception 'REFERENCIAS_PEDIDO_INVALIDAS';
110:   v_cliente_id := (p_pedido ->> 'clienteId')::uuid;
111:   v_ubicacion_id := (p_pedido ->> 'ubicacionId')::uuid;
112:   v_fecha := (p_pedido ->> 'fechaEntrega')::date;
113:   if jsonb_array_length(p_pedido -> 'lineas') not between 1 and 100 then raise exception 'LIMITE_LINEAS'; end if;
114:   if jsonb_array_length(p_pedido -> 'metodosPagoPrevistos') not between 1 and 3
115:     or exists (select 1 from jsonb_array_elements(p_pedido -> 'metodosPagoPrevistos') m
116:       where jsonb_typeof(m) <> 'string') then raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS'; end if;
118:     from jsonb_array_elements_text(p_pedido -> 'metodosPagoPrevistos') m;
121:     raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
129:   if not found or not v_cliente.activo then raise exception 'CLIENTE_INVALIDO'; end if;
132:   if not found or not v_direccion.activa then raise exception 'UBICACION_COMERCIAL_INVALIDA'; end if;
135:     raise exception 'UBICACION_SIN_COORDENADAS';
140:   if v_nombre_ubicacion is null then raise exception 'NOMBRE_UBICACION_REQUERIDO'; end if;
144:     if not found then raise exception 'ZONA_INVALIDA'; end if;
151:     (select (l ->> 'productoId')::uuid from jsonb_array_elements(p_pedido -> 'lineas') l)
153:   for v_linea in select value from jsonb_array_elements(p_pedido -> 'lineas')
156:       or (v_linea - array['productoId','presentacionId','cantidad','precioReferencia','totalFinal','motivoAjuste','totalOriginal']) <> '{}'::jsonb
157:       or not (v_linea ?& array['productoId','presentacionId','cantidad','precioReferencia','totalFinal','motivoAjuste','totalOriginal']) then
158:       raise exception 'CAMPOS_LINEA_INVALIDOS';
163:         or (v_k = 'motivoAjuste' and v_tipo not in ('string','null')) then
164:         raise exception 'TIPOS_LINEA_INVALIDOS';
169:     if v_producto_id is null or v_presentacion_id is null then raise exception 'REFERENCIAS_LINEA_INVALIDAS'; end if;
170:     if v_presentacion_id = any(v_ids) then raise exception 'PRESENTACION_DUPLICADA'; end if;
175:     v_motivo := nullif(btrim(v_linea ->> 'motivoAjuste'), '');
181:       or length(coalesce(v_linea ->> 'motivoAjuste','')) > 1000 then raise exception 'CANTIDAD_O_PRECIO_INVALIDO'; end if;
183:     if not found or not v_producto.activo or not v_producto.disponible then raise exception 'PRODUCTO_NO_DISPONIBLE'; end if;
186:       raise exception 'PRESENTACION_NO_DISPONIBLE';
189:     if not found then raise exception 'CATEGORIA_NO_DISPONIBLE'; end if;
190:     if v_presentacion.precio_final <> v_referencia then raise exception 'PRECIO_REFERENCIA_DESACTUALIZADO' using errcode = '40001'; end if;
191:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad,
192:       v_presentacion.nombre, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
197:     if v_total_original > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
198:     if (v_linea ->> 'totalOriginal')::numeric <> v_total_original then raise exception 'TOTAL_ORIGINAL_INCORRECTO'; end if;
199:     if v_total_linea <> v_total_original and v_motivo is null then raise exception 'MOTIVO_PRECIO_REQUERIDO'; end if;
200:     if v_total_linea = v_total_original and v_linea -> 'motivoAjuste' <> 'null'::jsonb then raise exception 'MOTIVO_SIN_AJUSTE'; end if;
201:     if v_total_linea > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
203:     if v_subtotal > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
212:       -- ni neto autorizado que PedidoBorrador no contiene.
216:   if (p_pedido ->> 'subtotal')::numeric <> v_subtotal then raise exception 'SUBTOTAL_INCORRECTO'; end if;
226:     raise exception 'FECHA_ENTREGA_NO_DISPONIBLE';
229:   insert into public.pedidos (cliente_id, canal_origen, estado,
235:     fecha_entrega, metodos_pago_previstos)
242:     v_subtotal::bigint + v_despacho, v_fecha, v_metodos) returning * into v_pedido;
244:     insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id,
247:     values (v_pedido.id, (v_linea ->> 'producto')::uuid, (v_linea ->> 'presentacion')::uuid,
255:       insert into public.auditoria_precios_pedido_administrativo
256:         (item_pedido_id, precio_referencia, precio_aplicado, total_original, total_aplicado, motivo, administrador_id)
261:   -- Las vistas vigentes generan el único cargo desde pedidos; no insertar
262:   -- ajustes, pagos ni aplicaciones. Los triggers existentes generan historial.
263:   v_resultado := jsonb_build_object('pedido_id', v_pedido.id, 'numero_pedido', v_pedido.numero_pedido,
264:     'estado', v_pedido.estado, 'subtotal', v_pedido.subtotal, 'costo_entrega', v_pedido.costo_entrega,
265:     'descuento', v_pedido.descuento, 'total', v_pedido.total);
266:   insert into public.creaciones_pedidos_administrativas
267:     (clave_idempotencia, administrador_id, pedido_id, huella, solicitud, resultado)
268:   values (p_clave_idempotencia, v_actor, v_pedido.id, v_huella, p_pedido, v_resultado);
272: alter function public.crear_pedido_administrativo(uuid,jsonb) owner to postgres;
273: revoke all on function public.crear_pedido_administrativo(uuid,jsonb)
275: grant execute on function public.crear_pedido_administrativo(uuid,jsonb) to authenticated;
279: create or replace function public.finalizar_preparacion_pedido_administrativo(p_pedido_id uuid)
281:   pedido_id uuid,
282:   estado public.estado_pedido,
292:   v_pedido public.pedidos%rowtype;
293:   v_item public.items_pedido%rowtype;
301:   v_aplicacion public.aplicaciones_pago%rowtype;
306:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
307:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
308:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
310:   if v_pedido.estado = 'listo_despacho'
311:     and v_pedido.preparacion_estado in ('completa', 'incompleta')
312:     and v_pedido.preparacion_finalizada_en is not null
313:     and v_pedido.subtotal_final is not null
314:     and v_pedido.total_final is not null then
315:     return query select v_pedido.id, v_pedido.estado, v_pedido.preparacion_estado, v_pedido.subtotal_final, v_pedido.total_final;
318:   if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
320:   perform 1 from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id for update;
321:   perform 1 from public.preparacion_items_pedido pi where pi.pedido_id = v_pedido.id order by pi.item_pedido_id for update;
323:   for v_item in select * from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id loop
324:     select pi.cantidad_preparada into v_preparada from public.preparacion_items_pedido pi where pi.item_pedido_id = v_item.id;
326:     if v_preparada < 0 or v_preparada > v_item.cantidad then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
331:     if v_modo in ('presentacion_cerrada', 'unidad') and v_preparada <> trunc(v_preparada) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
334:       -- Fallar antes de modificar totales o aplicaciones de pago.
336:         raise exception 'TOTAL_ADMINISTRATIVO_REQUIERE_PREPARACION_COMPLETA';
345:   v_total := v_subtotal + v_pedido.costo_entrega - v_pedido.descuento;
346:   if v_total < 0 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
347:   if v_completa and (v_subtotal <> v_pedido.subtotal or v_total <> v_pedido.total) then raise exception 'PREPARACION_COMPLETA_INCONSISTENTE'; end if;
349:   -- El nuevo límite debe estar visible para el trigger al recrear aplicaciones activas.
350:   update public.pedidos set subtotal_final = v_subtotal, total_final = v_total where id = v_pedido.id;
352:   perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc for update;
353:   perform 1 from public.pagos p where p.id in (select a.pago_id from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa) order by p.id for update;
354:   select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
357:   for v_aplicacion in select * from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc loop
359:     v_conservar := greatest(v_aplicacion.monto_aplicado - v_exceso, 0);
360:     update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = 'Reajuste por preparación incompleta' where id = v_aplicacion.id;
362:       insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_aplicacion.pago_id, v_pedido.id, v_conservar);
364:     v_exceso := greatest(v_exceso - v_aplicacion.monto_aplicado, 0);
367:   select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
368:   if v_aplicado > v_total then raise exception 'APLICACIONES_SUPERAN_TOTAL_FINAL'; end if;
370:   update public.pedidos
373:   where id = v_pedido.id;
375:   update public.historial_estados_pedido set observacion = v_observacion
376:   where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'listo_despacho' order by h.fecha_creacion desc, h.id desc limit 1);
377:   return query select v_pedido.id, 'listo_despacho'::public.estado_pedido, case when v_completa then 'completa' else 'incompleta' end, v_subtotal, v_total;
381: alter function public.finalizar_preparacion_pedido_administrativo(uuid) owner to postgres;
382: revoke all on function public.finalizar_preparacion_pedido_administrativo(uuid) from public, anon, authenticated;
383: grant execute on function public.finalizar_preparacion_pedido_administrativo(uuid) to authenticated;

## supabase/migrations/20261106010000_preparar_regimen_contable_entrega.sql

8: alter table public.pedidos
10:   add constraint pedidos_regimen_contable_valido
13:   -- No se reescriben total, total_final, pagos ni aplicaciones.
19:   add constraint pedidos_venta_definitiva_inactiva
22: comment on column public.pedidos.regimen_contable is
23:   'Clasificación inmutable: legado para pedidos previos/fallback; entrega_v1 para nuevas creaciones oficiales. No activa por sí sola otra contabilidad.';
24: comment on column public.pedidos.importe_operativo is
26: comment on column public.pedidos.venta_definitiva_snapshot is
28: comment on column public.pedidos.venta_reconocida_en is
31: create function public.proteger_regimen_contable_pedido()
35:     raise exception 'REGIMEN_CONTABLE_INMUTABLE';
40: alter function public.proteger_regimen_contable_pedido() owner to postgres;
41: revoke all on function public.proteger_regimen_contable_pedido()
43: create trigger proteger_regimen_contable_pedido_antes_de_actualizar
44: before update of regimen_contable on public.pedidos
45: for each row execute function public.proteger_regimen_contable_pedido();
50: create or replace function public.crear_pedido_desde_carrito(
57:   p_metodos_pago_previstos text[]
60:   pedido_id uuid,
61:   numero_pedido text,
62:   estado public.estado_pedido,
76:   v_pedido public.pedidos%rowtype;
77:   v_pedido_existente public.pedidos%rowtype;
90:   v_metodos_pago_previstos text[];
92:   if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
93:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
94:   if p_metodos_pago_previstos is null or cardinality(p_metodos_pago_previstos) = 0 then
95:     raise exception 'METODOS_PAGO_PREVISTOS_REQUERIDOS';
97:   if array_position(p_metodos_pago_previstos, null) is not null
98:     or not (p_metodos_pago_previstos <@ array['efectivo', 'transferencia', 'tarjeta']::text[])
99:     or cardinality(p_metodos_pago_previstos) <>
100:       (case when 'efectivo' = any(p_metodos_pago_previstos) then 1 else 0 end
101:       + case when 'transferencia' = any(p_metodos_pago_previstos) then 1 else 0 end
102:       + case when 'tarjeta' = any(p_metodos_pago_previstos) then 1 else 0 end) then
103:     raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
106:   into v_metodos_pago_previstos
108:   where metodo = any(p_metodos_pago_previstos);
112:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
113:   if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
115:   select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
117:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
118:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
122:   if p_fecha_entrega is null then raise exception 'FECHA_ENTREGA_REQUERIDA'; end if;
124:   if p_fecha_entrega < v_hoy_local or p_fecha_entrega > v_hoy_local + 14 then raise exception 'FECHA_ENTREGA_INVALIDA'; end if;
125:   if not public.fecha_entrega_disponible(p_fecha_entrega) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
126:   if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
127:   if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;
130:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
131:   if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
133:   if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;
136:   insert into public.pedidos (
140:     subtotal, costo_entrega, descuento, total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos
145:     0, 0, 0, 0, v_observacion_normalizada, p_fecha_entrega, p_clave_idempotencia, v_metodos_pago_previstos
146:   ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;
148:   if v_pedido.id is null then
149:     select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
150:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
151:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
156:     if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
158:     if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
159:     if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
162:     if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
167:     if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
168:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
170:     insert into public.items_pedido (pedido_id,producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_neto_unitario_snapshot,precio_final_unitario_snapshot,total_linea,observacion_cliente,modo_cantidad_snapshot)
171:     values (v_pedido.id,v_presentacion.producto_id,v_presentacion.id,v_presentacion.nombre_producto,v_presentacion.nombre_presentacion,v_presentacion.unidad,v_cantidad,v_presentacion.precio_neto,v_presentacion.precio_final,round(v_cantidad * v_presentacion.precio_final)::bigint,null,v_modo_cantidad_snapshot);
174:   select coalesce(sum(i.total_linea), 0)::bigint into v_subtotal from public.items_pedido i where i.pedido_id = v_pedido.id;
176:   update public.pedidos set subtotal = v_subtotal, costo_entrega = v_costo_entrega, descuento = 0, total = v_subtotal + v_costo_entrega where id = v_pedido.id returning * into v_pedido;
177:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;
181: create or replace function public.convertir_posible_pedido_administrativo(
183:   p_direccion_id uuid, p_fecha_efectiva date, p_metodos_pago text[]
187:   v_p public.posibles_pedidos%rowtype; v_cliente public.clientes%rowtype;
189:   v_i public.items_posible_pedido%rowtype; v_actual jsonb; v_t record;
190:   v_huella bytea; v_reintento jsonb; v_metodos text[]; v_pedido_id uuid := gen_random_uuid();
194:   -- Recuperación segura incluso con otra clave/versión: no hay segundo pedido.
196:   if p_metodos_pago is null or cardinality(p_metodos_pago) not between 1 and 3
197:     or array_ndims(p_metodos_pago) <> 1 or array_position(p_metodos_pago, null) is not null
198:     or not (p_metodos_pago <@ array['efectivo','transferencia','tarjeta']::text[])
199:     or (select count(distinct m) from unnest(p_metodos_pago) m) <> cardinality(p_metodos_pago) then
200:     raise exception 'METODOS_PAGO_INVALIDOS';
203:     from unnest(array['efectivo','transferencia','tarjeta']::text[]) with ordinality x(m,n) where m = any(p_metodos_pago);
210:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
213:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
216:     raise exception 'DIRECCION_SIN_UBICACION'; end if;
218:   if not found then raise exception 'ZONA_INVALIDA'; end if;
220:   -- Se valida con catálogo, pero NO se usan sus precios para el pedido.
221:   for v_i in select i.* from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo order by i.id for update loop
227:       raise exception 'PRESENTACION_MODIFICADA_REQUIERE_REVISION';
233:     or not public.fecha_entrega_disponible(p_fecha_efectiva, clock_timestamp()) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
234:   insert into public.pedidos (regimen_contable, id, cliente_id, canal_origen, estado, nombre_cliente_snapshot,
239:     total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos)
240:   values ('entrega_v1', v_pedido_id, v_cliente.id, 'whatsapp', 'recibido', v_cliente.nombre,
248:   update public.posibles_pedidos set estado = 'convertido', pedido_oficial_id = v_pedido_id,
251:   for v_i in select i.* from public.items_posible_pedido i where i.posible_pedido_id = p_id and i.activo order by i.orden loop
252:     insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id,
255:     values (v_pedido_id, v_i.producto_id, v_i.presentacion_producto_id,
260:     insert into public.vinculos_items_posible_pedido values (v_i.id, v_item_id);
263:     jsonb_build_object('pedido_id', v_pedido_id, 'direccion_id', p_direccion_id,
264:       'fecha_efectiva', p_fecha_efectiva, 'metodos_pago', v_metodos));
268: create or replace function public.crear_pedido_administrativo(
270:   p_pedido jsonb
276:   v_operacion public.creaciones_pedidos_administrativas%rowtype;
281:   v_pedido public.pedidos%rowtype;
294:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
296:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
297:   if jsonb_typeof(p_pedido) is distinct from 'object' then raise exception 'PEDIDO_INVALIDO'; end if;
298:   if octet_length(p_pedido::text) > 262144 then raise exception 'LIMITE_SOLICITUD'; end if;
303:   v_huella := sha256(convert_to(p_pedido::text, 'UTF8'));
305:     'crear_pedido_administrativo:' || p_clave_idempotencia::text, 0));
306:   select o.* into v_operacion from public.creaciones_pedidos_administrativas o
310:       or v_operacion.huella <> v_huella or v_operacion.solicitud is distinct from p_pedido then
311:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO' using errcode = '23505';
317:   if (p_pedido - array['clienteId','ubicacionId','lineas','subtotal','fechaEntrega','metodosPagoPrevistos']) <> '{}'::jsonb
318:     or not (p_pedido ?& array['clienteId','ubicacionId','lineas','subtotal','fechaEntrega','metodosPagoPrevistos']) then
319:     raise exception 'CAMPOS_PEDIDO_INVALIDOS';
321:   if jsonb_typeof(p_pedido -> 'clienteId') is distinct from 'string'
322:     or jsonb_typeof(p_pedido -> 'ubicacionId') is distinct from 'string'
323:     or jsonb_typeof(p_pedido -> 'fechaEntrega') is distinct from 'string'
324:     or jsonb_typeof(p_pedido -> 'subtotal') is distinct from 'number'
325:     or jsonb_typeof(p_pedido -> 'lineas') is distinct from 'array'
326:     or jsonb_typeof(p_pedido -> 'metodosPagoPrevistos') is distinct from 'array' then
327:     raise exception 'TIPOS_PEDIDO_INVALIDOS';
329:   if (p_pedido ->> 'clienteId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
330:     or (p_pedido ->> 'ubicacionId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
331:     or (p_pedido ->> 'fechaEntrega') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
332:     raise exception 'REFERENCIAS_PEDIDO_INVALIDAS';
334:   v_cliente_id := (p_pedido ->> 'clienteId')::uuid;
335:   v_ubicacion_id := (p_pedido ->> 'ubicacionId')::uuid;
336:   v_fecha := (p_pedido ->> 'fechaEntrega')::date;
337:   if jsonb_array_length(p_pedido -> 'lineas') not between 1 and 100 then raise exception 'LIMITE_LINEAS'; end if;
338:   if jsonb_array_length(p_pedido -> 'metodosPagoPrevistos') not between 1 and 3
339:     or exists (select 1 from jsonb_array_elements(p_pedido -> 'metodosPagoPrevistos') m
340:       where jsonb_typeof(m) <> 'string') then raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS'; end if;
342:     from jsonb_array_elements_text(p_pedido -> 'metodosPagoPrevistos') m;
345:     raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
353:   if not found or not v_cliente.activo then raise exception 'CLIENTE_INVALIDO'; end if;
356:   if not found or not v_direccion.activa then raise exception 'UBICACION_COMERCIAL_INVALIDA'; end if;
359:     raise exception 'UBICACION_SIN_COORDENADAS';
364:   if v_nombre_ubicacion is null then raise exception 'NOMBRE_UBICACION_REQUERIDO'; end if;
368:     if not found then raise exception 'ZONA_INVALIDA'; end if;
375:     (select (l ->> 'productoId')::uuid from jsonb_array_elements(p_pedido -> 'lineas') l)
377:   for v_linea in select value from jsonb_array_elements(p_pedido -> 'lineas')
380:       or (v_linea - array['productoId','presentacionId','cantidad','precioReferencia','totalFinal','motivoAjuste','totalOriginal']) <> '{}'::jsonb
381:       or not (v_linea ?& array['productoId','presentacionId','cantidad','precioReferencia','totalFinal','motivoAjuste','totalOriginal']) then
382:       raise exception 'CAMPOS_LINEA_INVALIDOS';
387:         or (v_k = 'motivoAjuste' and v_tipo not in ('string','null')) then
388:         raise exception 'TIPOS_LINEA_INVALIDOS';
393:     if v_producto_id is null or v_presentacion_id is null then raise exception 'REFERENCIAS_LINEA_INVALIDAS'; end if;
394:     if v_presentacion_id = any(v_ids) then raise exception 'PRESENTACION_DUPLICADA'; end if;
399:     v_motivo := nullif(btrim(v_linea ->> 'motivoAjuste'), '');
405:       or length(coalesce(v_linea ->> 'motivoAjuste','')) > 1000 then raise exception 'CANTIDAD_O_PRECIO_INVALIDO'; end if;
407:     if not found or not v_producto.activo or not v_producto.disponible then raise exception 'PRODUCTO_NO_DISPONIBLE'; end if;
410:       raise exception 'PRESENTACION_NO_DISPONIBLE';
413:     if not found then raise exception 'CATEGORIA_NO_DISPONIBLE'; end if;
414:     if v_presentacion.precio_final <> v_referencia then raise exception 'PRECIO_REFERENCIA_DESACTUALIZADO' using errcode = '40001'; end if;
415:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad,
416:       v_presentacion.nombre, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
421:     if v_total_original > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
422:     if (v_linea ->> 'totalOriginal')::numeric <> v_total_original then raise exception 'TOTAL_ORIGINAL_INCORRECTO'; end if;
423:     if v_total_linea <> v_total_original and v_motivo is null then raise exception 'MOTIVO_PRECIO_REQUERIDO'; end if;
424:     if v_total_linea = v_total_original and v_linea -> 'motivoAjuste' <> 'null'::jsonb then raise exception 'MOTIVO_SIN_AJUSTE'; end if;
425:     if v_total_linea > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
427:     if v_subtotal > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
436:       -- ni neto autorizado que PedidoBorrador no contiene.
440:   if (p_pedido ->> 'subtotal')::numeric <> v_subtotal then raise exception 'SUBTOTAL_INCORRECTO'; end if;
450:     raise exception 'FECHA_ENTREGA_NO_DISPONIBLE';
453:   insert into public.pedidos (regimen_contable, cliente_id, canal_origen, estado,
459:     fecha_entrega, metodos_pago_previstos)
466:     v_subtotal::bigint + v_despacho, v_fecha, v_metodos) returning * into v_pedido;
468:     insert into public.items_pedido (pedido_id, producto_id, presentacion_producto_id,
471:     values (v_pedido.id, (v_linea ->> 'producto')::uuid, (v_linea ->> 'presentacion')::uuid,
479:       insert into public.auditoria_precios_pedido_administrativo
480:         (item_pedido_id, precio_referencia, precio_aplicado, total_original, total_aplicado, motivo, administrador_id)
485:   -- Las vistas vigentes generan el único cargo desde pedidos; no insertar
486:   -- ajustes, pagos ni aplicaciones. Los triggers existentes generan historial.
487:   v_resultado := jsonb_build_object('pedido_id', v_pedido.id, 'numero_pedido', v_pedido.numero_pedido,
488:     'estado', v_pedido.estado, 'subtotal', v_pedido.subtotal, 'costo_entrega', v_pedido.costo_entrega,
489:     'descuento', v_pedido.descuento, 'total', v_pedido.total);
490:   insert into public.creaciones_pedidos_administrativas
491:     (clave_idempotencia, administrador_id, pedido_id, huella, solicitud, resultado)
492:   values (p_clave_idempotencia, v_actor, v_pedido.id, v_huella, p_pedido, v_resultado);
497: -- No se reemplazan vistas, preparación, despacho, entrega ni beneficios.

## supabase/migrations/20261106030000_seguridad_auditoria_operativa.sql

10: create table operativo_privado.versiones_pedido (
11:   pedido_id uuid primary key,
14: create table operativo_privado.historial_operativo (
16:   pedido_id uuid not null,
17:   item_pedido_id uuid,
29:   unique (pedido_id, version),
30:   -- Una clave por pedido, entre actores y operaciones. No permite reutilizarla
31:   -- con otro actor/payload. No revela existencia de claves de otros pedidos.
32:   unique (pedido_id, clave_idempotencia),
36: alter table operativo_privado.versiones_pedido owner to postgres;
37: alter table operativo_privado.historial_operativo owner to postgres;
38: alter table operativo_privado.versiones_pedido enable row level security;
39: alter table operativo_privado.versiones_pedido force row level security;
40: alter table operativo_privado.historial_operativo enable row level security;
41: alter table operativo_privado.historial_operativo force row level security;
45: create function operativo_privado.impedir_mutacion_historial()
48:   raise exception 'AUDITORIA_OPERATIVA_INMUTABLE';
51: create trigger historial_operativo_inmutable
52: before update or delete on operativo_privado.historial_operativo
53: for each row execute function operativo_privado.impedir_mutacion_historial();
54: create trigger historial_operativo_no_truncable
55: before truncate on operativo_privado.historial_operativo
56: for each statement execute function operativo_privado.impedir_mutacion_historial();
62: create function operativo_privado.iniciar_operacion(
63:   p_pedido_id uuid, p_version_esperada bigint, p_clave uuid,
69:   v_evento operativo_privado.historial_operativo%rowtype;
75:     raise exception 'NO_AUTORIZADO';
77:   if p_pedido_id is null or p_clave is null or p_version_esperada is null
81:     raise exception 'OPERACION_INVALIDA';
83:   -- Lock común por pedido, incluso cuando todavía no hay versión privada.
84:   perform 1 from public.pedidos p where p.id = p_pedido_id for update;
85:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
87:   select h.* into v_evento from operativo_privado.historial_operativo h
88:     where h.pedido_id = p_pedido_id and h.clave_idempotencia = p_clave;
94:       raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
100:   insert into operativo_privado.versiones_pedido (pedido_id) values (p_pedido_id)
101:     on conflict (pedido_id) do nothing;
102:   select v.version into v_version from operativo_privado.versiones_pedido v
103:     where v.pedido_id = p_pedido_id for update;
104:   if v_version <> p_version_esperada then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
109: create function operativo_privado.completar_operacion(
110:   p_pedido_id uuid, p_version_esperada bigint, p_clave uuid,
111:   p_operacion text, p_solicitud jsonb, p_item_pedido_id uuid,
119:   v_inicio := operativo_privado.iniciar_operacion(p_pedido_id, p_version_esperada,
126:     raise exception 'AUDITORIA_OPERATIVA_INVALIDA';
128:   if p_item_pedido_id is not null then
129:     perform 1 from public.items_pedido i
130:       where i.id = p_item_pedido_id and i.pedido_id = p_pedido_id for share;
131:     if not found then raise exception 'ITEM_PEDIDO_NO_CORRESPONDE_AL_PEDIDO'; end if;
133:   update operativo_privado.versiones_pedido v set version = v.version + 1
134:     where v.pedido_id = p_pedido_id and v.version = p_version_esperada
136:   if not found then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
137:   insert into operativo_privado.historial_operativo (
138:     pedido_id, item_pedido_id, operacion, actor_id, motivo, valores_anteriores,
140:   ) values (p_pedido_id, p_item_pedido_id, p_operacion, auth.uid(), p_motivo,
146: alter function operativo_privado.impedir_mutacion_historial() owner to postgres;
147: alter function operativo_privado.iniciar_operacion(uuid, bigint, uuid, text, jsonb) owner to postgres;
148: alter function operativo_privado.completar_operacion(uuid, bigint, uuid, text, jsonb, uuid, text, jsonb, jsonb, jsonb) owner to postgres;
152:   'Microintegración 3/8: sin exposición API, sin lectores ni escritores de aplicación. Uso futuro exclusivo desde RPC autorizadas de postgres.';
153: comment on table operativo_privado.historial_operativo is
155: comment on table operativo_privado.versiones_pedido is
156:   'Versión de operaciones participantes, NO versión global del pedido. Las escrituras legacy no la incrementan; no activar concurrencia global antes de migrarlas.';

## supabase/migrations/20261106040000_restringir_fecha_preparacion.sql

5: -- Auditoría local: la aplicación sólo lee estas tablas; todas sus mutaciones
12:   public.pedidos, public.items_pedido, public.preparacion_items_pedido
19: create or replace function public.marcar_pedido_preparando_administrativo(
20:   p_pedido_id uuid
28:   v_pedido public.pedidos%rowtype;
30:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
32:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
33:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
34:   if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
35:     raise exception 'PREPARACION_FECHA_NO_HABILITADA';
37:   if v_pedido.estado = 'preparando' then return v_pedido.id; end if;
38:   if v_pedido.estado <> 'confirmado' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
40:   update public.pedidos
43:   where id = v_pedido.id;
44:   return v_pedido.id;
48: create or replace function public.marcar_pedido_listo_despacho_administrativo(
49:   p_pedido_id uuid
57:   v_pedido public.pedidos%rowtype;
59:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
61:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
62:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
63:   if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
64:     raise exception 'PREPARACION_FECHA_NO_HABILITADA';
66:   if v_pedido.estado = 'listo_despacho' then return v_pedido.id; end if;
67:   if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
68:   if v_pedido.preparacion_estado = 'pendiente' then raise exception 'PREPARACION_PENDIENTE_DE_FINALIZACION'; end if;
70:   update public.pedidos set estado = 'listo_despacho' where id = v_pedido.id;
71:   return v_pedido.id;
75: create or replace function public.guardar_preparacion_item_pedido_administrativo(
76:   p_item_pedido_id uuid,
81:   pedido_id uuid,
82:   item_pedido_id uuid,
91:   v_pedido_id uuid;
92:   v_pedido public.pedidos%rowtype;
93:   v_item public.items_pedido%rowtype;
97:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
98:   if p_item_pedido_id is null then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
99:   if p_cantidad_preparada is null then raise exception 'CANTIDAD_PREPARADA_REQUERIDA'; end if;
100:   if p_cantidad_preparada < 0 then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
101:   if v_motivo is not null and char_length(v_motivo) > 400 then raise exception 'MOTIVO_DEMASIADO_LARGO'; end if;
103:   select i.pedido_id into v_pedido_id from public.items_pedido i where i.id = p_item_pedido_id;
104:   if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
106:   select * into v_pedido from public.pedidos p where p.id = v_pedido_id for update;
107:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
109:   select * into v_item from public.items_pedido i where i.id = p_item_pedido_id for update;
110:   if not found or v_item.pedido_id is distinct from v_pedido.id then raise exception 'ITEM_PEDIDO_NO_CORRESPONDE_AL_PEDIDO'; end if;
111:   perform 1 from public.preparacion_items_pedido pi where pi.item_pedido_id = v_item.id for update;
112:   if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
113:     raise exception 'PREPARACION_FECHA_NO_HABILITADA';
115:   if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
116:   if p_cantidad_preparada > v_item.cantidad then raise exception 'CANTIDAD_PREPARADA_SUPERA_SOLICITADA'; end if;
126:   if v_modo in ('presentacion_cerrada', 'unidad') and p_cantidad_preparada <> trunc(p_cantidad_preparada) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
128:   update public.pedidos set preparacion_estado = 'pendiente' where id = v_pedido.id and preparacion_estado is null;
131:     delete from public.preparacion_items_pedido where preparacion_items_pedido.item_pedido_id = v_item.id;
132:     return query select v_pedido.id, v_item.id, v_item.cantidad, false;
136:   insert into public.preparacion_items_pedido (pedido_id, item_pedido_id, cantidad_preparada, motivo_faltante, registrado_por)
137:   values (v_pedido.id, v_item.id, p_cantidad_preparada, v_motivo, auth.uid())
138:   on conflict on constraint preparacion_items_pedido_item_pedido_id_key do update
143:   return query select v_pedido.id, v_item.id, p_cantidad_preparada, true;
147: create or replace function public.finalizar_preparacion_pedido_administrativo(p_pedido_id uuid)
149:   pedido_id uuid,
150:   estado public.estado_pedido,
160:   v_pedido public.pedidos%rowtype;
161:   v_item public.items_pedido%rowtype;
169:   v_aplicacion public.aplicaciones_pago%rowtype;
174:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
175:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
176:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
178:   if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
179:     raise exception 'PREPARACION_FECHA_NO_HABILITADA';
182:   if v_pedido.estado = 'listo_despacho'
183:     and v_pedido.preparacion_estado in ('completa', 'incompleta')
184:     and v_pedido.preparacion_finalizada_en is not null
185:     and v_pedido.subtotal_final is not null
186:     and v_pedido.total_final is not null then
187:     return query select v_pedido.id, v_pedido.estado, v_pedido.preparacion_estado, v_pedido.subtotal_final, v_pedido.total_final;
190:   if v_pedido.estado <> 'preparando' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
192:   perform 1 from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id for update;
193:   perform 1 from public.preparacion_items_pedido pi where pi.pedido_id = v_pedido.id order by pi.item_pedido_id for update;
196:   perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc for update;
197:   perform 1 from public.pagos p where p.id in (select a.pago_id from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa) order by p.id for update;
198:   if v_pedido.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then
199:     raise exception 'PREPARACION_FECHA_NO_HABILITADA';
202:   for v_item in select * from public.items_pedido i where i.pedido_id = v_pedido.id order by i.id loop
203:     select pi.cantidad_preparada into v_preparada from public.preparacion_items_pedido pi where pi.item_pedido_id = v_item.id;
205:     if v_preparada < 0 or v_preparada > v_item.cantidad then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
210:     if v_modo in ('presentacion_cerrada', 'unidad') and v_preparada <> trunc(v_preparada) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
213:       -- Fallar antes de modificar totales o aplicaciones de pago.
215:         raise exception 'TOTAL_ADMINISTRATIVO_REQUIERE_PREPARACION_COMPLETA';
224:   v_total := v_subtotal + v_pedido.costo_entrega - v_pedido.descuento;
225:   if v_total < 0 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
226:   if v_completa and (v_subtotal <> v_pedido.subtotal or v_total <> v_pedido.total) then raise exception 'PREPARACION_COMPLETA_INCONSISTENTE'; end if;
228:   -- El nuevo límite debe estar visible para el trigger al recrear aplicaciones activas.
229:   update public.pedidos set subtotal_final = v_subtotal, total_final = v_total where id = v_pedido.id;
231:   select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
234:   for v_aplicacion in select * from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa order by a.fecha_creacion desc, a.id desc loop
236:     v_conservar := greatest(v_aplicacion.monto_aplicado - v_exceso, 0);
237:     update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = 'Reajuste por preparación incompleta' where id = v_aplicacion.id;
239:       insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_aplicacion.pago_id, v_pedido.id, v_conservar);
241:     v_exceso := greatest(v_exceso - v_aplicacion.monto_aplicado, 0);
244:   select coalesce(sum(a.monto_aplicado), 0)::bigint into v_aplicado from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa;
245:   if v_aplicado > v_total then raise exception 'APLICACIONES_SUPERAN_TOTAL_FINAL'; end if;
247:   update public.pedidos
250:   where id = v_pedido.id;
252:   update public.historial_estados_pedido set observacion = v_observacion
253:   where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'listo_despacho' order by h.fecha_creacion desc, h.id desc limit 1);
254:   return query select v_pedido.id, 'listo_despacho'::public.estado_pedido, case when v_completa then 'completa' else 'incompleta' end, v_subtotal, v_total;

## supabase/migrations/20261106050000_preparacion_explicita_productos.sql

3: alter table public.preparacion_items_pedido
8: alter table public.pedidos add column total_operativo_preparacion bigint check (total_operativo_preparacion >= 0);
11: alter table public.pedidos rename column importe_operativo to importe_operativo_legacy;
12: alter table public.pedidos add column importe_operativo bigint generated always as
14: comment on column public.pedidos.importe_operativo is 'Importe provisional de preparación; no venta, deuda ni límite de aplicaciones contables.';
16: -- Retirar rutas sin versión/idempotencia y finalización con prorrateo contable.
17: revoke execute on function public.guardar_preparacion_item_pedido_administrativo(uuid,numeric,text),
18:  public.finalizar_preparacion_pedido_administrativo(uuid),
19:  public.marcar_pedido_listo_despacho_administrativo(uuid)
22: create function public.leer_preparacion_explicita(p_pedido_id uuid)
25:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
26:  return jsonb_build_object('importe_operativo',(select importe_operativo from public.pedidos where id=p_pedido_id),'version',coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p_pedido_id),0),
27:  'historial',coalesce((select jsonb_agg(to_jsonb(h) - 'solicitud' - 'resultado' order by h.version desc) from operativo_privado.historial_operativo h where h.pedido_id=p_pedido_id and h.operacion in ('preparar_producto','cerrar_preparacion')),'[]'::jsonb));
30: create function public.confirmar_producto_preparado(
31:  p_item_pedido_id uuid, p_cantidad numeric, p_importe bigint,
35:  v_id uuid; v_p public.pedidos%rowtype; v_i public.items_pedido%rowtype;
38:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
39:  select pedido_id into v_id from public.items_pedido where id=p_item_pedido_id;
40:  if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
41:  v_solicitud:=jsonb_build_object('item',p_item_pedido_id,'cantidad',p_cantidad,'importe',p_importe,'motivo',p_motivo);
43:  select * into v_p from public.pedidos where id=v_id for update;
44:  if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
46:  if v_p.estado <> 'preparando' or v_p.preparacion_finalizada_en is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
47:  select * into v_i from public.items_pedido where id=p_item_pedido_id and pedido_id=v_id for update;
48:  if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
49:  if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
50:  if p_cantidad is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<0 or p_cantidad>=1000000000 or p_cantidad<>round(p_cantidad,3) then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
54:  if v_modo<>'kg_fraccionable' and p_cantidad<>trunc(p_cantidad) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
55:  if p_cantidad<>v_i.cantidad and (p_importe is null or p_importe<0 or p_importe>9007199254740991) then raise exception 'IMPORTE_MANUAL_REQUERIDO'; end if;
56:  if p_cantidad=v_i.cantidad and p_importe is not null and p_importe<>v_i.total_linea then raise exception 'IMPORTE_ORIGINAL_REQUERIDO'; end if;
58:  select to_jsonb(pi) into v_anterior from public.preparacion_items_pedido pi where item_pedido_id=v_i.id for update;
59:  if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
61:  insert into public.preparacion_items_pedido(pedido_id,item_pedido_id,cantidad_preparada,importe_linea_operativo,confirmado_explicito,motivo_faltante,registrado_por)
63:  on conflict on constraint preparacion_items_pedido_item_pedido_id_key do update set
65:  select to_jsonb(pi) || jsonb_build_object('cantidad_original',v_i.cantidad,'importe_original',v_i.total_linea) into v_nuevo from public.preparacion_items_pedido pi where item_pedido_id=v_i.id;
68:  into v_total from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=v_id;
69:  if v_total<0 or v_total>9007199254740991 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
70:  update public.pedidos set total_operativo_preparacion=v_total,preparacion_estado='pendiente' where id=v_id;
74: create function public.cerrar_preparacion_explicita(p_pedido_id uuid,p_version_esperada bigint,p_clave uuid)
76: declare v_p public.pedidos%rowtype; v_inicio jsonb; v_s jsonb:='{}'; v_distinto boolean;
78:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
79:  v_inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'cerrar_preparacion',v_s);
80:  select * into v_p from public.pedidos where id=p_pedido_id for update;
81:  if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
83:  if v_p.estado<>'preparando' or v_p.preparacion_finalizada_en is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
84:  perform 1 from public.items_pedido where pedido_id=p_pedido_id order by id for update;
85:  perform 1 from public.preparacion_items_pedido where pedido_id=p_pedido_id order by item_pedido_id for update;
86:  if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
87:  if not exists(select 1 from public.items_pedido where pedido_id=p_pedido_id) or exists(
88:  select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
89:  where i.pedido_id=p_pedido_id and (not coalesce(pi.confirmado_explicito,false) or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
90:  select exists(select 1 from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido_id and pi.cantidad_preparada<>i.cantidad) into v_distinto;
91:  update public.pedidos set estado='listo_despacho',preparacion_estado=case when v_distinto then 'incompleta' else 'completa' end,
92:  preparacion_finalizada_en=clock_timestamp(),preparacion_finalizada_por=auth.uid() where id=p_pedido_id;
93:  return operativo_privado.completar_operacion(p_pedido_id,p_version_esperada,p_clave,'cerrar_preparacion',v_s,null,'Cierre explícito de preparación',
98: alter function public.leer_preparacion_explicita(uuid) owner to postgres;
99: alter function public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text) owner to postgres;
100: alter function public.cerrar_preparacion_explicita(uuid,bigint,uuid) owner to postgres;

## supabase/migrations/20261106060000_carga_camioneta_salida.sql

3: create table operativo_privado.cargas (
5:  estado text not null default 'preparacion' check (estado in ('preparacion','lista','en_ruta')),
9: create table operativo_privado.carga_pedidos (
10:  fecha date not null references operativo_privado.cargas(fecha),
11:  pedido_id uuid primary key references public.pedidos(id) on delete restrict,
16: create table operativo_privado.historial_cargas (
22: create trigger historial_cargas_inmutable before update or delete on operativo_privado.historial_cargas
23:  for each row execute function operativo_privado.impedir_mutacion_historial();
24: create trigger historial_cargas_no_truncable before truncate on operativo_privado.historial_cargas
25:  for each statement execute function operativo_privado.impedir_mutacion_historial();
26: alter table operativo_privado.cargas enable row level security;
27: alter table operativo_privado.cargas force row level security;
28: alter table operativo_privado.carga_pedidos enable row level security;
29: alter table operativo_privado.carga_pedidos force row level security;
30: alter table operativo_privado.historial_cargas enable row level security;
31: alter table operativo_privado.historial_cargas force row level security;
32: revoke all on operativo_privado.cargas, operativo_privado.carga_pedidos, operativo_privado.historial_cargas from public,anon,authenticated,service_role;
34: create function public.leer_carga_jornada(p_fecha date)
37:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
39:  'estado',coalesce((select estado from operativo_privado.cargas where fecha=p_fecha),'preparacion'),
40:  'version',coalesce((select version from operativo_privado.cargas where fecha=p_fecha),0),
41:  'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
45:  from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb),'pendientes',
46:  (select count(*) from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
47:  where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.importe_linea_operativo is null))) order by p.numero_pedido)
48:  from public.pedidos p left join operativo_privado.carga_pedidos cp on cp.pedido_id=p.id and cp.fecha=p_fecha
50:  'historial',coalesce((select jsonb_agg(to_jsonb(h) order by h.version desc) from operativo_privado.historial_cargas h where h.fecha=p_fecha),'[]'::jsonb));
55: create function public.operar_carga_jornada(p_fecha date,p_version bigint,p_clave uuid,p_accion text,p_pedidos jsonb,p_motivo text)
58:  c operativo_privado.cargas%rowtype; h operativo_privado.historial_cargas%rowtype;
59:  s jsonb; anterior jsonb; resultado jsonb; e jsonb; p public.pedidos%rowtype;
62:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
64:  or p_accion is null or p_accion not in ('guardar','confirmar','salir','reabrir') then raise exception 'OPERACION_INVALIDA'; end if;
70:  lock table public.pedidos in exclusive mode;
71:  perform pg_advisory_xact_lock(hashtextextended('carga:'||p_fecha::text,0));
72:  s:=jsonb_build_object('accion',p_accion,'pedidos',p_pedidos,'motivo',p_motivo,'version',p_version);
73:  select * into h from operativo_privado.historial_cargas where fecha=p_fecha and clave=p_clave;
75:  if h.actor<>auth.uid() or h.solicitud<>s then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
78:  if p_fecha is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
79:  insert into operativo_privado.cargas(fecha) values(p_fecha) on conflict do nothing;
80:  select * into c from operativo_privado.cargas where fecha=p_fecha for update;
81:  if c.version<>p_version then raise exception 'VERSION_CARGA_CONFLICTO'; end if;
82:  if c.estado='en_ruta' then raise exception 'CARGA_YA_SALIO'; end if;
83:  anterior:=public.leer_carga_jornada(p_fecha);
85:  if c.estado<>'preparacion' then raise exception 'CARGA_NO_EDITABLE'; end if;
86:  if p_pedidos is null or jsonb_typeof(p_pedidos)<>'array' or jsonb_array_length(p_pedidos)=0 then raise exception 'SELECCION_REQUERIDA'; end if;
87:  if exists(select 1 from jsonb_array_elements(p_pedidos) x where jsonb_typeof(x)<>'object'
89:  or (select count(distinct x->>'id') from jsonb_array_elements(p_pedidos) x)<>jsonb_array_length(p_pedidos) then raise exception 'SELECCION_INVALIDA'; end if;
91:  perform 1 from public.pedidos where id in (select (x->>'id')::uuid from jsonb_array_elements(p_pedidos) x) order by id for update;
92:  if (select count(*) from public.pedidos pe where pe.id in (select (x->>'id')::uuid from jsonb_array_elements(p_pedidos) x)
93:  and (pe.fecha_entrega=p_fecha or exists(select 1 from operativo_privado.carga_pedidos cp where cp.pedido_id=pe.id and cp.fecha=p_fecha)))<>jsonb_array_length(p_pedidos) then raise exception 'SELECCION_INVALIDA'; end if;
95:  if exists(select 1 from jsonb_array_elements(p_pedidos) x join public.pedidos pe on pe.id=(x->>'id')::uuid
97:  or pe.estado not in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho'))) then raise exception 'SELECCION_INVALIDA'; end if;
98:  if exists(select 1 from jsonb_array_elements(p_pedidos) x where not (x->>'incluido')::boolean
99:  and (nullif(btrim(x->>'motivo'),'') is null or length(x->>'motivo')>2000)) then raise exception 'EXCLUSION_REQUIERE_MOTIVO'; end if;
101:  if exists(select 1 from operativo_privado.carga_pedidos cp where cp.fecha=p_fecha and not exists(select 1 from jsonb_array_elements(p_pedidos) x where (x->>'id')::uuid=cp.pedido_id)) then raise exception 'EXCLUSION_REQUIERE_MOTIVO'; end if;
102:  for e in select value from jsonb_array_elements(p_pedidos) loop
103:  insert into operativo_privado.carga_pedidos(fecha,pedido_id,incluido,motivo)
105:  on conflict(pedido_id) do update set incluido=excluded.incluido,motivo=excluded.motivo
106:  where operativo_privado.carga_pedidos.fecha=p_fecha;
107:  if not found then raise exception 'PEDIDO_EN_OTRA_CARGA'; end if;
110:  if p_accion in ('confirmar','salir') and not exists(select 1 from operativo_privado.carga_pedidos where fecha=p_fecha and incluido) then raise exception 'CARGA_VACIA'; end if;
111:  if (p_accion='confirmar' and c.estado<>'preparacion') or (p_accion in ('salir','reabrir') and c.estado<>'lista') then raise exception 'ESTADO_CARGA_INVALIDO'; end if;
112:  if p_accion='reabrir' and (nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000) then raise exception 'MOTIVO_REQUERIDO'; end if;
113:  -- Confirmar exige una decisión persistida para CADA pedido que existe ahora.
115:  if p_accion='confirmar' and exists(select 1 from public.pedidos pe where pe.fecha_entrega=p_fecha
116:  and not exists(select 1 from operativo_privado.carga_pedidos cp where cp.fecha=p_fecha and cp.pedido_id=pe.id)) then raise exception 'DECISIONES_PENDIENTES'; end if;
117:  -- Lista congela los pedidos incluidos. Reabrir libera el cierre sin borrar líneas.
118:  if p_accion='reabrir' then update operativo_privado.cargas set estado='preparacion',confirmada_en=null where fecha=p_fecha; end if;
119:  for p in select pe.* from public.pedidos pe join operativo_privado.carga_pedidos cp on cp.pedido_id=pe.id
121:  if p.estado<>'listo_despacho' or p.fecha_entrega is distinct from p_fecha then raise exception 'PEDIDO_NO_LISTO'; end if;
123:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
124:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
125:  if p.preparacion_finalizada_en is null or not exists(select 1 from public.items_pedido where pedido_id=p.id)
126:  or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
127:  where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
130:  select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
131:  inicio:=operativo_privado.iniciar_operacion(p.id,pv,p_clave,'carga_'||p_accion,s);
132:  update public.pedidos set estado=case when p_accion='salir' then 'en_reparto'::public.estado_pedido else 'preparando'::public.estado_pedido end,
136:  perform operativo_privado.completar_operacion(p.id,pv,p_clave,'carga_'||p_accion,s,null,
137:  coalesce(nullif(btrim(p_motivo),''),'Salida global de carga confirmada'),to_jsonb(p),
142:  if p_fecha is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
143:  update operativo_privado.cargas set estado=case p_accion when 'confirmar' then 'lista' when 'salir' then 'en_ruta' else 'preparacion' end,
148:  if p_fecha is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
149:  update operativo_privado.cargas set version=version+1 where fecha=p_fecha;
150:  resultado:=public.leer_carga_jornada(p_fecha)-'historial';
151:  insert into operativo_privado.historial_cargas(fecha,version,clave,actor,solicitud,anterior,resultado)
152:  values(p_fecha,p_version+1,p_clave,auth.uid(),s,anterior-'historial',resultado);
156: -- Barrera para RPC legacy: no alterar fecha/preparación de una carga confirmada.
157: -- No toma lock de carga después del pedido: evita invertir el orden global.
158: create function operativo_privado.proteger_pedido_cargado()
162:  select c.estado into e from operativo_privado.cargas c join operativo_privado.carga_pedidos cp on cp.fecha=c.fecha where cp.pedido_id=old.id and cp.incluido;
168:  if e in ('lista','en_ruta') and (to_jsonb(new)-omitidas) is distinct from (to_jsonb(old)-omitidas) then raise exception 'CARGA_CONFIRMADA'; end if;
169:  if e='lista' and new.estado not in ('listo_despacho','en_reparto') then raise exception 'CARGA_CONFIRMADA'; end if;
170:  if e='en_ruta' and new.estado in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho') then raise exception 'CARGA_YA_SALIO'; end if;
173: create trigger proteger_pedido_cargado before update on public.pedidos for each row execute function operativo_privado.proteger_pedido_cargado();
174: revoke all on function public.marcar_pedido_en_reparto_administrativo(uuid) from public,anon,authenticated,service_role;
175: alter function public.leer_carga_jornada(date) owner to postgres;
176: alter function public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text) owner to postgres;
177: alter function operativo_privado.proteger_pedido_cargado() owner to postgres;
178: revoke all on function operativo_privado.proteger_pedido_cargado() from public,anon,authenticated,service_role;
179: revoke all on function public.leer_carga_jornada(date), public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
180: grant execute on function public.leer_carga_jornada(date), public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text) to authenticated;

## supabase/migrations/20261107120000_orden_ruta_dia_sin_cambiar_estados.sql

1: -- Aplicar manualmente. Orden visual de todos los pedidos de la jornada.
2: -- Reutiliza rutas/paradas y la creación administrativa; no modifica estados.
3: create function public.orden_ruta_dia(
9:   v_ruta public.rutas%rowtype;
14:     raise exception 'NO_AUTORIZADO';
16:   if p_fecha is null then raise exception 'FECHA_REQUERIDA'; end if;
17:   perform pg_advisory_xact_lock(hashtextextended('ruta-principal:' || p_fecha::text, 0));
18:   select * into v_ruta from public.rutas r
22:     if coalesce(v_ruta.version, 0) is distinct from p_version then
23:       raise exception 'RUTA_DESACTUALIZADA';
25:     -- Bloquea los pedidos existentes mientras se comprueba la jornada.
26:     perform p.id from public.pedidos p where p.fecha_entrega = p_fecha for share;
28:       from public.pedidos p where p.fecha_entrega = p_fecha and p.estado <> 'cancelado';
33:       raise exception 'PEDIDOS_DESACTUALIZADOS';
35:     if v_ruta.id is null then
36:       select * into v_ruta from public.obtener_o_crear_ruta_administrativa(p_fecha);
39:     update public.paradas_ruta set posicion = null where ruta_id = v_ruta.id;
40:     insert into public.paradas_ruta (
41:       ruta_id, pedido_id, numero_pedido_snapshot, cliente_nombre_snapshot, total_snapshot
42:     ) select v_ruta.id, p.id, p.numero_pedido, p.nombre_cliente_snapshot, coalesce(p.total_final, p.total)
43:       from public.pedidos p where p.id = any(p_orden)
44:       on conflict (ruta_id, pedido_id) do nothing;
45:     update public.paradas_ruta pr set posicion = o.posicion::integer
46:       from unnest(p_orden) with ordinality o(pedido_id, posicion)
47:       where pr.ruta_id = v_ruta.id and pr.pedido_id = o.pedido_id;
48:     update public.rutas r set version = r.version + 1 where r.id = v_ruta.id
49:       returning r.* into v_ruta;
51:   select coalesce(array_agg(pr.pedido_id order by pr.posicion), array[]::uuid[]) into v_guardados
52:     from public.paradas_ruta pr where pr.ruta_id = v_ruta.id and pr.posicion is not null;
53:   return jsonb_build_object('version', coalesce(v_ruta.version, 0), 'orden', v_guardados);
56: alter function public.orden_ruta_dia(date, uuid[], bigint) owner to postgres;
57: revoke all on function public.orden_ruta_dia(date, uuid[], bigint) from public, anon, authenticated;
58: grant execute on function public.orden_ruta_dia(date, uuid[], bigint) to authenticated;

## supabase/migrations/20261107130000_guardar_avance_parcial_preparacion.sql

2: -- Reutiliza preparar_producto para incluir avances en el historial de preparación.
5: create function public.guardar_avance_producto_preparado(
6:  p_item_pedido_id uuid, p_cantidad numeric,
10:  v_id uuid; v_p public.pedidos%rowtype; v_i public.items_pedido%rowtype;
13:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
14:  select pedido_id into v_id from public.items_pedido where id=p_item_pedido_id;
15:  if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
16:  v_solicitud:=jsonb_build_object('item',p_item_pedido_id,'cantidad',p_cantidad,'tipo','avance_parcial');
18:  select * into v_p from public.pedidos where id=v_id for update;
19:  if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
21:  if v_p.estado <> 'preparando' or v_p.preparacion_finalizada_en is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
22:  select * into v_i from public.items_pedido where id=p_item_pedido_id and pedido_id=v_id for update;
23:  if not found then raise exception 'ITEM_PEDIDO_NO_ENCONTRADO'; end if;
24:  if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
25:  if p_cantidad is null or p_cantidad::text in ('NaN','Infinity','-Infinity') or p_cantidad<0 or p_cantidad>=1000000000 or p_cantidad<>round(p_cantidad,3) then raise exception 'CANTIDAD_PREPARADA_INVALIDA'; end if;
29:  if v_modo<>'kg_fraccionable' and p_cantidad<>trunc(p_cantidad) then raise exception 'CANTIDAD_PREPARADA_DEBE_SER_ENTERA'; end if;
30:  select to_jsonb(pi) into v_anterior from public.preparacion_items_pedido pi where item_pedido_id=v_i.id for update;
31:  if v_p.fecha_entrega is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
33:  insert into public.preparacion_items_pedido(pedido_id,item_pedido_id,cantidad_preparada,importe_linea_operativo,confirmado_explicito,motivo_faltante,registrado_por)
35:  on conflict on constraint preparacion_items_pedido_item_pedido_id_key do update set
37:  select to_jsonb(pi) || jsonb_build_object('cantidad_original',v_i.cantidad,'importe_original',v_i.total_linea) into v_nuevo from public.preparacion_items_pedido pi where item_pedido_id=v_i.id;
40:  into v_total from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=v_id;
41:  if v_total<0 or v_total>9007199254740991 then raise exception 'TOTAL_FINAL_INVALIDO'; end if;
42:  update public.pedidos set total_operativo_preparacion=v_total,preparacion_estado='pendiente' where id=v_id;
43:  return operativo_privado.completar_operacion(v_id,p_version_esperada,p_clave,'preparar_producto',v_solicitud,v_i.id,'Guardado parcial de cantidad cargada; pendiente de confirmación definitiva',v_anterior,v_nuevo,jsonb_build_object('guardado',true,'confirmado_explicito',false,'cantidad_preparada',p_cantidad,'importe_operativo',v_total));
46: alter function public.guardar_avance_producto_preparado(uuid,numeric,bigint,uuid) owner to postgres;

## supabase/migrations/20261108120000_fijar_corte_pedidos_mismo_dia.sql

1: -- Regla fija: pedidos hasta antes de las 16:00 del mismo día de entrega
6: alter table public.dias_entrega
7:   drop constraint dias_entrega_dias_anticipacion_corte_check;
13: alter table public.dias_entrega
22: create or replace function public.guardar_dia_entrega_administrativo(
33:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
36:     raise exception 'DIA_SEMANA_INVALIDO';
38:   if p_activo is null then raise exception 'ACTIVO_INVALIDO'; end if;
40:     raise exception 'HORA_CORTE_INVALIDA';
43:     raise exception 'ANTICIPACION_CORTE_INVALIDA';
57: create or replace function public.guardar_dia_entrega_administrativo(
70: create or replace function public.crear_pedido_desde_carrito(
77:   p_metodos_pago_previstos text[]
80:   pedido_id uuid,
81:   numero_pedido text,
82:   estado public.estado_pedido,
96:   v_pedido public.pedidos%rowtype;
97:   v_pedido_existente public.pedidos%rowtype;
111:   v_metodos_pago_previstos text[];
113:   if auth.uid() is null then raise exception 'NO_AUTORIZADO'; end if;
114:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
115:   if p_metodos_pago_previstos is null or cardinality(p_metodos_pago_previstos) = 0 then
116:     raise exception 'METODOS_PAGO_PREVISTOS_REQUERIDOS';
118:   if array_position(p_metodos_pago_previstos, null) is not null
119:     or not (p_metodos_pago_previstos <@ array['efectivo', 'transferencia', 'tarjeta']::text[])
120:     or cardinality(p_metodos_pago_previstos) <>
121:       (case when 'efectivo' = any(p_metodos_pago_previstos) then 1 else 0 end
122:       + case when 'transferencia' = any(p_metodos_pago_previstos) then 1 else 0 end
123:       + case when 'tarjeta' = any(p_metodos_pago_previstos) then 1 else 0 end) then
124:     raise exception 'METODOS_PAGO_PREVISTOS_INVALIDOS';
127:   into v_metodos_pago_previstos
129:   where metodo = any(p_metodos_pago_previstos);
133:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
134:   if not v_es_admin and v_cliente.usuario_id is distinct from auth.uid() then raise exception 'NO_AUTORIZADO'; end if;
136:   select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
138:     if v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
139:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
143:   if p_fecha_entrega is null then raise exception 'FECHA_ENTREGA_REQUERIDA'; end if;
144:   if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'ITEMS_REQUERIDOS'; end if;
145:   if p_direccion_cliente_id is null then raise exception 'DIRECCION_REQUERIDA'; end if;
148:   if not found then raise exception 'DIRECCION_INVALIDA'; end if;
149:   if v_direccion.latitud is null or v_direccion.longitud is null then raise exception 'DIRECCION_SIN_UBICACION'; end if;
151:   if v_zona_entrega_snapshot is null then raise exception 'DIRECCION_SIN_ZONA_VALIDA'; end if;
155:   -- dirección y zona, inmediatamente antes de crear el pedido.
158:   if p_fecha_entrega < v_hoy_local or p_fecha_entrega > v_hoy_local + 14 then raise exception 'FECHA_ENTREGA_INVALIDA'; end if;
159:   if not public.fecha_entrega_disponible(p_fecha_entrega, v_momento) then raise exception 'FECHA_ENTREGA_NO_DISPONIBLE'; end if;
160:   insert into public.pedidos (
164:     subtotal, costo_entrega, descuento, total, observacion_general, fecha_entrega, clave_idempotencia, metodos_pago_previstos
169:     0, 0, 0, 0, v_observacion_normalizada, p_fecha_entrega, p_clave_idempotencia, v_metodos_pago_previstos
170:   ) on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing returning * into v_pedido;
172:   if v_pedido.id is null then
173:     select * into v_pedido_existente from public.pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
174:     if not found or v_pedido_existente.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
175:     return query select v_pedido_existente.id, v_pedido_existente.numero_pedido, v_pedido_existente.estado, v_pedido_existente.subtotal, v_pedido_existente.costo_entrega, v_pedido_existente.descuento, v_pedido_existente.total;
180:     if jsonb_typeof(v_item) <> 'object' then raise exception 'ITEM_INVALIDO'; end if;
182:     if v_texto_presentacion_id is null or v_texto_presentacion_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'PRESENTACION_INVALIDA'; end if;
183:     if v_item -> 'cantidad' is null or jsonb_typeof(v_item -> 'cantidad') <> 'number' then raise exception 'CANTIDAD_INVALIDA'; end if;
186:     if v_presentacion_id = any(v_presentaciones) then raise exception 'PRESENTACION_DUPLICADA'; end if;
191:     if not found then raise exception 'PRESENTACION_NO_DISPONIBLE'; end if;
192:     if not public.es_cantidad_pedido_valida(v_presentacion.unidad, v_presentacion.cantidad_presentacion, v_presentacion.nombre_presentacion, v_cantidad) then raise exception 'CANTIDAD_INVALIDA'; end if;
194:     insert into public.items_pedido (pedido_id,producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,precio_neto_unitario_snapshot,precio_final_unitario_snapshot,total_linea,observacion_cliente,modo_cantidad_snapshot)
195:     values (v_pedido.id,v_presentacion.producto_id,v_presentacion.id,v_presentacion.nombre_producto,v_presentacion.nombre_presentacion,v_presentacion.unidad,v_cantidad,v_presentacion.precio_neto,v_presentacion.precio_final,round(v_cantidad * v_presentacion.precio_final)::bigint,null,v_modo_cantidad_snapshot);
198:   select coalesce(sum(i.total_linea), 0)::bigint into v_subtotal from public.items_pedido i where i.pedido_id = v_pedido.id;
200:   update public.pedidos set subtotal = v_subtotal, costo_entrega = v_costo_entrega, descuento = 0, total = v_subtotal + v_costo_entrega where id = v_pedido.id returning * into v_pedido;
201:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.subtotal, v_pedido.costo_entrega, v_pedido.descuento, v_pedido.total;

## supabase/migrations/20261108130000_confirmar_entrega_real_todo_correcto.sql

2: -- Contrato RPC: lista COMPLETA [{item_pedido_id: UUID, cantidad_entregada: number}].
4: -- No aceptar pagos/deuda aquí: una integración posterior deberá usar pedido_id,
8: create table operativo_privado.entregas_definitivas (
9:  pedido_id uuid primary key references public.pedidos(id) on delete restrict,
16: alter table operativo_privado.entregas_definitivas owner to postgres;
17: alter table operativo_privado.entregas_definitivas enable row level security;
18: alter table operativo_privado.entregas_definitivas force row level security;
20: create trigger entregas_definitivas_inmutables before update or delete on operativo_privado.entregas_definitivas
21:  for each row execute function operativo_privado.impedir_mutacion_historial();
22: create trigger entregas_definitivas_no_truncables before truncate on operativo_privado.entregas_definitivas
23:  for each statement execute function operativo_privado.impedir_mutacion_historial();
25: alter table public.pedidos drop constraint pedidos_venta_definitiva_inactiva;
26: alter table public.pedidos add constraint pedidos_venta_definitiva_pareada check (
33: create function operativo_privado.proteger_venta_definitiva()
41:      raise exception 'VENTA_DEFINITIVA_INMUTABLE';
48:      where e.pedido_id=new.id and e.snapshot=new.venta_definitiva_snapshot
51:      raise exception 'ENTREGA_REQUIERE_SNAPSHOT_DEFINITIVO';
56: create trigger proteger_venta_definitiva before insert or update on public.pedidos
57:  for each row execute function operativo_privado.proteger_venta_definitiva();
59: -- Extensión puntual de la barrera de carga: los únicos campos adicionales
62: create or replace function operativo_privado.proteger_pedido_cargado()
66:  select c.estado into e from operativo_privado.cargas c join operativo_privado.carga_pedidos cp on cp.fecha=c.fecha where cp.pedido_id=old.id and cp.incluido;
70:  if e='en_ruta' and old.estado='en_reparto' and new.estado='entregado'
71:  and exists(select 1 from operativo_privado.entregas_definitivas d where d.pedido_id=old.id
75:  if e in ('lista','en_ruta') and (to_jsonb(new)-omitidas) is distinct from (to_jsonb(old)-omitidas) then raise exception 'CARGA_CONFIRMADA'; end if;
76:  if e='lista' and new.estado not in ('listo_despacho','en_reparto') then raise exception 'CARGA_CONFIRMADA'; end if;
77:  if e='en_ruta' and new.estado in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho') then raise exception 'CARGA_YA_SALIO'; end if;
81: create function public.confirmar_entrega_todo_correcto(
82:  p_pedido_id uuid, p_version_esperada bigint, p_clave uuid, p_items jsonb
85:  p public.pedidos%rowtype; inicio jsonb; solicitud jsonb; lineas jsonb;
88:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
91:  inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'entrega_todo_correcto',solicitud);
93:  select * into p from public.pedidos where id=p_pedido_id for update;
94:  if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
95:  if p.estado<>'en_reparto' or p.venta_definitiva_snapshot is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
96:  if p.preparacion_finalizada_en is null then raise exception 'PREPARACION_NO_FINALIZADA'; end if;
97:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
98:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
99:  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'ENTREGA_EXPLICITA_REQUERIDA'; end if;
101:    where jsonb_typeof(x)<>'object' or x->>'item_pedido_id' is null
102:    or jsonb_typeof(x->'cantidad_entregada') is distinct from 'number') then raise exception 'ITEMS_ENTREGA_INVALIDOS'; end if;
103:  if (select count(distinct (x->>'item_pedido_id')::uuid) from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items)
104:  or (select count(*) from public.items_pedido where pedido_id=p.id)<>jsonb_array_length(p_items)
106:    left join public.items_pedido i on i.id=(x->>'item_pedido_id')::uuid and i.pedido_id=p.id
107:    left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id and pi.pedido_id=p.id
113:    raise exception 'ENTREGA_NO_COINCIDE_CON_PREPARACION';
116:    'item_pedido_id',i.id,'producto_id',i.producto_id,'presentacion_producto_id',i.presentacion_producto_id,
126:  into subtotal,lineas from public.items_pedido i
127:  join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
128:  join jsonb_array_elements(p_items) x on (x->>'item_pedido_id')::uuid=i.id where i.pedido_id=p.id;
131:    or total is distinct from p.total_operativo_preparacion::numeric then raise exception 'TOTAL_ENTREGA_INVALIDO'; end if;
133:  snapshot:=jsonb_build_object('contrato',1,'regimen','entrega_v1','pedido_id',p.id,
137:  insert into operativo_privado.entregas_definitivas(pedido_id,clave,actor,instante,version,snapshot)
139:  update public.pedidos set estado='entregado',venta_definitiva_snapshot=snapshot,venta_reconocida_en=instante where id=p.id;
140:  resultado:=jsonb_build_object('pedido_id',p.id,'estado','entregado','venta_definitiva',snapshot,
141:    'pagos_registrados',false,'deuda_registrada',false);
147: alter function operativo_privado.proteger_venta_definitiva() owner to postgres;
148: alter function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb) owner to postgres;
152: comment on column public.pedidos.venta_definitiva_snapshot is
154: comment on column public.pedidos.venta_reconocida_en is
157:  'Una venta definitiva por pedido, sin movimientos contables adicionales. Referencia futura para pagos/deuda: pedido_id, clave, version y snapshot.total.';
158: -- ATENCIÓN microintegración 8/8: v_movimientos_cuenta_cliente, v_saldos_pedidos
162: -- e instante reales para este último. Aquí no se tocan vistas, aplicaciones,
163: -- pagos, ajustes, total_final ni subtotal_final: no afirmar que los saldos actuales

## supabase/migrations/20261108140000_integrar_contabilidad_entrega_y_pagos.sql

6: -- No migra datos históricos ni genera ajustes/cargos adicionales.
9: create table operativo_privado.cobros_entrega (
10:  pedido_id uuid primary key references operativo_privado.entregas_definitivas(pedido_id) on delete restrict,
16: create table operativo_privado.pagos_entrega (
17:  pedido_id uuid not null references operativo_privado.entregas_definitivas(pedido_id) on delete restrict,
19:  pago_id uuid not null unique references public.pagos(id) on delete restrict,
22:  primary key(pedido_id,metodo)
24: alter table operativo_privado.cobros_entrega owner to postgres;
25: alter table operativo_privado.pagos_entrega owner to postgres;
26: alter table operativo_privado.cobros_entrega enable row level security;
27: alter table operativo_privado.cobros_entrega force row level security;
28: alter table operativo_privado.pagos_entrega enable row level security;
29: alter table operativo_privado.pagos_entrega force row level security;
30: revoke all on operativo_privado.cobros_entrega,operativo_privado.pagos_entrega from public,anon,authenticated,service_role;
31: create trigger cobros_entrega_inmutables before update or delete on operativo_privado.cobros_entrega
32:  for each row execute function operativo_privado.impedir_mutacion_historial();
33: create trigger pagos_entrega_inmutables before update or delete on operativo_privado.pagos_entrega
34:  for each row execute function operativo_privado.impedir_mutacion_historial();
35: create trigger cobros_entrega_no_truncables before truncate on operativo_privado.cobros_entrega
36:  for each statement execute function operativo_privado.impedir_mutacion_historial();
37: create trigger pagos_entrega_no_truncables before truncate on operativo_privado.pagos_entrega
38:  for each statement execute function operativo_privado.impedir_mutacion_historial();
41: drop function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb);
43: create or replace view public.v_saldos_pedidos
47:   p.id as pedido_id,
49:   (case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else (p.venta_definitiva_snapshot->>'total')::bigint end) as total_pedido,
53:     when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) = 0 then 'sin_pago'
56:   end as estado_pago
57: from public.pedidos p
58: left join public.aplicaciones_pago a on a.pedido_id = p.id
59: left join public.pagos pa on pa.id = a.pago_id
63: create or replace view public.v_movimientos_cuenta_cliente
67:   select p.cliente_id, case when p.regimen_contable='legado' then p.fecha_creacion else p.venta_reconocida_en end as fecha, 'pedido'::text as tipo_movimiento, p.id as referencia_id,
68:     p.numero_pedido as referencia, ('Pedido ' || p.numero_pedido) as concepto,
71:   from public.pedidos p where p.cliente_id is not null and p.estado <> 'cancelado' and (p.regimen_contable='legado' or p.venta_reconocida_en is not null)
73:   select p.cliente_id, p.fecha_pago, 'pago'::text, p.id,
74:     coalesce(nullif(btrim(p.referencia), ''), 'Pago ' || left(p.id::text, 8)), ('Pago ' || p.metodo_pago::text),
76:   from public.pagos p where p.estado = 'confirmado'
78:   select a.cliente_id, a.fecha_ajuste, 'ajuste'::text, a.id, 'Ajuste ' || left(a.id::text, 8), a.motivo,
82:   from public.ajustes_cuenta_cliente a
88: create or replace function public.validar_aplicacion_pago()
95:   pago_actual public.pagos%rowtype;
96:   pedido_actual public.pedidos%rowtype;
97:   aplicado_pago bigint;
98:   aplicado_pedido bigint;
101:   select * into pago_actual from public.pagos where id = new.pago_id for update;
102:   if not found then raise exception 'Pago inexistente'; end if;
103:   if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;
105:   select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
106:   if not found then raise exception 'Pedido inexistente'; end if;
107:   if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then raise exception 'El pago y el pedido deben pertenecer al mismo cliente'; end if;
108:   if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;
110:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
111:   from public.aplicaciones_pago a
112:   join public.pagos p on p.id = a.pago_id
113:   where a.pago_id = new.pago_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
114:   if aplicado_pago + new.monto_aplicado > pago_actual.monto then raise exception 'La aplicación supera el monto disponible del pago'; end if;
116:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
117:   from public.aplicaciones_pago a
118:   join public.pagos p on p.id = a.pago_id
119:   where a.pedido_id = new.pedido_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
120:   if pedido_actual.regimen_contable='entrega_v1' then
122:     if pedido_actual.venta_reconocida_en is null or pedido_actual.estado<>'entregado'
123:       or pago_actual.estado<>'confirmado' then raise exception 'APLICACION_REQUIERE_VENTA_Y_PAGO_CONFIRMADOS'; end if;
124:     total_exigible := (pedido_actual.venta_definitiva_snapshot->>'total')::bigint;
126:     total_exigible := coalesce(pedido_actual.total_final, pedido_actual.total);
128:   if aplicado_pedido + new.monto_aplicado > total_exigible then raise exception 'La aplicación supera el saldo pendiente del pedido'; end if;
133: create function public.confirmar_entrega_todo_correcto(
134:  p_pedido_id uuid, p_version_esperada bigint, p_clave uuid, p_items jsonb, p_cobro jsonb
137:  p public.pedidos%rowtype; inicio jsonb; solicitud jsonb; lineas jsonb;
140:  pago uuid; fila record; pagos jsonb := '[]'::jsonb;
143:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
145:  -- Cliente antes de pedido: mismo orden que el cobro administrativo FIFO.
146:  select cliente_id into cliente from public.pedidos where id=p_pedido_id;
149:  inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'entrega_todo_correcto',solicitud);
151:  select * into p from public.pedidos where id=p_pedido_id for update;
152:  if p.cliente_id is distinct from cliente or cliente is null then raise exception 'CLIENTE_INVALIDO'; end if;
153:  if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
154:  if p.estado<>'en_reparto' or p.venta_definitiva_snapshot is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
156:  if jsonb_typeof(p_cobro) is distinct from 'object' then raise exception 'COBRO_EXPLICITO_REQUERIDO'; end if;
163:  then raise exception 'COBRO_INVALIDO'; end if;
169:  and efectivo+transferencia<=9007199254740991) then raise exception 'IMPORTES_RECIBIDOS_INVALIDOS'; end if;
175:  then raise exception 'METODO_E_IMPORTES_INCOMPATIBLES'; end if;
177:  if p.preparacion_finalizada_en is null then raise exception 'PREPARACION_NO_FINALIZADA'; end if;
178:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
179:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
180:  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'ENTREGA_EXPLICITA_REQUERIDA'; end if;
182:    where jsonb_typeof(x)<>'object' or x->>'item_pedido_id' is null
183:    or jsonb_typeof(x->'cantidad_entregada') is distinct from 'number') then raise exception 'ITEMS_ENTREGA_INVALIDOS'; end if;
184:  if (select count(distinct (x->>'item_pedido_id')::uuid) from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items)
185:  or (select count(*) from public.items_pedido where pedido_id=p.id)<>jsonb_array_length(p_items)
187:    left join public.items_pedido i on i.id=(x->>'item_pedido_id')::uuid and i.pedido_id=p.id
188:    left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id and pi.pedido_id=p.id
194:    raise exception 'ENTREGA_NO_COINCIDE_CON_PREPARACION';
197:    'item_pedido_id',i.id,'producto_id',i.producto_id,'presentacion_producto_id',i.presentacion_producto_id,
207:  into subtotal,lineas from public.items_pedido i
208:  join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
209:  join jsonb_array_elements(p_items) x on (x->>'item_pedido_id')::uuid=i.id where i.pedido_id=p.id;
212:    or total is distinct from p.total_operativo_preparacion::numeric then raise exception 'TOTAL_ENTREGA_INVALIDO'; end if;
214:  snapshot:=jsonb_build_object('contrato',1,'regimen','entrega_v1','pedido_id',p.id,
218:  insert into operativo_privado.entregas_definitivas(pedido_id,clave,actor,instante,version,snapshot)
220:  update public.pedidos set estado='entregado',venta_definitiva_snapshot=snapshot,venta_reconocida_en=instante where id=p.id;
221:  -- Aplicaciones anteriores se conservan; jamás se vuelve a cobrar su importe.
223:  from public.aplicaciones_pago a join public.pagos pa on pa.id=a.pago_id
224:  where a.pedido_id=p.id and a.activa and pa.estado='confirmado';
225:  if aplicado_previo>total then raise exception 'APLICACIONES_PREVIAS_SUPERAN_VENTA'; end if;
230:    insert into public.pagos(cliente_id,monto,metodo_pago,estado,registrado_por,fecha_pago,observacion)
231:    values(p.cliente_id,importe,fila.metodo::public.metodo_pago,'confirmado',auth.uid(),instante,
232:      'Cobro en entrega '||p.id::text) returning id into pago;
235:      insert into public.aplicaciones_pago(pago_id,pedido_id,monto_aplicado) values(pago,p.id,aplicado);
238:    insert into operativo_privado.pagos_entrega(pedido_id,metodo,pago_id,monto,monto_aplicado)
239:    values(p.id,fila.metodo,pago,importe,aplicado);
240:    pagos:=pagos||jsonb_build_array(jsonb_build_object('pago_id',pago,'metodo',fila.metodo,
243:  insert into operativo_privado.cobros_entrega(pedido_id,solicitud,recibido,actor)
245:  resultado:=jsonb_build_object('pedido_id',p.id,'estado','entregado','venta_definitiva',snapshot,
246:    'pagos',pagos,'recibido',recibido,'deuda_pendiente',restante,
248:    'pagos_registrados',recibido>0,'deuda_registrada',true);
251:    jsonb_build_object('estado','entregado','venta_definitiva',snapshot,'cobro',p_cobro,'pagos',pagos),resultado);
255: alter function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb) owner to postgres;
258: alter function public.validar_aplicacion_pago() owner to postgres;
259: revoke all on function public.validar_aplicacion_pago() from public,anon,authenticated,service_role;
262: drop trigger validar_aplicacion_pago_antes_de_guardar on public.aplicaciones_pago;
263: create trigger validar_aplicacion_pago_antes_de_guardar
264:  before insert or update of pago_id,pedido_id,monto_aplicado on public.aplicaciones_pago
265:  for each row execute function public.validar_aplicacion_pago();
267: create function operativo_privado.validar_reactivacion_entrega()
270:  if exists(select 1 from public.pedidos where id=new.pedido_id and regimen_contable='entrega_v1') then
273:    update public.aplicaciones_pago set monto_aplicado=monto_aplicado where id=new.id;
277: alter function operativo_privado.validar_reactivacion_entrega() owner to postgres;
279: create trigger validar_reactivacion_entrega after update of activa on public.aplicaciones_pago
281:  execute function operativo_privado.validar_reactivacion_entrega();
285: create function operativo_privado.exigir_cobro_entrega()
289:  select * into c from operativo_privado.cobros_entrega where pedido_id=new.pedido_id;
290:  if not found then raise exception 'ENTREGA_SIN_REGISTRO_CONTABLE'; end if;
291:  select coalesce(sum(monto),0) into suma from operativo_privado.pagos_entrega where pedido_id=new.pedido_id;
292:  if suma<>c.recibido then raise exception 'COBRO_ENTREGA_INCONSISTENTE'; end if;
295: alter function operativo_privado.exigir_cobro_entrega() owner to postgres;
297: create constraint trigger entrega_exige_cobro after insert on operativo_privado.entregas_definitivas
298:  deferrable initially deferred for each row execute function operativo_privado.exigir_cobro_entrega();
299: comment on table operativo_privado.pagos_entrega is
304: -- FIFO administrativo consume la nueva v_saldos_pedidos: sólo ventas reconocidas.
305: -- Pagos completos generan abono UNA vez; aplicaciones sólo distribuyen el pago.
306: -- Ajustes y pagos históricos permanecen intactos, incluido crédito no aplicado.

## supabase/migrations/20261108150000_confirmar_entrega_hubo_diferencias.sql

1: -- Backend SQL LOCAL. No ejecutar ni habilitar la opción en /admin/rutas.
3: -- RPC: lista COMPLETA [{item_pedido_id: UUID, cantidad_entregada: number}].
5: -- No acepta totales ni ajustes nuevos; reutiliza autorizaciones persistidas.
6: -- Cliente -> pedido -> items/preparación: mismo orden de locks que contrato 2.
7: -- Snapshot, venta, pagos, excedentes, versión e historial en una transacción.
10: create function public.confirmar_entrega_hubo_diferencias(
11:  p_pedido_id uuid, p_version_esperada bigint, p_clave uuid, p_items jsonb, p_cobro jsonb
14:  i public.items_pedido%rowtype; pi public.preparacion_items_pedido%rowtype;
17:  p public.pedidos%rowtype; inicio jsonb; solicitud jsonb; lineas jsonb;
20:  pago uuid; fila record; pagos jsonb := '[]'::jsonb;
23:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
25:  -- Cliente antes de pedido: mismo orden que el cobro administrativo FIFO.
26:  select cliente_id into cliente from public.pedidos where id=p_pedido_id;
29:  inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'entrega_hubo_diferencias',solicitud);
31:  select * into p from public.pedidos where id=p_pedido_id for update;
32:  if p.cliente_id is distinct from cliente or cliente is null then raise exception 'CLIENTE_INVALIDO'; end if;
33:  if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
34:  if p.estado<>'en_reparto' or p.venta_definitiva_snapshot is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
36:  if jsonb_typeof(p_cobro) is distinct from 'object' then raise exception 'COBRO_EXPLICITO_REQUERIDO'; end if;
43:  then raise exception 'COBRO_INVALIDO'; end if;
49:  and efectivo+transferencia<=9007199254740991) then raise exception 'IMPORTES_RECIBIDOS_INVALIDOS'; end if;
55:  then raise exception 'METODO_E_IMPORTES_INCOMPATIBLES'; end if;
57:  if p.preparacion_finalizada_en is null then raise exception 'PREPARACION_NO_FINALIZADA'; end if;
58:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
59:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
61:  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'ENTREGA_EXPLICITA_REQUERIDA'; end if;
62:  if jsonb_array_length(p_items)=0 then raise exception 'ITEMS_ENTREGA_INVALIDOS'; end if;
64:    if jsonb_typeof(entrada) is distinct from 'object' then raise exception 'ITEMS_ENTREGA_INVALIDOS'; end if;
65:    if not (entrada ?& array['item_pedido_id','cantidad_entregada'])
66:      or (entrada-array['item_pedido_id','cantidad_entregada'])<>'{}'::jsonb
67:      or jsonb_typeof(entrada->'item_pedido_id') is distinct from 'string'
69:      raise exception 'ITEMS_ENTREGA_INVALIDOS';
71:    perform (entrada->>'item_pedido_id')::uuid;
73:  if (select count(distinct (value->>'item_pedido_id')::uuid) from jsonb_array_elements(p_items))<>jsonb_array_length(p_items)
74:    or (select count(*) from public.items_pedido where pedido_id=p.id)<>jsonb_array_length(p_items)
76:      where not exists(select 1 from public.items_pedido i
77:        where i.pedido_id=p.id and i.id=(x->>'item_pedido_id')::uuid)) then
78:    raise exception 'ITEMS_ENTREGA_NO_CORRESPONDEN';
81:  for i in select * from public.items_pedido where pedido_id=p.id order by id loop
82:    select * into pi from public.preparacion_items_pedido
83:      where item_pedido_id=i.id and pedido_id=p.id;
85:      or pi.importe_linea_operativo is null then raise exception 'PREPARACION_NO_CONFIRMADA'; end if;
87:      from jsonb_array_elements(p_items) where (value->>'item_pedido_id')::uuid=i.id;
90:      raise exception 'CANTIDAD_ENTREGADA_INVALIDA';
98:      raise exception 'FORMATO_UNIDAD_ENTREGA_INVALIDO';
101:      raise exception 'CANTIDAD_ENTREGADA_DEBE_SER_ENTERA';
105:    -- Cero no cobra producto. No prorratear ajustes administrativos/preparación.
111:      definitivo:=i.total_linea; regla:='total_pedido_autorizado';
113:      raise exception 'TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_ENTREGADA';
119:      or definitivo<>trunc(definitivo) then raise exception 'IMPORTE_ENTREGA_INVALIDO'; end if;
122:      'item_pedido_id',i.id,'producto_id',i.producto_id,'presentacion_producto_id',i.presentacion_producto_id,
133:  if not diferencias then raise exception 'ENTREGA_SIN_DIFERENCIAS'; end if;
137:    or subtotal>9007199254740991 then raise exception 'TOTAL_ENTREGA_INVALIDO'; end if;
139:  snapshot:=jsonb_build_object('contrato',1,'regimen','entrega_v1','pedido_id',p.id,
143:  insert into operativo_privado.entregas_definitivas(pedido_id,clave,actor,instante,version,snapshot)
145:  update public.pedidos set estado='entregado',venta_definitiva_snapshot=snapshot,venta_reconocida_en=instante where id=p.id;
146:  -- Aplicaciones anteriores se conservan; jamás se vuelve a cobrar su importe.
148:  from public.aplicaciones_pago a join public.pagos pa on pa.id=a.pago_id
149:  where a.pedido_id=p.id and a.activa and pa.estado='confirmado';
150:  if aplicado_previo>total then raise exception 'APLICACIONES_PREVIAS_SUPERAN_VENTA'; end if;
155:    insert into public.pagos(cliente_id,monto,metodo_pago,estado,registrado_por,fecha_pago,observacion)
156:    values(p.cliente_id,importe,fila.metodo::public.metodo_pago,'confirmado',auth.uid(),instante,
157:      'Cobro en entrega '||p.id::text) returning id into pago;
160:      insert into public.aplicaciones_pago(pago_id,pedido_id,monto_aplicado) values(pago,p.id,aplicado);
163:    insert into operativo_privado.pagos_entrega(pedido_id,metodo,pago_id,monto,monto_aplicado)
164:    values(p.id,fila.metodo,pago,importe,aplicado);
165:    pagos:=pagos||jsonb_build_array(jsonb_build_object('pago_id',pago,'metodo',fila.metodo,
168:  insert into operativo_privado.cobros_entrega(pedido_id,solicitud,recibido,actor)
170:  resultado:=jsonb_build_object('pedido_id',p.id,'estado','entregado','venta_definitiva',snapshot,
171:    'pagos',pagos,'recibido',recibido,'deuda_pendiente',restante,
173:    'pagos_registrados',recibido>0,'deuda_registrada',true,'aplicado_previo',aplicado_previo);
176:    jsonb_build_object('estado','entregado','venta_definitiva',snapshot,'cobro',p_cobro,'pagos',pagos,
182: alter function public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb) owner to postgres;

## supabase/migrations/20261108160000_registrar_entrega_fallida.sql

1: -- SQL LOCAL exclusivamente. No aplicar ni conectar todavía con /admin/rutas.
3: -- Sin backfill, nuevos cargos, pagos, devoluciones ni reprogramación.
6: create function public.registrar_entrega_fallida(
7:   p_pedido_id uuid, p_version_esperada bigint, p_clave uuid,
12:   p public.pedidos%rowtype;
21:     raise exception 'NO_AUTORIZADO';
23:   -- Cliente -> pedido -> versión: orden compartido con las entregas con cobro.
24:   select cliente_id into cliente from public.pedidos where id = p_pedido_id;
29:   inicio := operativo_privado.iniciar_operacion(p_pedido_id, p_version_esperada,
33:   select * into p from public.pedidos where id = p_pedido_id for update;
34:   if p.cliente_id is distinct from cliente then raise exception 'CLIENTE_INVALIDO'; end if;
37:     or exists (select 1 from operativo_privado.entregas_definitivas where pedido_id = p.id)
38:   then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
40:     'Cliente ausente', 'Cliente rechazó pedido', 'Dirección incorrecta',
42:   ) then raise exception 'MOTIVO_ENTREGA_FALLIDA_INVALIDO'; end if;
44:     raise exception 'DESCRIPCION_ENTREGA_FALLIDA_REQUERIDA';
46:   if length(p_observaciones) > 2000 then raise exception 'OBSERVACIONES_DEMASIADO_LARGAS'; end if;
52:   -- El historial es el registro del intento fallido; no es una venta de importe cero.
58:     evento, evento || jsonb_build_object('pedido_id', p.id,
59:       'venta_registrada', false, 'deuda_registrada', false, 'pagos_registrados', false));
60:   update public.pedidos set estado = 'entrega_fallida' where id = p.id;
64:   -- fuera de v_saldos_pedidos/v_movimientos_cuenta_cliente y del FIFO de cobro.
65:   -- No tocar items, preparación, snapshots, pagos, aplicaciones ni ajustes.
70: -- Barrera puntual contra UPDATE directo sin motivo/historial y contra una
72: create function operativo_privado.proteger_entrega_fallida()
77:       and exists (select 1 from operativo_privado.historial_operativo
78:         where pedido_id = old.id and operacion = 'entrega_fallida') then
79:       raise exception 'ENTREGA_FALLIDA_SIN_REPROGRAMACION';
84:     if TG_OP = 'INSERT' then raise exception 'ENTREGA_FALLIDA_REQUIERE_OPERACION'; end if;
88:         select 1 from operativo_privado.historial_operativo h
89:         join operativo_privado.versiones_pedido v
90:           on v.pedido_id = h.pedido_id and v.version = h.version
91:         where h.pedido_id = new.id and h.operacion = 'entrega_fallida'
95:       ) then raise exception 'ENTREGA_FALLIDA_REQUIERE_OPERACION'; end if;
101: alter function public.registrar_entrega_fallida(uuid,bigint,uuid,text,text) owner to postgres;
102: alter function operativo_privado.proteger_entrega_fallida() owner to postgres;
108: create trigger proteger_entrega_fallida before insert or update of estado on public.pedidos
109:   for each row execute function operativo_privado.proteger_entrega_fallida();
111:   'No entregado: motivo cerrado y observaciones (obligatorias para Otro). Transacción administrativa con historial inmutable, versión e idempotencia; sin venta, cobro ni reprogramación. UI pendiente.';

## supabase/migrations/20261108170000_corregir_venta_entregada_administrativo.sql

3: -- pagos ni importes arbitrarios. Conserva las reglas de entrega con diferencias.
4: -- La cuenta corriente mantiene el cargo original y suma UNA vez el ajuste.
5: -- El saldo por pedido usa venta original + diferencias - aplicaciones vigentes.
6: -- Una reducción bajo lo aplicado produce saldo negativo del pedido: crédito por
7: -- ajuste, NO dinero disponible adicional de un pago ni una aplicación anulada.
10: create table public.correcciones_venta_entregada (
12:  pedido_id uuid not null references public.pedidos(id) on delete restrict,
13:  cliente_id uuid not null references public.clientes(id) on delete restrict,
24:  ajuste_id uuid unique references public.ajustes_cuenta_cliente(id) on delete restrict,
25:  unique(pedido_id,version), unique(pedido_id,clave),
26:  check ((diferencia=0 and ajuste_id is null) or (diferencia<>0 and ajuste_id is not null)),
29: alter table public.correcciones_venta_entregada owner to postgres;
30: alter table public.correcciones_venta_entregada enable row level security;
31: alter table public.correcciones_venta_entregada force row level security;
34: -- Mismo ámbito de lectura que ajustes/cuenta corriente; ningún escritor API.
38: create trigger correcciones_venta_inmutables before update or delete
40:  execute function operativo_privado.impedir_mutacion_historial();
41: create trigger correcciones_venta_no_truncables before truncate
43:  execute function operativo_privado.impedir_mutacion_historial();
45: -- El ajuste vinculado también es inmutable, incluso por vías administrativas.
46: create function operativo_privado.proteger_ajuste_correccion()
50:    if exists(select 1 from public.correcciones_venta_entregada where ajuste_id is not null)
51:      then raise exception 'AJUSTE_CORRECCION_INMUTABLE'; end if;
52:  elsif exists(select 1 from public.correcciones_venta_entregada where ajuste_id=old.id) then
53:    raise exception 'AJUSTE_CORRECCION_INMUTABLE';
58: create trigger proteger_ajuste_correccion before update or delete on public.ajustes_cuenta_cliente
59:  for each row execute function operativo_privado.proteger_ajuste_correccion();
60: create trigger proteger_ajuste_correccion_truncate before truncate on public.ajustes_cuenta_cliente
61:  for each statement execute function operativo_privado.proteger_ajuste_correccion();
63: create or replace view public.v_saldos_pedidos
67:   p.id as pedido_id,
69:   (case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else ((p.venta_definitiva_snapshot->>'total')::bigint + coalesce((select sum(c.diferencia) from public.correcciones_venta_entregada c where c.pedido_id=p.id),0))::bigint end) as total_pedido,
71:   ((case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else ((p.venta_definitiva_snapshot->>'total')::bigint + coalesce((select sum(c.diferencia) from public.correcciones_venta_entregada c where c.pedido_id=p.id),0))::bigint end) - coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0))::bigint as saldo_pendiente,
73:     when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) = 0 then 'sin_pago'
74:     when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) < (case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else ((p.venta_definitiva_snapshot->>'total')::bigint + coalesce((select sum(c.diferencia) from public.correcciones_venta_entregada c where c.pedido_id=p.id),0))::bigint end) then 'parcial'
76:   end as estado_pago
77: from public.pedidos p
78: left join public.aplicaciones_pago a on a.pedido_id = p.id
79: left join public.pagos pa on pa.id = a.pago_id
83: create or replace function public.validar_aplicacion_pago()
90:   pago_actual public.pagos%rowtype;
91:   pedido_actual public.pedidos%rowtype;
92:   aplicado_pago bigint;
93:   aplicado_pedido bigint;
96:   select * into pago_actual from public.pagos where id = new.pago_id for update;
97:   if not found then raise exception 'Pago inexistente'; end if;
98:   if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;
100:   select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
101:   if not found then raise exception 'Pedido inexistente'; end if;
102:   if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then raise exception 'El pago y el pedido deben pertenecer al mismo cliente'; end if;
103:   if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;
105:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
106:   from public.aplicaciones_pago a
107:   join public.pagos p on p.id = a.pago_id
108:   where a.pago_id = new.pago_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
109:   if aplicado_pago + new.monto_aplicado > pago_actual.monto then raise exception 'La aplicación supera el monto disponible del pago'; end if;
111:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
112:   from public.aplicaciones_pago a
113:   join public.pagos p on p.id = a.pago_id
114:   where a.pedido_id = new.pedido_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
115:   if pedido_actual.regimen_contable='entrega_v1' then
117:     if pedido_actual.venta_reconocida_en is null or pedido_actual.estado<>'entregado'
118:       or pago_actual.estado<>'confirmado' then raise exception 'APLICACION_REQUIERE_VENTA_Y_PAGO_CONFIRMADOS'; end if;
119:     select ((pedido_actual.venta_definitiva_snapshot->>'total')::bigint + coalesce(sum(c.diferencia),0))::bigint
120:       into total_exigible from public.correcciones_venta_entregada c where c.pedido_id=pedido_actual.id;
122:     total_exigible := coalesce(pedido_actual.total_final, pedido_actual.total);
124:   if aplicado_pedido + new.monto_aplicado > total_exigible then raise exception 'La aplicación supera el saldo pendiente del pedido'; end if;
130: create function public.corregir_venta_entregada_administrativo(
131:  p_pedido_id uuid, p_version_esperada bigint, p_clave uuid, p_items jsonb, p_motivo text
134:  p public.pedidos%rowtype; e operativo_privado.entregas_definitivas%rowtype;
135:  i public.items_pedido%rowtype; pi public.preparacion_items_pedido%rowtype;
139:  modo text; regla text; diferencia bigint; ajuste uuid; correccion uuid;
142:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
143:  if p_motivo is null or btrim(p_motivo)='' or length(p_motivo)>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
144:  select cliente_id into cliente from public.pedidos where id=p_pedido_id;
148:  inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'correccion_venta_entregada',solicitud);
150:  select * into p from public.pedidos where id=p_pedido_id for update;
151:  if cliente is null or p.cliente_id is distinct from cliente then raise exception 'CLIENTE_INVALIDO'; end if;
153:  or p.venta_reconocida_en is null then raise exception 'VENTA_NO_CORREGIBLE'; end if;
154:  select * into e from operativo_privado.entregas_definitivas where pedido_id=p.id;
156:  or e.snapshot->>'tipo' not in ('todo_correcto','hubo_diferencias') then raise exception 'ORIGEN_ENTREGA_INVALIDO'; end if;
158:  if not exists(select 1 from operativo_privado.historial_operativo h where h.pedido_id=p.id
161:  raise exception 'OPERACION_ORIGINAL_NO_ENCONTRADA'; end if;
163:  where c.pedido_id=p.id order by c.version desc limit 1;
165:  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'ITEMS_INVALIDOS'; end if;
166:  if jsonb_array_length(p_items)=0 then raise exception 'ITEMS_INVALIDOS'; end if;
168:  if jsonb_typeof(entrada) is distinct from 'object' then raise exception 'ITEMS_INVALIDOS'; end if;
169:  if not (entrada ?& array['item_pedido_id','cantidad_entregada'])
170:  or entrada-array['item_pedido_id','cantidad_entregada']<>'{}'::jsonb
171:  or jsonb_typeof(entrada->'item_pedido_id') is distinct from 'string'
172:  or jsonb_typeof(entrada->'cantidad_entregada') is distinct from 'number' then raise exception 'ITEMS_INVALIDOS'; end if;
173:  perform (entrada->>'item_pedido_id')::uuid;
175:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
176:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
177:  if (select count(distinct (x->>'item_pedido_id')::uuid) from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items)
178:  or (select count(*) from public.items_pedido where pedido_id=p.id)<>jsonb_array_length(p_items)
180:  select 1 from public.items_pedido where pedido_id=p.id and id=(x->>'item_pedido_id')::uuid))
181:  then raise exception 'ITEMS_NO_CORRESPONDEN'; end if;
182:  for i in select * from public.items_pedido where pedido_id=p.id order by id loop
183:  select * into pi from public.preparacion_items_pedido where pedido_id=p.id and item_pedido_id=i.id;
185:  or pi.cantidad_preparada is null then raise exception 'AUTORIZACION_PREPARACION_AUSENTE'; end if;
187:  where (x->>'item_pedido_id')::uuid=i.id;
191:  then raise exception 'AUTORIZACION_ORIGINAL_INCONSISTENTE'; end if;
193:  where (x->>'item_pedido_id')::uuid=i.id;
195:  or cantidad<>round(cantidad,3) then raise exception 'CANTIDAD_INVALIDA'; end if;
201:  or (modo<>'kg_fraccionable' and cantidad<>trunc(cantidad)) then raise exception 'FORMATO_CANTIDAD_INVALIDO'; end if;
205:  elsif cantidad=i.cantidad then importe:=i.total_linea; regla:='total_pedido_autorizado';
206:  elsif i.total_final_administrativo is not null then raise exception 'TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_ENTREGADA';
208:  if importe is null or importe<0 or importe>9007199254740991 or importe<>trunc(importe) then raise exception 'IMPORTE_INVALIDO'; end if;
210:  where (x->>'item_pedido_id')::uuid=i.id;
211:  if not found then raise exception 'CADENA_CORRECCIONES_INVALIDA'; end if;
219:  if total is null or total<0 or total>9007199254740991 or subtotal>9007199254740991 then raise exception 'TOTAL_INVALIDO'; end if;
221:  if not cambio then raise exception 'CORRECCION_SIN_CAMBIOS'; end if;
224:  insert into public.ajustes_cuenta_cliente(cliente_id,tipo,monto,motivo,observacion,registrado_por,fecha_ajuste)
226:  'Corrección de venta del pedido '||p.id::text||'; operación original '||e.clave::text,auth.uid(),instante)
227:  returning id into ajuste;
229:  insert into public.correcciones_venta_entregada(pedido_id,cliente_id,operacion_original,version_original,
230:  version,clave,actor_id,fecha,motivo,anteriores,nuevos,diferencia,ajuste_id)
232:  anterior,nuevo,diferencia,ajuste) returning id into correccion;
233:  -- Sólo lectura: las aplicaciones y pagos originales permanecen íntegros.
234:  select coalesce(sum(a.monto_aplicado),0) into aplicado from public.aplicaciones_pago a
235:  join public.pagos pa on pa.id=a.pago_id where a.pedido_id=p.id and a.activa and pa.estado='confirmado';
236:  resultado:=jsonb_build_object('pedido_id',p.id,'correccion_id',correccion,'ajuste_id',ajuste,
238:  'saldo_pedido',total-aplicado,'deuda_pedido',greatest(total-aplicado,0),
239:  'credito_por_sobreaplicacion',greatest(aplicado-total,0));
243: alter function public.corregir_venta_entregada_administrativo(uuid,bigint,uuid,jsonb,text) owner to postgres;
246: alter function operativo_privado.proteger_ajuste_correccion() owner to postgres;
247: revoke all on function operativo_privado.proteger_ajuste_correccion() from public,anon,authenticated,service_role;
248: alter function public.validar_aplicacion_pago() owner to postgres;
249: revoke all on function public.validar_aplicacion_pago() from public,anon,authenticated,service_role;
251:  'Correcciones compensatorias inmutables entrega_v1. Diferencia en cuenta corriente sólo vía ajuste_id; originales intactos. Crédito por ajuste no reutiliza pagos.';

## supabase/migrations/20261108180000_centralizar_escrituras_contables.sql

10: create function operativo_privado.base_registrar_pago_cliente_administrativo(
13:   p_metodo_pago text,
18: returns table (pago_id uuid, monto bigint, monto_aplicado bigint, monto_disponible bigint)
22:   v_pago public.pagos%rowtype;
23:   v_pedido record;
24:   v_metodo text := lower(btrim(p_metodo_pago));
26:   v_aplicacion bigint;
29:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
30:   if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
31:   if p_monto is null or p_monto <= 0 then raise exception 'MONTO_INVALIDO'; end if;
32:   if v_metodo not in ('efectivo', 'transferencia', 'otro', 'tarjeta', 'pago_web') then raise exception 'METODO_PAGO_INVALIDO'; end if;
34:   if not found then raise exception 'CLIENTE_INVALIDO'; end if;
35:   select * into v_pago from public.pagos p where p.clave_idempotencia = p_clave_idempotencia for update;
37:     if v_pago.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
38:     select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa;
39:     return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
42:   insert into public.pagos (cliente_id, monto, metodo_pago, estado, referencia, observacion, registrado_por, fecha_pago, clave_idempotencia)
43:   values (p_cliente_id, p_monto, v_metodo::public.metodo_pago, 'confirmado', nullif(btrim(p_referencia), ''), nullif(btrim(p_observacion), ''), auth.uid(), now(), p_clave_idempotencia)
45:   returning * into v_pago;
46:   if v_pago.id is null then
47:     select * into v_pago from public.pagos p where p.clave_idempotencia = p_clave_idempotencia for update;
48:     if not found or v_pago.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
49:     select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa;
50:     return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
53:   perform 1 from public.pedidos p where p.cliente_id = p_cliente_id and p.estado <> 'cancelado' order by p.fecha_creacion, p.id for update;
55:   for v_pedido in select p.id, s.saldo_pendiente from public.pedidos p join public.v_saldos_pedidos s on s.pedido_id = p.id where p.cliente_id = p_cliente_id and p.estado <> 'cancelado' and s.saldo_pendiente > 0 order by p.fecha_creacion, p.id loop
57:     v_aplicacion := least(v_restante, v_pedido.saldo_pendiente);
58:     insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_pago.id, v_pedido.id, v_aplicacion);
59:     v_restante := v_restante - v_aplicacion;
62:   return query select v_pago.id, p_monto, v_monto_aplicado, v_restante;
66: create function operativo_privado.base_anular_pago_administrativo(p_pago_id uuid, p_motivo text)
71:   v_pago public.pagos%rowtype;
74:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
75:   if v_motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
76:   select * into v_pago from public.pagos p where p.id = p_pago_id for update;
77:   if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
78:   if v_pago.estado = 'anulado' then return v_pago.id; end if;
79:   if v_pago.estado <> 'confirmado' then raise exception 'ESTADO_PAGO_INVALIDO'; end if;
80:   perform 1 from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa for update;
81:   update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo where pago_id = v_pago.id and activa;
82:   update public.pagos set estado = 'anulado', fecha_anulacion = now(), anulado_por = auth.uid(), motivo_anulacion = v_motivo where id = v_pago.id;
83:   return v_pago.id;
87: create function operativo_privado.base_cancelar_pedido_administrativo(p_pedido_id uuid, p_motivo text)
92:   v_pedido public.pedidos%rowtype;
95:   if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
96:   if v_motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
97:   select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
98:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
99:   if v_pedido.estado = 'cancelado' then return v_pedido.id; end if;
100:   if v_pedido.estado not in ('recibido', 'en_revision', 'confirmado', 'programado', 'preparando') then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
101:   perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa for update;
102:   update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo where pedido_id = v_pedido.id and activa;
103:   update public.pedidos set estado = 'cancelado' where id = v_pedido.id;
104:   update public.historial_estados_pedido set observacion = v_motivo where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'cancelado' order by h.fecha_creacion desc, h.id desc limit 1);
105:   return v_pedido.id;
109: create function operativo_privado.base_cancelar_pedido_cliente(
110:   p_pedido_id uuid,
114:   pedido_id uuid,
115:   numero_pedido text,
116:   estado public.estado_pedido,
126:   v_pedido public.pedidos%rowtype;
131:     raise exception 'NO_AUTORIZADO';
138:   if not found then raise exception 'NO_AUTORIZADO'; end if;
140:     raise exception 'MOTIVO_DEMASIADO_LARGO';
143:   select * into v_pedido
144:   from public.pedidos p
145:   where p.id = p_pedido_id
148:   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
149:   if v_pedido.cliente_id is distinct from v_cliente_id then raise exception 'NO_AUTORIZADO'; end if;
151:   if v_pedido.estado = 'cancelado' then
152:     return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
155:   if v_pedido.estado <> 'recibido' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
159:   perform 1 from public.aplicaciones_pago a
160:   where a.pedido_id = v_pedido.id and a.activa
163:   update public.aplicaciones_pago a
165:   where a.pedido_id = v_pedido.id and a.activa;
167:   update public.pedidos set estado = 'cancelado'
168:   where id = v_pedido.id
169:   returning * into v_pedido;
171:   update public.historial_estados_pedido h
174:     select ultimo.id from public.historial_estados_pedido ultimo
175:     where ultimo.pedido_id = v_pedido.id and ultimo.estado_nuevo = 'cancelado'
180:   return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
184: -- Snapshot privado por pedido: también incluye estado del pago compartido.
186: create function operativo_privado.snapshot_contable(p_pedido uuid)
188:  select jsonb_build_object('estado',p.estado,'aplicaciones',coalesce((
189:    select jsonb_agg(jsonb_build_object('aplicacion',to_jsonb(a),'pago',to_jsonb(pa)) order by a.id)
190:    from public.aplicaciones_pago a join public.pagos pa on pa.id=a.pago_id
191:    where a.pedido_id=p.id
192:  ),'[]'::jsonb)) from public.pedidos p where p.id=p_pedido
196: -- Cliente -> pagos UUID -> pedidos UUID -> aplicaciones UUID -> versiones.
197: -- La entrega ya toma cliente antes del pedido: se serializa con este núcleo.
198: -- Se bloquea el agregado completo para cubrir un pago aplicado a varios pedidos.
200: create function operativo_privado.escribir_contabilidad(p_operacion text,p_args jsonb)
203:  cliente uuid; cliente_inicial uuid; pedido uuid := (p_args->>'pedido_id')::uuid;
204:  pago uuid := (p_args->>'pago_id')::uuid;
211:  if p_operacion='cancelar_pedido_cliente' then
212:    if auth.uid() is null or coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
214:    if not found then raise exception 'NO_AUTORIZADO'; end if;
215:    if motivo is not null and char_length(motivo)>400 then raise exception 'MOTIVO_DEMASIADO_LARGO'; end if;
216:  elsif p_operacion in ('registrar_pago_cliente_administrativo','anular_pago_administrativo','cancelar_pedido_administrativo') then
217:    if not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
218:    if p_operacion='registrar_pago_cliente_administrativo' then
219:      if (p_args->>'clave')::uuid is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
220:      if (p_args->>'monto')::bigint is null or (p_args->>'monto')::bigint<=0 then raise exception 'MONTO_INVALIDO'; end if;
221:      if lower(btrim(p_args->>'metodo')) not in ('efectivo','transferencia','otro','tarjeta','pago_web') then raise exception 'METODO_PAGO_INVALIDO'; end if;
224:      if motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
225:      if p_operacion='anular_pago_administrativo' then
226:        select pa.cliente_id into cliente from public.pagos pa where pa.id=pago;
227:        if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
229:        select p.cliente_id into cliente from public.pedidos p where p.id=pedido;
230:        if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
233:  else raise exception 'OPERACION_INVALIDA';
237:  -- No bloquear un pago ajeno por una clave ya usada: evita ciclos entre
239:  if p_operacion='registrar_pago_cliente_administrativo' then
241:      raise exception 'CLIENTE_INVALIDO';
243:    if exists(select 1 from public.pagos pa where pa.clave_idempotencia=(p_args->>'clave')::uuid
244:      and pa.cliente_id is distinct from cliente) then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
246:  perform 1 from public.pagos pa where pa.cliente_id=cliente order by pa.id for update;
247:  perform 1 from public.pedidos p where p.cliente_id=cliente or p.id=pedido order by p.id for update;
249:  if pedido is not null then
250:    select p.cliente_id into cliente from public.pedidos p where p.id=pedido;
251:    if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
252:    if cliente is distinct from cliente_inicial then raise exception 'NO_AUTORIZADO'; end if;
254:  if pago is not null then
255:    select pa.cliente_id into cliente from public.pagos pa where pa.id=pago;
256:    if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
257:    if cliente is distinct from cliente_inicial then raise exception 'CLIENTE_INVALIDO'; end if;
259:  perform 1 from public.aplicaciones_pago a
260:  where a.pago_id in (select pa.id from public.pagos pa where pa.cliente_id=cliente_inicial)
261:     or a.pedido_id in (select p.id from public.pedidos p where p.cliente_id=cliente_inicial or p.id=pedido)
263:  for fila in select p.id from public.pedidos p
264:    where (p.cliente_id=cliente_inicial or p.id=pedido) and p.regimen_contable='entrega_v1' order by p.id loop
268:  when 'registrar_pago_cliente_administrativo' then
269:    select to_jsonb(r) into resultado from operativo_privado.base_registrar_pago_cliente_administrativo(
271:  when 'anular_pago_administrativo' then
272:    resultado:=jsonb_build_object('id',operativo_privado.base_anular_pago_administrativo(pago,p_args->>'motivo'));
273:  when 'cancelar_pedido_administrativo' then
274:    resultado:=jsonb_build_object('id',operativo_privado.base_cancelar_pedido_administrativo(pedido,p_args->>'motivo'));
275:  when 'cancelar_pedido_cliente' then
276:    select to_jsonb(r) into resultado from operativo_privado.base_cancelar_pedido_cliente(pedido,p_args->>'motivo') r;
280:  -- operativas y cancelar_pedido_cliente autoriza propietario, no administrador.
281:  -- La versión se lee y avanza bajo el mismo lock de pedido de las entregas.
285:    -- Validar el estado resultante completo, no sólo la última aplicación.
286:    -- Los pagos compartidos se suman sobre TODOS sus pedidos (también legado).
287:    if exists(select 1 from public.aplicaciones_pago a
288:      join public.pagos pa on pa.id=a.pago_id join public.pedidos p on p.id=a.pedido_id
289:      where a.pedido_id=fila.id and a.activa and
292:      raise exception 'APLICACIONES_ACTIVAS_INCONSISTENTES';
294:    if exists(select 1 from public.pagos pa where pa.id in
295:        (select a.pago_id from public.aplicaciones_pago a where a.pedido_id=fila.id and a.activa)
296:      and (select coalesce(sum(a.monto_aplicado::numeric),0) from public.aplicaciones_pago a
297:        where a.pago_id=pa.id and a.activa)>pa.monto) then
298:      raise exception 'APLICACIONES_SUPERAN_PAGO';
301:      from public.aplicaciones_pago a where a.pedido_id=fila.id and a.activa;
303:      select s.total_pedido into total_exigible from public.v_saldos_pedidos s where s.pedido_id=fila.id;
305:        raise exception 'APLICACIONES_SUPERAN_VENTA';
308:    insert into operativo_privado.versiones_pedido(pedido_id) values(fila.id) on conflict(pedido_id) do nothing;
309:    select v.version into version_anterior from operativo_privado.versiones_pedido v where v.pedido_id=fila.id for update;
310:    update operativo_privado.versiones_pedido v set version=v.version+1
311:      where v.pedido_id=fila.id and v.version=version_anterior returning v.version into version_nueva;
312:    if not found then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
313:    insert into operativo_privado.historial_operativo(pedido_id,operacion,actor_id,motivo,
323: create or replace function public.registrar_pago_cliente_administrativo(
324:  p_cliente_id uuid,p_monto bigint,p_metodo_pago text,p_referencia text,p_observacion text,p_clave_idempotencia uuid
325: ) returns table(pago_id uuid,monto bigint,monto_aplicado bigint,monto_disponible bigint)
329:  r:=operativo_privado.escribir_contabilidad('registrar_pago_cliente_administrativo',jsonb_build_object(
330:    'cliente_id',p_cliente_id,'monto',p_monto,'metodo',p_metodo_pago,'referencia',p_referencia,'observacion',p_observacion,'clave',p_clave_idempotencia));
331:  return query select (r->>'pago_id')::uuid,(r->>'monto')::bigint,(r->>'monto_aplicado')::bigint,(r->>'monto_disponible')::bigint;
333: create or replace function public.anular_pago_administrativo(p_pago_id uuid,p_motivo text)
336:  return (operativo_privado.escribir_contabilidad('anular_pago_administrativo',jsonb_build_object('pago_id',p_pago_id,'motivo',p_motivo))->>'id')::uuid;
338: create or replace function public.cancelar_pedido_administrativo(p_pedido_id uuid,p_motivo text)
341:  return (operativo_privado.escribir_contabilidad('cancelar_pedido_administrativo',jsonb_build_object('pedido_id',p_pedido_id,'motivo',p_motivo))->>'id')::uuid;
343: create or replace function public.cancelar_pedido_cliente(p_pedido_id uuid,p_motivo text default null)
344: returns table(pedido_id uuid,numero_pedido text,estado public.estado_pedido,cliente_id uuid,fecha_entrega date)
348:  r:=operativo_privado.escribir_contabilidad('cancelar_pedido_cliente',jsonb_build_object('pedido_id',p_pedido_id,'motivo',p_motivo));
349:  return query select (r->>'pedido_id')::uuid,r->>'numero_pedido',(r->>'estado')::public.estado_pedido,(r->>'cliente_id')::uuid,(r->>'fecha_entrega')::date;
353: create or replace function public.validar_aplicacion_pago()
360:   pago_actual public.pagos%rowtype;
361:   pedido_actual public.pedidos%rowtype;
362:   aplicado_pago bigint;
363:   aplicado_pedido bigint;
366:   if not new.activa and exists(select 1 from public.pedidos p
367:     where p.id=new.pedido_id and p.regimen_contable='entrega_v1') then return new; end if;
368:   select * into pago_actual from public.pagos where id = new.pago_id for update;
369:   if not found then raise exception 'Pago inexistente'; end if;
370:   if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;
372:   select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
373:   if not found then raise exception 'Pedido inexistente'; end if;
374:   if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then raise exception 'El pago y el pedido deben pertenecer al mismo cliente'; end if;
375:   if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;
377:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
378:   from public.aplicaciones_pago a
379:   join public.pagos p on p.id = a.pago_id
380:   where a.pago_id = new.pago_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
381:   if aplicado_pago + new.monto_aplicado > pago_actual.monto then raise exception 'La aplicación supera el monto disponible del pago'; end if;
383:   select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
384:   from public.aplicaciones_pago a
385:   join public.pagos p on p.id = a.pago_id
386:   where a.pedido_id = new.pedido_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
387:   if pedido_actual.regimen_contable='entrega_v1' then
388:     if new.monto_aplicado is null or new.monto_aplicado<=0 then raise exception 'MONTO_APLICACION_INVALIDO'; end if;
389:     if pedido_actual.venta_reconocida_en is null or pedido_actual.estado<>'entregado'
390:       or pago_actual.estado<>'confirmado' then raise exception 'APLICACION_REQUIERE_VENTA_Y_PAGO_CONFIRMADOS'; end if;
391:     select ((pedido_actual.venta_definitiva_snapshot->>'total')::bigint + coalesce(sum(c.diferencia),0))::bigint
392:       into total_exigible from public.correcciones_venta_entregada c where c.pedido_id=pedido_actual.id;
394:     total_exigible := coalesce(pedido_actual.total_final, pedido_actual.total);
396:   if pedido_actual.regimen_contable='entrega_v1' and (total_exigible is null or total_exigible<0) then
397:     raise exception 'TOTAL_VENTA_INVALIDO';
399:   if aplicado_pedido + new.monto_aplicado > total_exigible then raise exception 'La aplicación supera el saldo pendiente del pedido'; end if;
404: alter function operativo_privado.base_registrar_pago_cliente_administrativo(uuid,bigint,text,text,text,uuid) owner to postgres;
405: revoke all on function operativo_privado.base_registrar_pago_cliente_administrativo(uuid,bigint,text,text,text,uuid) from public,anon,authenticated,service_role;
407: alter function operativo_privado.base_anular_pago_administrativo(uuid,text) owner to postgres;
408: revoke all on function operativo_privado.base_anular_pago_administrativo(uuid,text) from public,anon,authenticated,service_role;
410: alter function operativo_privado.base_cancelar_pedido_administrativo(uuid,text) owner to postgres;
411: revoke all on function operativo_privado.base_cancelar_pedido_administrativo(uuid,text) from public,anon,authenticated,service_role;
413: alter function operativo_privado.base_cancelar_pedido_cliente(uuid,text) owner to postgres;
414: revoke all on function operativo_privado.base_cancelar_pedido_cliente(uuid,text) from public,anon,authenticated,service_role;
416: alter function operativo_privado.snapshot_contable(uuid) owner to postgres;
419: alter function operativo_privado.escribir_contabilidad(text,jsonb) owner to postgres;
422: alter function public.registrar_pago_cliente_administrativo(uuid,bigint,text,text,text,uuid) owner to postgres;
424: alter function public.anular_pago_administrativo(uuid,text) owner to postgres;
426: alter function public.cancelar_pedido_administrativo(uuid,text) owner to postgres;
428: alter function public.cancelar_pedido_cliente(uuid,text) owner to postgres;
430: alter function public.validar_aplicacion_pago() owner to postgres;
431: revoke all on function public.validar_aplicacion_pago() from public,anon,authenticated,service_role;

## supabase/migrations/20261108190000_cerrar_dml_directo_pagos_authenticated.sql

21:     raise exception 'Cierre bloqueado: authenticated es superusuario; revocar grants no limita su DML';
25:     'public.pagos'::regclass,
26:     'public.aplicaciones_pago'::regclass
36:       raise exception
64:     'public.pagos'::regclass,
65:     'public.aplicaciones_pago'::regclass
69:       raise exception

## supabase/migrations/20261108200000_corregir_pagos_administrativo_auditado.sql

3: -- Contrato: un pago original -> reverso y cero o varios pagos compensatorios.
4: -- [] significa reverso puro. Un pago mixto se representa con dos reemplazos.
5: -- Cada reemplazo: {monto,metodo,referencia,aplicaciones:[{pedido_id,monto}]}.
7: -- Las aplicaciones son explícitas: nunca se ejecuta FIFO en una corrección.
8: -- Sólo se pueden reaplicar importes a pedidos con aplicación ORIGINAL activa.
9: -- Un excedente se deja sin aplicar; no se crea un ajuste ni un segundo abono.
10: -- anteriores_esperados debe coincidir con snapshot_pago completo; versiones
11: -- contiene exactamente todos los pedidos vinculados (también históricos y
15: create table operativo_privado.correcciones_pago (
18:  pago_original_id uuid not null unique references public.pagos(id) on delete restrict,
19:  cliente_id uuid not null references public.clientes(id) on delete restrict,
28: alter table operativo_privado.correcciones_pago owner to postgres;
29: alter table operativo_privado.correcciones_pago enable row level security;
30: alter table operativo_privado.correcciones_pago force row level security;
31: revoke all on operativo_privado.correcciones_pago from public,anon,authenticated,service_role;
32: create trigger correcciones_pago_inmutables before update or delete
33:  on operativo_privado.correcciones_pago for each row
34:  execute function operativo_privado.impedir_mutacion_historial();
35: create trigger correcciones_pago_no_truncables before truncate
36:  on operativo_privado.correcciones_pago for each statement
37:  execute function operativo_privado.impedir_mutacion_historial();
39: create function operativo_privado.snapshot_pago(p_pago_id uuid)
41:  select jsonb_build_object('pago',to_jsonb(p),'aplicaciones',coalesce((
42:   select jsonb_agg(to_jsonb(a) order by a.id) from public.aplicaciones_pago a
43:   where a.pago_id=p.id),'[]'::jsonb)) from public.pagos p where p.id=p_pago_id
47: -- del agregado adquiridos por escribir_correccion_pago. No usa registro FIFO.
49: create function operativo_privado.insertar_reemplazo_pago(
52: declare pago_nuevo uuid; aplicacion jsonb;
54:  insert into public.pagos(cliente_id,monto,metodo_pago,estado,referencia,observacion,
55:   registrado_por,fecha_pago,clave_idempotencia)
56:  values(p_cliente,(p_entrada->>'monto')::bigint,(p_entrada->>'metodo')::public.metodo_pago,'confirmado',
57:   p_entrada->>'referencia','Compensación de pago '||p_original::text||'; corrección '||p_correccion::text,
58:   auth.uid(),p_fecha,gen_random_uuid()) returning id into pago_nuevo;
59:  for aplicacion in select value from jsonb_array_elements(p_entrada->'aplicaciones')
60:   order by (value->>'pedido_id')::uuid loop
61:   insert into public.aplicaciones_pago(pago_id,pedido_id,monto_aplicado)
62:   values(pago_nuevo,(aplicacion->>'pedido_id')::uuid,(aplicacion->>'monto')::bigint);
64:  return pago_nuevo;
69: create function operativo_privado.escribir_correccion_pago(
70:  p_pago_id uuid,p_clave uuid,p_anteriores_esperados jsonb,
74:  actor uuid := auth.uid(); cliente uuid; original public.pagos%rowtype;
75:  evento operativo_privado.correcciones_pago%rowtype;
77:  pedidos_antes jsonb := '{}'::jsonb; pedidos_tras_reverso jsonb := '{}'::jsonb; versiones_actuales jsonb := '{}'::jsonb;
78:  reemplazos_nuevos jsonb := '[]'::jsonb; pagos_nuevos uuid[] := '{}'::uuid[];
79:  entrada jsonb; aplicacion jsonb; fila record; pago_nuevo uuid;
80:  v_pedido_destino uuid; monto bigint; suma numeric; total_nuevo numeric := 0;
84:  if actor is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
85:  if p_clave is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
86:  if p_motivo is null or btrim(p_motivo)='' or length(p_motivo)>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
87:  if p_pago_id is null or jsonb_typeof(p_anteriores_esperados) is distinct from 'object'
89:  or jsonb_typeof(p_reemplazos) is distinct from 'array' then raise exception 'SOLICITUD_INVALIDA'; end if;
90:  solicitud:=jsonb_build_object('contrato',1,'pago_id',p_pago_id,'anteriores_esperados',p_anteriores_esperados,
94:  perform pg_advisory_xact_lock(hashtextextended('correccion_pago:'||p_clave::text,0));
95:  select * into evento from operativo_privado.correcciones_pago where clave=p_clave;
98:    raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
102:  select p.cliente_id into cliente from public.pagos p where p.id=p_pago_id;
103:  if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
104:  -- Cliente -> TODOS los pagos UUID -> TODOS los pedidos UUID -> aplicaciones
107:  if not found then raise exception 'CLIENTE_INVALIDO'; end if;
108:  perform 1 from public.pagos p where p.cliente_id=cliente order by p.id for update;
109:  perform 1 from public.pedidos p where p.cliente_id=cliente order by p.id for update;
110:  perform 1 from public.aplicaciones_pago a where
111:   a.pago_id in (select p.id from public.pagos p where p.cliente_id=cliente)
112:   or a.pedido_id in (select p.id from public.pedidos p where p.cliente_id=cliente)
114:  select * into original from public.pagos p where p.id=p_pago_id;
115:  if not found or original.cliente_id is distinct from cliente then raise exception 'CLIENTE_INVALIDO'; end if;
116:  if original.estado<>'confirmado' then raise exception 'PAGO_NO_CORREGIBLE'; end if;
117:  anterior:=operativo_privado.snapshot_pago(p_pago_id);
118:  if anterior is distinct from p_anteriores_esperados then raise exception 'PAGO_CONCURRENCIA_CONFLICTO'; end if;
120:  if exists(select 1 from public.aplicaciones_pago a join public.pedidos p on p.id=a.pedido_id
121:   where a.pago_id=p_pago_id and p.cliente_id is distinct from cliente) then
122:   raise exception 'APLICACIONES_CLIENTE_INCONSISTENTE';
124:  for fila in select p.id from public.pedidos p where p.id in (
125:   select a.pedido_id from public.aplicaciones_pago a where a.pago_id=p_pago_id) order by p.id loop
126:   insert into operativo_privado.versiones_pedido(pedido_id) values(fila.id) on conflict do nothing;
127:   select v.version into version_actual from operativo_privado.versiones_pedido v where v.pedido_id=fila.id for update;
129:   pedidos_antes:=pedidos_antes||jsonb_build_object(fila.id::text,operativo_privado.snapshot_contable(fila.id));
131:  if versiones_actuales is distinct from p_versiones then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
133:  -- escribir evento. La única repetición válida ya retornó correcciones_pago.
134:  if exists(select 1 from operativo_privado.historial_operativo h
135:   where h.pedido_id in (select key::uuid from jsonb_each(pedidos_antes))
136:    and h.clave_idempotencia=p_clave) then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
138:  -- duplicados por pago, fracciones, importes negativos ni métodos ambiguos.
141:   or not (entrada ?& array['monto','metodo','referencia','aplicaciones'])
142:   or entrada-array['monto','metodo','referencia','aplicaciones']<>'{}'::jsonb
147:   or jsonb_typeof(entrada->'aplicaciones') is distinct from 'array' then raise exception 'REEMPLAZO_INVALIDO'; end if;
149:   or (entrada->>'monto')::numeric<=0 or (entrada->>'monto')::numeric>9007199254740991 then raise exception 'MONTO_INVALIDO'; end if;
152:   if total_nuevo>9007199254740991 then raise exception 'MONTO_INVALIDO'; end if;
154:   for aplicacion in select value from jsonb_array_elements(entrada->'aplicaciones') loop
155:    if jsonb_typeof(aplicacion) is distinct from 'object'
156:    or not (aplicacion ?& array['pedido_id','monto'])
157:    or aplicacion-array['pedido_id','monto']<>'{}'::jsonb
158:    or jsonb_typeof(aplicacion->'pedido_id') is distinct from 'string'
159:    or jsonb_typeof(aplicacion->'monto') is distinct from 'number' then raise exception 'APLICACION_INVALIDA'; end if;
160:    v_pedido_destino:=(aplicacion->>'pedido_id')::uuid;
161:    if (aplicacion->>'monto')::numeric<>trunc((aplicacion->>'monto')::numeric)
162:    or (aplicacion->>'monto')::numeric<=0 or (aplicacion->>'monto')::numeric>monto then raise exception 'MONTO_APLICACION_INVALIDO'; end if;
163:    suma:=suma+(aplicacion->>'monto')::numeric;
164:    if not exists(select 1 from public.aplicaciones_pago a where a.pago_id=p_pago_id
165:     and a.pedido_id=v_pedido_destino and a.activa) then raise exception 'PEDIDO_FUERA_DEL_PAGO_ORIGINAL'; end if;
167:   if suma>monto then raise exception 'APLICACIONES_SUPERAN_PAGO'; end if;
168:   if (select count(distinct (a->>'pedido_id')::uuid) from jsonb_array_elements(entrada->'aplicaciones') a)
169:    <>jsonb_array_length(entrada->'aplicaciones') then raise exception 'APLICACION_DUPLICADA'; end if;
171:  -- Reverso operativo existente: conserva monto, método, fecha y aplicaciones
172:  -- originales, marca anulación con actor/fecha/motivo y genera su historial.
173:  perform public.anular_pago_administrativo(p_pago_id,p_motivo);
175:  -- aplicación era histórica/inactiva: snapshot_contable incluye el pago entero.
177:  -- el snapshot original conservado en pedidos_antes/correcciones_pago.
178:  for fila in select key::uuid as id from jsonb_each(pedidos_antes) order by key loop
179:   pedidos_tras_reverso:=pedidos_tras_reverso||jsonb_build_object(
183:  -- del núcleo crea NUEVOS pagos y aplicaciones explícitas con el validador
184:  -- vigente; no modifica ni reaplica pagos de terceros, ni cambia ventas.
186:   pago_nuevo:=operativo_privado.insertar_reemplazo_pago(cliente,entrada,p_pago_id,correccion,instante);
187:   pagos_nuevos:=array_append(pagos_nuevos,pago_nuevo);
188:   reemplazos_nuevos:=reemplazos_nuevos||jsonb_build_array(operativo_privado.snapshot_pago(pago_nuevo));
191:  -- y los reemplazos confirmados UNA vez; no hay ajustes de cuenta adicionales.
193:  if saldo is null then raise exception 'CUENTA_CLIENTE_NO_ENCONTRADA'; end if;
194:  nuevo:=jsonb_build_object('original',operativo_privado.snapshot_pago(p_pago_id),'reemplazos',reemplazos_nuevos);
195:  resultado:=jsonb_build_object('correccion_id',correccion,'pago_original_id',p_pago_id,
196:   'pagos_reemplazo',to_jsonb(pagos_nuevos),'cliente_id',cliente,'saldo_cuenta',saldo,
201:  for fila in select key::uuid as id,value as anterior from jsonb_each(pedidos_antes) order by key loop
202:   select v.version into version_actual from operativo_privado.versiones_pedido v where v.pedido_id=fila.id;
203:   perform operativo_privado.completar_operacion(fila.id,version_actual,p_clave,'correccion_pago_administrativo',
206:     then pedidos_tras_reverso->fila.id::text else fila.anterior end,
209:  -- También existe este evento cuando el pago no tiene NINGÚN pedido; no se
210:  -- inventa un pedido para poder usar historial_operativo.
211:  insert into operativo_privado.correcciones_pago(id,clave,pago_original_id,cliente_id,actor_id,fecha,
213:  values(correccion,p_clave,p_pago_id,cliente,actor,instante,p_motivo,solicitud,
214:   jsonb_build_object('original',anterior,'pedidos',pedidos_antes),nuevo,resultado);
218: create function public.corregir_pago_administrativo(
219:  p_pago_id uuid,p_clave uuid,p_anteriores_esperados jsonb,
223:  return operativo_privado.escribir_correccion_pago(p_pago_id,p_clave,p_anteriores_esperados,
227: alter function operativo_privado.insertar_reemplazo_pago(uuid,jsonb,uuid,uuid,timestamptz) owner to postgres;
228: revoke all on function operativo_privado.insertar_reemplazo_pago(uuid,jsonb,uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
229: alter function operativo_privado.snapshot_pago(uuid) owner to postgres;
230: alter function operativo_privado.escribir_correccion_pago(uuid,uuid,jsonb,jsonb,jsonb,text) owner to postgres;
231: alter function public.corregir_pago_administrativo(uuid,uuid,jsonb,jsonb,jsonb,text) owner to postgres;
232: revoke all on function operativo_privado.snapshot_pago(uuid) from public,anon,authenticated,service_role;
233: revoke all on function operativo_privado.escribir_correccion_pago(uuid,uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;
234: revoke all on function public.corregir_pago_administrativo(uuid,uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;
235: comment on function public.corregir_pago_administrativo(uuid,uuid,jsonb,jsonb,jsonb,text) is

## supabase/migrations/20261109100000_crear_base_produccion.sql

6: create table public.produccion_lugares (
16: create table public.produccion_unidades (
25:  foreign key(lugar_id,tipo_lugar) references public.produccion_lugares(id,tipo) on delete restrict,
32: create table public.produccion_configuraciones_unidad (
42:  foreign key(unidad_id,tipo_unidad) references public.produccion_unidades(id,tipo) on delete restrict,
48: create table public.produccion_actividades (
54:  foreign key(unidad_id,tipo_unidad) references public.produccion_unidades(id,tipo) on delete restrict,
58: create table public.produccion_actividad_versiones (
73:  foreign key(actividad_id,tipo_unidad) references public.produccion_actividades(id,tipo_unidad) on delete restrict,
93: create table produccion_privado.operaciones (
101: create function produccion_privado.impedir_mutacion() returns trigger
103: begin raise exception 'PRODUCCION_REGISTRO_INMUTABLE'; end; $$;
104: create function produccion_privado.exigir_unidad_gallinero() returns trigger
108:  raise exception 'GALLINERO_REQUIERE_UNIDAD_AVICOLA'; end if;
111: create constraint trigger produccion_gallinero_completo after insert on public.produccion_lugares
112:  deferrable initially deferred for each row execute function produccion_privado.exigir_unidad_gallinero();
114: create function produccion_privado.validar_version() returns trigger
122:  or anterior.evento='anulacion' then raise exception 'SECUENCIA_VERSION_INVALIDA'; end if;
125:  then raise exception 'ANULACION_DEBE_CONSERVAR_DATOS'; end if;
128: create trigger produccion_validar_version before insert on public.produccion_actividad_versiones
129:  for each row execute function produccion_privado.validar_version();
131: create function produccion_privado.exigir_version_original() returns trigger
135:  raise exception 'ACTIVIDAD_REQUIERE_VERSION_ORIGINAL'; end if;
138: create constraint trigger produccion_actividad_completa after insert on public.produccion_actividades
139:  deferrable initially deferred for each row execute function produccion_privado.exigir_version_original();
142: create function produccion_privado.exigir_administrador() returns void
146:  raise exception 'NO_AUTORIZADO' using errcode='42501'; end if;
151: create function produccion_privado.escribir(p_clave uuid,p_solicitud jsonb) returns jsonb
165:  if p_clave is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
170:    raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
183:   if not found then raise exception 'LUGAR_NO_ENCONTRADO'; end if;
190:   if not found then raise exception 'UNIDAD_NO_ENCONTRADA'; end if;
198:    if not found then raise exception 'UNIDAD_NO_ENCONTRADA'; end if;
203:    if not found then raise exception 'ACTIVIDAD_NO_ENCONTRADA'; end if;
206:     raise exception 'VERSION_PRODUCCION_CONFLICTO'; end if;
207:    if anterior.evento='anulacion' then raise exception 'ACTIVIDAD_ANULADA'; end if;
223:  else raise exception 'OPERACION_PRODUCCION_INVALIDA';
229: create function public.crear_lugar_produccion(p_clave_idempotencia uuid, p_tipo text, p_nombre text, p_observaciones text)
233: alter function public.crear_lugar_produccion(uuid,text,text,text) owner to postgres;
237: create function public.crear_unidad_produccion(p_clave_idempotencia uuid, p_lugar_id uuid, p_tipo text, p_nombre text, p_observaciones text)
241: alter function public.crear_unidad_produccion(uuid,uuid,text,text,text) owner to postgres;
245: create function public.configurar_unidad_produccion(p_clave_idempotencia uuid, p_unidad_id uuid, p_vigente_desde date, p_capacidad_lechugas integer, p_cantidad_gallinas integer, p_observaciones text)
249: alter function public.configurar_unidad_produccion(uuid,uuid,date,integer,integer,text) owner to postgres;
253: create function public.registrar_actividad_produccion(p_clave_idempotencia uuid, p_unidad_id uuid, p_fecha_operativa date, p_tipo_actividad text, p_cantidad numeric, p_unidad_medida text, p_observaciones text)
257: alter function public.registrar_actividad_produccion(uuid,uuid,date,text,numeric,text,text) owner to postgres;
261: create function public.corregir_actividad_produccion(p_clave_idempotencia uuid, p_actividad_id uuid, p_version_esperada bigint, p_fecha_operativa date, p_tipo_actividad text, p_cantidad numeric, p_unidad_medida text, p_observaciones text, p_motivo text)
265: alter function public.corregir_actividad_produccion(uuid,uuid,bigint,date,text,numeric,text,text,text) owner to postgres;
269: create function public.anular_actividad_produccion(p_clave_idempotencia uuid, p_actividad_id uuid, p_version_esperada bigint, p_motivo text)
273: alter function public.anular_actividad_produccion(uuid,uuid,bigint,text) owner to postgres;
283:   execute format('alter table public.%I owner to postgres',tabla);
284:   execute format('alter table public.%I enable row level security',tabla);
285:   execute format('alter table public.%I force row level security',tabla);
289:   execute format('create trigger produccion_inmutable before update or delete on public.%I for each row execute function produccion_privado.impedir_mutacion()',tabla);
290:   execute format('create trigger produccion_no_truncable before truncate on public.%I for each statement execute function produccion_privado.impedir_mutacion()',tabla);
293: alter table produccion_privado.operaciones owner to postgres;
294: alter table produccion_privado.operaciones enable row level security;
295: alter table produccion_privado.operaciones force row level security;
297: create trigger produccion_operaciones_inmutables before update or delete on produccion_privado.operaciones
298:  for each row execute function produccion_privado.impedir_mutacion();
299: create trigger produccion_operaciones_no_truncables before truncate on produccion_privado.operaciones
300:  for each statement execute function produccion_privado.impedir_mutacion();
301: alter function produccion_privado.impedir_mutacion() owner to postgres;
302: alter function produccion_privado.exigir_unidad_gallinero() owner to postgres;
303: alter function produccion_privado.validar_version() owner to postgres;
304: alter function produccion_privado.exigir_version_original() owner to postgres;
305: alter function produccion_privado.exigir_administrador() owner to postgres;
306: alter function produccion_privado.escribir(uuid,jsonb) owner to postgres;
309:  'Historial inmutable: versión 1 original, última versión estado actual. Anulación terminal; no sumar versiones históricas.';

## supabase/manual/configurar_hora_limite_entrega.sql

1: -- Aplicar manualmente después de 20261108120000_fijar_corte_pedidos_mismo_dia.sql.
8: alter table public.dias_entrega
9:   drop constraint if exists dias_entrega_hora_corte_fija_check;
10: alter table public.dias_entrega
11:   drop constraint if exists dias_entrega_hora_corte_minutos_check;
12: alter table public.dias_entrega
16: create or replace function public.guardar_hora_corte_administrativa(p_hora_corte time)
21:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
25:     raise exception 'HORA_CORTE_INVALIDA';
29:     raise exception 'DIAS_ENTREGA_VACIOS';
36: alter function public.guardar_hora_corte_administrativa(time) owner to postgres;
42: -- Se conserva la firma usada también por la sobrecarga de tres argumentos.
43: create or replace function public.guardar_dia_entrega_administrativo(
56:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
59:     raise exception 'DIA_SEMANA_INVALIDO';
61:   if p_activo is null then raise exception 'ACTIVO_INVALIDO'; end if;
63:     raise exception 'ANTICIPACION_CORTE_INVALIDA';
70:     raise exception 'HORA_CORTE_INVALIDA';
80: alter function public.guardar_dia_entrega_administrativo(smallint, boolean, time, smallint) owner to postgres;

## supabase/manual/corregir_guardado_hora_limite_entrega.sql

1: -- Ejecutar manualmente en el MISMO proyecto Supabase utilizado por la aplicación.
7: create or replace function public.guardar_hora_corte_administrativa(p_hora_corte time)
12:     raise exception 'NO_AUTORIZADO' using errcode = '42501';
16:     raise exception 'HORA_CORTE_INVALIDA';
20:     raise exception 'DIAS_ENTREGA_VACIOS';
27: alter function public.guardar_hora_corte_administrativa(time) owner to postgres;

## supabase/manual/diagnostico_contrato_rutas_fase3.sql

4: -- No invoca RPC de negocio, no lee pedidos ni cambia funciones/permisos/datos.
12: ('public.operar_ruta_multiple(jsonb)', 'operar_ruta_multiple', '3e7bedaabab7ed3dd7058cafa3fb1f21', convert_from(decode('0a6465636c6172652073206a736f6e623a3d705f736f6c6963697475643b20616363696f6e20746578743a3d732d3e3e27616363696f6e273b2072696420757569643a3d28732d3e3e277275746127293a3a757569643b0a206620646174653a3d28732d3e3e27666563686127293a3a646174653b20636c61766520757569643a3d28732d3e3e27636c61766527293a3a757569643b2076657220626967696e743a3d28732d3e3e2776657273696f6e27293a3a626967696e743b0a2072206f706572617469766f5f7072697661646f2e72757461735f6d756c746925726f77747970653b2068206f706572617469766f5f7072697661646f2e727574615f6d756c74695f6576656e746f7325726f77747970653b0a2070207075626c69632e70656469646f7325726f77747970653b20707620626967696e743b20616e746573206a736f6e623b20726573756c7461646f206a736f6e623b2063616e74696461646573206a736f6e623b207072657020746578743b2069647320757569645b5d3b20757320757569645b5d3b0a20657361646d696e20626f6f6c65616e3b206974206a736f6e623b2068697374206f706572617469766f5f7072697661646f2e686973746f7269616c5f6f706572617469766f25726f77747970653b0a626567696e0a2069662063757272656e745f73657474696e6728277472616e73616374696f6e5f69736f6c6174696f6e27293c3e277265616420636f6d6d697474656427207468656e20726169736520657863657074696f6e20274149534c414d49454e544f5f4e4f5f434f4d50415449424c45273b20656e642069663b0a20657361646d696e3a3d617574682e7569642829206973206e6f74206e756c6c20616e6420636f616c65736365287075626c69632e65735f61646d696e28292c66616c7365293b0a20696620617574682e7569642829206973206e756c6c206f7220286e6f7420657361646d696e20616e64206e6f74207075626c69632e61636365736f5f72657061727469646f72282929207468656e20726169736520657863657074696f6e20274e4f5f4155544f52495a41444f273b20656e642069663b0a2069662073206973206e756c6c206f72206a736f6e625f747970656f662873293c3e276f626a65637427206f7220726964206973206e756c6c206f722066206973206e756c6c206f72206e6f7420697366696e697465286629206f7220636c617665206973206e756c6c206f7220766572206973206e756c6c206f72207665723c300a206f7220616363696f6e206973206e756c6c206f7220616363696f6e206e6f7420696e2028276372656172272c2773656c656363696f6e6172272c27617369676e6172272c277072657061726172272c276175746f72697a61725f7061726369616c272c2773616c6972272c27636572726172272c276f7264656e6172272c27656e747265676172272c2766616c6c6964612729207468656e20726169736520657863657074696f6e20274f5045524143494f4e5f494e56414c494441273b20656e642069663b0a202d2d2053657269616c697a6120636f6e2052504320616e746572696f726573207920707265706172616369c3b36e2e204e4f57414954206576697461206369636c6f7320636c69656e7465202d3e0a202d2d2070656469646f206465206c61732052504320636f6e7461626c65733a20756e20636f6e666c6963746f2072657669657274652073696e2065666563746f73207061726369616c65732e0a206c6f636b207461626c65207075626c69632e70656469646f7320696e206578636c7573697665206d6f6465206e6f776169743b0a20706572666f726d2070675f61647669736f72795f786163745f6c6f636b28353832303531303035293b0a206966206e6f7420657361646d696e20616e642028616363696f6e206e6f7420696e202827656e747265676172272c2766616c6c696461272c276365727261722729206f72206e6f7420657869737473280a2073656c65637420312066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f72657061727469646f7265732061206a6f696e206f706572617469766f5f7072697661646f2e72657061727469646f726573207270206f6e2072702e7573756172696f5f69643d612e7573756172696f5f696420616e642072702e61637469766f0a206a6f696e206f706572617469766f5f7072697661646f2e72757461735f6d756c746920726d206f6e20726d2e69643d612e727574615f696420776865726520612e727574615f69643d72696420616e6420612e7573756172696f5f69643d617574682e756964282920616e6420726d2e66656368613d662929207468656e20726169736520657863657074696f6e20274e4f5f4155544f52495a41444f273b20656e642069663b0a2073656c65637420652e2a20696e746f20682066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f6576656e746f73206520776865726520652e636c6176653d28732d3e3e27636c61766527293a3a757569643b0a20696620666f756e64207468656e0a20696620682e6163746f723c3e617574682e7569642829206f7220682e736f6c6963697475643c3e73207468656e20726169736520657863657074696f6e2027434c4156455f4944454d504f54454e4349415f454e5f55534f273b20656e642069663b0a2072657475726e20682e726573756c7461646f202d2027736e617073686f74273b0a20656e642069663b0a206966206578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e6361726761732077686572652066656368613d6629207468656e20726169736520657863657074696f6e20274a4f524e4144415f4c4547414359273b20656e642069663b0a20696620616363696f6e3d27637265617227207468656e0a206966207665723c3e30206f72206e756c6c696628627472696d28732d3e3e276e6f6d62726527292c272729206973206e756c6c206f72206c656e67746828627472696d28732d3e3e276e6f6d6272652729293e313030207468656e20726169736520657863657074696f6e20274e4f4d4252455f494e56414c49444f273b20656e642069663b0a20696e7365727420696e746f207075626c69632e72757461732869642c66656368615f6f70657261746976612c6e6f6d6272652c6372656164615f706f72292076616c756573287269642c662c627472696d28732d3e3e276e6f6d62726527292c617574682e7569642829293b0a20696e7365727420696e746f206f706572617469766f5f7072697661646f2e72757461735f6d756c74692869642c66656368612c6e6f6d627265292076616c756573287269642c662c627472696d28732d3e3e276e6f6d6272652729293b0a20656e642069663b0a2073656c656374202a20696e746f20722066726f6d206f706572617469766f5f7072697661646f2e72757461735f6d756c74692077686572652069643d72696420666f72207570646174653b0a206966206e6f7420666f756e64206f7220722e66656368613c3e66207468656e20726169736520657863657074696f6e2027525554415f4e4f5f454e434f4e5452414441273b20656e642069663b0a202d2d2054616d6269c3a96e20636f6e73756d6972207665727369c3b36e2064652072757461207061726120696e76616c6964617220617369676e6163696f6e6573207265766f63616461732e0a20696620722e76657273696f6e3c3e766572207468656e20726169736520657863657074696f6e202756455253494f4e5f525554415f434f4e464c4943544f273b20656e642069663b0a20696620722e65737461646f3d276365727261646127206f722028722e65737461646f3d27656e5f7265706172746f2720616e6420616363696f6e206e6f7420696e202827636572726172272c27656e747265676172272c2766616c6c696461272929207468656e20726169736520657863657074696f6e2027525554415f4e4f5f4544495441424c45273b20656e642069663b0a20616e7465733a3d6f706572617469766f5f7072697661646f2e736e617073686f745f727574615f6d756c746928726964293b0a20696620616363696f6e20696e20282773656c656363696f6e6172272c276f7264656e61722729207468656e0a206966206a736f6e625f747970656f6628732d3e2770656469646f7327292069732064697374696e63742066726f6d2027617272617927207468656e20726169736520657863657074696f6e202753454c454343494f4e5f494e56414c494441273b20656e642069663b0a2073656c65637420636f616c657363652861727261795f6167672876616c75653a3a75756964292c61727261795b5d3a3a757569645b5d2920696e746f206964732066726f6d206a736f6e625f61727261795f656c656d656e74735f7465787428732d3e2770656469646f7327293b0a2069662063617264696e616c69747928696473293c3e2873656c65637420636f756e742864697374696e63742078292066726f6d20756e6e6573742869647329207829207468656e20726169736520657863657074696f6e202753454c454343494f4e5f494e56414c494441273b20656e642069663b0a20696620616363696f6e3d276f7264656e61722720616e64202873656c65637420636f616c657363652861727261795f6167672870656469646f5f6964206f726465722062792070656469646f5f6964292c61727261795b5d3a3a757569645b5d292066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f7320776865726520727574615f69643d726964290a2069732064697374696e63742066726f6d202873656c65637420636f616c657363652861727261795f6167672878206f726465722062792078292c61727261795b5d3a3a757569645b5d292066726f6d20756e6e6573742869647329207829207468656e20726169736520657863657074696f6e202753454c454343494f4e5f494e56414c494441273b20656e642069663b0a206966206578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f732077686572652070656469646f5f69643d616e79286964732920616e6420727574615f69643c3e72696429207468656e20726169736520657863657074696f6e202750454449444f5f59415f415349474e41444f273b20656e642069663b0a206966202873656c65637420636f756e74282a292066726f6d207075626c69632e70656469646f732077686572652069643d616e79286964732920616e642066656368615f656e74726567613d6620616e642065737461646f20696e202827726563696269646f272c27656e5f7265766973696f6e272c2770726f6772616d61646f272c27636f6e6669726d61646f272c27707265706172616e646f272c276c6973746f5f646573706163686f2729293c3e63617264696e616c69747928696473290a206f72206578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e63617267615f70656469646f732077686572652070656469646f5f69643d616e79286964732929207468656e20726169736520657863657074696f6e202753454c454343494f4e5f494e56414c494441273b20656e642069663b0a2064656c6574652066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f6175746f72697a6163696f6e657320776865726520727574615f69643d72696420616e64206e6f742870656469646f5f69643d616e792869647329293b0a2064656c6574652066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f7320776865726520727574615f69643d7269643b0a20696e7365727420696e746f206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f732870656469646f5f69642c727574615f69642c706f736963696f6e292073656c65637420782c7269642c6e3a3a696e74656765722066726f6d20756e6e65737428696473292077697468206f7264696e616c697479207528782c6e293b0a20656c73696620616363696f6e3d27617369676e617227207468656e0a206966206a736f6e625f747970656f6628732d3e2772657061727469646f72657327292069732064697374696e63742066726f6d2027617272617927207468656e20726169736520657863657074696f6e202752455041525449444f525f4e4f5f484142494c495441444f273b20656e642069663b0a2073656c65637420636f616c657363652861727261795f6167672876616c75653a3a75756964292c61727261795b5d3a3a757569645b5d2920696e746f2075732066726f6d206a736f6e625f61727261795f656c656d656e74735f7465787428732d3e2772657061727469646f72657327293b0a2069662063617264696e616c697479287573293c3e2873656c65637420636f756e74282a292066726f6d206f706572617469766f5f7072697661646f2e72657061727469646f726573207270206a6f696e207075626c69632e70657266696c6573207066206f6e2070662e7573756172696f5f69643d72702e7573756172696f5f69642077686572652072702e7573756172696f5f69643d616e792875732920616e642072702e61637469766f20616e642070662e726f6c3c3e2761646d696e2729207468656e20726169736520657863657074696f6e202752455041525449444f525f4e4f5f484142494c495441444f273b20656e642069663b0a2064656c6574652066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f72657061727469646f72657320776865726520727574615f69643d7269643b0a20696e7365727420696e746f206f706572617469766f5f7072697661646f2e727574615f6d756c74695f72657061727469646f7265732073656c656374207269642c782066726f6d20756e6e6573742875732920783b0a20656c73696620616363696f6e3d27707265706172617227207468656e0a20696620662069732064697374696e63742066726f6d2028636c6f636b5f74696d657374616d7028292061742074696d65207a6f6e652027416d65726963612f53616e746961676f27293a3a64617465207468656e20726169736520657863657074696f6e20275052455041524143494f4e5f46454348415f4e4f5f484142494c4954414441273b20656e642069663b0a20696620722e65737461646f3c3e27706c616e696669636163696f6e27207468656e20726169736520657863657074696f6e2027525554415f4e4f5f4544495441424c45273b20656e642069663b0a20757064617465206f706572617469766f5f7072697661646f2e72757461735f6d756c7469207365742065737461646f3d277072657061726163696f6e272077686572652069643d7269643b0a20656c73696620616363696f6e3d276175746f72697a61725f7061726369616c27207468656e0a20696620722e65737461646f3c3e277072657061726163696f6e27207468656e20726169736520657863657074696f6e2027525554415f4e4f5f4544495441424c45273b20656e642069663b0a2073656c6563742070652e2a20696e746f20702066726f6d207075626c69632e70656469646f73207065206a6f696e206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f73206d206f6e206d2e70656469646f5f69643d70652e6964207768657265206d2e727574615f69643d72696420616e642070652e69643d28732d3e3e2770656469646f27293a3a7575696420666f7220757064617465206f662070653b0a206966206e6f7420666f756e64206f72206f706572617469766f5f7072697661646f2e65737461646f5f7072657061726163696f6e5f6d756c746928702e6964293c3e277061726369616c27207468656e20726169736520657863657074696f6e20274155544f52495a4143494f4e5f494e56414c494441273b20656e642069663b0a2073656c65637420636f616c65736365282873656c6563742076657273696f6e2066726f6d206f706572617469766f5f7072697661646f2e76657273696f6e65735f70656469646f2077686572652070656469646f5f69643d702e6964292c302920696e746f2070763b0a2069662070762069732064697374696e63742066726f6d2028732d3e3e2776657273696f6e5f70656469646f27293a3a626967696e74207468656e20726169736520657863657074696f6e202756455253494f4e5f4f50455241544956415f434f4e464c4943544f273b20656e642069663b0a206966206e756c6c696628627472696d28732d3e3e276d6f7469766f27292c272729206973206e756c6c206f72206c656e67746828732d3e3e276d6f7469766f27293e32303030207468656e20726169736520657863657074696f6e20274d4f5449564f5f52455155455249444f273b20656e642069663b0a2063616e746964616465733a3d6f706572617469766f5f7072697661646f2e63616e746964616465735f727574615f6d756c746928702e6964293b0a20696e7365727420696e746f206f706572617469766f5f7072697661646f2e727574615f6d756c74695f6175746f72697a6163696f6e657328727574615f69642c70656469646f5f69642c76657273696f6e2c63616e746964616465732c6d6f7469766f2c6163746f72290a2076616c756573287269642c702e69642c70762c63616e746964616465732c627472696d28732d3e3e276d6f7469766f27292c617574682e756964282929206f6e20636f6e666c69637428727574615f69642c70656469646f5f69642920646f20757064617465207365740a2076657273696f6e3d6578636c756465642e76657273696f6e2c63616e746964616465733d6578636c756465642e63616e746964616465732c6d6f7469766f3d6578636c756465642e6d6f7469766f2c6163746f723d6578636c756465642e6163746f722c696e7374616e74653d636c6f636b5f74696d657374616d7028293b0a20656c73696620616363696f6e3d2773616c697227207468656e0a20696620722e65737461646f3c3e277072657061726163696f6e27207468656e20726169736520657863657074696f6e2027525554415f4e4f5f4544495441424c45273b20656e642069663b0a206966206e6f74206578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f7320776865726520727574615f69643d72696429207468656e20726169736520657863657074696f6e2027525554415f5641434941273b20656e642069663b0a206966206e6f74206578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f72657061727469646f72657320776865726520727574615f69643d72696429207468656e20726169736520657863657074696f6e202752455041525449444f5245535f52455155455249444f53273b20656e642069663b0a206966206578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f72657061727469646f726573206120776865726520612e727574615f69643d72696420616e64206e6f74206578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e72657061727469646f726573207270206a6f696e207075626c69632e70657266696c6573207066206f6e2070662e7573756172696f5f69643d72702e7573756172696f5f69642077686572652072702e7573756172696f5f69643d612e7573756172696f5f696420616e642072702e61637469766f20616e642070662e726f6c3c3e2761646d696e272929207468656e20726169736520657863657074696f6e202752455041525449444f525f4e4f5f484142494c495441444f273b20656e642069663b0a20666f72207020696e2073656c6563742070652e2a2066726f6d207075626c69632e70656469646f73207065206a6f696e206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f73206d206f6e206d2e70656469646f5f69643d70652e6964207768657265206d2e727574615f69643d726964206f726465722062792070652e696420666f7220757064617465206f66207065206c6f6f700a20696620702e66656368615f656e74726567613c3e66206f7220702e65737461646f3c3e276c6973746f5f646573706163686f27206f7220702e7072657061726163696f6e5f66696e616c697a6164615f656e206973206e756c6c207468656e20726169736520657863657074696f6e202750454449444f5f4e4f5f4c4953544f273b20656e642069663b0a20706572666f726d20312066726f6d207075626c69632e6974656d735f70656469646f2077686572652070656469646f5f69643d702e6964206f7264657220627920696420666f72207570646174653b0a20706572666f726d20312066726f6d207075626c69632e7072657061726163696f6e5f6974656d735f70656469646f2077686572652070656469646f5f69643d702e6964206f72646572206279206974656d5f70656469646f5f696420666f72207570646174653b0a206966206e6f74206578697374732873656c65637420312066726f6d207075626c69632e6974656d735f70656469646f2077686572652070656469646f5f69643d702e696429206f72206578697374732873656c65637420312066726f6d207075626c69632e6974656d735f70656469646f2069206c656674206a6f696e207075626c69632e7072657061726163696f6e5f6974656d735f70656469646f207069206f6e2070692e6974656d5f70656469646f5f69643d692e69640a20776865726520692e70656469646f5f69643d702e696420616e6420286e6f7420636f616c657363652870692e636f6e6669726d61646f5f6578706c696369746f2c66616c736529206f722070692e63616e74696461645f707265706172616461206973206e756c6c206f722070692e696d706f7274655f6c696e65615f6f706572617469766f206973206e756c6c2929207468656e20726169736520657863657074696f6e202750524f445543544f535f50454e4449454e544553273b20656e642069663b0a20707265703a3d6f706572617469766f5f7072697661646f2e65737461646f5f7072657061726163696f6e5f6d756c746928702e6964293b0a20696620707265703d2773696e5f707265706172617227207468656e20726169736520657863657074696f6e202753494e5f5052455041524152273b20656e642069663b0a2073656c65637420636f616c65736365282873656c6563742076657273696f6e2066726f6d206f706572617469766f5f7072697661646f2e76657273696f6e65735f70656469646f2077686572652070656469646f5f69643d702e6964292c302920696e746f2070763b0a20696620707265703d277061726369616c2720616e64206e6f74206578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f6175746f72697a6163696f6e6573206120776865726520612e727574615f69643d72696420616e6420612e70656469646f5f69643d702e696420616e6420612e76657273696f6e3d707620616e6420612e63616e746964616465733d6f706572617469766f5f7072697661646f2e63616e746964616465735f727574615f6d756c746928702e69642929207468656e20726169736520657863657074696f6e20275041524349414c5f4e4f5f4155544f52495a41444f273b20656e642069663b0a20706572666f726d206f706572617469766f5f7072697661646f2e696e69636961725f6f7065726163696f6e28702e69642c70762c636c6176652c27727574615f6d756c7469706c655f73616c6972272c73293b0a20696e7365727420696e746f206f706572617469766f5f7072697661646f2e727574615f6d756c74695f6361706163696461642076616c75657328747869645f63757272656e7428292c617574682e75696428292c7269642c702e69642c2773616c697227293b0a20757064617465207075626c69632e70656469646f73207365742065737461646f3d27656e5f7265706172746f272077686572652069643d702e69643b0a2064656c6574652066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f636170616369646164207768657265207472616e73616363696f6e3d747869645f63757272656e7428293b0a20706572666f726d206f706572617469766f5f7072697661646f2e636f6d706c657461725f6f7065726163696f6e28702e69642c70762c636c6176652c27727574615f6d756c7469706c655f73616c6972272c732c6e756c6c2c2753616c696461206578706cc3ad6369746120706f722072757461272c746f5f6a736f6e622870292c0a206a736f6e625f6275696c645f6f626a656374282765737461646f272c27656e5f7265706172746f272c277072657061726163696f6e272c707265702c2763616e74696461646573272c6f706572617469766f5f7072697661646f2e63616e746964616465735f727574615f6d756c746928702e696429292c6a736f6e625f6275696c645f6f626a656374282772757461272c7269642c2765737461646f272c27656e5f7265706172746f2729293b0a20656e64206c6f6f703b0a20696620662069732064697374696e63742066726f6d2028636c6f636b5f74696d657374616d7028292061742074696d65207a6f6e652027416d65726963612f53616e746961676f27293a3a64617465207468656e20726169736520657863657074696f6e20275052455041524143494f4e5f46454348415f4e4f5f484142494c4954414441273b20656e642069663b0a20757064617465206f706572617469766f5f7072697661646f2e72757461735f6d756c7469207365742065737461646f3d27656e5f7265706172746f272c73616c6964615f656e3d636c6f636b5f74696d657374616d7028292077686572652069643d7269643b0a20656c73696620616363696f6e20696e202827656e747265676172272c2766616c6c6964612729207468656e0a20696620722e65737461646f3c3e27656e5f7265706172746f27207468656e20726169736520657863657074696f6e2027525554415f4e4f5f4544495441424c45273b20656e642069663b0a2073656c6563742070652e2a20696e746f20702066726f6d207075626c69632e70656469646f73207065206a6f696e206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f73206d206f6e206d2e70656469646f5f69643d70652e6964207768657265206d2e727574615f69643d72696420616e642070652e69643d28732d3e3e2770656469646f27293a3a757569643b0a206966206e6f7420666f756e64207468656e20726169736520657863657074696f6e20274e4f5f4155544f52495a41444f273b20656e642069663b0a20706572666f726d20312066726f6d207075626c69632e636c69656e7465732077686572652069643d702e636c69656e74655f696420666f7220757064617465206e6f776169743b0a20696e7365727420696e746f206f706572617469766f5f7072697661646f2e727574615f6d756c74695f6361706163696461642076616c75657328747869645f63757272656e7428292c617574682e75696428292c7269642c702e69642c616363696f6e293b0a20696620616363696f6e3d27656e74726567617227207468656e0a2073656c656374202a20696e746f20686973742066726f6d206f706572617469766f5f7072697661646f2e686973746f7269616c5f6f706572617469766f2077686572652070656469646f5f69643d702e696420616e6420636c6176655f6964656d706f74656e6369613d636c6176653b0a20696620666f756e64207468656e2069743a3d686973742e736f6c6963697475642d3e276974656d73273b0a20656c73652073656c656374206a736f6e625f616767286a736f6e625f6275696c645f6f626a65637428276974656d5f70656469646f5f6964272c692e69642c2763616e74696461645f656e74726567616461272c70692e63616e74696461645f70726570617261646129206f7264657220627920692e69642920696e746f2069740a2066726f6d207075626c69632e6974656d735f70656469646f2069206a6f696e207075626c69632e7072657061726163696f6e5f6974656d735f70656469646f207069206f6e2070692e6974656d5f70656469646f5f69643d692e696420776865726520692e70656469646f5f69643d702e69643b20656e642069663b0a20706572666f726d207075626c69632e636f6e6669726d61725f656e74726567615f746f646f5f636f72726563746f28702e69642c28732d3e3e2776657273696f6e5f70656469646f27293a3a626967696e742c636c6176652c69742c0a20277b226d65746f646f223a22706f725f7061676172222c22656665637469766f223a302c227472616e73666572656e636961223a302c22636f6e6669726d61725f706f725f7061676172223a747275657d273a3a6a736f6e62293b0a20656c736520706572666f726d207075626c69632e7265676973747261725f656e74726567615f66616c6c69646128702e69642c28732d3e3e2776657273696f6e5f70656469646f27293a3a626967696e742c636c6176652c732d3e3e276d6f7469766f272c732d3e3e276f62736572766163696f6e657327293b20656e642069663b0a2064656c6574652066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f636170616369646164207768657265207472616e73616363696f6e3d747869645f63757272656e7428293b0a20656c73696620616363696f6e3d2763657272617227207468656e0a20696620722e65737461646f3c3e27656e5f7265706172746f27207468656e20726169736520657863657074696f6e2027525554415f4e4f5f4544495441424c45273b20656e642069663b0a206966206578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f73206d206a6f696e207075626c69632e70656469646f73207065206f6e2070652e69643d6d2e70656469646f5f6964207768657265206d2e727574615f69643d72696420616e642070652e65737461646f206e6f7420696e202827656e7472656761646f272c27656e74726567615f66616c6c696461272929207468656e20726169736520657863657074696f6e202750454449444f535f50454e4449454e544553273b20656e642069663b0a202d2d204c612065766964656e63696120646520636164612066616c6c6f2f76656e7461206675652076616c696461646120706f72207375732062617272657261732061637475616c65732e0a202d2d20436f6e67656c612073c3b36c6f206c6f732070656469646f732c2063616e746964616465732c206163746f7265732079206576656e746f73206465204553544120727574612e0a20757064617465206f706572617469766f5f7072697661646f2e72757461735f6d756c7469207365742065737461646f3d2763657272616461272c6369657272653d616e7465737c7c6a736f6e625f6275696c645f6f626a6563742827636572726164615f656e272c636c6f636b5f74696d657374616d7028292c27636572726164615f706f72272c617574682e7569642829292077686572652069643d7269643b0a20656e642069663b0a20757064617465206f706572617469766f5f7072697661646f2e72757461735f6d756c7469207365742076657273696f6e3d76657273696f6e2b312077686572652069643d7269643b0a20726573756c7461646f3a3d6a736f6e625f6275696c645f6f626a65637428276f6b272c747275652c2772757461272c7269642c2776657273696f6e272c722e76657273696f6e2b31293b0a20696e7365727420696e746f206f706572617469766f5f7072697661646f2e727574615f6d756c74695f6576656e746f7328636c6176652c727574615f69642c6163746f722c736f6c6963697475642c616e746572696f722c726573756c7461646f290a2076616c75657328636c6176652c7269642c617574682e75696428292c732c616e7465732c726573756c7461646f7c7c6a736f6e625f6275696c645f6f626a6563742827736e617073686f74272c6f706572617469766f5f7072697661646f2e736e617073686f745f727574615f6d756c7469287269642929293b0a2072657475726e20726573756c7461646f3b0a656e6420', 'hex'), 'UTF8')),
13: ('public.leer_rutas_multiples(date)', 'leer_rutas_multiples', '5438a8139ed3f3845e618380ce2b6794', convert_from(decode('0a626567696e0a20696620617574682e7569642829206973206e756c6c206f72206e6f7420636f616c65736365287075626c69632e65735f61646d696e28292c66616c736529207468656e20726169736520657863657074696f6e20274e4f5f4155544f52495a41444f273b20656e642069663b0a20696620705f6665636861206973206e756c6c206f72206e6f7420697366696e69746528705f666563686129207468656e20726169736520657863657074696f6e202746454348415f494e56414c494441273b20656e642069663b0a2072657475726e206a736f6e625f6275696c645f6f626a6563742827636f6e747261746f272c322c276c656761646f272c6578697374732873656c65637420312066726f6d206f706572617469766f5f7072697661646f2e6361726761732077686572652066656368613d705f6665636861292c0a20277275746173272c636f616c65736365282873656c656374206a736f6e625f616767286a736f6e625f6275696c645f6f626a65637428276964272c722e69642c276e6f6d627265272c722e6e6f6d6272652c2765737461646f272c722e65737461646f2c2776657273696f6e272c722e76657273696f6e2c0a202770656469646f73272c636f616c65736365282873656c656374206a736f6e625f6167672870656469646f5f6964206f7264657220627920706f736963696f6e2c70656469646f5f6964292066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f7320776865726520727574615f69643d722e6964292c275b5d273a3a6a736f6e62292c0a202772657061727469646f726573272c636f616c65736365282873656c656374206a736f6e625f616767287573756172696f5f6964206f72646572206279207573756172696f5f6964292066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f72657061727469646f72657320776865726520727574615f69643d722e6964292c275b5d273a3a6a736f6e62292c0a20276175746f72697a6163696f6e6573272c636f616c65736365282873656c656374206a736f6e625f616767286a736f6e625f6275696c645f6f626a656374282770656469646f272c70656469646f5f69642c2776657273696f6e272c76657273696f6e2c276d6f7469766f272c6d6f7469766f2c276163746f72272c6163746f722c2763616e74696461646573272c63616e7469646164657329206f726465722062792070656469646f5f6964292066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f6175746f72697a6163696f6e657320776865726520727574615f69643d722e6964292c275b5d273a3a6a736f6e62292c0a2027636f6e7461646f726573272c2873656c656374206a736f6e625f6275696c645f6f626a656374282770726570617261646f73272c636f756e74282a292066696c746572287768657265206f706572617469766f5f7072697661646f2e65737461646f5f7072657061726163696f6e5f6d756c746928702e6964293d276c6973746f27292c0a2027656e5f7265706172746f272c636f756e74282a292066696c74657228776865726520702e65737461646f3d27656e5f7265706172746f27292c27656e7472656761646f73272c636f756e74282a292066696c74657228776865726520702e65737461646f3d27656e7472656761646f27292c0a20276e6f5f656e7472656761646f73272c636f756e74282a292066696c74657228776865726520702e65737461646f3d27656e74726567615f66616c6c69646127292c2770656e6469656e746573272c636f756e74282a292066696c74657228776865726520702e65737461646f206e6f7420696e202827656e7472656761646f272c27656e74726567615f66616c6c696461272929290a2066726f6d206f706572617469766f5f7072697661646f2e727574615f6d756c74695f70656469646f73206d206a6f696e207075626c69632e70656469646f732070206f6e20702e69643d6d2e70656469646f5f6964207768657265206d2e727574615f69643d722e69642929206f7264657220627920722e6e6f6d6272652c722e6964290a2066726f6d206f706572617469766f5f7072697661646f2e72757461735f6d756c7469207220776865726520722e66656368613d705f6665636861292c275b5d273a3a6a736f6e62292c0a202772657061727469646f726573272c636f616c65736365282873656c656374206a736f6e625f616767286a736f6e625f6275696c645f6f626a65637428277573756172696f5f6964272c72702e7573756172696f5f69642c276e6f6d627265272c636f616c6573636528702e6e6f6d6272652c2752657061727469646f72272929206f7264657220627920702e6e6f6d6272652c72702e7573756172696f5f6964290a2066726f6d206f706572617469766f5f7072697661646f2e72657061727469646f726573207270206a6f696e207075626c69632e70657266696c65732070206f6e20702e7573756172696f5f69643d72702e7573756172696f5f69642077686572652072702e61637469766f20616e6420702e726f6c3c3e2761646d696e27292c275b5d273a3a6a736f6e6229293b0a656e6420', 'hex'), 'UTF8')),
28:  'rutas_multi',to_regclass('operativo_privado.rutas_multi')::text) AS detalle
49:  -- Todas las sobrecargas, incluso si la firma exacta falta.
50:  SELECT '03_definiciones_y_sobrecargas',p.oid::regprocedure::text,

## supabase/manual/no_entregados_fase3.sql

4: create function public.leer_no_entregados_admin(
10:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
13:  or p_desde>p_hasta then raise exception 'FILTROS_INVALIDOS'; end if;
15:  select p.id,p.numero_pedido,p.nombre_cliente_snapshot cliente,p.fecha_entrega,
20:  from public.items_pedido i where i.pedido_id=p.id),'[]'::jsonb) productos
21:  from public.pedidos p
22:  left join lateral (select h.* from operativo_privado.historial_operativo h
23:  where h.pedido_id=p.id and h.operacion='entrega_fallida' order by h.version desc limit 1) f on true
26:  and coalesce((select coalesce(h.valores_nuevos->>'estado',h.valores_nuevos->'pedido'->>'estado')
27:  from operativo_privado.historial_operativo h where h.pedido_id=p.id
28:  and coalesce(h.valores_nuevos->>'estado',h.valores_nuevos->'pedido'->>'estado') is not null
31:  or position(lower(p_busqueda) in lower(p.numero_pedido::text))>0)
37:  'pedidos',coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha_fallo desc nulls last,x.id) from pagina x),'[]'::jsonb)) into respuesta;
41: create function public.leer_intentos_pedido_admin(p_pedido_id uuid)
44:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
48:  from operativo_privado.historial_operativo h where h.pedido_id=p_pedido_id and h.operacion='entrega_fallida'),'[]'::jsonb),
51:  from operativo_privado.cargas c cross join lateral jsonb_array_elements(c.resumen_cierre->'intentos') x(intento)
52:  where c.estado='cerrada' and x.intento->'pedido'->>'id'=p_pedido_id::text),'[]'::jsonb));
54: alter function public.leer_no_entregados_admin(text,date,date,integer) owner to postgres;
55: alter function public.leer_intentos_pedido_admin(uuid) owner to postgres;
56: revoke all on function public.leer_no_entregados_admin(text,date,date,integer), public.leer_intentos_pedido_admin(uuid) from public,anon,authenticated,service_role;
57: grant execute on function public.leer_no_entregados_admin(text,date,date,integer), public.leer_intentos_pedido_admin(uuid) to authenticated;

## supabase/manual/no_entregados_fase4.sql

1: -- Fase 4. Instalación MANUAL después de Fases 2 y 3. No ejecutar desde la aplicación.
13:  raise exception 'FASE4_REQUIERE_POSTGRES_CON_BYPASSRLS'; end if;
16:  raise exception 'FASE4_REQUIERE_READ_COMMITTED_Y_TRIGGERS_ORIGIN'; end if;
19:  array['p_pedido_id','p_version_esperada','p_clave','p_fecha','p_motivo'],
23:  ('operativo_privado.proteger_pedido_ruta_cerrada()',null::text[],
27:  ('public.leer_intentos_pedido_admin(uuid)',array['p_pedido_id'],
44:  raise exception 'CONTRATO_FASE2_O_FASE3_INCOMPATIBLE: %',r.firma;
50:  raise exception 'EXECUTE_PUBLICO_FASE4: %',r.firma; end if;
54:  raise exception 'PERMISOS_FUNCION_FASE4_INCOMPATIBLES: % (%)',r.firma,rol;
62:  ('proteger_pedido_ruta_cerrada','operativo_privado.proteger_pedido_ruta_cerrada()',27)
64:  if not exists(select 1 from pg_trigger where tgrelid='public.pedidos'::regclass
69:  select attnum::text from pg_attribute where attrelid='public.pedidos'::regclass and attname='estado' and not attisdropped)))) then
70:  raise exception 'BARRERA_FASE2_NO_ACTIVA_O_INCOMPATIBLE: %',r.nombre; end if;
75:  raise exception 'CAPACIDAD_FASE2_NO_AISLADA'; end if;
82:  raise exception 'CAPACIDAD_FASE2_NO_AISLADA: %',rol; end if;
86: create function public.cancelar_no_entregado_administrativo(
87:  p_pedido_id uuid,p_version_esperada bigint,p_clave uuid,p_motivo text,p_tratamiento text
89: declare p public.pedidos%rowtype; cp operativo_privado.carga_pedidos%rowtype;
90:  c operativo_privado.cargas%rowtype; inicio jsonb; solicitud jsonb; intento jsonb;
91:  fallo operativo_privado.historial_operativo%rowtype; despues jsonb; respuesta jsonb;
93:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
94:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
96:  or nullif(btrim(p_tratamiento),'') is null or length(p_tratamiento)>2000 then raise exception 'TRATAMIENTO_ADMINISTRATIVO_REQUERIDO'; end if;
98:  lock table public.pedidos in exclusive mode;
100:  inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'cancelar_no_entregado',solicitud);
102:  select * into p from public.pedidos where id=p_pedido_id;
104:  or exists(select 1 from operativo_privado.entregas_definitivas where pedido_id=p.id) then raise exception 'PEDIDO_NO_CANCELABLE'; end if;
106:  if p.regimen_contable is distinct from 'entrega_v1' then raise exception 'SALDO_HISTORICO_REQUIERE_TRATAMIENTO'; end if;
107:  select * into cp from operativo_privado.carga_pedidos where pedido_id=p.id;
108:  if not found or not cp.incluido then raise exception 'PEDIDO_NO_CANCELABLE'; end if;
109:  perform pg_advisory_xact_lock(hashtextextended('carga:'||cp.fecha::text,0));
110:  select * into c from operativo_privado.cargas where fecha=cp.fecha for update;
111:  if c.estado is distinct from 'cerrada' then raise exception 'CIERRE_REQUERIDO'; end if;
113:  where x->'pedido'->>'id'=p.id::text;
114:  select * into fallo from operativo_privado.historial_operativo
115:  where pedido_id=p.id and operacion='entrega_fallida' order by version desc limit 1;
116:  if intento is null or fallo.pedido_id is null
117:  or intento->'pedido' is distinct from to_jsonb(p)
125:  or not exists(select 1 from operativo_privado.historial_cargas h
128:  raise exception 'TRAZABILIDAD_INTENTO_INVALIDA'; end if;
134:  update public.pedidos set estado='cancelado' where id=p.id;
135:  delete from operativo_privado.permiso_reprogramacion where pedido_id=p.id;
138:  jsonb_build_object('pedido',to_jsonb(p),'seleccion',to_jsonb(cp),'cierre',c.resumen_cierre,'fallo',to_jsonb(fallo),
139:  'aplicaciones',coalesce((select jsonb_agg(to_jsonb(a)) from public.aplicaciones_pago a where a.pedido_id=p.id),'[]'::jsonb)),
140:  jsonb_build_object('pedido',(select to_jsonb(pe) from public.pedidos pe where id=p.id),
141:  'tratamiento',p_tratamiento,'pagos_creditos_preservados',true),
142:  jsonb_build_object('pedido_id',p.id,'estado','cancelado','pagos_creditos_preservados',true));
146: -- La RPC de orden visual histórica materializa paradas para todos los pedidos
149: create function operativo_privado.proteger_ruta_reprogramado_no_incluido()
152:  perform 1 from public.pedidos where id=new.pedido_id for share nowait;
153:  if exists(select 1 from operativo_privado.historial_operativo h
154:  where h.pedido_id=new.pedido_id and h.operacion='reprogramar_no_entregado')
155:  and not exists(select 1 from operativo_privado.carga_pedidos cp
156:  join public.rutas r on r.id=new.ruta_id and r.fecha_operativa=cp.fecha
157:  where cp.pedido_id=new.pedido_id and cp.incluido) then
158:  raise exception 'REPROGRAMADO_REQUIERE_INCLUSION_EXPLICITA'; end if;
161: alter function operativo_privado.proteger_ruta_reprogramado_no_incluido() owner to postgres;
162: revoke all on function operativo_privado.proteger_ruta_reprogramado_no_incluido() from public,anon,authenticated,service_role;
163: create trigger proteger_ruta_reprogramado_no_incluido
164:  before insert or update on public.paradas_ruta
165:  for each row execute function operativo_privado.proteger_ruta_reprogramado_no_incluido();
167: -- Lectura acotada para obtener versión y resoluciones, también desde detalle/historial.
168: create function public.leer_resolucion_no_entregado_admin(p_pedido_id uuid)
171:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
172:  return jsonb_build_object('version',coalesce((select version::text from operativo_privado.versiones_pedido where pedido_id=p_pedido_id),'0'),
176:  from operativo_privado.historial_operativo h where h.pedido_id=p_pedido_id
179: alter function public.cancelar_no_entregado_administrativo(uuid,bigint,uuid,text,text) owner to postgres;
180: alter function public.leer_resolucion_no_entregado_admin(uuid) owner to postgres;

## supabase/manual/produccion_fase3_complemento.sql

5: create table public.produccion_compra_importes (
6:  version_id uuid primary key references public.produccion_actividad_versiones(id) on delete restrict,
9: alter table public.produccion_compra_importes owner to postgres;
10: alter table public.produccion_compra_importes enable row level security;
11: alter table public.produccion_compra_importes force row level security;
16: create trigger produccion_importes_inmutables before update or delete on public.produccion_compra_importes
17:  for each row execute function produccion_privado.impedir_mutacion();
18: create trigger produccion_importes_no_truncables before truncate on public.produccion_compra_importes
19:  for each statement execute function produccion_privado.impedir_mutacion();
27: create function produccion_privado.conservar_importe_compra() returns trigger
41: alter function produccion_privado.conservar_importe_compra() owner to postgres;
43: create trigger produccion_conservar_importe_compra after insert on public.produccion_actividad_versiones
44:  for each row execute function produccion_privado.conservar_importe_compra();
46: -- Sobrecarga explícita: exclusivamente compra_alimento con precio total en CLP.
49: create function public.registrar_actividad_produccion(
59:   raise exception 'PRECIO_COMPRA_INVALIDO' using errcode='23514';
75: alter function public.registrar_actividad_produccion(uuid,uuid,date,text,numeric,text,text,numeric) owner to postgres;

## supabase/manual/produccion_fase5_complemento.sql

4: create table public.produccion_entidad_revisiones (
6:  lugar_id uuid references public.produccion_lugares(id) on delete restrict,
7:  unidad_id uuid references public.produccion_unidades(id) on delete restrict,
18: alter table public.produccion_entidad_revisiones owner to postgres;
19: alter table public.produccion_entidad_revisiones enable row level security;
20: alter table public.produccion_entidad_revisiones force row level security;
25: create trigger produccion_revision_inmutable before update or delete on public.produccion_entidad_revisiones
26:  for each row execute function produccion_privado.impedir_mutacion();
27: create trigger produccion_revision_no_truncable before truncate on public.produccion_entidad_revisiones
28:  for each statement execute function produccion_privado.impedir_mutacion();
30: create view public.produccion_lugares_actuales with (security_invoker=true) as
36: create view public.produccion_unidades_actuales with (security_invoker=true) as
50: create or replace function produccion_privado.escribir(p_clave uuid,p_solicitud jsonb) returns jsonb
64:  if p_clave is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
70:    raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
83:   if not found then raise exception 'LUGAR_NO_ENCONTRADO'; end if;
90:   if not found then raise exception 'UNIDAD_NO_ENCONTRADA'; end if;
98:    if not found then raise exception 'UNIDAD_NO_ENCONTRADA'; end if;
103:    if not found then raise exception 'ACTIVIDAD_NO_ENCONTRADA'; end if;
106:     raise exception 'VERSION_PRODUCCION_CONFLICTO'; end if;
107:    if anterior.evento='anulacion' then raise exception 'ACTIVIDAD_ANULADA'; end if;
123:  else raise exception 'OPERACION_PRODUCCION_INVALIDA';
132: create function produccion_privado.validar_alta_activa() returns trigger
139:    raise exception 'NOMBRE_PRODUCCION_DUPLICADO' using errcode='23505'; end if;
142:    raise exception 'LUGAR_PRODUCCION_INACTIVO'; end if;
144:    raise exception 'NOMBRE_PRODUCCION_DUPLICADO' using errcode='23505'; end if;
148:    raise exception 'UNIDAD_PRODUCCION_INACTIVA'; end if;
152: create trigger produccion_alta_activa before insert on public.produccion_lugares for each row execute function produccion_privado.validar_alta_activa();
153: create trigger produccion_alta_activa before insert on public.produccion_unidades for each row execute function produccion_privado.validar_alta_activa();
154: create trigger produccion_alta_activa before insert on public.produccion_actividades for each row execute function produccion_privado.validar_alta_activa();
155: create trigger produccion_alta_activa before insert on public.produccion_configuraciones_unidad for each row execute function produccion_privado.validar_alta_activa();
157: create function public.editar_entidad_produccion(p_clave_idempotencia uuid,p_entidad text,p_id uuid,p_version_esperada integer,p_nombre text,p_observaciones text,p_activo boolean)
162:  if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
169:   if previa.actor_id is distinct from auth.uid() or previa.solicitud is distinct from solicitud then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
176:  else raise exception 'ENTIDAD_PRODUCCION_INVALIDA'; end if;
177:  if not found then raise exception 'ENTIDAD_PRODUCCION_NO_ENCONTRADA'; end if;
178:  if actual.version is distinct from p_version_esperada then raise exception 'VERSION_PRODUCCION_CONFLICTO'; end if;
182:    raise exception 'NOMBRE_PRODUCCION_DUPLICADO' using errcode='23505'; end if;
185:    raise exception 'LUGAR_PRODUCCION_INACTIVO'; end if;
188:    raise exception 'NOMBRE_PRODUCCION_DUPLICADO' using errcode='23505'; end if;
196: alter function produccion_privado.validar_alta_activa() owner to postgres;
198: alter function public.editar_entidad_produccion(uuid,text,uuid,integer,text,text,boolean) owner to postgres;

## supabase/manual/produccion_fase7_complemento.sql

7: create table public.produccion_cultivos (
15: alter table public.produccion_cultivos owner to postgres;
16: alter table public.produccion_cultivos enable row level security;
17: alter table public.produccion_cultivos force row level security;
22: create trigger produccion_catalogo_inmutable before update or delete on public.produccion_cultivos
23:  for each row execute function produccion_privado.impedir_mutacion();
24: create trigger produccion_catalogo_no_truncable before truncate on public.produccion_cultivos
25:  for each statement execute function produccion_privado.impedir_mutacion();
26: alter table public.produccion_unidades add column cultivo text references public.produccion_cultivos(codigo),
28: alter table public.produccion_configuraciones_unidad add column cultivo text references public.produccion_cultivos(codigo),
30: alter table public.produccion_actividad_versiones add column cultivo text references public.produccion_cultivos(codigo),
37:  execute format('alter table public.produccion_configuraciones_unidad drop constraint %I',c.conname);
41:  execute format('alter table public.produccion_actividad_versiones drop constraint %I',c.conname);
44: alter table public.produccion_configuraciones_unidad add constraint produccion_capacidad_cultivo check (
49: alter table public.produccion_actividad_versiones add constraint produccion_medidas_actividad check (case
56: create function produccion_privado.validar_cultivo() returns trigger
62:  if not found then raise exception 'CULTIVO_INVALIDO' using errcode='23514'; end if;
65:    raise exception 'CAPACIDAD_CULTIVO_ENTERA' using errcode='23514'; end if;
70:     raise exception 'CULTIVO_HISTORICO_INMUTABLE' using errcode='23514'; end if;
74:    raise exception 'CANTIDAD_CULTIVO_INVALIDA' using errcode='23514'; end if;
78: alter function produccion_privado.validar_cultivo() owner to postgres;
80: create trigger produccion_validar_cultivo before insert on public.produccion_configuraciones_unidad
81:  for each row execute function produccion_privado.validar_cultivo();
82: create trigger produccion_validar_cultivo before insert on public.produccion_actividad_versiones
83:  for each row execute function produccion_privado.validar_cultivo();
84: create or replace view public.produccion_unidades_actuales with (security_invoker=true) as
90: create or replace function produccion_privado.escribir(p_clave uuid,p_solicitud jsonb) returns jsonb
104:  if p_clave is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
110:    raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
123:   if not found then raise exception 'LUGAR_NO_ENCONTRADO'; end if;
130:   if not found then raise exception 'UNIDAD_NO_ENCONTRADA'; end if;
138:    if not found then raise exception 'UNIDAD_NO_ENCONTRADA'; end if;
143:    if not found then raise exception 'ACTIVIDAD_NO_ENCONTRADA'; end if;
146:     raise exception 'VERSION_PRODUCCION_CONFLICTO'; end if;
147:    if anterior.evento='anulacion' then raise exception 'ACTIVIDAD_ANULADA'; end if;
167:    raise exception 'CULTIVO_PRODUCCION_CONFLICTO' using errcode='23514'; end if;
174:  else raise exception 'OPERACION_PRODUCCION_INVALIDA';
179: create function public.crear_unidad_cultivo_produccion(p_clave_idempotencia uuid,p_lugar_id uuid,p_tipo text,p_nombre text,p_observaciones text,p_cultivo text) returns jsonb
184:   raise exception 'CULTIVO_INVALIDO' using errcode='23514'; end if;
185:  if p_tipo is distinct from 'meson' then raise exception 'TIPO_CULTIVO_INVALIDO' using errcode='23514'; end if;
188: alter function public.crear_unidad_cultivo_produccion(uuid,uuid,text,text,text,text) owner to postgres;
191: create function public.configurar_cultivo_produccion(p_clave_idempotencia uuid,p_unidad_id uuid,p_vigente_desde date,p_cultivo text,p_capacidad numeric,p_observaciones text) returns jsonb
196:   raise exception 'CULTIVO_INVALIDO' using errcode='23514'; end if;
199: alter function public.configurar_cultivo_produccion(uuid,uuid,date,text,numeric,text) owner to postgres;
205: create function public.registrar_actividad_cultivo_produccion(
212:   raise exception 'CULTIVO_INVALIDO' using errcode='23514'; end if;
218: alter function public.registrar_actividad_cultivo_produccion(uuid,uuid,date,text,numeric,text,text,text) owner to postgres;

## supabase/manual/produccion_fase9_complemento.sql

4: create or replace function public.resumen_produccion(p_desde date,p_hasta date,p_lugar uuid,p_unidad uuid)
10:  or p_hasta<p_desde or p_hasta-p_desde>365 then raise exception 'RANGO_RESUMEN_INVALIDO'; end if;
13:  then raise exception 'LUGAR_UNIDAD_INVALIDO'; end if;
46: alter function public.resumen_produccion(date,date,uuid,uuid) owner to postgres;

## supabase/manual/repartidores_fase5.sql

6:  raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
7:  if to_regprocedure('public.cerrar_ruta(date,bigint,uuid,text)') is null
8:  or to_regprocedure('public.revisar_cierre_ruta(date)') is null
11:  or to_regprocedure('public.leer_intentos_pedido_admin(uuid)') is null
13:  or to_regclass('operativo_privado.permiso_reprogramacion') is null then raise exception 'DEPENDENCIAS_FASE5_INCOMPLETAS'; end if;
17:  or has_schema_privilege(rol,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',rol; end if;
20: lock table public.pedidos,public.rutas,public.paradas_ruta,operativo_privado.cargas,operativo_privado.carga_pedidos in access exclusive mode nowait;
22: create table operativo_privado.repartidores (
23:  usuario_id uuid primary key references auth.users(id) on delete restrict,
27: -- pedidos de otros repartidores. La ruta principal existente identifica la jornada.
28: create table operativo_privado.reparto_asignaciones (
29:  fecha date primary key, ruta_id uuid not null unique references public.rutas(id),
30:  usuario_id uuid not null references operativo_privado.repartidores(usuario_id),
33: create table operativo_privado.reparto_auditoria (
37: create table operativo_privado.reparto_capacidad (
38:  transaccion bigint primary key, actor uuid not null, pedido_id uuid, fecha date not null
42:  execute format('alter table operativo_privado.%I owner to postgres',t);
43:  execute format('alter table operativo_privado.%I enable row level security',t);
44:  execute format('alter table operativo_privado.%I force row level security',t);
48: create trigger reparto_auditoria_inmutable before update or delete on operativo_privado.reparto_auditoria
49:  for each row execute function operativo_privado.impedir_mutacion_historial();
50: create trigger reparto_auditoria_no_truncable before truncate on operativo_privado.reparto_auditoria
51:  for each statement execute function operativo_privado.impedir_mutacion_historial();
53: create function operativo_privado.permiso_reparto(p_pedido uuid,p_fecha date) returns boolean
59:  and (p_pedido is null or c.pedido_id=p_pedido)
67:  ('public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb)','operativo_privado.permiso_reparto(p_pedido_id,null)'),
68:  ('public.registrar_entrega_fallida(uuid,bigint,uuid,text,text)','operativo_privado.permiso_reparto(p_pedido_id,null)'),
69:  ('operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)','operativo_privado.permiso_reparto(p_pedido_id,null)'),
70:  ('public.revisar_cierre_ruta(date)','operativo_privado.permiso_reparto(null,p_fecha)'),
71:  ('public.cerrar_ruta(date,bigint,uuid,text)','operativo_privado.permiso_reparto(null,p_fecha)'),
72:  ('public.leer_carga_jornada(date)','operativo_privado.permiso_reparto(null,p_fecha)')
74:  if not exists(select 1 from pg_proc where oid=to_regprocedure(r.firma) and proowner='postgres'::regrole) then raise exception 'PROPIETARIO_INVALIDO: %',r.firma; end if;
76:  if (length(d)-length(replace(d,guard,'')))/length(guard)<>1 then raise exception 'GUARD_INESPERADO: %',r.firma; end if;
81: create function public.acceso_repartidor() returns boolean language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
86: create function public.administrar_reparto(p_accion text default 'listar',p_usuario uuid default null,p_activo boolean default null,p_ruta uuid default null)
90:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
93:  if p_usuario is null or p_activo is null or not exists(select 1 from public.perfiles where usuario_id=p_usuario and rol<>'admin') then raise exception 'USUARIO_INVALIDO'; end if;
102:  lock table public.pedidos in exclusive mode nowait;
103:  select fecha_operativa into f from public.rutas where id=p_ruta and es_principal;
106:  or exists(select 1 from operativo_privado.cargas where fecha=f and estado='cerrada') then raise exception 'ASIGNACION_INVALIDA'; end if;
108:  insert into operativo_privado.reparto_asignaciones(fecha,ruta_id,usuario_id,modificado_por) values(f,p_ruta,p_usuario,auth.uid())
109:  on conflict(fecha) do update set ruta_id=excluded.ruta_id,usuario_id=excluded.usuario_id,version=reparto_asignaciones.version+1,modificado_por=excluded.modificado_por,modificado_en=now();
111:  elsif p_accion<>'listar' then raise exception 'OPERACION_INVALIDA'; end if;
115:  'rutas',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'fecha',r.fecha_operativa) order by r.fecha_operativa desc) from public.rutas r
116:  where r.es_principal and not exists(select 1 from operativo_privado.cargas c where c.fecha=r.fecha_operativa and c.estado='cerrada')),'[]'::jsonb));
119: create function public.leer_mi_reparto() returns jsonb language sql stable security definer set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD' as $$
121:  'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
125:  from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb)) order by pr.posicion nulls last,p.numero_pedido)
126:  from operativo_privado.carga_pedidos cp join public.pedidos p on p.id=cp.pedido_id and p.fecha_entrega=a.fecha
127:  left join operativo_privado.versiones_pedido v on v.pedido_id=p.id
128:  left join public.paradas_ruta pr on pr.ruta_id=a.ruta_id and pr.pedido_id=p.id
130:  from operativo_privado.reparto_asignaciones a join operativo_privado.cargas c on c.fecha=a.fecha
131:  where public.acceso_repartidor() and a.usuario_id=auth.uid() and c.estado='en_ruta'
132:  and exists(select 1 from public.rutas r where r.id=a.ruta_id and r.es_principal and r.fecha_operativa=a.fecha);
135: -- Interfaz cerrada: no recibe items, precios, cobros, pagos ni patches de pedidos.
136: create function public.operar_mi_reparto(p_fecha date,p_asignacion bigint,p_accion text,p_pedido uuid default null,
139: declare a operativo_privado.reparto_asignaciones%rowtype; items jsonb; resultado jsonb; h operativo_privado.historial_operativo%rowtype;
141:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
143:  if not public.acceso_repartidor() then raise exception 'NO_AUTORIZADO'; end if;
144:  -- Antes de leer asignación, selección, preparación o historial: serializa con
146:  lock table public.pedidos in exclusive mode;
149:  or not exists(select 1 from public.rutas r where r.id=a.ruta_id and r.es_principal and r.fecha_operativa=a.fecha) then raise exception 'ASIGNACION_CAMBIO'; end if;
150:  if p_accion not in ('entregar','fallida','revisar_cierre','cerrar') or p_accion is null then raise exception 'OPERACION_INVALIDA'; end if;
152:  if p_pedido is null or not exists(select 1 from operativo_privado.carga_pedidos cp join public.pedidos p on p.id=cp.pedido_id
153:  where cp.fecha=p_fecha and cp.incluido and cp.pedido_id=p_pedido and p.fecha_entrega=p_fecha) then raise exception 'NO_AUTORIZADO'; end if;
154:   -- La entrega vigente bloquea cliente antes de pedido. Si un administrador
156:  perform 1 from public.clientes c join public.pedidos p on p.cliente_id=c.id
157:  where p.id=p_pedido for update of c nowait;
159:  if p_pedido is not null then raise exception 'OPERACION_INVALIDA'; end if;
161:  insert into operativo_privado.reparto_capacidad values(txid_current(),auth.uid(),p_pedido,p_fecha);
164:  select * into h from operativo_privado.historial_operativo where pedido_id=p_pedido and clave_idempotencia=p_clave;
166:  if h.actor_id<>auth.uid() or h.operacion<>'entrega_todo_correcto' then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
169:  select jsonb_agg(jsonb_build_object('item_pedido_id',i.id,'cantidad_entregada',pi.cantidad_preparada) order by i.id) into items
170:  from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido;
172:  resultado:=public.confirmar_entrega_todo_correcto(p_pedido,p_version,p_clave,items,
175:  resultado:=public.registrar_entrega_fallida(p_pedido,p_version,p_clave,p_motivo,p_observaciones);
177:  resultado:=public.revisar_cierre_ruta(p_fecha);
179:  resultado:=public.cerrar_ruta(p_fecha,p_version,p_clave,p_huella);
182:  -- Nunca devolver snapshots contables, historial general ni evidencia del cierre.
193:  execute format('alter function %s owner to postgres',r.firma);

## supabase/manual/repartidores_gestion_fase1.sql

4: -- queda separada de la futura relación ruta/repartidores (uno o varios).
6: create function public.leer_gestion_repartidores_admin(p_busqueda text default '')
13:     raise exception 'NO_AUTORIZADO';
15:   if length(consulta) > 100 then raise exception 'BUSQUEDA_INVALIDA'; end if;
41: alter function public.leer_gestion_repartidores_admin(text) owner to postgres;

## supabase/manual/rutas_multiples_fase2.sql

2: -- Posterior a terminar_ruta_fase2, fases de entrega/cobro y repartidores_gestion_fase1.
3: -- No convierte cargas históricas. Una fecha con carga persistida sigue en legado.
4: -- No cambia importes, pagos, ventas ni las implementaciones contables de entrega.
8:  if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
9:  if to_regclass('operativo_privado.rutas_multi') is not null then raise exception 'FASE_YA_INSTALADA'; end if;
11:  'public.cerrar_ruta(date,bigint,uuid,text)','public.revisar_cierre_ruta(date)',
12:  'public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)','public.orden_ruta_dia(date,uuid[],bigint)',
13:  'public.obtener_o_crear_ruta_administrativa(date)','public.sincronizar_paradas_ruta_administrativa(uuid)',
19:  'public.guardar_orden_ruta_administrativo(uuid,uuid[],bigint)',
21:  if to_regprocedure(f) is null or not exists(select 1 from pg_proc where oid=to_regprocedure(f) and proowner='postgres'::regrole) then raise exception 'DEPENDENCIA_INCOMPATIBLE: %',f; end if;
24:  if has_schema_privilege(r,'operativo_privado','USAGE') or has_schema_privilege(r,'operativo_privado','CREATE') or has_schema_privilege(r,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',r; end if;
27: lock table public.pedidos, public.items_pedido, public.preparacion_items_pedido,
28:  public.rutas, public.paradas_ruta, operativo_privado.cargas, operativo_privado.carga_pedidos,
31: create table operativo_privado.rutas_multi (
32:  id uuid primary key references public.rutas(id), fecha date not null check(isfinite(fecha)),
39: -- Una pertenencia vigente por pedido, incluso tras cierre hasta la futura fase
41: create table operativo_privado.ruta_multi_pedidos (
42:  pedido_id uuid primary key references public.pedidos(id),
43:  ruta_id uuid not null references operativo_privado.rutas_multi(id), posicion integer not null check(posicion>0)
45: create index ruta_multi_pedidos_ruta on operativo_privado.ruta_multi_pedidos(ruta_id,posicion);
46: create table operativo_privado.ruta_multi_repartidores (
47:  ruta_id uuid not null references operativo_privado.rutas_multi(id),
48:  usuario_id uuid not null references operativo_privado.repartidores(usuario_id), primary key(ruta_id,usuario_id)
50: create table operativo_privado.ruta_multi_autorizaciones (
51:  ruta_id uuid not null references operativo_privado.rutas_multi(id), pedido_id uuid not null references public.pedidos(id),
53:  primary key(ruta_id,pedido_id)
55: create table operativo_privado.ruta_multi_eventos (
56:  clave uuid primary key, ruta_id uuid not null references operativo_privado.rutas_multi(id),
60: create trigger ruta_multi_eventos_inmutables before update or delete on operativo_privado.ruta_multi_eventos for each row execute function operativo_privado.impedir_mutacion_historial();
61: create trigger ruta_multi_eventos_no_truncables before truncate on operativo_privado.ruta_multi_eventos for each statement execute function operativo_privado.impedir_mutacion_historial();
63: create table operativo_privado.ruta_multi_capacidad (
64:  transaccion bigint primary key, actor uuid not null, ruta_id uuid not null, pedido_id uuid, accion text not null
67:  foreach t in array array['rutas_multi','ruta_multi_pedidos','ruta_multi_repartidores','ruta_multi_autorizaciones','ruta_multi_eventos','ruta_multi_capacidad'] loop
68:  execute format('alter table operativo_privado.%I owner to postgres',t);
69:  execute format('alter table operativo_privado.%I enable row level security',t);
70:  execute format('alter table operativo_privado.%I force row level security',t);
72:  execute format('create trigger multi_no_truncable before truncate on operativo_privado.%I for each statement execute function operativo_privado.impedir_mutacion_historial()',t);
76: create function operativo_privado.cantidades_ruta_multi(p_pedido uuid) returns jsonb
80:  from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido;
82: create function operativo_privado.estado_preparacion_multi(p_pedido uuid) returns text
86:  from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p_pedido;
88: create function operativo_privado.snapshot_ruta_multi(p_ruta uuid) returns jsonb
90:  select jsonb_build_object('ruta',to_jsonb(r),
91:  'pedidos',coalesce((select jsonb_agg(jsonb_build_object('pedido',to_jsonb(p),'posicion',m.posicion,
92:  'version',coalesce(v.version,0),'cantidades',operativo_privado.cantidades_ruta_multi(p.id),
93:  'preparacion',coalesce((select jsonb_agg(to_jsonb(pi) order by item_pedido_id) from public.preparacion_items_pedido pi where pi.pedido_id=p.id),'[]'::jsonb),
94:  'historial',coalesce((select jsonb_agg(to_jsonb(h) order by version) from operativo_privado.historial_operativo h where h.pedido_id=p.id),'[]'::jsonb)) order by m.posicion,p.id)
95:  from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id left join operativo_privado.versiones_pedido v on v.pedido_id=p.id where m.ruta_id=r.id),'[]'::jsonb),
96:  'repartidores',coalesce((select jsonb_agg(usuario_id order by usuario_id) from operativo_privado.ruta_multi_repartidores where ruta_id=r.id),'[]'::jsonb),
97:  'autorizaciones',coalesce((select jsonb_agg(to_jsonb(a) order by pedido_id) from operativo_privado.ruta_multi_autorizaciones a where ruta_id=r.id),'[]'::jsonb))
98:  from operativo_privado.rutas_multi r where r.id=p_ruta;
101: create function public.leer_rutas_multiples(p_fecha date) returns jsonb
104:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
105:  if p_fecha is null or not isfinite(p_fecha) then raise exception 'FECHA_INVALIDA'; end if;
106:  return jsonb_build_object('contrato',2,'legado',exists(select 1 from operativo_privado.cargas where fecha=p_fecha),
107:  'rutas',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.nombre,'estado',r.estado,'version',r.version,
108:  'pedidos',coalesce((select jsonb_agg(pedido_id order by posicion,pedido_id) from operativo_privado.ruta_multi_pedidos where ruta_id=r.id),'[]'::jsonb),
109:  'repartidores',coalesce((select jsonb_agg(usuario_id order by usuario_id) from operativo_privado.ruta_multi_repartidores where ruta_id=r.id),'[]'::jsonb),
110:  'autorizaciones',coalesce((select jsonb_agg(jsonb_build_object('pedido',pedido_id,'version',version,'motivo',motivo,'actor',actor,'cantidades',cantidades) order by pedido_id) from operativo_privado.ruta_multi_autorizaciones where ruta_id=r.id),'[]'::jsonb),
114:  from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id where m.ruta_id=r.id)) order by r.nombre,r.id)
115:  from operativo_privado.rutas_multi r where r.fecha=p_fecha),'[]'::jsonb),
123: create function operativo_privado.proteger_ruta_multi() returns trigger
125: declare pid uuid; r operativo_privado.rutas_multi%rowtype; omitidas text[];
127:  if TG_TABLE_NAME<>'pedidos' and TG_OP='UPDATE' then
128:  if old.pedido_id is distinct from new.pedido_id and exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id in (old.pedido_id,new.pedido_id)) then raise exception 'PERTENENCIA_INMUTABLE'; end if;
130:  if TG_TABLE_NAME='pedidos' then pid:=old.id;
131:  elsif TG_OP='DELETE' then pid:=old.pedido_id;
132:  else pid:=new.pedido_id; end if;
133:  -- Lock común del pedido también para INSERT/DELETE de líneas, sin invertir
135:  perform 1 from public.pedidos where id=pid for update nowait;
136:  select rm.* into r from operativo_privado.ruta_multi_pedidos m join operativo_privado.rutas_multi rm on rm.id=m.ruta_id where m.pedido_id=pid;
140:  if TG_TABLE_NAME<>'pedidos' then
141:  if TG_OP='UPDATE' and old.pedido_id is distinct from new.pedido_id then raise exception 'PERTENENCIA_INMUTABLE'; end if;
142:  if r.estado in ('en_reparto','cerrada') or (TG_TABLE_NAME='preparacion_items_pedido' and r.estado<>'preparacion') then raise exception 'RUTA_NO_EDITABLE'; end if;
143:  elsif TG_OP='DELETE' then raise exception 'PEDIDO_ASIGNADO_A_RUTA';
145:  if r.estado='planificacion' and new.estado='preparando' and old.estado is distinct from new.estado then raise exception 'RUTA_NO_EDITABLE'; end if;
146:  if new.fecha_entrega is distinct from old.fecha_entrega then raise exception 'PEDIDO_ASIGNADO_A_RUTA'; end if;
147:  if r.estado='cerrada' and to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'RUTA_NO_EDITABLE'; end if;
149:  select 1 from operativo_privado.ruta_multi_capacidad c where c.transaccion=txid_current() and c.actor=auth.uid() and c.ruta_id=r.id and c.pedido_id=pid and c.accion='salir') then raise exception 'SALIDA_REQUIERE_RUTA'; end if;
153:  if (to_jsonb(new)-omitidas) is distinct from (to_jsonb(old)-omitidas) or new.estado not in ('en_reparto','entregado','entrega_fallida') then raise exception 'RUTA_NO_EDITABLE'; end if;
158: create trigger multi_proteger_pedido before update or delete on public.pedidos for each row execute function operativo_privado.proteger_ruta_multi();
159: create trigger multi_proteger_items before insert or update or delete on public.items_pedido for each row execute function operativo_privado.proteger_ruta_multi();
160: create trigger multi_proteger_preparacion before insert or update or delete on public.preparacion_items_pedido for each row execute function operativo_privado.proteger_ruta_multi();
162: create function public.operar_ruta_multiple(p_solicitud jsonb) returns jsonb
164: declare s jsonb:=p_solicitud; accion text:=s->>'accion'; rid uuid:=(s->>'ruta')::uuid;
166:  r operativo_privado.rutas_multi%rowtype; h operativo_privado.ruta_multi_eventos%rowtype;
167:  p public.pedidos%rowtype; pv bigint; antes jsonb; resultado jsonb; cantidades jsonb; prep text; ids uuid[]; us uuid[];
168:  esadmin boolean; it jsonb; hist operativo_privado.historial_operativo%rowtype;
170:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
172:  if auth.uid() is null or (not esadmin and not public.acceso_repartidor()) then raise exception 'NO_AUTORIZADO'; end if;
174:  or accion is null or accion not in ('crear','seleccionar','asignar','preparar','autorizar_parcial','salir','cerrar','ordenar','entregar','fallida') then raise exception 'OPERACION_INVALIDA'; end if;
176:  -- pedido de las RPC contables: un conflicto revierte sin efectos parciales.
177:  lock table public.pedidos in exclusive mode nowait;
180:  select 1 from operativo_privado.ruta_multi_repartidores a join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo
181:  join operativo_privado.rutas_multi rm on rm.id=a.ruta_id where a.ruta_id=rid and a.usuario_id=auth.uid() and rm.fecha=f)) then raise exception 'NO_AUTORIZADO'; end if;
182:  select e.* into h from operativo_privado.ruta_multi_eventos e where e.clave=(s->>'clave')::uuid;
184:  if h.actor<>auth.uid() or h.solicitud<>s then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
187:  if exists(select 1 from operativo_privado.cargas where fecha=f) then raise exception 'JORNADA_LEGACY'; end if;
189:  if ver<>0 or nullif(btrim(s->>'nombre'),'') is null or length(btrim(s->>'nombre'))>100 then raise exception 'NOMBRE_INVALIDO'; end if;
190:  insert into public.rutas(id,fecha_operativa,nombre,creada_por) values(rid,f,btrim(s->>'nombre'),auth.uid());
191:  insert into operativo_privado.rutas_multi(id,fecha,nombre) values(rid,f,btrim(s->>'nombre'));
193:  select * into r from operativo_privado.rutas_multi where id=rid for update;
194:  if not found or r.fecha<>f then raise exception 'RUTA_NO_ENCONTRADA'; end if;
195:  -- También consumir versión de ruta para invalidar asignaciones revocadas.
196:  if r.version<>ver then raise exception 'VERSION_RUTA_CONFLICTO'; end if;
197:  if r.estado='cerrada' or (r.estado='en_reparto' and accion not in ('cerrar','entregar','fallida')) then raise exception 'RUTA_NO_EDITABLE'; end if;
198:  antes:=operativo_privado.snapshot_ruta_multi(rid);
200:  if jsonb_typeof(s->'pedidos') is distinct from 'array' then raise exception 'SELECCION_INVALIDA'; end if;
201:  select coalesce(array_agg(value::uuid),array[]::uuid[]) into ids from jsonb_array_elements_text(s->'pedidos');
202:  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
203:  if accion='ordenar' and (select coalesce(array_agg(pedido_id order by pedido_id),array[]::uuid[]) from operativo_privado.ruta_multi_pedidos where ruta_id=rid)
204:  is distinct from (select coalesce(array_agg(x order by x),array[]::uuid[]) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
205:  if exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=any(ids) and ruta_id<>rid) then raise exception 'PEDIDO_YA_ASIGNADO'; end if;
206:  if (select count(*) from public.pedidos where id=any(ids) and fecha_entrega=f and estado in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho'))<>cardinality(ids)
207:  or exists(select 1 from operativo_privado.carga_pedidos where pedido_id=any(ids)) then raise exception 'SELECCION_INVALIDA'; end if;
208:  delete from operativo_privado.ruta_multi_autorizaciones where ruta_id=rid and not(pedido_id=any(ids));
209:  delete from operativo_privado.ruta_multi_pedidos where ruta_id=rid;
210:  insert into operativo_privado.ruta_multi_pedidos(pedido_id,ruta_id,posicion) select x,rid,n::integer from unnest(ids) with ordinality u(x,n);
212:  if jsonb_typeof(s->'repartidores') is distinct from 'array' then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
214:  if cardinality(us)<>(select count(*) from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=any(us) and rp.activo and pf.rol<>'admin') then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
215:  delete from operativo_privado.ruta_multi_repartidores where ruta_id=rid;
216:  insert into operativo_privado.ruta_multi_repartidores select rid,x from unnest(us) x;
218:  if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
219:  if r.estado<>'planificacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
220:  update operativo_privado.rutas_multi set estado='preparacion' where id=rid;
222:  if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
223:  select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid for update of pe;
224:  if not found or operativo_privado.estado_preparacion_multi(p.id)<>'parcial' then raise exception 'AUTORIZACION_INVALIDA'; end if;
225:  select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
226:  if pv is distinct from (s->>'version_pedido')::bigint then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
227:  if nullif(btrim(s->>'motivo'),'') is null or length(s->>'motivo')>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
228:  cantidades:=operativo_privado.cantidades_ruta_multi(p.id);
229:  insert into operativo_privado.ruta_multi_autorizaciones(ruta_id,pedido_id,version,cantidades,motivo,actor)
230:  values(rid,p.id,pv,cantidades,btrim(s->>'motivo'),auth.uid()) on conflict(ruta_id,pedido_id) do update set
233:  if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
234:  if not exists(select 1 from operativo_privado.ruta_multi_pedidos where ruta_id=rid) then raise exception 'RUTA_VACIA'; end if;
235:  if not exists(select 1 from operativo_privado.ruta_multi_repartidores where ruta_id=rid) then raise exception 'REPARTIDORES_REQUERIDOS'; end if;
236:  if exists(select 1 from operativo_privado.ruta_multi_repartidores a where a.ruta_id=rid and not exists(select 1 from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=a.usuario_id and rp.activo and pf.rol<>'admin')) then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
237:  for p in select pe.* from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid order by pe.id for update of pe loop
238:  if p.fecha_entrega<>f or p.estado<>'listo_despacho' or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_LISTO'; end if;
239:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
240:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
241:  if not exists(select 1 from public.items_pedido where pedido_id=p.id) or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
242:  where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
244:  if prep='sin_preparar' then raise exception 'SIN_PREPARAR'; end if;
245:  select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
246:  if prep='parcial' and not exists(select 1 from operativo_privado.ruta_multi_autorizaciones a where a.ruta_id=rid and a.pedido_id=p.id and a.version=pv and a.cantidades=operativo_privado.cantidades_ruta_multi(p.id)) then raise exception 'PARCIAL_NO_AUTORIZADO'; end if;
247:  perform operativo_privado.iniciar_operacion(p.id,pv,clave,'ruta_multiple_salir',s);
248:  insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,'salir');
249:  update public.pedidos set estado='en_reparto' where id=p.id;
250:  delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
251:  perform operativo_privado.completar_operacion(p.id,pv,clave,'ruta_multiple_salir',s,null,'Salida explícita por ruta',to_jsonb(p),
252:  jsonb_build_object('estado','en_reparto','preparacion',prep,'cantidades',operativo_privado.cantidades_ruta_multi(p.id)),jsonb_build_object('ruta',rid,'estado','en_reparto'));
254:  if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
255:  update operativo_privado.rutas_multi set estado='en_reparto',salida_en=clock_timestamp() where id=rid;
257:  if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
258:  select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid;
259:  if not found then raise exception 'NO_AUTORIZADO'; end if;
261:  insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,accion);
263:  select * into hist from operativo_privado.historial_operativo where pedido_id=p.id and clave_idempotencia=clave;
265:  else select jsonb_agg(jsonb_build_object('item_pedido_id',i.id,'cantidad_entregada',pi.cantidad_preparada) order by i.id) into it
266:  from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id; end if;
267:  perform public.confirmar_entrega_todo_correcto(p.id,(s->>'version_pedido')::bigint,clave,it,
269:  else perform public.registrar_entrega_fallida(p.id,(s->>'version_pedido')::bigint,clave,s->>'motivo',s->>'observaciones'); end if;
270:  delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
272:  if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
273:  if exists(select 1 from operativo_privado.ruta_multi_pedidos m join public.pedidos pe on pe.id=m.pedido_id where m.ruta_id=rid and pe.estado not in ('entregado','entrega_fallida')) then raise exception 'PEDIDOS_PENDIENTES'; end if;
275:  -- Congela sólo los pedidos, cantidades, actores y eventos de ESTA ruta.
276:  update operativo_privado.rutas_multi set estado='cerrada',cierre=antes||jsonb_build_object('cerrada_en',clock_timestamp(),'cerrada_por',auth.uid()) where id=rid;
278:  update operativo_privado.rutas_multi set version=version+1 where id=rid;
279:  resultado:=jsonb_build_object('ok',true,'ruta',rid,'version',r.version+1);
280:  insert into operativo_privado.ruta_multi_eventos(clave,ruta_id,actor,solicitud,anterior,resultado)
281:  values(clave,rid,auth.uid(),s,antes,resultado||jsonb_build_object('snapshot',operativo_privado.snapshot_ruta_multi(rid)));
285: create or replace function operativo_privado.permiso_reparto(p_pedido uuid,p_fecha date) returns boolean
290:  where c.transaccion=txid_current() and c.actor=auth.uid() and (p_pedido is null or c.pedido_id=p_pedido) and (p_fecha is null or c.fecha=p_fecha))
291:  or (p_pedido is not null and p_fecha is null and exists(
292:  select 1 from operativo_privado.ruta_multi_capacidad c
293:  join operativo_privado.ruta_multi_repartidores a on a.ruta_id=c.ruta_id and a.usuario_id=c.actor
295:  join operativo_privado.ruta_multi_pedidos m on m.ruta_id=a.ruta_id and m.pedido_id=c.pedido_id
296:  join operativo_privado.rutas_multi r on r.id=a.ruta_id and r.estado='en_reparto'
297:  where c.transaccion=txid_current() and c.actor=auth.uid() and c.pedido_id=p_pedido and c.accion in ('entregar','fallida')));
300: create function operativo_privado.exigir_fecha_legacy(p_fecha date) returns void
303:  lock table public.pedidos in exclusive mode nowait;
304:  if exists(select 1 from operativo_privado.rutas_multi where fecha=p_fecha) then raise exception 'REQUIERE_RUTA_INDIVIDUAL'; end if;
310:  ('public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)','p_fecha'),
311:  ('public.cerrar_ruta(date,bigint,uuid,text)','p_fecha'),
312:  ('public.revisar_cierre_ruta(date)','p_fecha'),
313:  ('public.orden_ruta_dia(date,uuid[],bigint)','p_fecha'),
314:  ('public.obtener_o_crear_ruta_administrativa(date)','p_fecha_operativa'),
315:  ('public.sincronizar_paradas_ruta_administrativa(uuid)','(select fecha_operativa from public.rutas where id=p_ruta_id)'),
316:  ('public.guardar_orden_ruta_administrativo(uuid,uuid[],bigint)','(select fecha_operativa from public.rutas where id=p_ruta_id)'),
321:  if cuerpo is null or cuerpo !~* '(?m)^[[:space:]]*begin\M' or strpos(cuerpo,'exigir_fecha_legacy')>0 then raise exception 'CUERPO_INCOMPATIBLE: %',r.firma; end if;
324:  if strpos(d,cuerpo)=0 then raise exception 'DEFINICION_INCOMPATIBLE'; end if;
329: create function operativo_privado.proteger_contratos_multi() returns trigger
335:  if TG_TABLE_NAME in ('cargas','carga_pedidos') then
338:  elsif TG_TABLE_NAME='rutas' then
339:  if exists(select 1 from operativo_privado.rutas_multi where id in ((j->>'id')::uuid,(viejo->>'id')::uuid)) then raise exception 'REQUIERE_RUTA_INDIVIDUAL'; end if;
340:  elsif TG_TABLE_NAME='paradas_ruta' then
341:  if exists(select 1 from operativo_privado.rutas_multi where id in ((j->>'ruta_id')::uuid,(viejo->>'ruta_id')::uuid))
342:  or exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id in ((j->>'pedido_id')::uuid,(viejo->>'pedido_id')::uuid)) then raise exception 'REQUIERE_RUTA_INDIVIDUAL'; end if;
348: create trigger multi_barrera_cargas before insert or update or delete on operativo_privado.cargas for each row execute function operativo_privado.proteger_contratos_multi();
349: create trigger multi_barrera_seleccion before insert or update or delete on operativo_privado.carga_pedidos for each row execute function operativo_privado.proteger_contratos_multi();
350: create trigger multi_barrera_rutas before update or delete on public.rutas for each row execute function operativo_privado.proteger_contratos_multi();
351: create trigger multi_barrera_paradas before insert or update or delete on public.paradas_ruta for each row execute function operativo_privado.proteger_contratos_multi();
352: create trigger multi_barrera_asignaciones before insert or update or delete on operativo_privado.reparto_asignaciones for each row execute function operativo_privado.proteger_contratos_multi();
356: create function operativo_privado.invalidar_asignaciones_multi() returns trigger
359:  update operativo_privado.rutas_multi r set version=version+1
360:  where r.estado<>'cerrada' and exists(select 1 from operativo_privado.ruta_multi_repartidores a where a.ruta_id=r.id and a.usuario_id=new.usuario_id);
363: create trigger multi_invalidar_permiso after update of activo on operativo_privado.repartidores for each row execute function operativo_privado.invalidar_asignaciones_multi();
365: -- Conserva lectura de jornadas anteriores y añade rutas nuevas acotadas por
367: alter function public.leer_mi_reparto() set schema operativo_privado;
369: create function public.leer_mi_reparto() returns jsonb
372:  select jsonb_agg(jsonb_build_object('ruta',r.id,'nombre',r.nombre,'fecha',r.fecha,'asignacion',r.version,'estado','en_ruta',
373:  'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
377:  from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb)) order by m.posicion,p.id)
378:  from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id left join operativo_privado.versiones_pedido v on v.pedido_id=p.id where m.ruta_id=r.id),'[]'::jsonb)) order by r.fecha,r.nombre,r.id)
379:  from operativo_privado.rutas_multi r join operativo_privado.ruta_multi_repartidores a on a.ruta_id=r.id
386:  where (n.nspname='operativo_privado' and p.proname in ('cantidades_ruta_multi','estado_preparacion_multi','snapshot_ruta_multi','proteger_ruta_multi','exigir_fecha_legacy','proteger_contratos_multi','permiso_reparto','invalidar_asignaciones_multi'))
387:  or (n.nspname='public' and p.proname in ('leer_rutas_multiples','operar_ruta_multiple','leer_mi_reparto')) loop
388:  execute format('alter function %s owner to postgres',r.firma);

## supabase/manual/rutas_multiples_fase3.sql

2: -- No modifica cargas históricas, importes, pagos ni contratos contables.
6:  if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
7:  if to_regclass('operativo_privado.rutas_multi') is null then raise exception 'REQUIERE_FASE_2'; end if;
8:  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.operar_ruta_multiple(jsonb)') and proowner='postgres'::regrole and md5(prosrc)='3e7bedaabab7ed3dd7058cafa3fb1f21') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.operar_ruta_multiple'; end if;
9:  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_rutas_multiples(date)') and proowner='postgres'::regrole and md5(prosrc)='5438a8139ed3f3845e618380ce2b6794') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_rutas_multiples'; end if;
10:  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_mi_reparto()') and proowner='postgres'::regrole and md5(prosrc)='bbeb502fd8085565c72e0f71f6f5b588') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_mi_reparto'; end if;
16:  if not exists(select 1 from pg_proc where oid=to_regprocedure(firma) and proowner='postgres'::regrole) then raise exception 'DEPENDENCIA_INCOMPATIBLE: %',firma; end if;
19:  if has_schema_privilege(rol,'operativo_privado','USAGE') or has_schema_privilege(rol,'operativo_privado','CREATE') or has_schema_privilege(rol,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',rol; end if;
22: lock table public.pedidos, operativo_privado.rutas_multi, operativo_privado.ruta_multi_pedidos, operativo_privado.ruta_multi_repartidores in access exclusive mode nowait;
23: create or replace function public.operar_ruta_multiple(p_solicitud jsonb) returns jsonb
25: declare s jsonb:=p_solicitud; accion text:=s->>'accion'; rid uuid:=(s->>'ruta')::uuid;
27:  r operativo_privado.rutas_multi%rowtype; h operativo_privado.ruta_multi_eventos%rowtype;
28:  p public.pedidos%rowtype; pv bigint; antes jsonb; resultado jsonb; cantidades jsonb; prep text; ids uuid[]; us uuid[];
29:  esadmin boolean; it jsonb; hist operativo_privado.historial_operativo%rowtype;
31:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
33:  if auth.uid() is null or (not esadmin and not public.acceso_repartidor()) then raise exception 'NO_AUTORIZADO'; end if;
35:  or accion is null or accion not in ('crear','seleccionar','asignar','preparar','autorizar_parcial','salir','cerrar','ordenar','entregar','fallida','incorporar') then raise exception 'OPERACION_INVALIDA'; end if;
37:  -- pedido de las RPC contables: un conflicto revierte sin efectos parciales.
38:  lock table public.pedidos in exclusive mode nowait;
41:  select 1 from operativo_privado.ruta_multi_repartidores a join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo
42:  join operativo_privado.rutas_multi rm on rm.id=a.ruta_id where a.ruta_id=rid and a.usuario_id=auth.uid() and rm.fecha=f)) then raise exception 'NO_AUTORIZADO'; end if;
43:  select e.* into h from operativo_privado.ruta_multi_eventos e where e.clave=(s->>'clave')::uuid;
45:  if h.actor<>auth.uid() or h.solicitud<>s then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
48:  if exists(select 1 from operativo_privado.cargas where fecha=f) then raise exception 'JORNADA_LEGACY'; end if;
50:  if ver<>0 or nullif(btrim(s->>'nombre'),'') is null or length(btrim(s->>'nombre'))>100 then raise exception 'NOMBRE_INVALIDO'; end if;
51:  insert into public.rutas(id,fecha_operativa,nombre,creada_por) values(rid,f,btrim(s->>'nombre'),auth.uid());
52:  insert into operativo_privado.rutas_multi(id,fecha,nombre) values(rid,f,btrim(s->>'nombre'));
54:  select * into r from operativo_privado.rutas_multi where id=rid for update;
55:  if not found or r.fecha<>f then raise exception 'RUTA_NO_ENCONTRADA'; end if;
56:  -- También consumir versión de ruta para invalidar asignaciones revocadas.
57:  if r.version<>ver then raise exception 'VERSION_RUTA_CONFLICTO'; end if;
58:  if r.estado='cerrada' or (r.estado='en_reparto' and accion not in ('cerrar','entregar','fallida','incorporar')) then raise exception 'RUTA_NO_EDITABLE'; end if;
59:  antes:=operativo_privado.snapshot_ruta_multi(rid);
61:  if not esadmin or r.estado<>'en_reparto' then raise exception 'NO_AUTORIZADO'; end if;
62:  if nullif(btrim(s->>'motivo'),'') is null or length(s->>'motivo')>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
63:  if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
64:  if jsonb_typeof(s->'pedidos') is distinct from 'array' or jsonb_array_length(s->'pedidos')=0 then raise exception 'SELECCION_INVALIDA'; end if;
65:  select array_agg(value::uuid) into ids from jsonb_array_elements_text(s->'pedidos');
67:  or exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=any(ids))
68:  or exists(select 1 from operativo_privado.carga_pedidos where pedido_id=any(ids))
69:  or (select count(*) from public.pedidos where id=any(ids) and fecha_entrega=f and estado='listo_despacho' and regimen_contable='entrega_v1')<>cardinality(ids) then raise exception 'SELECCION_INVALIDA'; end if;
70:  if not exists(select 1 from operativo_privado.ruta_multi_repartidores a join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo where a.ruta_id=rid) then raise exception 'REPARTIDORES_REQUERIDOS'; end if;
72:  insert into operativo_privado.ruta_multi_pedidos(pedido_id,ruta_id,posicion)
73:  select x,rid,(select coalesce(max(posicion),0) from operativo_privado.ruta_multi_pedidos where ruta_id=rid)+n::integer
75:  for p in select pe.* from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=any(ids) order by pe.id for update of pe loop
76:  if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
77:  if p.fecha_entrega<>f or p.estado<>'listo_despacho' or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_LISTO'; end if;
78:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
79:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
80:  if not exists(select 1 from public.items_pedido where pedido_id=p.id) or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
81:  where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
83:  if prep<>'listo' then raise exception 'INCORPORACION_REQUIERE_LISTO'; end if;
84:  select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
85:  perform operativo_privado.iniciar_operacion(p.id,pv,clave,'ruta_multiple_incorporar',s);
86:  insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,'salir');
87:  update public.pedidos set estado='en_reparto' where id=p.id;
88:  delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
89:  perform operativo_privado.completar_operacion(p.id,pv,clave,'ruta_multiple_incorporar',s,null,btrim(s->>'motivo'),to_jsonb(p),
90:  jsonb_build_object('estado','en_reparto','preparacion',prep,'cantidades',operativo_privado.cantidades_ruta_multi(p.id)),jsonb_build_object('ruta',rid,'estado','en_reparto'));
93:  if jsonb_typeof(s->'pedidos') is distinct from 'array' then raise exception 'SELECCION_INVALIDA'; end if;
94:  select coalesce(array_agg(value::uuid),array[]::uuid[]) into ids from jsonb_array_elements_text(s->'pedidos');
95:  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
96:  if accion='ordenar' and (select coalesce(array_agg(pedido_id order by pedido_id),array[]::uuid[]) from operativo_privado.ruta_multi_pedidos where ruta_id=rid)
97:  is distinct from (select coalesce(array_agg(x order by x),array[]::uuid[]) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
98:  if exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=any(ids) and ruta_id<>rid) then raise exception 'PEDIDO_YA_ASIGNADO'; end if;
99:  if (select count(*) from public.pedidos where id=any(ids) and fecha_entrega=f and estado in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho'))<>cardinality(ids)
100:  or exists(select 1 from operativo_privado.carga_pedidos where pedido_id=any(ids)) then raise exception 'SELECCION_INVALIDA'; end if;
101:  delete from operativo_privado.ruta_multi_autorizaciones where ruta_id=rid and not(pedido_id=any(ids));
102:  delete from operativo_privado.ruta_multi_pedidos where ruta_id=rid;
103:  insert into operativo_privado.ruta_multi_pedidos(pedido_id,ruta_id,posicion) select x,rid,n::integer from unnest(ids) with ordinality u(x,n);
105:  if jsonb_typeof(s->'repartidores') is distinct from 'array' then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
107:  if cardinality(us)<>(select count(*) from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=any(us) and rp.activo and pf.rol<>'admin') then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
108:  delete from operativo_privado.ruta_multi_repartidores where ruta_id=rid;
109:  insert into operativo_privado.ruta_multi_repartidores select rid,x from unnest(us) x;
111:  if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
112:  if r.estado<>'planificacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
113:  update operativo_privado.rutas_multi set estado='preparacion' where id=rid;
115:  if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
116:  select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid for update of pe;
117:  if not found or operativo_privado.estado_preparacion_multi(p.id)<>'parcial' then raise exception 'AUTORIZACION_INVALIDA'; end if;
118:  select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
119:  if pv is distinct from (s->>'version_pedido')::bigint then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
120:  if nullif(btrim(s->>'motivo'),'') is null or length(s->>'motivo')>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
121:  cantidades:=operativo_privado.cantidades_ruta_multi(p.id);
122:  insert into operativo_privado.ruta_multi_autorizaciones(ruta_id,pedido_id,version,cantidades,motivo,actor)
123:  values(rid,p.id,pv,cantidades,btrim(s->>'motivo'),auth.uid()) on conflict(ruta_id,pedido_id) do update set
126:  if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
127:  if not exists(select 1 from operativo_privado.ruta_multi_pedidos where ruta_id=rid) then raise exception 'RUTA_VACIA'; end if;
128:  if not exists(select 1 from operativo_privado.ruta_multi_repartidores where ruta_id=rid) then raise exception 'REPARTIDORES_REQUERIDOS'; end if;
129:  if exists(select 1 from operativo_privado.ruta_multi_repartidores a where a.ruta_id=rid and not exists(select 1 from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=a.usuario_id and rp.activo and pf.rol<>'admin')) then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
130:  for p in select pe.* from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid order by pe.id for update of pe loop
131:  if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
132:  if p.fecha_entrega<>f or p.estado<>'listo_despacho' or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_LISTO'; end if;
133:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
134:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
135:  if not exists(select 1 from public.items_pedido where pedido_id=p.id) or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
136:  where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
138:  if prep='sin_preparar' then raise exception 'SIN_PREPARAR'; end if;
139:  select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
140:  if prep='parcial' and not exists(select 1 from operativo_privado.ruta_multi_autorizaciones a where a.ruta_id=rid and a.pedido_id=p.id and a.version=pv and a.cantidades=operativo_privado.cantidades_ruta_multi(p.id)) then raise exception 'PARCIAL_NO_AUTORIZADO'; end if;
141:  perform operativo_privado.iniciar_operacion(p.id,pv,clave,'ruta_multiple_salir',s);
142:  insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,'salir');
143:  update public.pedidos set estado='en_reparto' where id=p.id;
144:  delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
145:  perform operativo_privado.completar_operacion(p.id,pv,clave,'ruta_multiple_salir',s,null,'Salida explícita por ruta',to_jsonb(p),
146:  jsonb_build_object('estado','en_reparto','preparacion',prep,'cantidades',operativo_privado.cantidades_ruta_multi(p.id)),jsonb_build_object('ruta',rid,'estado','en_reparto'));
148:  if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
149:  update operativo_privado.rutas_multi set estado='en_reparto',salida_en=clock_timestamp() where id=rid;
151:  if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
152:  select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid;
153:  if not found then raise exception 'NO_AUTORIZADO'; end if;
155:  insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,accion);
157:  select * into hist from operativo_privado.historial_operativo where pedido_id=p.id and clave_idempotencia=clave;
159:  else select jsonb_agg(jsonb_build_object('item_pedido_id',i.id,'cantidad_entregada',pi.cantidad_preparada) order by i.id) into it
160:  from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id; end if;
161:  perform public.confirmar_entrega_todo_correcto(p.id,(s->>'version_pedido')::bigint,clave,it,
163:  else perform public.registrar_entrega_fallida(p.id,(s->>'version_pedido')::bigint,clave,s->>'motivo',s->>'observaciones'); end if;
164:  delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
166:  if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
167:  if exists(select 1 from operativo_privado.ruta_multi_pedidos m join public.pedidos pe on pe.id=m.pedido_id where m.ruta_id=rid and pe.estado not in ('entregado','entrega_fallida')) then raise exception 'PEDIDOS_PENDIENTES'; end if;
169:  -- Congela sólo los pedidos, cantidades, actores y eventos de ESTA ruta.
170:  update operativo_privado.rutas_multi set estado='cerrada',cierre=antes||jsonb_build_object('cerrada_en',clock_timestamp(),'cerrada_por',auth.uid()) where id=rid;
172:  update operativo_privado.rutas_multi set version=version+1 where id=rid;
173:  resultado:=jsonb_build_object('ok',true,'ruta',rid,'version',r.version+1);
176:  select 1 from jsonb_array_elements(antes->'pedidos') x where x->'pedido'->>'estado' in ('entregado','entrega_fallida'))
177:  then 'incorporacion_extraordinaria' else 'modificacion_controlada' end,'pedidos_agregados',to_jsonb(ids));
179:  insert into operativo_privado.ruta_multi_eventos(clave,ruta_id,actor,solicitud,anterior,resultado)
180:  values(clave,rid,auth.uid(),s,antes,resultado||jsonb_build_object('snapshot',operativo_privado.snapshot_ruta_multi(rid)));
183: create or replace function public.leer_rutas_multiples(p_fecha date) returns jsonb
186:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
187:  if p_fecha is null or not isfinite(p_fecha) then raise exception 'FECHA_INVALIDA'; end if;
188:  return jsonb_build_object('contrato',3,'legado',exists(select 1 from operativo_privado.cargas where fecha=p_fecha),
189:  'rutas',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.nombre,'estado',r.estado,'version',r.version,
190:  'pedidos',coalesce((select jsonb_agg(pedido_id order by posicion,pedido_id) from operativo_privado.ruta_multi_pedidos where ruta_id=r.id),'[]'::jsonb),
191:  'repartidores',coalesce((select jsonb_agg(usuario_id order by usuario_id) from operativo_privado.ruta_multi_repartidores where ruta_id=r.id),'[]'::jsonb),
192:  'autorizaciones',coalesce((select jsonb_agg(jsonb_build_object('pedido',pedido_id,'version',version,'motivo',motivo,'actor',actor,'cantidades',cantidades) order by pedido_id) from operativo_privado.ruta_multi_autorizaciones where ruta_id=r.id),'[]'::jsonb),
193:  'historial',coalesce((select jsonb_agg(jsonb_build_object('clave',e.clave,'actor',e.actor,'instante',e.instante,'accion',e.solicitud->>'accion','motivo',e.solicitud->>'motivo','pedido',e.solicitud->>'pedido','resultado',e.resultado-'snapshot') order by e.instante,e.clave) from operativo_privado.ruta_multi_eventos e where e.ruta_id=r.id),'[]'::jsonb),
200:  from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id where m.ruta_id=r.id)) order by r.nombre,r.id)
201:  from operativo_privado.rutas_multi r where r.fecha=p_fecha),'[]'::jsonb),
205: create or replace function public.leer_mi_reparto() returns jsonb
208:  select jsonb_agg(jsonb_build_object('ruta',r.id,'nombre',r.nombre,'fecha',r.fecha,'asignacion',r.version,'estado','en_ruta',
209:  'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
213:  from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb)) order by m.posicion,p.id)
214:  from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id left join operativo_privado.versiones_pedido v on v.pedido_id=p.id where m.ruta_id=r.id),'[]'::jsonb)) order by r.fecha,r.nombre,r.id)
215:  from operativo_privado.rutas_multi r join operativo_privado.ruta_multi_repartidores a on a.ruta_id=r.id
221: revoke all on function public.operar_ruta_multiple(jsonb), public.leer_rutas_multiples(date), public.leer_mi_reparto() from public,anon,authenticated,service_role;
222: grant execute on function public.operar_ruta_multiple(jsonb), public.leer_rutas_multiples(date), public.leer_mi_reparto() to authenticated;

## supabase/manual/rutas_multiples_fase3_compatibilidad.sql

1: -- Fase 3: incremental corregido; sustituye a rutas_multiples_fase3.sql.
8: -- No modifica cargas históricas, importes, pagos ni contratos contables.
12:  if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
13:  if to_regclass('operativo_privado.rutas_multi') is null then raise exception 'REQUIERE_FASE_2'; end if;
14:  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.operar_ruta_multiple(jsonb)') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='3e7bedaabab7ed3dd7058cafa3fb1f21') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.operar_ruta_multiple'; end if;
15:  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_rutas_multiples(date)') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='5438a8139ed3f3845e618380ce2b6794') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_rutas_multiples'; end if;
16:  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_mi_reparto()') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='bbeb502fd8085565c72e0f71f6f5b588') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_mi_reparto'; end if;
18:  -- Contratos declarados en rutas_multiples_fase2.sql; no se reparan permisos.
19:  foreach firma in array array['public.operar_ruta_multiple(jsonb)',
20:  'public.leer_rutas_multiples(date)', 'public.leer_mi_reparto()'] loop
30:    when 'public.operar_ruta_multiple(jsonb)' then array['p_solicitud']::text[]
31:    when 'public.leer_rutas_multiples(date)' then array['p_fecha']::text[]
34:  and p.provolatile::text=case when firma='public.operar_ruta_multiple(jsonb)' then 'v' else 's' end
37:  ) then raise exception 'ATRIBUTOS_FASE_2_INCOMPATIBLES: %',firma; end if;
49:  raise exception 'PERMISOS_FASE_2_INCOMPATIBLES: %',firma;
57:  if not exists(select 1 from pg_proc where oid=to_regprocedure(firma) and proowner='postgres'::regrole) then raise exception 'DEPENDENCIA_INCOMPATIBLE: %',firma; end if;
60:  if has_schema_privilege(rol,'operativo_privado','USAGE') or has_schema_privilege(rol,'operativo_privado','CREATE') or has_schema_privilege(rol,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',rol; end if;
63: lock table public.pedidos, operativo_privado.rutas_multi, operativo_privado.ruta_multi_pedidos, operativo_privado.ruta_multi_repartidores in access exclusive mode nowait;
64: create or replace function public.operar_ruta_multiple(p_solicitud jsonb) returns jsonb
66: declare s jsonb:=p_solicitud; accion text:=s->>'accion'; rid uuid:=(s->>'ruta')::uuid;
68:  r operativo_privado.rutas_multi%rowtype; h operativo_privado.ruta_multi_eventos%rowtype;
69:  p public.pedidos%rowtype; pv bigint; antes jsonb; resultado jsonb; cantidades jsonb; prep text; ids uuid[]; us uuid[];
70:  esadmin boolean; it jsonb; hist operativo_privado.historial_operativo%rowtype;
72:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
74:  if auth.uid() is null or (not esadmin and not public.acceso_repartidor()) then raise exception 'NO_AUTORIZADO'; end if;
76:  or accion is null or accion not in ('crear','seleccionar','asignar','preparar','autorizar_parcial','salir','cerrar','ordenar','entregar','fallida','incorporar') then raise exception 'OPERACION_INVALIDA'; end if;
78:  -- pedido de las RPC contables: un conflicto revierte sin efectos parciales.
79:  lock table public.pedidos in exclusive mode nowait;
82:  select 1 from operativo_privado.ruta_multi_repartidores a join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo
83:  join operativo_privado.rutas_multi rm on rm.id=a.ruta_id where a.ruta_id=rid and a.usuario_id=auth.uid() and rm.fecha=f)) then raise exception 'NO_AUTORIZADO'; end if;
84:  select e.* into h from operativo_privado.ruta_multi_eventos e where e.clave=(s->>'clave')::uuid;
86:  if h.actor<>auth.uid() or h.solicitud<>s then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
89:  if exists(select 1 from operativo_privado.cargas where fecha=f) then raise exception 'JORNADA_LEGACY'; end if;
91:  if ver<>0 or nullif(btrim(s->>'nombre'),'') is null or length(btrim(s->>'nombre'))>100 then raise exception 'NOMBRE_INVALIDO'; end if;
92:  insert into public.rutas(id,fecha_operativa,nombre,creada_por) values(rid,f,btrim(s->>'nombre'),auth.uid());
93:  insert into operativo_privado.rutas_multi(id,fecha,nombre) values(rid,f,btrim(s->>'nombre'));
95:  select * into r from operativo_privado.rutas_multi where id=rid for update;
96:  if not found or r.fecha<>f then raise exception 'RUTA_NO_ENCONTRADA'; end if;
97:  -- También consumir versión de ruta para invalidar asignaciones revocadas.
98:  if r.version<>ver then raise exception 'VERSION_RUTA_CONFLICTO'; end if;
99:  if r.estado='cerrada' or (r.estado='en_reparto' and accion not in ('cerrar','entregar','fallida','incorporar')) then raise exception 'RUTA_NO_EDITABLE'; end if;
100:  antes:=operativo_privado.snapshot_ruta_multi(rid);
102:  if not esadmin or r.estado<>'en_reparto' then raise exception 'NO_AUTORIZADO'; end if;
103:  if nullif(btrim(s->>'motivo'),'') is null or length(s->>'motivo')>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
104:  if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
105:  if jsonb_typeof(s->'pedidos') is distinct from 'array' or jsonb_array_length(s->'pedidos')=0 then raise exception 'SELECCION_INVALIDA'; end if;
106:  select array_agg(value::uuid) into ids from jsonb_array_elements_text(s->'pedidos');
108:  or exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=any(ids))
109:  or exists(select 1 from operativo_privado.carga_pedidos where pedido_id=any(ids))
110:  or (select count(*) from public.pedidos where id=any(ids) and fecha_entrega=f and estado='listo_despacho' and regimen_contable='entrega_v1')<>cardinality(ids) then raise exception 'SELECCION_INVALIDA'; end if;
111:  if not exists(select 1 from operativo_privado.ruta_multi_repartidores a join operativo_privado.repartidores rp on rp.usuario_id=a.usuario_id and rp.activo where a.ruta_id=rid) then raise exception 'REPARTIDORES_REQUERIDOS'; end if;
113:  insert into operativo_privado.ruta_multi_pedidos(pedido_id,ruta_id,posicion)
114:  select x,rid,(select coalesce(max(posicion),0) from operativo_privado.ruta_multi_pedidos where ruta_id=rid)+n::integer
116:  for p in select pe.* from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=any(ids) order by pe.id for update of pe loop
117:  if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
118:  if p.fecha_entrega<>f or p.estado<>'listo_despacho' or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_LISTO'; end if;
119:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
120:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
121:  if not exists(select 1 from public.items_pedido where pedido_id=p.id) or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
122:  where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
124:  if prep<>'listo' then raise exception 'INCORPORACION_REQUIERE_LISTO'; end if;
125:  select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
126:  perform operativo_privado.iniciar_operacion(p.id,pv,clave,'ruta_multiple_incorporar',s);
127:  insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,'salir');
128:  update public.pedidos set estado='en_reparto' where id=p.id;
129:  delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
130:  perform operativo_privado.completar_operacion(p.id,pv,clave,'ruta_multiple_incorporar',s,null,btrim(s->>'motivo'),to_jsonb(p),
131:  jsonb_build_object('estado','en_reparto','preparacion',prep,'cantidades',operativo_privado.cantidades_ruta_multi(p.id)),jsonb_build_object('ruta',rid,'estado','en_reparto'));
134:  if jsonb_typeof(s->'pedidos') is distinct from 'array' then raise exception 'SELECCION_INVALIDA'; end if;
135:  select coalesce(array_agg(value::uuid),array[]::uuid[]) into ids from jsonb_array_elements_text(s->'pedidos');
136:  if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
137:  if accion='ordenar' and (select coalesce(array_agg(pedido_id order by pedido_id),array[]::uuid[]) from operativo_privado.ruta_multi_pedidos where ruta_id=rid)
138:  is distinct from (select coalesce(array_agg(x order by x),array[]::uuid[]) from unnest(ids) x) then raise exception 'SELECCION_INVALIDA'; end if;
139:  if exists(select 1 from operativo_privado.ruta_multi_pedidos where pedido_id=any(ids) and ruta_id<>rid) then raise exception 'PEDIDO_YA_ASIGNADO'; end if;
140:  if (select count(*) from public.pedidos where id=any(ids) and fecha_entrega=f and estado in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho'))<>cardinality(ids)
141:  or exists(select 1 from operativo_privado.carga_pedidos where pedido_id=any(ids)) then raise exception 'SELECCION_INVALIDA'; end if;
142:  delete from operativo_privado.ruta_multi_autorizaciones where ruta_id=rid and not(pedido_id=any(ids));
143:  delete from operativo_privado.ruta_multi_pedidos where ruta_id=rid;
144:  insert into operativo_privado.ruta_multi_pedidos(pedido_id,ruta_id,posicion) select x,rid,n::integer from unnest(ids) with ordinality u(x,n);
146:  if jsonb_typeof(s->'repartidores') is distinct from 'array' then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
148:  if cardinality(us)<>(select count(*) from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=any(us) and rp.activo and pf.rol<>'admin') then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
149:  delete from operativo_privado.ruta_multi_repartidores where ruta_id=rid;
150:  insert into operativo_privado.ruta_multi_repartidores select rid,x from unnest(us) x;
152:  if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
153:  if r.estado<>'planificacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
154:  update operativo_privado.rutas_multi set estado='preparacion' where id=rid;
156:  if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
157:  select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid for update of pe;
158:  if not found or operativo_privado.estado_preparacion_multi(p.id)<>'parcial' then raise exception 'AUTORIZACION_INVALIDA'; end if;
159:  select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
160:  if pv is distinct from (s->>'version_pedido')::bigint then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
161:  if nullif(btrim(s->>'motivo'),'') is null or length(s->>'motivo')>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
162:  cantidades:=operativo_privado.cantidades_ruta_multi(p.id);
163:  insert into operativo_privado.ruta_multi_autorizaciones(ruta_id,pedido_id,version,cantidades,motivo,actor)
164:  values(rid,p.id,pv,cantidades,btrim(s->>'motivo'),auth.uid()) on conflict(ruta_id,pedido_id) do update set
167:  if r.estado<>'preparacion' then raise exception 'RUTA_NO_EDITABLE'; end if;
168:  if not exists(select 1 from operativo_privado.ruta_multi_pedidos where ruta_id=rid) then raise exception 'RUTA_VACIA'; end if;
169:  if not exists(select 1 from operativo_privado.ruta_multi_repartidores where ruta_id=rid) then raise exception 'REPARTIDORES_REQUERIDOS'; end if;
170:  if exists(select 1 from operativo_privado.ruta_multi_repartidores a where a.ruta_id=rid and not exists(select 1 from operativo_privado.repartidores rp join public.perfiles pf on pf.usuario_id=rp.usuario_id where rp.usuario_id=a.usuario_id and rp.activo and pf.rol<>'admin')) then raise exception 'REPARTIDOR_NO_HABILITADO'; end if;
171:  for p in select pe.* from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid order by pe.id for update of pe loop
172:  if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
173:  if p.fecha_entrega<>f or p.estado<>'listo_despacho' or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_LISTO'; end if;
174:  perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
175:  perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
176:  if not exists(select 1 from public.items_pedido where pedido_id=p.id) or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
177:  where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.cantidad_preparada is null or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
179:  if prep='sin_preparar' then raise exception 'SIN_PREPARAR'; end if;
180:  select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
181:  if prep='parcial' and not exists(select 1 from operativo_privado.ruta_multi_autorizaciones a where a.ruta_id=rid and a.pedido_id=p.id and a.version=pv and a.cantidades=operativo_privado.cantidades_ruta_multi(p.id)) then raise exception 'PARCIAL_NO_AUTORIZADO'; end if;
182:  perform operativo_privado.iniciar_operacion(p.id,pv,clave,'ruta_multiple_salir',s);
183:  insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,'salir');
184:  update public.pedidos set estado='en_reparto' where id=p.id;
185:  delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
186:  perform operativo_privado.completar_operacion(p.id,pv,clave,'ruta_multiple_salir',s,null,'Salida explícita por ruta',to_jsonb(p),
187:  jsonb_build_object('estado','en_reparto','preparacion',prep,'cantidades',operativo_privado.cantidades_ruta_multi(p.id)),jsonb_build_object('ruta',rid,'estado','en_reparto'));
189:  if f is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
190:  update operativo_privado.rutas_multi set estado='en_reparto',salida_en=clock_timestamp() where id=rid;
192:  if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
193:  select pe.* into p from public.pedidos pe join operativo_privado.ruta_multi_pedidos m on m.pedido_id=pe.id where m.ruta_id=rid and pe.id=(s->>'pedido')::uuid;
194:  if not found then raise exception 'NO_AUTORIZADO'; end if;
196:  insert into operativo_privado.ruta_multi_capacidad values(txid_current(),auth.uid(),rid,p.id,accion);
198:  select * into hist from operativo_privado.historial_operativo where pedido_id=p.id and clave_idempotencia=clave;
200:  else select jsonb_agg(jsonb_build_object('item_pedido_id',i.id,'cantidad_entregada',pi.cantidad_preparada) order by i.id) into it
201:  from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id; end if;
202:  perform public.confirmar_entrega_todo_correcto(p.id,(s->>'version_pedido')::bigint,clave,it,
204:  else perform public.registrar_entrega_fallida(p.id,(s->>'version_pedido')::bigint,clave,s->>'motivo',s->>'observaciones'); end if;
205:  delete from operativo_privado.ruta_multi_capacidad where transaccion=txid_current();
207:  if r.estado<>'en_reparto' then raise exception 'RUTA_NO_EDITABLE'; end if;
208:  if exists(select 1 from operativo_privado.ruta_multi_pedidos m join public.pedidos pe on pe.id=m.pedido_id where m.ruta_id=rid and pe.estado not in ('entregado','entrega_fallida')) then raise exception 'PEDIDOS_PENDIENTES'; end if;
210:  -- Congela sólo los pedidos, cantidades, actores y eventos de ESTA ruta.
211:  update operativo_privado.rutas_multi set estado='cerrada',cierre=antes||jsonb_build_object('cerrada_en',clock_timestamp(),'cerrada_por',auth.uid()) where id=rid;
213:  update operativo_privado.rutas_multi set version=version+1 where id=rid;
214:  resultado:=jsonb_build_object('ok',true,'ruta',rid,'version',r.version+1);
217:  select 1 from jsonb_array_elements(antes->'pedidos') x where x->'pedido'->>'estado' in ('entregado','entrega_fallida'))
218:  then 'incorporacion_extraordinaria' else 'modificacion_controlada' end,'pedidos_agregados',to_jsonb(ids));
220:  insert into operativo_privado.ruta_multi_eventos(clave,ruta_id,actor,solicitud,anterior,resultado)
221:  values(clave,rid,auth.uid(),s,antes,resultado||jsonb_build_object('snapshot',operativo_privado.snapshot_ruta_multi(rid)));
224: create or replace function public.leer_rutas_multiples(p_fecha date) returns jsonb
227:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
228:  if p_fecha is null or not isfinite(p_fecha) then raise exception 'FECHA_INVALIDA'; end if;
229:  return jsonb_build_object('contrato',3,'legado',exists(select 1 from operativo_privado.cargas where fecha=p_fecha),
230:  'rutas',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.nombre,'estado',r.estado,'version',r.version,
231:  'pedidos',coalesce((select jsonb_agg(pedido_id order by posicion,pedido_id) from operativo_privado.ruta_multi_pedidos where ruta_id=r.id),'[]'::jsonb),
232:  'repartidores',coalesce((select jsonb_agg(usuario_id order by usuario_id) from operativo_privado.ruta_multi_repartidores where ruta_id=r.id),'[]'::jsonb),
233:  'autorizaciones',coalesce((select jsonb_agg(jsonb_build_object('pedido',pedido_id,'version',version,'motivo',motivo,'actor',actor,'cantidades',cantidades) order by pedido_id) from operativo_privado.ruta_multi_autorizaciones where ruta_id=r.id),'[]'::jsonb),
234:  'historial',coalesce((select jsonb_agg(jsonb_build_object('clave',e.clave,'actor',e.actor,'instante',e.instante,'accion',e.solicitud->>'accion','motivo',e.solicitud->>'motivo','pedido',e.solicitud->>'pedido','resultado',e.resultado-'snapshot') order by e.instante,e.clave) from operativo_privado.ruta_multi_eventos e where e.ruta_id=r.id),'[]'::jsonb),
241:  from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id where m.ruta_id=r.id)) order by r.nombre,r.id)
242:  from operativo_privado.rutas_multi r where r.fecha=p_fecha),'[]'::jsonb),
246: create or replace function public.leer_mi_reparto() returns jsonb
249:  select jsonb_agg(jsonb_build_object('ruta',r.id,'nombre',r.nombre,'fecha',r.fecha,'asignacion',r.version,'estado','en_ruta',
250:  'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
254:  from public.items_pedido i join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb)) order by m.posicion,p.id)
255:  from operativo_privado.ruta_multi_pedidos m join public.pedidos p on p.id=m.pedido_id left join operativo_privado.versiones_pedido v on v.pedido_id=p.id where m.ruta_id=r.id),'[]'::jsonb)) order by r.fecha,r.nombre,r.id)
256:  from operativo_privado.rutas_multi r join operativo_privado.ruta_multi_repartidores a on a.ruta_id=r.id
262: revoke all on function public.operar_ruta_multiple(jsonb), public.leer_rutas_multiples(date), public.leer_mi_reparto() from public,anon,authenticated,service_role;
263: grant execute on function public.operar_ruta_multiple(jsonb), public.leer_rutas_multiples(date), public.leer_mi_reparto() to authenticated;

## supabase/manual/terminar_ruta_fase2.sql

2: -- Auditoría integral estática: ver terminar_ruta_fase2_revision.md.
15:  -- instalar RPC que luego fallen o lean un historial/versión invisible.
18:  ) then raise exception 'FASE2_REQUIERE_POSTGRES_CON_BYPASSRLS'; end if;
21:  raise exception 'FASE2_REQUIERE_READ_COMMITTED_Y_TRIGGERS_ORIGIN'; end if;
23:  or to_regprocedure('public.cerrar_ruta(date,bigint,uuid,text)') is not null
24:  or to_regprocedure('operativo_privado.orden_ruta_dia(date,uuid[],bigint)') is not null
25:  or exists(select 1 from pg_attribute where attrelid=to_regclass('operativo_privado.cargas')
27:  raise exception 'FASE2_YA_INSTALADA_O_PARCIAL'; end if;
31:  or to_regprocedure('public.orden_ruta_dia(date,uuid[],bigint)') is null
32:  or to_regprocedure('public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)') is null
36:  raise exception 'DEPENDENCIAS_FASE2_INCOMPLETAS'; end if;
37:  if not exists(select 1 from pg_trigger where tgrelid='public.pedidos'::regclass
40:  raise exception 'BARRERA_ENTREGA_FALLIDA_NO_INSTALADA'; end if;
41:  -- Contrato real de columnas: preparacion_items_pedido SÍ tiene pedido_id.
44:  ('public.pedidos','id','uuid'), ('public.pedidos','estado','public.estado_pedido'),
45:  ('public.pedidos','fecha_entrega','date'), ('public.pedidos','numero_pedido','text'),
46:  ('public.pedidos','nombre_cliente_snapshot','text'),
47:  ('public.pedidos','fecha_actualizacion','timestamptz'),
48:  ('public.pedidos','preparacion_finalizada_en','timestamptz'),
49:  ('public.pedidos','regimen_contable','text'),
50:  ('public.pedidos','venta_definitiva_snapshot','jsonb'),
51:  ('public.pedidos','venta_reconocida_en','timestamptz'),
52:  ('public.items_pedido','id','uuid'), ('public.items_pedido','pedido_id','uuid'),
53:  ('public.items_pedido','nombre_producto_snapshot','text'),
54:  ('public.preparacion_items_pedido','pedido_id','uuid'),
55:  ('public.preparacion_items_pedido','item_pedido_id','uuid'),
56:  ('public.preparacion_items_pedido','cantidad_preparada','numeric'),
57:  ('public.preparacion_items_pedido','importe_linea_operativo','bigint'),
58:  ('public.preparacion_items_pedido','confirmado_explicito','boolean'),
59:  ('operativo_privado.cargas','fecha','date'), ('operativo_privado.cargas','estado','text'),
60:  ('operativo_privado.cargas','version','bigint'),
61:  ('operativo_privado.cargas','salida_en','timestamptz'),
62:  ('operativo_privado.carga_pedidos','fecha','date'),
63:  ('operativo_privado.carga_pedidos','pedido_id','uuid'),
64:  ('operativo_privado.carga_pedidos','incluido','boolean'),
65:  ('operativo_privado.carga_pedidos','motivo','text'),
66:  ('operativo_privado.versiones_pedido','pedido_id','uuid'),
67:  ('operativo_privado.versiones_pedido','version','bigint'),
68:  ('operativo_privado.historial_operativo','pedido_id','uuid'),
69:  ('operativo_privado.historial_operativo','version','bigint'),
70:  ('operativo_privado.historial_operativo','operacion','text'),
71:  ('operativo_privado.historial_operativo','actor_id','uuid'),
72:  ('operativo_privado.historial_operativo','motivo','text'),
73:  ('operativo_privado.historial_operativo','valores_anteriores','jsonb'),
74:  ('operativo_privado.historial_operativo','valores_nuevos','jsonb'),
75:  ('operativo_privado.historial_cargas','fecha','date'),
76:  ('operativo_privado.historial_cargas','version','bigint'),
77:  ('operativo_privado.historial_cargas','clave','uuid'),
78:  ('operativo_privado.historial_cargas','actor','uuid'),
79:  ('operativo_privado.historial_cargas','solicitud','jsonb'),
80:  ('operativo_privado.historial_cargas','anterior','jsonb'),
81:  ('operativo_privado.historial_cargas','resultado','jsonb'),
82:  ('operativo_privado.entregas_definitivas','pedido_id','uuid'),
85:  ('public.rutas','id','uuid'), ('public.rutas','fecha_operativa','date'),
86:  ('public.paradas_ruta','ruta_id','uuid'),
87:  ('operativo_privado.historial_operativo','clave_idempotencia','uuid'),
88:  ('operativo_privado.historial_operativo','version_esperada','bigint'),
89:  ('operativo_privado.historial_operativo','solicitud','jsonb'),
90:  ('operativo_privado.historial_operativo','resultado','jsonb')
96:  raise exception 'CONTRATO_COLUMNA_FASE2_INVALIDO: %.% (%)',r.tabla,r.columna,r.tipo;
100:  'public.es_admin()', 'auth.uid()', 'public.leer_carga_jornada(date)',
101:  'public.obtener_o_crear_ruta_administrativa(date)',
102:  'operativo_privado.proteger_pedido_cargado()',
104:  'public.proteger_regimen_contable_pedido()',
105:  'public.registrar_historial_estado_pedido()',
106:  'public.validar_coherencia_preparacion_item_pedido()',
107:  'operativo_privado.impedir_mutacion_historial()'
110:  raise exception 'FUNCION_FASE2_AUSENTE: %',firma; end if;
113:  ('public.pedidos','proteger_pedido_cargado','operativo_privado.proteger_pedido_cargado()'),
114:  ('public.pedidos','proteger_venta_definitiva','operativo_privado.proteger_venta_definitiva()'),
115:  ('public.pedidos','proteger_regimen_contable_pedido_antes_de_actualizar','public.proteger_regimen_contable_pedido()'),
116:  ('public.pedidos','registrar_historial_estado_pedido_despues_de_guardar','public.registrar_historial_estado_pedido()'),
117:  ('public.preparacion_items_pedido','validar_coherencia_preparacion_item_pedido_antes_de_guardar','public.validar_coherencia_preparacion_item_pedido()'),
118:  ('operativo_privado.historial_operativo','historial_operativo_inmutable','operativo_privado.impedir_mutacion_historial()'),
119:  ('operativo_privado.historial_operativo','historial_operativo_no_truncable','operativo_privado.impedir_mutacion_historial()'),
120:  ('operativo_privado.historial_cargas','historial_cargas_inmutable','operativo_privado.impedir_mutacion_historial()'),
121:  ('operativo_privado.historial_cargas','historial_cargas_no_truncable','operativo_privado.impedir_mutacion_historial()'),
122:  ('operativo_privado.entregas_definitivas','entregas_definitivas_inmutables','operativo_privado.impedir_mutacion_historial()'),
123:  ('operativo_privado.entregas_definitivas','entregas_definitivas_no_truncables','operativo_privado.impedir_mutacion_historial()')
128:  raise exception 'TRIGGER_FASE2_INVALIDO: %.%',r.tabla,r.nombre; end if;
132:  ('public.pedidos',array['id']), ('public.items_pedido',array['id']),
133:  ('public.preparacion_items_pedido',array['item_pedido_id']),
134:  ('operativo_privado.cargas',array['fecha']),
135:  ('operativo_privado.carga_pedidos',array['pedido_id']),
136:  ('operativo_privado.versiones_pedido',array['pedido_id']),
137:  ('operativo_privado.entregas_definitivas',array['pedido_id']),
138:  ('operativo_privado.historial_cargas',array['fecha','version']),
139:  ('operativo_privado.historial_cargas',array['fecha','clave']),
140:  ('operativo_privado.historial_operativo',array['pedido_id','version']),
141:  ('operativo_privado.historial_operativo',array['pedido_id','clave_idempotencia'])
149:  raise exception 'CLAVE_FASE2_INVALIDA: % (%)',r.tabla,r.columnas; end if;
155:  ('public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)',true),
156:  ('public.orden_ruta_dia(date,uuid[],bigint)',true),
164:  raise exception 'CONTRATO_FUNCION_FASE2_INVALIDO: %',r.firma; end if;
171:  raise exception 'ESQUEMA_FASE2_NO_AISLADO: %',rol; end if;
173:  where c.oid in ('public.pedidos'::regclass,'public.items_pedido'::regclass,
174:  'public.preparacion_items_pedido'::regclass) loop
177:  raise exception 'DML_PUBLICO_FASE2_NO_CERRADO: % (%)',r.relname,rol; end if;
182:  and c.relname in ('cargas','carga_pedidos','historial_cargas','versiones_pedido','historial_operativo','entregas_definitivas') loop
186:  raise exception 'TABLA_PRIVADA_FASE2_NO_AISLADA: % (%)',r.relname,rol; end if;
190:  where not exists(select 1 from pg_enum where enumtypid='public.estado_pedido'::regtype and enumlabel=e)) then
191:  raise exception 'ESTADOS_FASE2_INCOMPLETOS'; end if;
194: -- ciclos DDL con RPC que ya retengan filas de pedidos/rutas/líneas.
195: lock table public.pedidos, public.items_pedido, public.preparacion_items_pedido,
196:  public.rutas, public.paradas_ruta, operativo_privado.cargas,
197:  operativo_privado.carga_pedidos, operativo_privado.historial_cargas,
198:  operativo_privado.versiones_pedido, operativo_privado.historial_operativo,
201:  if exists(select 1 from public.preparacion_items_pedido pi
202:  left join public.items_pedido i on i.id=pi.item_pedido_id
203:  where i.id is null or pi.pedido_id is distinct from i.pedido_id) then
204:  raise exception 'PREPARACION_INCOHERENTE_PREEXISTENTE'; end if;
206: alter table operativo_privado.cargas drop constraint cargas_estado_check;
207: alter table operativo_privado.cargas add constraint cargas_estado_check
208:  check (estado in ('preparacion','lista','en_ruta','cerrada'));
209: alter table operativo_privado.cargas add column cerrada_en timestamptz,
211: alter table operativo_privado.cargas add constraint cierre_completo check (
216: create or replace function public.leer_carga_jornada(p_fecha date)
218: declare c operativo_privado.cargas%rowtype;
220:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
221:  if p_fecha is null or not isfinite(p_fecha) then raise exception 'OPERACION_INVALIDA'; end if;
224:  select * into c from operativo_privado.cargas where fecha=p_fecha;
226:  -- asignación actual del pedido (que puede pertenecer a un intento posterior).
229:  'pedidos',c.resumen_cierre->'pedidos_carga',
230:  'historial',coalesce((select jsonb_agg(to_jsonb(h) order by h.version desc)
231:  from operativo_privado.historial_cargas h where h.fecha=p_fecha),'[]'::jsonb));
234:  'estado',coalesce((select estado from operativo_privado.cargas where fecha=p_fecha),'preparacion'),
235:  'salida_en',(select salida_en from operativo_privado.cargas where fecha=p_fecha),
236:  'version',coalesce((select version from operativo_privado.cargas where fecha=p_fecha),0),
237:  'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
241:  from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb),'pendientes',
242:  (select count(*) from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
243:  where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.importe_linea_operativo is null))) order by p.numero_pedido)
244:  from public.pedidos p left join operativo_privado.carga_pedidos cp on cp.pedido_id=p.id and cp.fecha=p_fecha
246:  'historial',coalesce((select jsonb_agg(to_jsonb(h) order by h.version desc) from operativo_privado.historial_cargas h where h.fecha=p_fecha),'[]'::jsonb));
251: -- que no incrementan versiones_pedido. Nunca incluye pedidos sólo por fecha.
252: create function operativo_privado.snapshot_cierre(p_fecha date) returns jsonb
254:  select coalesce(jsonb_agg(jsonb_build_object('pedido',to_jsonb(p),
257:  from public.items_pedido i where i.pedido_id=p.id),'[]'::jsonb),
258:  'preparacion',coalesce((select jsonb_agg(to_jsonb(pi) order by pi.item_pedido_id)
259:  from public.preparacion_items_pedido pi where pi.pedido_id=p.id),'[]'::jsonb),
260:  'fallo',(select to_jsonb(h) from operativo_privado.historial_operativo h
261:  where h.pedido_id=p.id and h.operacion='entrega_fallida'
264:  select h.motivo from operativo_privado.historial_operativo h
265:  where h.pedido_id=p.id and h.operacion='entrega_fallida'
268:  from operativo_privado.carga_pedidos cp join public.pedidos p on p.id=cp.pedido_id
269:  left join operativo_privado.versiones_pedido v on v.pedido_id=p.id
272: create function public.revisar_cierre_ruta(p_fecha date) returns jsonb
274: declare c operativo_privado.cargas%rowtype; s jsonb;
276:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
277:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
278:  if p_fecha is null or not isfinite(p_fecha) then raise exception 'OPERACION_INVALIDA'; end if;
280:  -- UPDATE seguido de UPDATE de una entrega. Mantener hasta migrar RPC de carga.
281:  lock table public.pedidos in exclusive mode;
282:  perform pg_advisory_xact_lock(hashtextextended('carga:'||p_fecha::text,0));
283:  select * into c from operativo_privado.cargas where fecha=p_fecha;
285:  if c.estado is distinct from 'en_ruta' or c.salida_en is null then raise exception 'CARGA_NO_SALIO'; end if;
288:  'pedidos',coalesce((select jsonb_agg(jsonb_build_object(
289:  'id',x->'pedido'->>'id','numero',x->'pedido'->>'numero_pedido',
290:  'cliente',x->'pedido'->>'nombre_cliente_snapshot','estado',x->'pedido'->>'estado',
291:  'version',x->'version','motivo',x->'motivo') order by x->'pedido'->>'id')
294: create function public.cerrar_ruta(p_fecha date,p_version bigint,p_clave uuid,p_huella text)
296: declare c operativo_privado.cargas%rowtype; h operativo_privado.historial_cargas%rowtype;
299:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
300:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
302:  or p_huella is null or p_huella !~ '^[0-9a-f]{64}$' then raise exception 'OPERACION_INVALIDA'; end if;
305:  lock table public.pedidos in exclusive mode;
306:  perform pg_advisory_xact_lock(hashtextextended('carga:'||p_fecha::text,0));
308:  select * into h from operativo_privado.historial_cargas where fecha=p_fecha and clave=p_clave;
310:  if h.actor is distinct from auth.uid() or h.solicitud is distinct from solicitud then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
313:  select * into c from operativo_privado.cargas where fecha=p_fecha for update;
314:  if c.estado is distinct from 'en_ruta' or c.salida_en is null then raise exception 'CARGA_NO_SALIO'; end if;
315:  if c.version<>p_version then raise exception 'VERSION_CARGA_CONFLICTO'; end if;
317:  if encode(sha256(convert_to(s::text,'UTF8')),'hex')<>p_huella then raise exception 'RESUMEN_CIERRE_CONFLICTO'; end if;
318:  if jsonb_array_length(s)=0 then raise exception 'CARGA_VACIA'; end if;
319:  if exists(select 1 from jsonb_array_elements(s) x where coalesce(x->'pedido'->>'estado','') not in ('entregado','entrega_fallida')) then
320:  raise exception 'PEDIDOS_PENDIENTES'; end if;
323:  where x->'pedido'->>'fecha_entrega' is distinct from p_fecha::text
324:  or (x->'pedido'->>'estado'='entrega_fallida' and (
329:  or x->'pedido'->'venta_definitiva_snapshot' is distinct from 'null'::jsonb
330:  or x->'pedido'->'venta_reconocida_en' is distinct from 'null'::jsonb
332:  where e.pedido_id=(x->'pedido'->>'id')::uuid)))
333:  or (x->'pedido'->>'estado'='entregado' and x->'pedido'->>'regimen_contable'='entrega_v1'
335:  where e.pedido_id=(x->'pedido'->>'id')::uuid
336:  and e.snapshot=x->'pedido'->'venta_definitiva_snapshot'
337:  and e.instante=(x->'pedido'->>'venta_reconocida_en')::timestamptz))) then
338:  raise exception 'TRAZABILIDAD_INTENTO_INVALIDA'; end if;
339:  resumen:=public.revisar_cierre_ruta(p_fecha);
342:  -- Evidencia del intento y lectura de carga congeladas antes de cambiar estado.
343:  -- carga_pedidos conserva sólo la asignación vigente, no es tabla de intentos.
344:  'intentos',s,'pedidos_carga',public.leer_carga_jornada(p_fecha)->'pedidos',
346:  'entregados',(select count(*) from jsonb_array_elements(s) x where x->'pedido'->>'estado'='entregado'),
347:  'no_entregados',(select count(*) from jsonb_array_elements(s) x where x->'pedido'->>'estado'='entrega_fallida'),'pendientes',0);
348:  update operativo_privado.cargas set estado='cerrada',version=version+1,
350:  insert into operativo_privado.historial_cargas(fecha,version,clave,actor,solicitud,anterior,resultado)
352:  -- Ninguna escritura contable ni de pedidos: legado conserva íntegros sus saldos.
358: create table operativo_privado.permiso_reprogramacion (
359:  pedido_id uuid primary key, transaccion bigint not null, actor uuid not null,
360:  pedido_antes jsonb not null, pedido_despues jsonb not null,
363: alter table operativo_privado.permiso_reprogramacion owner to postgres;
364: alter table operativo_privado.permiso_reprogramacion enable row level security;
365: alter table operativo_privado.permiso_reprogramacion force row level security;
372: create function operativo_privado.permite_reprogramacion(p_tabla oid,p_antes jsonb,p_despues jsonb)
377:  where pedido_id=coalesce(p_antes->>'pedido_id',p_antes->>'id')::uuid
380:  if p_tabla='public.pedidos'::regclass then
383:  return (p_antes-omitidas)=(r.pedido_antes-omitidas)
384:  and (p_despues-omitidas)=(r.pedido_despues-omitidas);
385:  elsif p_tabla='operativo_privado.carga_pedidos'::regclass then
390: alter function operativo_privado.permite_reprogramacion(oid,jsonb,jsonb) owner to postgres;
393: -- La carga cerrada es inmutable. Sólo la capacidad exacta permite trasladar
394: -- una selección fallida; el resumen cerrado y ambos historiales se conservan.
395: create function operativo_privado.proteger_cierre_carga() returns trigger
399:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
400:  if TG_TABLE_NAME='cargas' then
401:  if old.estado='cerrada' then raise exception 'RUTA_CERRADA'; end if;
404:  perform 1 from operativo_privado.cargas
408:  if exists(select 1 from operativo_privado.cargas where estado='cerrada'
410:  or fecha=case when TG_OP='DELETE' then old.fecha else new.fecha end)) then raise exception 'RUTA_CERRADA'; end if;
415: create trigger proteger_cierre_carga before update or delete on operativo_privado.cargas
416:  for each row execute function operativo_privado.proteger_cierre_carga();
417: create trigger proteger_cierre_seleccion before insert or update or delete on operativo_privado.carga_pedidos
418:  for each row execute function operativo_privado.proteger_cierre_carga();
420: -- Todo UPDATE/DELETE directo de un pedido cerrado queda bloqueado. Las entregas
421: -- vigentes escriben pedidos dentro de su transacción: cualquier evento/pago
423: create function operativo_privado.proteger_pedido_ruta_cerrada() returns trigger
427:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
429:  if exists(select 1 from operativo_privado.carga_pedidos cp join operativo_privado.cargas c using(fecha)
430:  where cp.pedido_id=old.id and cp.incluido and c.estado='cerrada') then raise exception 'RUTA_CERRADA'; end if;
434: create trigger proteger_pedido_ruta_cerrada before update or delete on public.pedidos
435:  for each row execute function operativo_privado.proteger_pedido_ruta_cerrada();
437: -- Las líneas de carga/preparación tampoco pueden mutar después del cierre.
439: create function operativo_privado.proteger_linea_ruta_cerrada() returns trigger
444:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
445:  if TG_OP<>'INSERT' then anterior:=old.pedido_id; end if;
446:  if TG_OP<>'DELETE' then siguiente:=new.pedido_id; end if;
448:  if TG_RELID='public.preparacion_items_pedido'::regclass then
450:  select padres || coalesce(array_agg(i.pedido_id),array[]::uuid[]) into padres
451:  from public.items_pedido i where i.id in (
452:  case when TG_OP<>'INSERT' then old.item_pedido_id end,
453:  case when TG_OP<>'DELETE' then new.item_pedido_id end);
457:  perform 1 from public.pedidos where id=any(padres) order by id for update nowait;
460:  if TG_RELID='public.items_pedido'::regclass and TG_OP='UPDATE' then
461:  if exists(select 1 from public.preparacion_items_pedido pi
462:  where pi.item_pedido_id=old.id and pi.pedido_id is distinct from new.pedido_id) then
463:  raise exception 'ITEM_PEDIDO_NO_CORRESPONDE_AL_PEDIDO'; end if;
465:  if exists(select 1 from operativo_privado.carga_pedidos cp join operativo_privado.cargas c using(fecha)
466:  where cp.pedido_id=any(padres) and cp.incluido and c.estado='cerrada') then raise exception 'RUTA_CERRADA'; end if;
470: create trigger proteger_items_ruta_cerrada before insert or update or delete on public.items_pedido
471:  for each row execute function operativo_privado.proteger_linea_ruta_cerrada();
472: create trigger proteger_preparacion_ruta_cerrada before insert or update or delete on public.preparacion_items_pedido
473:  for each row execute function operativo_privado.proteger_linea_ruta_cerrada();
474: alter function operativo_privado.proteger_linea_ruta_cerrada() owner to postgres;
475: revoke all on function operativo_privado.proteger_linea_ruta_cerrada() from public,anon,authenticated,service_role;
481: -- filas de rutas/paradas retenidas. Reintentar toda la transacción ante 55P03.
482: create function operativo_privado.proteger_orden_ruta_cerrada() returns trigger
487:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
488:  lock table public.pedidos in exclusive mode nowait;
489:  if TG_TABLE_NAME='rutas' then
490:  if exists(select 1 from operativo_privado.cargas c where c.estado='cerrada'
492:  or c.fecha=case when TG_OP='DELETE' then old.fecha_operativa else new.fecha_operativa end)) then raise exception 'RUTA_CERRADA'; end if;
494:  if TG_OP<>'INSERT' then anterior:=old.ruta_id; end if;
495:  if TG_OP<>'DELETE' then siguiente:=new.ruta_id; end if;
496:  if exists(select 1 from public.rutas r join operativo_privado.cargas c on c.fecha=r.fecha_operativa
497:  where r.id in (anterior,siguiente) and c.estado='cerrada') then raise exception 'RUTA_CERRADA'; end if;
502: create trigger proteger_orden_cerrado before insert or update or delete on public.paradas_ruta
503:  for each row execute function operativo_privado.proteger_orden_ruta_cerrada();
504: create trigger proteger_ruta_cerrada before insert or update or delete on public.rutas
505:  for each row execute function operativo_privado.proteger_orden_ruta_cerrada();
508: alter function public.orden_ruta_dia(date,uuid[],bigint) set schema operativo_privado;
509: alter function operativo_privado.orden_ruta_dia(date,uuid[],bigint) set search_path=pg_catalog;
510: revoke all on function operativo_privado.orden_ruta_dia(date,uuid[],bigint) from public,anon,authenticated,service_role;
511: create function public.orden_ruta_dia(p_fecha date,p_orden uuid[] default null,p_version bigint default null)
514:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
515:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
516:  if p_fecha is null or not isfinite(p_fecha) then raise exception 'OPERACION_INVALIDA'; end if;
518:  -- Antes del advisory de ruta y de cualquier FOR SHARE de la implementación.
521:  lock table public.pedidos in exclusive mode nowait;
522:  if exists(select 1 from operativo_privado.cargas where fecha=p_fecha and estado='cerrada') then raise exception 'RUTA_CERRADA'; end if;
524:  return operativo_privado.orden_ruta_dia(p_fecha,p_orden,p_version);
527: create or replace function operativo_privado.proteger_entrega_fallida()
533:       and exists (select 1 from operativo_privado.historial_operativo
534:         where pedido_id = old.id and operacion = 'entrega_fallida') then
535:       raise exception 'ENTREGA_FALLIDA_SIN_REPROGRAMACION';
540:     if TG_OP = 'INSERT' then raise exception 'ENTREGA_FALLIDA_REQUIERE_OPERACION'; end if;
544:         select 1 from operativo_privado.historial_operativo h
545:         join operativo_privado.versiones_pedido v
546:           on v.pedido_id = h.pedido_id and v.version = h.version
547:         where h.pedido_id = new.id and h.operacion = 'entrega_fallida'
551:       ) then raise exception 'ENTREGA_FALLIDA_REQUIERE_OPERACION'; end if;
557: alter function operativo_privado.proteger_entrega_fallida() owner to postgres;
560: -- Reprograma únicamente fallidas incluidas en una carga cerrada. Conserva
561: -- preparación, precios, saldos y cierre original; la nueva carga debe decidir
562: -- su inclusión explícitamente. No acepta un patch genérico del pedido.
563: create function public.reprogramar_no_entregado_administrativo(
564:  p_pedido_id uuid,p_version_esperada bigint,p_clave uuid,p_fecha date,p_motivo text
566: declare p public.pedidos%rowtype; cp operativo_privado.carga_pedidos%rowtype;
567:  c operativo_privado.cargas%rowtype; destino operativo_privado.cargas%rowtype;
569:  intento jsonb; fallo operativo_privado.historial_operativo%rowtype;
571:  if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
572:  if current_setting('transaction_isolation')<>'read committed' then raise exception 'AISLAMIENTO_NO_COMPATIBLE'; end if;
573:  if p_fecha is null or not isfinite(p_fecha) or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'OPERACION_INVALIDA'; end if;
575:  lock table public.pedidos in exclusive mode;
577:  inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'reprogramar_no_entregado',solicitud);
579:  select * into p from public.pedidos where id=p_pedido_id;
580:  select * into cp from operativo_privado.carga_pedidos where pedido_id=p.id;
581:  if not found or not cp.incluido then raise exception 'PEDIDO_NO_REPROGRAMABLE'; end if;
582:  if p_fecha<=cp.fecha or p_fecha<(clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'FECHA_REPROGRAMACION_INVALIDA'; end if;
583:  -- Locks advisory en orden de fecha, antes de las filas de carga.
584:  perform pg_advisory_xact_lock(hashtextextended('carga:'||d::text,0))
586:  -- Igual que operar_carga_jornada: materializar destino tras los advisory.
589:  insert into operativo_privado.cargas(fecha) values(p_fecha) on conflict do nothing;
590:  perform 1 from operativo_privado.cargas
592:  select * into c from operativo_privado.cargas where fecha=cp.fecha;
595:  or exists(select 1 from operativo_privado.entregas_definitivas where pedido_id=p.id)
596:  or p.preparacion_finalizada_en is null then raise exception 'PEDIDO_NO_REPROGRAMABLE'; end if;
597:  select * into destino from operativo_privado.cargas where fecha=p_fecha;
598:  if destino.estado is distinct from 'preparacion' then raise exception 'CARGA_NO_EDITABLE'; end if;
603:  where x->'pedido'->>'id'=p.id::text;
604:  select * into fallo from operativo_privado.historial_operativo
605:  where pedido_id=p.id and operacion='entrega_fallida' order by version desc limit 1;
606:  if intento is null or fallo.pedido_id is null
607:  or intento->'pedido' is distinct from to_jsonb(p)
615:  or not exists(select 1 from operativo_privado.historial_cargas h
618:  raise exception 'TRAZABILIDAD_INTENTO_INVALIDA'; end if;
619:  if exists(select 1 from operativo_privado.historial_cargas where fecha=p_fecha and clave=p_clave) then
620:  raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
625:  update public.pedidos set fecha_entrega=p_fecha,estado='listo_despacho' where id=p.id;
626:  update operativo_privado.carga_pedidos set fecha=p_fecha,incluido=false,
627:  motivo=seleccion->>'motivo' where pedido_id=p.id;
628:  delete from operativo_privado.permiso_reprogramacion where pedido_id=p.id;
629:  -- La PK de carga_pedidos es por pedido: trasladar libera la asignación vieja.
630:  -- Su evidencia histórica permanece en resumen_cierre e historial_operativo.
633:  jsonb_build_object('pedido',to_jsonb(p),'seleccion',to_jsonb(cp),'cierre',c.resumen_cierre,
635:  jsonb_build_object('pedido',(select to_jsonb(pe) from public.pedidos pe where id=p.id),'seleccion',seleccion),
636:  jsonb_build_object('pedido_id',p.id,'fecha',p_fecha,'estado','listo_despacho','incluido',false));
637:  update operativo_privado.cargas set version=version+1 where fecha=p_fecha;
638:  insert into operativo_privado.historial_cargas(fecha,version,clave,actor,solicitud,anterior,resultado)
640:  solicitud||jsonb_build_object('accion','recibir_reprogramado','pedido_id',p.id),to_jsonb(destino),
641:  jsonb_build_object('pedido_id',p.id,'version',destino.version+1,'origen',cp.fecha,
645:  if p_fecha<(clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'FECHA_REPROGRAMACION_INVALIDA'; end if;
648: alter function public.reprogramar_no_entregado_administrativo(uuid,bigint,uuid,date,text) owner to postgres;
652: alter function operativo_privado.snapshot_cierre(date) owner to postgres;
653: alter function operativo_privado.proteger_cierre_carga() owner to postgres;
654: alter function operativo_privado.proteger_pedido_ruta_cerrada() owner to postgres;
655: alter function operativo_privado.proteger_orden_ruta_cerrada() owner to postgres;
656: revoke all on function operativo_privado.snapshot_cierre(date),operativo_privado.proteger_cierre_carga(),
657:  operativo_privado.proteger_pedido_ruta_cerrada(),operativo_privado.proteger_orden_ruta_cerrada() from public,anon,authenticated,service_role;
658: alter function public.leer_carga_jornada(date) owner to postgres;
659: revoke all on function public.leer_carga_jornada(date) from public,anon,authenticated,service_role;
660: grant execute on function public.leer_carga_jornada(date) to authenticated;
661: alter function public.revisar_cierre_ruta(date) owner to postgres;
662: alter function public.cerrar_ruta(date,bigint,uuid,text) owner to postgres;
663: alter function public.orden_ruta_dia(date,uuid[],bigint) owner to postgres;
664: revoke all on function public.revisar_cierre_ruta(date),public.cerrar_ruta(date,bigint,uuid,text),
665:  public.orden_ruta_dia(date,uuid[],bigint) from public,anon,authenticated,service_role;
666: grant execute on function public.revisar_cierre_ruta(date),public.cerrar_ruta(date,bigint,uuid,text),
667:  public.orden_ruta_dia(date,uuid[],bigint) to authenticated;
669: create function operativo_privado.impedir_truncado_fase2() returns trigger
671: begin raise exception 'TRUNCADO_NO_PERMITIDO_FASE2'; end; $$;
672: alter function operativo_privado.impedir_truncado_fase2() owner to postgres;
675:  foreach tabla in array array['public.pedidos','public.items_pedido',
676:  'public.preparacion_items_pedido','public.rutas','public.paradas_ruta',
677:  'operativo_privado.cargas','operativo_privado.carga_pedidos'] loop
678:  execute format('create trigger fase2_no_truncable before truncate on %s for each statement execute function operativo_privado.impedir_truncado_fase2()',tabla);

## supabase/manual/verificar_compatibilidad_rutas_fase3.sql

7:  if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then raise exception 'REQUIERE_POSTGRES_BYPASSRLS'; end if;
8:  if to_regclass('operativo_privado.rutas_multi') is null then raise exception 'REQUIERE_FASE_2'; end if;
9:  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.operar_ruta_multiple(jsonb)') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='3e7bedaabab7ed3dd7058cafa3fb1f21') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.operar_ruta_multiple'; end if;
10:  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_rutas_multiples(date)') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='5438a8139ed3f3845e618380ce2b6794') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_rutas_multiples'; end if;
11:  if not exists(select 1 from pg_proc where oid=to_regprocedure('public.leer_mi_reparto()') and proowner='postgres'::regrole and md5(replace(prosrc, chr(13)||chr(10), chr(10)))='bbeb502fd8085565c72e0f71f6f5b588') then raise exception 'CONTRATO_FASE_2_INCOMPATIBLE: public.leer_mi_reparto'; end if;
13:  -- Contratos declarados en rutas_multiples_fase2.sql; no se reparan permisos.
14:  foreach firma in array array['public.operar_ruta_multiple(jsonb)',
15:  'public.leer_rutas_multiples(date)', 'public.leer_mi_reparto()'] loop
25:    when 'public.operar_ruta_multiple(jsonb)' then array['p_solicitud']::text[]
26:    when 'public.leer_rutas_multiples(date)' then array['p_fecha']::text[]
29:  and p.provolatile::text=case when firma='public.operar_ruta_multiple(jsonb)' then 'v' else 's' end
32:  ) then raise exception 'ATRIBUTOS_FASE_2_INCOMPATIBLES: %',firma; end if;
44:  raise exception 'PERMISOS_FASE_2_INCOMPATIBLES: %',firma;
52:  if not exists(select 1 from pg_proc where oid=to_regprocedure(firma) and proowner='postgres'::regrole) then raise exception 'DEPENDENCIA_INCOMPATIBLE: %',firma; end if;
55:  if has_schema_privilege(rol,'operativo_privado','USAGE') or has_schema_privilege(rol,'operativo_privado','CREATE') or has_schema_privilege(rol,'public','CREATE') then raise exception 'ESQUEMA_NO_AISLADO: %',rol; end if;

## supabase/manual/verificar_contrato_confirmar_entrega.sql

8: create or replace function public.verificar_contrato_confirmar_entrega()
13:  pedidos oid;
16:  pagos oid;
19:    raise exception 'NO_AUTORIZADO';
29:      and proargnames=array['p_pedido_id','p_version_esperada','p_clave','p_items','p_cobro']::text[]
36:  select c.oid into pedidos from pg_class c join pg_namespace n on n.oid=c.relnamespace
37:    where n.nspname='public' and c.relname='pedidos' and c.relkind in ('r','p');
42:  select c.oid into pagos from pg_class c join pg_namespace n on n.oid=c.relnamespace
43:    where n.nspname='operativo_privado' and c.relname='pagos_entrega' and c.relkind in ('r','p');
44:  if pedidos is null or entregas is null or cobros is null or pagos is null then return false; end if;
45:  if not exists(select 1 from pg_constraint where conrelid=pedidos
46:    and conname='pedidos_venta_definitiva_pareada' and convalidated) then return false; end if;
47:  if not exists(select 1 from pg_trigger where tgrelid=pedidos

