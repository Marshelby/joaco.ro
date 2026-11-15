/** Acepta sólo el listado local de No entregados, conservando su query exacta. */
export function destinoNoEntregados(valor: string | undefined) {
  if (!valor || !valor.startsWith("/admin/pedidos?")) return null;
  try {
    const url = new URL(valor, "https://local.invalid");
    return url.origin === "https://local.invalid" && url.pathname === "/admin/pedidos"
      && url.searchParams.get("filtro") === "no-entregados" ? `${url.pathname}${url.search}` : null;
  } catch { return null; }
}
