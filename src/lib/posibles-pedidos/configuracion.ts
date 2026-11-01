import "server-only";

export function fasePosiblesPedidosHabilitada() {
  return process.env.POSIBLES_PEDIDOS_ENABLED === "true";
}
export function problemasConfiguracionRegistro(): string[] {
  const problemas: string[] = [];
  if (!fasePosiblesPedidosHabilitada()) problemas.push("POSIBLES_PEDIDOS_ENABLED: deshabilitado");
  for (const nombre of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
    if (!process.env[nombre]?.trim()) problemas.push(`${nombre}: ausente`);
  }
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.origin !== "https://gxmkrerhuuzeeupjliap.supabase.co" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      problemas.push("NEXT_PUBLIC_SUPABASE_URL: proyecto incorrecto");
    }
  } catch { problemas.push("NEXT_PUBLIC_SUPABASE_URL: URL inválida"); }
  return problemas;
}
export function configuracionRegistro() {
  if (problemasConfiguracionRegistro().length) return null;
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL!, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! };
}
