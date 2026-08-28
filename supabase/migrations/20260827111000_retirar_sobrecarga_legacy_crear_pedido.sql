-- La firma de cinco parámetros quedó obsoleta al programar fecha de entrega.
-- Checkout vigente usa seis parámetros; P2 usará la firma de siete.
drop function public.crear_pedido_desde_carrito(uuid, uuid, jsonb, text, uuid);
