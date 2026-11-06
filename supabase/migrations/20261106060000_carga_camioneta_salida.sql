-- Microintegración 6/8. Requiere 010000, 030000, 040000 y 050000.
begin;
create table operativo_privado.cargas (
 fecha date primary key check (isfinite(fecha)),
 estado text not null default 'preparacion' check (estado in ('preparacion','lista','en_ruta')),
 version bigint not null default 0 check (version >= 0),
 confirmada_en timestamptz, salida_en timestamptz
);
create table operativo_privado.carga_pedidos (
 fecha date not null references operativo_privado.cargas(fecha),
 pedido_id uuid primary key references public.pedidos(id) on delete restrict,
 incluido boolean not null,
 motivo text,
 check (incluido or (nullif(btrim(motivo),'') is not null and length(motivo)<=2000))
);
create table operativo_privado.historial_cargas (
 fecha date not null, version bigint not null, clave uuid not null,
 actor uuid not null, instante timestamptz not null default clock_timestamp(),
 solicitud jsonb not null, anterior jsonb not null, resultado jsonb not null,
 primary key(fecha,version), unique(fecha,clave)
);
create trigger historial_cargas_inmutable before update or delete on operativo_privado.historial_cargas
 for each row execute function operativo_privado.impedir_mutacion_historial();
create trigger historial_cargas_no_truncable before truncate on operativo_privado.historial_cargas
 for each statement execute function operativo_privado.impedir_mutacion_historial();
alter table operativo_privado.cargas enable row level security;
alter table operativo_privado.cargas force row level security;
alter table operativo_privado.carga_pedidos enable row level security;
alter table operativo_privado.carga_pedidos force row level security;
alter table operativo_privado.historial_cargas enable row level security;
alter table operativo_privado.historial_cargas force row level security;
revoke all on operativo_privado.cargas, operativo_privado.carga_pedidos, operativo_privado.historial_cargas from public,anon,authenticated,service_role;

create function public.leer_carga_jornada(p_fecha date)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 return jsonb_build_object(
 'estado',coalesce((select estado from operativo_privado.cargas where fecha=p_fecha),'preparacion'),
 'version',coalesce((select version from operativo_privado.cargas where fecha=p_fecha),0),
 'pedidos',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'numero',p.numero_pedido,'cliente',p.nombre_cliente_snapshot,
 'estado',p.estado,'incluido',cp.incluido,'motivo',cp.motivo,
 'productos',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'nombre',i.nombre_producto_snapshot,
 'cantidad',pi.cantidad_preparada,'importe',pi.importe_linea_operativo,'confirmado',coalesce(pi.confirmado_explicito,false)) order by i.id)
 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id where i.pedido_id=p.id),'[]'::jsonb),'pendientes',
 (select count(*) from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.importe_linea_operativo is null))) order by p.numero_pedido)
 from public.pedidos p left join operativo_privado.carga_pedidos cp on cp.pedido_id=p.id and cp.fecha=p_fecha
 where p.fecha_entrega=p_fecha or cp.fecha=p_fecha),'[]'::jsonb),
 'historial',coalesce((select jsonb_agg(to_jsonb(h) order by h.version desc) from operativo_privado.historial_cargas h where h.fecha=p_fecha),'[]'::jsonb));
end; $$;

-- Un comando = una transacción. Guardar recibe la selección completa explícita;
-- confirmar/salir/reabrir consumen únicamente esa selección persistida.
create function public.operar_carga_jornada(p_fecha date,p_version bigint,p_clave uuid,p_accion text,p_pedidos jsonb,p_motivo text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 c operativo_privado.cargas%rowtype; h operativo_privado.historial_cargas%rowtype;
 s jsonb; anterior jsonb; resultado jsonb; e jsonb; p public.pedidos%rowtype;
 pv bigint; inicio jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_fecha is null or not isfinite(p_fecha) or p_version is null or p_version<0 or p_clave is null
 or p_accion is null or p_accion not in ('guardar','confirmar','salir','reabrir') then raise exception 'OPERACION_INVALIDA'; end if;
 -- Antes de cualquier lock de fila/advisory: estabiliza el universo de la fecha
 -- frente a INSERT y cambios legacy que no participan del lock de jornada.
 -- EXCLUSIVE también espera SELECT FOR UPDATE legacy antes de tomar el
 -- lock: evita retenerlo esperando una fila cuyo dueño aún necesita UPDATE.
 -- SELECT ordinarios siguen permitidos. El coste es serializar escrituras.
 lock table public.pedidos in exclusive mode;
 perform pg_advisory_xact_lock(hashtextextended('carga:'||p_fecha::text,0));
 s:=jsonb_build_object('accion',p_accion,'pedidos',p_pedidos,'motivo',p_motivo,'version',p_version);
 select * into h from operativo_privado.historial_cargas where fecha=p_fecha and clave=p_clave;
 if found then
 if h.actor<>auth.uid() or h.solicitud<>s then raise exception 'CLAVE_IDEMPOTENCIA_EN_USO'; end if;
 return h.resultado;
 end if;
 if p_fecha is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 insert into operativo_privado.cargas(fecha) values(p_fecha) on conflict do nothing;
 select * into c from operativo_privado.cargas where fecha=p_fecha for update;
 if c.version<>p_version then raise exception 'VERSION_CARGA_CONFLICTO'; end if;
 if c.estado='en_ruta' then raise exception 'CARGA_YA_SALIO'; end if;
 anterior:=public.leer_carga_jornada(p_fecha);
 if p_accion='guardar' then
 if c.estado<>'preparacion' then raise exception 'CARGA_NO_EDITABLE'; end if;
 if p_pedidos is null or jsonb_typeof(p_pedidos)<>'array' or jsonb_array_length(p_pedidos)=0 then raise exception 'SELECCION_REQUERIDA'; end if;
 if exists(select 1 from jsonb_array_elements(p_pedidos) x where jsonb_typeof(x)<>'object'
 or x->>'id' is null or jsonb_typeof(x->'incluido') is distinct from 'boolean')
 or (select count(distinct x->>'id') from jsonb_array_elements(p_pedidos) x)<>jsonb_array_length(p_pedidos) then raise exception 'SELECCION_INVALIDA'; end if;
 -- Bloqueo común con las RPC individuales; orden determinista.
 perform 1 from public.pedidos where id in (select (x->>'id')::uuid from jsonb_array_elements(p_pedidos) x) order by id for update;
 if (select count(*) from public.pedidos pe where pe.id in (select (x->>'id')::uuid from jsonb_array_elements(p_pedidos) x)
 and (pe.fecha_entrega=p_fecha or exists(select 1 from operativo_privado.carga_pedidos cp where cp.pedido_id=pe.id and cp.fecha=p_fecha)))<>jsonb_array_length(p_pedidos) then raise exception 'SELECCION_INVALIDA'; end if;
 -- Cancelados/terminales o miembros desplazados sólo admiten exclusión explícita.
 if exists(select 1 from jsonb_array_elements(p_pedidos) x join public.pedidos pe on pe.id=(x->>'id')::uuid
 where (x->>'incluido')::boolean and (pe.fecha_entrega is distinct from p_fecha
 or pe.estado not in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho'))) then raise exception 'SELECCION_INVALIDA'; end if;
 if exists(select 1 from jsonb_array_elements(p_pedidos) x where not (x->>'incluido')::boolean
 and (nullif(btrim(x->>'motivo'),'') is null or length(x->>'motivo')>2000)) then raise exception 'EXCLUSION_REQUIERE_MOTIVO'; end if;
 -- No permite omitir silenciosamente miembros persistidos: excluir con motivo.
 if exists(select 1 from operativo_privado.carga_pedidos cp where cp.fecha=p_fecha and not exists(select 1 from jsonb_array_elements(p_pedidos) x where (x->>'id')::uuid=cp.pedido_id)) then raise exception 'EXCLUSION_REQUIERE_MOTIVO'; end if;
 for e in select value from jsonb_array_elements(p_pedidos) loop
 insert into operativo_privado.carga_pedidos(fecha,pedido_id,incluido,motivo)
 values(p_fecha,(e->>'id')::uuid,(e->>'incluido')::boolean,nullif(btrim(e->>'motivo'),''))
 on conflict(pedido_id) do update set incluido=excluded.incluido,motivo=excluded.motivo
 where operativo_privado.carga_pedidos.fecha=p_fecha;
 if not found then raise exception 'PEDIDO_EN_OTRA_CARGA'; end if;
 end loop;
 else
 if p_accion in ('confirmar','salir') and not exists(select 1 from operativo_privado.carga_pedidos where fecha=p_fecha and incluido) then raise exception 'CARGA_VACIA'; end if;
 if (p_accion='confirmar' and c.estado<>'preparacion') or (p_accion in ('salir','reabrir') and c.estado<>'lista') then raise exception 'ESTADO_CARGA_INVALIDO'; end if;
 if p_accion='reabrir' and (nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000) then raise exception 'MOTIVO_REQUERIDO'; end if;
 -- Confirmar exige una decisión persistida para CADA pedido que existe ahora.
 -- Los creados después de esta transacción quedan fuera; salir no los incorpora.
 if p_accion='confirmar' and exists(select 1 from public.pedidos pe where pe.fecha_entrega=p_fecha
 and not exists(select 1 from operativo_privado.carga_pedidos cp where cp.fecha=p_fecha and cp.pedido_id=pe.id)) then raise exception 'DECISIONES_PENDIENTES'; end if;
 -- Lista congela los pedidos incluidos. Reabrir libera el cierre sin borrar líneas.
 if p_accion='reabrir' then update operativo_privado.cargas set estado='preparacion',confirmada_en=null where fecha=p_fecha; end if;
 for p in select pe.* from public.pedidos pe join operativo_privado.carga_pedidos cp on cp.pedido_id=pe.id
 where cp.fecha=p_fecha and cp.incluido order by pe.id for update of pe loop
 if p.estado<>'listo_despacho' or p.fecha_entrega is distinct from p_fecha then raise exception 'PEDIDO_NO_LISTO'; end if;
 if p_accion in ('confirmar','salir') then
 perform 1 from public.items_pedido where pedido_id=p.id order by id for update;
 perform 1 from public.preparacion_items_pedido where pedido_id=p.id order by item_pedido_id for update;
 if p.preparacion_finalizada_en is null or not exists(select 1 from public.items_pedido where pedido_id=p.id)
 or exists(select 1 from public.items_pedido i left join public.preparacion_items_pedido pi on pi.item_pedido_id=i.id
 where i.pedido_id=p.id and (not coalesce(pi.confirmado_explicito,false) or pi.importe_linea_operativo is null)) then raise exception 'PRODUCTOS_PENDIENTES'; end if;
 end if;
 if p_accion in ('salir','reabrir') then
 select coalesce((select version from operativo_privado.versiones_pedido where pedido_id=p.id),0) into pv;
 inicio:=operativo_privado.iniciar_operacion(p.id,pv,p_clave,'carga_'||p_accion,s);
 update public.pedidos set estado=case when p_accion='salir' then 'en_reparto'::public.estado_pedido else 'preparando'::public.estado_pedido end,
 preparacion_finalizada_en=case when p_accion='reabrir' then null else preparacion_finalizada_en end,
 preparacion_finalizada_por=case when p_accion='reabrir' then null else preparacion_finalizada_por end,
 preparacion_estado=case when p_accion='reabrir' then 'pendiente' else preparacion_estado end where id=p.id;
 perform operativo_privado.completar_operacion(p.id,pv,p_clave,'carga_'||p_accion,s,null,
 coalesce(nullif(btrim(p_motivo),''),'Salida global de carga confirmada'),to_jsonb(p),
 jsonb_build_object('estado',case when p_accion='salir' then 'en_reparto' else 'preparando' end),jsonb_build_object('fecha',p_fecha));
 end if;
 end loop;
 -- Evaluación tras todos los locks, también si se cruzó medianoche.
 if p_fecha is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 update operativo_privado.cargas set estado=case p_accion when 'confirmar' then 'lista' when 'salir' then 'en_ruta' else 'preparacion' end,
 confirmada_en=case when p_accion='confirmar' then clock_timestamp() else confirmada_en end,
 salida_en=case when p_accion='salir' then clock_timestamp() else salida_en end where fecha=p_fecha;
 end if;
 -- También guardar revalida el reloj después de todos sus locks/escrituras.
 if p_fecha is distinct from (clock_timestamp() at time zone 'America/Santiago')::date then raise exception 'PREPARACION_FECHA_NO_HABILITADA'; end if;
 update operativo_privado.cargas set version=version+1 where fecha=p_fecha;
 resultado:=public.leer_carga_jornada(p_fecha)-'historial';
 insert into operativo_privado.historial_cargas(fecha,version,clave,actor,solicitud,anterior,resultado)
 values(p_fecha,p_version+1,p_clave,auth.uid(),s,anterior-'historial',resultado);
 return resultado;
end; $$;

-- Barrera para RPC legacy: no alterar fecha/preparación de una carga confirmada.
-- No toma lock de carga después del pedido: evita invertir el orden global.
create function operativo_privado.proteger_pedido_cargado()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare e text; omitidas text[];
begin
 select c.estado into e from operativo_privado.cargas c join operativo_privado.carga_pedidos cp on cp.fecha=c.fecha where cp.pedido_id=old.id and cp.incluido;
 -- NEW no tiene valores generados fiables en BEFORE. Se omiten únicamente
 -- columnas derivadas y los dos campos autorizados; sus fuentes siguen protegidas.
 select array['estado','fecha_actualizacion']::text[] || coalesce(array_agg(a.attname::text),array[]::text[])
 into omitidas from pg_catalog.pg_attribute a
 where a.attrelid=TG_RELID and a.attnum>0 and not a.attisdropped and a.attgenerated<>'';
 if e in ('lista','en_ruta') and (to_jsonb(new)-omitidas) is distinct from (to_jsonb(old)-omitidas) then raise exception 'CARGA_CONFIRMADA'; end if;
 if e='lista' and new.estado not in ('listo_despacho','en_reparto') then raise exception 'CARGA_CONFIRMADA'; end if;
 if e='en_ruta' and new.estado in ('recibido','en_revision','programado','confirmado','preparando','listo_despacho') then raise exception 'CARGA_YA_SALIO'; end if;
 return new;
end; $$;
create trigger proteger_pedido_cargado before update on public.pedidos for each row execute function operativo_privado.proteger_pedido_cargado();
revoke all on function public.marcar_pedido_en_reparto_administrativo(uuid) from public,anon,authenticated,service_role;
alter function public.leer_carga_jornada(date) owner to postgres;
alter function public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text) owner to postgres;
alter function operativo_privado.proteger_pedido_cargado() owner to postgres;
revoke all on function operativo_privado.proteger_pedido_cargado() from public,anon,authenticated,service_role;
revoke all on function public.leer_carga_jornada(date), public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.leer_carga_jornada(date), public.operar_carga_jornada(date,bigint,uuid,text,jsonb,text) to authenticated;
commit;
