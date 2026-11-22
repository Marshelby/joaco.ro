import { listarConstancias } from "@/lib/admin/constancias";
import { exigirSesionAdmin } from "@/lib/admin/sesion";
import { BUCKET_CONSTANCIAS, rutaConstancia } from "@/lib/constancias";
import { esFechaCalendario } from "@/lib/operational-date";

export async function DELETE(request: Request) {
  const supabase = await exigirSesionAdmin();
  const fecha = new URL(request.url).searchParams.get("fecha");
  if (!esFechaCalendario(fecha)) return new Response(null, { status: 400 });

  try {
    const constancias = await listarConstancias(supabase, fecha);
    const bucket = supabase.storage.from(BUCKET_CONSTANCIAS);
    for (let inicio = 0; inicio < constancias.length; inicio += 100) {
      const rutas = constancias.slice(inicio, inicio + 100).map(foto => rutaConstancia(foto.pedido_id));
      const { error } = await bucket.remove(rutas);
      if (error) return new Response(null, { status: 502 });
    }
    const { data, error } = await supabase.from("constancias_fotograficas")
      .select("pedido_id").eq("dia_constancia", fecha).limit(1);
    return new Response(null, { status: error || data?.length ? 502 : 204 });
  } catch {
    return new Response(null, { status: 502 });
  }
}
