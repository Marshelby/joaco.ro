import { exigirSesionAdmin } from "@/lib/admin/sesion";
import { BUCKET_CONSTANCIAS, LIMITE_CONSTANCIA, rutaConstancia } from "@/lib/constancias";

type Contexto = { params: Promise<{ id: string }> };
const headersPrivados = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

async function recurso({ params }: Contexto) {
  const supabase = await exigirSesionAdmin();
  const { id } = await params;
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) return null;
  return { supabase, id, bucket: supabase.storage.from(BUCKET_CONSTANCIAS), ruta: rutaConstancia(id) };
}

export async function GET(request: Request, contexto: Contexto) {
  const foto = await recurso(contexto);
  if (!foto) return new Response(null, { status: 404, headers: headersPrivados });

  const { data: constancia, error } = await foto.supabase.from("constancias_fotograficas")
    .select("actualizada_en").eq("pedido_id", foto.id).maybeSingle();
  if (error) return new Response(null, { status: 502, headers: headersPrivados });
  const query = new URL(request.url).searchParams;
  if (query.has("estado")) return Response.json(constancia, { headers: headersPrivados });
  if (!constancia) return new Response(null, { status: 404, headers: headersPrivados });

  const { data, error: descarga } = await foto.bucket.download(foto.ruta);
  if (descarga || !data || !["image/webp", "image/jpeg"].includes(data.type)) {
    return new Response(null, { status: 502, headers: headersPrivados });
  }
  const extension = data.type === "image/webp" ? "webp" : "jpg";
  return new Response(data, {
    headers: {
      ...headersPrivados,
      "Content-Type": data.type,
      "Content-Disposition": `${query.has("descargar") ? "attachment" : "inline"}; filename="constancia-${foto.id}.${extension}"`,
    },
  });
}

export async function PUT(request: Request, contexto: Contexto) {
  const foto = await recurso(contexto);
  if (!foto) return new Response(null, { status: 404 });

  const tipo = request.headers.get("content-type");
  if (tipo !== "image/jpeg" && tipo !== "image/webp") return new Response(null, { status: 415 });
  const lector = request.body?.getReader();
  if (!lector) return new Response(null, { status: 400 });

  const partes: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > LIMITE_CONSTANCIA) {
        await lector.cancel().catch(() => {});
        return new Response(null, { status: 413 });
      }
      partes.push(new Uint8Array(value));
    }
  } catch {
    return new Response(null, { status: 400 });
  } finally {
    lector.releaseLock();
  }
  const archivo = new Blob(partes, { type: tipo });
  const firma = new Uint8Array(await archivo.slice(0, 12).arrayBuffer());
  const valida = tipo === "image/jpeg"
    ? firma[0] === 255 && firma[1] === 216 && firma[2] === 255
    : String.fromCharCode(...firma.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...firma.slice(8, 12)) === "WEBP";
  if (!valida) return new Response(null, { status: 415 });

  const { error } = await foto.bucket.upload(foto.ruta, archivo, { contentType: tipo, cacheControl: "0", upsert: true });
  return new Response(null, { status: error ? 502 : 204 });
}

export async function DELETE(_request: Request, contexto: Contexto) {
  const foto = await recurso(contexto);
  if (!foto) return new Response(null, { status: 404 });

  const { error } = await foto.bucket.remove([foto.ruta]);
  if (error) return new Response(null, { status: 502 });
  const { data, error: consulta } = await foto.supabase.from("constancias_fotograficas")
    .select("pedido_id").eq("pedido_id", foto.id).maybeSingle();
  return new Response(null, { status: consulta || data ? 502 : 204 });
}
