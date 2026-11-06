-- SOLO LECTURA. Tras confirmar tablas/columnas con 01, ejecutar ANTES y DESPUÉS
-- sin tráfico de escritura entre capturas. Conservar exportaciones fuera de BD.
-- Para el pequeño dataset ficticio: huella de todas las filas/columnas originales.
-- No es prueba de concurrencia, RPC o seguridad por sí sola.
begin transaction isolation level repeatable read read only;
select 'pedidos' as objeto,count(*) as filas,
 md5(coalesce(string_agg(md5((to_jsonb(t)-array['regimen_contable','importe_operativo','importe_operativo_legacy','venta_definitiva_snapshot','venta_reconocida_en','total_operativo_preparacion'])::text),'' order by t.id),'')) as huella
from public.pedidos t
union all
select 'preparacion_items_pedido',count(*),
 md5(coalesce(string_agg(md5((to_jsonb(t)-array['confirmado_explicito','importe_linea_operativo'])::text),'' order by t.id),''))
from public.preparacion_items_pedido t
union all
select 'items_pedido',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.items_pedido t
union all
select 'pagos',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.pagos t
union all
select 'aplicaciones_pago',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.aplicaciones_pago t
union all
select 'historial_estados_pedido',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.historial_estados_pedido t;
-- Genera SELECT de huellas para TODAS las vistas financieras existentes.
-- Revisar/copiar/ejecutar cada SELECT devuelto antes y después; no usa EXECUTE.
select format('select %L as objeto,count(*) as filas,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' order by to_jsonb(t)::text),'''')) as huella from %I.%I t;',
 n.nspname||'.'||c.relname,n.nspname,c.relname) as consulta_lectura
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v' and (c.relname like 'v_saldos_%' or c.relname like 'v_movimientos_cuenta%');
select estado,fecha_entrega,count(*) from public.pedidos group by estado,fecha_entrega order by fecha_entrega,estado;
commit;
