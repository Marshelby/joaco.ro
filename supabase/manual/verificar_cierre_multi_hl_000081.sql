-- SOLO SELECT. Ejecutar manualmente y devolver todas las filas por canal privado.
-- No autoriza por sí solo: contrastar con las validaciones del SQL de corrección.
WITH objetivo AS (
 SELECT p.* FROM public.pedidos p WHERE p.numero_pedido='HL-000081'
), evidencia AS (
 SELECT p.id, to_jsonb(p) AS pedido, to_jsonb(m) AS pertenencia,
 to_jsonb(r) AS ruta_con_cierre, to_jsonb(f) AS ultimo_fallo,
 coalesce(v.version,0) AS version_actual,
 EXISTS(SELECT 1 FROM operativo_privado.entregas_definitivas d WHERE d.pedido_id=p.id) AS entrega_definitiva,
 (SELECT jsonb_agg(to_jsonb(pi) ORDER BY item_pedido_id) FROM public.preparacion_items_pedido pi WHERE pi.pedido_id=p.id) AS preparacion_actual,
 (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.items_pedido i WHERE i.pedido_id=p.id) AS items_actuales,
 (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.instante,e.clave)
 FROM operativo_privado.ruta_multi_eventos e WHERE e.ruta_id=r.id
 AND (e.solicitud->>'accion'='cerrar' OR e.clave=f.clave_idempotencia)) AS eventos_fallo_y_cierre,
 (SELECT jsonb_agg(to_jsonb(cp)) FROM operativo_privado.carga_pedidos cp WHERE cp.pedido_id=p.id) AS seleccion_legacy
 FROM objetivo p
 LEFT JOIN operativo_privado.ruta_multi_pedidos m ON m.pedido_id=p.id
 LEFT JOIN operativo_privado.rutas_multi r ON r.id=m.ruta_id
 LEFT JOIN operativo_privado.versiones_pedido v ON v.pedido_id=p.id
 LEFT JOIN LATERAL (SELECT h.* FROM operativo_privado.historial_operativo h
 WHERE h.pedido_id=p.id AND h.operacion='entrega_fallida' ORDER BY h.version DESC LIMIT 1) f ON true
)
SELECT (SELECT count(*) FROM objetivo) AS coincidencias_pedido,to_jsonb(e) AS evidencia
FROM (SELECT 1) unico LEFT JOIN evidencia e ON true;
