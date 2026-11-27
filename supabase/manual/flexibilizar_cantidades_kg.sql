-- Cantidad comercial para presentaciones vendidas directamente por kilogramo.
create or replace function public.es_cantidad_pedido_valida(
  p_unidad text,
  p_cantidad_presentacion numeric,
  p_nombre_presentacion text,
  p_cantidad_solicitada numeric
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    case
      when public.es_presentacion_kg_fraccionable(
        p_unidad,
        p_cantidad_presentacion,
        p_nombre_presentacion
      ) then
        p_cantidad_solicitada >= 0.1
        and p_cantidad_solicitada <= 10
        and p_cantidad_solicitada = trunc(p_cantidad_solicitada, 3)
      else
        p_cantidad_solicitada > 0
        and p_cantidad_solicitada = trunc(p_cantidad_solicitada)
    end,
    false
  );
$$;
