-- Checkout ya envía p_metodos_pago_previstos; no debe quedar una vía para
-- crear pedidos nuevos sin intención de pago registrada.
drop function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid, date);
