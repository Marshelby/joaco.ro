// Cantidad y precio usan tres decimales. Redondeo exacto al peso, igual a SQL.
export function totalCompraCLP(cantidad: string, precio: string): number | null {
  const decimal = /^\d{1,9}(\.\d{1,3})?$/;
  if (!decimal.test(cantidad) || !decimal.test(precio)) return null;
  const mil = (valor: string) => {
    const [entero, fraccion = ""] = valor.split(".");
    return BigInt(entero) * BigInt(1000) + BigInt(fraccion.padEnd(3, "0"));
  };
  const total = (mil(cantidad) * mil(precio) + BigInt(500000)) / BigInt(1000000);
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}
