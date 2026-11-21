-- HIDRO LEUFÚ. Incremental pendiente de revisión manual como postgres.
-- Requiere confirmacion_unica_preparacion_ruta y el contrato de entrega con diferencias.
begin;
set local lock_timeout = '5s';
set local search_path = pg_catalog;

do $requisitos$
begin
 if current_user <> 'postgres' then raise exception 'REQUIERE_POSTGRES'; end if;
 perform pg_advisory_xact_lock(42702, 20261108); -- Comparte el lock del parche de alias v2.
 if exists (
   select 1
   from (values
     ('public.confirmar_preparacion_ruta(jsonb)',
      $llamada$\mimporte[[:space:]]*:=[[:space:]]*operativo_privado\.importe_preparacion_ruta\(i\.id,[[:space:]]*i\.cantidad_preparada\)[[:space:]]*;$llamada$),
     ('public.confirmar_producto_preparado(uuid,numeric,bigint,bigint,uuid,text)',
      $llamada$\mv_importe[[:space:]]*:=[[:space:]]*operativo_privado\.importe_preparacion_ruta\(v_i\.id,[[:space:]]*p_cantidad\)[[:space:]]*;$llamada$)
   ) as requisito(firma, llamada)
   where not exists (
     select 1 from pg_proc p
     where p.oid=to_regprocedure(requisito.firma)
       and p.proowner='postgres'::regrole and p.prosecdef
       and p.prolang=(select oid from pg_language where lanname='plpgsql')
       and p.prokind='f' and not p.proretset and p.prorettype='jsonb'::regtype
       and 'search_path=pg_catalog'=any(p.proconfig)
       and p.prosrc ~ requisito.llamada
   )
 ) then
   raise exception 'REQUIERE_CONFIRMACION_UNICA_PREPARACION_RUTA';
 end if;
end;
$requisitos$;

-- La clave primaria de la auditoría permite una sola autorización por item.
-- El formato histórico unitario sigue usando el snapshot de precio aplicado.
create or replace function operativo_privado.total_proporcional_autorizado(p_item uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists (
   select 1
   from public.items_pedido i
   join public.auditoria_precios_pedido_administrativo a on a.item_pedido_id=i.id
   where i.id=p_item
     and i.cantidad>=0.001 and i.cantidad<1000000000 and i.cantidad=trunc(i.cantidad,3)
     and (i.cantidad=trunc(i.cantidad) or coalesce(i.modo_cantidad_snapshot,case
       when lower(coalesce(i.nombre_presentacion_snapshot,'')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
       when upper(btrim(i.unidad_snapshot))='KG' then 'kg_fraccionable' else 'unidad' end)='kg_fraccionable')
     and i.total_final_administrativo between 0 and 9007199254740991
     and i.total_final_administrativo=i.total_linea
     and a.precio_aplicado is null
     and a.total_aplicado=i.total_linea
     and a.total_original between 0 and 9007199254740991
     and a.total_original<>a.total_aplicado
     and a.precio_referencia=i.precio_final_unitario_snapshot
     and a.precio_referencia between 1 and 9007199254740991
     and a.total_original=round(i.cantidad*i.precio_final_unitario_snapshot)
 );
$$;
revoke all on function operativo_privado.total_proporcional_autorizado(uuid) from public,anon,authenticated,service_role;

do $permisos$
begin
 if exists (
   select 1 from pg_proc p
   where p.oid='operativo_privado.total_proporcional_autorizado(uuid)'::regprocedure
     and (p.proowner<>'postgres'::regrole or exists (
       select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
       where a.grantee<>p.proowner
     ))
 ) then raise exception 'PERMISOS_INCOMPATIBLES_TOTAL_PROPORCIONAL'; end if;
end;
$permisos$;

do $parche$
declare
 firma text;
 definicion text;
 cuerpo text;
 anterior text;
 nuevo text;
 patron_anterior text;
 patron_nuevo text;
 fragmento text[];
 coincidencias bigint;
 salto text;
 comentario text;
 antes pg_proc%rowtype;
 despues pg_proc%rowtype;
 puntuacion_importe constant text := $patron$[[:space:]]*([=;*.()]|::)[[:space:]]*$patron$;
 importe_anterior constant text := $importe$
 select case
 when p_cantidad is null then null
 when p_cantidad=0 then 0::bigint
 when p_cantidad=i.cantidad then i.total_linea
 when i.total_final_administrativo is not null then null
 else round(p_cantidad*i.precio_final_unitario_snapshot)::bigint end
 from public.items_pedido i where i.id=p_item;
$importe$;
 inicio_entrega constant text := $patron$\melsif[[:space:]]+cantidad[[:space:]]*=[[:space:]]*i\.cantidad[[:space:]]+then[[:space:]]+$patron$
   ||$patron$definitivo[[:space:]]*:=[[:space:]]*i\.total_linea[[:space:]]*;[[:space:]]*$patron$
   ||$patron$regla[[:space:]]*:=[[:space:]]*'total_pedido_autorizado'[[:space:]]*;[[:space:]]*$patron$
   ||$patron$elsif[[:space:]]+i\.total_final_administrativo[[:space:]]+is[[:space:]]+not[[:space:]]+null[[:space:]]+then[[:space:]]+$patron$;
 fin_entrega constant text := $patron$[[:space:]]*else[[:space:]]+definitivo[[:space:]]*:=[[:space:]]*round\(cantidad[[:space:]]*\*[[:space:]]*i\.precio_final_unitario_snapshot\)[[:space:]]*;[[:space:]]*$patron$
   ||$patron$regla[[:space:]]*:=[[:space:]]*'precio_unitario_acordado'[[:space:]]*;[[:space:]]*end[[:space:]]+if[[:space:]]*;$patron$;
 rechazo constant text := $patron$raise[[:space:]]+exception[[:space:]]+'TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_ENTREGADA'[[:space:]]*;$patron$;
 alias_corregido constant text := $patron$\mfrom[[:space:]]+public\.items_pedido[[:space:]]+(?:as[[:space:]]+)?item_validacion\M$patron$;
 alias_anterior constant text := $patron$\mselect[[:space:]]+1[[:space:]]+from[[:space:]]+public\.items_pedido[[:space:]]+(?:as[[:space:]]+)?i[[:space:]]+$patron$
   ||$patron$where[[:space:]]+i\.pedido_id[[:space:]]*=[[:space:]]*p\.id[[:space:]]+and[[:space:]]+i\.id[[:space:]]*=[[:space:]]*\(x[[:space:]]*->>[[:space:]]*'item_pedido_id'\)::uuid\M$patron$;
 campo_total constant text := $patron$'total_final_administrativo'[[:space:]]*,[[:space:]]*i\.total_final_administrativo[[:space:]]*,$patron$;
 campo_proporcional constant text := $patron$[[:space:]]*'total_proporcional_autorizado'[[:space:]]*,[[:space:]]*operativo_privado\.total_proporcional_autorizado\(i\.id\)[[:space:]]*,$patron$;
begin
 foreach firma in array array[
   'operativo_privado.importe_preparacion_ruta(uuid,numeric)',
   'public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)',
   'public.operar_entrega_asignada(jsonb,text,jsonb)'
 ] loop
   select * into antes from pg_proc where oid=to_regprocedure(firma);
   if not found then
     if firma='public.operar_entrega_asignada(jsonb,text,jsonb)' then continue; end if;
     raise exception 'FUNCION_REQUERIDA: %',firma;
   end if;
   if antes.proowner<>'postgres'::regrole or not antes.prosecdef
     or antes.prokind<>'f' or antes.proretset
     or not ('search_path=pg_catalog'=any(coalesce(antes.proconfig,array[]::text[]))) then
     raise exception 'CONTRATO_INCOMPATIBLE: %',firma;
   end if;

   -- Los patrones aceptan espacios y saltos LF o CRLF sobre el cuerpo original.
   cuerpo:=antes.prosrc;
   salto:=case when strpos(cuerpo,E'\r\n')>0 then E'\r\n' else E'\n' end;
   if firma='operativo_privado.importe_preparacion_ruta(uuid,numeric)' then
     if antes.prorettype<>'bigint'::regtype or antes.provolatile<>'s'
       or antes.proisstrict or antes.prolang<>(select oid from pg_language where lanname='sql')
       or antes.proargnames is distinct from array['p_item','p_cantidad']::text[] then
       raise exception 'CONTRATO_INCOMPATIBLE: %',firma;
     end if;
     nuevo:=$importe$
 select case when v.importe between 0 and 9007199254740991 then v.importe::bigint end
 from public.items_pedido i
 cross join lateral (
   select case
     when i.cantidad is null or i.cantidad<0.001 or i.cantidad>=1000000000
       or i.cantidad<>trunc(i.cantidad,3)
       or p_cantidad is null or p_cantidad<0 or p_cantidad>=1000000000
       or p_cantidad<>trunc(p_cantidad,3) then null
     when p_cantidad=0 then 0::numeric
     when p_cantidad<>trunc(p_cantidad) and coalesce(i.modo_cantidad_snapshot,case
       when lower(coalesce(i.nombre_presentacion_snapshot,'')) ~ '(saco|malla|caja|paquete|docena)' then 'presentacion_cerrada'
       when upper(btrim(i.unidad_snapshot))='KG' then 'kg_fraccionable' else 'unidad' end)<>'kg_fraccionable' then null
     when p_cantidad=i.cantidad then i.total_linea
     when i.total_final_administrativo is null then round(p_cantidad*i.precio_final_unitario_snapshot)
     when p_cantidad<i.cantidad and operativo_privado.total_proporcional_autorizado(i.id) then
       -- Cociente entero en numeric, con cantidades en milésimas y empate hacia arriba.
       div(2*trunc(p_cantidad*1000)*i.total_final_administrativo+trunc(i.cantidad*1000),
           2*trunc(i.cantidad*1000))
     else null
   end as importe
 ) v
 where i.id=p_item;
$importe$;
     if replace(cuerpo,E'\r\n',E'\n')=nuevo then continue; end if;
     if btrim(regexp_replace(regexp_replace(cuerpo,puntuacion_importe,'\1','g'),
         '[[:space:]]+',' ','g'), ' ;') <>
        btrim(regexp_replace(regexp_replace(importe_anterior,puntuacion_importe,'\1','g'),
         '[[:space:]]+',' ','g'), ' ;') then
       raise exception 'DEFINICION_INSTALADA_DESCONOCIDA: %',firma;
     end if;
     cuerpo:=replace(nuevo,E'\n',salto);
   else
     if antes.prorettype<>'jsonb'::regtype
       or antes.prolang<>(select oid from pg_language where lanname='plpgsql') then
       raise exception 'CONTRATO_INCOMPATIBLE: %',firma;
     end if;

     if firma='public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)' then
       patron_anterior:='('||inicio_entrega||'('||rechazo||')'||fin_entrega||')';
       patron_nuevo:=inicio_entrega||
         $patron$definitivo[[:space:]]*:=[[:space:]]*operativo_privado\.importe_preparacion_ruta\(i\.id,[[:space:]]*cantidad\);[[:space:]]*if definitivo is null then[[:space:]]+$patron$
         ||rechazo||$patron$[[:space:]]*end if;[[:space:]]*regla:='total_pedido_proporcional_autorizado';$patron$||fin_entrega;
       nuevo:=replace($parcial$definitivo:=operativo_privado.importe_preparacion_ruta(i.id,cantidad);
     if definitivo is null then
       raise exception 'TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_ENTREGADA';
     end if;
     regla:='total_pedido_proporcional_autorizado';$parcial$,E'\n',salto);
     else
       patron_anterior:='('||campo_total||')';
       patron_nuevo:=campo_total||campo_proporcional;
       nuevo:=salto||$parcial$     'total_proporcional_autorizado',operativo_privado.total_proporcional_autorizado(i.id),$parcial$;
       -- Un campo preexistente fuera del fragmento esperado no se duplica.
       if cuerpo ~ $patron$'total_proporcional_autorizado'[[:space:]]*,$patron$
         and (cuerpo !~ patron_nuevo or
           (select count(*) from regexp_matches(cuerpo,
             $patron$'total_proporcional_autorizado'[[:space:]]*,$patron$,'g'))<>1) then
         raise exception 'CAMPO_PROPORCIONAL_INCOMPATIBLE: %',firma;
       end if;
     end if;

     select count(*) into coincidencias
     from regexp_matches(cuerpo,'(?:'||patron_anterior||'|'||patron_nuevo||')','g');
     if coincidencias<>1 then
       raise exception 'FRAGMENTO_INSTALADO_NO_UNICO: %',firma;
     end if;
     if cuerpo !~ patron_nuevo then
       fragmento:=regexp_match(cuerpo,patron_anterior);
       anterior:=fragmento[1];
       if firma='public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)' then
         -- Se sustituye solo el rechazo dentro de la rama, conservando su contexto.
         nuevo:=replace(anterior,fragmento[2],nuevo);
       else
         nuevo:=anterior||nuevo;
       end if;
       cuerpo:=replace(cuerpo,anterior,nuevo);
     end if;

     if firma='public.confirmar_entrega_hubo_diferencias(uuid,bigint,uuid,jsonb,jsonb)' then
       select count(*) into coincidencias from regexp_matches(cuerpo,alias_anterior,'g');
       if coincidencias>1 or (coincidencias=0 and cuerpo !~ alias_corregido) then
         raise exception 'ALIAS_VALIDACION_INCOMPATIBLE: %',firma;
       end if;
       if coincidencias=1 then
         anterior:=substring(cuerpo from alias_anterior);
         cuerpo:=replace(cuerpo,anterior,regexp_replace(anterior,'\mi\M','item_validacion','g'));
       end if;
     end if;
   end if;
   if cuerpo=antes.prosrc then continue; end if;

   comentario:=obj_description(antes.oid,'pg_proc');
   definicion:=pg_get_functiondef(antes.oid);
   if length(definicion)-length(replace(definicion,antes.prosrc,''))<>length(antes.prosrc) then
     raise exception 'CUERPO_NO_UNICO_EN_DEFINICION: %',firma;
   end if;
   execute replace(definicion,antes.prosrc,cuerpo);
   select * into strict despues from pg_proc where oid=antes.oid;
   if despues.prosrc is distinct from cuerpo
     or (to_jsonb(antes)-'prosrc') is distinct from (to_jsonb(despues)-'prosrc')
     or obj_description(despues.oid,'pg_proc') is distinct from comentario then
     raise exception 'CONTRATO_MODIFICADO: %',firma;
   end if;
 end loop;
end;
$parche$;

commit;
