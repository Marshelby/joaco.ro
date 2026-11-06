-- El trigger diferido original comparaba con la versión FINAL de cabecera.
-- Una segunda operación legítima en la misma transacción invalidaba el evento.
-- Vincular al instante de autorización y a los precios del NEW de cada evento
-- permite operaciones sucesivas sin reutilizar auditorías anteriores.
create or replace function public.verificar_auditoria_precio_posible_pedido()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if row(new.precio_neto_autorizado, new.precio_venta_autorizado, new.precio_autorizado_por,
      new.fecha_autorizacion_precio, new.motivo_autorizacion_precio)
    is not distinct from row(old.precio_neto_autorizado, old.precio_venta_autorizado, old.precio_autorizado_por,
      old.fecha_autorizacion_precio, old.motivo_autorizacion_precio) then return null; end if;
  if not exists (
    select 1 from public.historial_posibles_pedidos h
    where h.posible_pedido_id = new.posible_pedido_id
      and h.evento = 'autorizacion_precio'
      and h.administrador_id = new.precio_autorizado_por
      and h.motivo = new.motivo_autorizacion_precio
      and (h.cambios ->> 'fecha_autorizacion_precio')::timestamptz = new.fecha_autorizacion_precio
      and h.cambios @> jsonb_build_object('item_id', new.id,
        'precio_neto_autorizado', new.precio_neto_autorizado,
        'precio_venta_autorizado', new.precio_venta_autorizado)
  ) then raise exception 'AUDITORIA_PRECIO_REQUERIDA'; end if;
  return null;
end;
$$;
alter function public.verificar_auditoria_precio_posible_pedido() owner to postgres;
revoke all on function public.verificar_auditoria_precio_posible_pedido()
  from public, anon, authenticated, service_role;
