-- MANUAL, NO EJECUTADO. Lectura por lote; no reemplaza RPC compartidas.
-- Requiere el esquema contable hasta 20261108200000, igual que
-- leer_resumen_contable_pedido_admin. Revisar dependencias en destino.
begin;
create or replace function public.leer_resumen_contable_rutas_admin(p_fecha date)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD'
as $$
declare resultado jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_fecha is null then raise exception 'SOLICITUD_INVALIDA'; end if;
 -- Una sentencia: pertenencia a la jornada, importes y aplicaciones comparten snapshot.
 with seleccion as (
 select p.id,p.regimen_contable,p.venta_reconocida_en,p.estado
 from public.pedidos p where p.fecha_entrega=p_fecha and p.estado<>'cancelado'
 ), metodos as (
 select a.pedido_id,pa.metodo_pago as metodo,sum(a.monto_aplicado) as monto
 from public.aplicaciones_pago a join public.pagos pa on pa.id=a.pago_id
 join seleccion p on p.id=a.pedido_id
 where a.activa and pa.estado='confirmado' group by a.pedido_id,pa.metodo_pago
 ), aplicaciones as (
 select pedido_id,jsonb_agg(jsonb_build_object('metodo',metodo,'monto',monto) order by metodo) as detalle
 from metodos group by pedido_id
 )
 select coalesce(jsonb_object_agg(p.id,jsonb_build_object(
 'regimen',p.regimen_contable,
 'venta_reconocida',p.venta_reconocida_en is not null and p.estado<>'cancelado',
 -- Nunca atribuir una venta definitiva a un pedido legado sin reconocimiento.
 'importe_definitivo',case when p.venta_reconocida_en is not null and p.estado<>'cancelado' then s.total_pedido end,
 'total_aplicado',case when p.venta_reconocida_en is not null and p.estado<>'cancelado' then s.total_pagado end,
 'saldo_pedido',case when p.venta_reconocida_en is not null and p.estado<>'cancelado' then s.saldo_pendiente end,
 'aplicaciones',case when p.venta_reconocida_en is not null and p.estado<>'cancelado' then coalesce(a.detalle,'[]'::jsonb) else '[]'::jsonb end
 )),'{}'::jsonb) into resultado
 from seleccion p left join public.v_saldos_pedidos s on s.pedido_id=p.id
 left join aplicaciones a on a.pedido_id=p.id;
 return resultado;
end $$;
alter function public.leer_resumen_contable_rutas_admin(date) owner to postgres;
revoke all on function public.leer_resumen_contable_rutas_admin(date) from public,anon,service_role;
grant execute on function public.leer_resumen_contable_rutas_admin(date) to authenticated;
commit;
