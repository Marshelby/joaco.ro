-- Backend SQL LOCAL. No ejecutar ni habilitar la opción en /admin/rutas.
-- Depende de 20261108130000 y 20261108140000. Sin backfill ni cambios al legado.
-- RPC: lista COMPLETA [{item_pedido_id: UUID, cantidad_entregada: number}].
-- Cobro contrato 2 idéntico a todo_correcto. Cantidades hasta 3 decimales; CLP enteros.
-- No acepta totales ni ajustes nuevos; reutiliza autorizaciones persistidas.
-- Cliente -> pedido -> items/preparación: mismo orden de locks que contrato 2.
-- Snapshot, venta, pagos, excedentes, versión e historial en una transacción.
begin;

create function public.confirmar_entrega_hubo_diferencias(
 p_pedido_id uuid, p_version_esperada bigint, p_clave uuid, p_items jsonb, p_cobro jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 i public.items_pedido%rowtype; pi public.preparacion_items_pedido%rowtype;
 entrada jsonb; cantidad numeric; modo text; definitivo numeric; regla text;
 diferencias boolean := false;
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
 inicio:=operativo_privado.iniciar_operacion(p_pedido_id,p_version_esperada,p_clave,'entrega_hubo_diferencias',solicitud);
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
 -- Lista completa y cerrada: no acepta precios, totales ni unidades del cliente.
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'ENTREGA_EXPLICITA_REQUERIDA'; end if;
 if jsonb_array_length(p_items)=0 then raise exception 'ITEMS_ENTREGA_INVALIDOS'; end if;
 for entrada in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(entrada) is distinct from 'object' then raise exception 'ITEMS_ENTREGA_INVALIDOS'; end if;
   if not (entrada ?& array['item_pedido_id','cantidad_entregada'])
     or (entrada-array['item_pedido_id','cantidad_entregada'])<>'{}'::jsonb
     or jsonb_typeof(entrada->'item_pedido_id') is distinct from 'string'
     or jsonb_typeof(entrada->'cantidad_entregada') is distinct from 'number' then
     raise exception 'ITEMS_ENTREGA_INVALIDOS';
   end if;
   perform (entrada->>'item_pedido_id')::uuid;
 end loop;
 if (select count(distinct (value->>'item_pedido_id')::uuid) from jsonb_array_elements(p_items))<>jsonb_array_length(p_items)
   or (select count(*) from public.items_pedido where pedido_id=p.id)<>jsonb_array_length(p_items)
   or exists(select 1 from jsonb_array_elements(p_items) x
     where not exists(select 1 from public.items_pedido i
       where i.pedido_id=p.id and i.id=(x->>'item_pedido_id')::uuid)) then
   raise exception 'ITEMS_ENTREGA_NO_CORRESPONDEN';
 end if;
 subtotal:=0; lineas:='[]'::jsonb;
 for i in select * from public.items_pedido where pedido_id=p.id order by id loop
   select * into pi from public.preparacion_items_pedido
     where item_pedido_id=i.id and pedido_id=p.id;
   if not found or not pi.confirmado_explicito or pi.cantidad_preparada is null
     or pi.importe_linea_operativo is null then raise exception 'PREPARACION_NO_CONFIRMADA'; end if;
   select (value->>'cantidad_entregada')::numeric into cantidad
     from jsonb_array_elements(p_items) where (value->>'item_pedido_id')::uuid=i.id;
   if cantidad::text in ('NaN','Infinity','-Infinity') or cantidad<0
     or cantidad>=1000000000 or cantidad<>round(cantidad,3) then
     raise exception 'CANTIDAD_ENTREGADA_INVALIDA';
   end if;
   modo:=coalesce(i.modo_cantidad_snapshot,case
     when lower(coalesce(i.nombre_presentacion_snapshot,'')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
     when upper(btrim(i.unidad_snapshot))='KG' then 'kg_fraccionable' else 'unidad' end);
   if modo not in ('kg_fraccionable','presentacion_cerrada','unidad')
     or nullif(btrim(i.unidad_snapshot),'') is null
     or (modo='kg_fraccionable' and upper(btrim(i.unidad_snapshot))<>'KG') then
     raise exception 'FORMATO_UNIDAD_ENTREGA_INVALIDO';
   end if;
   if modo<>'kg_fraccionable' and cantidad<>trunc(cantidad) then
     raise exception 'CANTIDAD_ENTREGADA_DEBE_SER_ENTERA';
   end if;
   diferencias:=diferencias or cantidad<>pi.cantidad_preparada;
   -- Totales autorizados son puntos exactos, NO precios unitarios derivados.
   -- Cero no cobra producto. No prorratear ajustes administrativos/preparación.
   if cantidad=0 then
     definitivo:=0; regla:='cantidad_cero';
   elsif cantidad=pi.cantidad_preparada then
     definitivo:=pi.importe_linea_operativo; regla:='total_preparacion_autorizado';
   elsif cantidad=i.cantidad then
     definitivo:=i.total_linea; regla:='total_pedido_autorizado';
   elsif i.total_final_administrativo is not null then
     raise exception 'TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_ENTREGADA';
   else
     definitivo:=round(cantidad*i.precio_final_unitario_snapshot);
     regla:='precio_unitario_acordado';
   end if;
   if definitivo is null or definitivo<0 or definitivo>9007199254740991
     or definitivo<>trunc(definitivo) then raise exception 'IMPORTE_ENTREGA_INVALIDO'; end if;
   subtotal:=subtotal+definitivo;
   lineas:=lineas||jsonb_build_array(jsonb_build_object(
     'item_pedido_id',i.id,'producto_id',i.producto_id,'presentacion_producto_id',i.presentacion_producto_id,
     'nombre_producto',i.nombre_producto_snapshot,'nombre_presentacion',i.nombre_presentacion_snapshot,
     'unidad',i.unidad_snapshot,'modo_cantidad',modo,
     'cantidad_pedida',i.cantidad,'cantidad_preparada',pi.cantidad_preparada,
     'cantidad_entregada',cantidad,'importe_original',i.total_linea,
     'importe_preparado',pi.importe_linea_operativo,
     'total_final_administrativo',i.total_final_administrativo,
     'precio_neto_unitario_referencia',i.precio_neto_unitario_snapshot,
     'precio_final_unitario_referencia',i.precio_final_unitario_snapshot,
     'regla_importe',regla,'importe_definitivo',definitivo::bigint));
 end loop;
 if not diferencias then raise exception 'ENTREGA_SIN_DIFERENCIAS'; end if;
 -- Conserva despacho y descuento acordados, sin recalcular reglas del carrito.
 total:=subtotal+p.costo_entrega-p.descuento;
 if total is null or total<0 or total>9007199254740991
   or subtotal>9007199254740991 then raise exception 'TOTAL_ENTREGA_INVALIDO'; end if;
 instante:=clock_timestamp();
 snapshot:=jsonb_build_object('contrato',1,'regimen','entrega_v1','pedido_id',p.id,
   'cliente_id',p.cliente_id,'moneda','CLP','tipo','hubo_diferencias','actor_id',auth.uid(),
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
   'pagos_registrados',recibido>0,'deuda_registrada',true,'aplicado_previo',aplicado_previo);
 return operativo_privado.completar_operacion(p.id,p_version_esperada,p_clave,'entrega_hubo_diferencias',solicitud,null,
   'Entrega real confirmada: hubo diferencias',jsonb_build_object('estado',p.estado),
   jsonb_build_object('estado','entregado','venta_definitiva',snapshot,'cobro',p_cobro,'pagos',pagos,
     'aplicado_previo',aplicado_previo,'deuda_pendiente',restante,
     'saldo_a_favor_generado',greatest(recibido-(total::bigint-aplicado_previo),0)),resultado);
end; $$;


alter function public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb) owner to postgres;
revoke all on function public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb) to authenticated;
comment on function public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb) is
 'Confirmación administrativa atómica entrega_v1 con diferencias; cantidades explícitas y autorizaciones persistidas. Integración UI pendiente.';
commit;
