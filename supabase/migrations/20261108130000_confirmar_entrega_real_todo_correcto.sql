-- Microintegración 7/8: infraestructura local de entrega real, sin backfill.
-- Contrato RPC: lista COMPLETA [{item_pedido_id: UUID, cantidad_entregada: number}].
-- Sólo entrega_v1. Legado conserva sus importes y vías de entrega existentes.
-- No aceptar pagos/deuda aquí: una integración posterior deberá usar pedido_id,
-- clave, version y total del snapshot como referencia, con su propia idempotencia.
begin;

create table operativo_privado.entregas_definitivas (
 pedido_id uuid primary key references public.pedidos(id) on delete restrict,
 clave uuid not null,
 actor uuid not null,
 instante timestamptz not null,
 version bigint not null check (version > 0),
 snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object')
);
alter table operativo_privado.entregas_definitivas owner to postgres;
alter table operativo_privado.entregas_definitivas enable row level security;
alter table operativo_privado.entregas_definitivas force row level security;
revoke all on operativo_privado.entregas_definitivas from public,anon,authenticated,service_role;
create trigger entregas_definitivas_inmutables before update or delete on operativo_privado.entregas_definitivas
 for each row execute function operativo_privado.impedir_mutacion_historial();
create trigger entregas_definitivas_no_truncables before truncate on operativo_privado.entregas_definitivas
 for each statement execute function operativo_privado.impedir_mutacion_historial();

alter table public.pedidos drop constraint pedidos_venta_definitiva_inactiva;
alter table public.pedidos add constraint pedidos_venta_definitiva_pareada check (
 (venta_definitiva_snapshot is null and venta_reconocida_en is null) or
 (regimen_contable='entrega_v1' and venta_definitiva_snapshot is not null
 and venta_reconocida_en is not null and estado='entregado'));

-- No GUC/bandera falsificable: sólo una confirmación privada persistida habilita
-- la transición. También protege UPDATE directo y todas las RPC antiguas.
create function operativo_privado.proteger_venta_definitiva()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if TG_OP='UPDATE' then
   if old.venta_definitiva_snapshot is not null and
     (new.venta_definitiva_snapshot is distinct from old.venta_definitiva_snapshot
      or new.venta_reconocida_en is distinct from old.venta_reconocida_en
      or new.estado is distinct from old.estado) then
     raise exception 'VENTA_DEFINITIVA_INMUTABLE';
   end if;
 end if;
 if new.venta_definitiva_snapshot is not null or new.venta_reconocida_en is not null
   or (new.regimen_contable='entrega_v1' and new.estado='entregado'
     and (TG_OP='INSERT' or old.estado is distinct from new.estado)) then
   if not exists(select 1 from operativo_privado.entregas_definitivas e
     where e.pedido_id=new.id and e.snapshot=new.venta_definitiva_snapshot
       and e.instante=new.venta_reconocida_en and new.estado='entregado'
       and new.regimen_contable='entrega_v1') then
     raise exception 'ENTREGA_REQUIERE_SNAPSHOT_DEFINITIVO';
   end if;
 end if;
 return new;
end; $$;
create trigger proteger_venta_definitiva before insert or update on public.pedidos
 for each row execute function operativo_privado.proteger_venta_definitiva();

-- Extensión puntual de la barrera de carga: los únicos campos adicionales
-- permitidos son el snapshot y su instante, validados contra el registro privado.
-- Se mantienen las restricciones de preparación, fecha y salida existentes.
create or replace function operativo_privado.proteger_pedido_cargado()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare e text; omitidas text[];
begin
 select c.estado into e from operativo_privado.cargas c join operativo_privado.carga_pedidos cp on cp.fecha=c.fecha where cp.pedido_id=old.id and cp.incluido;
 select array['estado','fecha_actualizacion']::text[] || coalesce(array_agg(a.attname::text),array[]::text[])
 into omitidas from pg_catalog.pg_attribute a
 where a.attrelid=TG_RELID and a.attnum>0 and not a.attisdropped and a.attgenerated<>'';
 if e='en_ruta' and old.estado='en_reparto' and new.estado='entregado'
 and exists(select 1 from operativo_privado.entregas_definitivas d where d.pedido_id=old.id
   and d.snapshot=new.venta_definitiva_snapshot and d.instante=new.venta_reconocida_en) then
   omitidas:=omitidas || array['venta_definitiva_snapshot','venta_reconocida_en']::text[];
 end if;
 if e in ('lista','en_ruta') and (to_jsonb(new)-omitidas) is distinct from (to_jsonb(old)-omitidas) then raise exception 'CARGA_CONFIRMADA'; end if;
 if e='lista' and new.estado not in ('listo_despacho','en_reparto') then raise exception 'CARGA_CONFIRMADA'; end if;
 if e='en_ruta' and new.estado in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho') then raise exception 'CARGA_YA_SALIO'; end if;
 return new;
end; $$;

create function public.confirmar_entrega_todo_correcto(
 p_pedido_id uuid, p_version_esperada bigint, p_clave uuid, p_items jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 p public.pedidos%rowtype; inicio jsonb; solicitud jsonb; lineas jsonb;
 subtotal numeric; total numeric; instante timestamptz; snapshot jsonb; resultado jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 -- Orden de la lista forma parte del contrato de reintento, como el resto del payload.
 solicitud:=jsonb_build_object('items',p_items,'contrato',1);
 inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'entrega_todo_correcto',solicitud);
 if (inicio->>'reintento')::boolean then return inicio; end if;
 select * into p from public.pedidos where id=p_pedido_id for update;
 if p.regimen_contable<>'entrega_v1' then raise exception 'REGIMEN_CONTABLE_NO_COMPATIBLE'; end if;
 if p.estado<>'en_reparto' or p.venta_definitiva_snapshot is not null then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
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
 resultado:=jsonb_build_object('pedido_id',p.id,'estado','entregado','venta_definitiva',snapshot,
   'pagos_registrados',false,'deuda_registrada',false);
 return operativo_privado.completar_operacion(p.id,p_version_esperada,p_clave,'entrega_todo_correcto',solicitud,null,
   'Entrega real confirmada: todo correcto',jsonb_build_object('estado',p.estado),
   jsonb_build_object('estado','entregado','venta_definitiva',snapshot),resultado);
end; $$;

alter function operativo_privado.proteger_venta_definitiva() owner to postgres;
alter function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb) owner to postgres;
revoke all on function operativo_privado.proteger_venta_definitiva() from public,anon,authenticated,service_role;
revoke all on function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.confirmar_entrega_todo_correcto(uuid,bigint,uuid,jsonb) to authenticated;
comment on column public.pedidos.venta_definitiva_snapshot is
 'Snapshot inmutable de entrega real entrega_v1; importes definitivos CLP. No reconstruir entregas históricas ni usar preparación como venta.';
comment on column public.pedidos.venta_reconocida_en is
 'Instante real de confirmación de entrega; nunca fecha programada ni backfill.';
comment on table operativo_privado.entregas_definitivas is
 'Una venta definitiva por pedido, sin movimientos contables adicionales. Referencia futura para pagos/deuda: pedido_id, clave, version y snapshot.total.';
-- ATENCIÓN microintegración 8/8: v_movimientos_cuenta_cliente, v_saldos_pedidos
-- y sus dependientes siguen consumiendo coalesce(total_final,total) con semántica
-- legacy, incluso antes de entrega. NO sumar este registro como un segundo cargo.
-- La adaptación integral deberá separar legado de entrega_v1 y consumir snapshot
-- e instante reales para este último. Aquí no se tocan vistas, aplicaciones,
-- pagos, ajustes, total_final ni subtotal_final: no afirmar que los saldos actuales
-- ya representan contabilidad al entregar. El reconocimiento definitivo nuevo
-- queda exclusivamente en este snapshot, sin backfill ni nuevas deudas.
commit;
