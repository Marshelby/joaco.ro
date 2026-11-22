import { LIMITE_CONSTANCIA } from "./constancias";

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const FORMATOS_CONSTANCIA = [...TIPOS_IMAGEN, ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"].join(",");

function codificar(canvas: HTMLCanvasElement, tipo: string, calidad: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, tipo, calidad));
}

export async function comprimirConstancia(archivo: File) {
  const tipoGenerico = !archivo.type || archivo.type === "application/octet-stream";
  if (!TIPOS_IMAGEN.includes(archivo.type) && !(tipoGenerico && /\.(jpe?g|png|webp|hei[cf])$/i.test(archivo.name))) {
    throw new Error("Selecciona una imagen JPEG, PNG, WebP o HEIC/HEIF.");
  }
  if (!archivo.size || archivo.size > 20 * 1024 * 1024) {
    throw new Error("La imagen debe pesar entre 1 byte y 20 MB.");
  }

  const url = URL.createObjectURL(archivo);
  const imagen = new Image();
  try {
    imagen.src = url;
    await imagen.decode();
    if (!imagen.naturalWidth || !imagen.naturalHeight) throw new Error();
  } catch {
    throw new Error("No se pudo abrir la imagen. Si el navegador no admite HEIC/HEIF, usa JPEG.");
  } finally {
    URL.revokeObjectURL(url);
  }

  const canvas = document.createElement("canvas");
  const contexto = canvas.getContext("2d", { alpha: false });
  if (!contexto) throw new Error("No se pudo preparar la imagen en este navegador.");
  let tipo = "image/webp";
  for (const [lado, calidad] of [[2400, 0.88], [2400, 0.80], [2000, 0.80], [1600, 0.76]]) {
    const escala = Math.min(1, lado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    canvas.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    contexto.fillStyle = "#fff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.imageSmoothingQuality = "high";
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);

    let blob = await codificar(canvas, tipo, calidad);
    if (tipo === "image/webp" && blob?.type !== tipo) {
      tipo = "image/jpeg";
      blob = await codificar(canvas, tipo, calidad);
    }
    if (blob?.type === tipo && blob.size > 0 && blob.size <= LIMITE_CONSTANCIA) return blob;
  }
  throw new Error("La foto sigue superando 2 MB. Intenta tomar otra incluyendo solo la hoja.");
}
