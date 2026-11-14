-- BORRADOR MANUAL: NO EJECUTADO. No conectado a la interfaz.
-- Requiere revisión/instalación manual de las dependencias contables locales.
-- Contrato deliberadamente parcial: NO representa todos los cobros de la fecha.
-- cobros_entrega.fecha es evidencia del registro de recepción en la entrega.
-- pagos.fecha_pago sola no acredita una nueva recepción: las correcciones crean
-- pagos de reemplazo con esa fecha. No sumar reemplazos como ingresos nuevos.
-- Para cobertura completa falta una fuente de recepciones administrativas con
-- instante real, origen y vínculo estable de correcciones/reversos. No inferirla.
-- El subtotal devuelve cobros originales de entrega aún confirmados, una vez
-- por pago_id; no restaura cobros anulados ni atribuye reemplazos sin evidencia.
-- No filtrar por fecha_entrega: recibir un pago y entregar un pedido son hechos distintos.
begin;
create or replace function public.leer_cobros_recibidos_jornada_admin(p_fecha date)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD'
as $$
declare resultado jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_fecha is null then raise exception 'SOLICITUD_INVALIDA'; end if;
 with evidencia as (
   select pa.id,pa.cliente_id,pa.metodo_pago,pa.monto,c.fecha
   from operativo_privado.cobros_entrega c
   join operativo_privado.pagos_entrega pe on pe.pedido_id=c.pedido_id
   join public.pagos pa on pa.id=pe.pago_id
   where c.fecha >= (p_fecha::timestamp at time zone 'America/Santiago')
     and c.fecha < ((p_fecha+1)::timestamp at time zone 'America/Santiago')
     and pa.estado='confirmado' and pa.monto=pe.monto
 ), clientes_metodos as (
   select cliente_id,metodo_pago,sum(monto) as monto from evidencia
   group by cliente_id,metodo_pago
 )
 select jsonb_build_object(
   'fecha',p_fecha,'zona_horaria','America/Santiago','cobertura_completa',false,
   'total_recibido',null,
   'subtotal_entregas_originales_confirmadas',(select coalesce(sum(monto),0) from evidencia),
   'por_cliente_metodo',coalesce((select jsonb_agg(to_jsonb(x)) from clientes_metodos x),'[]'::jsonb),
   'advertencia','Subtotal de recepciones originales de entrega aún confirmadas. No cubre recepciones administrativas, pagos anulados ni reemplazos. No equivale a pagos aplicados a pedidos de la jornada.'
 ) into resultado;
 return resultado;
end $$;
alter function public.leer_cobros_recibidos_jornada_admin(date) owner to postgres;
revoke all on function public.leer_cobros_recibidos_jornada_admin(date) from public,anon,service_role;
grant execute on function public.leer_cobros_recibidos_jornada_admin(date) to authenticated;
commit;
