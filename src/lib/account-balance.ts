export function describirSaldoCuenta(saldo: number) {
  if (saldo > 0) return { monto: saldo, texto: "Debe" };
  if (saldo < 0) return { monto: Math.abs(saldo), texto: "A favor" };
  return { monto: 0, texto: "Al día" };
}
