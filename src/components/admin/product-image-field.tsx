"use client";

import { useEffect, useRef, useState } from "react";
import { reemplazarImagenProducto } from "@/app/(admin)/admin/productos/actions";
import { CatalogImage } from "@/components/media/catalog-image";
import { PendingButton } from "@/components/ui/pending-button";
import { Button } from "@/components/ui/button";
import { TIPO_IMAGEN_PRODUCTO, validarArchivoImagenProducto } from "@/lib/product-image";

type Props = {
  product?: { id: string; rutaImagen: string | null };
  errorServidor?: string;
  saving: boolean;
  onSelectionChange: () => void;
  onSaving: (saving: boolean) => void;
};

export function ProductImageField({ product, errorServidor, saving, onSelectionChange, onSaving }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ruta, setRuta] = useState(product?.rutaImagen ?? null);
  const [archivo, setArchivo] = useState<File>();
  const [vistaPrevia, setVistaPrevia] = useState<string>();
  const [errorArchivo, setErrorArchivo] = useState<string>();
  const [errorGuardado, setErrorGuardado] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const guardando = useRef(false);

  useEffect(() => {
    if (vistaPrevia) return () => URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  async function seleccionar(input: HTMLInputElement) {
    const elegido = input.files?.[0];
    onSelectionChange();
    setArchivo(undefined);
    setVistaPrevia(undefined);
    setErrorArchivo(undefined);
    setErrorGuardado(undefined);
    setAviso(undefined);
    input.setCustomValidity("");
    if (!elegido) return;

    let error = validarArchivoImagenProducto(elegido);
    if (!error) {
      if (!product) input.setCustomValidity("Espera mientras se verifica la imagen.");
      try {
        const cabecera = new Uint8Array(await elegido.slice(0, 12).arrayBuffer());
        const formato = String.fromCharCode(...cabecera);
        if (formato.slice(0, 4) !== "RIFF" || formato.slice(8, 12) !== "WEBP") {
          throw new Error("Formato inválido");
        }
        const imagen = await createImageBitmap(elegido);
        imagen.close();
      } catch {
        error = "Selecciona un archivo WebP válido.";
      }
    }
    if (input.files?.[0] !== elegido) return;
    if (!product) input.setCustomValidity(error ?? "");
    setErrorArchivo(error);
    if (!error) {
      setVistaPrevia(URL.createObjectURL(elegido));
      setArchivo(elegido);
    }
  }

  function quitarSeleccion() {
    const input = inputRef.current;
    if (!input) return;
    input.value = "";
    void seleccionar(input);
  }

  async function guardarImagen() {
    if (!product || !archivo || guardando.current) return;
    guardando.current = true;
    onSaving(true);
    setErrorGuardado(undefined);
    setErrorArchivo(undefined);
    setAviso(undefined);
    try {
      const datos = new FormData();
      datos.set("imagen", archivo);
      const resultado = await reemplazarImagenProducto(product.id, ruta, datos);
      if ("error" in resultado) {
        if (resultado.errorImagen) setErrorArchivo(resultado.errorImagen);
        else setErrorGuardado(resultado.error);
        return;
      }
      setRuta(resultado.ruta);
      quitarSeleccion();
      setAviso("Imagen guardada.");
    } catch {
      setErrorGuardado("No se pudo confirmar el cambio de imagen. Reabre el editor para comprobar el resultado.");
    } finally {
      guardando.current = false;
      onSaving(false);
    }
  }

  const error = errorArchivo ?? errorServidor;
  const src = vistaPrevia ?? ruta;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          <CatalogImage image={src ? { src, alt: vistaPrevia ? "Vista previa" : "Imagen actual", fit: "contain" } : undefined} fallback="package" sizes="56px" fallbackIconClassName="size-6" />
        </div>
        <label className="min-w-0 flex-1 basis-48 text-sm font-medium">
          {ruta ? "Reemplazar imagen" : "Seleccionar imagen"}
          <input
            ref={inputRef}
            name={product ? undefined : "imagen"}
            type="file"
            accept={`.webp,${TIPO_IMAGEN_PRODUCTO}`}
            className="mt-1 block w-full text-xs file:me-2 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1.5"
            onChange={(event) => {
              if (product) event.stopPropagation();
              void seleccionar(event.currentTarget);
            }}
          />
          <span className="mt-1 block text-xs text-muted-foreground">WebP de hasta 500000 bytes.</span>
        </label>
      </div>
      {(archivo || error) && <div className="flex flex-wrap gap-2">
        {product && archivo && !error && <PendingButton type="button" size="sm" variant="outline" pending={saving} pendingLabel="Guardando imagen…" onClick={guardarImagen}>Guardar imagen</PendingButton>}
        <Button type="button" size="sm" variant="ghost" onClick={quitarSeleccion}>Quitar selección</Button>
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">
        {error} Abre <a href="https://squoosh.app" target="_blank" rel="noopener noreferrer" className="underline">Squoosh</a>, sube la imagen, selecciona WebP, ajusta la calidad si hace falta y descarga el archivo.
      </p>}
      {errorGuardado && <p role="alert" className="text-sm text-destructive">{errorGuardado}</p>}
      {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
    </div>
  );
}
