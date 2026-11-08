-- Integración contable de entrega real. Sólo SQL LOCAL; ejecución manual posterior.
-- Orden: después de 20261108130000_confirmar_entrega_real_todo_correcto.sql.
-- RPC contrato 2: p_cobro={"metodo":"efectivo|transferencia|ambos|por_pagar",
-- "efectivo":0,"transferencia":0,"confirmar_por_pagar":false}.
-- Los dos montos son obligatorios, enteros CLP; por_pagar exige true y ceros.
-- No migra datos históricos ni genera ajustes/cargos adicionales.
begin;

create table operativo_privado.cobros_entrega (
 pedido_id uuid primary key references operativo_privado.entregas_definitivas(pedido_id) on delete restrict,
 solicitud jsonb not null,
 recibido bigint not null check(recibido between 0 and 9007199254740991),
 actor uuid not null,
 fecha timestamptz not null default clock_timestamp()
);
create table operativo_privado.pagos_entrega (
 pedido_id uuid not null references operativo_privado.entregas_definitivas(pedido_id) on delete restrict,
 metodo text not null check(metodo in ('efectivo','transferencia')),
 pago_id uuid not null unique references public.pagos(id) on delete restrict,
 monto bigint not null check(monto>0),
 monto_aplicado bigint not null check(monto_aplicado>=0 and monto_aplicado<=monto),
 primary key(pedido_id,metodo)
);
alter table operativo_privado.cobros_entrega owner to postgres;
alter table operativo_privado.pagos_entrega owner to postgres;
alter table operativo_privado.cobros_entrega enable row level security;
alter table operativo_privado.cobros_entrega force row level security;
alter table operativo_privado.pagos_entrega enable row level security;
alter table operativo_privado.pagos_entrega force row level security;
revoke all on operativo_privado.cobros_entrega,operativo_privado.pagos_entrega from public,anon,authenticated,service_role;
create trigger cobros_entrega_inmutables before update or delete on operativo_privado.cobros_entrega
 for each row execute function operativo_privado.impedir_mutacion_historial();
create trigger pagos_entrega_inmutables before update or delete on operativo_privado.pagos_entrega
 for each row execute function operativo_privado.impedir_mutacion_historial();
create trigger cobros_entrega_no_truncables before truncate on operativo_privado.cobros_entrega
 for each statement execute function operativo_privado.impedir_mutacion_historial();
create trigger pagos_entrega_no_truncables before truncate on operativo_privado.pagos_entrega
 for each statement execute function operativo_privado.impedir_mutacion_historial();

-- No deja disponible la firma anterior que confirmaba sin contrato de cobro.
drop function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb);

create or replace view public.v_saldos_pedidos
with (security_invoker = true)
as
select
  p.id as pedido_id,
  p.cliente_id,
  (case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else (p.venta_definitiva_snapshot->>'total')::bigint end) as total_pedido,
  coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0)::bigint as total_pagado,
  ((case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else (p.venta_definitiva_snapshot->>'total')::bigint end) - coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0))::bigint as saldo_pendiente,
  case
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) = 0 then 'sin_pago'
    when coalesce(sum(a.monto_aplicado) filter (where pa.estado = 'confirmado' and a.activa), 0) < (case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else (p.venta_definitiva_snapshot->>'total')::bigint end) then 'parcial'
    else 'pagado'
  end as estado_pago
from public.pedidos p
left join public.aplicaciones_pago a on a.pedido_id = p.id
left join public.pagos pa on pa.id = a.pago_id
where p.estado <> 'cancelado' and (p.regimen_contable='legado' or p.venta_reconocida_en is not null)
group by p.id, p.cliente_id, p.total, p.total_final;

create or replace view public.v_movimientos_cuenta_cliente
with (security_invoker = true)
as
with movimientos_base as (
  select p.cliente_id, case when p.regimen_contable='legado' then p.fecha_creacion else p.venta_reconocida_en end as fecha, 'pedido'::text as tipo_movimiento, p.id as referencia_id,
    p.numero_pedido as referencia, ('Pedido ' || p.numero_pedido) as concepto,
    (case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else (p.venta_definitiva_snapshot->>'total')::bigint end) as cargo, 0::bigint as abono,
    (case when p.regimen_contable = 'legado' then coalesce(p.total_final, p.total) else (p.venta_definitiva_snapshot->>'total')::bigint end) as movimiento_neto, p.fecha_creacion, 1 as prioridad_orden
  from public.pedidos p where p.cliente_id is not null and p.estado <> 'cancelado' and (p.regimen_contable='legado' or p.venta_reconocida_en is not null)
  union all
  select p.cliente_id, p.fecha_pago, 'pago'::text, p.id,
    coalesce(nullif(btrim(p.referencia), ''), 'Pago ' || left(p.id::text, 8)), ('Pago ' || p.metodo_pago::text),
    0::bigint, p.monto, -p.monto, p.fecha_creacion, 2
  from public.pagos p where p.estado = 'confirmado'
  union all
  select a.cliente_id, a.fecha_ajuste, 'ajuste'::text, a.id, 'Ajuste ' || left(a.id::text, 8), a.motivo,
    case when a.tipo = 'cargo' then a.monto else 0::bigint end,
    case when a.tipo = 'abono' then a.monto else 0::bigint end,
    case when a.tipo = 'cargo' then a.monto else -a.monto end, a.fecha_creacion, 3
  from public.ajustes_cuenta_cliente a
)
select cliente_id, fecha, tipo_movimiento, referencia_id, referencia, concepto, cargo, abono, movimiento_neto,
  sum(movimiento_neto) over (partition by cliente_id order by fecha, prioridad_orden, fecha_creacion, referencia_id rows between unbounded preceding and current row)::bigint as saldo_acumulado
from movimientos_base;

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
    total_exigible := (pedido_actual.venta_definitiva_snapshot->>'total')::bigint;
  else
    total_exigible := coalesce(pedido_actual.total_final, pedido_actual.total);
  end if;
  if aplicado_pedido + new.monto_aplicado > total_exigible then raise exception 'La aplicación supera el saldo pendiente del pedido'; end if;
  return new;
end;
$$;

create function public.confirmar_entrega_todo_correcto(
 p_pedido_id uuid, p_version_esperada bigint, p_clave uuid, p_items jsonb, p_cobro jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 p public.pedidos%rowtype; inicio jsonb; solicitud jsonb; lineas jsonb;
 metodo text; efectivo numeric; transferencia numeric; recibido bigint;
 cliente uuid; restante bigint; aplicado_previo bigint; importe bigint; aplicado bigint;
 pago uuid; fila record; pagos jsonb := '[]'::jsonb;
 subtotal numeric; total numeric; instante timestamptz; snapshot jsonb; resultado jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 -- Orden de la lista forma parte del contrato de reintento, como el resto del payload.
 -- Cliente antes de pedido: mismo orden que el cobro administrativo FIFO.
 select cliente_id into cliente from public.pedidos where id=p_pedido_id;
 perform 1 from public.clientes where id=cliente for update;
 solicitud:=jsonb_build_object('items',p_items,'cobro',p_cobro,'contrato',2);
 inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'entrega_todo_correcto',solicitud);
 if (inicio->>'reintento')::boolean then return inicio; end if;
 select * into p from public.pedidos where id=p_pedido_id for update;
 if p.cliente_id is distinct from cliente or cliente is null then raise exception 'CLIENTE_INVALIDO'; end if;
 if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
 if p.estado<>'en_reparto' or p.venta_definitiva_snapshot is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
 -- No aceptar un método sin sus importes enteros CLP efectivamente recibidos.
 if jsonb_typeof(p_cobro) is distinct from 'object' then raise exception 'COBRO_EXPLICITO_REQUERIDO'; end if;
 if not (p_cobro ?& array['metodo','efectivo','transferencia','confirmar_por_pagar'])
 or (p_cobro-array['metodo','efectivo','transferencia','confirmar_por_pagar'])<>'{}'::jsonb
 or jsonb_typeof(p_cobro->'metodo') is distinct from 'string'
 or jsonb_typeof(p_cobro->'efectivo') is distinct from 'number'
 or jsonb_typeof(p_cobro->'transferencia') is distinct from 'number'
 or jsonb_typeof(p_cobro->'confirmar_por_pagar') is distinct from 'boolean'
 then raise exception 'COBRO_INVALIDO'; end if;
 metodo:=p_cobro->>'metodo';
 efectivo:=(p_cobro->>'efectivo')::numeric;
 transferencia:=(p_cobro->>'transferencia')::numeric;
 if not (efectivo between 0 and 9007199254740991 and efectivo=trunc(efectivo)
 and transferencia between 0 and 9007199254740991 and transferencia=trunc(transferencia)
 and efectivo+transferencia<=9007199254740991) then raise exception 'IMPORTES_RECIBIDOS_INVALIDOS'; end if;
 if not ((metodo='efectivo' and efectivo>0 and transferencia=0)
 or (metodo='transferencia' and transferencia>0 and efectivo=0)
 or (metodo='ambos' and efectivo>0 and transferencia>0)
 or (metodo='por_pagar' and efectivo=0 and transferencia=0 and (p_cobro->>'confirmar_por_pagar')::boolean))
 or (metodo<>'por_pagar' and (p_cobro->>'confirmar_por_pagar')::boolean)
 then raise exception 'METODO_E_IMPORTES_INCOMPATIBLES'; end if;
 recibido:=(efectivo+transferencia)::bigint;
 if p.preparacion_finalizada_en is null then raise exception 'PREPARACION_NO_FINALIZADA'; end if;
 perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
 perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
 if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'ENTREGA_EXPLICITA_REQUERIDA'; end if;
 if jsonb_array_length(p_items)=0 or exists(select 1 from jsonb_array_elements(p_items) x
   where jsonb_typeof(x)<>'object' or x->>'item_pedido_id' is null
   or jsonb_typeof(x->'cantidad_entregada') is distinct from 'number') then raise exception 'ITEMS_ENTREGA_INVALIDOS'; end if;
 if (select count(distinct (x->>'item_pedido_id')::uuid) from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items)
 or (select count(*) from public.items_pedido where pedido_id=p.id)<>jsonb_array_length(p_items)
 or exists(select 1 from jsonb_array_elements(p_items) x
   left join public.items_pedido i on i.id=(x->>'item_pedido_id')::uuid and i.pedido_id=p.id
   left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id and pi.pedido_id=p.id
   where i.id is null or not coalesce(pi.confirmado_explicito,false)
    or pi.importe_linea_operativo is null or pi.cantidad_preparada is null
    or (x->>'cantidad_entregada')::numeric is distinct from pi.cantidad_preparada
    or (x->>'cantidad_entregada')::numeric<0
    or (x->>'cantidad_entregada')::numeric::text in ('NaN','Infinity','-Infinity')) then
   raise exception 'ENTREGA_NO_COINCIDE_CON_PREPARACION';
 end if;
 select sum(pi.importe_linea_operativo::numeric), jsonb_agg(jsonb_build_object(
   'item_pedido_id',i.id,'producto_id',i.producto_id,'presentacion_producto_id',i.presentacion_producto_id,
   'nombre_producto',i.nombre_producto_snapshot,'nombre_presentacion',i.nombre_presentacion_snapshot,
   'unidad',i.unidad_snapshot,'modo_cantidad',i.modo_cantidad_snapshot,
   'cantidad_pedida',i.cantidad,'cantidad_preparada',pi.cantidad_preparada,
   'cantidad_entregada',(x->>'cantidad_entregada')::numeric,
   'precio_neto_unitario_referencia',i.precio_neto_unitario_snapshot,
   'precio_final_unitario_referencia',i.precio_final_unitario_snapshot,
   -- El importe autorizado de preparación es definitivo sólo desde esta entrega.
   -- No inferir precio unitario efectivo ni impuestos desde cantidades variables.
   'importe_definitivo',pi.importe_linea_operativo) order by i.id)
 into subtotal,lineas from public.items_pedido i
 join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 join jsonb_array_elements(p_items) x on (x->>'item_pedido_id')::uuid=i.id where i.pedido_id=p.id;
 total:=subtotal+p.costo_entrega-p.descuento;
 if total is null or total<0 or total>9007199254740991
   or total is distinct from p.total_operativo_preparacion::numeric then raise exception 'TOTAL_ENTREGA_INVALIDO'; end if;
 instante:=clock_timestamp();
 snapshot:=jsonb_build_object('contrato',1,'regimen','entrega_v1','pedido_id',p.id,
   'cliente_id',p.cliente_id,'moneda','CLP','tipo','todo_correcto','actor_id',auth.uid(),
   'confirmada_en',instante,'clave',p_clave,'version',p_version_esperada+1,'productos',lineas,
   'subtotal',subtotal::bigint,'costo_entrega',p.costo_entrega,'descuento',p.descuento,'total',total::bigint);
 insert into operativo_privado.entregas_definitivas(pedido_id,clave,actor,instante,version,snapshot)
 values(p.id,p_clave,auth.uid(),instante,p_version_esperada+1,snapshot);
 update public.pedidos set estado='entregado',venta_definitiva_snapshot=snapshot,venta_reconocida_en=instante where id=p.id;
 -- Aplicaciones anteriores se conservan; jamás se vuelve a cobrar su importe.
 select coalesce(sum(a.monto_aplicado),0)::bigint into aplicado_previo
 from public.aplicaciones_pago a join public.pagos pa on pa.id=a.pago_id
 where a.pedido_id=p.id and a.activa and pa.estado='confirmado';
 if aplicado_previo>total then raise exception 'APLICACIONES_PREVIAS_SUPERAN_VENTA'; end if;
 restante:=total::bigint-aplicado_previo;
 for fila in select * from (values ('efectivo',efectivo::bigint),('transferencia',transferencia::bigint)) v(metodo,monto) loop
   importe:=fila.monto;
   if importe=0 then continue; end if;
   insert into public.pagos(cliente_id,monto,metodo_pago,estado,registrado_por,fecha_pago,observacion)
   values(p.cliente_id,importe,fila.metodo::public.metodo_pago,'confirmado',auth.uid(),instante,
     'Cobro en entrega '||p.id::text) returning id into pago;
   aplicado:=least(restante,importe);
   if aplicado>0 then
     insert into public.aplicaciones_pago(pago_id,pedido_id,monto_aplicado) values(pago,p.id,aplicado);
   end if;
   restante:=restante-aplicado;
   insert into operativo_privado.pagos_entrega(pedido_id,metodo,pago_id,monto,monto_aplicado)
   values(p.id,fila.metodo,pago,importe,aplicado);
   pagos:=pagos||jsonb_build_array(jsonb_build_object('pago_id',pago,'metodo',fila.metodo,
     'recibido',importe,'aplicado',aplicado,'disponible',importe-aplicado));
 end loop;
 insert into operativo_privado.cobros_entrega(pedido_id,solicitud,recibido,actor)
 values(p.id,p_cobro,recibido,auth.uid());
 resultado:=jsonb_build_object('pedido_id',p.id,'estado','entregado','venta_definitiva',snapshot,
   'pagos',pagos,'recibido',recibido,'deuda_pendiente',restante,
   'saldo_a_favor_generado',greatest(recibido-(total::bigint-aplicado_previo),0),
   'pagos_registrados',recibido>0,'deuda_registrada',true);
 return operativo_privado.completar_operacion(p.id,p_version_esperada,p_clave,'entrega_todo_correcto',solicitud,null,
   'Entrega real confirmada: todo correcto',jsonb_build_object('estado',p.estado),
   jsonb_build_object('estado','entregado','venta_definitiva',snapshot,'cobro',p_cobro,'pagos',pagos),resultado);
end; $$;


alter function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb) owner to postgres;
revoke all on function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb,jsonb) to authenticated;
alter function public.validar_aplicacion_pago() owner to postgres;
revoke all on function public.validar_aplicacion_pago() from public,anon,authenticated,service_role;

-- Conserva el disparador histórico y valida adicionalmente reactivaciones nuevas.
drop trigger validar_aplicacion_pago_antes_de_guardar on public.aplicaciones_pago;
create trigger validar_aplicacion_pago_antes_de_guardar
 before insert or update of pago_id,pedido_id,monto_aplicado on public.aplicaciones_pago
 for each row execute function public.validar_aplicacion_pago();

create function operativo_privado.validar_reactivacion_entrega()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if exists(select 1 from public.pedidos where id=new.pedido_id and regimen_contable='entrega_v1') then
   -- Reutiliza el validador BEFORE de importes mediante UPDATE de la misma fila.
   -- AFTER se ejecuta una vez; este UPDATE no cambia activa ni vuelve a entrar.
   update public.aplicaciones_pago set monto_aplicado=monto_aplicado where id=new.id;
 end if;
 return null;
end; $$;
alter function operativo_privado.validar_reactivacion_entrega() owner to postgres;
revoke all on function operativo_privado.validar_reactivacion_entrega() from public,anon,authenticated,service_role;
create trigger validar_reactivacion_entrega after update of activa on public.aplicaciones_pago
 for each row when (new.activa and not old.activa)
 execute function operativo_privado.validar_reactivacion_entrega();

-- Barrera diferida: una nueva entrega nunca puede persistir sin su cobro completo.
-- No revisa ni modifica confirmaciones anteriores a esta migración.
create function operativo_privado.exigir_cobro_entrega()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare c operativo_privado.cobros_entrega%rowtype; suma numeric;
begin
 select * into c from operativo_privado.cobros_entrega where pedido_id=new.pedido_id;
 if not found then raise exception 'ENTREGA_SIN_REGISTRO_CONTABLE'; end if;
 select coalesce(sum(monto),0) into suma from operativo_privado.pagos_entrega where pedido_id=new.pedido_id;
 if suma<>c.recibido then raise exception 'COBRO_ENTREGA_INCONSISTENTE'; end if;
 return null;
end; $$;
alter function operativo_privado.exigir_cobro_entrega() owner to postgres;
revoke all on function operativo_privado.exigir_cobro_entrega() from public,anon,authenticated,service_role;
create constraint trigger entrega_exige_cobro after insert on operativo_privado.entregas_definitivas
 deferrable initially deferred for each row execute function operativo_privado.exigir_cobro_entrega();
comment on table operativo_privado.pagos_entrega is
 'Comprobante inmutable del cobro original, uno por método y entrega. Anulaciones posteriores usan las RPC históricas y sus campos de auditoría.';
comment on table operativo_privado.entregas_definitivas is
 'Venta definitiva única entrega_v1. Desde integración contable, cada nueva entrega exige cobro explícito en la misma transacción; sin segundo cargo ni backfill.';
-- Las vistas dependientes de saldos y cuenta corriente conservan sus firmas/ACL.
-- FIFO administrativo consume la nueva v_saldos_pedidos: sólo ventas reconocidas.
-- Pagos completos generan abono UNA vez; aplicaciones sólo distribuyen el pago.
-- Ajustes y pagos históricos permanecen intactos, incluido crédito no aplicado.
commit;
