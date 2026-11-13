-- MANUAL, NO EJECUTADO. Requiere migraciones contables hasta 20261108200000.
-- Sólo lectura; no modifica entregas, pagos, aplicaciones ni asignaciones.
-- Dependencias contrastadas con el SQL local; instalación/definiciones remotas
-- no verificadas. reparto_auditoria es opcional (repartidores_fase5.sql).
begin;
create or replace function public.leer_resumen_contable_pedido_admin(p_pedido_id uuid)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog set timezone='UTC' set datestyle='ISO, YMD'
as $$
declare resultado jsonb; responsable uuid; habilitado boolean := false; nombre text;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if not exists(select 1 from public.pedidos where id=p_pedido_id) then return null; end if;
 -- El actor del snapshot debe coincidir con el registro inmutable original.
 select e.actor into responsable from operativo_privado.entregas_definitivas e
 join public.pedidos p on p.id=e.pedido_id and p.venta_definitiva_snapshot=e.snapshot
 where e.pedido_id=p_pedido_id and e.snapshot->>'actor_id'=e.actor::text;
 -- Identidad: actor real de la entrega, con habilitación auditada a esa fecha.
 -- Una asignación (actual o histórica) por sí sola no identifica al ejecutor.
 -- El rol actual del perfil no invalida esa evidencia histórica.
 -- La ausencia del módulo opcional o de evidencia histórica produce NULL.
 if responsable is not null and to_regclass('operativo_privado.reparto_auditoria') is not null then
 execute $q$select coalesce((select (a.nuevo->>'activo')::boolean
 from operativo_privado.reparto_auditoria a
 join operativo_privado.entregas_definitivas e on e.pedido_id=$1
 where a.accion='rol' and a.nuevo->>'usuario_id'=$2::text and a.instante<=e.instante
 order by a.instante desc,a.id desc limit 1),false)$q$ into habilitado using p_pedido_id,responsable;
 end if;
 if habilitado then
 select nullif(btrim(p.nombre),'') into nombre from public.perfiles p
 where p.usuario_id=responsable;
 end if;
 select jsonb_build_object(
 'regimen',p.regimen_contable,
 'importe_definitivo',case when p.venta_reconocida_en is not null then s.total_pedido end,
 'total_aplicado',s.total_pagado,'saldo_pedido',s.saldo_pendiente,
 'aplicaciones',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select pa.metodo_pago as metodo,sum(a.monto_aplicado) as monto
 from public.aplicaciones_pago a join public.pagos pa on pa.id=a.pago_id
 where a.pedido_id=p.id and a.activa and pa.estado='confirmado' group by pa.metodo_pago) x),'[]'::jsonb),
 'cobros_entrega',case when exists(select 1 from operativo_privado.cobros_entrega c where c.pedido_id=p.id)
 then coalesce((select jsonb_agg(to_jsonb(x)) from (
 select pa.metodo_pago as metodo,sum(pa.monto) as monto
 from operativo_privado.pagos_entrega pe join public.pagos pa on pa.id=pe.pago_id
 where pe.pedido_id=p.id and pa.estado='confirmado' group by pa.metodo_pago) x),'[]'::jsonb) end,
 -- Disponible ACTUAL de estos pagos: la vista descuenta aplicaciones activas
 -- a TODOS los pedidos. No usar el aplicado original de pagos_entrega ni el
 -- saldo del pedido/cuenta del cliente. Pagos anulados no aportan crédito;
 -- reemplazos administrativos sin vínculo de origen no se atribuyen aquí.
 -- NULL: sin registro contable de cobro; 0: registro existente sin disponible.
 'saldo_favor_origen_entrega',case when exists(select 1 from operativo_privado.cobros_entrega c where c.pedido_id=p.id)
 then (select coalesce(sum(saldo.monto_disponible),0) from operativo_privado.pagos_entrega pe
 join public.pagos pa on pa.id=pe.pago_id and pa.estado='confirmado'
 join public.v_saldos_pagos saldo on saldo.pago_id=pe.pago_id where pe.pedido_id=p.id) end,
 'repartidor',case when nombre is not null then jsonb_build_object('id',responsable,'nombre',nombre) end
 ) into resultado from public.pedidos p left join public.v_saldos_pedidos s on s.pedido_id=p.id where p.id=p_pedido_id;
 return resultado;
end $$;
alter function public.leer_resumen_contable_pedido_admin(uuid) owner to postgres;
revoke all on function public.leer_resumen_contable_pedido_admin(uuid) from public,anon,service_role;
grant execute on function public.leer_resumen_contable_pedido_admin(uuid) to authenticated;
commit;
