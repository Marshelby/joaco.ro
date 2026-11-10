-- Complemento LOCAL revisado estáticamente. No ejecutado.
-- Aplicar una sola vez, después de 20261109100000_crear_base_produccion.sql.
-- La firma original de siete parámetros y las migraciones históricas se conservan.
begin;
create table public.produccion_compra_importes (
 version_id uuid primary key references public.produccion_actividad_versiones(id) on delete restrict,
 precio_total numeric not null check (precio_total > 0 and precio_total < 1000000000000 and precio_total = round(precio_total,2))
);
alter table public.produccion_compra_importes owner to postgres;
alter table public.produccion_compra_importes enable row level security;
alter table public.produccion_compra_importes force row level security;
revoke all on public.produccion_compra_importes from public,anon,authenticated,service_role;
grant select on public.produccion_compra_importes to authenticated;
create policy produccion_lectura_administrador on public.produccion_compra_importes for select to authenticated
 using ((select auth.uid()) is not null and (select public.es_admin()));
create trigger produccion_importes_inmutables before update or delete on public.produccion_compra_importes
 for each row execute function produccion_privado.impedir_mutacion();
create trigger produccion_importes_no_truncables before truncate on public.produccion_compra_importes
 for each statement execute function produccion_privado.impedir_mutacion();

-- El lector diario busca el importe por el id de la versión vigente.
-- Conservar el TOTAL (no un precio unitario) al corregir una misma compra,
-- incluso si cambia su cantidad, y al anularla para mantener la auditoría.
-- Al cambiar a otro tipo no se copia; volver a compra no resucita el importe.
-- Las compras históricas sin precio siguen sin precio. Este complemento no
-- permite corregir el total: para ello se debe anular y registrar otra compra.
create function produccion_privado.conservar_importe_compra() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if new.numero_version > 1 and new.tipo_actividad='compra_alimento' then
  insert into public.produccion_compra_importes(version_id,precio_total)
  select new.id, i.precio_total
  from public.produccion_actividad_versiones v
  join public.produccion_compra_importes i on i.version_id=v.id
  where v.actividad_id=new.actividad_id
   and v.numero_version=new.numero_version-1
   and v.tipo_actividad='compra_alimento';
 end if;
 return new;
end; $$;
alter function produccion_privado.conservar_importe_compra() owner to postgres;
revoke all on function produccion_privado.conservar_importe_compra() from public,anon,authenticated,service_role;
create trigger produccion_conservar_importe_compra after insert on public.produccion_actividad_versiones
 for each row execute function produccion_privado.conservar_importe_compra();

-- Sobrecarga explícita: exclusivamente compra_alimento con precio total en CLP.
-- Reutiliza motor, autorización, bloqueo e idempotencia existentes, en una transacción.
-- Sin DEFAULT: PostgREST distingue las firmas por los nombres de argumentos.
create function public.registrar_actividad_produccion(
 p_clave_idempotencia uuid, p_unidad_id uuid, p_fecha_operativa date,
 p_tipo_actividad text, p_cantidad numeric, p_unidad_medida text,
 p_observaciones text, p_precio_total numeric
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare resultado jsonb;
begin
 perform produccion_privado.exigir_administrador();
 if p_tipo_actividad is distinct from 'compra_alimento' or p_precio_total is null
 or not (p_precio_total > 0 and p_precio_total < 1000000000000 and p_precio_total=round(p_precio_total,2)) then
  raise exception 'PRECIO_COMPRA_INVALIDO' using errcode='23514';
 end if;
 -- El motor almacena y compara el JSON completo, incluido el precio. Así
 -- también rechaza reutilizar la clave entre firmas en AMBAS direcciones.
 resultado := produccion_privado.escribir(p_clave_idempotencia,jsonb_build_object(
  'operacion','registrar_actividad', 'unidad_id',p_unidad_id,
  'fecha_operativa',p_fecha_operativa, 'tipo_actividad',p_tipo_actividad,
  'cantidad',p_cantidad, 'unidad_medida',p_unidad_medida,
  'observaciones',p_observaciones, 'precio_total',p_precio_total));
 -- El bloqueo de la clave sigue adquirido. Un reintento idéntico conserva
 -- la fila inmutable; cualquier fallo revierte también actividad y operación.
 insert into public.produccion_compra_importes(version_id,precio_total)
 values((resultado->>'version_id')::uuid,p_precio_total)
 on conflict (version_id) do nothing;
 return resultado;
end; $$;
alter function public.registrar_actividad_produccion(uuid,uuid,date,text,numeric,text,text,numeric) owner to postgres;
revoke all on function public.registrar_actividad_produccion(uuid,uuid,date,text,numeric,text,text,numeric) from public,anon,authenticated,service_role;
grant execute on function public.registrar_actividad_produccion(uuid,uuid,date,text,numeric,text,text,numeric) to authenticated;
comment on table public.produccion_compra_importes is 'Precio total de compra en CLP por versión. Inmutable; se conserva entre versiones consecutivas de compra, incluida anulación. No son movimientos comerciales.';
-- Actualizar la caché RPC/tabla de PostgREST al confirmar esta transacción.
notify pgrst, 'reload schema';
commit;
