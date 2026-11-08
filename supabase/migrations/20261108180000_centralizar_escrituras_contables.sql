-- Seguridad contable, microintegración 1. Sólo archivo LOCAL, sin ejecutar.
-- Conserva los contratos legacy; no cierra DML (microintegración 2).
-- No concede acceso a correcciones administrativas ni cambia confirmaciones.
-- Requiere la cadena local completa hasta 20261108170000.
begin;

-- Implementaciones históricas encapsuladas: mismas validaciones, retornos,
-- FIFO, normalización, estados e idempotencia del contrato público anterior.

create function operativo_privado.base_registrar_pago_cliente_administrativo(
  p_cliente_id uuid,
  p_monto bigint,
  p_metodo_pago text,
  p_referencia text,
  p_observacion text,
  p_clave_idempotencia uuid
)
returns table (pago_id uuid, monto bigint, monto_aplicado bigint, monto_disponible bigint)
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_pago public.pagos%rowtype;
  v_pedido record;
  v_metodo text := lower(btrim(p_metodo_pago));
  v_restante bigint;
  v_aplicacion bigint;
  v_monto_aplicado bigint;
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if p_clave_idempotencia is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'MONTO_INVALIDO'; end if;
  if v_metodo not in ('efectivo', 'transferencia', 'otro', 'tarjeta', 'pago_web') then raise exception 'METODO_PAGO_INVALIDO'; end if;
  perform 1 from public.clientes c where c.id = p_cliente_id and c.activo = true for update;
  if not found then raise exception 'CLIENTE_INVALIDO'; end if;
  select * into v_pago from public.pagos p where p.clave_idempotencia = p_clave_idempotencia for update;
  if found then
    if v_pago.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa;
    return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
    return;
  end if;
  insert into public.pagos (cliente_id, monto, metodo_pago, estado, referencia, observacion, registrado_por, fecha_pago, clave_idempotencia)
  values (p_cliente_id, p_monto, v_metodo::public.metodo_pago, 'confirmado', nullif(btrim(p_referencia), ''), nullif(btrim(p_observacion), ''), auth.uid(), now(), p_clave_idempotencia)
  on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing
  returning * into v_pago;
  if v_pago.id is null then
    select * into v_pago from public.pagos p where p.clave_idempotencia = p_clave_idempotencia for update;
    if not found or v_pago.cliente_id is distinct from p_cliente_id then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
    select coalesce(sum(a.monto_aplicado), 0)::bigint into v_monto_aplicado from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa;
    return query select v_pago.id, v_pago.monto, v_monto_aplicado, v_pago.monto - v_monto_aplicado;
    return;
  end if;
  perform 1 from public.pedidos p where p.cliente_id = p_cliente_id and p.estado <> 'cancelado' order by p.fecha_creacion, p.id for update;
  v_restante := p_monto;
  for v_pedido in select p.id, s.saldo_pendiente from public.pedidos p join public.v_saldos_pedidos s on s.pedido_id = p.id where p.cliente_id = p_cliente_id and p.estado <> 'cancelado' and s.saldo_pendiente > 0 order by p.fecha_creacion, p.id loop
    exit when v_restante = 0;
    v_aplicacion := least(v_restante, v_pedido.saldo_pendiente);
    insert into public.aplicaciones_pago (pago_id, pedido_id, monto_aplicado) values (v_pago.id, v_pedido.id, v_aplicacion);
    v_restante := v_restante - v_aplicacion;
  end loop;
  v_monto_aplicado := p_monto - v_restante;
  return query select v_pago.id, p_monto, v_monto_aplicado, v_restante;
end;
$$;

create function operativo_privado.base_anular_pago_administrativo(p_pago_id uuid, p_motivo text)
returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_pago public.pagos%rowtype;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if v_motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
  select * into v_pago from public.pagos p where p.id = p_pago_id for update;
  if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
  if v_pago.estado = 'anulado' then return v_pago.id; end if;
  if v_pago.estado <> 'confirmado' then raise exception 'ESTADO_PAGO_INVALIDO'; end if;
  perform 1 from public.aplicaciones_pago a where a.pago_id = v_pago.id and a.activa for update;
  update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo where pago_id = v_pago.id and activa;
  update public.pagos set estado = 'anulado', fecha_anulacion = now(), anulado_por = auth.uid(), motivo_anulacion = v_motivo where id = v_pago.id;
  return v_pago.id;
end;
$$;

create function operativo_privado.base_cancelar_pedido_administrativo(p_pedido_id uuid, p_motivo text)
returns uuid
language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not coalesce(public.es_admin(), false) then raise exception 'NO_AUTORIZADO'; end if;
  if v_motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
  select * into v_pedido from public.pedidos p where p.id = p_pedido_id for update;
  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.estado = 'cancelado' then return v_pedido.id; end if;
  if v_pedido.estado not in ('recibido', 'en_revision', 'confirmado', 'programado', 'preparando') then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;
  perform 1 from public.aplicaciones_pago a where a.pedido_id = v_pedido.id and a.activa for update;
  update public.aplicaciones_pago set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_motivo where pedido_id = v_pedido.id and activa;
  update public.pedidos set estado = 'cancelado' where id = v_pedido.id;
  update public.historial_estados_pedido set observacion = v_motivo where id = (select h.id from public.historial_estados_pedido h where h.pedido_id = v_pedido.id and h.estado_nuevo = 'cancelado' order by h.fecha_creacion desc, h.id desc limit 1);
  return v_pedido.id;
end;
$$;

create function operativo_privado.base_cancelar_pedido_cliente(
  p_pedido_id uuid,
  p_motivo text default null
)
returns table (
  pedido_id uuid,
  numero_pedido text,
  estado public.estado_pedido,
  cliente_id uuid,
  fecha_entrega date
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_cliente_id uuid;
  v_pedido public.pedidos%rowtype;
  v_motivo text := nullif(btrim(p_motivo), '');
  v_observacion text;
begin
  if auth.uid() is null or coalesce(public.es_admin(), false) then
    raise exception 'NO_AUTORIZADO';
  end if;

  select c.id into v_cliente_id
  from public.clientes c
  where c.usuario_id = auth.uid() and c.activo = true;

  if not found then raise exception 'NO_AUTORIZADO'; end if;
  if v_motivo is not null and char_length(v_motivo) > 400 then
    raise exception 'MOTIVO_DEMASIADO_LARGO';
  end if;

  select * into v_pedido
  from public.pedidos p
  where p.id = p_pedido_id
  for update;

  if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
  if v_pedido.cliente_id is distinct from v_cliente_id then raise exception 'NO_AUTORIZADO'; end if;

  if v_pedido.estado = 'cancelado' then
    return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
    return;
  end if;
  if v_pedido.estado <> 'recibido' then raise exception 'ESTADO_PEDIDO_INVALIDO'; end if;

  v_observacion := 'Cancelado por el cliente' || case when v_motivo is null then '' else ': ' || v_motivo end;

  perform 1 from public.aplicaciones_pago a
  where a.pedido_id = v_pedido.id and a.activa
  for update;

  update public.aplicaciones_pago a
  set activa = false, fecha_anulacion = now(), anulada_por = auth.uid(), motivo_anulacion = v_observacion
  where a.pedido_id = v_pedido.id and a.activa;

  update public.pedidos set estado = 'cancelado'
  where id = v_pedido.id
  returning * into v_pedido;

  update public.historial_estados_pedido h
  set observacion = v_observacion
  where h.id = (
    select ultimo.id from public.historial_estados_pedido ultimo
    where ultimo.pedido_id = v_pedido.id and ultimo.estado_nuevo = 'cancelado'
    order by ultimo.fecha_creacion desc, ultimo.id desc
    limit 1
  );

  return query select v_pedido.id, v_pedido.numero_pedido, v_pedido.estado, v_pedido.cliente_id, v_pedido.fecha_entrega;
end;
$$;

-- Snapshot privado por pedido: también incluye estado del pago compartido.
-- No se expone como lector API ni se modifica la auditoría de entrega original.
create function operativo_privado.snapshot_contable(p_pedido uuid)
returns jsonb language sql security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('estado',p.estado,'aplicaciones',coalesce((
   select jsonb_agg(jsonb_build_object('aplicacion',to_jsonb(a),'pago',to_jsonb(pa)) order by a.id)
   from public.aplicaciones_pago a join public.pagos pa on pa.id=a.pago_id
   where a.pedido_id=p.id
 ),'[]'::jsonb)) from public.pedidos p where p.id=p_pedido
$$;

-- Única entrada privada de las cuatro escrituras existentes.
-- Cliente -> pagos UUID -> pedidos UUID -> aplicaciones UUID -> versiones.
-- La entrega ya toma cliente antes del pedido: se serializa con este núcleo.
-- Se bloquea el agregado completo para cubrir un pago aplicado a varios pedidos.
-- No sustituye ACL de DML directo: esa superficie sigue pendiente de fase 2.
create function operativo_privado.escribir_contabilidad(p_operacion text,p_args jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare
 cliente uuid; cliente_inicial uuid; pedido uuid := (p_args->>'pedido_id')::uuid;
 pago uuid := (p_args->>'pago_id')::uuid;
 motivo text := nullif(btrim(p_args->>'motivo'),'');
 anteriores jsonb := '{}'::jsonb; nuevo jsonb; resultado jsonb; fila record;
 version_anterior bigint; version_nueva bigint; clave uuid := gen_random_uuid();
 total_exigible numeric; aplicado numeric;
begin
 -- Autorizar antes de consultar/bloquear agregados de terceros.
 if p_operacion='cancelar_pedido_cliente' then
   if auth.uid() is null or coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
   select c.id into cliente from public.clientes c where c.usuario_id=auth.uid() and c.activo;
   if not found then raise exception 'NO_AUTORIZADO'; end if;
   if motivo is not null and char_length(motivo)>400 then raise exception 'MOTIVO_DEMASIADO_LARGO'; end if;
 elsif p_operacion in ('registrar_pago_cliente_administrativo','anular_pago_administrativo','cancelar_pedido_administrativo') then
   if not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
   if p_operacion='registrar_pago_cliente_administrativo' then
     if (p_args->>'clave')::uuid is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
     if (p_args->>'monto')::bigint is null or (p_args->>'monto')::bigint<=0 then raise exception 'MONTO_INVALIDO'; end if;
     if lower(btrim(p_args->>'metodo')) not in ('efectivo','transferencia','otro','tarjeta','pago_web') then raise exception 'METODO_PAGO_INVALIDO'; end if;
     cliente := (p_args->>'cliente_id')::uuid;
   else
     if motivo is null then raise exception 'MOTIVO_REQUERIDO'; end if;
     if p_operacion='anular_pago_administrativo' then
       select pa.cliente_id into cliente from public.pagos pa where pa.id=pago;
       if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
     else
       select p.cliente_id into cliente from public.pedidos p where p.id=pedido;
       if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
     end if;
   end if;
 else raise exception 'OPERACION_INVALIDA';
 end if;
 cliente_inicial:=cliente;
 perform 1 from public.clientes c where c.id=cliente for update;
 -- No bloquear un pago ajeno por una clave ya usada: evita ciclos entre
 -- clientes que presentan claves cruzadas, conservando el error legacy.
 if p_operacion='registrar_pago_cliente_administrativo' then
   if not exists(select 1 from public.clientes c where c.id=cliente and c.activo) then
     raise exception 'CLIENTE_INVALIDO';
   end if;
   if exists(select 1 from public.pagos pa where pa.clave_idempotencia=(p_args->>'clave')::uuid
     and pa.cliente_id is distinct from cliente) then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
 end if;
 perform 1 from public.pagos pa where pa.cliente_id=cliente order by pa.id for update;
 perform 1 from public.pedidos p where p.cliente_id=cliente or p.id=pedido order by p.id for update;
 -- Verificar las referencias leídas antes de adquirir los locks.
 if pedido is not null then
   select p.cliente_id into cliente from public.pedidos p where p.id=pedido;
   if not found then raise exception 'PEDIDO_NO_ENCONTRADO'; end if;
   if cliente is distinct from cliente_inicial then raise exception 'NO_AUTORIZADO'; end if;
 end if;
 if pago is not null then
   select pa.cliente_id into cliente from public.pagos pa where pa.id=pago;
   if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
   if cliente is distinct from cliente_inicial then raise exception 'CLIENTE_INVALIDO'; end if;
 end if;
 perform 1 from public.aplicaciones_pago a
 where a.pago_id in (select pa.id from public.pagos pa where pa.cliente_id=cliente_inicial)
    or a.pedido_id in (select p.id from public.pedidos p where p.cliente_id=cliente_inicial or p.id=pedido)
 order by a.id for update;
 for fila in select p.id from public.pedidos p
   where (p.cliente_id=cliente_inicial or p.id=pedido) and p.regimen_contable='entrega_v1' order by p.id loop
   anteriores:=anteriores||jsonb_build_object(fila.id::text,operativo_privado.snapshot_contable(fila.id));
 end loop;
 case p_operacion
 when 'registrar_pago_cliente_administrativo' then
   select to_jsonb(r) into resultado from operativo_privado.base_registrar_pago_cliente_administrativo(
     cliente_inicial,(p_args->>'monto')::bigint,p_args->>'metodo',p_args->>'referencia',p_args->>'observacion',(p_args->>'clave')::uuid) r;
 when 'anular_pago_administrativo' then
   resultado:=jsonb_build_object('id',operativo_privado.base_anular_pago_administrativo(pago,p_args->>'motivo'));
 when 'cancelar_pedido_administrativo' then
   resultado:=jsonb_build_object('id',operativo_privado.base_cancelar_pedido_administrativo(pedido,p_args->>'motivo'));
 when 'cancelar_pedido_cliente' then
   select to_jsonb(r) into resultado from operativo_privado.base_cancelar_pedido_cliente(pedido,p_args->>'motivo') r;
 end case;
 -- No-op/reintento legacy no genera evento ni incrementa versión.
 -- No se usa iniciar_operacion: los contratos legacy no reciben versión/clave
 -- operativas y cancelar_pedido_cliente autoriza propietario, no administrador.
 -- La versión se lee y avanza bajo el mismo lock de pedido de las entregas.
 for fila in select key::uuid as id,value as anterior from jsonb_each(anteriores) order by key loop
   nuevo:=operativo_privado.snapshot_contable(fila.id);
   if nuevo is not distinct from fila.anterior then continue; end if;
   -- Validar el estado resultante completo, no sólo la última aplicación.
   -- Los pagos compartidos se suman sobre TODOS sus pedidos (también legado).
   if exists(select 1 from public.aplicaciones_pago a
     join public.pagos pa on pa.id=a.pago_id join public.pedidos p on p.id=a.pedido_id
     where a.pedido_id=fila.id and a.activa and
       (a.monto_aplicado<=0 or pa.estado<>'confirmado' or p.cliente_id is distinct from pa.cliente_id
        or p.estado<>'entregado' or p.venta_reconocida_en is null)) then
     raise exception 'APLICACIONES_ACTIVAS_INCONSISTENTES';
   end if;
   if exists(select 1 from public.pagos pa where pa.id in
       (select a.pago_id from public.aplicaciones_pago a where a.pedido_id=fila.id and a.activa)
     and (select coalesce(sum(a.monto_aplicado::numeric),0) from public.aplicaciones_pago a
       where a.pago_id=pa.id and a.activa)>pa.monto) then
     raise exception 'APLICACIONES_SUPERAN_PAGO';
   end if;
   select coalesce(sum(a.monto_aplicado::numeric),0) into aplicado
     from public.aplicaciones_pago a where a.pedido_id=fila.id and a.activa;
   if aplicado>0 then
     select s.total_pedido into total_exigible from public.v_saldos_pedidos s where s.pedido_id=fila.id;
     if total_exigible is null or total_exigible<0 or aplicado>total_exigible then
       raise exception 'APLICACIONES_SUPERAN_VENTA';
     end if;
   end if;
   insert into operativo_privado.versiones_pedido(pedido_id) values(fila.id) on conflict(pedido_id) do nothing;
   select v.version into version_anterior from operativo_privado.versiones_pedido v where v.pedido_id=fila.id for update;
   update operativo_privado.versiones_pedido v set version=v.version+1
     where v.pedido_id=fila.id and v.version=version_anterior returning v.version into version_nueva;
   if not found then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
   insert into operativo_privado.historial_operativo(pedido_id,operacion,actor_id,motivo,
     valores_anteriores,valores_nuevos,version,clave_idempotencia,version_esperada,solicitud,resultado)
   values(fila.id,p_operacion,auth.uid(),'Operación contable: '||p_operacion,
     fila.anterior,nuevo,version_nueva,clave,version_anterior,p_args,resultado);
   -- El motivo completo permanece en solicitud y campos de anulación; no se
   -- trunca ni se impone el límite operativo de 2000 al contrato legacy.
 end loop;
 return resultado;
end; $$;

create or replace function public.registrar_pago_cliente_administrativo(
 p_cliente_id uuid,p_monto bigint,p_metodo_pago text,p_referencia text,p_observacion text,p_clave_idempotencia uuid
) returns table(pago_id uuid,monto bigint,monto_aplicado bigint,monto_disponible bigint)
language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb;
begin
 r:=operativo_privado.escribir_contabilidad('registrar_pago_cliente_administrativo',jsonb_build_object(
   'cliente_id',p_cliente_id,'monto',p_monto,'metodo',p_metodo_pago,'referencia',p_referencia,'observacion',p_observacion,'clave',p_clave_idempotencia));
 return query select (r->>'pago_id')::uuid,(r->>'monto')::bigint,(r->>'monto_aplicado')::bigint,(r->>'monto_disponible')::bigint;
end; $$;
create or replace function public.anular_pago_administrativo(p_pago_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
begin
 return (operativo_privado.escribir_contabilidad('anular_pago_administrativo',jsonb_build_object('pago_id',p_pago_id,'motivo',p_motivo))->>'id')::uuid;
end; $$;
create or replace function public.cancelar_pedido_administrativo(p_pedido_id uuid,p_motivo text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
begin
 return (operativo_privado.escribir_contabilidad('cancelar_pedido_administrativo',jsonb_build_object('pedido_id',p_pedido_id,'motivo',p_motivo))->>'id')::uuid;
end; $$;
create or replace function public.cancelar_pedido_cliente(p_pedido_id uuid,p_motivo text default null)
returns table(pedido_id uuid,numero_pedido text,estado public.estado_pedido,cliente_id uuid,fecha_entrega date)
language plpgsql security definer set search_path=pg_catalog as $$
declare r jsonb;
begin
 r:=operativo_privado.escribir_contabilidad('cancelar_pedido_cliente',jsonb_build_object('pedido_id',p_pedido_id,'motivo',p_motivo));
 return query select (r->>'pedido_id')::uuid,r->>'numero_pedido',(r->>'estado')::public.estado_pedido,(r->>'cliente_id')::uuid,(r->>'fecha_entrega')::date;
end; $$;

-- Validador vigente, sin ampliar acceso a correcciones.
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
  if not new.activa and exists(select 1 from public.pedidos p
    where p.id=new.pedido_id and p.regimen_contable='entrega_v1') then return new; end if;
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
    if new.monto_aplicado is null or new.monto_aplicado<=0 then raise exception 'MONTO_APLICACION_INVALIDO'; end if;
    if pedido_actual.venta_reconocida_en is null or pedido_actual.estado<>'entregado'
      or pago_actual.estado<>'confirmado' then raise exception 'APLICACION_REQUIERE_VENTA_Y_PAGO_CONFIRMADOS'; end if;
    select ((pedido_actual.venta_definitiva_snapshot->>'total')::bigint + coalesce(sum(c.diferencia),0))::bigint
      into total_exigible from public.correcciones_venta_entregada c where c.pedido_id=pedido_actual.id;
  else
    total_exigible := coalesce(pedido_actual.total_final, pedido_actual.total);
  end if;
  if pedido_actual.regimen_contable='entrega_v1' and (total_exigible is null or total_exigible<0) then
    raise exception 'TOTAL_VENTA_INVALIDO';
  end if;
  if aplicado_pedido + new.monto_aplicado > total_exigible then raise exception 'La aplicación supera el saldo pendiente del pedido'; end if;
  return new;
end;
$$;

alter function operativo_privado.base_registrar_pago_cliente_administrativo(uuid,bigint,text,text,text,uuid) owner to postgres;
revoke all on function operativo_privado.base_registrar_pago_cliente_administrativo(uuid,bigint,text,text,text,uuid) from public,anon,authenticated,service_role;

alter function operativo_privado.base_anular_pago_administrativo(uuid,text) owner to postgres;
revoke all on function operativo_privado.base_anular_pago_administrativo(uuid,text) from public,anon,authenticated,service_role;

alter function operativo_privado.base_cancelar_pedido_administrativo(uuid,text) owner to postgres;
revoke all on function operativo_privado.base_cancelar_pedido_administrativo(uuid,text) from public,anon,authenticated,service_role;

alter function operativo_privado.base_cancelar_pedido_cliente(uuid,text) owner to postgres;
revoke all on function operativo_privado.base_cancelar_pedido_cliente(uuid,text) from public,anon,authenticated,service_role;

alter function operativo_privado.snapshot_contable(uuid) owner to postgres;
revoke all on function operativo_privado.snapshot_contable(uuid) from public,anon,authenticated,service_role;

alter function operativo_privado.escribir_contabilidad(text,jsonb) owner to postgres;
revoke all on function operativo_privado.escribir_contabilidad(text,jsonb) from public,anon,authenticated,service_role;

alter function public.registrar_pago_cliente_administrativo(uuid,bigint,text,text,text,uuid) owner to postgres;

alter function public.anular_pago_administrativo(uuid,text) owner to postgres;

alter function public.cancelar_pedido_administrativo(uuid,text) owner to postgres;

alter function public.cancelar_pedido_cliente(uuid,text) owner to postgres;

alter function public.validar_aplicacion_pago() owner to postgres;
revoke all on function public.validar_aplicacion_pago() from public,anon,authenticated,service_role;
-- CREATE OR REPLACE conserva ACL públicas anteriores. Sin GRANT nuevo, sin
-- REVOKE de tablas, sin cambios en las RPC/ACL/barreras de confirmación de entrega.
commit;
