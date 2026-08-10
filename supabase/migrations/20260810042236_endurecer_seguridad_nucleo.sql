-- Hardening de privilegios. Las policies RLS siguen siendo la autorización de filas.

-- Las vistas son SECURITY INVOKER y se exponen solo a usuarios autenticados;
-- sus tablas subyacentes aplican RLS usando el mismo invocador.
alter view public.v_saldos_pedidos set (security_invoker = true);
alter view public.v_saldos_clientes set (security_invoker = true);
alter view public.v_saldos_pagos set (security_invoker = true);
revoke all on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos from public, anon;
grant select on public.v_saldos_pedidos, public.v_saldos_clientes, public.v_saldos_pagos to authenticated;

-- El API no requiere privilegios DDL ni de referencias para roles de aplicación.
revoke all on public.perfiles, public.clientes, public.direcciones_cliente,
  public.categorias, public.productos, public.presentaciones_producto,
  public.pedidos, public.items_pedido, public.historial_estados_pedido,
  public.pagos, public.aplicaciones_pago from public, anon, authenticated;

grant select on public.categorias, public.productos, public.presentaciones_producto to anon;
grant select, insert, update, delete on public.categorias, public.productos, public.presentaciones_producto,
  public.clientes, public.direcciones_cliente, public.pedidos, public.items_pedido,
  public.historial_estados_pedido, public.pagos, public.aplicaciones_pago to authenticated;
grant select on public.perfiles to authenticated;

revoke all on sequence public.numeros_pedido_seq from public, anon, authenticated;
grant usage on sequence public.numeros_pedido_seq to authenticated;

-- Son funciones internas de triggers: ningún rol de API debe invocarlas directamente.
revoke all on function public.actualizar_fecha_actualizacion(),
  public.validar_total_linea_pedido(), public.registrar_historial_estado_pedido(),
  public.validar_aplicacion_pago() from public, anon, authenticated;

-- Esta función preexistente solo la necesita su event trigger, ejecutado por su owner.
-- Revocar EXECUTE no desactiva ni modifica el event trigger.
revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;

-- es_admin() es requerida por policies de authenticated y conserva sólo ese EXECUTE.
revoke all on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;
