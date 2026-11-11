-- Fase 3 · aplicar manualmente después de Fase 2. Solo nuevas lecturas.
-- No modifica datos, RLS, cierres ni funciones existentes.
begin;
create function public.leer_no_entregados_admin(
 p_busqueda text default '', p_desde date default null, p_hasta date default null,
 p_pagina integer default 1
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare respuesta jsonb;
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_pagina is null or p_pagina<1 or p_pagina>100000 or length(p_busqueda)>200
 or (p_desde is not null and not isfinite(p_desde)) or (p_hasta is not null and not isfinite(p_hasta))
 or p_desde>p_hasta then raise exception 'FILTROS_INVALIDOS'; end if;
 with fallidos as (
 select p.id,p.numero_pedido,p.nombre_cliente_snapshot cliente,p.fecha_entrega,
 p.total, f.fecha fecha_fallo,f.motivo,f.valores_nuevos->>'observaciones' observaciones,
 (f.id is null) historico,
 coalesce((select jsonb_agg(jsonb_build_object('nombre',i.nombre_producto_snapshot,
 'presentacion',i.nombre_presentacion_snapshot,'cantidad',i.cantidad,'unidad',i.unidad_snapshot) order by i.id)
 from public.items_pedido i where i.pedido_id=p.id),'[]'::jsonb) productos
 from public.pedidos p
 left join lateral (select h.* from operativo_privado.historial_operativo h
 where h.pedido_id=p.id and h.operacion='entrega_fallida' order by h.version desc limit 1) f on true
 where p.estado='entrega_fallida'
 -- El estado vigente es autoritativo; excluir una transición posterior incompatible.
 and coalesce((select coalesce(h.valores_nuevos->>'estado',h.valores_nuevos->'pedido'->>'estado')
 from operativo_privado.historial_operativo h where h.pedido_id=p.id
 and coalesce(h.valores_nuevos->>'estado',h.valores_nuevos->'pedido'->>'estado') is not null
 order by h.version desc limit 1),'entrega_fallida')='entrega_fallida'
 and (coalesce(p_busqueda,'')='' or position(lower(p_busqueda) in lower(p.nombre_cliente_snapshot))>0
 or position(lower(p_busqueda) in lower(p.numero_pedido::text))>0)
 -- Filtro por fecha original programada del intento vigente, no fecha de creación.
 and (p_desde is null or p.fecha_entrega>=p_desde)
 and (p_hasta is null or p.fecha_entrega<=p_hasta)
 ), pagina as (select * from fallidos order by fecha_fallo desc nulls last,id limit 20 offset (p_pagina-1)*20)
 select jsonb_build_object('total',(select count(*) from fallidos),
 'pedidos',coalesce((select jsonb_agg(to_jsonb(x) order by x.fecha_fallo desc nulls last,x.id) from pagina x),'[]'::jsonb)) into respuesta;
 return respuesta;
end; $$;

create function public.leer_intentos_pedido_admin(p_pedido_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 return jsonb_build_object(
 'intentos',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'fecha',h.fecha,'actor',h.actor_id,
 'motivo',h.motivo,'observaciones',h.valores_nuevos->>'observaciones','version',h.version) order by h.version)
 from operativo_privado.historial_operativo h where h.pedido_id=p_pedido_id and h.operacion='entrega_fallida'),'[]'::jsonb),
 'cierres',coalesce((select jsonb_agg(jsonb_build_object('fecha',c.fecha,'cerrada_en',c.cerrada_en,
 'actor',c.cerrada_por,'version',c.version,'intento',x.intento) order by c.fecha)
 from operativo_privado.cargas c cross join lateral jsonb_array_elements(c.resumen_cierre->'intentos') x(intento)
 where c.estado='cerrada' and x.intento->'pedido'->>'id'=p_pedido_id::text),'[]'::jsonb));
end; $$;
alter function public.leer_no_entregados_admin(text,date,date,integer) owner to postgres;
alter function public.leer_intentos_pedido_admin(uuid) owner to postgres;
revoke all on function public.leer_no_entregados_admin(text,date,date,integer), public.leer_intentos_pedido_admin(uuid) from public,anon,authenticated,service_role;
grant execute on function public.leer_no_entregados_admin(text,date,date,integer), public.leer_intentos_pedido_admin(uuid) to authenticated;
commit;
