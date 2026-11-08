-- Sólo SQL LOCAL: no ejecutar automáticamente. Sin backfill ni edición de snapshots.
-- Depende de 20261108160000. Lista completa de cantidades; nunca acepta precios,
-- pagos ni importes arbitrarios. Conserva las reglas de entrega con diferencias.
-- La cuenta corriente mantiene el cargo original y suma UNA vez el ajuste.
-- El saldo por pedido usa venta original + diferencias - aplicaciones vigentes.
-- Una reducción bajo lo aplicado produce saldo negativo del pedido: crédito por
-- ajuste, NO dinero disponible adicional de un pago ni una aplicación anulada.
begin;

create table public.correcciones_venta_entregada (
 id uuid primary key default gen_random_uuid(),
 pedido_id uuid not null references public.pedidos(id) on delete restrict,
 cliente_id uuid not null references public.clientes(id) on delete restrict,
 operacion_original uuid not null,
 version_original bigint not null,
 version bigint not null,
 clave uuid not null,
 actor_id uuid not null,
 fecha timestamptz not null default clock_timestamp(),
 motivo text not null check (btrim(motivo)<>'' and length(motivo)<=2000),
 anteriores jsonb not null check(jsonb_typeof(anteriores)='object'),
 nuevos jsonb not null check(jsonb_typeof(nuevos)='object'),
 diferencia bigint not null,
 ajuste_id uuid unique references public.ajustes_cuenta_cliente(id) on delete restrict,
 unique(pedido_id,version), unique(pedido_id,clave),
 check ((diferencia=0 and ajuste_id is null) or (diferencia<>0 and ajuste_id is not null)),
 check (diferencia=(nuevos->>'total')::bigint-(anteriores->>'total')::bigint)
);
alter table public.correcciones_venta_entregada owner to postgres;
alter table public.correcciones_venta_entregada enable row level security;
alter table public.correcciones_venta_entregada force row level security;
revoke all on public.correcciones_venta_entregada from public,anon,authenticated,service_role;
grant select on public.correcciones_venta_entregada to authenticated;
-- Mismo ámbito de lectura que ajustes/cuenta corriente; ningún escritor API.
create policy correcciones_venta_lectura on public.correcciones_venta_entregada
 for select to authenticated using (public.es_admin() or exists (
 select 1 from public.clientes c where c.id=cliente_id and c.usuario_id=auth.uid()));
create trigger correcciones_venta_inmutables before update or delete
 on public.correcciones_venta_entregada for each row
 execute function operativo_privado.impedir_mutacion_historial();
create trigger correcciones_venta_no_truncables before truncate
 on public.correcciones_venta_entregada for each statement
 execute function operativo_privado.impedir_mutacion_historial();

-- El ajuste vinculado también es inmutable, incluso por vías administrativas.
create function operativo_privado.proteger_ajuste_correccion()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if TG_OP='TRUNCATE' then
   if exists(select 1 from public.correcciones_venta_entregada where ajuste_id is not null)
     then raise exception 'AJUSTE_CORRECCION_INMUTABLE'; end if;
 elsif exists(select 1 from public.correcciones_venta_entregada where ajuste_id=old.id) then
   raise exception 'AJUSTE_CORRECCION_INMUTABLE';
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
create trigger proteger_ajuste_correccion before update or delete on public.ajustes_cuenta_cliente
 for each row execute function operativo_privado.proteger_ajuste_correccion();
create trigger proteger_ajuste_correccion_truncate before truncate on public.ajustes_cuenta_cliente
 for each statement execute function operativo_privado.proteger_ajuste_correccion();

create or replace view public.v_saldos_pedidos
with (security_invoker = true)
as
select
  p.id as pedido_id,
  p.cliente_id,
  (case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else ((p.venta_definitiva_snapshot->>'total')::bigint + coalesce((select sum(c.diferencia) from public.correcciones_venta_entregada c where c.pedido_id=p.id),0))::bigint end) as total_pedido,
  coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0)::bigint as total_pagado,
  ((case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else ((p.venta_definitiva_snapshot->>'total')::bigint + coalesce((select sum(c.diferencia) from public.correcciones_venta_entregada c where c.pedido_id=p.id),0))::bigint end) - coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0))::bigint as saldo_pendiente,
  case
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) = 0 then 'sin_pago'
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) < (case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else ((p.venta_definitiva_snapshot->>'total')::bigint + coalesce((select sum(c.diferencia) from public.correcciones_venta_entregada c where c.pedido_id=p.id),0))::bigint end) then 'parcial'
    else 'pagado'
  end as estado_pago
from public.pedidos p
left join public.aplicaciones_pago a on a.pedido_id = p.id
left join public.pagos pa on pa.id = a.pago_id
where p.estado <> 'cancelado' and (p.regimen_contable='legado' or p.venta_reconocida_en is not null)
group by p.id, p.cliente_id, p.total, p.total_final;

create or replace function public.validar_aplicacion_pago()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  pago_actual public.pagos%rowtype;
  pedido_actual public.pedidos%rowtype;
  aplicado_pago bigint;
  aplicado_pedido bigint;
  total_exigible bigint;
begin
  select * into pago_actual from public.pagos where id = new.pago_id for update;
  if not found then raise exception 'Pago inexistente'; end if;
  if pago_actual.estado = 'anulado' then raise exception 'No se puede aplicar un pago anulado'; end if;

  select * into pedido_actual from public.pedidos where id = new.pedido_id for update;
  if not found then raise exception 'Pedido inexistente'; end if;
  if pedido_actual.cliente_id is null or pedido_actual.cliente_id <> pago_actual.cliente_id then raise exception 'El pago y el pedido deben pertenecer al mismo cliente'; end if;
  if pedido_actual.estado = 'cancelado' then raise exception 'No se puede aplicar un pago a un pedido cancelado'; end if;

  select coalesce(sum(a.monto_aplicado), 0) into aplicado_pago
  from public.aplicaciones_pago a
  join public.pagos p on p.id = a.pago_id
  where a.pago_id = new.pago_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
  if aplicado_pago + new.monto_aplicado > pago_actual.monto then raise exception 'La aplicación supera el monto disponible del pago'; end if;

  select coalesce(sum(a.monto_aplicado), 0) into aplicado_pedido
  from public.aplicaciones_pago a
  join public.pagos p on p.id = a.pago_id
  where a.pedido_id = new.pedido_id and a.activa and p.estado <> 'anulado' and a.id is distinct from new.id;
  if pedido_actual.regimen_contable='entrega_v1' then
    if not new.activa then return new; end if;
    if pedido_actual.venta_reconocida_en is null or pedido_actual.estado<>'entregado'
      or pago_actual.estado<>'confirmado' then raise exception 'APLICACION_REQUIERE_VENTA_Y_PAGO_CONFIRMADOS'; end if;
    select ((pedido_actual.venta_definitiva_snapshot->>'total')::bigint + coalesce(sum(c.diferencia),0))::bigint
      into total_exigible from public.correcciones_venta_entregada c where c.pedido_id=pedido_actual.id;
  else
    total_exigible := coalesce(pedido_actual.total_final, pedido_actual.total);
  end if;
  if aplicado_pedido + new.monto_aplicado > total_exigible then raise exception 'La aplicación supera el saldo pendiente del pedido'; end if;
  return new;
end;
$$;


create function public.corregir_venta_entregada_administrativo(
 p_pedido_id uuid, p_version_esperada bigint, p_clave uuid, p_items jsonb, p_motivo text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 p public.pedidos%rowtype; e operativo_privado.entregas_definitivas%rowtype;
 i public.items_pedido%rowtype; pi public.preparacion_items_pedido%rowtype;
 cliente uuid; inicio jsonb; solicitud jsonb; anterior jsonb; nuevo jsonb;
 entrada jsonb; original jsonb; vigente jsonb; cambio boolean := false; lineas jsonb := '[]'::jsonb;
 cantidad numeric; importe numeric; subtotal numeric := 0; total numeric;
 modo text; regla text; diferencia bigint; ajuste uuid; correccion uuid;
 aplicado numeric; resultado jsonb; instante timestamptz := clock_timestamp();
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_motivo is null or btrim(p_motivo)='' or length(p_motivo)>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
 select cliente_id into cliente from public.pedidos where id=p_pedido_id;
 -- Orden compartido con cobro FIFO y confirmación de entrega.
 perform 1 from public.clientes where id=cliente for update;
 solicitud:=jsonb_build_object('items',p_items,'motivo',p_motivo,'contrato',1);
 inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'correccion_venta_entregada',solicitud);
 if (inicio->>'reintento')::boolean then return inicio; end if;
 select * into p from public.pedidos where id=p_pedido_id for update;
 if cliente is null or p.cliente_id is distinct from cliente then raise exception 'CLIENTE_INVALIDO'; end if;
 if p.regimen_contable<>'entrega_v1' or p.estado<>'entregado'
 or p.venta_reconocida_en is null then raise exception 'VENTA_NO_CORREGIBLE'; end if;
 select * into e from operativo_privado.entregas_definitivas where pedido_id=p.id;
 if not found or e.snapshot is distinct from p.venta_definitiva_snapshot
 or e.snapshot->>'tipo' not in ('todo_correcto','hubo_diferencias') then raise exception 'ORIGEN_ENTREGA_INVALIDO'; end if;
 -- Vinculación inequívoca con la operación y venta originales.
 if not exists(select 1 from operativo_privado.historial_operativo h where h.pedido_id=p.id
 and h.clave_idempotencia=e.clave and h.version=e.version
 and h.operacion in ('entrega_todo_correcto','entrega_hubo_diferencias')) then
 raise exception 'OPERACION_ORIGINAL_NO_ENCONTRADA'; end if;
 select c.nuevos into anterior from public.correcciones_venta_entregada c
 where c.pedido_id=p.id order by c.version desc limit 1;
 if not found then anterior:=e.snapshot; end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'ITEMS_INVALIDOS'; end if;
 if jsonb_array_length(p_items)=0 then raise exception 'ITEMS_INVALIDOS'; end if;
 for entrada in select value from jsonb_array_elements(p_items) loop
 if jsonb_typeof(entrada) is distinct from 'object' then raise exception 'ITEMS_INVALIDOS'; end if;
 if not (entrada ?& array['item_pedido_id','cantidad_entregada'])
 or entrada-array['item_pedido_id','cantidad_entregada']<>'{}'::jsonb
 or jsonb_typeof(entrada->'item_pedido_id') is distinct from 'string'
 or jsonb_typeof(entrada->'cantidad_entregada') is distinct from 'number' then raise exception 'ITEMS_INVALIDOS'; end if;
 perform (entrada->>'item_pedido_id')::uuid;
 end loop;
 perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
 perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
 if (select count(distinct (x->>'item_pedido_id')::uuid) from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items)
 or (select count(*) from public.items_pedido where pedido_id=p.id)<>jsonb_array_length(p_items)
 or exists(select 1 from jsonb_array_elements(p_items) x where not exists(
 select 1 from public.items_pedido where pedido_id=p.id and id=(x->>'item_pedido_id')::uuid))
 then raise exception 'ITEMS_NO_CORRESPONDEN'; end if;
 for i in select * from public.items_pedido where pedido_id=p.id order by id loop
 select * into pi from public.preparacion_items_pedido where pedido_id=p.id and item_pedido_id=i.id;
 if not found or not pi.confirmado_explicito or pi.importe_linea_operativo is null
 or pi.cantidad_preparada is null then raise exception 'AUTORIZACION_PREPARACION_AUSENTE'; end if;
 select x into original from jsonb_array_elements(e.snapshot->'productos') x
 where (x->>'item_pedido_id')::uuid=i.id;
 if not found or (original->>'cantidad_pedida')::numeric is distinct from i.cantidad
 or (original->>'cantidad_preparada')::numeric is distinct from pi.cantidad_preparada
 or (original->>'precio_final_unitario_referencia')::numeric is distinct from i.precio_final_unitario_snapshot
 then raise exception 'AUTORIZACION_ORIGINAL_INCONSISTENTE'; end if;
 select (x->>'cantidad_entregada')::numeric into cantidad from jsonb_array_elements(p_items) x
 where (x->>'item_pedido_id')::uuid=i.id;
 if cantidad::text in ('NaN','Infinity','-Infinity') or cantidad<0 or cantidad>=1000000000
 or cantidad<>round(cantidad,3) then raise exception 'CANTIDAD_INVALIDA'; end if;
 modo:=coalesce(i.modo_cantidad_snapshot,case
 when lower(coalesce(i.nombre_presentacion_snapshot,'')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
 when upper(btrim(i.unidad_snapshot))='KG' then 'kg_fraccionable' else 'unidad' end);
 if modo not in ('kg_fraccionable','presentacion_cerrada','unidad') or nullif(btrim(i.unidad_snapshot),'') is null
 or (modo='kg_fraccionable' and upper(btrim(i.unidad_snapshot))<>'KG')
 or (modo<>'kg_fraccionable' and cantidad<>trunc(cantidad)) then raise exception 'FORMATO_CANTIDAD_INVALIDO'; end if;
 -- Mismas prioridades que confirmar_entrega_hubo_diferencias; sin prorrateos.
 if cantidad=0 then importe:=0; regla:='cantidad_cero';
 elsif cantidad=pi.cantidad_preparada then importe:=pi.importe_linea_operativo; regla:='total_preparacion_autorizado';
 elsif cantidad=i.cantidad then importe:=i.total_linea; regla:='total_pedido_autorizado';
 elsif i.total_final_administrativo is not null then raise exception 'TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_ENTREGADA';
 else importe:=round(cantidad*i.precio_final_unitario_snapshot); regla:='precio_unitario_acordado'; end if;
 if importe is null or importe<0 or importe>9007199254740991 or importe<>trunc(importe) then raise exception 'IMPORTE_INVALIDO'; end if;
 select x into vigente from jsonb_array_elements(anterior->'productos') x
 where (x->>'item_pedido_id')::uuid=i.id;
 if not found then raise exception 'CADENA_CORRECCIONES_INVALIDA'; end if;
 cambio:=cambio or cantidad is distinct from (vigente->>'cantidad_entregada')::numeric
 or importe is distinct from (vigente->>'importe_definitivo')::numeric;
 subtotal:=subtotal+importe;
 lineas:=lineas||jsonb_build_array(original||jsonb_build_object('cantidad_entregada',cantidad,
 'importe_definitivo',importe::bigint,'regla_importe',regla));
 end loop;
 total:=subtotal+(e.snapshot->>'costo_entrega')::bigint-(e.snapshot->>'descuento')::bigint;
 if total is null or total<0 or total>9007199254740991 or subtotal>9007199254740991 then raise exception 'TOTAL_INVALIDO'; end if;
 nuevo:=e.snapshot||jsonb_build_object('productos',lineas,'subtotal',subtotal::bigint,'total',total::bigint);
 if not cambio then raise exception 'CORRECCION_SIN_CAMBIOS'; end if;
 diferencia:=total::bigint-(anterior->>'total')::bigint;
 if diferencia<>0 then
 insert into public.ajustes_cuenta_cliente(cliente_id,tipo,monto,motivo,observacion,registrado_por,fecha_ajuste)
 values(cliente,case when diferencia>0 then 'cargo' else 'abono' end,abs(diferencia),p_motivo,
 'Corrección de venta del pedido '||p.id::text||'; operación original '||e.clave::text,auth.uid(),instante)
 returning id into ajuste;
 end if;
 insert into public.correcciones_venta_entregada(pedido_id,cliente_id,operacion_original,version_original,
 version,clave,actor_id,fecha,motivo,anteriores,nuevos,diferencia,ajuste_id)
 values(p.id,cliente,e.clave,e.version,p_version_esperada+1,p_clave,auth.uid(),instante,p_motivo,
 anterior,nuevo,diferencia,ajuste) returning id into correccion;
 -- Sólo lectura: las aplicaciones y pagos originales permanecen íntegros.
 select coalesce(sum(a.monto_aplicado),0) into aplicado from public.aplicaciones_pago a
 join public.pagos pa on pa.id=a.pago_id where a.pedido_id=p.id and a.activa and pa.estado='confirmado';
 resultado:=jsonb_build_object('pedido_id',p.id,'correccion_id',correccion,'ajuste_id',ajuste,
 'operacion_original',e.clave,'total_corregido',total::bigint,'diferencia',diferencia,
 'saldo_pedido',total-aplicado,'deuda_pedido',greatest(total-aplicado,0),
 'credito_por_sobreaplicacion',greatest(aplicado-total,0));
 return operativo_privado.completar_operacion(p.id,p_version_esperada,p_clave,'correccion_venta_entregada',
 solicitud,null,p_motivo,anterior,nuevo,resultado);
end; $$;
alter function public.corregir_venta_entregada_administrativo(uuid,bigint,uuid,jsonb,text) owner to postgres;
revoke all on function public.corregir_venta_entregada_administrativo(uuid,bigint,uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.corregir_venta_entregada_administrativo(uuid,bigint,uuid,jsonb,text) to authenticated;
alter function operativo_privado.proteger_ajuste_correccion() owner to postgres;
revoke all on function operativo_privado.proteger_ajuste_correccion() from public,anon,authenticated,service_role;
alter function public.validar_aplicacion_pago() owner to postgres;
revoke all on function public.validar_aplicacion_pago() from public,anon,authenticated,service_role;
comment on table public.correcciones_venta_entregada is
 'Correcciones compensatorias inmutables entrega_v1. Diferencia en cuenta corriente sólo vía ajuste_id; originales intactos. Crédito por ajuste no reutiliza pagos.';
commit;
