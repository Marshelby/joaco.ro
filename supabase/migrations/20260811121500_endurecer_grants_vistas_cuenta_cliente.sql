-- Las vistas de cuenta corriente son estrictamente de lectura para el API.
revoke all on public.v_movimientos_cuenta_cliente, public.v_saldos_cuenta_clientes from public, anon, authenticated;
grant select on public.v_movimientos_cuenta_cliente, public.v_saldos_cuenta_clientes to authenticated;
