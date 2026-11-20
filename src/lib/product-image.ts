export const LIMITE_IMAGEN_PRODUCTO = 500000;
export const TIPO_IMAGEN_PRODUCTO = "image/webp";
export const BUCKET_IMAGEN_PRODUCTO = "imagenes-productos";

export function validarArchivoImagenProducto(archivo: File) {
  if (archivo.size > LIMITE_IMAGEN_PRODUCTO) return "La imagen supera los 500000 bytes.";
  if (archivo.type !== TIPO_IMAGEN_PRODUCTO || archivo.size === 0) return "Selecciona un archivo WebP válido.";
}
