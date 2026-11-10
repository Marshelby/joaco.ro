-- LOCAL PENDIENTE, NO EJECUTADO. Requiere base y complementos Fases 3, 5 y 7.
-- Solo lectura; no modifica actividades ni módulos comerciales.
begin;
create or replace function public.resumen_produccion(p_desde date,p_hasta date,p_lugar uuid,p_unidad uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare resultado jsonb;
begin
 perform produccion_privado.exigir_administrador();
 if p_desde is null or p_hasta is null or not isfinite(p_desde) or not isfinite(p_hasta)
 or p_hasta<p_desde or p_hasta-p_desde>365 then raise exception 'RANGO_RESUMEN_INVALIDO'; end if;
 if p_lugar is not null and not exists(select 1 from public.produccion_lugares where id=p_lugar)
 or p_unidad is not null and not exists(select 1 from public.produccion_unidades where id=p_unidad and (p_lugar is null or lugar_id=p_lugar))
 then raise exception 'LUGAR_UNIDAD_INVALIDO'; end if;
 with unidades as materialized (
 select u.* from public.produccion_unidades_actuales u
 where (p_lugar is null or u.lugar_id=p_lugar) and (p_unidad is null or u.id=p_unidad)
 ), actuales as materialized (
 -- El índice UNIQUE(actividad_id,numero_version) permite buscar hacia atrás.
 -- No filtrar por fecha/evento hasta haber resuelto la última versión.
 select a.unidad_id,v.* from public.produccion_actividades a
 join unidades u on u.id=a.unidad_id
 cross join lateral (select v.* from public.produccion_actividad_versiones v
 where v.actividad_id=a.id order by v.numero_version desc limit 1) v
 ), diario as (
 select unidad_id,fecha_operativa,tipo_actividad,
 case when tipo_unidad='meson' then coalesce(cultivo,'lechuga') else cultivo end cultivo,
 case when tipo_actividad in ('alimentacion','compra_alimento') and unidad_medida='g' then 'kg' else unidad_medida end medida,
 sum(case when tipo_actividad in ('alimentacion','compra_alimento') and unidad_medida='g' then cantidad/1000 else cantidad end) cantidad,
 count(*) registros,count(cantidad) cantidades_conocidas,
 sum(i.precio_total) importe,
 count(*) filter(where tipo_actividad='compra_alimento' and i.version_id is null) sin_importe
 from actuales v left join public.produccion_compra_importes i on i.version_id=v.id and v.tipo_actividad='compra_alimento'
 where evento<>'anulacion' and fecha_operativa between p_desde-(p_hasta-p_desde+1) and p_hasta
 group by 1,2,3,4,5
 )
 select jsonb_build_object(
 'lugares',(select coalesce(jsonb_agg(l order by l.nombre),'[]'::jsonb) from public.produccion_lugares_actuales l),
 'unidades',(select coalesce(jsonb_agg(u order by u.nombre),'[]'::jsonb) from public.produccion_unidades_actuales u),
 'configuraciones',(select coalesce(jsonb_agg(c),'[]'::jsonb) from unidades u cross join lateral
 (select c.unidad_id,c.vigente_desde,coalesce(c.cultivo,'lechuga') cultivo,coalesce(c.capacidad,c.capacidad_lechugas) capacidad,c.cantidad_gallinas
 from public.produccion_configuraciones_unidad c where c.unidad_id=u.id and c.vigente_desde<=p_hasta order by c.vigente_desde desc limit 1) c),
 'diario',(select coalesce(jsonb_agg(d order by fecha_operativa,unidad_id,tipo_actividad,cultivo,medida),'[]'::jsonb) from diario d)
 ) into resultado;
 return resultado;
end; $$;
alter function public.resumen_produccion(date,date,uuid,uuid) owner to postgres;
revoke all on function public.resumen_produccion(date,date,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.resumen_produccion(date,date,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
