-- LOCAL exclusivamente. No habilita edición ni concede EXECUTE a roles API.
-- Requiere 20261108180000 y 20261108190000 ya aplicadas.
-- Contrato: un pago original -> reverso y cero o varios pagos compensatorios.
-- [] significa reverso puro. Un pago mixto se representa con dos reemplazos.
-- Cada reemplazo: {monto,metodo,referencia,aplicaciones:[{pedido_id,monto}]}.
-- Métodos exactos: efectivo / transferencia; importes enteros positivos.
-- Las aplicaciones son explícitas: nunca se ejecuta FIFO en una corrección.
-- Sólo se pueden reaplicar importes a pedidos con aplicación ORIGINAL activa.
-- Un excedente se deja sin aplicar; no se crea un ajuste ni un segundo abono.
-- anteriores_esperados debe coincidir con snapshot_pago completo; versiones
-- contiene exactamente todos los pedidos vinculados (también históricos y
-- legado), con versión operativa actual (0 si todavía no existe).
begin;

create table operativo_privado.correcciones_pago (
 id uuid primary key default gen_random_uuid(),
 clave uuid not null unique,
 pago_original_id uuid not null unique references public.pagos(id) on delete restrict,
 cliente_id uuid not null references public.clientes(id) on delete restrict,
 actor_id uuid not null,
 fecha timestamptz not null default clock_timestamp(),
 motivo text not null check (btrim(motivo)<>'' and length(motivo)<=2000),
 solicitud jsonb not null check (jsonb_typeof(solicitud)='object'),
 anteriores jsonb not null check (jsonb_typeof(anteriores)='object'),
 nuevos jsonb not null check (jsonb_typeof(nuevos)='object'),
 resultado jsonb not null check (jsonb_typeof(resultado)='object')
);
alter table operativo_privado.correcciones_pago owner to postgres;
alter table operativo_privado.correcciones_pago enable row level security;
alter table operativo_privado.correcciones_pago force row level security;
revoke all on operativo_privado.correcciones_pago from public,anon,authenticated,service_role;
create trigger correcciones_pago_inmutables before update or delete
 on operativo_privado.correcciones_pago for each row
 execute function operativo_privado.impedir_mutacion_historial();
create trigger correcciones_pago_no_truncables before truncate
 on operativo_privado.correcciones_pago for each statement
 execute function operativo_privado.impedir_mutacion_historial();

create function operativo_privado.snapshot_pago(p_pago_id uuid)
returns jsonb language sql security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('pago',to_jsonb(p),'aplicaciones',coalesce((
  select jsonb_agg(to_jsonb(a) order by a.id) from public.aplicaciones_pago a
  where a.pago_id=p.id),'[]'::jsonb)) from public.pagos p where p.id=p_pago_id
$$;

-- Auxiliar exclusivo de la corrección: recibe el plan ya validado y los locks
-- del agregado adquiridos por escribir_correccion_pago. No usa registro FIFO.
-- Los INSERT conservan los defaults y disparadores contables vigentes.
create function operativo_privado.insertar_reemplazo_pago(
 p_cliente uuid,p_entrada jsonb,p_original uuid,p_correccion uuid,p_fecha timestamptz
) returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare pago_nuevo uuid; aplicacion jsonb;
begin
 insert into public.pagos(cliente_id,monto,metodo_pago,estado,referencia,observacion,
  registrado_por,fecha_pago,clave_idempotencia)
 values(p_cliente,(p_entrada->>'monto')::bigint,(p_entrada->>'metodo')::public.metodo_pago,'confirmado',
  p_entrada->>'referencia','Compensación de pago '||p_original::text||'; corrección '||p_correccion::text,
  auth.uid(),p_fecha,gen_random_uuid()) returning id into pago_nuevo;
 for aplicacion in select value from jsonb_array_elements(p_entrada->'aplicaciones')
  order by (value->>'pedido_id')::uuid loop
  insert into public.aplicaciones_pago(pago_id,pedido_id,monto_aplicado)
  values(pago_nuevo,(aplicacion->>'pedido_id')::uuid,(aplicacion->>'monto')::bigint);
 end loop;
 return pago_nuevo;
end; $$;

-- Extensión privada del núcleo contable: mismo orden de locks, misma anulación
-- centralizada, mismos validadores y mismas vistas. No altera contratos legacy.
create function operativo_privado.escribir_correccion_pago(
 p_pago_id uuid,p_clave uuid,p_anteriores_esperados jsonb,
 p_versiones jsonb,p_reemplazos jsonb,p_motivo text
) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare
 actor uuid := auth.uid(); cliente uuid; original public.pagos%rowtype;
 evento operativo_privado.correcciones_pago%rowtype;
 solicitud jsonb; anterior jsonb; nuevo jsonb; resultado jsonb;
 pedidos_antes jsonb := '{}'::jsonb; pedidos_tras_reverso jsonb := '{}'::jsonb; versiones_actuales jsonb := '{}'::jsonb;
 reemplazos_nuevos jsonb := '[]'::jsonb; pagos_nuevos uuid[] := '{}'::uuid[];
 entrada jsonb; aplicacion jsonb; fila record; pago_nuevo uuid;
 v_pedido_destino uuid; monto bigint; suma numeric; total_nuevo numeric := 0;
 version_actual bigint; saldo numeric; instante timestamptz := clock_timestamp();
 correccion uuid := gen_random_uuid();
begin
 if actor is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_clave is null then raise exception 'CLAVE_IDEMPOTENCIA_REQUERIDA'; end if;
 if p_motivo is null or btrim(p_motivo)='' or length(p_motivo)>2000 then raise exception 'MOTIVO_REQUERIDO'; end if;
 if p_pago_id is null or jsonb_typeof(p_anteriores_esperados) is distinct from 'object'
 or jsonb_typeof(p_versiones) is distinct from 'object'
 or jsonb_typeof(p_reemplazos) is distinct from 'array' then raise exception 'SOLICITUD_INVALIDA'; end if;
 solicitud:=jsonb_build_object('contrato',1,'pago_id',p_pago_id,'anteriores_esperados',p_anteriores_esperados,
  'versiones',p_versiones,'reemplazos',p_reemplazos,'motivo',p_motivo);
 -- Reserva transaccional de clave antes de cualquier lock de agregado. Las
 -- colisiones del hash sólo serializan: la igualdad se comprueba por UUID.
 perform pg_advisory_xact_lock(hashtextextended('correccion_pago:'||p_clave::text,0));
 select * into evento from operativo_privado.correcciones_pago where clave=p_clave;
 if found then
  if evento.actor_id is distinct from actor or evento.solicitud is distinct from solicitud then
   raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
  end if;
  return evento.resultado; -- Resultado original exacto, incluso tras cambios posteriores.
 end if;
 select p.cliente_id into cliente from public.pagos p where p.id=p_pago_id;
 if not found then raise exception 'PAGO_NO_ENCONTRADO'; end if;
 -- Cliente -> TODOS los pagos UUID -> TODOS los pedidos UUID -> aplicaciones
 -- UUID -> versiones UUID. Serializa con registro, anulación y entregas.
 perform 1 from public.clientes c where c.id=cliente for update;
 if not found then raise exception 'CLIENTE_INVALIDO'; end if;
 perform 1 from public.pagos p where p.cliente_id=cliente order by p.id for update;
 perform 1 from public.pedidos p where p.cliente_id=cliente order by p.id for update;
 perform 1 from public.aplicaciones_pago a where
  a.pago_id in (select p.id from public.pagos p where p.cliente_id=cliente)
  or a.pedido_id in (select p.id from public.pedidos p where p.cliente_id=cliente)
  order by a.id for update;
 select * into original from public.pagos p where p.id=p_pago_id;
 if not found or original.cliente_id is distinct from cliente then raise exception 'CLIENTE_INVALIDO'; end if;
 if original.estado<>'confirmado' then raise exception 'PAGO_NO_CORREGIBLE'; end if;
 anterior:=operativo_privado.snapshot_pago(p_pago_id);
 if anterior is distinct from p_anteriores_esperados then raise exception 'PAGO_CONCURRENCIA_CONFLICTO'; end if;
 -- Rechazar inconsistencias en vez de bloquear agregados ajenos fuera de orden.
 if exists(select 1 from public.aplicaciones_pago a join public.pedidos p on p.id=a.pedido_id
  where a.pago_id=p_pago_id and p.cliente_id is distinct from cliente) then
  raise exception 'APLICACIONES_CLIENTE_INCONSISTENTE';
 end if;
 for fila in select p.id from public.pedidos p where p.id in (
  select a.pedido_id from public.aplicaciones_pago a where a.pago_id=p_pago_id) order by p.id loop
  insert into operativo_privado.versiones_pedido(pedido_id) values(fila.id) on conflict do nothing;
  select v.version into version_actual from operativo_privado.versiones_pedido v where v.pedido_id=fila.id for update;
  versiones_actuales:=versiones_actuales||jsonb_build_object(fila.id::text,version_actual);
  pedidos_antes:=pedidos_antes||jsonb_build_object(fila.id::text,operativo_privado.snapshot_contable(fila.id));
 end loop;
 if versiones_actuales is distinct from p_versiones then raise exception 'VERSION_OPERATIVA_CONFLICTO'; end if;
 -- completar_operacion vuelve a iniciar y podría retornar un reintento sin
 -- escribir evento. La única repetición válida ya retornó correcciones_pago.
 if exists(select 1 from operativo_privado.historial_operativo h
  where h.pedido_id in (select key::uuid from jsonb_each(pedidos_antes))
   and h.clave_idempotencia=p_clave) then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
 -- Validar el plan completo ANTES del reverso. No aceptar campos ignorados,
 -- duplicados por pago, fracciones, importes negativos ni métodos ambiguos.
 for entrada in select value from jsonb_array_elements(p_reemplazos) loop
  if jsonb_typeof(entrada) is distinct from 'object'
  or not (entrada ?& array['monto','metodo','referencia','aplicaciones'])
  or entrada-array['monto','metodo','referencia','aplicaciones']<>'{}'::jsonb
  or jsonb_typeof(entrada->'monto') is distinct from 'number'
  or jsonb_typeof(entrada->'metodo') is distinct from 'string'
  or entrada->>'metodo' not in ('efectivo','transferencia')
  or jsonb_typeof(entrada->'referencia') not in ('string','null')
  or jsonb_typeof(entrada->'aplicaciones') is distinct from 'array' then raise exception 'REEMPLAZO_INVALIDO'; end if;
  if (entrada->>'monto')::numeric<>trunc((entrada->>'monto')::numeric)
  or (entrada->>'monto')::numeric<=0 or (entrada->>'monto')::numeric>9007199254740991 then raise exception 'MONTO_INVALIDO'; end if;
  monto:=(entrada->>'monto')::bigint;
  total_nuevo:=total_nuevo+monto;
  if total_nuevo>9007199254740991 then raise exception 'MONTO_INVALIDO'; end if;
  suma:=0;
  for aplicacion in select value from jsonb_array_elements(entrada->'aplicaciones') loop
   if jsonb_typeof(aplicacion) is distinct from 'object'
   or not (aplicacion ?& array['pedido_id','monto'])
   or aplicacion-array['pedido_id','monto']<>'{}'::jsonb
   or jsonb_typeof(aplicacion->'pedido_id') is distinct from 'string'
   or jsonb_typeof(aplicacion->'monto') is distinct from 'number' then raise exception 'APLICACION_INVALIDA'; end if;
   v_pedido_destino:=(aplicacion->>'pedido_id')::uuid;
   if (aplicacion->>'monto')::numeric<>trunc((aplicacion->>'monto')::numeric)
   or (aplicacion->>'monto')::numeric<=0 or (aplicacion->>'monto')::numeric>monto then raise exception 'MONTO_APLICACION_INVALIDO'; end if;
   suma:=suma+(aplicacion->>'monto')::numeric;
   if not exists(select 1 from public.aplicaciones_pago a where a.pago_id=p_pago_id
    and a.pedido_id=v_pedido_destino and a.activa) then raise exception 'PEDIDO_FUERA_DEL_PAGO_ORIGINAL'; end if;
  end loop;
  if suma>monto then raise exception 'APLICACIONES_SUPERAN_PAGO'; end if;
  if (select count(distinct (a->>'pedido_id')::uuid) from jsonb_array_elements(entrada->'aplicaciones') a)
   <>jsonb_array_length(entrada->'aplicaciones') then raise exception 'APLICACION_DUPLICADA'; end if;
 end loop;
 -- Reverso operativo existente: conserva monto, método, fecha y aplicaciones
 -- originales, marca anulación con actor/fecha/motivo y genera su historial.
 perform public.anular_pago_administrativo(p_pago_id,p_motivo);
 -- El reverso ya dejó un evento en cada entrega_v1 vinculada, incluso si su
 -- aplicación era histórica/inactiva: snapshot_contable incluye el pago entero.
 -- Guardar su estado final para encadenar el siguiente evento sin reescribir
 -- el snapshot original conservado en pedidos_antes/correcciones_pago.
 for fila in select key::uuid as id from jsonb_each(pedidos_antes) order by key loop
  pedidos_tras_reverso:=pedidos_tras_reverso||jsonb_build_object(
   fila.id::text,operativo_privado.snapshot_contable(fila.id));
 end loop;
 -- El registro FIFO público no sirve para una sustitución acotada. Esta rama
 -- del núcleo crea NUEVOS pagos y aplicaciones explícitas con el validador
 -- vigente; no modifica ni reaplica pagos de terceros, ni cambia ventas.
 for entrada in select value from jsonb_array_elements(p_reemplazos) loop
  pago_nuevo:=operativo_privado.insertar_reemplazo_pago(cliente,entrada,p_pago_id,correccion,instante);
  pagos_nuevos:=array_append(pagos_nuevos,pago_nuevo);
  reemplazos_nuevos:=reemplazos_nuevos||jsonb_build_array(operativo_privado.snapshot_pago(pago_nuevo));
 end loop;
 -- Las vistas existentes reconstruyen deuda/crédito con el original anulado
 -- y los reemplazos confirmados UNA vez; no hay ajustes de cuenta adicionales.
 select s.saldo_actual into saldo from public.v_saldos_cuenta_clientes s where s.cliente_id=cliente;
 if saldo is null then raise exception 'CUENTA_CLIENTE_NO_ENCONTRADA'; end if;
 nuevo:=jsonb_build_object('original',operativo_privado.snapshot_pago(p_pago_id),'reemplazos',reemplazos_nuevos);
 resultado:=jsonb_build_object('correccion_id',correccion,'pago_original_id',p_pago_id,
  'pagos_reemplazo',to_jsonb(pagos_nuevos),'cliente_id',cliente,'saldo_cuenta',saldo,
  'deuda',greatest(saldo,0),'saldo_a_favor',greatest(-saldo,0),'fecha',instante);
 -- La anulación centralizada ya pudo avanzar las versiones entrega_v1.
 -- Verificamos la versión del solicitante ANTES y completamos cada operación
 -- con su versión vigente DESPUÉS, sin sobrescribir ni saltar eventos.
 for fila in select key::uuid as id,value as anterior from jsonb_each(pedidos_antes) order by key loop
  select v.version into version_actual from operativo_privado.versiones_pedido v where v.pedido_id=fila.id;
  perform operativo_privado.completar_operacion(fila.id,version_actual,p_clave,'correccion_pago_administrativo',
   solicitud,null,p_motivo,
   case when version_actual>(versiones_actuales->>fila.id::text)::bigint
    then pedidos_tras_reverso->fila.id::text else fila.anterior end,
   operativo_privado.snapshot_contable(fila.id),resultado);
 end loop;
 -- También existe este evento cuando el pago no tiene NINGÚN pedido; no se
 -- inventa un pedido para poder usar historial_operativo.
 insert into operativo_privado.correcciones_pago(id,clave,pago_original_id,cliente_id,actor_id,fecha,
  motivo,solicitud,anteriores,nuevos,resultado)
 values(correccion,p_clave,p_pago_id,cliente,actor,instante,p_motivo,solicitud,
  jsonb_build_object('original',anterior,'pedidos',pedidos_antes),nuevo,resultado);
 return resultado;
end; $$;

create function public.corregir_pago_administrativo(
 p_pago_id uuid,p_clave uuid,p_anteriores_esperados jsonb,
 p_versiones jsonb,p_reemplazos jsonb,p_motivo text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 return operativo_privado.escribir_correccion_pago(p_pago_id,p_clave,p_anteriores_esperados,
  p_versiones,p_reemplazos,p_motivo);
end; $$;

alter function operativo_privado.insertar_reemplazo_pago(uuid,jsonb,uuid,uuid,timestamptz) owner to postgres;
revoke all on function operativo_privado.insertar_reemplazo_pago(uuid,jsonb,uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
alter function operativo_privado.snapshot_pago(uuid) owner to postgres;
alter function operativo_privado.escribir_correccion_pago(uuid,uuid,jsonb,jsonb,jsonb,text) owner to postgres;
alter function public.corregir_pago_administrativo(uuid,uuid,jsonb,jsonb,jsonb,text) owner to postgres;
revoke all on function operativo_privado.snapshot_pago(uuid) from public,anon,authenticated,service_role;
revoke all on function operativo_privado.escribir_correccion_pago(uuid,uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.corregir_pago_administrativo(uuid,uuid,jsonb,jsonb,jsonb,text) from public,anon,authenticated,service_role;
comment on function public.corregir_pago_administrativo(uuid,uuid,jsonb,jsonb,jsonb,text) is
 'Preparada, sin acceso API. Reverso centralizado y reemplazos explícitos auditados. No habilitar edición sin integración posterior.';
commit;
