import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { resolverDestinoPostAuth } from "@/lib/account/post-auth";
import { obtenerReturnToAutenticacionSeguro } from "@/lib/account/return-to";

function hrefError(returnTo: string | undefined) {
  const parametros = new URLSearchParams({ error: "oauth" });
  const destino = obtenerReturnToAutenticacionSeguro(returnTo);
  if (destino) parametros.set("returnTo", destino);
  return `/iniciar-sesion?${parametros.toString()}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnTo = url.searchParams.get("returnTo") ?? undefined;
  const response = NextResponse.redirect(new URL("/", url.origin));
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) },
  });
  if (!code) {
    response.headers.set("location", new URL(hrefError(returnTo), url.origin).toString());
    return response;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    response.headers.set("location", new URL(hrefError(returnTo), url.origin).toString());
    return response;
  }

  try {
    const resultado = await resolverDestinoPostAuth(
      () => supabase.rpc("ensure_cuenta_cliente_actual"),
      returnTo,
    );
    response.headers.set("location", new URL(resultado.estado === "listo" ? resultado.destino : hrefError(returnTo), url.origin).toString());
  } catch {
    response.headers.set("location", new URL(hrefError(returnTo), url.origin).toString());
  }
  return response;
}
