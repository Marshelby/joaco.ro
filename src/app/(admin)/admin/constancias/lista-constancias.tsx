"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmationDialog, useConfirmation } from "@/components/ui/confirmation-dialog";
import { urlConstancia, type Constancia } from "@/lib/constancias";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";

function Miniatura({ url, numero }: { url: string; numero: string }) {
  const [fallo, setFallo] = useState(false);
  return fallo
    ? <span role="status" className="grid size-20 place-items-center rounded-lg bg-muted p-1 text-center text-xs">Foto no disponible</span>
    : <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir foto de ${numero}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" loading="lazy" className="size-20 rounded-lg bg-muted object-contain" onError={() => setFallo(true)} />
      </a>;
}

export function ListaConstancias({ fecha, constancias }: { fecha: string; constancias: Constancia[] }) {
  const router = useRouter();
  const confirmation = useConfirmation();
  const [objetivo, setObjetivo] = useState<Constancia | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [actualizando, actualizar] = useTransition();
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const dia = formatFechaEntregaLarga(fecha);

  function confirmar(foto: Constancia | null) {
    setObjetivo(foto);
    confirmation.ask(() => void eliminar(foto));
  }

  async function eliminar(foto: Constancia | null) {
    setMensaje(null);
    setOcupado(true);
    try {
      const url = foto ? urlConstancia(foto.pedido_id) : `/api/admin/constancias/dia?fecha=${fecha}`;
      const respuesta = await fetch(url, { method: "DELETE", redirect: "error" });
      if (!respuesta.ok) throw new Error();
      setMensaje({ texto: foto ? "Foto eliminada." : "Se eliminaron las fotografías del día.", error: false });
    } catch {
      setMensaje({ texto: "No se pudo confirmar la eliminación completa. Revisa las fotos restantes e inténtalo de nuevo.", error: true });
    } finally {
      actualizar(() => router.refresh());
      setOcupado(false);
    }
  }

  return <section className="space-y-3" aria-label="Constancias del día">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold">{dia}</h2>
      {constancias.length > 0 && <Button variant="destructive" disabled={ocupado || actualizando} onClick={() => confirmar(null)}>Eliminar fotos del día</Button>}
    </header>
    {ocupado && <p role="status" className="text-sm">Eliminando fotografías…</p>}
    {mensaje && <p role={mensaje.error ? "alert" : "status"} className={mensaje.error ? "text-sm text-destructive" : "text-sm text-primary"}>{mensaje.texto}</p>}
    {constancias.length === 0 && <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">No hay constancias para este día.</p>}
    <ul className="space-y-2">
      {constancias.map(foto => {
        const url = urlConstancia(foto.pedido_id);
        const imagen = `${url}?v=${encodeURIComponent(foto.actualizada_en)}`;
        return <li key={foto.pedido_id} className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border bg-card p-3">
          <Miniatura key={imagen} url={imagen} numero={foto.numero_pedido} />
          <div className="min-w-0 space-y-1">
            <h3 className="font-semibold wrap-anywhere">{foto.nombre_cliente_snapshot}</h3>
            <p className="text-sm text-muted-foreground">{foto.numero_pedido} · {foto.fecha_entrega ? <time dateTime={foto.fecha_entrega}>{dia}</time> : "Fecha de entrega sin registrar"}</p>
            <div className="flex flex-wrap gap-2">
              <a className={buttonVariants({ variant: "secondary" })} href={imagen} target="_blank" rel="noopener noreferrer">Abrir foto</a>
              <a className={buttonVariants({ variant: "outline" })} href={`${url}?descargar`}>Descargar</a>
              <Button variant="destructive" disabled={ocupado || actualizando} onClick={() => confirmar(foto)}>Eliminar</Button>
            </div>
          </div>
        </li>;
      })}
    </ul>
    <ConfirmationDialog confirmation={confirmation} destructive
      title={objetivo ? "¿Eliminar esta constancia?" : "¿Eliminar todas las fotos de este día?"}
      description={objetivo
        ? `Se borrará del almacenamiento la fotografía del pedido ${objetivo.numero_pedido}.`
        : `Se borrarán del almacenamiento todas las fotografías del ${dia}.`}
      confirmLabel={objetivo ? "Eliminar foto" : "Eliminar todas las fotos"} />
  </section>;
}
