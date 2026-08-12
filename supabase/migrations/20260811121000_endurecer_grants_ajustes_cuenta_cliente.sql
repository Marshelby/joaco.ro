-- Mantiene los grants de la tabla financiera alineados al patrón del núcleo.
revoke all on public.ajustes_cuenta_cliente from public, anon, authenticated;
grant select, insert, update, delete on public.ajustes_cuenta_cliente to authenticated;
