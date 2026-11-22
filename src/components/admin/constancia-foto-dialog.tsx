"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmationDialog, useConfirmation } from "@/components/ui/confirmation-dialog";
import { comprimirConstancia, FORMATOS_CONSTANCIA } from "@/lib/comprimir-constancia";
import { urlConstancia } from "@/lib/constancias";

export function ConstanciaFotoDialog({ pedidoId, numero }: { pedidoId: string; numero: string }) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  return <Dialog.Root open={abierto} onOpenChange={valor => {
    if (!ocupado) setAbierto(valor);
  }}>
    <Dialog.Trigger render={<Button variant="secondary" />}>Subir foto constancia</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45" />
      <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-3">
        <Dialog.Popup className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-xl border bg-card p-4 shadow-xl outline-none">
          <Dialog.Title className="font-semibold">Constancia · {numero}</Dialog.Title>
          {abierto && <EditorFoto pedidoId={pedidoId} ocupado={ocupado} setOcupado={setOcupado} />}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>;
}

function EditorFoto({ pedidoId, ocupado, setOcupado }: {
  pedidoId: string;
  ocupado: boolean;
  setOcupado: (valor: boolean) => void;
}) {
  const url = urlConstancia(pedidoId);
  const [existente, setExistente] = useState<string | null>();
  const [pendiente, setPendiente] = useState<Blob>();
  const [previewPendiente, setPreviewPendiente] = useState<{ archivo: Blob; url: string }>();
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [intento, setIntento] = useState(0);
  const confirmation = useConfirmation();

  useEffect(() => {
    const controlador = new AbortController();
    fetch(`${url}?estado`, { signal: controlador.signal, redirect: "error" })
      .then(async respuesta => {
        if (!respuesta.ok) throw new Error();
        const foto: { actualizada_en: string } | null = await respuesta.json();
        if (!controlador.signal.aborted) setExistente(foto?.actualizada_en ?? null);
      })
      .catch(() => {
        if (!controlador.signal.aborted) setError("No se pudo consultar la constancia.");
      });
    return () => controlador.abort();
  }, [url, intento]);

  useEffect(() => {
    if (!pendiente) return;
    const url = URL.createObjectURL(pendiente);
    setPreviewPendiente({ archivo: pendiente, url });
    return () => URL.revokeObjectURL(url);
  }, [pendiente]);

  async function seleccionar(archivo?: File) {
    if (!archivo) return;
    setError("");
    setAviso("");
    setPendiente(undefined);
    setOcupado(true);
    try {
      setPendiente(await comprimirConstancia(archivo));
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No se pudo preparar la imagen.");
    } finally {
      setOcupado(false);
    }
  }

  async function modificar(metodo: "PUT" | "DELETE") {
    const archivo = metodo === "PUT" ? pendiente : undefined;
    if (metodo === "PUT" && !archivo) return;
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const respuesta = await fetch(url, {
        method: metodo,
        body: archivo,
        headers: archivo ? { "Content-Type": archivo.type } : undefined,
        redirect: "error",
      });
      if (!respuesta.ok) throw new Error();
      setExistente(archivo ? new Date().toISOString() : null);
      setPendiente(undefined);
      setAviso(archivo ? "Foto guardada." : "Foto eliminada.");
    } catch {
      setError(metodo === "PUT" ? "No se pudo guardar la foto. Inténtalo de nuevo." : "No se pudo confirmar la eliminación. Inténtalo de nuevo.");
      setIntento(valor => valor + 1);
    } finally {
      setOcupado(false);
    }
  }

  const fotoGuardada = existente ? `${url}?v=${encodeURIComponent(existente)}` : null;
  const preview = pendiente ? (previewPendiente?.archivo === pendiente ? previewPendiente.url : null) : fotoGuardada;

  return <div className="mt-3 space-y-3">
    {existente === undefined && !error && <p role="status" className="text-sm">Consultando constancia…</p>}
    {preview && (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={preview} src={preview} alt={pendiente ? "Vista previa de la nueva foto" : "Foto guardada de la constancia"}
        className="max-h-56 w-full rounded-lg bg-muted object-contain"
        onError={() => setError("No se pudo mostrar la foto.")} />
    )}
    {fotoGuardada && !pendiente && <div className="flex flex-wrap gap-2">
      <a className={buttonVariants({ variant: "outline" })} href={fotoGuardada} target="_blank" rel="noopener noreferrer">Abrir foto</a>
      <Button type="button" variant="destructive" disabled={ocupado} onClick={() => confirmation.ask(() => void modificar("DELETE"))}>Eliminar foto</Button>
    </div>}
    {existente !== undefined && <fieldset disabled={ocupado} className="flex flex-wrap gap-2">
      <legend className="mb-2 text-sm text-muted-foreground">{existente ? "Reemplazar foto" : "Adjuntar foto"} · JPEG, PNG, WebP o HEIC/HEIF · Hasta 20 MB</legend>
      {[true, false].map(camara => <label key={String(camara)}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm font-medium focus-within:ring-2 focus-within:ring-ring">
        {camara ? "Tomar foto" : "Elegir imagen"}
        <input type="file" className="sr-only" accept={camara ? "image/*" : FORMATOS_CONSTANCIA}
          capture={camara ? "environment" : undefined} onChange={evento => {
            const archivo = evento.currentTarget.files?.[0];
            evento.currentTarget.value = "";
            void seleccionar(archivo);
          }} />
      </label>)}
    </fieldset>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {aviso && <p role="status" className="text-sm text-primary">{aviso}</p>}
    <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
      <Dialog.Close render={<Button variant="outline" disabled={ocupado} />}>{aviso ? "Cerrar" : "Cancelar"}</Dialog.Close>
      {existente === undefined && error && <Button onClick={() => {
        setError("");
        setIntento(valor => valor + 1);
      }}>Reintentar</Button>}
      {pendiente && <Button disabled={ocupado} onClick={() => void modificar("PUT")}>{ocupado ? "Guardando…" : "Guardar foto"}</Button>}
      {ocupado && !pendiente && <span role="status" className="self-center text-sm">Procesando…</span>}
    </div>
    <ConfirmationDialog confirmation={confirmation} title="¿Eliminar esta constancia?"
      description="La foto guardada se borrará del almacenamiento." confirmLabel="Eliminar foto" destructive />
  </div>;
}
