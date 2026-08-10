import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const siguiente = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/";
  let response = NextResponse.redirect(new URL(siguiente, url.origin));
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) },
  });
  if (!code) return NextResponse.redirect(new URL("/iniciar-sesion?error=oauth", url.origin));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/iniciar-sesion?error=oauth", url.origin));
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: perfil } = await supabase.from("perfiles").select("rol").eq("usuario_id", user.id).maybeSingle();
    if (perfil?.rol === "admin") response = NextResponse.redirect(new URL("/admin", url.origin));
  }
  return response;
}
