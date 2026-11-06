-- SOLO DESPUÉS de confirmar COMMIT de las cinco migraciones; exclusivamente lectura.
-- Repetir además 01-catalogo y 03-huellas, y exportar resultados completos.
begin transaction isolation level repeatable read read only;
-- Todos los contadores de anomalías deben ser cero, sin actividad de negocio.
select count(*) filter(where regimen_contable<>'legado') as nuevos_no_esperados_sin_trafico,
 count(*) filter(where venta_definitiva_snapshot is not null or venta_reconocida_en is not null) as venta_activa,
 count(*) filter(where importe_operativo_legacy is distinct from coalesce(total_final,total)) as alias_legacy_incorrecto,
 count(*) filter(where importe_operativo is distinct from coalesce(total_operativo_preparacion,total_final,total)) as alias_nuevo_incorrecto,
 count(*) filter(where total_operativo_preparacion is not null) as agregado_no_esperado_sin_trafico
from public.pedidos;
select count(*) filter(where confirmado_explicito) as confirmaciones_no_esperadas_sin_trafico,
 count(*) filter(where importe_linea_operativo is not null) as importes_no_esperados_sin_trafico
from public.preparacion_items_pedido;
select 'versiones_pedido' as objeto,count(*) as filas from operativo_privado.versiones_pedido
union all select 'historial_operativo',count(*) from operativo_privado.historial_operativo
union all select 'cargas',count(*) from operativo_privado.cargas
union all select 'carga_pedidos',count(*) from operativo_privado.carga_pedidos
union all select 'historial_cargas',count(*) from operativo_privado.historial_cargas;
-- Todas presentes; definiciones/retornos deben corresponder a los archivos fuente.
with esperadas(firma) as (values
 ('public.crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date,text[])'),
 ('public.convertir_posible_pedido_administrativo(uuid,bigint,uuid,uuid,date,text[])'),
 ('public.crear_pedido_administrativo(uuid,jsonb)'),
 ('public.marcar_pedido_preparando_administrativo(uuid)'),
 ('public.leer_preparacion_explicita(uuid)'),
 ('public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text)'),
 ('public.cerrar_preparacion_explicita(uuid,bigint,uuid)'),
 ('public.leer_carga_jornada(date)'),
 ('public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)'),
 ('operativo_privado.iniciar_operacion(uuid,bigint,uuid,text,jsonb)'),
 ('operativo_privado.completar_operacion(uuid,bigint,uuid,text,jsonb,uuid,text,jsonb,jsonb,jsonb)'),
 ('operativo_privado.impedir_mutacion_historial()'),
 ('operativo_privado.proteger_pedido_cargado()'),
 ('public.proteger_regimen_contable_pedido()'))
select firma,to_regprocedure(firma) as objeto from esperadas;
-- Ausente: no debe reaparecer checkout de seis argumentos.
select to_regprocedure('public.crear_pedido_desde_carrito(uuid,uuid,jsonb,text,uuid,date)') as checkout_obsoleto_debe_ser_null;
-- Matriz: cuatro retiradas false para los tres roles; cinco nuevas true SOLO
-- authenticated, siempre con autorización admin en el cuerpo.
with firmas(firma,nueva) as (values
 ('public.guardar_preparacion_item_pedido_administrativo(uuid,numeric,text)',false),
 ('public.finalizar_preparacion_pedido_administrativo(uuid)',false),
 ('public.marcar_pedido_listo_despacho_administrativo(uuid)',false),
 ('public.marcar_pedido_en_reparto_administrativo(uuid)',false),
 ('public.leer_preparacion_explicita(uuid)',true),
 ('public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text)',true),
 ('public.cerrar_preparacion_explicita(uuid,bigint,uuid)',true),
 ('public.leer_carga_jornada(date)',true),
 ('public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text)',true))
select r.rolname,f.firma,f.nueva,has_function_privilege(r.oid,to_regprocedure(f.firma),'EXECUTE') as efectivo,
 (f.nueva and r.rolname='authenticated') as esperado
from firmas f cross join pg_roles r where r.rolname in ('anon','authenticated','service_role') order by 2,1;
-- Catálogo de constraints y triggers debe mostrar activos todos los nuevos;
-- cinco tablas privadas con owner postgres, RLS ENABLE/FORCE y sin policies.
select c.relname,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='operativo_privado' and c.relkind='r' order by c.relname;
commit;
