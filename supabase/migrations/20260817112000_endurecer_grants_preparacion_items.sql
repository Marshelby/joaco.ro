-- La tabla es de lectura controlada: las escrituras ocurren exclusivamente por RPC.
revoke all on table public.preparacion_items_pedido from public, anon, authenticated;
grant select on table public.preparacion_items_pedido to authenticated;
